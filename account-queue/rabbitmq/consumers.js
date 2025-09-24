import dayjs from "dayjs";
import mongoose from "mongoose";
import {
  BalanceHistoryModel,
  ChatSupportModel,
  TransactionModel,
  UserModel,
  MoringaUserModel,
  MoringaTransactionModel,
  FigoUserModel,
  FigoBusinessModel,
  FigoStockModel,
  FigoCustomerModel,
  FigoSupplierModel,
  FigoSaleModel,
  FigoPaymentModel,
  FigoExpenseModel,
  FigoInvoiceModel,
  FigoEditorModel,
  FigoCashFlowModel,
} from "../shared/models/index.js";
import {
  FIGO_ITEM_TYPES,
  FIGO_PAYMENT_METHOD,
  FIGO_PAYMENT_STATUS,
  HISTORY_TYPE,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
  FIGO_ENTRY_TYPES,
} from "../shared/config/statusError.js";
import { StatementTemplate } from "../templates/statement.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import {
  AmountSeparator,
  Eversend_Token,
  Sfh_Token,
  computeLastSeen,
  maskString,
  fromNairaToKobo,
  SendFigoReminder,
  getScheduleExpression,
  sendToWA,
  sendImageToWA,
  formatDay,
} from "../shared/config/helper.js";
import {
  UploadToAWS,
  processEncryptedMedia,
  sendToQueue,
} from "../shared/config/fileHandler.js";
import {
  BANK_LIST,
  DATA_PLANS,
  DISCOS,
  TelCo_Prefix,
  airtimeServices,
  dataServices,
  monthLabel,
} from "../shared/config/data.js";
import { DeleteOpenSearch } from "../shared/config/openSearch.js";
import { AirtimeTemplate } from "../templates/airtime.js";
import { DepositTemplate } from "../templates/deposit.js";
import { TransferTemplate } from "../templates/transfer.js";
import { PowerTemplate } from "../templates/power.js";
import { TVTemplate } from "../templates/tv.js";
import { redisClient } from "../shared/redis.js";
import customId from "custom-id/index.js";
import fetch from "node-fetch";
import { CHAT_RESPONSES } from "../shared/config/responses.js";
import { DataTemplate } from "../templates/data.js";
import { accountDataQueue } from "./queues.js";
import { GenerateStat } from "../templates/stat.js";
import { scheduleReminder, deleteReminder } from "../shared/config/alert.js";
import { getSecrets } from "../shared/config/secrets.js";
import { GenerateInvoice } from "../templates/invoice/index.js";

const {
  SFH_ENDPOINT,
  SFH_CLIENT_ID,
  GRAPH_API_TOKEN,
  WA_PHONE_NUMBER_ID,
  SAFE_HAVEN_MAIN_ACC,
  EVERSEND_ENDPOINT,
  MORINGA_WA_PHONE_NUMBER,
  CANVAS_SERVICE_URL,
  FIGO_WA_PHONE_NUMBER,
  RAG_API_URL
} = await getSecrets();

const FIGO_ENTRY_ACTIONS = {
  edit_product: "edit_product",
  add_product: "add_product",
  add_invoice: "add_invoice",
  edit_invoice: "edit_invoice",
  add_sale: "add_sale",
  edit_sale: "edit_sale",
  add_expense: "add_expense",
  edit_expense: "edit_expense",
  add_customer: "add_customer",
  edit_customer: "edit_customer",
  add_supplier: "add_supplier",
  edit_supplier: "edit_supplier",
  add_payment: "add_payment",
};

export const GenerateStatement = async (msg) => {
  try {
    const { wa_id, start_date, end_date } = msg;
    const user = await UserModel.findOne({ mobile: wa_id });

    let _start = dayjs(new Date(start_date)).startOf("day").toISOString();
    let _end = dayjs(new Date(end_date)).endOf("day").toISOString();

    let history = [];

    history = await BalanceHistoryModel.find({
      user: user._id,
      // createdAt: { $gte: _start, $lte: _end },
      $or: [
        { createdAt: { $gte: _start, $lte: _end } },
        { createdAt: { $gte: _end, $lte: _start } },
      ],
    })
      .populate("transaction link")
      .sort({ createdAt: 1 });

    console.log(history.length, "history length");

    let all_credits = history.filter((el) => el.type == HISTORY_TYPE.CREDIT);
    let all_debits = history.filter((el) => el.type == HISTORY_TYPE.DEBIT);

    all_credits = all_credits.map((e) => e?.balanceAfter - e?.balanceBefore);
    all_debits = all_debits.map((e) => e?.balanceBefore - e?.balanceAfter);

    let total_credit = all_credits.reduce((a, b) => a + b, 0);

    let total_debit = all_debits.reduce((a, b) => a + b, 0);

    let opening_balance =
      history.filter((e, i) => i == 0)[0]?.balanceAfter || 0;
    let closing_balance =
      history.filter((e, i) => i == history.length - 1)[0]?.balanceAfter || 0;

    let start_month = dayjs(new Date(_start)).get("month");
    let start_year = dayjs(new Date(_start)).get("year");
    let end_month = dayjs(new Date(_end)).get("month");
    let end_year = dayjs(new Date(_end)).get("year");

    await StatementTemplate({
      history,
      period: `${monthLabel[start_month]} ${start_year} - ${monthLabel[end_month]} ${end_year}`,
      user: user,
      opening_balance,
      closing_balance,
      total_debit,
      total_credit,
    });
  } catch (error) {
    console.log(error, "error generating statement");
  }
};

export const CreateAccountNumber = async (msg) => {
  try {
    const { wa_id, reference, createAccount } = msg;

    const user = await UserModel.findOne({ mobile: wa_id });
    const sfh_access_token = await Sfh_Token();

    if (!user?.sfh_account?.migration_complete) {
      await UserModel.updateOne(
        { mobile: wa_id },
        {
          $set: {
            "sfh_account._id": createAccount.data._id,
            "sfh_account.bank_name": "Safe Haven MFB",
            "sfh_account.account_number": createAccount.data.accountNumber,
            "sfh_account.account_name": createAccount.data.accountName,
            "sfh_account.daily_limit": 50000,
            "sfh_account.single_limit": 10000,
            "sfh_account.migration_complete": true,
            "sfh_account.reference": reference,
            "kyc.nin.is_verified": true,
            "kyc.level": 1,
          },
        }
      );

      const flow_token = uuidv4();
      await redisClient.set(`flow_token_${flow_token}`, wa_id);

      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: wa_id,
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "text",
              text: "Your Account is ready to use 🎉",
            },
            body: {
              text: "Airtime, Transfer, Bills, Data, Commission",
            },
            footer: {
              text: "Bank on your WhatsApp",
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: flow_token,
                flow_id: "410422032142598",
                flow_cta: "Open",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "LOGIN",
                  data: {
                    account_number_string: `Safe Haven MFB - ${createAccount.data.accountNumber}`,
                    account_name: createAccount.data.accountName,
                    is_verified: true,
                  },
                },
              },
            },
          },
        },
      });

      //Send to Queue
      // fetch(``, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ wa_id }),
      // });

      await sendToQueue(
        JSON.stringify({ intent: accountDataQueue, payload: { wa_id } })
      );
    }

    if (user.account_balance > 0) {
      let resolve = await fetch(`${SFH_ENDPOINT}/transfers/name-enquiry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          accountNumber:
            createAccount?.data?.accountNumber ||
            user.sfh_account.account_number,
          bankCode: "090286",
        }),
      });

      resolve = await resolve.json();

      let buy = await fetch(`${SFH_ENDPOINT}/transfers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          debitAccountNumber: SAFE_HAVEN_MAIN_ACC,
          amount: user.account_balance,
          nameEnquiryReference: resolve.data.sessionId,
          beneficiaryBankCode: "090286",
          beneficiaryAccountNumber:
            createAccount?.data?.accountNumber ||
            user.sfh_account.account_number,
          saveBeneficiary: false,
        }),
      });

      buy = await buy.json();

      if (buy?.statusCode == 200) {
        await UserModel.updateOne(
          { _id: user._id },
          {
            $set: {
              account_balance: 0,
            },
          }
        );
        //Ack msg here
      }
    } else {
    }
  } catch (error) {
    console.log(error, "error creating account number");
  }
};

export const SendOtpToBVN = async (msg) => {
  try {
    const { wa_id, bvn } = msg;
    //Ack message here

    const sfh_access_token = await Sfh_Token();

    let upload = await fetch(`${SFH_ENDPOINT}/identity/v2`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sfh_access_token}`,
        "Content-Type": "application/json",
        ClientID: SFH_CLIENT_ID,
      },
      body: JSON.stringify({
        type: "BVN",
        number: bvn,
        debitAccountNumber: SAFE_HAVEN_MAIN_ACC, //SLASHIT PAYMENTS LIMITED - MAIN ACCOUNT
      }),
    });

    upload = await upload.json();

    console.log(upload);

    if (upload.statusCode !== 200)
      throw new Error(
        upload.message ||
          "Unable to send OTP to phone number registered with BVN!"
      );

    await UserModel.updateOne(
      { mobile: wa_id },
      {
        $set: {
          "kyc.bvn.value": bvn,
          "kyc.bvn.verification_id": upload?.data?._id,
        },
      }
    );
  } catch (error) {
    console.log(error, "error sending otp to BVN");
  }
};

export const SendOtpToNIN = async (msg) => {
  try {
    const { wa_id, nin } = msg;
    //Ack message here

    const sfh_access_token = await Sfh_Token();

    let upload = await fetch(`${SFH_ENDPOINT}/identity/v2`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sfh_access_token}`,
        "Content-Type": "application/json",
        ClientID: SFH_CLIENT_ID,
      },
      body: JSON.stringify({
        type: "NIN",
        number: nin,
        debitAccountNumber: SAFE_HAVEN_MAIN_ACC, //SLASHIT PAYMENTS LIMITED - MAIN ACCOUNT
      }),
    });

    upload = await upload.json();

    console.log(upload);

    if (upload.statusCode !== 200)
      throw new Error(
        upload.message ||
          "Unable to send OTP to phone number registered with NIN!"
      );

    await UserModel.updateOne(
      { mobile: wa_id },
      {
        $set: {
          "kyc.nin.value": nin,
          "kyc.nin.verification_id": upload?.data?._id,
        },
      }
    );
  } catch (error) {
    console.log(error, "error sending otp to NIN");
  }
};

export const CompleteUploadID = async (msg) => {
  try {
    const receivedMessage = msg;

    const { wa_id, type: id_type } = receivedMessage;

    let image = receivedMessage.image[0];

    const decryptedMedia = await processEncryptedMedia({
      encryptionKey: image.encryption_metadata.encryption_key,
      hmacKey: image.encryption_metadata.hmac_key,
      iv: image.encryption_metadata.iv,
      expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
      expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
      imageUrl: image.cdn_url,
      fileName: image.file_name,
    });

    const user = await UserModel.findOne({ mobile: wa_id });

    //Upload to aws and update database
    const Location = await UploadToAWS({
      Body: decryptedMedia,
      Key: `${new Date().getTime()}`, //`${uuidv4()}.png`,
      ContentType: "application/octet-stream",
    });

    let ticket = customId({
      name: "123456",
      email: "78910",
      randomLength: 2,
    });

    ticket = `${id_type.toUpperCase()}_Review_${ticket}`;

    const chat_flow_token = uuidv4();
    const support_lines = ["2348148026795"];
    const comment = `Document Review - ${id_type.toUpperCase()}. [See attachment](${Location})`;

    await redisClient.set(
      `chat_flow_token_${chat_flow_token}`,
      support_lines[0]
    );

    await ChatSupportModel.insertMany({
      author: wa_id,
      comment,
      ticket,
      user,
      read: true,
    });

    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: support_lines[0], //To Customer support person WA
        type: "interactive",
        interactive: {
          type: "flow",
          header: {
            type: "image",
            image: {
              link: "https://figoassets.s3.us-east-1.amazonaws.com/support-david-1745503906292", //Customer support person photo
            },
          },
          body: {
            text: comment.substring(0, 200),
          },
          footer: {
            text: user.mobile,
          },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: chat_flow_token,
              flow_id: "1149431703376171",
              mode: "published",
              flow_cta: "Reply now",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "CHAT_SUPPORT",
                data: {
                  ...CHAT_RESPONSES.CHAT_SUPPORT.data,
                  ticket,
                  field1_author: `**${user.mobile}**`,
                  field1_date: `**${dayjs()
                    .add(1, "hour")
                    .format("MMM DD, YYYY. h:mm a")}**`,
                  field1_comment: comment,
                  field1_visible: true,
                },
              },
            },
          },
        },
      },
    });

    if (id_type === "signature") {
      await UserModel.updateOne(
        { mobile: wa_id },
        {
          $set: {
            "kyc.signature.value": Location,
          },
        }
      );
    }

    if (id_type === "address") {
      await UserModel.updateOne(
        { mobile: wa_id },
        {
          $set: {
            "kyc.proof_of_address.value": Location,
          },
        }
      );
    }

    if (["nin", "dvl", "passport"].includes(id_type)) {
      await UserModel.updateOne(
        { mobile: wa_id },
        {
          $set: {
            "kyc.id_card.value": Location,
            "kyc.id_card.type": id_type,
          },
        }
      );
    }
  } catch (error) {
    console.log(error, "error uploading id");
  }
};

export const FinishTransaction = async (msg) => {
  try {
    const { user, transaction, description, type, buy } = msg;

    const bill_types = ["airtime", "data", "power", "dstv"];
    let commission = 0;
    let fee = 0;
    let debit_ref = "";

    if (!user?.sfh_account?.migration_complete) {
      await UserModel.updateOne(
        { _id: user._id },
        {
          $inc: {
            account_balance: -transaction.amount,
            "sfh_account.daily_limit_count": transaction.amount,
          },
        }
      );

      //Ack Message here

      await BalanceHistoryModel.insertMany({
        user: user,
        balanceBefore: transaction.balance_before,
        balanceAfter: transaction.balance_after,
        type: HISTORY_TYPE.DEBIT,
        transaction: transaction,
        description,
      });
    } else {
      const sfh_access_token = await Sfh_Token();

      if (bill_types.includes(type)) {
        let vasTnxs = await fetch(`${SFH_ENDPOINT}/vas/transactions`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
        });

        vasTnxs = await vasTnxs.json();

        const vasTnx = vasTnxs.data.filter(
          (e) => e.internalReference === buy.data?.reference
        )[0];

        if (vasTnx.debitedAmount < vasTnx.transactionAmount)
          commission = vasTnx.transactionAmount - vasTnx.debitedAmount;

        fee = vasTnx.transactionFee;
        debit_ref = vasTnx.debitPaymentReference;
      } else {
        debit_ref = buy.data?.sessionId;
      }

      let statement_data = await fetch(
        `${SFH_ENDPOINT}/accounts/${user.sfh_account._id}/statement?page=0&limit=25&type=Debit`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
        }
      );

      statement_data = await statement_data.json();

      console.log(statement_data, "statement_data");

      let matched = statement_data.data.filter(
        (e) => e.paymentReference == debit_ref
      );

      matched.forEach(async (e) => {
        let balanceAfter = e.runningBalance;
        let sfh_amount = e.amount;
        let balanceBefore = balanceAfter + sfh_amount;

        await BalanceHistoryModel.insertMany({
          user: user,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          type: HISTORY_TYPE.DEBIT,
          transaction: transaction,
          description: type == "transfer" ? e.narration : description,
        });
      });

      await UserModel.updateOne(
        { _id: user._id },
        {
          $inc: {
            "sfh_account.daily_limit_count": transaction.amount,
          },
        }
      );

      //Ack Message here
    }

    await TransactionModel.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: TRANSACTION_STATUS.SUCCESS,
          description,
        },
      }
    );

    console.log("spot 1");

    if (!["power", "transfer", "airtime", "dstv", "data"].includes(type))
      return;
    console.log("spot 2");
    //Send message to WA
    let text_to_image = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `₦${transaction.amount}`,
      }),
    });

    console.log("spot 3");

    text_to_image = await text_to_image.json();
    console.log(text_to_image, "text_to_image");

    let banner;

    if (text_to_image?.buffer) {
      banner = await UploadToAWS({
        Body: Buffer.from(text_to_image.buffer, "base64"),
        Key: `${customId({
          name: "123456",
          email: "78910",
          randomLength: 2,
        })}.png`,
        ContentType: "image/png",
      });
    }

    console.log(banner, "banner");

    let flowData = {
      title: "Receipt",
      reference: buy.data?.sessionId || transaction.payment_ref,
      field1_key: "Type",
      field1_value: type.toUpperCase(),
      field2_key: "Reference or Session ID",
      field2_value: buy.data?.sessionId || transaction.payment_ref,
      field3_key: "Amount",
      field3_value: `NGN ${AmountSeparator(transaction.amount)}`,
    };

    let flowBody;
    let flowFooter;

    if (type == "airtime") {
      flowData = {
        ...flowData,
        field4_key: "Network",
        field4_value: transaction.misc.network.toUpperCase(),
        field5_key: "Phone number",
        field5_value: transaction.misc.phone_number,
        field6_key: "Service",
        field6_value: transaction.misc.service,
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value: "Completed",
      };
      flowBody = `*Airtime to ${transaction.misc.phone_number}*`;
      flowFooter = `*Debit*`;
    }

    if (type == "data") {
      flowData = {
        ...flowData,
        field4_key: "Network",
        field4_value: transaction.misc.network,
        field5_key: "Phone number",
        field5_value: transaction.misc.phone_number,
        field6_key: "Bundle",
        field6_value: transaction.misc.bundle_code,
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value: "Completed",
      };
      flowBody = `*${transaction.misc.bundle_code.substring(0, 100)} to ${
        transaction.misc.phone_number
      }*`;
      flowFooter = `*Debit*`;
    }

    if (type == "dstv") {
      flowData = {
        ...flowData,
        field4_key: "Card name",
        field4_value: transaction.misc.card_name,
        field5_key: "Card number",
        field5_value: transaction.misc.card_number,
        field6_key: "Package",
        field6_value: transaction.misc.bundle_code,
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value: "Completed",
      };
      flowBody = `*${transaction.misc.bundle_code.substring(
        0,
        100
      )} to ${transaction.misc.card_name.substring(0, 100)}*`;
      flowFooter = `*Debit*`;
    }

    if (type == "power") {
      await TransactionModel.updateOne(
        { _id: transaction._id },
        {
          $set: {
            "misc.meter_token": buy.data.utilityToken,
          },
        }
      );

      flowData = {
        ...flowData,
        field1_key: "Type",
        field1_value: `${transaction.misc?.disco || ""} ${
          transaction.misc?.vend_type || ""
        }`,
        field4_key: "Meter number",
        field4_value: transaction.misc.meter_number,
        field5_key: "Meter name",
        field5_value: transaction.misc.meter_name,
        field6_key: "Token",
        field6_value: buy?.data?.utilityToken || "N/A",
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value: "Completed",
      };
      flowBody = `*Your Meter token is here*`;
      flowFooter = `*${buy?.data?.utilityToken || "-"}*`;
    }

    if (type == "transfer") {
      let bank_name = BANK_LIST.filter(
        (e) => e.bankCode == transaction.misc.bank_code
      )[0].name;

      await TransactionModel.updateOne(
        { _id: transaction._id },
        { $set: { payment_ref: buy.data.sessionId } }
      );

      flowData = {
        ...flowData,
        field4_key: "Sender name",
        field4_value: user.sfh_account.account_name,
        field5_key: "Sender account",
        field5_value: maskString(user.sfh_account.account_number),
        field6_key: "Beneficiary name",
        field6_value: transaction.misc.account_name,
        field7_key: "Beneficiary bank",
        field7_value: bank_name || "SFH",
        field8_key: "Beneficiary account",
        field8_value: maskString(transaction.misc.account_number),
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),

        field10_key: "Status",
        field10_value: "Completed",
      };
      flowBody = `*Transfer to ${transaction.misc.account_name}*`;
      flowFooter = `*Debit*`;
    }

    const view_receipt_flow_token = uuidv4();

    await redisClient.set(
      `view_receipt_flow_token_${view_receipt_flow_token}`,
      user.mobile
    );

    if (computeLastSeen(user.last_seen)) {
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: user.mobile,
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "image",
              image: {
                link: banner || "https://i.ibb.co/k0y6hBM/Frame-5-6.png", //Or banner
              },
            },
            body: {
              text: flowBody,
            },
            footer: {
              text: flowFooter,
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: view_receipt_flow_token,
                flow_id: "2578216989036817",
                mode: "published",
                flow_cta: "View Receipt",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "VIEW_RECEIPT",
                  data: flowData,
                },
              },
            },
          },
        },
      });
    } else {
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: user.mobile,
          type: "template",
          template: {
            name: "debit_success_1",
            language: {
              code: "en",
            },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "image",
                    image: {
                      link: banner || "https://i.ibb.co/k0y6hBM/Frame-5-6.png",
                    },
                  },
                ],
              },
              {
                type: "button",
                sub_type: "flow",
                index: "0",
                parameters: [
                  {
                    type: "action",
                    action: {
                      flow_token: view_receipt_flow_token,
                      flow_action_data: {
                        ...flowData,
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      });
    }
  } catch (error) {
    console.log(error, "error at Finish Transaction");
  }
};

export const NewFinishTransaction = async (msg) => {
  try {
    const { user, type, amount, metadata } = msg;

    const { to, bundle, network, account_number, bank_code } = metadata;

    const sfh_access_token = await Sfh_Token();
    let debit_account = user.sfh_account.account_number;

    let payment_ref = customId({
      name: user._id.toString(),
      email: sfh_access_token,
      randomLength: 2,
    });
    const transaction_id = new mongoose.Types.ObjectId();

    if (type == "airtime") {
      if (network == "recent") {
        const arr_of_phone_numbers = to.split(",");

        arr_of_phone_numbers.forEach(async (item) => {
          const get_transaction = await TransactionModel.findOne({
            "misc.phone_number": item,
          });

          let to = get_transaction.misc.phone_number;
          let serviceName = get_transaction.misc.network;
          let serviceCategoryId = get_transaction.misc.service;
          const transaction_id = new mongoose.Types.ObjectId();

          const transaction = {
            _id: transaction_id,
            payment_ref,
            misc: {
              phone_number: to,
              service: serviceCategoryId,
              network: serviceName,
              debit_account,
            },
            type: TRANSACTION_TYPE.AIRTIME,
            balance_before: 0,
            balance_after: 0,
            user: user._id,
            amount,
          };

          await TransactionModel.insertMany(transaction);

          let Pay = await fetch(`${SFH_ENDPOINT}/vas/pay/airtime`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sfh_access_token}`,
              "Content-Type": "application/json",
              ClientID: SFH_CLIENT_ID,
            },
            body: JSON.stringify({
              serviceCategoryId,
              channel: "WEB",
              debitAccountNumber: debit_account,
              phoneNumber: to,
              amount: amount,
            }),
          });

          Pay = await Pay.json();

          console.log(Pay, "Pay");

          if (
            Pay?.data?.status == "successful" ||
            Pay?.data?.status == "processing"
          ) {
            console.log("Airtime success");
            await TransactionModel.updateOne(
              { _id: transaction_id },
              {
                $set: {
                  status: TRANSACTION_STATUS.SUCCESS,
                  description: `Airtime to ${to}`,
                },
              }
            );
            cleanUp({ Pay, user, transaction, sfh_access_token, type });
            // receiptFlow({ Pay, transaction, commission, fee, type });
          } else {
            return failedMessage({
              user,
              message:
                "Airtime to" + " " + serviceName.toUpperCase() + " " + to,
            });
          }
        });
      } else {
        const serviceName = airtimeServices.filter((e) => e.name == network)[0]
          .name;

        const serviceCategoryId = airtimeServices.filter(
          (e) => e.name == network
        )[0]._id;

        const transaction = {
          _id: transaction_id,
          payment_ref,
          misc: {
            phone_number: to,
            service: serviceCategoryId,
            network: serviceName,
            debit_account,
          },
          type: TRANSACTION_TYPE.AIRTIME,
          balance_before: 0,
          balance_after: 0,
          user: user._id,
          amount,
        };

        await TransactionModel.insertMany(transaction);

        let Pay = await fetch(`${SFH_ENDPOINT}/vas/pay/airtime`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            serviceCategoryId,
            channel: "WEB",
            debitAccountNumber: debit_account,
            phoneNumber: to,
            amount: amount,
          }),
        });

        Pay = await Pay.json();

        console.log(Pay, "Pay");

        if (
          Pay?.data?.status == "successful" ||
          Pay?.data?.status == "processing"
        ) {
          console.log("Airtime success");
          await TransactionModel.updateOne(
            { _id: transaction_id },
            {
              $set: {
                status: TRANSACTION_STATUS.SUCCESS,
                description: `Airtime to ${to}`,
              },
            }
          );
          cleanUp({ Pay, user, transaction, sfh_access_token, type });
          // receiptFlow({ Pay, transaction, commission, fee, type });
        } else {
          return failedMessage({
            user,
            message: "Airtime to" + " " + network.toUpperCase() + " " + to,
          });
        }
      }
    }

    if (type == "data") {
      const dataPlan = DATA_PLANS.filter((e) => e.id == bundle)[0];
      const serviceName = dataServices
        .filter((e) => e._id == dataPlan.service)[0]
        .name.toUpperCase();

      const transaction = {
        _id: transaction_id,
        payment_ref,
        misc: {
          phone_number: to,
          bundle_code: dataPlan.bundle_code,
          service: dataPlan.service,
          network: serviceName,
          debit_account: user.sfh_account.account_number,
        },
        type: TRANSACTION_TYPE.DATA,
        balance_before: 0,
        balance_after: 0,
        user: user._id,
        amount,
      };

      await TransactionModel.insertMany(transaction);

      let Pay = await fetch(`${SFH_ENDPOINT}/vas/pay/data`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          channel: "WEB",
          debitAccountNumber: debit_account,
          phoneNumber: to,
          serviceCategoryId: dataPlan.service,
          bundleCode: dataPlan.bundle_code,
          amount,
        }),
      });

      Pay = await Pay.json();
      console.log(Pay, "Pay");

      if (
        Pay?.data?.status == "successful" ||
        Pay?.data?.status == "processing"
      ) {
        console.log("Data success");
        await TransactionModel.updateOne(
          { _id: transaction_id },
          {
            $set: {
              status: TRANSACTION_STATUS.SUCCESS,
              description: `${bundle} to ${to}`,
            },
          }
        );
        cleanUp({ Pay, user, transaction, sfh_access_token, type });
        // receiptFlow({ Pay, transaction, commission, fee, type });
      } else {
        return failedMessage({
          user,
          message: " " + bundle + " " + "to" + " " + to,
        });
      }
    }

    if (type == "dstv") {
      const serviceCategoryId = "61efad38da92348f9dde5faa";

      let resolve = await fetch(`${SFH_ENDPOINT}/vas/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          serviceCategoryId,
          entityNumber: to,
        }),
      });

      resolve = await resolve.json();

      if (resolve?.statusCode !== 200) {
        return failedMessage({
          user,
          message: " " + "DSTV subscription" + "to" + to,
        });
      }

      const transaction = {
        _id: transaction_id,
        payment_ref,
        misc: {
          card_number: to,
          card_name: resolve.data.name,
          service: serviceCategoryId,
          bundle_code: bundle,
          debit_account: user.sfh_account.account_number,
        },
        type: TRANSACTION_TYPE.BILL,
        balance_before: 0,
        balance_after: 0,
        user: user._id,
        amount,
      };

      await TransactionModel.insertMany(transaction);

      let Pay = await fetch(`${SFH_ENDPOINT}/vas/pay/cable-tv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          channel: "WEB",
          debitAccountNumber: debit_account,
          serviceCategoryId,
          bundleCode: bundle,
          cardNumber: to,
          amount,
        }),
      });

      Pay = await Pay.json();
      console.log(Pay, "Pay");

      if (
        Pay?.data?.status == "successful" ||
        Pay?.data?.status == "processing"
      ) {
        console.log("DSTV success");

        await TransactionModel.updateOne(
          { _id: transaction_id },
          {
            $set: {
              status: TRANSACTION_STATUS.SUCCESS,
              description: `DSTV ${to}`,
            },
          }
        );
        cleanUp({ Pay, user, transaction, sfh_access_token, type });
        // receiptFlow({ Pay, transaction, commission, fee, type });
      } else {
        return failedMessage({
          user,
          message: " " + bundle + "to" + to,
        });
      }
    }

    if (type == "transfer") {
      if (network == "recent") {
        const arr_of_accounts = to.split(",");

        arr_of_accounts.forEach(async (item) => {
          const account = await TransactionModel.findOne({
            _id: item,
          });

          let account_number = account.misc.account_number;
          let bank_code = account.misc.bank_code;

          let resolveSelf = await fetch(
            `${SFH_ENDPOINT}/transfers/name-enquiry`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${sfh_access_token}`,
                "Content-Type": "application/json",
                ClientID: SFH_CLIENT_ID,
              },
              body: JSON.stringify({
                accountNumber: SAFE_HAVEN_MAIN_ACC,
                bankCode: "090286",
              }),
            }
          );

          resolveSelf = await resolveSelf.json();

          if (resolveSelf?.statusCode !== 200) {
            return failedMessage({
              user,
              message: " " + "Transfer to" + " " + account_number,
            });
          }

          let PaySelf = await fetch(`${SFH_ENDPOINT}/transfers`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sfh_access_token}`,
              "Content-Type": "application/json",
              ClientID: SFH_CLIENT_ID,
            },
            body: JSON.stringify({
              debitAccountNumber: debit_account,
              amount,
              nameEnquiryReference: resolveSelf.data.sessionId,
              beneficiaryBankCode: resolveSelf.data.bankCode,
              beneficiaryAccountNumber: resolveSelf.data.accountNumber,
              saveBeneficiary: true,
            }),
          });

          PaySelf = await PaySelf.json();

          if (PaySelf?.statusCode !== 200) {
            return failedMessage({
              user,
              message: " " + "Transfer to" + " " + account_number,
            });
          }

          let resolve = await fetch(`${SFH_ENDPOINT}/transfers/name-enquiry`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sfh_access_token}`,
              "Content-Type": "application/json",
              ClientID: SFH_CLIENT_ID,
            },
            body: JSON.stringify({
              accountNumber: account_number,
              bankCode: bank_code,
            }),
          });

          resolve = await resolve.json();

          if (resolve?.statusCode !== 200) {
            return failedMessage({
              user,
              message: " " + "Transfer to" + " " + account_number,
            });
          }

          const transaction_id = new mongoose.Types.ObjectId();

          const transaction = {
            _id: transaction_id,
            payment_ref,
            misc: {
              name_enquiry: resolve.data.sessionId,
              account_name: resolve.data.accountName,
              account_number: resolve.data.accountNumber,
              bank_code: resolve.data.bankCode,
              debit_account: user.sfh_account.account_number,
              paymentReference: PaySelf.data.sessionId,
            },
            type: TRANSACTION_TYPE.TRANSFER,
            balance_before: 0,
            balance_after: 0,
            user: user._id,
            amount,
          };

          await TransactionModel.insertMany(transaction);

          let Pay = await fetch(`${SFH_ENDPOINT}/transfers`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sfh_access_token}`,
              "Content-Type": "application/json",
              ClientID: SFH_CLIENT_ID,
            },
            body: JSON.stringify({
              debitAccountNumber: SAFE_HAVEN_MAIN_ACC,
              amount,
              nameEnquiryReference: resolve.data.sessionId,
              beneficiaryBankCode: resolve.data.bankCode,
              beneficiaryAccountNumber: resolve.data.accountNumber,
              saveBeneficiary: true,
              narration:
                resolve.data.bankCode == "090286"
                  ? transaction_id
                  : user.sfh_account.account_name,
            }),
          });

          Pay = await Pay.json();
          console.log(Pay, "Pay");

          if (Pay?.statusCode == 200) {
            console.log("Transfer success");

            await TransactionModel.updateOne(
              { _id: transaction_id },
              {
                $set: {
                  status: TRANSACTION_STATUS.SUCCESS,
                  description: `Transfer to ${resolve.data.accountName}`,
                },
              }
            );
            cleanUp({ Pay, user, transaction, sfh_access_token, type });
            //receiptFlow({ Pay, transaction, commission, fee, type });
          } else {
            return failedMessage({
              user,
              message: " " + "Transfer to" + " " + resolve.data.accountName,
            });
          }
        });
      } else {
        let resolveSelf = await fetch(
          `${SFH_ENDPOINT}/transfers/name-enquiry`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sfh_access_token}`,
              "Content-Type": "application/json",
              ClientID: SFH_CLIENT_ID,
            },
            body: JSON.stringify({
              accountNumber: SAFE_HAVEN_MAIN_ACC,
              bankCode: "090286",
            }),
          }
        );

        resolveSelf = await resolveSelf.json();

        if (resolveSelf?.statusCode !== 200) {
          return failedMessage({
            user,
            message: " " + "Transfer to" + " " + account_number,
          });
        }

        let PaySelf = await fetch(`${SFH_ENDPOINT}/transfers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            debitAccountNumber: debit_account,
            amount,
            nameEnquiryReference: resolveSelf.data.sessionId,
            beneficiaryBankCode: resolveSelf.data.bankCode,
            beneficiaryAccountNumber: resolveSelf.data.accountNumber,
            saveBeneficiary: true,
          }),
        });

        PaySelf = await PaySelf.json();

        if (PaySelf?.statusCode !== 200) {
          return failedMessage({
            user,
            message: " " + "Transfer to" + " " + account_number,
          });
        }

        let resolve = await fetch(`${SFH_ENDPOINT}/transfers/name-enquiry`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            accountNumber: account_number,
            bankCode: bank_code,
          }),
        });

        resolve = await resolve.json();

        if (resolve?.statusCode !== 200) {
          return failedMessage({
            user,
            message: " " + "Transfer to" + " " + account_number,
          });
        }
        const transaction = {
          _id: transaction_id,
          payment_ref,
          misc: {
            name_enquiry: resolve.data.sessionId,
            account_name: resolve.data.accountName,
            account_number: resolve.data.accountNumber,
            bank_code: resolve.data.bankCode,
            debit_account: user.sfh_account.account_number,
            paymentReference: PaySelf.data.sessionId,
          },
          type: TRANSACTION_TYPE.TRANSFER,
          balance_before: 0,
          balance_after: 0,
          user: user._id,
          amount,
        };

        await TransactionModel.insertMany(transaction);

        let Pay = await fetch(`${SFH_ENDPOINT}/transfers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            debitAccountNumber: SAFE_HAVEN_MAIN_ACC,
            amount,
            nameEnquiryReference: resolve.data.sessionId,
            beneficiaryBankCode: resolve.data.bankCode,
            beneficiaryAccountNumber: resolve.data.accountNumber,
            saveBeneficiary: true,
            narration:
              resolve.data.bankCode == "090286"
                ? transaction_id
                : user.sfh_account.account_name,
          }),
        });

        Pay = await Pay.json();
        console.log(Pay, "Pay");

        if (Pay?.statusCode == 200) {
          console.log("Transfer success");

          await TransactionModel.updateOne(
            { _id: transaction_id },
            {
              $set: {
                status: TRANSACTION_STATUS.SUCCESS,
                description: `Transfer to ${resolve.data.accountName}`,
              },
            }
          );
          cleanUp({ Pay, user, transaction, sfh_access_token, type });
          //receiptFlow({ Pay, transaction, commission, fee, type });
        } else {
          return failedMessage({
            user,
            message: " " + "Transfer to" + " " + resolve.data.accountName,
          });
        }
      }
    }

    if (type == "power") {
      const serviceCategoryId = DISCOS.filter((e) => e._id == network)[0]._id;

      const serviceName = DISCOS.filter((e) => e._id == network)[0].name;

      let resolve = await fetch(`${SFH_ENDPOINT}/vas/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          serviceCategoryId,
          entityNumber: to,
        }),
      });

      resolve = await resolve.json();

      if (resolve?.statusCode !== 200) {
        return failedMessage({ user, message: " " + serviceName + " " + to });
      }

      const transaction = {
        _id: transaction_id,
        payment_ref,
        misc: {
          meter_number: resolve.data.meterNo,
          meter_name: resolve.data.name,
          address: resolve.data.address,
          vend_type: resolve.data.vendType,
          service: serviceCategoryId,
          disco: serviceName,
          debit_account: user.sfh_account.account_number,
        },
        type: TRANSACTION_TYPE.BILL,
        balance_before: 0,
        balance_after: 0,
        user: user._id,
        amount,
      };

      await TransactionModel.insertMany(transaction);

      let Pay = await fetch(`${SFH_ENDPOINT}/vas/pay/utility`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          channel: "WEB",
          debitAccountNumber: debit_account,
          serviceCategoryId,
          amount,
          meterNumber: resolve.data.meterNo,
          vendType: resolve.data.vendType,
        }),
      });

      Pay = await Pay.json();
      console.log(Pay, "Pay");
      if (
        Pay?.data?.status == "successful" ||
        Pay?.data?.status == "processing"
      ) {
        console.log("Power success");

        await TransactionModel.updateOne(
          { _id: transaction_id },
          {
            $set: {
              status: TRANSACTION_STATUS.SUCCESS,
              description: `Utility to ${to}`,
            },
          }
        );
        cleanUp({ Pay, user, transaction, sfh_access_token, type });
        //receiptFlow({ Pay, transaction, commission, fee, type });
      } else {
        return failedMessage({ user, message: " " + serviceName + " " + to });
      }
    }
  } catch (error) {
    console.log(error, "error at Finish Transaction");
  }
};

export const SelfService = async (msg) => {
  try {
    const { wa_id, amount } = msg;
    console.log(wa_id, amount);
    let type = "airtime";

    let network = "";

    let without_code = wa_id.slice(3);
    let to = `0${without_code}`;
    let prefix = `0${without_code.substring(0, 3)}`;
    let telcos = TelCo_Prefix.filter((e) => e.id == prefix);

    if (telcos.length > 0) {
      network = telcos[0].network;
    } else {
      return failedMessage({
        user: { mobile: wa_id },
        message: "Airtime to" + " " + network.toUpperCase() + " " + to,
      });
    }

    const user = await UserModel.findOne({ mobile: wa_id });

    if (!user || !user?.sfh_account?.migration_complete)
      return failedMessage({
        user,
        message: "Airtime to" + " " + network.toUpperCase() + " " + to,
      });

    const sfh_access_token = await Sfh_Token();
    let debit_account = user.sfh_account.account_number;

    let payment_ref = customId({
      name: user._id.toString(),
      email: sfh_access_token,
      randomLength: 2,
    });

    const transaction_id = new mongoose.Types.ObjectId();

    if (type == "airtime") {
      const serviceName = airtimeServices.filter((e) => e.name == network)[0]
        .name;

      const serviceCategoryId = airtimeServices.filter(
        (e) => e.name == network
      )[0]._id;

      const transaction = {
        _id: transaction_id,
        payment_ref,
        misc: {
          phone_number: to,
          service: serviceCategoryId,
          network: serviceName,
          debit_account,
        },
        type: TRANSACTION_TYPE.AIRTIME,
        balance_before: 0,
        balance_after: 0,
        user: user._id,
        amount,
      };

      await TransactionModel.insertMany(transaction);

      let Pay = await fetch(`${SFH_ENDPOINT}/vas/pay/airtime`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
        body: JSON.stringify({
          serviceCategoryId,
          channel: "WEB",
          debitAccountNumber: debit_account,
          phoneNumber: to,
          amount: amount,
        }),
      });

      Pay = await Pay.json();

      console.log(Pay, "Pay");

      if (
        Pay?.data?.status == "successful" ||
        Pay?.data?.status == "processing"
      ) {
        console.log("Airtime success");
        await TransactionModel.updateOne(
          { _id: transaction_id },
          {
            $set: {
              status:
                Pay?.data?.status == "successful"
                  ? TRANSACTION_STATUS.SUCCESS
                  : TRANSACTION_STATUS.PENDING,
              description: `Airtime to ${to}`,
            },
          }
        );
        cleanUp({ Pay, user, transaction, sfh_access_token, type });
        // receiptFlow({ Pay, transaction, commission, fee, type });
      } else {
        return failedMessage({
          user,
          message: "Airtime to" + " " + network.toUpperCase() + " " + to,
        });
      }
    }
  } catch (error) {
    console.log(error, "error at Self Service");
  }
};

export const SendReceipt = async (browser, msg) => {
  try {
    const { transaction } = msg;
    console.log("Received msg at send receipt:", transaction.type);

    let account_name = "";
    let account_number = "";
    let sender_name = "";
    let sender_account = "";

    if (transaction.type == TRANSACTION_TYPE.DEPOSIT) {
      account_name = transaction.user?.sfh_account?.account_name || "You";
      account_number =
        maskString(transaction.user?.sfh_account?.account_number || "") || "";
      sender_name = transaction.misc?.account_name || "";
      sender_account = maskString(transaction.misc?.account_number || "") || "";
    }

    if (transaction.type == TRANSACTION_TYPE.TRANSFER) {
      sender_name = transaction.user?.sfh_account?.account_name || "You";
      sender_account =
        maskString(transaction.user?.sfh_account?.account_number || "") || "";
      account_name = transaction.misc?.account_name || "";
      account_number = maskString(transaction.misc?.account_number || "") || "";
    }

    let data = {
      ...transaction,
      date: dayjs(transaction.createdAt)
        .add(1, "hour")
        .format("ddd, MMM DD, YYYY. h:mm a"),
      amount: `NGN ${AmountSeparator(transaction.amount)}`,
      misc: {
        ...transaction.misc,
        account_name,
        account_number,
        sender_name,
        sender_account,
      },
    };

    if (transaction.type == TRANSACTION_TYPE.AIRTIME) {
      await AirtimeTemplate(data, browser);
    }

    if (transaction.type == TRANSACTION_TYPE.DATA) {
      await DataTemplate(data, browser);
    }

    if (transaction.type == TRANSACTION_TYPE.BILL) {
      if (transaction.misc.meter_number) {
        await PowerTemplate(data, browser);
      } else {
        await TVTemplate(data, browser);
      }
    }

    if (transaction.type == TRANSACTION_TYPE.TRANSFER) {
      await TransferTemplate(data, browser);
    }

    if (transaction.type == TRANSACTION_TYPE.DEPOSIT) {
      await DepositTemplate(data, browser);
    }
  } catch (error) {
    console.log(error, "at send receipt consumer");
  }
};

export const FinishUploadProfilePhoto = async (msg) => {
  try {
    const receivedMessage = msg;

    const { wa_id, file_name } = receivedMessage;

    const decryptedMedia = Buffer.from(
      receivedMessage.decryptedMedia,
      "base64"
    );

    console.log(decryptedMedia);

    //Get profile_photo
    // const { location: profile_photo } = await compressImageNormal(
    //   decryptedMedia,
    //   file_name
    // );

    //Get avatar
    //const compress_avatar = await compressImageStrict(decryptedMedia);
    // const Body = await makeCircularImage(compress_avatar);
    const Key = `${uuidv4()}.png`;

    const Location = await UploadToAWS({
      Body,
      Key,
      ContentType: "image/png",
    });

    await UserModel.updateOne(
      { mobile: wa_id },
      { $set: { profile_photo, avatar: Location } }
    );
  } catch (error) {
    console.log(error);
  }
};

export const ProcessAccountData = async (msg) => {
  try {
    const { wa_id } = msg;

    const user = await UserModel.findOne({ mobile: wa_id });

    if (user) {
      const sfh_access_token = await Sfh_Token();

      let fetch_account_data = await fetch(
        `${SFH_ENDPOINT}/accounts/${user.sfh_account._id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
        }
      );

      fetch_account_data = await fetch_account_data.json();

      console.log(fetch_account_data);

      let text_to_image = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: `₦${AmountSeparator(
            fetch_account_data?.data?.accountBalance || 0
          )}`,
        }),
      });

      text_to_image = await text_to_image.json();

      let file_key = customId({
        name: "12345",
        email: "6789",
        randomLength: 4,
      });

      await UploadToAWS({
        Body: Buffer.from(text_to_image.buffer, "base64"),
        Key: file_key,
        ContentType: "image/png",
      });

      await redisClient.set(`balance_avatar_${wa_id}`, file_key);
      await redisClient.set(
        `is_verified_${wa_id}`,
        user?.sfh_account?.migration_complete ? "true" : ""
      );
      await redisClient.set(
        `account_number_string_${wa_id}`,
        user?.sfh_account?.account_number
          ? `Safe Haven MFB - ${user?.sfh_account?.account_number}`
          : ""
      );

      await redisClient.set(
        `account_number_copy_${wa_id}`,
        user?.sfh_account?.account_number
          ? `**Safe Haven MFB - [${user?.sfh_account?.account_number}](https://api.whatsapp.com/send?text=Safe%20Haven%20MFB%20${user?.sfh_account?.account_number})**`
          : ""
      );

      await redisClient.set(
        `account_name_${wa_id}`,
        user?.sfh_account?.account_name || ""
      );
    } else {
      await UserModel.insertMany({
        mobile: wa_id,
        last_seen: new Date(),
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const failedMessage = async ({ user, message }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: user.mobile,
      type: "template",
      template: {
        name: "debit_failed_2",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: ` - ${message}`, //failed reason
              },
            ],
          },
        ],
      },
    },
  });
};

const moringafailedMessage = async ({ user, message }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v22.0/${MORINGA_WA_PHONE_NUMBER}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: user.mobile,
      type: "template",
      template: {
        name: "moringa_transaction_failed",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: `${message} `, //failed reason
              },
            ],
          },
        ],
      },
    },
  });
};

const cleanUp = async ({ Pay, user, sfh_access_token, type, transaction }) => {
  try {
    const bill_types = ["airtime", "data", "power", "dstv"];
    let debit_ref = "";
    let commission = 0;
    let fee = 0;

    if (bill_types.includes(type)) {
      let vasTnxs = await fetch(
        `${SFH_ENDPOINT}/vas/transactions?page=0&limit=1000`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
        }
      );

      vasTnxs = await vasTnxs.json();

      const vasTnx = vasTnxs.data.filter(
        (e) => e.internalReference === Pay.data?.reference
      )[0];

      if (vasTnx.debitedAmount < vasTnx.transactionAmount)
        commission = vasTnx.transactionAmount - vasTnx.debitedAmount;
      fee = vasTnx.transactionFee;
      debit_ref = vasTnx.debitPaymentReference;
    } else {
      debit_ref = Pay.data?.sessionId;
    }

    await UserModel.updateOne(
      { _id: user._id },
      {
        $inc: {
          "sfh_account.daily_limit_count": Pay.data.amount,
        },
      }
    );

    await receiptFlow({ Pay, transaction, commission, fee, type, user });

    let statement_data = await fetch(
      `${SFH_ENDPOINT}/accounts/${user.sfh_account._id}/statement?page=0&limit=50&type=Debit`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
      }
    );

    statement_data = await statement_data.json();

    let matched = statement_data.data.filter((e) =>
      e.narration.includes(debit_ref)
    );

    console.log(transaction.misc.paymentReference, "kanta");

    if (type == "transfer") {
      matched = statement_data.data.filter(
        (e) => e.paymentReference == transaction.misc.paymentReference
      );
    }

    console.log(matched, "matched");

    matched.forEach(async (e) => {
      let balanceAfter = e.runningBalance;
      let sfh_amount = e.amount;
      let balanceBefore = balanceAfter + sfh_amount;

      await BalanceHistoryModel.insertMany({
        user: user,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        type: HISTORY_TYPE.DEBIT,
        transaction: transaction._id,
        description:
          type == "transfer"
            ? `Transfer to ${transaction.misc.account_name}`
            : e.narration,
      });
    });

    // if (type == "transfer") {
    //   //Reimburse
    //   let get_transfers = await fetch(
    //     `${SFH_ENDPOINT}/transfers?accountId=${user.sfh_account._id}&page=0&limit=25&type=Outwards`,
    //     {
    //       method: "GET",
    //       headers: {
    //         Authorization: `Bearer ${sfh_access_token}`,
    //         "Content-Type": "application/json",
    //         ClientID: SFH_CLIENT_ID,
    //       },
    //     }
    //   );

    //   get_transfers = await get_transfers.json();
    //   get_transfers = get_transfers.data;

    //   const single_transfer = get_transfers.filter(
    //     (e) => e.sessionId == debit_ref
    //   )[0];
    //   let total_fees = 0;
    //   total_fees =
    //     single_transfer.fees + single_transfer.vat + single_transfer.stampDuty;

    //   if (total_fees > 0) {
    //     let resolve = await fetch(`${SFH_ENDPOINT}/transfers/name-enquiry`, {
    //       method: "POST",
    //       headers: {
    //         Authorization: `Bearer ${sfh_access_token}`,
    //         "Content-Type": "application/json",
    //         ClientID: SFH_CLIENT_ID,
    //       },
    //       body: JSON.stringify({
    //         accountNumber: Pay.data.debitAccountNumber,
    //         bankCode: "090286",
    //       }),
    //     });

    //     resolve = await resolve.json();

    //     let reimburse = await fetch(`${SFH_ENDPOINT}/transfers`, {
    //       method: "POST",
    //       headers: {
    //         Authorization: `Bearer ${sfh_access_token}`,
    //         "Content-Type": "application/json",
    //         ClientID: SFH_CLIENT_ID,
    //       },
    //       body: JSON.stringify({
    //         debitAccountNumber: SAFE_HAVEN_MAIN_ACC,
    //         amount: total_fees,
    //         nameEnquiryReference: resolve.data.sessionId,
    //         beneficiaryBankCode: resolve.data.bankCode,
    //         beneficiaryAccountNumber: resolve.data.accountNumber,
    //         saveBeneficiary: true,
    //       }),
    //     });

    //     console.log("Reimburse Done Outwards", reimburse);
    //   }
    // }

    // fetch(``, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({ wa_id: user.mobile }),
    // });

    await sendToQueue(
      JSON.stringify({
        intent: accountDataQueue,
        payload: { wa_id: user.mobile },
      })
    );
  } catch (error) {
    console.log(error, "at clean up");
  }
};

const receiptFlow = async ({
  transaction,
  Pay,
  commission,
  fee,
  type,
  user,
}) => {
  try {
    // let flowBody;
    // let flowFooter;
    let text_to_image = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `₦${transaction.amount}`,
        receipt: true,
      }),
    });

    text_to_image = await text_to_image.json();

    let banner = await UploadToAWS({
      Body: Buffer.from(text_to_image.buffer, "base64"),
      Key: `${new Date().getTime()}`,
      ContentType: "image/png",
    });

    let flowData = {
      title: "Receipt",
      reference: Pay.data?.sessionId || transaction.payment_ref,
      field1_key: "Type",
      field1_value: type.toUpperCase(),
      field2_key: "Reference or Session ID",
      field2_value: Pay.data?.sessionId || transaction.payment_ref,
      field3_key: "Amount",
      field3_value: `NGN ${AmountSeparator(transaction.amount)}`,
    };

    if (type == "airtime") {
      flowData = {
        ...flowData,
        field4_key: "Network",
        field4_value: transaction.misc.network.toUpperCase(),
        field5_key: "Phone number",
        field5_value: transaction.misc.phone_number,
        field6_key: "Service",
        field6_value: transaction.misc.service,
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value:
          Pay?.data?.status == "successful" ? "Completed" : "Pending",
      };
      // flowBody = `*Airtime to ${transaction.misc.phone_number}*`;
      // flowFooter = `*Debit*`;
    }

    if (type == "data") {
      flowData = {
        ...flowData,
        field4_key: "Network",
        field4_value: transaction.misc.network,
        field5_key: "Phone number",
        field5_value: transaction.misc.phone_number,
        field6_key: "Bundle",
        field6_value: transaction.misc.bundle_code,
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value:
          Pay?.data?.status == "successful" ? "Completed" : "Pending",
      };
      // flowBody = `*${transaction.misc.bundle_code.substring(0, 100)} to ${
      //   transaction.misc.phone_number
      // }*`;
      // flowFooter = `*Debit*`;
    }

    if (type == "dstv") {
      flowData = {
        ...flowData,
        field4_key: "Card name",
        field4_value: transaction.misc.card_name,
        field5_key: "Card number",
        field5_value: transaction.misc.card_number,
        field6_key: "Package",
        field6_value: transaction.misc.bundle_code,
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value:
          Pay?.data?.status == "successful" ? "Completed" : "Pending",
      };
      // flowBody = `*${transaction.misc.bundle_code.substring(
      //   0,
      //   100
      // )} to ${transaction.misc.card_name.substring(0, 100)}*`;
      // flowFooter = `*Debit*`;
    }

    if (type == "power") {
      await TransactionModel.updateOne(
        { _id: transaction._id },
        {
          $set: {
            "misc.meter_token": Pay.data.utilityToken,
          },
        }
      );

      flowData = {
        ...flowData,
        field1_key: "Type",
        field1_value: `${transaction.misc?.disco || ""} ${
          transaction.misc?.vend_type || ""
        }`,
        field4_key: "Meter number",
        field4_value: transaction.misc.meter_number,
        field5_key: "Meter name",
        field5_value: transaction.misc.meter_name,
        field6_key: "Token",
        field6_value: Pay?.data?.utilityToken || "N/A",
        field7_key: "Fee",
        field7_value: `NGN ${AmountSeparator(fee)}`,
        field8_key: "Commission",
        field8_value: `NGN ${AmountSeparator(commission)}`,
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),
        field10_key: "Status",
        field10_value:
          Pay?.data?.status == "successful" ? "Completed" : "Pending",
      };
      // flowBody = `*Your Meter token is here 🎉`;
      // flowFooter = `*${Pay?.data?.utilityToken || "-"}*`;
    }

    if (type == "transfer") {
      let bank_name = BANK_LIST.filter(
        (e) => e.bankCode == transaction.misc.bank_code
      )[0].name;

      await TransactionModel.updateOne(
        { _id: transaction._id },
        { $set: { payment_ref: Pay.data.sessionId } }
      );

      flowData = {
        ...flowData,
        field4_key: "Sender name",
        field4_value: user.sfh_account.account_name,
        field5_key: "Sender account",
        field5_value: maskString(user.sfh_account.account_number),
        field6_key: "Beneficiary name",
        field6_value: transaction.misc.account_name,
        field7_key: "Beneficiary bank",
        field7_value: bank_name || "SFH",
        field8_key: "Beneficiary account",
        field8_value: maskString(transaction.misc.account_number),
        field9_key: "Transaction Date",
        field9_value: dayjs(transaction.createdAt)
          .add(1, "hour")
          .format("ddd, MMM DD, YYYY. h:mm a"),

        field10_key: "Status",
        field10_value: "Completed",
      };
      // flowBody = `*Transfer to ${transaction.misc.account_name}*`;
      // flowFooter = `*Debit*`;
    }

    const view_receipt_flow_token = uuidv4();

    await redisClient.set(
      `view_receipt_flow_token_${view_receipt_flow_token}`,
      user.mobile
    );

    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: user.mobile,
        type: "template",
        template: {
          name: "debit_success_1",
          language: {
            code: "en",
          },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "image",
                  image: {
                    link: banner,
                  },
                },
              ],
            },
            {
              type: "button",
              sub_type: "flow",
              index: "0",
              parameters: [
                {
                  type: "action",
                  action: {
                    flow_token: view_receipt_flow_token,
                    flow_action_data: {
                      ...flowData,
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    });
  } catch (error) {
    console.log(error, "receipt flow");
  }
};

export const MoringaFinishTransaction = async (msg) => {
  try {
    const { user, metadata } = msg;

    const { account_number, bank_code, type } = metadata;

    let amount = parseFloat(metadata.amount);

    const eversend_access_token = await Eversend_Token();

    let payment_ref = customId({
      name: user._id.toString(),
      email: eversend_access_token,
      randomLength: 2,
    });

    if (type.toUpperCase() == "SWAP") {
      let balance_before =
        bank_code.toUpperCase == "USDT"
          ? user.wallet.usdt.balance
          : user.wallet.usdc.balance;

      let balance_after = balance_before - amount;

      let quotation = await fetch(`${EVERSEND_ENDPOINT}/exchanges/quotation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${eversend_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: bank_code.toUpperCase(),
          amount,
          to: "NGN",
        }),
      });

      quotation = await quotation?.json();

      if (quotation?.code == 200 && quotation?.data?.token) {
        let exchange = await fetch(`${EVERSEND_ENDPOINT}/exchanges/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${eversend_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: quotation.data.token,
          }),
        });

        exchange = await exchange?.json();

        if (exchange?.success) {
          if (bank_code.toUpperCase() == "USDT") {
            await MoringaUserModel.updateOne(
              { _id: user._id },
              {
                $inc: {
                  "wallet.usdt.balance": -amount,
                  "wallet.ngn.balance": quotation.data.quotation.destAmount,
                },
              }
            );

            await MoringaTransactionModel.insertMany({
              payment_ref,
              balance_before,
              balance_after,
              misc: exchange?.data || {},
              amount,
              type: "SWAP",
              wallet: "NGN",
            });

            await MoringaTransactionModel.insertMany({
              payment_ref: `${payment_ref}/SOURCE`,
              balance_before: user.wallet?.usdt?.balance,
              balance_after: user.wallet?.usdt?.balance - amount,
              misc: exchange?.data || {},
              amount,
              type: "SWAP",
              wallet: "USDT",
            });
          }

          if (bank_code.toUpperCase() == "USDC") {
            await MoringaUserModel.updateOne(
              { _id: user._id },
              {
                $inc: {
                  "wallet.usdc.balance": -amount,
                  "wallet.ngn.balance": quotation.data.quotation.destAmount,
                },
              }
            );

            await MoringaTransactionModel.insertMany({
              payment_ref,
              balance_before,
              balance_after,
              misc: exchange?.data || {},
              amount,
              type: "SWAP",
              wallet: "NGN",
            });

            await MoringaTransactionModel.insertMany({
              payment_ref: `${payment_ref}/SOURCE`,
              balance_before: user.wallet?.usdc?.balance,
              balance_after: user.wallet?.usdc?.balance - amount,
              misc: exchange?.data || {},
              amount,
              type: "SWAP",
              wallet: "USDC",
            });
          }
        } else {
          //Message - Swap Failed
          moringafailedMessage({ user, message: `Swap to NGN` });
        }
      } else {
        //Message - Swap Failed
        moringafailedMessage({ user, message: `Swap to NGN` });
      }
    }

    if (type.toUpperCase() == "TRANSFER") {
      let balance_before = user.wallet.ngn.balance;
      let balance_after = balance_before - amount;

      let bankDetails = await fetch(
        `${EVERSEND_ENDPOINT}/beneficiaries/accounts/banks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${eversend_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            countryCode: "NG",
            bankCode: bank_code,
            accountNumber: account_number,
          }),
        }
      );

      bankDetails = await bankDetails?.json();

      console.log(bankDetails);

      if (bankDetails?.code == 200) {
        let quotation = await fetch(`${EVERSEND_ENDPOINT}/payouts/quotation`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${eversend_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceWallet: "NGN",
            amount,
            type: "bank",
            destinationCountry: "NG",
            destinationCurrency: "NGN",
            amountType: "SOURCE",
          }),
        });

        quotation = await quotation?.json();

        console.log(quotation, "qt");

        if (quotation?.code == 200 && quotation?.data?.token) {
          //Check balance
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });
          if (userUpdt.wallet.ngn.balance < amount) {
            await moringafailedMessage({
              user,
              message: `Transfer to ${bankDetails?.data?.account_name}`,
            });
          }

          await MoringaUserModel.updateOne(
            { _id: user._id },
            {
              $inc: {
                "wallet.ngn.balance": -amount,
              },
            }
          );

          let payout = await fetch(`${EVERSEND_ENDPOINT}/payouts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: quotation.data.token,
              firstName: "MORINGA",
              phoneNumber: user.mobile,
              lastName: "PAY",
              bankName: BANK_LIST.filter((e) => e.bankCode == bank_code)[0]
                .name,
              country: "NG",
              bankAccountName: bankDetails.data.account_name,
              bankAccountNumber: account_number,
              bankCode: bank_code,
              transactionRef: payment_ref,
            }),
          });

          payout = await payout?.json();

          console.log(payout, "payout");

          if (payout?.code == 200) {
            //Send to Queue
            // fetch(``, {
            //   method: "POST",
            //   headers: {
            //     "Content-Type": "application/json",
            //   },
            //   body: JSON.stringify({ wa_id: user.mobile }),
            // });

            await sendToQueue(
              JSON.stringify({
                intent: accountDataQueue,
                payload: { wa_id: user.mobile },
              })
            );

            //Record Transaction
            await MoringaTransactionModel.insertMany({
              status: TRANSACTION_STATUS.SUCCESS,
              payment_ref,
              balance_before,
              balance_after,
              misc: payout.data,
              amount,
              type: "TRANSFER",
              wallet: "NGN",
            });
          } else {
            //Refund
            await MoringaUserModel.updateOne(
              { _id: user._id },
              {
                $inc: {
                  "wallet.ngn.balance": amount,
                },
              }
            );

            await MoringaTransactionModel.insertMany({
              payment_ref,
              balance_before,
              balance_after,
              misc: payout.data,
              amount,
              type: "TRANSFER",
              wallet: "NGN",
            });

            await moringafailedMessage({
              user,
              message: `Transfer to ${bankDetails?.data?.account_name}`,
            });
          }
        } else {
          await moringafailedMessage({
            user,
            message: `Transfer to ${bankDetails?.data?.account_name}`,
          });
        }
      } else {
        await moringafailedMessage({
          user,
          message: `Transfer`,
        });
      }
    }
  } catch (error) {
    console.log(error, "error at Moringa Finish Transaction");
  }
};

export const MoringaAccountData = async (msg) => {
  try {
    const { wa_id } = msg;

    const user = await MoringaUserModel.findOne({ mobile: wa_id });

    if (user) {
      const eversend_access_token = await Eversend_Token();

      let usdt_quotation = await fetch(
        `${EVERSEND_ENDPOINT}/exchanges/quotation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${eversend_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "USDT",
            amount: user.wallet.usdt.balance,
            to: "USD",
          }),
        }
      );

      usdt_quotation = await usdt_quotation?.json();

      let usdc_quotation = await fetch(
        `${EVERSEND_ENDPOINT}/exchanges/quotation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${eversend_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "USDC",
            amount: user.wallet.usdc.balance,
            to: "USD",
          }),
        }
      );

      usdc_quotation = await usdc_quotation?.json();

      let ngn_quotation = await fetch(
        `${EVERSEND_ENDPOINT}/exchanges/quotation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${eversend_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "NGN",
            amount: user.wallet.ngn.balance,
            to: "USD",
          }),
        }
      );

      ngn_quotation = await ngn_quotation?.json();

      let usd_balance_quotation = 0;
      usd_balance_quotation =
        (usdt_quotation?.data?.quotation?.destAmount || 0) +
        (usdc_quotation?.data?.quotation?.destAmount || 0) +
        (ngn_quotation?.data?.quotation?.destAmount || 0);

      await redisClient.set(
        `moringa_is_verified_${wa_id}`,
        user?.kyc?.nin?.is_verified ? "true" : ""
      );

      await redisClient.set(
        `moringa_usdt_${wa_id}`,
        `${AmountSeparator(user.wallet.usdt.balance) || "0.00000"} USDT`
      );

      await redisClient.set(
        `moringa_usdt_usd_${wa_id}`,
        `$${
          usdt_quotation?.data?.quotation?.destAmount
            ? AmountSeparator(usdt_quotation?.data?.quotation?.destAmount)
            : "0.00"
        }`
      );

      await redisClient.set(
        `moringa_usdc_${wa_id}`,
        `${AmountSeparator(user.wallet.usdc.balance) || "0.00000"} USDC`
      );

      await redisClient.set(
        `moringa_usdc_usd_${wa_id}`,
        `$${
          usdc_quotation?.data?.quotation?.destAmount
            ? AmountSeparator(usdc_quotation?.data?.quotation?.destAmount)
            : "0.00"
        }`
      );

      await redisClient.set(
        `moringa_ngn_${wa_id}`,
        `₦${AmountSeparator(user.wallet.ngn.balance)}`
      );

      await redisClient.set(
        `moringa_ngn_usd_${wa_id}`,
        `$${
          ngn_quotation?.data?.quotation?.destAmount
            ? AmountSeparator(ngn_quotation?.data?.quotation?.destAmount)
            : "0.00"
        }`
      );

      let text_to_image_usd_balance = await fetch(
        `${CANVAS_SERVICE_URL}/text-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            color: "#9732FD",
            text: `$${AmountSeparator(usd_balance_quotation) || "0.00"}`,
          }),
        }
      );

      text_to_image_usd_balance = await text_to_image_usd_balance?.json();

      let text_to_image_usdt = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          color: "#9732FD",
          text: `${
            AmountSeparator(user?.wallet?.usdt?.balance) || "0.00000"
          } USDT`,
        }),
      });

      text_to_image_usdt = await text_to_image_usdt?.json();

      let text_to_image_usdc = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          color: "#9732FD",
          text: `${
            AmountSeparator(user?.wallet?.usdc?.balance) || "0.00000"
          } USDC`,
        }),
      });

      text_to_image_usdc = await text_to_image_usdc?.json();

      let text_to_image_ngn = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          color: "#9732FD",
          text: `₦${AmountSeparator(user?.wallet?.ngn?.balance) || "0.00"}`,
        }),
      });

      text_to_image_ngn = await text_to_image_ngn?.json();

      let usd_balance_file_key = customId({
        name: "12345",
        email: "6789",
        randomLength: 4,
      });
      let usdt_file_key = customId({
        name: "12345",
        email: "6789",
        randomLength: 4,
      });
      let usdc_file_key = customId({
        name: "12345",
        email: "6789",
        randomLength: 4,
      });
      let ngn_file_key = customId({
        name: "12345",
        email: "6789",
        randomLength: 4,
      });

      await UploadToAWS({
        Body: Buffer.from(text_to_image_usd_balance.buffer, "base64"),
        Key: usd_balance_file_key,
        ContentType: "image/png",
      });
      await UploadToAWS({
        Body: Buffer.from(text_to_image_usdt.buffer, "base64"),
        Key: usdt_file_key,
        ContentType: "image/png",
      });
      await UploadToAWS({
        Body: Buffer.from(text_to_image_usdc.buffer, "base64"),
        Key: usdc_file_key,
        ContentType: "image/png",
      });
      await UploadToAWS({
        Body: Buffer.from(text_to_image_ngn.buffer, "base64"),
        Key: ngn_file_key,
        ContentType: "image/png",
      });

      await redisClient.set(
        `moringa_balance_usd_${wa_id}`,
        usd_balance_file_key
      );
      await redisClient.set(`moringa_balance_usdt_${wa_id}`, usdt_file_key);
      await redisClient.set(`moringa_balance_usdc_${wa_id}`, usdc_file_key);
      await redisClient.set(`moringa_balance_ngn_${wa_id}`, ngn_file_key);

      //Create addresses
      if (user?.kyc?.nin?.is_verified) {
        /** USDT **/
        //BNC_USDT
        let create_address_bnc_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDT_BSC",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_bnc_usdt = await create_address_bnc_usdt?.json();
        if (create_address_bnc_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.binance)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.binance":
                    create_address_bnc_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_bnc_usdt?.data?.address?.address,
                },
              }
            );
        }

        //POL_USDT
        let create_address_pol_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDT_POLYGON",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_pol_usdt = await create_address_pol_usdt?.json();
        if (create_address_pol_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.polygon)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.polygon":
                    create_address_pol_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_pol_usdt?.data?.address?.address,
                },
              }
            );
        }

        //ETH_USDT
        let create_address_eth_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDT_ERC20",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_eth_usdt = await create_address_eth_usdt?.json();
        if (create_address_eth_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.ethereum)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.ethereum":
                    create_address_eth_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_eth_usdt?.data?.address?.address,
                },
              }
            );
        }

        //TRON_USDT
        let create_address_tron_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "TRX_USDT_S2UZ",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_tron_usdt = await create_address_tron_usdt?.json();
        if (create_address_tron_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.tron)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.tron":
                    create_address_tron_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_tron_usdt?.data?.address?.address,
                },
              }
            );
        }

        //SOL_USDT
        let create_address_sol_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "SOL_USDT_EWAY",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_sol_usdt = await create_address_sol_usdt?.json();
        if (create_address_sol_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.solana)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.solana":
                    create_address_sol_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_sol_usdt?.data?.address?.address,
                },
              }
            );
        }

        //OPT_USDT
        let create_address_opt_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDT",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_opt_usdt = await create_address_opt_usdt?.json();
        if (create_address_opt_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.optimism)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.optimism":
                    create_address_opt_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_opt_usdt?.data?.address?.address,
                },
              }
            );
        }

        //ARB_USDT
        let create_address_arb_usdt = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDT_ARB",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_arb_usdt = await create_address_arb_usdt?.json();
        if (create_address_arb_usdt?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdt?.address?.arbitrum)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdt.address.arbitrum":
                    create_address_arb_usdt?.data?.address?.address,
                },
                $push: {
                  address: create_address_arb_usdt?.data?.address?.address,
                },
              }
            );
        }

        /**      USDC WALLETS     **/

        //BNC_USDC
        let create_address_bnc_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDC_BSC",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_bnc_usdc = await create_address_bnc_usdc?.json();
        if (create_address_bnc_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.binance)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.binance":
                    create_address_bnc_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_bnc_usdc?.data?.address?.address,
                },
              }
            );
        }

        //POL_USDC
        let create_address_pol_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDC_POLYGON",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_pol_usdc = await create_address_pol_usdc?.json();
        if (create_address_pol_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.polygon)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.polygon":
                    create_address_pol_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_pol_usdc?.data?.address?.address,
                },
              }
            );
        }

        //ETH_USDC
        let create_address_eth_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDC",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_eth_usdc = await create_address_eth_usdc?.json();
        if (create_address_eth_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.ethereum)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.ethereum":
                    create_address_eth_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_eth_usdc?.data?.address?.address,
                },
              }
            );
        }

        //STEL_USDC
        let create_address_stel_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "XLM_USDC_5F3T",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_stel_usdc = await create_address_stel_usdc?.json();
        if (create_address_stel_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.stellar)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.stellar":
                    create_address_stel_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_stel_usdc?.data?.address?.address,
                },
              }
            );
        }

        //BASE_USDC
        let create_address_base_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDC_BASECHAIN_ETH_5I5C",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_base_usdc = await create_address_base_usdc?.json();
        if (create_address_base_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.base)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.base":
                    create_address_base_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_base_usdc?.data?.address?.address,
                },
              }
            );
        }

        //Solana USDC
        let create_address_sol_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "SOL_USDC_PTHX",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_sol_usdc = await create_address_sol_usdc?.json();
        if (create_address_sol_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.solana)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.solana":
                    create_address_sol_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_sol_usdc?.data?.address?.address,
                },
              }
            );
        }

        //Optimism USDC
        let create_address_opt_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDC_OPT_9T08",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_opt_usdc = await create_address_opt_usdc?.json();
        if (create_address_opt_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.optimism)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.optimism":
                    create_address_opt_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_opt_usdc?.data?.address?.address,
                },
              }
            );
        }

        //ARB_USDC
        let create_address_arb_usdc = await fetch(
          `${EVERSEND_ENDPOINT}/crypto/addresses`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: "USDC_ARB_3SBJ",
              purpose: "Moringa Collection",
              ownerName: user.kyc.email.value,
              destinationAddressDescription: uuidv4(),
            }),
          }
        );

        create_address_arb_usdc = await create_address_arb_usdc?.json();

        if (create_address_arb_usdc?.data?.address?.address) {
          const userUpdt = await MoringaUserModel.findOne({ _id: user._id });

          if (!userUpdt?.wallet?.usdc?.address?.arbitrum)
            await MoringaUserModel.updateOne(
              { mobile: wa_id },
              {
                $set: {
                  "wallet.usdc.address.arbitrum":
                    create_address_arb_usdc?.data?.address?.address,
                },
                $push: {
                  address: create_address_arb_usdc?.data?.address?.address,
                },
              }
            );
        }
      }
    } else {
      await MoringaUserModel.insertMany({
        mobile: wa_id,
        last_seen: new Date(),
      });
    }
  } catch (error) {
    console.log(error);
  }
};

export const FigoAccountData = async (msg, browser) => {
  try {
    const { wa_id, display_name, staff } = msg;

    let user = await FigoUserModel.findOne({ mobile: wa_id });

    const user_id = new mongoose.Types.ObjectId();

    let figo_active_account = await redisClient.get(
      `figo_active_account_${wa_id}`
    );

    if (!mongoose.Types.ObjectId.isValid(figo_active_account)) {
      console.log("Setting Figo active account");
      await redisClient.set(
        `figo_active_account_${wa_id}`,
        `${user?._id || user_id}`
      );
    }

    //Create New User
    if (!user) {
      await FigoUserModel.insertMany({
        _id: user_id,
        mobile: wa_id,
        last_seen: new Date(),
        business: [user_id],
      });

      //4 Day Free trial
      const endDate = dayjs().add(4, "day").hour(19).startOf("hour");

      await FigoBusinessModel.insertMany({
        _id: user_id,
        user: user_id,
        subscription: [
          {
            user: user_id,
            start_date: new Date(),
            end_date: endDate,
            is_active: true,
          },
        ],
      });

      if (staff?.account_id) {
        await FigoBusinessModel.updateOne(
          {
            _id: staff.account_id,
          },
          {
            $addToSet: {
              staff: {
                _id: user_id,
                name: staff.name,
              },
            },
          }
        );

        //Ingest Staff Contact
        await fetch(`${RAG_API_URL}/trigger/contact_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: staff.account_id,
            role: "Staff",
            customerId: user_id,
          }),
        });
      }

      await fetch(`${RAG_API_URL}/trigger/business_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: user_id,
        }),
      });

      //Send Sub Termination
      scheduleReminder({
        when: getScheduleExpression(endDate, "cron"),
        detail: {
          user: user_id,
          end: true,
          business: user_id,
        },
        rule: `se-${user_id.toString()}-${user_id.toString()}`,
        eventType: "subscription-reminder",
      });
    }

    //Finally

    //Your Own business
    user = user || {
      _id: user_id,
      mobile: wa_id,
      last_seen: new Date(),
      business: [user_id],
    };

    const my_biz = await FigoBusinessModel.findOne({ _id: user._id }).populate(
      "user"
    );
    await redisClient.set(`figo_staff_${wa_id}_${my_biz?._id}`, "true");
    await redisClient.set(
      `figo_account_name_1_${wa_id}`,
      my_biz?.name || my_biz?.user?.mobile || ""
    );
    await redisClient.set(`figo_account_id_1_${wa_id}`, `${my_biz?._id}` || "");

    //Other businesses that you're a part of
    const all_biz = await FigoBusinessModel.find({
      "staff._id": user._id,
    }).populate("user");

    all_biz.forEach(async (biz) => {
      await redisClient.set(`figo_staff_${wa_id}_${biz._id}`, "true");
      await redisClient.set(
        `figo_account_name_2_${wa_id}`,
        biz?.name || biz?.user?.mobile || ""
      );
      await redisClient.set(`figo_account_id_2_${wa_id}`, `${biz?._id}` || "");
    });

    //Update display name if not exist not user already created
    if (user?.createdAt) {
      if (!user?.name && display_name) {
        user.name = display_name || "";
      }
      user.last_seen = new Date();
      await user.save();
    }

    await FigoStatUpdate({ browser, wa_id });
  } catch (error) {
    console.log(error);
  }
};

export const FigoAddItem = async (msg, browser) => {
  try {
    const {
      wa_id,
      item_name,
      description,
      price,
      stock_level,
      unit,
      is_product,
      supplier,
      expiry_date,
      images,
      _id,
      cost_price,
    } = msg;
    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);
    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;
    let image_key_1 = `${new Date().getTime()}`;

    const business = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!business) return;

    const staff = (business.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    if (!!images?.length) {
      let image = images[0];

      const decryptedMedia = await processEncryptedMedia({
        encryptionKey: image.encryption_metadata.encryption_key,
        hmacKey: image.encryption_metadata.hmac_key,
        iv: image.encryption_metadata.iv,
        expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
        expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
        imageUrl: image.cdn_url,
        fileName: image.file_name,
      });
      //Upload to aws and update database
      await UploadToAWS({
        Body: decryptedMedia,
        Key: image_key_1, //`${uuidv4()}.png`,
        ContentType: "application/octet-stream",
      });
    }

    let item_id = _id || new mongoose.Types.ObjectId();

    let payload = {
      _id: item_id,
      name: item_name,
      description,
      price: parseFloat(price),
      cost_price: parseFloat(cost_price || price),
      level: parseFloat(stock_level || 1),
      editor: user._id,
      business: business._id,
      unit: unit,
      supplier,
      type: is_product ? FIGO_ITEM_TYPES.PRODUCT : FIGO_ITEM_TYPES.SERVICE,
      expiry_date,
      image: !!images?.length ? image_key_1 : "",
    };

    if (!payload.expiry_date) {
      delete payload.expiry_date;
    }

    if (!payload.supplier) {
      delete payload.supplier;
    }

    await FigoStockModel.insertOne(payload);

    //Finally
    await Promise.all([
      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.stock,
        entry_id: payload._id,
        business: business._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.add_product,
      }),

      fetch(`${RAG_API_URL}/trigger/product_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: business._id,
          productId: item_id,
        }),
      }),
    ]);

    if (expiry_date) {
      const date = dayjs(expiry_date);
      const threeDaysBeforeAt10am = date
        .subtract(3, "day")
        .hour(9) // 10 AM WAT is 9 AM GMT+0
        .startOf("hour");

      await scheduleReminder({
        when: getScheduleExpression(threeDaysBeforeAt10am, "cron"),
        detail: { wa_id, product_name: item_name },
        rule: `expiry-alert-${item_id}`,
        eventType: "expiry-alert",
      });
    }
  } catch (error) {
    console.log(error);
  }
};
export const FigoAddCustomer = async (msg, browser) => {
  try {
    const { wa_id, customer_phone, customer_name, _id } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    await FigoCustomerModel.insertMany({
      _id,
      name: customer_name,
      mobile: customer_phone,
      editor: user._id,
      business: editor._id,
    });

    await Promise.all([
      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.customer,
        entry_id: _id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.add_customer,
      }),

      fetch(`${RAG_API_URL}/trigger/contact_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          role: "Customer",
          customerId: customer_phone,
        }),
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoAddSupplier = async (msg, browser) => {
  try {
    const { wa_id, supplier_name, supplier_phone, _id } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    await FigoSupplierModel.insertMany({
      _id,
      name: supplier_name,
      mobile: supplier_phone,
      editor: user._id,
      business: editor._id,
    });

    await Promise.all([
      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.supplier,
        entry_id: _id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.add_supplier,
      }),

      fetch(`${RAG_API_URL}/trigger/contact_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          role: "Supplier",
          customerId: supplier_phone,
        }),
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoAddSale = async (msg, browser) => {
  try {
    const {
      wa_id,
      date,
      customer,
      items,
      amount: amountStr,
      payment_method,
      payment_status,
      fees,
    } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let sale_id = new mongoose.Types.ObjectId();

    let newItems = items.map((e) => {
      const quantity = parseInt(e.description.split("x ₦")[0]);
      const price = parseFloat(e.description.split("x ₦")[1].replace(/,/g, ""));
      return {
        _id: e.id,
        quantity: quantity,
        price: price,
      };
    });

    let totalCost = newItems.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );

    totalCost = totalCost + parseFloat(fees || 0);

    let amount = 0;
    let due_amount = totalCost;

    if (payment_status == "paid") {
      amount = totalCost;
      due_amount = totalCost - amount;
    } else {
      if (payment_status == "partially_paid") {
        amount = parseFloat(amountStr);
        due_amount = totalCost - amount;
      }
    }

    if (["partially_paid", "paid"].includes(payment_status)) {
      await FigoPaymentModel.insertMany({
        sale: sale_id,
        date: new Date(date),
        payment_method: FIGO_PAYMENT_METHOD[payment_method[0]],
        amount: amount,
        editor: user._id,
        business: editor._id,
      });
    }

    let payload = {
      _id: sale_id,
      date: new Date(date),
      due_amount: fromNairaToKobo(due_amount),
      item: newItems,
      customer: customer,
      payment_status: payment_status,
      editor: user._id,
      business: editor._id,
      fees: parseFloat(fees || 0),
    };

    if (!customer) {
      delete payload.customer;
    }

    await FigoSaleModel.insertMany(payload);

    for (const item of newItems) {
      const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
        {
          _id: item._id,
        },
        {
          $inc: {
            level: -item.quantity,
          },
        },
        { returnDocument: "after" } //or "before"
      );

      console.log(afterStockUpdate, "afterStockUpdate");

      if (afterStockUpdate?.level <= 5) {
        //Send Retsock Reminder
        const twoMinsLater = dayjs().add(2, "minute");

        scheduleReminder({
          when: getScheduleExpression(twoMinsLater, "cron"),
          detail: {
            wa_id,
            product_name: afterStockUpdate.name,
            stock_level: afterStockUpdate.level,
          },
          rule: `restock-alert-${item._id}`,
          eventType: "restock-alert",
        });
      }
    }

    await FigoFIFO({ amount, business: editor._id, type: "in" });
    await FigoStatUpdate({ browser, wa_id });

    await Promise.all([
      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.sale,
        entry_id: sale_id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.add_sale,
      }),

      fetch(`${RAG_API_URL}/trigger/sales_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          saleId: sale_id,
        }),
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoModifySale = async (msg, browser) => {
  try {
    const { wa_id, date, customer, items, sale_id, init_payments, fees } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let newItems = items.map((e) => {
      // const quantity = parseInt(e.description.split("x ₦")[0]);
      // const price = parseFloat(e.description.split("x ₦")[1].replace(/,/g, ""));
      let [qtyStr, priceStr] = e.description.split("x ₦") || [];
      const quantity = parseInt(qtyStr?.trim() || "0");
      const price = parseFloat((priceStr || "").replace(/,/g, "").trim());

      return {
        _id: e.id,
        quantity: quantity,
        price: price,
      };
    });

    let totalCost = newItems.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );

    totalCost = totalCost + parseFloat(fees || 0);

    let totalPayment = 0;
    let totalToReturn = 0;

    const find_sale = await FigoSaleModel.findOne({
      _id: sale_id,
    }).populate("business customer item._id");

    const findAllPayments = await FigoPaymentModel.find({
      sale: sale_id,
      business: account_id,
    });

    if (!!findAllPayments.length) {
      //Remove all payments deleted from business cashflow
      let paymentsToRemove = (findAllPayments || []).filter(
        (e) => !(init_payments || []).includes(e?._id?.toString())
      );

      if (!!paymentsToRemove?.length) {
        //Delete removed payments
        await FigoPaymentModel.deleteMany({
          _id: { $in: paymentsToRemove.map((p) => p._id) },
          //  _id: { $in: paymentsToRemove },
          sale: sale_id,
        });

        totalToReturn = paymentsToRemove.reduce(
          (acc, item) => acc + item.amount,
          0
        );

        const totalToReturnInKobo = fromNairaToKobo(`${totalToReturn}`);
        let cashflow_id = new mongoose.Types.ObjectId();

        //Return balance to Money In
        const beforeBusinessUpdate = await FigoBusinessModel.findOneAndUpdate(
          { _id: account_id },
          {
            $inc: {
              money_in: -totalToReturnInKobo,
            },
          },
          { returnDocument: "before" } //or "before"
        );

        //Cashflow
        await FigoCashFlowModel.insertOne({
          _id: cashflow_id,
          business: account_id,
          amount: totalToReturnInKobo,
          balance_before: beforeBusinessUpdate.money_in,
          balance_after: beforeBusinessUpdate.money_in - totalToReturnInKobo,
          type: "Credit",
        });

        //Ingest
        await fetch(`${RAG_API_URL}/trigger/cashflow_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: account_id,
            cashFlowId: cashflow_id,
          }),
        });
      }
    }

    //Find new payments total
    const findPayments = await FigoPaymentModel.find({ sale: sale_id });
    totalPayment = findPayments.reduce((acc, item) => acc + item.amount, 0);

    const due_amount = totalCost - totalPayment;

    const payment_status =
      due_amount <= 0
        ? FIGO_PAYMENT_STATUS.paid
        : totalPayment > 0
        ? FIGO_PAYMENT_STATUS.partially_paid
        : FIGO_PAYMENT_STATUS.unpaid;

    //Restock Old Items
    for (const item of find_sale.item) {
      await FigoStockModel.updateOne(
        {
          _id: item._id._id,
        },
        {
          $inc: {
            level: item.quantity,
          },
        }
      );
    }

    let sale_payload = {
      date: new Date(date),
      due_amount: fromNairaToKobo(due_amount),
      item: newItems,
      customer: customer,
      payment_status,
      editor: user._id,
      business: editor._id,
      fees: parseFloat(fees || 0),
    };

    if (!customer) {
      delete sale_payload.customer;
    }

    await FigoSaleModel.updateOne(
      {
        _id: sale_id,
      },
      {
        $set: {
          ...sale_payload,
        },
      }
    );

    //Update new stock level
    for (const item of newItems) {
      const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
        {
          _id: item._id,
        },
        {
          $inc: {
            level: -item.quantity,
          },
        },
        { returnDocument: "after" } //or "before"
      );

      if (afterStockUpdate?.level <= 5) {
        //Send Retsock Reminder
        const twoMinsLater = dayjs().add(2, "minute");

        scheduleReminder({
          when: getScheduleExpression(twoMinsLater, "cron"),
          detail: {
            wa_id,
            product_name: afterStockUpdate.name,
            stock_level: afterStockUpdate.level,
          },
          rule: `restock-alert-${item._id}-${sale_id}`,
          eventType: "restock-alert",
        });
      }
    }

    await Promise.all([
      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.sale,
        entry_id: sale_id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.edit_sale,
      }),

      fetch(`${RAG_API_URL}/trigger/sales_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          saleId: sale_id,
        }),
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoAddExpense = async (msg, browser) => {
  try {
    const { wa_id, date, description, amount: amountStr } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let expense_id = new mongoose.Types.ObjectId();
    let amount = parseFloat(amountStr);

    await FigoExpenseModel.insertMany({
      _id: expense_id,
      amount,
      date: new Date(date),
      description,
      editor: user._id,
      business: editor._id,
    });

    await FigoEditorModel.insertOne({
      entry_type: FIGO_ENTRY_TYPES.expense,
      entry_id: expense_id,
      business: editor._id,
      editor: {
        _id: user._id,
        name: !!staff?.length ? staff[0].name : user.name,
        mobile: wa_id,
      },
      action: FIGO_ENTRY_ACTIONS.add_expense,
    });

    await FigoFIFO({ amount, business: editor._id, type: "out" });

    await fetch(`${RAG_API_URL}/trigger/expense_ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: editor._id,
        expenseId: expense_id,
      }),
    });

    await FigoStatUpdate({ browser, wa_id });
  } catch (error) {
    console.log(error);
  }
};

export const FigoAddInvoice = async (msg, browser) => {
  try {
    const {
      wa_id,
      date,
      due_date,
      customer,
      items,
      payment_details,
      ref,
      fees,
    } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let newItems = items.map((e) => {
      const quantity = parseInt(e.description.split("x ₦")?.[0]);
      const price = parseFloat(e.description.split("x ₦")[1].replace(/,/g, ""));
      return {
        _id: e.id,
        quantity: quantity || 1,
        price: price,
      };
    });

    let totalCost = newItems.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );

    totalCost = totalCost + parseFloat(fees || 0);

    console.log(newItems, totalCost);

    let sale_id = new mongoose.Types.ObjectId();
    let invoice_id = new mongoose.Types.ObjectId();

    await FigoSaleModel.insertMany({
      _id: sale_id,
      date: new Date(due_date),
      due_amount: fromNairaToKobo(totalCost),
      item: newItems,
      customer: customer,
      payment_status: FIGO_PAYMENT_STATUS.unpaid,
      editor: user._id,
      business: editor._id,
      fees: parseFloat(fees || 0),
    });

    await FigoInvoiceModel.insertMany({
      _id: invoice_id,
      date: new Date(date),
      due_date: new Date(due_date),
      sale: sale_id,
      payment_details: payment_details,
      editor: user._id,
      business: editor._id,
      ref,
    });

    for (const item of newItems) {
      const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
        {
          _id: item._id,
        },
        {
          $inc: {
            level: -item.quantity,
          },
        },
        { returnDocument: "after" } //or "before"
      );

      if (afterStockUpdate?.level <= 5) {
        //Send Retsock Reminder
        const twoMinsLater = dayjs().add(2, "minute");

        scheduleReminder({
          when: getScheduleExpression(twoMinsLater, "cron"),
          detail: {
            wa_id,
            product_name: afterStockUpdate.name,
            stock_level: afterStockUpdate.level,
          },
          rule: `restock-alert-${item._id}`,
          eventType: "restock-alert",
        });
      }
    }

    await Promise.all([
      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.invoice,
        entry_id: invoice_id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.add_invoice,
      }),

      FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.sale,
        entry_id: sale_id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.add_invoice,
      }),

      fetch(`${RAG_API_URL}/trigger/invoice_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          invoiceId: invoice_id,
        }),
      }),
    ]);

    // //Reingest here
    // await fetch(`${RAG_API_URL}/trigger/sales_ingest`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     businessId: editor._id,
    //     saleId: sale_id,
    //   }),
    // });
  } catch (error) {
    console.log(error);
  }
};

export const FigoModifyInvoice = async (msg, browser) => {
  try {
    const {
      wa_id,
      date,
      due_date,
      customer,
      items,
      payment_details,
      invoice_id,
      init_payments,
      fees,
    } = msg;
    const mongSession = await mongoose.startSession();
    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let newItems = items.map((e) => {
      let [qtyStr, priceStr] = e.description.split("x ₦") || [];
      const quantity = parseInt(qtyStr?.trim() || "0");
      const price = parseFloat((priceStr || "").replace(/,/g, "").trim());
      // const quantity = parseInt(e.description.split("x ₦")[0]);
      // const price = parseFloat(e.description.split("x ₦")[1].replace(/,/g, ""));
      return {
        _id: e.id,
        quantity: quantity,
        price: price,
      };
    });

    let totalCost = newItems.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );

    totalCost = totalCost + parseFloat(fees || 0);

    let totalPayment = 0;
    let totalToReturn = 0;

    const find_invoice = await FigoInvoiceModel.findOne({
      _id: invoice_id,
    }).populate({
      path: "sale",
      populate: [
        {
          path: "customer",
        },
        { path: "item._id" },
      ],
    });

    let sale_id = find_invoice.sale._id;

    const findAllPayments = await FigoPaymentModel.find({
      sale: sale_id,
      business: account_id,
    });

    await mongSession.withTransaction(async () => {
      if (!!findAllPayments.length) {
        //Remove all payments deleted from business cashflow
        let paymentsToRemove = (findAllPayments || []).filter(
          (e) => !init_payments.includes(e?._id?.toString())
        );

        if (!!paymentsToRemove?.length) {
          await FigoPaymentModel.deleteMany(
            {
              _id: { $in: paymentsToRemove.map((p) => p._id) }, // _id: { $in: paymentsToRemove },
              sale: sale_id,
            },
            { session: mongSession }
          );

          totalToReturn = paymentsToRemove.reduce(
            (acc, item) => acc + item.amount,
            0
          );

          const totalToReturnInKobo = fromNairaToKobo(`${totalToReturn}`);
          let cashflow_id = new mongoose.Types.ObjectId();

          //Remove balance from Money In
          const beforeBusinessUpdate = await FigoBusinessModel.findOneAndUpdate(
            { _id: account_id },
            {
              $inc: {
                money_in: -totalToReturnInKobo,
              },
            },
            { session: mongSession }
          );

          //Cashflow
          await FigoCashFlowModel.insertOne(
            {
              _id: cashflow_id,
              business: account_id,
              amount: totalToReturnInKobo,
              balance_before: beforeBusinessUpdate.money_in,
              balance_after:
                beforeBusinessUpdate.money_in - totalToReturnInKobo,
              type: "Credit",
            },
            { session: mongSession }
          );

          //Ingest
          await fetch(`${RAG_API_URL}/trigger/cashflow_ingest`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              businessId: account_id,
              cashFlowId: cashflow_id,
            }),
          });
        }
      }

      //Find new payments total
      const findPayments = await FigoPaymentModel.find({ sale: sale_id });
      totalPayment = findPayments.reduce((acc, item) => acc + item.amount, 0);

      const due_amount = totalCost - totalPayment;

      const payment_status =
        due_amount <= 0
          ? FIGO_PAYMENT_STATUS.paid
          : totalPayment > 0
          ? FIGO_PAYMENT_STATUS.partially_paid
          : FIGO_PAYMENT_STATUS.unpaid;

      //Restock Old Items
      for (const item of find_invoice.sale.item) {
        await FigoStockModel.updateOne(
          {
            _id: item._id._id,
          },
          {
            $inc: {
              level: item.quantity,
            },
          },
          { session: mongSession }
        );
      }

      await FigoSaleModel.updateOne(
        {
          _id: sale_id,
        },
        {
          $set: {
            date: new Date(due_date),
            due_amount: fromNairaToKobo(due_amount),
            item: newItems,
            customer: customer,
            payment_status,
            editor: user._id,
            business: editor._id,
            fees: parseFloat(fees || 0),
          },
        },
        { session: mongSession }
      );

      await FigoInvoiceModel.updateOne(
        {
          _id: invoice_id,
        },
        {
          $set: {
            date: new Date(date),
            due_date: new Date(due_date),
            payment_details: payment_details,
            editor: user._id,
            business: editor._id,
          },
        },
        { session: mongSession }
      );

      //Update new stock level
      for (const item of newItems) {
        const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
          {
            _id: item._id,
          },
          {
            $inc: {
              level: -item.quantity,
            },
          },
          { returnDocument: "after", session: mongSession } //or "before"
        );

        if (afterStockUpdate?.level <= 5) {
          //Send Retsock Reminder
          const twoMinsLater = dayjs().add(2, "minute");

          await scheduleReminder({
            when: getScheduleExpression(twoMinsLater, "cron"),
            detail: {
              wa_id,
              product_name: afterStockUpdate.name,
              stock_level: afterStockUpdate.level,
            },
            rule: `restock-alert-${item._id}-${invoice_id}`,
            eventType: "restock-alert",
          });
        }
      }

      const editorMeta = {
        _id: user._id,
        name: !!staff?.length ? staff[0].name : user.name,
        mobile: wa_id,
      };

      await Promise.all([
        FigoEditorModel.insertOne(
          {
            entry_type: FIGO_ENTRY_TYPES.invoice,
            entry_id: invoice_id,
            business: editor._id,
            editor: editorMeta,
            action: FIGO_ENTRY_ACTIONS.edit_invoice,
          },
          { session: mongSession }
        ),
        FigoEditorModel.insertOne(
          {
            entry_type: FIGO_ENTRY_TYPES.sale,
            entry_id: sale_id,
            business: editor._id,
            editor: editorMeta,
            action: FIGO_ENTRY_ACTIONS.edit_sale,
          },
          { session: mongSession }
        ),

        //Reingest Invoice here
        fetch(`${RAG_API_URL}/trigger/invoice_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: editor._id,
            invoiceId: invoice_id,
          }),
        }),

        //Reingest Sales here
        fetch(`${RAG_API_URL}/trigger/sales_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: editor._id,
            saleId: sale_id,
          }),
        }),
      ]);
    });
  } catch (error) {
    console.log(error);
  }
};

export const FigoAddMoney = async (msg, browser) => {
  try {
    const mongSession = await mongoose.startSession();
    const { wa_id, date, payment_method, amount: amountStr, description } = msg;

    const init_sale = msg?.init_sale || msg?.sale_id;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let sale_id = init_sale || new mongoose.Types.ObjectId();
    let payment_id = new mongoose.Types.ObjectId();
    let amount = parseFloat(amountStr);

    await mongSession.withTransaction(async () => {
      if (init_sale) {
        const find_init_sale = await FigoSaleModel.findOne({
          _id: sale_id,
          business: account_id,
        });

        await FigoPaymentModel.insertOne(
          {
            _id: payment_id,
            sale: sale_id,
            description,
            date: new Date(date),
            payment_method: FIGO_PAYMENT_METHOD[payment_method[0]],
            amount,
            editor: user._id,
            business: editor._id,
          },
          { session: mongSession }
        );

        let new_due_amount =
          find_init_sale.due_amount - fromNairaToKobo(amount);

        let payment_status =
          new_due_amount <= 0
            ? FIGO_PAYMENT_STATUS.paid
            : FIGO_PAYMENT_STATUS.partially_paid;

        //FIGO TODO If paid in full
        await FigoSaleModel.updateOne(
          { _id: sale_id },
          {
            $inc: {
              due_amount: -fromNairaToKobo(amount),
            },
            $set: {
              payment_status,
            },
          },
          { session: mongSession }
        );

        const editorMeta = {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        };

        await Promise.all([
          FigoEditorModel.insertOne(
            {
              entry_type: FIGO_ENTRY_TYPES.sale,
              entry_id: sale_id,
              business: editor._id,
              editor: editorMeta,
              action: FIGO_ENTRY_ACTIONS.edit_sale,
            },
            { session: mongSession }
          ),

          await FigoEditorModel.insertOne(
            {
              entry_type: FIGO_ENTRY_TYPES.payment,
              entry_id: payment_id,
              business: editor._id,
              editor: editorMeta,
              action: FIGO_ENTRY_ACTIONS.add_payment,
            },
            { session: mongSession }
          ),
        ]);
      } else {
        //FIGO TODO
        await FigoPaymentModel.insertOne(
          {
            _id: payment_id,
            sale: sale_id,
            date: new Date(date),
            payment_method: FIGO_PAYMENT_METHOD[payment_method[0]],
            description,
            amount: amount,
            editor: user._id,
            business: editor._id,
          },
          { session: mongSession }
        );

        await FigoSaleModel.insertOne(
          {
            _id: sale_id,
            date: new Date(date),
            due_amount: 0,
            payment_status: FIGO_PAYMENT_STATUS.paid,
            editor: user._id,
            business: editor._id,
          },
          { session: mongSession }
        );

        const editorMeta = {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        };

        await Promise.all([
          FigoEditorModel.insertOne(
            {
              entry_type: FIGO_ENTRY_TYPES.sale,
              entry_id: sale_id,
              business: editor._id,
              editor: editorMeta,
              action: FIGO_ENTRY_ACTIONS.add_payment,
            },
            { session: mongSession }
          ),

          FigoEditorModel.insertOne(
            {
              entry_type: FIGO_ENTRY_TYPES.payment,
              entry_id: payment_id,
              business: editor._id,
              editor: editorMeta,
              action: FIGO_ENTRY_ACTIONS.add_payment,
            },
            { session: mongSession }
          ),
        ]);
      }

      //Update DB business balances
      await FigoFIFO({
        amount,
        business: editor._id,
        type: "in",
        session: mongSession,
      });

      //Reingest here
      await fetch(`${RAG_API_URL}/trigger/sales_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          saleId: sale_id,
        }),
      });

      //Update Dashboard Stat
      await FigoStatUpdate({ browser, wa_id });

      const is_invoice = await FigoInvoiceModel.findOne({
        sale: sale_id,
        business: account_id,
      });

      if (is_invoice) {
        await FigoEditorModel.insertOne(
          {
            entry_type: FIGO_ENTRY_TYPES.invoice,
            entry_id: is_invoice._id,
            business: editor._id,
            editor: {
              _id: user._id,
              name: !!staff?.length ? staff[0].name : user.name,
              mobile: wa_id,
            },
            action: FIGO_ENTRY_ACTIONS.add_payment,
          },
          { session: mongSession }
        );

        await fetch(`${RAG_API_URL}/trigger/invoice_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: editor._id,
            invoiceId: is_invoice._id,
          }),
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
};

export const FigoEditItem = async (msg, browser) => {
  const {
    wa_id,
    id: item_id,
    amount,
    item_name,
    stock_level,
    supplier_name,
    supplier_phone,
    expiry_date,
    cost_price,
  } = msg;
  try {
    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    if (supplier_phone) {
      let find_supplier = await FigoSupplierModel.findOne({
        mobile: supplier_phone,
        business: account_id,
      });

      if (find_supplier) {
        await FigoStockModel.updateOne(
          { _id: item_id },
          {
            $set: {
              price: parseFloat(amount),
              cost_price: parseFloat(cost_price || amount),
              name: item_name,
              level: parseFloat(stock_level),
              expiry_date: expiry_date || "",
              supplier: find_supplier._id,
            },
          }
        );

        await FigoEditorModel.insertOne({
          entry_type: FIGO_ENTRY_TYPES.stock,
          entry_id: item_id,
          business: editor._id,
          editor: {
            _id: user._id,
            name: !!staff?.length ? staff[0].name : user.name,
            mobile: wa_id,
          },
          action: FIGO_ENTRY_ACTIONS.edit_product,
        });
      } else {
        let supplier_id = new mongoose.Types.ObjectId();

        await FigoSupplierModel.insertMany({
          editor: user._id,
          business: account_id,
          name: supplier_name,
          mobile: supplier_phone,
          _id: supplier_id,
        });

        await FigoStockModel.updateOne(
          { _id: item_id },
          {
            $set: {
              price: parseFloat(amount),
              cost_price: parseFloat(cost_price || amount),
              name: item_name,
              expiry_date: expiry_date || "",
              level: parseFloat(stock_level),
              supplier: supplier_id,
            },
          }
        );

        await Promise.all([
          FigoEditorModel.insertOne({
            entry_type: FIGO_ENTRY_TYPES.supplier,
            entry_id: supplier_id,
            business: editor._id,
            editor: {
              _id: user._id,
              name: !!staff?.length ? staff[0].name : user.name,
              mobile: wa_id,
            },
            action: FIGO_ENTRY_ACTIONS.edit_product,
          }),

          FigoEditorModel.insertOne({
            entry_type: FIGO_ENTRY_TYPES.stock,
            entry_id: item_id,
            business: editor._id,
            editor: {
              _id: user._id,
              name: !!staff?.length ? staff[0].name : user.name,
              mobile: wa_id,
            },
            action: FIGO_ENTRY_ACTIONS.edit_product,
          }),

          fetch(`${RAG_API_URL}/trigger/contact_ingest`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              businessId: editor._id,
              role: "Supplier",
              customerId: supplier_phone,
            }),
          }),
        ]);
      }
    } else {
      await FigoStockModel.updateOne(
        { _id: item_id },
        {
          $set: {
            price: parseFloat(amount),
            cost_price: parseFloat(cost_price || amount),
            expiry_date: expiry_date || "",
            name: item_name,
            level: parseFloat(stock_level),
          },
          $unset: {
            supplier: "",
          },
        }
      );

      await FigoEditorModel.insertOne({
        entry_type: FIGO_ENTRY_TYPES.stock,
        entry_id: item_id,
        business: editor._id,
        editor: {
          _id: user._id,
          name: !!staff?.length ? staff[0].name : user.name,
          mobile: wa_id,
        },
        action: FIGO_ENTRY_ACTIONS.edit_product,
      });
    }

    //Finally
    if (expiry_date) {
      //10 am WAT or 11 gmt+0

      const date = dayjs(expiry_date);
      const threeDaysBeforeAt10am = date
        .subtract(3, "day")
        .hour(9)
        .startOf("hour"); // explicitly zero ms

      await scheduleReminder({
        when: getScheduleExpression(threeDaysBeforeAt10am, "cron"),
        detail: { wa_id, product_name: item_name },
        rule: `expiry-alert-${item_id}`,
        eventType: "expiry-alert",
      });
    }

    await fetch(`${RAG_API_URL}/trigger/product_ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: editor._id,
        productId: item_id,
      }),
    });
  } catch (error) {
    console.log(error);
  } finally {
  }
};

export const FigoDeleteAccount = async (msg, browser) => {
  try {
    const { wa_id } = msg;

    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
    });

    if (editor?._id?.toString() !== user._id.toString()) return;

    await FigoBusinessModel.updateOne(
      { _id: account_id },
      {
        $set: {
          mobile: "",
          name: "",
          logo: "",
          money_in: 0,
          money_out: 0,
        },
        $unset: {
          staff: "",
        },
      }
    );

    await FigoSaleModel.deleteMany({
      business: account_id,
    });
    await FigoInvoiceModel.deleteMany({
      business: account_id,
    });
    await FigoPaymentModel.deleteMany({
      business: account_id,
    });
    await FigoStockModel.deleteMany({
      business: account_id,
    });
    await FigoExpenseModel.deleteMany({
      business: account_id,
    });
    await FigoSupplierModel.deleteMany({
      business: account_id,
    });
    await FigoCustomerModel.deleteMany({
      business: account_id,
    });

    let filter = [{ term: { businessId: account_id.toString() } }];

    // await DeleteOpenSearch({ index: "business", filter });
    // await DeleteOpenSearch({ index: "product", filter });
    // await DeleteOpenSearch({ index: "sale", filter });
    // await DeleteOpenSearch({ index: "invoice", filter });
    // await DeleteOpenSearch({ index: "expense", filter });
    // await DeleteOpenSearch({ index: "contact", filter });
    // await DeleteOpenSearch({ index: "cashflow", filter });
    // await DeleteOpenSearch({ index: "debt", filter });

    await FigoStatUpdate({ browser, wa_id });
  } catch (error) {
    console.log(error);
  }
};

export const FigoSubReminder = async (msg) => {
  try {
    const { wa_id, user, businessName, end, business } = msg;

    if (end) {
      await FigoBusinessModel.updateOne(
        {
          "subscription.user": user,
          _id: business,
        },
        { $set: { "subscription.$.is_active": false } }
      );
    } else {
      //Send Reminder
      await SendFigoReminder({
        wa_id,
        header: `🔔 Subscription`,
        body: ` Your Figo subscription at ${businessName} will expire in 2 days. Thank you.`,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

export const FigoRestockReminder = async (msg) => {
  try {
    const { wa_id, product_name, stock_level } = msg;

    //Send Reminder
    await SendFigoReminder({
      wa_id,
      header: `🔔 Restock Alert`,
      body: ` ${product_name} is remaining only ${stock_level} in stock.`,
    });
  } catch (error) {
    console.log(error);
  }
};

export const FigoExpiryReminder = async (msg) => {
  try {
    const { wa_id, product_name } = msg;

    //Send Reminder
    await SendFigoReminder({
      wa_id,
      header: `🔔 Expiry Alert`,
      body: ` ${product_name} will expire in 3 days.`,
    });
  } catch (error) {
    console.log(error);
  }
};

export const FigoListRestock = async (msg, browser) => {
  try {
    const { wa_id, button_id } = msg;
    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    let list_payload = await redisClient.get(
      `figo_list_payload_${wa_id}_${account_id}`
    );

    let list_button = await redisClient.get(`figo_list_button_${wa_id}`);

    if (
      !list_payload ||
      list_button !== (button_id || "").replace("restock-button-", "")
    ) {
      await sendToWA({
        message: "The List has expired, please resend it.",
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
        wa_id: wa_id,
      });
      return;
    }

    list_payload = JSON.parse(list_payload);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const business = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!business) return;

    const staff = (business.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    for (const item of list_payload) {
      let item_id = item?._id || new mongoose.Types.ObjectId();

      if (!item?._id) {
        let payload = {
          _id: item_id,
          name: item.productName,
          price: item.price,
          cost_price: item.price,
          level: item.quantity,
          editor: user._id,
          business: business._id,
        };
        await FigoStockModel.insertOne(payload);
      } else {
        const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
          { _id: item_id },
          {
            $inc: {
              level: parseFloat(item.quantity),
              price: item.price,
              cost_price: item.price,
            },
          },
          { returnDocument: "after" }
        );

        //Cancel restock alert about this item if level is more than 5
        if (afterStockUpdate?.level > 5) {
          await deleteReminder(`restock-alert-${item_id}`);
        }
      }

      //Finally
      await Promise.all([
        FigoEditorModel.insertOne({
          entry_type: FIGO_ENTRY_TYPES.stock,
          entry_id: item_id,
          business: business._id,
          editor: {
            _id: user._id,
            name: !!staff?.length ? staff[0].name : user.name,
            mobile: wa_id,
          },
          action: item?._id
            ? FIGO_ENTRY_ACTIONS.edit_product
            : FIGO_ENTRY_ACTIONS.add_product,
        }),

        fetch(`${RAG_API_URL}/trigger/product_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: business._id,
            productId: item_id,
          }),
        }),
      ]);
    }

    await sendToWA({
      message: "✅ Item(s) restocked successfully.",
      PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
      wa_id: wa_id,
    });
  } catch (error) {
    console.log(error);
  }
};

export const FigoListNewSale = async (msg, browser) => {
  try {
    const mongSession = await mongoose.startSession();
    const { wa_id, button_id } = msg;

    let payment_status = "paid";
    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    let list_payload = await redisClient.get(
      `figo_list_payload_${wa_id}_${account_id}`
    );

    let list_button = await redisClient.get(`figo_list_button_${wa_id}`);

    if (
      !list_payload ||
      list_button !== (button_id || "").replace("new-sale-button-", "")
    ) {
      await sendToWA({
        message: "The List has expired, please resend it.",
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
        wa_id: wa_id,
      });
      return;
    }

    list_payload = JSON.parse(list_payload);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );

    let sale_id = new mongoose.Types.ObjectId();

    await mongSession.withTransaction(async () => {
      let newItems = await Promise.all(
        list_payload.map(async (e) => {
          //const price = parseFloat(e.price.split("₦")[1].replace(/,/g, ""));
          let item_id = e?._id || new mongoose.Types.ObjectId();

          if (!e?._id) {
            let payload = {
              _id: item_id,
              name: e.productName,
              price: e.price,
              level: 0,
              editor: user._id,
              business: editor._id,
            };

            await FigoStockModel.insertOne(payload);

            //Finally
            await Promise.all([
              FigoEditorModel.insertOne({
                entry_type: FIGO_ENTRY_TYPES.stock,
                entry_id: payload._id,
                business: editor._id,
                editor: {
                  _id: user._id,
                  name: !!staff?.length ? staff[0].name : user.name,
                  mobile: wa_id,
                },
                action: FIGO_ENTRY_ACTIONS.add_product,
              }),

              fetch(`${RAG_API_URL}/trigger/product_ingest`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  businessId: editor._id,
                  productId: item_id,
                }),
              }),
            ]);
          }
          return {
            _id: item_id,
            quantity: e.quantity,
            price: e.price,
          };
        })
      );

      let customerName = list_payload[0]?.customerName || "";
      let customerMobile = list_payload[0]?.customerMobile || "";
      let fees = list_payload[0].totalFees;
      let customer_id = new mongoose.Types.ObjectId();

      let totalCost = newItems.reduce(
        (acc, item) => acc + item.quantity * item.price,
        0
      );

      totalCost = totalCost + fees;

      let amount = 0;
      let due_amount = totalCost;

      if (payment_status == "paid") {
        amount = totalCost;
        due_amount = totalCost - amount;
      } else {
        // if (payment_status == "partially_paid") {
        //   amount = parseFloat(amountStr);
        //   due_amount = totalCost - amount;
        // }
      }

      //Customer
      const isAnonymous = !customerMobile;
      const mobile = isAnonymous ? "__anonymous__" : customerMobile;

      const update = {};
      if (isAnonymous) {
        // Anonymous: only set on insert
        update.$setOnInsert = {
          name: "Anonymous",
          _id: customer_id,
        };
      } else {
        // Non-anonymous: set name always, set _id only on insert
        update.$set = { name: customerName };
        update.$setOnInsert = { _id: customer_id };
      }

      const { _id } = await FigoCustomerModel.findOneAndUpdate(
        { mobile, business: editor._id },
        update,
        {
          upsert: true,
          returnDocument: "after",
        }
      );

      customer_id = _id;

      if (["partially_paid", "paid"].includes(payment_status)) {
        await FigoPaymentModel.insertOne(
          {
            sale: sale_id,
            date: new Date(),
            amount: amount,
            editor: user._id,
            business: editor._id,
          },
          { session: mongSession }
        );
      }

      let payload = {
        _id: sale_id,
        date: new Date(),
        due_amount: fromNairaToKobo(due_amount),
        item: newItems,
        customer: customer_id,
        payment_status: payment_status,
        editor: user._id,
        business: editor._id,
      };

      await FigoSaleModel.insertOne(payload, { session: mongSession });

      for (const item of newItems) {
        const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
          {
            _id: item._id,
          },
          {
            $inc: {
              level: -item.quantity,
            },
          },
          { returnDocument: "after", session: mongSession } //or "before"
        );

        await fetch(`${RAG_API_URL}/trigger/product_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: editor._id,
            productId: item._id,
          }),
        });

        if (afterStockUpdate?.level <= 5) {
          //Send Retsock Reminder
          const twoMinsLater = dayjs().add(2, "minute");

          // await scheduleReminder({
          //   when: getScheduleExpression(twoMinsLater, "cron"),
          //   detail: {
          //     wa_id,
          //     product_name: afterStockUpdate.name,
          //     stock_level: afterStockUpdate.level,
          //   },
          //   rule: `restock-alert-${item._id}-${sale_id}`,
          //   eventType: "restock-alert",
          // });
        }
      }

      await FigoEditorModel.insertOne(
        {
          entry_type: FIGO_ENTRY_TYPES.sale,
          entry_id: sale_id,
          business: editor._id,
          editor: {
            _id: user._id,
            name: !!staff?.length ? staff[0].name : user.name,
            mobile: wa_id,
          },
          action: FIGO_ENTRY_ACTIONS.add_sale,
        },
        { session: mongSession }
      );

      await FigoFIFO({
        amount,
        business: editor._id,
        type: "in",
        session: mongSession,
      });
    });

    await mongSession.endSession();

    await FigoStatUpdate({ browser, wa_id });

    await Promise.all([
      sendToWA({
        message: "✅ New sale(s) recorded successfully.",
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
        wa_id: wa_id,
      }),

      fetch(`${RAG_API_URL}/trigger/sales_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          saleId: sale_id,
        }),
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoListNewInvoice = async (msg, browser) => {
  try {
    const mongSession = await mongoose.startSession();
    const { wa_id, button_id } = msg;

    let payment_status = "unpaid";
    const account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    let list_payload = await redisClient.get(
      `figo_list_payload_${wa_id}_${account_id}`
    );

    let list_button = await redisClient.get(`figo_list_button_${wa_id}`);

    if (
      !list_payload ||
      list_button !== (button_id || "").replace("new-invoice-button-", "")
    ) {
      await sendToWA({
        message: "The List has expired, please resend it.",
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
        wa_id: wa_id,
      });
      return;
    }

    list_payload = JSON.parse(list_payload);

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) return;

    const editor = await FigoBusinessModel.findOne({
      _id: account_id,
      $or: [{ "staff._id": user._id }, { _id: user._id }],
    }).populate("staff._id");

    if (!editor) return;

    const staff = (editor.staff || []).filter(
      (e) => e?._id?._id?.toString() == user._id.toString()
    );
    let list_items;
    let ref = customId(5);
    let key = `${ref}_${new Date().getTime()}`;
    let due_date = new Date();
    let sale_id = new mongoose.Types.ObjectId();
    let invoice_id = new mongoose.Types.ObjectId();
    let payment_details = list_payload[0]?.note || "";
    let customerName = list_payload[0]?.customerName || "";
    let customerMobile = list_payload[0]?.customerMobile || "";
    let fees = list_payload[0].totalFees;
    let customer_id = new mongoose.Types.ObjectId();
    let totalCost = 0;

    await mongSession.withTransaction(async () => {
      list_items = await Promise.all(
        list_payload.map(async (e) => {
          //const price = parseFloat(e.price.split("₦")[1].replace(/,/g, ""));
          let item_id = e?._id || new mongoose.Types.ObjectId();

          if (!e?._id) {
            let payload = {
              _id: item_id,
              name: e.productName,
              price: e.price,
              level: 0,
              editor: user._id,
              business: editor._id,
            };

            await FigoStockModel.insertOne(payload, { session: mongSession });

            await Promise.all([
              FigoEditorModel.insertOne(
                {
                  entry_type: FIGO_ENTRY_TYPES.stock,
                  entry_id: payload._id,
                  business: editor._id,
                  editor: {
                    _id: user._id,
                    name: !!staff?.length ? staff[0].name : user.name,
                    mobile: wa_id,
                  },
                  action: FIGO_ENTRY_ACTIONS.add_product,
                },
                { session: mongSession }
              ),

              await fetch(`${RAG_API_URL}/trigger/product_ingest`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  businessId: editor._id,
                  productId: item_id,
                }),
              }),
            ]);
          }
          return {
            _id: item_id,
            quantity: e.quantity,
            price: e.price,
            name: e.productName,
          };
        })
      );

      let newItems = list_items.map(({ name, ...item }) => item);

      console.log({ list_items });

      totalCost = newItems.reduce(
        (acc, item) => acc + item.quantity * item.price,
        0
      );

      totalCost = totalCost + fees;

      let amount = 0;
      let due_amount = totalCost;

      if (payment_status == "paid") {
        amount = totalCost;
        due_amount = totalCost - amount;
      } else {
        // if (payment_status == "partially_paid") {
        //   amount = parseFloat(amountStr);
        //   due_amount = totalCost - amount;
        // }
      }

      //Customer
      const isAnonymous = !customerMobile;
      const mobile = isAnonymous ? "__anonymous__" : customerMobile;

      const update = {};
      if (isAnonymous) {
        // Anonymous: only set on insert
        update.$setOnInsert = {
          name: "Anonymous",
          _id: customer_id,
        };
      } else {
        // Non-anonymous: set name always, set _id only on insert
        update.$set = { name: customerName };
        update.$setOnInsert = { _id: customer_id };
      }

      const { _id } = await FigoCustomerModel.findOneAndUpdate(
        { mobile, business: editor._id },
        update,
        {
          upsert: true,
          returnDocument: "after",
        }
      );

      customer_id = _id;

      if (["partially_paid", "paid"].includes(payment_status)) {
        await FigoPaymentModel.insertMany(
          {
            sale: sale_id,
            date: new Date(),
            amount: amount,
            editor: user._id,
            business: editor._id,
          },
          { session: mongSession }
        );
      }

      let payload = {
        _id: sale_id,
        date: new Date(),
        due_amount: fromNairaToKobo(due_amount),
        item: newItems,
        customer: customer_id,
        payment_status: payment_status,
        editor: user._id,
        business: editor._id,
      };

      await FigoSaleModel.insertMany(payload, { session: mongSession });

      await FigoInvoiceModel.insertMany(
        {
          _id: invoice_id,
          date: new Date(),
          due_date: new Date(),
          sale: sale_id,
          payment_details: payment_details || "",
          editor: user._id,
          business: editor._id,
          ref,
        },
        { session: mongSession }
      );

      for (const item of newItems) {
        const afterStockUpdate = await FigoStockModel.findOneAndUpdate(
          {
            _id: item._id,
          },
          {
            $inc: {
              level: -item.quantity,
            },
          },
          { returnDocument: "after", session: mongSession } //or "before"
        );

        await fetch(`${RAG_API_URL}/trigger/product_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: editor._id,
            productId: item._id,
          }),
        });

        if (afterStockUpdate?.level <= 5) {
          //Send Retsock Reminder
          const twoMinsLater = dayjs().add(2, "minute");

          // await scheduleReminder({
          //   when: getScheduleExpression(twoMinsLater, "cron"),
          //   detail: {
          //     wa_id,
          //     product_name: afterStockUpdate.name,
          //     stock_level: afterStockUpdate.level,
          //   },
          //   rule: `restock-alert-${item._id}`,
          //   eventType: "restock-alert",
          // });
        }
      }

      await FigoFIFO({
        amount,
        business: editor._id,
        type: "in",
        session: mongSession,
      });

      await Promise.all([
        FigoEditorModel.insertOne(
          {
            entry_type: FIGO_ENTRY_TYPES.invoice,
            entry_id: invoice_id,
            business: editor._id,
            editor: {
              _id: user._id,
              name: !!staff?.length ? staff[0].name : user.name,
              mobile: wa_id,
            },
            action: FIGO_ENTRY_ACTIONS.add_invoice,
          },
          { session: mongSession }
        ),

        FigoEditorModel.insertOne(
          {
            entry_type: FIGO_ENTRY_TYPES.sale,
            entry_id: sale_id,
            business: editor._id,
            editor: {
              _id: user._id,
              name: !!staff?.length ? staff[0].name : user.name,
              mobile: wa_id,
            },
            action: FIGO_ENTRY_ACTIONS.add_sale,
          },
          { session: mongSession }
        ),
      ]);
    });

    await mongSession.endSession();

    await FigoStatUpdate({ browser, wa_id });
    /////
    let previewItems = list_items.map((e) => {
      return {
        _id: e._id,
        quantity: e.quantity,
        price: AmountSeparator(e.price),
        name: e.name,
        subtotal: AmountSeparator(e.quantity * e.price),
      };
    });

    await GenerateInvoice({
      browser,
      line_items: previewItems,
      key,
      business: {
        name: editor.name || "",
        mobile: editor.mobile || "",
        logo: editor.logo
          ? `https://figoassets.s3.us-east-1.amazonaws.com/${editor.logo}`
          : "",
      },
      customer: {
        name: customerName || "",
        mobile: customerMobile || "",
      },
      total: `${AmountSeparator(totalCost)}`,
      due_date: formatDay(due_date),
      date: formatDay(due_date),
      note: payment_details || "",
      fees: `${AmountSeparator(fees)}`,
      ref,
    });

    let url = `https://figoassets.s3.us-east-1.amazonaws.com/${key}`;

    ////
    //Send Invoice Image
    await Promise.all([
      sendImageToWA({
        caption: `*✅ New invoice created.*`,
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
        wa_id: wa_id,
        url,
      }),

      fetch(`${RAG_API_URL}/trigger/invoice_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: editor._id,
          invoiceId: invoice_id,
        }),
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoFIFO = async ({ type, amount, business, session }) => {
  const amountInKobo = fromNairaToKobo(`${amount}`);
  let cashflow_id = new mongoose.Types.ObjectId();

  if (type === "in") {
    const response = await FigoBusinessModel.findOneAndUpdate(
      { _id: business },
      {
        $inc: {
          money_in: amountInKobo,
        },
      },
      { returnDocument: "after", ...(session ? { session } : {}) } //or "before"
    );

    //Cashflow
    await FigoCashFlowModel.insertOne(
      {
        _id: cashflow_id,
        business,
        amount: amountInKobo,
        balance_before: response.money_in - amountInKobo,
        balance_after: response.money_in,
        type: "Credit",
      },
      session ? { session } : {}
    );

    //Ingest
    await fetch(`${RAG_API_URL}/trigger/cashflow_ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: business,
        cashFlowId: cashflow_id,
      }),
    });
  } else {
    const response = await FigoBusinessModel.findOneAndUpdate(
      { _id: business },
      {
        $inc: {
          money_out: amountInKobo,
        },
      },
      { returnDocument: "after", ...(session ? { session } : {}) } //or "before"
    );

    //Cashflow
    await FigoCashFlowModel.insertOne(
      {
        _id: cashflow_id,
        business,
        amount: amountInKobo,
        balance_before: response.money_out - amountInKobo,
        balance_after: response.money_out,
        type: "Debit",
      },
      session ? { session } : {}
    );

    //Ingest
    await fetch(`${RAG_API_URL}/trigger/cashflow_ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: business,
        cashFlowId: cashflow_id,
      }),
    });
  }
  return { success: true };
};

const FigoStatUpdate = async ({ browser, wa_id }) => {
  try {
    let figo_active_account = await redisClient.get(
      `figo_active_account_${wa_id}`
    );

    const findBusiness = await FigoBusinessModel.findOne({
      _id: figo_active_account,
    }).populate("user staff._id");

    await redisClient.set(
      `figo_account_name_${wa_id}`,
      findBusiness?.name || findBusiness?.user?.mobile || ""
    );

    if (findBusiness?.user?.mobile !== wa_id) {
      const hasMatchingStaff = (findBusiness?.staff || []).some(
        (staff) => staff?._id?.mobile == wa_id
      );
      if (!hasMatchingStaff) return;
    }

    let stat_key = customId({
      name: "12345",
      email: "6789",
      randomLength: 4,
    });

    const money_in = AmountSeparator(parseFloat(findBusiness.money_in) / 100);
    const money_out = AmountSeparator(parseFloat(findBusiness.money_out) / 100);

    const imageBuffer = await GenerateStat({ browser, money_in, money_out });

    await UploadToAWS({
      Body: imageBuffer, //TODO
      Key: stat_key,
      ContentType: "image/png",
    });

    await redisClient.set(`figo_account_stat_${wa_id}`, stat_key);
  } catch (error) {
    console.log("error at FigoStatUpdate");
  }
};
