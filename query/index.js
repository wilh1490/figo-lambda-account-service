import mongoose from "mongoose";
import axios from "axios";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { redisClient } from "../shared/redis.js";
import customId from "custom-id/index.js";
import {
  ErrorScreen,
  Eversend_Token,
  MoringWalletKeys,
  MoringaFees,
  SuccessScreen,
  UpdateRequiredScreen,
  computeLastSeen,
  emailOTPTemplate,
  paginateList,
  sendMail,
  toTimeZone,
  SendFigoInvitation,
  SendFigoReminder,
  sendToWA,
  getScheduleExpression,
} from "../shared/config/helper.js";
import { scheduleReminder } from "../shared/config/alert.js";
import {
  BalanceHistoryModel,
  ChatSupportModel,
  MoringaEmailCodeModel,
  MoringaUserModel,
  TransactionModel,
  UserModel,
  WaitlistModel,
  MoringaChatSupportModel,
  FigoUserModel,
  FigoBusinessModel,
  FigoSupplierModel,
  FigoStockModel,
  FigoCustomerModel,
  FigoSaleModel,
  FigoInvoiceModel,
  FigoExpenseModel,
  FigoPaymentModel,
  FigoEditorModel,
  FigoSubscriptionModel,
  FigoReferralModel,
  FigoSpinModel,
  FigoCartModel,
} from "../shared/models/index.js";
import SCREEN_RESPONSES, {
  CHAT_RESPONSES,
  FIGO_SCREEN_RESPONSES,
  MORINGA_RESPONSES,
} from "../shared/config/responses.js";
import {
  FileFromAWS,
  UploadToAWS,
  processEncryptedMedia,
  sendToQueue,
} from "../shared/config/fileHandler.js";
import {
  AmountSeparator,
  Sfh_Token,
  formatDate,
  maskString,
  termiiOTP,
  termiiVerify,
  fromKoboToNaira,
  formatDay,
} from "../shared/config/helper.js";
import {
  DATA_PLANS,
  DISCOS,
  DSTV_PLANS,
  Zero_Balance_Avatar,
  airtimeServices,
  dataServices,
  female_avatar,
  male_avatar,
  profile_avatar_sample,
  empty_wheel,
  five_wheel,
  ten_wheel,
  fifty_wheel,
  five_h_wheel,
  one_k_wheel,
  freebies_wheel,
  free_delivery_wheel,
  bogo_wheel,
} from "../shared/config/data.js";
import {
  FIGO_PAYMENT_STATUS,
  FIGO_ENTRY_TYPES,
  HISTORY_TYPE,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
  accountNumberQueue,
  figoAddCustomerQueue,
  figoAddExpenseQueue,
  figoAddInvoiceQueue,
  figoAddItemQueue,
  finishTransactionQueue,
  moringaAccountDataQueue,
  sendBVNOTPQueue,
  sendNINOTPQueue,
  sendReceiptQueue,
  statementQueue,
  accountDataQueue,
  uploadIDQueue,
  figoAccountDataQueue,
  figoAddSaleQueue,
  figoAddMoneyQueue,
  figoAddSupplierQueue,
  figoEditItemQueue,
  moringafinishTransactionQueue,
  figoModifyInvoiceQueue,
  figoModifySaleQueue,
} from "../shared/config/statusError.js";
import fetch from "node-fetch";
import { QueryOpenSearch } from "../shared/config/openSearch.js";
import { getSecrets } from "../shared/config/secrets.js";

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

const {
  SFH_ENDPOINT,
  SFH_CLIENT_ID,
  GRAPH_API_TOKEN,
  WA_PHONE_NUMBER_ID,
  MORINGA_WA_PHONE_NUMBER,
  DOJAH_APP_ID,
  DOJAH_SECRET,
  SAFE_HAVEN_MAIN_ACC,
  SAFE_HAVEN_REIMBURSE_ACC,
  SAFE_HAVEN_CLIENT_ID,
  EVERSEND_ENDPOINT,
  CANVAS_SERVICE_URL,
  FIGO_WA_PHONE_NUMBER,
  QUEUE_API_URL,
  RAG_API_URL,
} = await getSecrets();

const unpaidOrPartiallyPaid = [
  FIGO_PAYMENT_STATUS.unpaid,
  FIGO_PAYMENT_STATUS.partially_paid,
];

const FigoPaymentLabel = {
  paid: "Paid",
  unpaid: "Unpaid",
  partially_paid: "Part paid",
};

const genderAvatar = (gender) => {
  if (gender == "m") return male_avatar;
  if (gender == "f") return female_avatar;
};

export const HomeData = async (params) => {
  try {
    console.log(params, "params");
    const { wa_id } = params;

    let intro = await redisClient.get(`intro_${wa_id}`);
    let account_number_string = await redisClient.get(
      `account_number_string_${wa_id}`
    );
    let account_name = await redisClient.get(`account_name_${wa_id}`);

    //let homeData = await redisClient.get(`homeData_${wa_id}`);
    //const ttl = await redisClient.ttl(`homeData_${wa_id}`);
    //console.log(ttl, "ttl1");

    //if (homeData) {
    // console.log("yes homed", homeData);
    // return {
    //   ...SCREEN_RESPONSES.HOME,
    //   data: JSON.parse(homeData),
    // };
    //}

    //else {
    console.log("no homed");
    const user = await UserModel.findOne({ mobile: wa_id });

    if (user) {
      let avatar = "";

      await UserModel.updateMany(
        {
          mobile: wa_id,
        },
        { $set: { last_seen: new Date() } }
      );

      if (user?.sfh_account?.migration_complete) {
        const sfh_access_token = await Sfh_Token();

        let subAccount = await fetch(
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

        subAccount = await subAccount.json();

        console.log(subAccount, "subaccount");

        let resData = {
          greetings: "Welcome back 👋🏾,",
          title: `Carrot`,
          intro: `Balance ₦${AmountSeparator(
            subAccount?.data?.bookBalance || 0
          )}`,
          avatar,
        };

        // await redisClient.set(`homeData_${wa_id}`, JSON.stringify(resData), {
        //   EX: 15,
        //   NX: true,
        // });

        return {
          ...SCREEN_RESPONSES.HOME,
          data: resData,
        };
      } else {
        let resData = {
          greetings: "Welcome back 👋🏾,",
          title: `Balance ₦${AmountSeparator(user.account_balance)}`,
          intro: `Activate account number`,
          avatar,
        };

        // await redisClient.set(`homeData_${wa_id}`, JSON.stringify(resData), {
        //   EX: 15,
        //   //NX: true,
        // });

        // const ttl = await redisClient.ttl(`homeData_${wa_id}`);
        // console.log(ttl, "ttl2");

        return {
          ...SCREEN_RESPONSES.HOME,
          data: resData,
        };
      }
    } else {
      await UserModel.insertOne({
        mobile: wa_id,
        last_seen: new Date(),
      });

      let resData = {
        greetings: "Welcome back 👋🏾,",
        title: `Balance ₦0.00`,
        intro: "Activate account number",
        avatar: profile_avatar_sample,
      };

      // await redisClient.set(`homeData_${wa_id}`, JSON.stringify(resData), {
      //   EX: 15,
      //   // NX: true,
      // });

      return {
        ...SCREEN_RESPONSES.HOME,
        data: resData,
      };
    }
    //}
  } catch (error) {
    console.log(error, "error at home123");
    return ErrorScreen({ message: `${error}` });
  }
};

export const UploadBvn = async (body) => {
  try {
    const { flow_token } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      if (user?.sfh_account?.migration_complete)
        return ErrorScreen({
          title: "BVN Verification",
          heading: "Level 1 already unlocked 👍🏾",
          message: "Please try to unlock a new level instead e.g Level 2",
        });

      if (!body.resend_code && !body.bvn)
        return ErrorScreen({
          title: "Level 1",
          heading: "Your BVN is required",
          message: "Please go back and enter your BVN to continue",
        });

      await sendToQueue(
        JSON.stringify({
          intent: sendBVNOTPQueue,
          payload: {
            wa_id,
            bvn: body.resend_code ? user.kyc.bvn.value : body.bvn,
          },
        })
      );

      if (!body.resend_code)
        return {
          ...SCREEN_RESPONSES.BVN_OTP,
          data: {
            bvn: body.bvn,
          },
        };
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const UploadNin = async (body) => {
  try {
    const { flow_token } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      if (user?.sfh_account?.migration_complete)
        return ErrorScreen({
          title: "NIN Verification",
          heading: "Level 1 already unlocked 👍🏾",
          message: "Please try to unlock a new level instead e.g Level 2",
        });

      if (!body.resend_code && !body.nin)
        return ErrorScreen({
          title: "Level 1",
          heading: "Your NIN is required",
          message: "Please go back and enter your NIN to continue",
        });

      await sendToQueue(
        JSON.stringify({
          intent: sendNINOTPQueue,
          payload: {
            wa_id,
            nin: body.resend_code ? user.kyc?.nin?.value : body.nin,
          },
        })
      );

      if (!body.resend_code)
        return {
          ...SCREEN_RESPONSES.NIN_OTP,
          data: {
            nin: body.nin,
          },
        };
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const UploadSelfie = async (body) => {
  try {
    const { flow_token, nin } = body;
    let image = body.image[0];
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      // const user = await UserModel.findOne({ mobile: wa_id });
      if (!nin)
        return ErrorScreen({
          title: "Level 2",
          heading: "Your NIN is required",
          message: "Please go back and enter your NIN to continue",
        });

      const decryptedMedia = await processEncryptedMedia({
        encryptionKey: image.encryption_metadata.encryption_key,
        hmacKey: image.encryption_metadata.hmac_key,
        iv: image.encryption_metadata.iv,
        expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
        expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
        imageUrl: image.cdn_url,
        fileName: image.file_name,
      });

      let resData = await fetch("https://api.dojah.io/api/v1/kyc/nin/verify", {
        method: "POST",
        //url: "https://api.dojah.io/api/v1/kyc/nin/verify",
        headers: {
          Authorization: `${DOJAH_SECRET}`,
          AppId: DOJAH_APP_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nin,
          selfie_image: decryptedMedia.toString("base64"),
        }),
      });

      resData = await resData.json();

      const entity = resData?.entity;

      console.log(entity, "entity");

      const match = entity?.selfie_verification?.match;

      if (match) {
        await UserModel.updateOne(
          { mobile: wa_id },
          {
            $set: {
              "kyc.nin.value": nin,
              "kyc.nin.is_verified": true,
              "sfh_account.daily_limit": 200000,
              "sfh_account.single_limit": 100000,
              "kyc.bio": entity,
              "kyc.level": 2,
            },
          }
        );

        return SuccessScreen({
          title: "Level 2",
          heading: "NIN validated successfully",
          message: "You have successfully unlocked Level 2 🎉🎉",
        });
      } else {
        return ErrorScreen({
          title: "NIN Verification",
          heading: "Match failed",
          message:
            "Unable to match your selfie with the NIN you provided. Please go back and try again with another selfie.",
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const UploadSelfieBVN = async (body) => {
  try {
    const { flow_token, bvn } = body;
    let image = body.image[0];
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      // const user = await UserModel.findOne({ mobile: wa_id });
      if (!bvn)
        return ErrorScreen({
          title: "Level 2",
          heading: "Your BVN is required",
          message: "Please go back and enter your BVN to continue",
        });

      const decryptedMedia = await processEncryptedMedia({
        encryptionKey: image.encryption_metadata.encryption_key,
        hmacKey: image.encryption_metadata.hmac_key,
        iv: image.encryption_metadata.iv,
        expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
        expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
        imageUrl: image.cdn_url,
        fileName: image.file_name,
      });

      let resData = await fetch("https://api.dojah.io/api/v1/kyc/bvn/verify", {
        method: "POST",
        headers: {
          Authorization: `${DOJAH_SECRET}`,
          AppId: DOJAH_APP_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bvn,
          selfie_image: decryptedMedia.toString("base64"),
        }),
      });

      resData = await resData.json();

      const entity = resData?.entity;

      console.log(entity, "entity");

      const match = entity?.selfie_verification?.match;

      if (match) {
        await UserModel.updateOne(
          { mobile: wa_id },
          {
            $set: {
              "kyc.bvn.value": bvn,
              "kyc.bvn.is_verified": true,
              "sfh_account.daily_limit": 200000,
              "sfh_account.single_limit": 100000,
              "kyc.bio": entity,
              "kyc.level": 2,
            },
          }
        );

        return SuccessScreen({
          title: "Level 2",
          heading: "BVN validated successfully",
          message: "You have successfully unlocked Level 2 🎉🎉",
        });
      } else {
        return ErrorScreen({
          title: "BVN Verification",
          heading: "Match failed",
          message:
            "Unable to match your selfie with the BVN you provided. Please go back and try again with another selfie.",
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const UploadDocument = async (body) => {
  try {
    const { flow_token, type: id_type } = body;

    // let image = body.image[0];

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      // const user = await UserModel.findOne({ mobile: wa_id });
      // const decryptedMedia = await processEncryptedMedia({
      //   encryptionKey: image.encryption_metadata.encryption_key,
      //   hmacKey: image.encryption_metadata.hmac_key,
      //   iv: image.encryption_metadata.iv,
      //   expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
      //   expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
      //   imageUrl: image.cdn_url,
      //   fileName: image.file_name,
      // });

      await sendToQueue(
        JSON.stringify({ intent: uploadIDQueue, payload: { wa_id, ...body } })
      );

      return SuccessScreen({
        title: "Level 3",
        heading: "Document submitted",
        message:
          "We'll manually review the document you submitted. Please expect to hear from us within 2 hours.",
        next_screen: "HOME",
      });
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ReturnToHome = async (params, body) => {
  try {
    console.log(body, "at rehome");
    const { flow_token } = params;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id || body?.action == "INIT") {
      const response = await HomeData({ wa_id });
      return response;
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ReturnToKYC = async (params) => {
  try {
    const { flow_token } = params;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      let heading =
        user.kyc.level < 3
          ? "We need some more information from you:"
          : "Your KYC is complete in full:";

      if (!user.pin)
        return {
          ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
          data: {
            is_kyc: true,
            show_message: false,
          },
        };

      if (user.kyc.level < 3) {
        return {
          ...SCREEN_RESPONSES.KYC,
          data: {
            heading,
            active: `level_${user.kyc.level == 3 ? "3" : user.kyc.level + 1}`,
            options: [
              {
                id: "level_1",
                title: "Level 1",
                description: "Daily limit - ₦50,000",
                metadata: "Unlock with NIN",
                color: "#FF9800",
                enabled: user.kyc.level === 0 ? true : false,
              },
              {
                id: "level_2",
                title: "Level 2",
                enabled: user.kyc.level === 1 ? true : false,
                description: "Daily limit - ₦200,000",
                metadata: "Unlock with BVN",
                color: "#2196F3",
              },
              {
                id: "level_3",
                title: "Level 3",
                description: "Daily limit - ₦10M",
                enabled: user.kyc.level === 2 || user.kyc.level === 3,
                color: "#4CAF50",
              },
            ],
          },
        };
      } else {
        return SuccessScreen({
          title: "KYC Complete",
          heading: "You are fully compliant 🎉",
          message: "Go on and enjoy transacting on Carrot",
          next_screen: "HOME",
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const RestartFlow = async (params, body) => {
  try {
    const { wa_id } = params;

    //Get Home Screen details
    //const data = await HomeData(params);
    const new_flow_token = uuidv4();
    await redisClient.set(`flow_token_${new_flow_token}`, wa_id);

    let is_verified = await redisClient.get(`is_verified_${wa_id}`);
    let account_number_string = await redisClient.get(
      `account_number_string_${wa_id}`
    );
    let account_number_copy = await redisClient.get(
      `account_number_copy_${wa_id}`
    );
    let account_name = await redisClient.get(`account_name_${wa_id}`);

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
            text: "Welcome to Carrot",
          },
          body: {
            text: "Airtime, Transfer, Bills, Data, Commission",
          },
          footer: {
            text: "Bank on your WhatsApp.",
          },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: body?.flow_token || new_flow_token,
              flow_id: "410422032142598",
              flow_cta: body?.cta || "Open now",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "LOGIN",
                data: {
                  account_number_string:
                    account_number_string || "Safe Haven MFB - XXXXXXXXX",
                  account_number_copy:
                    account_number_copy || "Safe Haven MFB - XXXXXXXXX",
                  account_name:
                    account_name || "Go to KYC to activate your account",
                  is_verified: !!is_verified,
                },
              },
            },
          },
        },
      },
    });
    return {
      success: true,
    };
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FetchAccount = async (params) => {
  try {
    const { flow_token } = params;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });

      if (user && user?.sfh_account?.migration_complete) {
        return {
          ...SCREEN_RESPONSES.MORE_ACCOUNT,
          data: {
            account_number: user.sfh_account.account_number,
            account_name: user.sfh_account.account_name,
            bank_name: user.sfh_account.bank_name,
          },
        };
      } else {
        return {
          ...SCREEN_RESPONSES.MORE_ACCOUNT,
        };
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FetchProfile = async (params) => {
  try {
    const { flow_token } = params;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      let avatar = user.kyc?.bio?.gender
        ? genderAvatar(user.kyc?.bio?.gender)
        : profile_avatar_sample;

      return {
        ...SCREEN_RESPONSES.PROFILE,
        data: {
          phone_number: user.mobile,
          avatar,
        },
      };
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const JoinCardWaitlist = async (params) => {
  try {
    const { flow_token } = params;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      await WaitlistModel.updateMany(
        { user: user._id },
        { $set: { type: "debit_card" } },
        { upsert: true }
      );
      return SuccessScreen({
        title: "Debit Card",
        heading:
          "You're on the list! We'll send updates on WhatsApp as we get closer to launching.",
        message: "",
      });
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FetchLimits = async (params) => {
  try {
    const { flow_token } = params;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      return {
        ...SCREEN_RESPONSES.LIMITS,
        data: {
          single_limit: `NGN ${user.sfh_account.single_limit}`,
          daily_limit: `NGN ${user.sfh_account.daily_limit}`,
        },
      };
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const IntroLink = async (body) => {
  try {
    const { flow_token, intro } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    //console.log(body, wa_id);
    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });

      //Send to Queue

      await sendToQueue(
        JSON.stringify({ intent: accountDataQueue, payload: { wa_id } })
      );

      let balance_avatar_key = await redisClient.get(`balance_avatar_${wa_id}`);
      console.log(balance_avatar_key);

      if (intro.includes("Hide")) {
        //Send to Queue

        await sendToQueue(
          JSON.stringify({ intent: accountDataQueue, payload: { wa_id } })
        );

        return {
          ...SCREEN_RESPONSES.HOME,
          data: {
            is_verified: true,
            show_balance: false,
            intro: "Show balance",
          },
        };
      }

      if (intro.includes("Show")) {
        //Send to Queue

        await sendToQueue(
          JSON.stringify({ intent: accountDataQueue, payload: { wa_id } })
        );

        let balance = balance_avatar_key
          ? await FileFromAWS(balance_avatar_key)
          : Zero_Balance_Avatar;

        return {
          ...SCREEN_RESPONSES.HOME,
          data: {
            is_verified: true,
            show_balance: true,
            balance: balance || Zero_Balance_Avatar,
            intro: "Hide balance",
          },
        };
      }

      if (intro.includes("Activate")) {
        if (user?.sfh_account?.account_number) {
          //Send to Queue

          await sendToQueue(
            JSON.stringify({ intent: accountDataQueue, payload: { wa_id } })
          );

          return {
            ...SCREEN_RESPONSES.HOME,
            data: {
              is_verified: true,
              show_balance: false,
              balance: ".",
              intro: "Show balance",
            },
          };
        } else {
          const response = await ReturnToKYC({ flow_token });
          return response;
        }
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FetchStatement = async (body) => {
  try {
    const { flow_token, from: start_date, to: end_date } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      // Send message to queue

      await sendToQueue(
        JSON.stringify({
          intent: statementQueue,
          payload: { wa_id, start_date, end_date },
        })
      );

      return SuccessScreen({
        title: "Statement of Account",
        heading: "Generating statement",
        message: "Your statement will be sent to you on WhatsApp.",
      });
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const UploadProfilePhoto = async (body) => {
  try {
    //   const { flow_token } = body;
    //   let image = body.image[0];
    //   console.log(image);
    //   const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    //   if (wa_id) {
    //     const decryptedMedia = await processEncryptedMedia({
    //       encryptionKey: image.encryption_metadata.encryption_key,
    //       hmacKey: image.encryption_metadata.hmac_key,
    //       iv: image.encryption_metadata.iv,
    //       expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
    //       expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
    //       imageUrl: image.cdn_url,
    //       fileName: image.file_name,
    //     });
    //     //Get profile_photo
    //     // const { location: profile_photo } = await compressImageNormal(
    //     //   decryptedMedia,
    //     //   image.file_name
    //     // );
    //     //Get avatar
    //     const compress_avatar = await compressImageStrict(decryptedMedia);
    //     const avatar_buffer = await makeCircularImage(compress_avatar);
    //     const avatar = avatar_buffer.toString("base64");
    //     // .replace(/\r?\n|\r/g, "")
    //     // .trim();
    //     // const user = await UserModel.findOne({ mobile: wa_id });
    //     // Send message to queue
    //     // RMQChannelUploadProfilePhoto.sendToQueue(
    //     //   uploadProfilePhoto,
    //     //   Buffer.from(
    //     //     JSON.stringify({
    //     //       wa_id,
    //     //       file_name: image.file_name,
    //     //       decryptedMedia: decryptedMedia.toString("base64"),
    //     //     })
    //     //   ),
    //     //   {
    //     //     contentType: "application/json",
    //     //   }
    //     // );
    //     // await UserModel.updateOne(
    //     //   { mobile: wa_id },
    //     //   { $set: { profile_photo, avatar: avatar_buffer } }
    //     // );
    //     return {
    //       ...SCREEN_RESPONSES.PROFILE,
    //       data: {
    //         phone_number: wa_id,
    //         avatar,
    //       },
    //     };
    //   } else {
    //     return UpdateRequiredScreen({});
    //   }
  } catch (error) {
    console.log(error);
    return ErrorScreen({ message: `${error}` });
  }
};

export const BVN_OTP = async (body) => {
  try {
    const { flow_token, otp } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      const sfh_access_token = await Sfh_Token();
      const reference = uuidv4();
      let createAccount = {};

      if (!user?.sfh_account?.migration_complete) {
        const resData = await fetch(`${SFH_ENDPOINT}/accounts/v2/subaccount`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            phoneNumber: `+${user.mobile}`,
            emailAddress: user.email || "getcarrotai@gmail.com",
            identityType: "BVN",
            autoSweep: false,
            externalReference: reference,
            identityNumber: user.kyc.bvn.value,
            identityId: user.kyc.bvn.verification_id,
            otp,
          }),
        });

        createAccount = await resData.json();

        if (createAccount?.statusCode == 200) {
          await sendToQueue(
            JSON.stringify({
              intent: accountNumberQueue,
              payload: { wa_id, createAccount, reference },
            })
          );

          return SuccessScreen({
            title: "BVN Verification",
            heading: "Verification successful.",
            message: "Your Account number has been created.",
          });
        } else {
          return ErrorScreen({
            title: "BVN Verification",
            heading: "Verification failed",
            message: `${
              createAccount.message || ""
            }. Please go back and retry.`,
          });
        }
      } else {
        return ErrorScreen({
          title: "BVN Verification",
          heading: "You BVN Verification is already complete.",
          message: "Press Continue to go to Home.",
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const NIN_OTP = async (body) => {
  try {
    const { flow_token, otp } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      const sfh_access_token = await Sfh_Token();
      const reference = uuidv4();
      let createAccount = {};

      if (!user?.sfh_account?.migration_complete) {
        const resData = await fetch(`${SFH_ENDPOINT}/accounts/v2/subaccount`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            phoneNumber: `+${user.mobile}`,
            emailAddress: user.email || "getcarrotai@gmail.com",
            identityType: "NIN",
            autoSweep: false,
            externalReference: reference,
            identityNumber: user.kyc.nin.value,
            identityId: user.kyc.nin.verification_id,
            otp,
          }),
        });

        createAccount = await resData.json();

        if (createAccount?.statusCode == 200) {
          await sendToQueue(
            JSON.stringify({
              intent: accountNumberQueue,
              payload: { wa_id, createAccount, reference },
            })
          );

          return SuccessScreen({
            title: "NIN Verification",
            heading: "Verification successful.",
            message: "Your Account number has been created.",
          });
        } else {
          return ErrorScreen({
            title: "NIN Verification",
            heading: "Verification failed",
            message: `${
              createAccount.message || ""
            }. Please go back and retry.`,
          });
        }
      } else {
        return ErrorScreen({
          title: "NIN Verification",
          heading: "You NIN Verification is already complete.",
          message: "Press Continue to go to Home.",
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const Security = async (params) => {
  try {
    const { flow_token } = params;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      if (user.pin) {
        return {
          ...SCREEN_RESPONSES.SECURITY,
          data: {
            is_pin: true,
            options: [
              {
                id: "change_pin",
                title: "Transaction PIN",
                description: "Change Transaction PIN",
              },
            ],
          },
        };
      } else {
        return {
          ...SCREEN_RESPONSES.SECURITY,
        };
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const SetPin = async (body) => {
  try {
    const {
      flow_token,
      transaction_pin,
      confirm_transaction_pin,
      to_pin_wall,
      description,
      reference,
      is_kyc,
    } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    if (wa_id) {
      if (transaction_pin !== confirm_transaction_pin) {
        return {
          ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
          data: {
            show_message: true,
            message: "The PIN above and below must be the same",
          },
        };
      }

      const user = await UserModel.findOne({ mobile: wa_id });

      user.pin = transaction_pin;

      await user.save();

      if (to_pin_wall) {
        return {
          ...SCREEN_RESPONSES.PIN_WALL,
          data: {
            description,
            is_valid: true,
            reference,
          },
        };
      }

      if (is_kyc) {
        const response = await ReturnToKYC({ flow_token });
        return response;
      }

      return SuccessScreen({
        title: "Transaction PIN",
        heading: "Your transaction PIN has been set successfully",
        message: "",
      });
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ChangePin = async (body) => {
  try {
    const {
      flow_token,
      otp,
      change_pin,
      is_otp,
      transaction_pin,
      confirm_transaction_pin,
      resend_code,
      pin_id,
    } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });

      if (user.sfh_account.migration_complete) {
        if (is_otp) {
          if (!resend_code) {
            const verify = await termiiVerify({ pin: otp, pin_id });
            console.log(verify, "termii verify");

            if (verify?.verified) {
              return {
                ...SCREEN_RESPONSES.CHANGE_TRANSACTION_PIN,
                data: {
                  is_otp: false,
                  change_pin: true,
                  show_message: false,
                },
              };
            } else {
              return {
                ...SCREEN_RESPONSES.CHANGE_TRANSACTION_PIN,
                data: {
                  is_otp: true,
                  message:
                    "The code you entered is invalid. Please check and try again.",
                  show_message: true,
                },
              };
            }
          } else {
            const sendCode = await termiiOTP({ to: `+${wa_id}` });
            console.log(sendCode, "termiOTp");

            if (sendCode?.status !== "200")
              return {
                ...SCREEN_RESPONSES.CHANGE_TRANSACTION_PIN,
                data: {
                  is_otp: true,
                  change_pin: false,
                  message:
                    "Unable to send code to your phone number right now. Please try again later.",
                  show_message: true,
                },
              };

            return {
              ...SCREEN_RESPONSES.CHANGE_TRANSACTION_PIN,
              data: {
                heading: `Enter the code sent to ${user.mobile}.`,
                is_otp: true,
                change_pin: false,
                pin_id: sendCode.pin_id,
                message: ".",
                show_message: false,
              },
            };
          }
        }

        if (change_pin) {
          if (transaction_pin !== confirm_transaction_pin) {
            return {
              ...SCREEN_RESPONSES.CHANGE_TRANSACTION_PIN,
              data: {
                change_pin: true,
                message: "The PIN above and below must be the same",
                show_message: true,
                is_otp: false,
              },
            };
          }

          const user = await UserModel.findOne({ mobile: wa_id });
          user.pin = transaction_pin;
          await user.save();

          return SuccessScreen({
            title: "Transaction PIN",
            heading: "Your transaction PIN has been changed successfully.",
            message: "",
          });
        }
      } else {
        return ErrorScreen({
          message: `Please unlock Level 1 KYC with your NIN or BVN before you can change your PIN`,
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FetchDataPlans = async (body) => {
  try {
    const { flow_token, network } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    if (wa_id) {
      const networkArray = dataServices.filter((e) => e.name == network);
      return {
        ...SCREEN_RESPONSES.DATA,
        data: {
          is_loaded: true,
          bundles: DATA_PLANS.filter((e) =>
            networkArray.includes(e.service)
          ).map((e) => ({ title: e.title, metadata: e.metadata, id: e.id })),
        },
      };
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const PinWall = async (body) => {
  try {
    const { flow_token, transaction_pin, reference } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    const user = await UserModel.findOne({ mobile: wa_id });

    if (wa_id) {
      const isMatch = await bcrypt.compare(transaction_pin, user?.pin || "");
      if (isMatch) {
        const transaction = await TransactionModel.findOne({
          payment_ref: reference,
        });

        if (!transaction || transaction.status !== TRANSACTION_STATUS.PENDING)
          return {
            ...SCREEN_RESPONSES.MORE_PAYMENTS,
          };

        if (
          !user?.sfh_account?.migration_complete &&
          user.account_balance < transaction.amount
        )
          return ErrorScreen({
            title: "Transaction failed",
            heading: "Insufficient funds",
            message:
              "Please activate your account number so you can fund your account balance",
          });

        const sfh_access_token = await Sfh_Token();
        //Limit Wall
        if (transaction.amount > user?.sfh_account?.single_limit) {
          return ErrorScreen({
            title: "Action Required",
            heading: `Please unlock Level ${
              user.kyc.level + 1
            } to complete this transaction`,
            message: `The maximum one-time transaction allowed on your account is currently NGN ${AmountSeparator(
              user.sfh_account.single_limit
            )}`,
          });
        }

        if (
          user?.sfh_account?.daily_limit_count >= user?.sfh_account.daily_limit
        ) {
          return ErrorScreen({
            title: "Action Required",
            heading: `Please unlock Level ${
              user.kyc.level + 1
            } to complete this transaction`,
            message: `The daily transaction limit allowed on your account is currently NGN ${AmountSeparator(
              user.sfh_account.daily_limit
            )}. Your daily transaction limit will reset automatically by midnight.`,
          });
        }

        //End Limit Wall

        //Proccess transaction
        //AIRTIME
        if (transaction.type == TRANSACTION_TYPE.AIRTIME) {
          ProcessAirtime({
            transaction,
            user,
            sfh_access_token,
            flow_token,
          });
          /*  */
          return SuccessScreen({
            title: "Transaction",
            heading: "Your payment is in progress ....",
            message: "",
          });
          /*  */
        }

        //DATA
        if (transaction.type == TRANSACTION_TYPE.DATA) {
          ProcessData({
            transaction,
            user,
            sfh_access_token,
            flow_token,
          });

          /*  */
          return SuccessScreen({
            title: "Transaction",
            heading: "Your payment is in progress ....",
            message: "",
          });
          /*  */
        }

        //BILLS
        if (transaction.type == TRANSACTION_TYPE.BILL) {
          if (transaction.misc.meter_number) {
            ProcessPower({
              transaction,
              user,
              sfh_access_token,
              flow_token,
            });

            /*  */
            return SuccessScreen({
              title: "Transaction",
              heading: "Your payment is in progress ....",
              message: "",
            });
            /*  */
          } else {
            ProcessDSTV({
              transaction,
              user,
              sfh_access_token,
              flow_token,
            });

            /*  */
            return SuccessScreen({
              title: "Transaction",
              heading: "Your payment is in progress ....",
              message: "",
            });
            /*  */
          }
        }

        //TRANSFER
        if (transaction.type == TRANSACTION_TYPE.TRANSFER) {
          ProcessTransfer({
            transaction,
            user,
            sfh_access_token,
            flow_token,
          });

          /*  */
          return SuccessScreen({
            title: "Transaction",
            heading: "Your payment is in progress ....",
            message: "",
          });
          /*  */
        }
      } else {
        return ErrorScreen({
          title: "Transaction failed",
          heading: "Incorrect PIN",
          message:
            "The PIN you entered is incorrect. Please check and try again",
        });
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const NewPinWall = async (body) => {
  try {
    const {
      flow_token,
      transaction_pin,
      type,
      amount: amountStr,
      metadata,
    } = body;
    console.log(body);

    const { bundle, network, to } = metadata;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      //If Transaction PIN
      if (user.pin && user.sfh_account.migration_complete) {
        const isMatch = await bcrypt.compare(transaction_pin, user?.pin || "");
        if (isMatch) {
          let amount;
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

          //Get amount
          if (type == "airtime") {
            amount = parseFloat(amountStr);
          }
          if (type == "data") {
            const dataPlan = DATA_PLANS.filter((e) => e.id == bundle)[0];
            amount = parseFloat(dataPlan.amount);
          }
          if (type == "transfer") {
            amount = parseFloat(amountStr);
          }
          if (type == "dstv") {
            amount = DSTV_PLANS.filter((e) => e.id == bundle)[0].amount;
          }
          if (type == "power") {
            amount = parseFloat(amountStr);
          }

          if (amount) {
            if (amount <= fetch_account_data?.data?.accountBalance) {
              if (network == "recent") {
                if (type == "airtime") {
                  const arr_of_phone_numbers = to.split(",");
                  const total_amount = arr_of_phone_numbers.length * amount;
                  if (total_amount > fetch_account_data?.data?.accountBalance) {
                    return ErrorScreen({
                      heading: "Insufficient funds",
                      message:
                        "Your balance is too low to complete this bulk airtime purchase.",
                    });
                  }
                }
                if (type == "transfer") {
                  const arr_of_accounts = to.split(",");
                  const total_amount = arr_of_accounts.length * amount;
                  if (total_amount > fetch_account_data?.data?.accountBalance) {
                    return ErrorScreen({
                      heading: "Insufficient funds",
                      message:
                        "Your balance is too low to complete this bulk transfer.",
                    });
                  }
                }
              }

              //Start Limit Wall
              if (amount > user?.sfh_account?.single_limit) {
                return ErrorScreen({
                  title: "Action Required",
                  heading: `Please unlock Level ${
                    user.kyc.level + 1
                  } to complete this transaction`,
                  message: `The maximum one-time transaction allowed on your account is currently NGN ${AmountSeparator(
                    user.sfh_account.single_limit
                  )}`,
                });
              }

              if (
                user?.sfh_account?.daily_limit_count >=
                user?.sfh_account.daily_limit
              ) {
                return ErrorScreen({
                  title: "Action Required",
                  heading: `Please unlock Level ${
                    user.kyc.level + 1
                  } to complete this transaction`,
                  message: `The daily transaction limit allowed on your account is currently NGN ${AmountSeparator(
                    user.sfh_account.daily_limit
                  )}. Your daily transaction limit will reset automatically by midnight.`,
                });
              }
              //End Limit Wall

              sendToQueue(
                JSON.stringify({
                  intent: finishTransactionQueue,
                  payload: { ...body, amount, user },
                })
              );

              return SuccessScreen({
                title: "Transaction",
                heading: "Payment successful 🎉 ..",
                message: "",
              });
            } else {
              return ErrorScreen({
                heading: "Insufficient funds",
                message: "Your balance is too low.",
              });
            }
          } else {
            return ErrorScreen({
              message:
                "We're sorry 😔. An unexpected error occurred. Please go back and try again or contact support immediately.",
            });
          }
        } else {
          return ErrorScreen({
            title: "Transaction failed",
            heading: "Incorrect PIN",
            message:
              "The PIN you entered is incorrect. Please return and try again",
          });
        }
      } else {
        const response = await ReturnToKYC({ flow_token });
        return response;
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ResolveAccountDetails = async (body) => {
  try {
    const {
      flow_token,
      type,
      screen,
      to,
      bundle,
      amount,
      bank_code,
      account_number,
      network,
    } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      if (type == "data") {
        const dataPlan = DATA_PLANS.filter((e) => e.id == bundle)[0];

        let network = dataServices
          .filter((e) => e._id == dataPlan.service)[0]
          .name.toUpperCase();

        return {
          ...SCREEN_RESPONSES.PIN_WALL,
          data: {
            init_pin: "",
            tag: `${bundle} to`,
            to: `${network} ${to}`,
            is_valid: true,
            amount: `${dataPlan.amount}`,
            type: "data",
            metadata: {
              to,
              network,
              bank_code: "",
              account_number: "",
              bundle,
            },
          },
        };
      }

      if (type == "dstv") {
        const sfh_access_token = await Sfh_Token();
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
            entityNumber: body.to || "000",
          }),
        });

        resolve = await resolve.json();

        console.log(resolve);

        let amount = DSTV_PLANS.filter((e) => e.id == bundle)[0].amount;
        let bundle_title = DSTV_PLANS.filter((e) => e.id == bundle)[0].title;

        if (resolve.statusCode == 200) {
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              init_pin: "",
              tag: `${bundle_title} to`,
              to: resolve?.data?.name || "",
              is_valid: true,
              amount: `${amount}`,
              type: "dstv",
              metadata: {
                to,
                network: "",
                bank_code: "",
                account_number: "",
                bundle,
              },
            },
          };
        } else {
          return {
            ...SCREEN_RESPONSES.ZONE_B,
            data: {
              account_name_dstv: resolve?.message || "Invalid card number",
              is_loaded: true,
              account_meta_meter: "",
              account_name_meter: "",
            },
          };
        }
      }

      if (type == "power") {
        const sfh_access_token = await Sfh_Token();
        const serviceCategoryId = body.network;
        const disco_name = DISCOS.filter((e) => e._id == network)[0].name;

        //console.log(body, serviceCategoryId);

        let resolve = await fetch(`${SFH_ENDPOINT}/vas/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            serviceCategoryId,
            entityNumber: body.to,
          }),
        });

        resolve = await resolve.json();

        console.log(resolve, "resolve power");

        if (resolve?.statusCode == 200) {
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              init_pin: "",
              tag: `${disco_name} `,
              to: resolve?.data.name || "",
              is_valid: true,
              amount: `${amount}`,
              type: "power",
              metadata: {
                to,
                network,
                bank_code: "",
                account_number: "",
                bundle,
              },
            },
          };
        } else {
          return {
            ...SCREEN_RESPONSES.ZONE_B,
            data: {
              account_name_meter: resolve?.message || "Invalid meter number",
              is_loaded: true,
              account_meta_meter: "",
              account_name_dstv: "",
            },
          };
        }
      }

      if (type == "transfer") {
        const sfh_access_token = await Sfh_Token();
        console.log("i got here", body);

        let resolve = await fetch(`${SFH_ENDPOINT}/transfers/name-enquiry`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            accountNumber: body.account_number,
            bankCode: body.bank_code,
          }),
        });

        resolve = await resolve.json();

        console.log(resolve, "resolve");

        if (resolve.statusCode == 200) {
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              init_pin: "",
              tag: `Transfer ₦${AmountSeparator(amount)} to ${
                resolve.data.accountName
              }`,
              to: `${resolve.data.accountName}`,
              is_valid: true,
              amount: `${amount}`,
              type: "transfer",
              metadata: {
                to: "",
                network: "",
                bank_code,
                account_number,
                bundle: "",
              },
            },
          };
        } else {
          return {
            ...SCREEN_RESPONSES.ZONE_A,
            data: {
              account_name: resolve?.message || "Invalid account details",
              is_loaded: true,
              bundles: [],
            },
          };
        }
      }

      if (type == "print_receipt") {
        const user = await UserModel.findOne({ mobile: wa_id });

        const transaction = await TransactionModel.findOne({
          payment_ref: body.reference,
          user,
        }).populate("user");

        if (!transaction)
          return ErrorScreen({
            title: "Receipt",
            heading: "Transaction not found",
            message: "Please check the reference or session ID and try again.",
          });

        sendToQueue(
          JSON.stringify({ intent: sendReceiptQueue, payload: { transaction } })
        );

        return SuccessScreen({
          title: "Receipt",
          heading: "Your receipt will be sent to you on WhatsApp.",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({ prev_screen: screen });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ContinueToPinwall = async (body) => {
  try {
    const { type, flow_token } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);
    //
    console.log(wa_id, "wa_id", "at cont to pin");
    //
    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      const sfh_access_token = await Sfh_Token();
      let payment_ref = customId({
        name: user._id.toString(),
        email: sfh_access_token,
        randomLength: 2,
      });

      //AIRTIME
      if (type == "airtime") {
        const amount = parseFloat(body.amount);
        // const balance_before = user?.sfh_account?.migration_complete
        //   ? account_enquiry.data.accountBalance
        //   : user.account_balance;
        const balance_before = user.account_balance;
        const balance_after = balance_before - amount;

        const debit_account = user?.sfh_account?.migration_complete
          ? user.sfh_account.account_number
          : SAFE_HAVEN_MAIN_ACC;

        const serviceName = airtimeServices.filter(
          (e) => e.name == body.network
        )[0].name;

        const serviceCategoryId = airtimeServices.filter(
          (e) => e.name == body.network
        )[0]._id;

        await TransactionModel.insertMany({
          payment_ref,
          misc: {
            phone_number: body.phone_number,
            service: serviceCategoryId,
            network: serviceName,
            debit_account,
          },
          type: TRANSACTION_TYPE.AIRTIME,
          balance_before,
          balance_after,
          user,
          amount,
        });

        const pin_screen_desc = `Send ₦${AmountSeparator(
          amount
        )} Airtime to ${serviceName.toUpperCase()} ${body.phone_number}`;

        if (user.pin)
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              description: pin_screen_desc,
              is_valid: true,
              reference: payment_ref,
            },
          };
        else {
          const response = await ReturnToKYC({ flow_token });
          return response;
        }
      }

      //DATA
      if (type == "data") {
        const dataPlan = DATA_PLANS.filter((e) => e.id == body.bundle)[0];
        const serviceName = dataServices
          .filter((e) => e._id == dataPlan.service)[0]
          .name.toUpperCase();

        const amount = parseFloat(dataPlan.amount);

        // const balance_before = user?.sfh_account?.migration_complete
        //   ? account_enquiry.data.accountBalance
        //   : user.account_balance;
        const balance_before = user.account_balance;
        const balance_after = balance_before - amount;

        const debit_account = user?.sfh_account?.migration_complete
          ? user.sfh_account.account_number
          : SAFE_HAVEN_MAIN_ACC;

        await TransactionModel.insertMany({
          payment_ref,
          misc: {
            phone_number: body.phone_number,
            bundle_code: body.bundle,
            service: dataPlan.service,
            network: serviceName,
            debit_account,
          },
          type: TRANSACTION_TYPE.DATA,
          balance_before,
          balance_after,
          user,
          amount: amount,
        });

        const pin_screen_desc = `${
          dataPlan.title
        } to ${serviceName.toUpperCase()} ${body.phone_number}`;

        if (user.pin)
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              description: pin_screen_desc,
              is_valid: true,
              reference: payment_ref,
            },
          };
        else {
          return {
            ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...SCREEN_RESPONSES.SET_TRANSACTION_PIN.data,
              reference: payment_ref,
              to_pin_wall: true,
              description: pin_screen_desc,
            },
          };
        }
      }

      //DSTV
      if (type == "dstv") {
        const serviceCategoryId = "61efad38da92348f9dde5faa";
        const bundleAmount = DSTV_PLANS.filter((e) => e.id == body.bundle)[0]
          .amount;
        const bundleName = DSTV_PLANS.filter((e) => e.id == body.bundle)[0]
          .title;
        const bundleCode = DSTV_PLANS.filter((e) => e.id == body.bundle)[0].id;

        // const balance_before = user?.sfh_account?.migration_complete
        //   ? account_enquiry.data.accountBalance
        //   : user.account_balance;
        const balance_before = user.account_balance;
        const balance_after = balance_before - bundleAmount;

        const debit_account = user?.sfh_account?.migration_complete
          ? user.sfh_account.account_number
          : SAFE_HAVEN_MAIN_ACC;

        let resolve = await fetch(`${SFH_ENDPOINT}/vas/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            serviceCategoryId,
            entityNumber: body.phone_number,
          }),
        });

        resolve = await resolve.json();

        if (resolve.statusCode !== 200) {
          return ErrorScreen({
            message:
              "We're sorry 😔. An unexpected error occurred. Please go back and start try to make your bill payment again or contact support immediately.",
          });
        }

        await TransactionModel.insertMany({
          payment_ref,
          misc: {
            card_number: body.phone_number,
            card_name: resolve.data.name,
            service: serviceCategoryId,
            debit_account,
            bundle_code: bundleCode,
          },
          type: TRANSACTION_TYPE.BILL,
          balance_before,
          balance_after,
          user,
          amount: bundleAmount,
        });

        const pin_screen_desc = `${bundleName} to DSTV ${resolve.data.name}`;
        if (user.pin)
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              description: pin_screen_desc,
              is_valid: true,
              reference: payment_ref,
            },
          };
        else {
          return {
            ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...SCREEN_RESPONSES.SET_TRANSACTION_PIN.data,
              reference: payment_ref,
              to_pin_wall: true,
              description: pin_screen_desc,
            },
          };
        }
      }

      //POWER
      if (type == "power") {
        const serviceCategoryId = DISCOS.filter((e) => e._id == body.disco)[0]
          ._id;

        const serviceName = DISCOS.filter((e) => e._id == body.disco)[0].name;

        const amount = parseFloat(body.amount);
        const balance_before = user.account_balance;
        const balance_after = balance_before - amount;

        const debit_account = user?.sfh_account?.migration_complete
          ? user.sfh_account.account_number
          : SAFE_HAVEN_MAIN_ACC;

        let resolve = await fetch(`${SFH_ENDPOINT}/vas/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            serviceCategoryId,
            entityNumber: body.phone_number,
          }),
        });

        resolve = await resolve.json();

        if (resolve.statusCode !== 200)
          return ErrorScreen({
            message:
              "We're sorry 😔. An unexpected error occurred. Please go back and start try to make your bill payment again or contact support immediately.",
          });

        await TransactionModel.insertMany({
          payment_ref,
          misc: {
            meter_number: resolve.data.meterNo,
            meter_name: resolve.data.name,
            address: resolve.data.address,
            vend_type: resolve.data.vendType,
            service: serviceCategoryId,
            disco: serviceName,
            debit_account,
          },
          type: TRANSACTION_TYPE.BILL,
          balance_before,
          balance_after,
          user,
          amount,
        });

        const pin_screen_desc = `Send ₦${AmountSeparator(
          amount
        )} to ${serviceName} ${resolve.data.name}`;

        if (user.pin)
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              description: pin_screen_desc,
              is_valid: true,
              reference: payment_ref,
            },
          };
        else {
          return {
            ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...SCREEN_RESPONSES.SET_TRANSACTION_PIN.data,
              reference: payment_ref,
              to_pin_wall: true,
              description: pin_screen_desc,
            },
          };
        }
      }

      //TRANSFER
      if (type == "transfer") {
        const amount = parseFloat(body.amount);

        // const balance_before = user?.sfh_account?.migration_complete
        //   ? account_enquiry.data.accountBalance
        //   : user.account_balance;
        const balance_before = user.account_balance;
        const balance_after = balance_before - amount;

        const debit_account = user?.sfh_account?.migration_complete
          ? user.sfh_account.account_number
          : SAFE_HAVEN_MAIN_ACC;

        let resolve = await fetch(`${SFH_ENDPOINT}/transfers/name-enquiry`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfh_access_token}`,
            "Content-Type": "application/json",
            ClientID: SFH_CLIENT_ID,
          },
          body: JSON.stringify({
            accountNumber: body.account_number,
            bankCode: body.bank_code,
          }),
        });

        resolve = await resolve.json();

        if (resolve.statusCode !== 200)
          return ErrorScreen({
            message:
              "We're sorry 😔. An unexpected error occurred. Please go back to make your transfer again or contact support immediately.",
          });

        await TransactionModel.insertMany({
          payment_ref,
          misc: {
            name_enquiry: resolve.data.sessionId,
            account_name: resolve.data.accountName,
            account_number: resolve.data.accountNumber,
            bank_code: resolve.data.bankCode,
            debit_account,
          },
          type: TRANSACTION_TYPE.TRANSFER,
          balance_before,
          balance_after,
          user,
          amount,
        });

        const pin_screen_desc = `Send ₦${AmountSeparator(amount)} to ${
          resolve.data.accountName
        }`;

        if (user.pin)
          return {
            ...SCREEN_RESPONSES.PIN_WALL,
            data: {
              description: pin_screen_desc,
              is_valid: true,
              reference: payment_ref,
            },
          };
        else {
          return {
            ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...SCREEN_RESPONSES.SET_TRANSACTION_PIN.data,
              reference: payment_ref,
              to_pin_wall: true,
              description: pin_screen_desc,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    console.log(error, "comtinue to PIN");
    return ErrorScreen({ message: `${error}` });
  }
};

export const ContinueToChat = async (body) => {
  try {
    const { flow_token, comment } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    const ticket = customId({
      name: "123456",
      email: "78910",
      randomLength: 2,
    });

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      const chat_flow_token = uuidv4();
      const support_lines = ["2348148026795"];

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

      // await axios({
      //   method: "POST",
      //   url: `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
      //   headers: {
      //     Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      //   },
      //   data: {
      //     messaging_product: "whatsapp",
      //     recipient_type: "individual",
      //     to: support_lines[0], //To Customer support person WA
      //     type: "template",
      //     template: {
      //       name: "carrot_chat_support",
      //       language: {
      //         code: "en",
      //       },
      //       components: [
      //         {
      //           type: "header",
      //           parameters: [
      //             {
      //               type: "image",
      //               image: {
      //                 link: "https://figoassets.s3.us-east-1.amazonaws.com/support-david-1745503906292", //Customer support person photo
      //               },
      //             },
      //           ],
      //         },
      //         {
      //           type: "body",
      //           parameters: [
      //             {
      //               type: "text",
      //               text: `${ticket}`, //failed reason
      //             },
      //           ],
      //         },
      //         {
      //           type: "button",
      //           sub_type: "flow",
      //           index: "0",
      //           parameters: [
      //             {
      //               type: "action",
      //               action: {
      //                 flow_token,
      //                 flow_action_data: {
      //                   ...CHAT_RESPONSES.CHAT_SUPPORT.data,
      //                   ticket,
      //                   field1_author: `**${user.mobile}**`,
      //                   field1_date: `**${dayjs()
      //                     .add(1, "hour")
      //                     .format("MMM DD, YYYY. h:mm a")}**`,
      //                   field1_comment: comment,
      //                   field1_visible: true,
      //                 },
      //               },
      //             },
      //           ],
      //         },
      //       ],
      //     },
      //   },
      // });

      return SuccessScreen({
        title: "Chat Support",
        heading:
          "We've received your message and we'll get in touch in a few minutes.",
        message: "",
      });
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ContinueToChatDemo = async (body) => {
  try {
    const { wa_idArr } = body;
    // const wa_id = "2347075715049";
    let comment = "-";

    wa_idArr.forEach(async (wa_id) => {
      const ticket = customId({
        name: "123456",
        email: "78910",
        randomLength: 2,
      });
      const user = await UserModel.findOne({ mobile: wa_id });
      const chat_flow_token = uuidv4();
      const support_lines = ["2348148026795"];

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
          type: "template",
          template: {
            name: "carrot_chat_support",
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
                      link: "https://figoassets.s3.us-east-1.amazonaws.com/support-david-1745503906292", //Customer support person photo
                    },
                  },
                ],
              },
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: `${ticket}`,
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
                      flow_token: chat_flow_token,
                      flow_action_data: {
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
                ],
              },
            ],
          },
        },
      });
    });

    return SuccessScreen({
      title: "Chat Support",
      heading:
        "We've received your message and we'll get in touch in a few minutes.",
      message: "",
    });
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ChatSupport = async (body) => {
  try {
    const { type, comment, ticket, flow_token } = body;
    const wa_id = await redisClient.get(`chat_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      let result = {};
      const support_lines = ["2348148026795"];

      if (type == "send_reply") {
        let Location;
        if (body.image) {
          const image = body.image[0];
          const decryptedMedia = await processEncryptedMedia({
            encryptionKey: image.encryption_metadata.encryption_key,
            hmacKey: image.encryption_metadata.hmac_key,
            iv: image.encryption_metadata.iv,
            expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
            expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
            imageUrl: image.cdn_url,
            fileName: image.file_name,
          });

          Location = await UploadToAWS({
            Body: decryptedMedia,
            ContentType: "application/octet-stream",
            Key: image.file_name,
          });
        }

        //Insert
        await ChatSupportModel.insertMany({
          author: wa_id,
          comment: Location
            ? `${comment}. [See attachment](${Location})`
            : comment,
          ticket,
          user,
          read: support_lines.includes(wa_id) ? false : true,
          documents: [Location],
        });

        //Fetch
        const allChats = await ChatSupportModel.find({ ticket })
          .sort({
            createdAt: -1,
          })
          .populate("user");

        if (allChats.length > 0)
          // Use a loop to map the values dynamically
          allChats.forEach((item, index) => {
            result[`field${index + 1}_author`] =
              item.author == wa_id
                ? "**You**"
                : support_lines.includes(item.user.mobile)
                ? "**David PF.**"
                : `**${item.user.mobile}**`;
            result[`field${index + 1}_comment`] = item.comment;
            result[`field${index + 1}_visible`] = true;
            result[`field${index + 1}_date`] = `**${dayjs(item.createdAt)
              .add(1, "hour")
              .format("MMM DD YYYY. h:mm a")}**`;
          });

        return {
          screen: "CHAT_SUPPORT",
          data: { ...result, ticket },
        };
      }

      //Refresh button effect for users
      if (!support_lines.includes(wa_id)) {
        await ChatSupportModel.updateMany({ ticket }, { $set: { read: true } });
      }

      //Fetch
      const allChats = await ChatSupportModel.find({ ticket })
        .sort({
          createdAt: -1,
        })
        .populate("user");

      // Use a loop to map the values dynamically
      if (allChats.length > 0)
        allChats.forEach((item, index) => {
          result[`field${index + 1}_author`] =
            item.author == wa_id
              ? "**You**"
              : support_lines.includes(item.user.mobile)
              ? "**David PF.**"
              : `**${item.user.mobile}**`;
          result[`field${index + 1}_comment`] = item.comment;
          result[`field${index + 1}_visible`] = true;
          result[`field${index + 1}_date`] = `**${dayjs(item.createdAt)
            .add(1, "hour")
            .format("MMM DD YYYY. h:mm a")}**`;
        });

      return {
        screen: "CHAT_SUPPORT",
        data: { ...result, ticket },
      };
    } else {
      return {
        ...CHAT_RESPONSES.CHAT_SUPPORT,
      };
    }
  } catch (error) {}
};

export const ChatSupportDemo = async (body) => {
  try {
    const { comment, ticket: ticketArr } = body;
    const wa_id = "2348148026795";

    if (wa_id) {
      ticketArr.forEach(async (ticket) => {
        const user = await UserModel.findOne({ mobile: wa_id });
        let result = {};
        const support_lines = ["2348148026795"];

        let Location;
        if (body.image) {
          const image = body.image[0];
          const decryptedMedia = await processEncryptedMedia({
            encryptionKey: image.encryption_metadata.encryption_key,
            hmacKey: image.encryption_metadata.hmac_key,
            iv: image.encryption_metadata.iv,
            expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
            expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
            imageUrl: image.cdn_url,
            fileName: image.file_name,
          });

          Location = await UploadToAWS({
            Body: decryptedMedia,
            ContentType: "application/octet-stream",
            Key: image.file_name,
          });
        }

        //Insert
        await ChatSupportModel.insertMany({
          author: wa_id,
          comment: Location
            ? `${comment}. [See attachment](${Location})`
            : comment,
          ticket,
          user,
          read: support_lines.includes(wa_id) ? false : true,
          documents: [Location],
        });

        //Fetch
        const allChats = await ChatSupportModel.find({ ticket })
          .sort({
            createdAt: -1,
          })
          .populate("user");

        if (allChats.length > 0)
          // Use a loop to map the values dynamically
          allChats.forEach((item, index) => {
            result[`field${index + 1}_author`] =
              item.author == wa_id
                ? "**You**"
                : support_lines.includes(item.user.mobile)
                ? "**David PF.**"
                : `**${item.user.mobile}**`;
            result[`field${index + 1}_comment`] = item.comment;
            result[`field${index + 1}_visible`] = true;
            result[`field${index + 1}_date`] = `**${dayjs(item.createdAt)
              .add(1, "hour")
              .format("MMM DD YYYY. h:mm a")}**`;
          });

        return {
          screen: "CHAT_SUPPORT",
          data: { ...result, ticket },
        };
      });
    } else {
      return {
        ...CHAT_RESPONSES.CHAT_SUPPORT,
      };
    }
  } catch (error) {}
};

const LimitsWall = async ({ user, amount }) => {
  if (amount > user?.sfh_account?.single_limit) {
    return ErrorScreen({
      title: "Action Required",
      heading: `Please unlock Level ${
        user.kyc.level + 1
      } to complete this transaction`,
      message: `The maximum one-time transaction allowed on your account is currently NGN${AmountSeparator(
        user.sfh_account.single_limit
      )}`,
    });
  }
  if (user?.sfh_account?.daily_limit_count >= user?.sfh_account.daily_limit) {
    return ErrorScreen({
      title: "Action Required",
      heading: `Please unlock Level ${
        user.kyc.level + 1
      } to complete this transaction`,
      message: `The daily transaction limit allowed on your account is currently NGN${AmountSeparator(
        user.sfh_account.daily_limit
      )}}. Your daily transaction limit will reset automatically tomorrow `,
    });
  }
};

const ProcessAirtime = async ({ transaction, sfh_access_token, user }) => {
  let buy = await fetch(`${SFH_ENDPOINT}/vas/pay/airtime`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sfh_access_token}`,
      "Content-Type": "application/json",
      ClientID: SFH_CLIENT_ID,
    },
    body: JSON.stringify({
      serviceCategoryId: transaction.misc.service,
      channel: "WEB",
      debitAccountNumber: transaction.misc.debit_account,
      phoneNumber: transaction.misc.phone_number,
      amount: transaction.amount,
    }),
  });

  buy = await buy.json();

  if (buy?.data?.status == "successful") {
    // Send message to queue
    // RMQChannelFinishTransaction.sendToQueue(
    //   finishTransactionQueue,
    //   Buffer.from(
    //     JSON.stringify({
    //       user,
    //       transaction,
    //       description: `Airtime to ${transaction.misc?.phone_number || ""}`,
    //       type: "airtime",
    //       buy,
    //     })
    //   ),
    //   {
    //     contentType: "application/json",
    //   }
    // );
    // return SuccessScreen({
    //   title: "Transaction successful",
    //   heading: "Airtime purchase successful",
    //   message: "",
    // });
  } else {
    if (computeLastSeen(user.last_seen)) {
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
          type: "text",
          text: {
            body: `*Payment failed - Airtime to ${transaction.misc?.network.toUpperCase()} ${
              transaction.misc?.phone_number
            }*`,
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
                    text: ` - Airtime to ${transaction.misc?.network.toUpperCase()} ${
                      transaction.misc?.phone_number
                    }`, //failed reason
                  },
                ],
              },
            ],
          },
        },
      });
    }
    // return ErrorScreen({
    //   title: "Transaction failed",
    //   heading: "Airtime purchase failed",
    //   message: buy?.message || "",
    // });
  }
};

const ProcessDSTV = async ({ transaction, sfh_access_token, user }) => {
  let buy = await fetch(`${SFH_ENDPOINT}/vas/pay/cable-tv`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sfh_access_token}`,
      "Content-Type": "application/json",
      ClientID: SFH_CLIENT_ID,
    },
    body: JSON.stringify({
      channel: "WEB",
      debitAccountNumber: transaction.misc.debit_account,
      phoneNumber: transaction.misc.phone_number,
      serviceCategoryId: transaction.misc.service,
      bundleCode: transaction.misc.bundle_code,
      cardNumber: transaction.misc.card_number,
      amount: transaction.amount,
    }),
  });

  buy = await buy.json();

  if (buy?.data?.status == "successful") {
    // Send message to queue
    // RMQChannelFinishTransaction.sendToQueue(
    //   finishTransactionQueue,
    //   Buffer.from(
    //     JSON.stringify({
    //       user,
    //       transaction,
    //       description: `DSTV ${transaction.misc?.bundle_code || ""} - ${
    //         transaction.misc?.card_number || ""
    //       }`,
    //       type: "dstv",
    //       buy,
    //     })
    //   ),
    //   {
    //     contentType: "application/json",
    //   }
    // );
  } else {
    if (computeLastSeen(user.last_seen)) {
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
          type: "text",
          text: {
            body: `*Payment failed - DSTV ${transaction.misc?.card_number}*`,
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
                    text: ` - DSTV ${transaction.misc?.card_number}`, //failed reason
                  },
                ],
              },
            ],
          },
        },
      });
    }
  }
};

const ProcessData = async ({ transaction, sfh_access_token, user }) => {
  let buy = await fetch(`${SFH_ENDPOINT}/vas/pay/data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sfh_access_token}`,
      "Content-Type": "application/json",
      ClientID: SFH_CLIENT_ID,
    },
    body: JSON.stringify({
      channel: "WEB",
      debitAccountNumber: transaction.misc.debit_account,
      phoneNumber: transaction.misc.phone_number,
      serviceCategoryId: transaction.misc.service,
      bundleCode: transaction.misc.bundle_code,
      amount: transaction.amount,
    }),
  });

  buy = await buy.json();

  if (buy?.data?.status == "successful") {
    // Send message to queue
    // RMQChannelFinishTransaction.sendToQueue(
    //   finishTransactionQueue,
    //   Buffer.from(
    //     JSON.stringify({
    //       user,
    //       transaction,
    //       description: `${transaction.misc.bundle_code} - ${
    //         transaction.misc?.phone_number || ""
    //       }`,
    //       type: "data",
    //       buy,
    //     })
    //   ),
    //   {
    //     contentType: "application/json",
    //   }
    // );
  } else {
    if (computeLastSeen(user.last_seen)) {
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
          type: "text",
          text: {
            body: `*Payment failed - ${transaction.misc?.bundle_code} to ${transaction.misc?.phone_number}*`,
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
                    text: ` - ${transaction.misc?.bundle_code} to ${transaction.misc?.phone_number}`, //failed reason
                  },
                ],
              },
            ],
          },
        },
      });
    }
  }
};

const ProcessPower = async ({ transaction, sfh_access_token, user }) => {
  let buy = await fetch(`${SFH_ENDPOINT}/vas/pay/utility`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sfh_access_token}`,
      "Content-Type": "application/json",
      ClientID: SFH_CLIENT_ID,
    },
    body: JSON.stringify({
      channel: "WEB",
      debitAccountNumber: transaction.misc.debit_account,
      serviceCategoryId: transaction.misc.service,
      amount: transaction.amount,
      meterNumber: transaction.misc.meter_number,
      vendType: transaction.misc.vend_type,
    }),
  });

  buy = await buy.json();
  faile;

  if (buy?.data?.status == "successful") {
    // Send message to queue
    // RMQChannelFinishTransaction.sendToQueue(
    //   finishTransactionQueue,
    //   Buffer.from(
    //     JSON.stringify({
    //       user,
    //       transaction,
    //       //utilityToken: buy.data.utilityToken,
    //       description: `${transaction.misc.disco} ${
    //         transaction.misc?.meter_number || ""
    //       }`,
    //       type: "power",
    //       buy,
    //     })
    //   ),
    //   {
    //     contentType: "application/json",
    //   }
    // );
  } else {
    if (computeLastSeen(user.last_seen)) {
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
          type: "text",
          text: {
            body: `*Payment failed - ${transaction.misc?.disco} ${transaction.misc?.meter_number}*`,
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
                    text: ` - ${transaction.misc?.disco} ${transaction.misc?.meter_number}`, //failed reason
                  },
                ],
              },
            ],
          },
        },
      });
    }
  }
};

const ProcessTransfer = async ({ transaction, sfh_access_token, user }) => {
  let buy = await fetch(`${SFH_ENDPOINT}/transfers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sfh_access_token}`,
      "Content-Type": "application/json",
      ClientID: SFH_CLIENT_ID,
    },
    body: JSON.stringify({
      debitAccountNumber: transaction.misc.debit_account,
      amount: transaction.amount,
      nameEnquiryReference: transaction.misc.name_enquiry,
      beneficiaryBankCode: transaction.misc.bank_code,
      beneficiaryAccountNumber: transaction.misc.account_number,
      saveBeneficiary: true,
    }),
  });

  buy = await buy.json();

  if (buy?.statusCode == 200) {
    // Send message to queue
    // RMQChannelFinishTransaction.sendToQueue(
    //   finishTransactionQueue,
    //   Buffer.from(
    //     JSON.stringify({
    //       user,
    //       transaction,
    //       description: `Transfer to ${transaction.misc?.account_name || ""}`,
    //       type: "transfer",
    //       buy,
    //     })
    //   ),
    //   {
    //     contentType: "application/json",
    //   }
    // );
    // return SuccessScreen({
    //   title: "Transfer",
    //   heading: "Transfer completed successfully",
    //   message: `Session ID - ${buy?.data?.sessionId || ""}`,
    // });
  } else {
    if (computeLastSeen(user.last_seen)) {
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
          type: "text",
          text: {
            body: `*Payment failed - Transfer to ${
              transaction.misc?.account_name || ""
            }*`,
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
                    text: ` -  Transfer to ${
                      transaction.misc?.account_name || ""
                    }`, //failed reason
                  },
                ],
              },
            ],
          },
        },
      });
    }
  }
};

export const InwardTransferWebhook = async (data) => {
  try {
    const {
      client,
      queued,
      type,
      status,
      creditAccountNumber,
      creditAccountName,
      //debitAccountNumber,
      //debitAccountName,
      narration,
      amount,
      isReversed,
      sessionId,
      fees,
      createdAt,
      provider,
      providerChannel,
    } = data;
    console.log(data, SAFE_HAVEN_CLIENT_ID, SFH_ENDPOINT);
    if (client == SAFE_HAVEN_CLIENT_ID)
      if (!queued)
        if (!isReversed)
          if (type == "Inwards")
            if (status == "Completed") {
              const user = await UserModel.findOne({
                "sfh_account.account_number": creditAccountNumber,
              });

              if (!user) return;
              let debitAccountNumber = data.debitAccountNumber;
              let debitAccountName = data.debitAccountName;

              const sfh_access_token = await Sfh_Token();
              if (mongoose.Types.ObjectId.isValid(narration)) {
                const saved = await TransactionModel.findOne({
                  _id: narration,
                });
                if (saved) {
                  const debit_account = await UserModel.findOne({
                    "sfh_account.account_number": saved.misc.debit_account,
                  });
                  debitAccountNumber = debit_account.sfh_account.account_number;
                  debitAccountName = debit_account.sfh_account.account_name;
                }
              }

              const transaction = new mongoose.Types.ObjectId();
              const description = `Deposit from ${debitAccountName}`;

              await TransactionModel.insertMany({
                _id: transaction,
                status: TRANSACTION_STATUS.SUCCESS,
                type: TRANSACTION_TYPE.DEPOSIT,
                payment_ref: sessionId,
                amount,
                fee: fees,
                description,
                user,
                balance_before: 0,
                balance_after: 0,
                misc: {
                  account_name: debitAccountName,
                  account_number: debitAccountNumber,
                },
              });

              let statement_data = await fetch(
                `${SFH_ENDPOINT}/accounts/${user.sfh_account._id}/statement?page=0&limit=25`,
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

              console.log(statement_data, "statement data");

              let matched = statement_data.data.filter(
                (e) => e.paymentReference == sessionId
              );

              matched.forEach(async (e) => {
                let balanceAfter = e.runningBalance;
                let sfh_amount = e.amount;
                let balanceBefore =
                  e.type == "Credit"
                    ? balanceAfter - sfh_amount
                    : balanceAfter + sfh_amount;

                await BalanceHistoryModel.insertMany({
                  user: user,
                  balanceBefore: balanceBefore,
                  balanceAfter: balanceAfter,
                  type:
                    e.type == "Credit"
                      ? HISTORY_TYPE.CREDIT
                      : HISTORY_TYPE.DEBIT,
                  transaction: transaction,
                  description,
                });
              });

              //Reimburse
              let get_transfers = await fetch(
                `${SFH_ENDPOINT}/transfers?accountId=${user.sfh_account._id}&page=0&limit=50&type=Inwards`,
                {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${sfh_access_token}`,
                    "Content-Type": "application/json",
                    ClientID: SFH_CLIENT_ID,
                  },
                }
              );

              get_transfers = await get_transfers.json();
              console.log(get_transfers);
              get_transfers = get_transfers.data;

              const single_transfer = get_transfers.filter(
                (e) => e.sessionId == sessionId
              )[0];

              let total_fees = 0;
              total_fees =
                single_transfer.fees +
                single_transfer.vat +
                single_transfer.stampDuty;

              if (total_fees > 0) {
                let resolve = await fetch(
                  `${SFH_ENDPOINT}/transfers/name-enquiry`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${sfh_access_token}`,
                      "Content-Type": "application/json",
                      ClientID: SFH_CLIENT_ID,
                    },
                    body: JSON.stringify({
                      accountNumber: creditAccountNumber,
                      bankCode: "090286",
                    }),
                  }
                );

                resolve = await resolve.json();

                let reimburse = await fetch(`${SFH_ENDPOINT}/transfers`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${sfh_access_token}`,
                    "Content-Type": "application/json",
                    ClientID: SFH_CLIENT_ID,
                  },
                  body: JSON.stringify({
                    debitAccountNumber: SAFE_HAVEN_REIMBURSE_ACC,
                    amount: total_fees,
                    nameEnquiryReference: resolve.data.sessionId,
                    beneficiaryBankCode: resolve.data.bankCode,
                    beneficiaryAccountNumber: resolve.data.accountNumber,
                    saveBeneficiary: true,
                  }),
                });

                console.log("Reimburse Done Inwards", reimburse);
              }

              let text_to_image = await fetch(
                `${CANVAS_SERVICE_URL}/text-image`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    text: `₦${amount}`,
                    receipt: true,
                  }),
                }
              );

              //console.log("spot 3");

              text_to_image = await text_to_image.json();
              //console.log(text_to_image, "text_to_image");

              let banner = await UploadToAWS({
                Body: Buffer.from(text_to_image.buffer, "base64"),
                Key: `${new Date().getTime()}`,
                ContentType: "image/png",
              });

              console.log(banner, "banner");

              // let flowBody = `*Deposit from ${debitAccountName}*`;

              // let flowFooter = "*Credit*";

              let flow_token = uuidv4();

              await redisClient.set(
                `view_receipt_flow_token_${flow_token}`,
                user.mobile
              );

              let flowData = {
                title: "Receipt",
                reference: sessionId,
                field1_key: "Type",
                field1_value: "Deposit",
                field2_key: "Reference or Session ID",
                field2_value: sessionId,
                field3_key: "Amount",
                field3_value: `NGN ${AmountSeparator(amount)}`,
                field4_key: "Description",
                field4_value: narration,
                field5_key: "Sender name",
                field5_value: debitAccountName,
                field6_key: "Sender account",
                field6_value: maskString(debitAccountNumber),
                field7_key: "Beneficiary name",
                field7_value: creditAccountName,
                field8_key: "Beneficiary account",
                field8_value: maskString(creditAccountNumber),
                field9_key: "Transaction Date",
                field9_value: dayjs(createdAt)
                  .add(1, "hour")
                  .format("ddd, MMM DD, YYYY. h:mm a"),
                field10_key: "Status",
                field10_value: "Successful",
              };

              sendToQueue(
                JSON.stringify({
                  intent: accountDataQueue,
                  payload: { wa_id: user.mobile },
                })
              );

              if (
                debitAccountNumber == SAFE_HAVEN_REIMBURSE_ACC &&
                provider == "BANK" &&
                providerChannel == "TRANSFER"
              )
                return;
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
                    name: "deposit_alert",
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
                        type: "body",
                        parameters: [
                          {
                            type: "text",
                            text: debitAccountName,
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
                              flow_token,
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
    console.log(
      error,
      error.response?.data?.error?.error_data,
      "Error occurred at InwardTransferWebhook"
    );
  }
};

export const AccountDebit = async (data) => {
  try {
    const {
      client,
      account,
      debitAccountName,
      debitAccountNumber,
      reference,
      type,
      provider,
      providerChannel,
      narration,
      //amount: 496
      amount,
      //fees: 0
      fees,
      createdAt,
    } = data;
    if (client == SAFE_HAVEN_CLIENT_ID)
      if (type == "Debit") {
        const user = await UserModel.findOne({
          "sfh_account.account_number": debitAccountNumber,
        });
        const sfh_access_token = await Sfh_Token();
        const transaction = new mongoose.Types.ObjectId();
        const description = `${narration}`;

        await TransactionModel.updateMany({
          _id: transaction,
          status: TRANSACTION_STATUS.SUCCESS,
          type: TRANSACTION_TYPE.DEPOSIT,
          payment_ref: sessionId,
          amount,
          fee: fees,
          description,
          user,
          balance_before: 0,
          balance_after: 0,
          misc: {
            account_name: debitAccountName,
            account_number: debitAccountNumber,
          },
        });

        let statement_data = await fetch(
          `${SFH_ENDPOINT}/accounts/${user.sfh_account._id}/statement?page=0&limit=25`,
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

        let matched = statement_data.data.filter(
          (e) => e.paymentReference == sessionId
        );

        matched.forEach(async (e) => {
          let balanceAfter = e.runningBalance;
          let sfh_amount = e.amount;
          let balanceBefore =
            e.type == "Credit"
              ? balanceAfter - sfh_amount
              : balanceAfter + sfh_amount;

          await BalanceHistoryModel.insertMany({
            user: user,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            type: e.type == "Credit" ? HISTORY_TYPE.CREDIT : HISTORY_TYPE.DEBIT,
            transaction: transaction,
            description,
          });
        });

        let text_to_image = await fetch(`${CANVAS_SERVICE_URL}/text-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: `₦${amount}`,
          }),
        });

        //console.log("spot 3");

        text_to_image = await text_to_image.json();
        //console.log(text_to_image, "text_to_image");

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

        let flowBody = `*Deposit from ${debitAccountName}*`;

        let flowFooter = "*Credit*";

        let flow_token = uuidv4();

        await redisClient.set(
          `view_receipt_flow_token_${flow_token}`,
          user.mobile
        );

        let flowData = {
          title: "Receipt",
          reference: sessionId,
          field1_key: "Type",
          field1_value: "Deposit",
          field2_key: "Reference or Session ID",
          field2_value: sessionId,
          field3_key: "Amount",
          field3_value: `NGN ${AmountSeparator(amount)}`,
          field4_key: "Description",
          field4_value: narration,
          field5_key: "Sender name",
          field5_value: debitAccountName,
          field6_key: "Sender account",
          field6_value: maskString(debitAccountNumber),
          field7_key: "Beneficiary name",
          field7_value: creditAccountName,
          field8_key: "Beneficiary account",
          field8_value: maskString(creditAccountNumber),
          field9_key: "Transaction Date",
          field9_value: dayjs(createdAt)
            .add(1, "hour")
            .format("ddd, MMM DD, YYYY. h:mm a"),
          field10_key: "Status",
          field10_value: "Successful",
        };

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
                    flow_token,
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
                name: "deposit_alert",
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
                          link:
                            banner || "https://i.ibb.co/k0y6hBM/Frame-5-6.png",
                        },
                      },
                    ],
                  },
                  {
                    type: "body",
                    parameters: [
                      {
                        type: "text",
                        text: debitAccountName,
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
                          flow_token,
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
      }
  } catch (error) {
    console.log(
      error.response?.data?.error?.error_data,
      "Error occurred at InwardTransferWebhook"
    );
  }
};

export const PrintReceipt = async (body) => {
  try {
    const { flow_token, reference } = body;
    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      const transaction = await TransactionModel.findOne({
        payment_ref: reference,
        user,
      }).populate("user");

      if (!transaction)
        return ErrorScreen({
          title: "Receipt",
          heading: "Transaction not found",
          message: "Please check the reference or session ID and try again.",
        });

      await sendToQueue(
        JSON.stringify({ intent: sendReceiptQueue, payload: { transaction } })
      );

      return SuccessScreen({
        title: "Receipt",
        heading: "Your receipt will be sent to you on WhatsApp.",
        message: "",
      });
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const ViewReceipt = async (body) => {
  try {
    const { reference, flow_token } = body;

    const wa_id = await redisClient.get(
      `view_receipt_flow_token_${flow_token}`
    );

    console.log(reference, "print receipt ref", wa_id);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });

      const transaction = await TransactionModel.findOne({
        payment_ref: reference,
        user,
      }).populate("user");

      if (!user || !transaction)
        return {
          screen: "COMPLETE",
          data: {},
        };

      // Send message to queue

      await sendToQueue(
        JSON.stringify({ intent: sendReceiptQueue, payload: { transaction } })
      );

      if (new Date(transaction.createdAt).getTime() < 1738429200000)
        return {
          screen: "SUCCESS",
          data: {},
        };
      else {
        return {
          screen: "SUCCESS_PAGE",
          data: {},
        };
      }
    } else {
      return {
        screen: "COMPLETE",
      };
    }
  } catch (error) {
    console.log({ message: `${error}` }, "at view receipt");
  }
};

export const Recent = async (body) => {
  try {
    const { flow_token, type } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      const user = await UserModel.findOne({ mobile: wa_id });
      let recent;

      if (type == "airtime") {
        const transactions = await TransactionModel.find({
          type: TRANSACTION_TYPE.AIRTIME,
          user,
          status: TRANSACTION_STATUS.SUCCESS,
        }).populate("user");

        console.log(transactions);

        if (transactions.length > 1) {
          recent = transactions.map((e) => {
            return { id: e.misc.phone_number, title: e.misc.phone_number };
          });

          recent = recent.filter((e) => !!e.id);

          const uniqueVal = recent.filter(
            (value, index, self) =>
              index === self.findIndex((t) => t.title === value.title)
          );

          let recent_data = uniqueVal.slice(-10).reverse();

          if (recent_data.length <= 1) {
            return {
              ...SCREEN_RESPONSES.ZONE_A,
              data: {
                bundles: [],
                is_loaded: true,
                account_name: "",
              },
            };
          }

          return {
            ...SCREEN_RESPONSES.RECENT_AIRTIME,
            data: {
              recent_data,
            },
          };
        } else {
          return {
            ...SCREEN_RESPONSES.ZONE_A,
            data: {
              bundles: [],
              is_loaded: false,
              account_name: "",
            },
          };
        }
      }

      if (type == "transfer") {
        const transactions = await TransactionModel.find({
          type: TRANSACTION_TYPE.TRANSFER,
          user,
          status: TRANSACTION_STATUS.SUCCESS,
        }).populate("user");

        console.log(transactions);

        if (transactions.length > 1) {
          recent = transactions.map((e) => {
            return {
              id: e._id,
              title: e.misc.account_name,
              metadata: e.misc.bank_code,
            };
          });

          recent = recent.filter((e) => !!e.title);

          const uniqueVal = recent.filter(
            (value, index, self) =>
              index ===
              self.findIndex(
                (t) => t.title === value.title && t.metadata === value.metadata
              )
          );

          let recent_data = uniqueVal
            .slice(-10)
            .reverse()
            .map((e) => {
              return { id: e.id, title: e.title };
            });

          if (recent_data.length <= 1) {
            return {
              ...SCREEN_RESPONSES.ZONE_A,
              data: {
                bundles: [],
                is_loaded: false,
                account_name: "",
              },
            };
          }

          return {
            ...SCREEN_RESPONSES.RECENT_TRANSFER,
            data: {
              recent_data: recent_data,
            },
          };
        } else {
          return {
            ...SCREEN_RESPONSES.ZONE_A,
            data: {
              bundles: [],
              is_loaded: true,
              account_name: "",
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    console.log({ message: `${error}` }, "");
  }
};

export const RecentTransfer = async (body) => {
  try {
    const { flow_token, to, amount } = body;

    const wa_id = await redisClient.get(`flow_token_${flow_token}`);

    if (wa_id) {
      let recipient = await Promise.all(
        to.map(async (e) => {
          const transaction = await TransactionModel.findOne({
            _id: e,
          }).populate("user");
          return transaction.misc.account_name; // Return the value to collect it in the array
        })
      );

      return {
        ...SCREEN_RESPONSES.PIN_WALL,
        data: {
          init_pin: "",
          tag: `Transfer to ${recipient.join(", ")} (₦${amount})`,
          to: `${recipient}`,
          amount: `${amount}`,
          is_valid: true,
          type: "transfer",
          metadata: {
            to: `${to}`,
            network: "recent",
            bank_code: "",
            account_number: "",
            bundle: "",
          },
        },
      };
    } else {
      return UpdateRequiredScreen({});
    }
  } catch (error) {
    console.log({ message: `${error}` }, "");
  }
};

export const MoringaIntroLink = async (body) => {
  try {
    const { flow_token, intro } = body;
    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      //Send to Queue

      sendToQueue(
        JSON.stringify({ intent: moringaAccountDataQueue, payload: { wa_id } })
      );

      let balance_avatar_key_usd = await redisClient.get(
        `moringa_balance_usd_${wa_id}`
      );

      let balance = balance_avatar_key_usd
        ? await FileFromAWS(balance_avatar_key_usd)
        : MORINGA_RESPONSES.HOME.data.balance;

      let moringa_usdt = await redisClient.get(`moringa_usdt_${wa_id}`);
      let moringa_usdt_usd = await redisClient.get(`moringa_usdt_usd_${wa_id}`);
      let moringa_usdc = await redisClient.get(`moringa_usdc_${wa_id}`);
      let moringa_usdc_usd = await redisClient.get(`moringa_usdc_usd_${wa_id}`);
      let moringa_ngn = await redisClient.get(`moringa_ngn_${wa_id}`);
      let moringa_ngn_usd = await redisClient.get(`moringa_ngn_usd_${wa_id}`);

      if (intro.includes("refresh")) {
        return {
          ...MORINGA_RESPONSES.HOME,
          data: {
            is_verified: true,
            balance: balance,
            intro: "Refresh balances",
            usdt: moringa_usdt || "0.00000 USDT",
            usdc: moringa_usdc || "0.00000 USDC",
            ngn: moringa_ngn || "NGN 0.00",
            usdt_usd: moringa_usdt_usd || "",
            usdc_usd: moringa_usdc_usd || "",
            ngn_usd: moringa_ngn_usd || "",
            is_refresh: true,
          },
        };
      }

      if (intro.includes("Complete")) {
        if (user?.kyc?.nin?.is_verified) {
          return {
            ...MORINGA_RESPONSES.HOME,
            data: {
              is_verified: true,
              balance: balance,
              intro: "Refresh balances",
              usdt: moringa_usdt || "0.00000 USDT",
              usdc: moringa_usdc || "0.00000 USDC",
              ngn: moringa_ngn || "NGN 0.00",
              usdt_usd: moringa_usdt_usd || "",
              usdc_usd: moringa_usdc_usd || "",
              ngn_usd: moringa_ngn_usd || "",
              is_refresh: true,
            },
          };
        } else {
          if (user.pin) {
            if (user?.kyc?.email?.is_verified) {
              return { ...MORINGA_RESPONSES.KYC };
            } else {
              return { ...MORINGA_RESPONSES.VERIFY_EMAIL };
            }
          } else {
            return {
              ...MORINGA_RESPONSES.SET_TRANSACTION_PIN,
              data: {
                ...MORINGA_RESPONSES.SET_TRANSACTION_PIN.data,
                is_kyc: true,
              },
            };
          }
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaHome = async (body) => {
  try {
    const { flow_token, type } = body;
    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      //Send to Queue

      sendToQueue(
        JSON.stringify({ intent: moringaAccountDataQueue, payload: { wa_id } })
      );

      if (type !== "settings" && !user?.kyc?.nin?.is_verified) {
        if (user.pin) {
          if (user?.kyc?.email?.is_verified) {
            return { ...MORINGA_RESPONSES.KYC };
          } else {
            return { ...MORINGA_RESPONSES.VERIFY_EMAIL };
          }
        } else {
          return {
            ...MORINGA_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...MORINGA_RESPONSES.SET_TRANSACTION_PIN.data,
              is_kyc: true,
            },
          };
        }
      }

      let balance_avatar_key_usdt = await redisClient.get(
        `moringa_balance_usdt_${wa_id}`
      );
      let balance_avatar_key_usdc = await redisClient.get(
        `moringa_balance_usdc_${wa_id}`
      );
      let balance_avatar_key_ngn = await redisClient.get(
        `moringa_balance_ngn_${wa_id}`
      );

      let moringa_usdt = "0.00000 USDT";

      moringa_usdt = await redisClient.get(`moringa_usdt_${wa_id}`);

      let moringa_usdc = "0.00000 USDC";
      moringa_usdc = await redisClient.get(`moringa_usdc_${wa_id}`);

      let moringa_ngn = "₦0.00";

      moringa_ngn = await redisClient.get(`moringa_ngn_${wa_id}`);

      if (type == "usdt") {
        const user = await MoringaUserModel.findOne({ mobile: wa_id });
        let balance_usdt = balance_avatar_key_usdt
          ? await FileFromAWS(balance_avatar_key_usdt)
          : MORINGA_RESPONSES.USDT_WALLET.data.balance;
        //[XC91920010010010010010010000000100](https://api.whatsapp.com/send?text=XC91920010010010010010010000000100)
        return {
          ...MORINGA_RESPONSES.USDT_WALLET,
          data: {
            selection: "",
            address: "",
            balance: balance_usdt,
            binance_address: user.wallet.usdt.address.binance
              ? `[🔗${user.wallet.usdt.address.binance}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.binance})`
              : "",
            polygon_address: user.wallet.usdt.address.polygon
              ? `[🔗${user.wallet.usdt.address.polygon}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.polygon})`
              : "",
            ethereum_address: user.wallet.usdt.address.ethereum
              ? `[🔗${user.wallet.usdt.address.ethereum}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.ethereum})`
              : "",
            tron_address: user.wallet.usdt.address.tron
              ? `[🔗${user.wallet.usdt.address.tron}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.tron})`
              : "",
            solana_address: user.wallet.usdt.address.solana
              ? `[🔗${user.wallet.usdt.address.solana}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.solana})`
              : "",
            optimism_address: user.wallet.usdt.address.optimism
              ? `[🔗${user.wallet.usdt.address.optimism}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.optimism})`
              : "",
            arbitrum_address: user.wallet.usdt.address.arbitrum
              ? `[🔗${user.wallet.usdt.address.arbitrum}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.arbitrum})`
              : "",
          },
        };
      }

      if (type == "usdc") {
        const user = await MoringaUserModel.findOne({ mobile: wa_id });
        let balance_usdc = balance_avatar_key_usdc
          ? await FileFromAWS(balance_avatar_key_usdc)
          : MORINGA_RESPONSES.USDC_WALLET.data.balance;

        return {
          ...MORINGA_RESPONSES.USDC_WALLET,
          data: {
            selection: "",
            address: "",
            balance: balance_usdc,
            binance_address: user.wallet.usdc.address.binance
              ? `[🔗${user.wallet.usdc.address.binance}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.binance})`
              : "-",
            polygon_address: user.wallet.usdc.address.polygon
              ? `[🔗${user.wallet.usdc.address.polygon}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.polygon})`
              : "",
            ethereum_address: user.wallet.usdc.address.ethereum
              ? `[🔗${user.wallet.usdc.address.ethereum}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.ethereum})`
              : "",
            stellar_address: user.wallet.usdc.address.stellar
              ? `[🔗${user.wallet.usdc.address.stellar}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.stellar})`
              : "",
            base_address: user.wallet.usdc.address.base
              ? `[🔗${user.wallet.usdc.address.base}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.base})`
              : "",
            solana_address: user.wallet.usdc.address.solana
              ? `[🔗${user.wallet.usdc.address.solana}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.solana})`
              : "",
            optimism_address: user.wallet.usdc.address.optimism
              ? `[🔗${user.wallet.usdc.address.optimism}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.optimism})`
              : "",
            arbitrum_address: user.wallet.usdc.address.arbitrum
              ? `[🔗${user.wallet.usdc.address.arbitrum}](https://api.whatsapp.com/send?text=${user.wallet.usdt.address.arbitrum})`
              : "",
          },
        };
      }

      if (type == "ngn") {
        let balance_ngn = balance_avatar_key_ngn
          ? await FileFromAWS(balance_avatar_key_ngn)
          : MORINGA_RESPONSES.NGN_WALLET.data.balance;
        return {
          ...MORINGA_RESPONSES.NGN_WALLET,
          data: {
            ...MORINGA_RESPONSES.NGN_WALLET.data,
            balance: balance_ngn,
          },
        };
      }

      if (type == "swap") {
        const eversend_access_token = await Eversend_Token();

        let quotation = await fetch(
          `${EVERSEND_ENDPOINT}/exchanges/quotation`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${eversend_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "USDT",
              amount: 1,
              to: "NGN", // 1495.3233107637  //1495.39372891425
            }),
          }
        );

        quotation = await quotation.json();

        console.log(quotation, "cutie");

        let rate = quotation?.data?.quotation?.rate
          ? Math.round(quotation?.data?.quotation?.rate * 100) / 100
          : 0;

        return {
          ...MORINGA_RESPONSES.SWAP,
          data: {
            usdt: moringa_usdt,
            usdc: moringa_usdc,
            ngn: moringa_ngn,
            rate,
          },
        };
      }

      if (type == "settings") {
        return {
          ...MORINGA_RESPONSES.SETTINGS,
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaResolveAccountDetails = async (body) => {
  try {
    const { flow_token, account_number, bank_code } = body;
    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);
    let amount = parseFloat(body.amount);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      if (user?.pin && user?.kyc?.nin?.is_verified) {
        const eversend_access_token = await Eversend_Token();

        let resolve = await fetch(
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

        resolve = await resolve.json();

        console.log(resolve, "resolve");

        if (resolve.code == 200) {
          return {
            ...MORINGA_RESPONSES.PIN_WALL,
            data: {
              init_pin: "",
              tag: `Transfer ₦${AmountSeparator(amount)} to ${
                resolve.data.account_name
              }`,
              is_valid: true,
              metadata: {
                amount: `${amount}`,
                type: "Transfer",
                bank_code,
                account_number,
              },
            },
          };
        } else {
          return {
            ...MORINGA_RESPONSES.NGN_WALLET,
            data: {
              ...MORINGA_RESPONSES.NGN_WALLET.data,
              is_loaded: true,
              account_name: "Invalid account details",
            },
          };
        }
      } else {
        if (user.pin) {
          if (user?.kyc?.email?.is_verified) {
            return { ...MORINGA_RESPONSES.KYC };
          } else {
            return { ...MORINGA_RESPONSES.VERIFY_EMAIL };
          }
        } else {
          return {
            ...MORINGA_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...MORINGA_RESPONSES.SET_TRANSACTION_PIN.data,
              is_kyc: true,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaSwap = async (body) => {
  try {
    const { flow_token, from, amount } = body;
    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      if (user?.pin && user?.kyc?.nin?.is_verified) {
        return {
          ...MORINGA_RESPONSES.PIN_WALL,
          data: {
            init_pin: "",
            tag: `Convert ${amount} ${from} to Naira`,
            is_valid: true,
            metadata: {
              type: "Swap",
              amount,
              bank_code: from,
              account_number: "",
            },
          },
        };
      } else {
        if (user.pin) {
          if (user?.kyc?.email?.is_verified) {
            return { ...MORINGA_RESPONSES.KYC };
          } else {
            return { ...MORINGA_RESPONSES.VERIFY_EMAIL };
          }
        } else {
          return {
            ...MORINGA_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...MORINGA_RESPONSES.SET_TRANSACTION_PIN.data,
              is_kyc: true,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaPinWall = async (body) => {
  try {
    const {
      flow_token,
      transaction_pin,
      metadata: { bank_code },
    } = body;

    let from = "NGN";
    if (bank_code == "USDT") from = "USDT";
    if (bank_code == "USDC") from = "USDC";

    let amount = parseFloat(body.metadata.amount);

    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });
      //If Transaction PIN
      if (user.pin && user.kyc.nin.is_verified) {
        const isMatch = await bcrypt.compare(transaction_pin, user?.pin || "");
        if (isMatch) {
          let wallet_balance = user?.wallet?.ngn?.balance;

          if (from == "USDT") wallet_balance = user?.wallet?.usdt?.balance;
          if (from == "USDC") wallet_balance = user?.wallet?.usdc?.balance;

          if (amount) {
            if (amount <= wallet_balance) {
              sendToQueue(
                JSON.stringify({
                  intent: moringafinishTransactionQueue,
                  payload: { ...body, user },
                })
              );

              return SuccessScreen({
                title: "Transaction",
                heading: "Transaction processed successfully 🎉 ..",
                message: "",
              });
            } else {
              return ErrorScreen({
                heading: "Insufficient balance",
                message: `Your ${from || ""} balance is too low.`,
              });
            }
          } else {
            return ErrorScreen({
              message:
                "We're sorry 😔. An unexpected error occurred. Please go back and try again or contact support immediately.",
            });
          }
        } else {
          return ErrorScreen({
            title: "Transaction failed",
            heading: "Incorrect PIN",
            message:
              "The PIN you entered is incorrect. Please return and try again",
          });
        }
      } else {
        if (user.pin) {
          if (user?.kyc?.email?.is_verified) {
            return { ...MORINGA_RESPONSES.KYC };
          } else {
            return { ...MORINGA_RESPONSES.VERIFY_EMAIL };
          }
        } else {
          return {
            ...MORINGA_RESPONSES.SET_TRANSACTION_PIN,
            data: {
              ...MORINGA_RESPONSES.SET_TRANSACTION_PIN.data,
              is_kyc: true,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaVerifyEmail = async (body) => {
  try {
    const { flow_token, email, otp, type } = body;
    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      if (type == "verify") {
        const findOtp = await MoringaEmailCodeModel.findOne({
          otp,
          user: user._id,
        });
        if (findOtp) {
          user.kyc.email.is_verified = true;
          user.kyc.email.value = email;
          await user.save();
          return {
            ...MORINGA_RESPONSES.KYC,
          };
        } else {
          return ErrorScreen({ message: `Incorrect code` });
        }
      } else {
        let otp = Math.floor(100000 + Math.random() * 900000); //generate 6 digit number
        await MoringaEmailCodeModel.insertMany({ otp: `${otp}`, user });
        //Send otp to email
        sendMail({
          fullName: `You`,
          to: email,
          subject: "Verify your email on Moringa",
          body: emailOTPTemplate(otp),
          host_name: "Moringa",
          host_email: "hello@slashit.me",
        });

        return {
          ...MORINGA_RESPONSES.VERIFY_EMAIL,
          data: {
            otp_sent: true,
            current_screen: ``,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaSecurity = async (body) => {
  try {
    const { flow_token } = body;

    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      if (user.pin) {
        let otp = Math.floor(100000 + Math.random() * 900000); //generate 6 digit number
        await MoringaEmailCodeModel.insertMany({ otp: `${otp}`, user });
        //Send otp to email
        sendMail({
          fullName: `You`,
          to: user.kyc.email.value,
          subject: "Change your Moringa PIN",
          body: emailOTPTemplate(otp),
          host_name: "Moringa",
          host_email: "hello@slashit.me",
        });

        return {
          ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN,
        };
      } else {
        return {
          ...MORINGA_RESPONSES.SET_TRANSACTION_PIN,
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaSetPin = async (body) => {
  try {
    const { flow_token, transaction_pin, is_kyc } = body;

    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });

      user.pin = transaction_pin;

      await user.save();

      if (is_kyc) {
        if (user?.kyc?.email?.is_verified) {
          return { ...MORINGA_RESPONSES.KYC };
        } else {
          return { ...MORINGA_RESPONSES.VERIFY_EMAIL };
        }
      } else {
        return SuccessScreen({
          title: "Transaction PIN",
          heading: "Your transaction PIN has been set successfully",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaChangePin = async (body) => {
  try {
    const { flow_token, transaction_pin, type, otp } = body;

    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });
      if (type == "resend_code") {
        let otp = Math.floor(100000 + Math.random() * 900000); //generate 6 digit number
        await MoringaEmailCodeModel.insertMany({ otp: `${otp}`, user });
        //Send otp to email
        sendMail({
          fullName: `You`,
          to: user.kyc.email.value,
          subject: "Moringa change PIN",
          body: emailOTPTemplate(otp),
          host_name: "Moringa",
          host_email: "hello@slashit.me",
        });
        return {
          ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN,
          data: {
            ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN.data,
            is_otp: true,
          },
        };
      }

      if (type == "verify_otp") {
        const findOtp = await MoringaEmailCodeModel.findOne({
          otp,
          user: user._id,
        });
        if (findOtp) {
          return {
            ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN,
            data: {
              ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN.data,
              is_otp: false,
            },
          };
        } else {
          return {
            ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN,
            data: {
              ...MORINGA_RESPONSES.CHANGE_TRANSACTION_PIN.data,
              message: "Incorrect OTP",
              show_message: true,
            },
          };
        }
      }

      if (type == "change_pin") {
        user.pin = transaction_pin;
        await user.save();
        return SuccessScreen({
          title: "Transaction PIN",
          heading: "Your transaction PIN has been changed successfully",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaChat = async (body) => {
  try {
    const { flow_token, comment } = body;

    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    const ticket = customId({
      name: "123456",
      email: "78910",
      randomLength: 2,
    });

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });
      const chat_flow_token = uuidv4();
      const support_lines = ["2348148026795"];

      await redisClient.set(
        `moringa_chat_flow_token_${chat_flow_token}`,
        support_lines[0]
      );

      await MoringaChatSupportModel.insertMany({
        author: wa_id,
        comment,
        ticket,
        user,
        read: true,
      });

      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v21.0/${MORINGA_WA_PHONE_NUMBER}/messages`,
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
                link: "https://figoassets.s3.us-east-1.amazonaws.com/frame-11-1745504207518", //Customer support person photo
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
                flow_id: "1865405934375288",
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

      return SuccessScreen({
        title: "Chat Support",
        heading:
          "We've received your message and we'll get in touch in a few minutes.",
        message: "",
      });
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaChatSupport = async (body) => {
  try {
    const { type, comment, ticket, flow_token } = body;
    const wa_id = await redisClient.get(
      `moringa_chat_flow_token_${flow_token}`
    );

    if (wa_id) {
      const user = await MoringaUserModel.findOne({ mobile: wa_id });
      let result = {};
      const support_lines = ["2348148026795"];

      if (type == "send_reply") {
        let Location;
        if (body.image) {
          const image = body.image[0];
          const decryptedMedia = await processEncryptedMedia({
            encryptionKey: image.encryption_metadata.encryption_key,
            hmacKey: image.encryption_metadata.hmac_key,
            iv: image.encryption_metadata.iv,
            expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
            expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
            imageUrl: image.cdn_url,
            fileName: image.file_name,
          });

          Location = await UploadToAWS({
            Body: decryptedMedia,
            ContentType: "application/octet-stream",
            Key: image.file_name,
          });
        }

        //Insert
        await MoringaChatSupportModel.insertMany({
          author: wa_id,
          comment: Location
            ? `${comment}. [See attachment](${Location})`
            : comment,
          ticket,
          user,
          read: support_lines.includes(wa_id) ? false : true,
          documents: [Location],
        });

        //Fetch
        const allChats = await MoringaChatSupportModel.find({ ticket })
          .sort({
            createdAt: -1,
          })
          .populate("user");

        if (allChats.length > 0)
          // Use a loop to map the values dynamically
          allChats.forEach((item, index) => {
            result[`field${index + 1}_author`] =
              item.author == wa_id
                ? "**You**"
                : support_lines.includes(item.user.mobile)
                ? "**David.**"
                : `**${item.user.mobile}**`;
            result[`field${index + 1}_comment`] = item.comment;
            result[`field${index + 1}_visible`] = true;
            result[`field${index + 1}_date`] = `**${dayjs(item.createdAt)
              .add(1, "hour")
              .format("MMM DD YYYY. h:mm a")}**`;
          });

        return {
          screen: "CHAT_SUPPORT",
          data: { ...result, ticket },
        };
      }

      //Refresh button effect for users
      if (!support_lines.includes(wa_id)) {
        await MoringaChatSupportModel.updateMany(
          { ticket },
          { $set: { read: true } }
        );
      }

      //Fetch
      const allChats = await MoringaChatSupportModel.find({ ticket })
        .sort({
          createdAt: -1,
        })
        .populate("user");

      // Use a loop to map the values dynamically
      if (allChats.length > 0)
        allChats.forEach((item, index) => {
          result[`field${index + 1}_author`] =
            item.author == wa_id
              ? "**You**"
              : support_lines.includes(item.user.mobile)
              ? "**David.**"
              : `**${item.user.mobile}**`;
          result[`field${index + 1}_comment`] = item.comment;
          result[`field${index + 1}_visible`] = true;
          result[`field${index + 1}_date`] = `**${dayjs(item.createdAt)
            .add(1, "hour")
            .format("MMM DD YYYY. h:mm a")}**`;
        });

      return {
        screen: "CHAT_SUPPORT",
        data: { ...result, ticket },
      };
    } else {
      return {
        ...CHAT_RESPONSES.CHAT_SUPPORT,
      };
    }
  } catch (error) {}
};

export const MoringaVerifyNIN = async (body) => {
  try {
    const { flow_token, nin, images } = body;
    let image = images[0];
    const wa_id = await redisClient.get(`moringa_flow_token_${flow_token}`);

    if (wa_id) {
      const decryptedMedia = await processEncryptedMedia({
        encryptionKey: image.encryption_metadata.encryption_key,
        hmacKey: image.encryption_metadata.hmac_key,
        iv: image.encryption_metadata.iv,
        expectedPlaintextHash: image.encryption_metadata.plaintext_hash,
        expectedEncryptedHash: image.encryption_metadata.encrypted_hash,
        imageUrl: image.cdn_url,
        fileName: image.file_name,
      });

      let resData = await fetch("https://api.dojah.io/api/v1/kyc/nin/verify", {
        method: "POST",
        headers: {
          Authorization: `${DOJAH_SECRET}`,
          AppId: DOJAH_APP_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nin,
          selfie_image: decryptedMedia.toString("base64"),
        }),
      });

      resData = await resData.json();

      const entity = resData?.entity;

      console.log(entity, "entity");

      const match = entity?.selfie_verification?.match;

      if (match) {
        await MoringaUserModel.updateOne(
          { mobile: wa_id },
          {
            $set: {
              "kyc.nin.value": nin,
              "kyc.nin.is_verified": true,
              "kyc.bio": entity,
            },
          }
        );

        //Send to Queue
        sendToQueue(
          JSON.stringify({
            intent: moringaAccountDataQueue,
            payload: { wa_id },
          })
        );

        return SuccessScreen({
          title: "NIN Verification",
          heading: "NIN validated successfully",
          message: "Your Identity has been successfully verified 🎉🎉",
        });
      } else {
        return ErrorScreen({
          title: "NIN Verification",
          heading: "Match failed",
          message:
            "Unable to match your selfie with the NIN you provided. Please go back and try again with another selfie.",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: MORINGA_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const MoringaInwardCrypto = async (body) => {
  try {
    const {
      data: { destinationAddress, assetId, amount, status },
    } = body;
    console.log("inward crypto", body);
    const wallet = MoringWalletKeys.filter((e) => e.asset == assetId)[0];

    let wallet_type = wallet.wallet;

    const user = await MoringaUserModel.findOne({
      address: destinationAddress,
    });

    console.log(user, "user found");

    if (status !== "COMPLETED") return;
    if (!user) return;
    if (amount < 2) return;
    if (wallet.asset == "USDT_ERC20" || wallet.asset == "USDC") {
      if (amount < 10) return;
    }

    let Fees = MoringaFees.filter((e) => e.asset == assetId)[0].fee;

    //let Fees = amount - fee; ///10 percent of the inbound amount
    let amountAfterFees = amount - Fees;

    if (wallet_type == "USDT") {
      console.log("USDT DSICOVERD", body);
      await MoringaUserModel.updateOne(
        { _id: user },
        { $inc: { "wallet.usdt.balance": amountAfterFees } }
      );
    }

    if (wallet_type == "USDC") {
      console.log("USDC DSICOVERD", body);
      await MoringaUserModel.updateOne(
        { _id: user },
        { $inc: { "wallet.usdc.balance": amountAfterFees } }
      );
    }

    //Send to Queue

    sendToQueue(
      JSON.stringify({
        intent: moringaAccountDataQueue,
        payload: { wa_id: user.mobile },
      })
    );

    //Send message
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
          name: "moringa_transaction_successful",
          language: {
            code: "en",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: `${AmountSeparator(amountAfterFees)} ${wallet_type}`, //
                },
              ],
            },
          ],
        },
      },
    });
  } catch (error) {
    console.log(error, "error at moringa inward crypto");
    //moringa_transaction_successful
  }
};

export const FigoIntroLink = async (body) => {
  try {
    const { flow_token } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    if (wa_id) {
      let figo_account_name_1 = await redisClient.get(
        `figo_account_name_1_${wa_id}`
      );

      let figo_account_name_2 = await redisClient.get(
        `figo_account_name_2_${wa_id}`
      );

      let figo_account_id_1 = await redisClient.get(
        `figo_account_id_1_${wa_id}`
      );

      let figo_account_id_2 = await redisClient.get(
        `figo_account_id_2_${wa_id}`
      );

      return {
        ...FIGO_SCREEN_RESPONSES.CHOOSE_ACCOUNT,
        data: {
          account_name_1: figo_account_name_1,
          account_name_2: figo_account_name_2 || "",
          account_id_1: figo_account_id_1,
          account_id_2: figo_account_id_2 || "",
        },
      };
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoChooseAccount = async (body) => {
  try {
    const { flow_token, type, account } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    if (wa_id) {
      let figo_account_name_1 = await redisClient.get(
        `figo_account_name_1_${wa_id}`
      );

      let figo_account_name_2 = await redisClient.get(
        `figo_account_name_2_${wa_id}`
      );

      let figo_account_id_1 = await redisClient.get(
        `figo_account_id_1_${wa_id}`
      );

      let figo_account_id_2 = await redisClient.get(
        `figo_account_id_2_${wa_id}`
      );

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.CHOOSE_ACCOUNT,
          data: {
            account_name_1: figo_account_name_1,
            account_name_2: figo_account_name_2 || "",
            account_id_1: figo_account_id_1,
            account_id_2: figo_account_id_2 || "",
          },
        };
      }

      let figo_account_stat = await redisClient.get(
        `figo_account_stat_${wa_id}`
      );

      let figo_account_name =
        account == figo_account_id_1
          ? figo_account_name_1
          : figo_account_name_2;

      figo_account_stat = figo_account_stat
        ? await FileFromAWS(figo_account_stat)
        : FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;

      return {
        ...FIGO_SCREEN_RESPONSES.HOME,
        data: {
          ...FIGO_SCREEN_RESPONSES.HOME.data,
          scope: "navigate",
          init_option: "take_stock",
          today: new Date().toISOString().slice(0, 10),
          account_stat: figo_account_stat,
          account_name: figo_account_name || "",
          multi_account: true,
        },
      };
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoTakeStock = async (body) => {
  try {
    const {
      flow_token,
      type,
      screen,
      is_product,
      item_name,
      price,
      cost_price,
      quantity,
      unit,
      date,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = {
        is_product,
        init_date: date || "",
        init_item_name: item_name || "",
        init_price: parseFloat(price || 0),
        init_cost_price: parseFloat(cost_price || 0),
        init_stock_level: parseFloat(quantity || 1),
        init_unit: unit || "",
        screen,
        account_id,
        //init_supplier: supplier,
      };
      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({ ...payload })
      );

      if (!staff_access && type != "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "take_stock",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "find_supplier") {
        //await FigoSupplierModel.createIndex({ name: "text", mobile: "text" });
        let find_suppliers = await FigoSupplierModel.find({
          business: account_id,
        })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (find_suppliers.length > 0) {
          find_suppliers = find_suppliers.map((e) => {
            return {
              id: e._id,
              title: e?.name || "",
              description: e.mobile,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_SUPPLIER,
            data: {
              suppliers: find_suppliers,
              init_screen: screen,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_SUPPLIER,
            data: { init_screen: screen },
          };
        }
      }

      if (type == "remove_supplier") {
        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_supplier: "",
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_supplier: "",
          },
        };
      }

      if (type == "save") {
        /*  Subscription Wall Start*/
        const { is_subscribed, email } = await FigoSubscriptionAccess({
          wa_id,
          account_id,
        });

        if (!is_subscribed)
          return {
            ...FIGO_SCREEN_RESPONSES.SUBSCRIPTION,
            data: {
              is_email: !!email,
            },
          };
        /*  Subscription Wall End*/

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoAddItemQueue,
            payload: { wa_id, ...body },
          })
        );

        return SuccessScreen({
          title: "Take stock",
          heading: "Stock updated successfully",
          init_option: "take_stock",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoFindSupplier = async (body) => {
  try {
    const { flow_token, type, supplier, keyword } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "select_supplier") {
        const find_supplier = await FigoSupplierModel.findOne({
          _id: supplier,
          business: account_id,
        });

        console.log(find_supplier, supplier, account_id);
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_supplier: supplier,
            suppliers: [
              {
                id: find_supplier._id,
                title: find_supplier.name,
                description: find_supplier.mobile,
                metadata: "⊖ Remove",
              },
            ],
          },
        };
      }

      if (type == "search") {
        let find_suppliers = await QueryOpenSearch({
          index: "contact",
          filter: [
            { term: { businessId: account_id } },
            { term: { userRole: "Supplier" } },
          ],
          must: [
            {
              match: {
                text: {
                  query: keyword || "a",
                  fuzziness: 2,
                },
              },
            },
          ],
        });

        if (!!find_suppliers.length) {
          find_suppliers = find_suppliers.map((e) => {
            return {
              id: e.UserId,
              title: e.UserName,
              description: e.UserPhone,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_SUPPLIER,
            data: {
              suppliers: find_suppliers,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_SUPPLIER,
            data: {},
          };
        }
      }

      if (type == "add_new") {
        return {
          ...FIGO_SCREEN_RESPONSES.ADD_SUPPLIER,
          data: {},
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoAddSupplier = async (body) => {
  try {
    const { flow_token, type, supplier_phone, supplier_name } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "save") {
        const find_supplier = new mongoose.Types.ObjectId();

        await sendToQueue(
          JSON.stringify({
            intent: figoAddSupplierQueue,
            payload: {
              wa_id,
              ...body,
              _id: find_supplier,
            },
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_supplier: find_supplier,
            suppliers: [
              {
                id: find_supplier,
                title: supplier_name,
                description: supplier_phone,
                //metadata: "⊖ Remove",
              },
            ],
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoRecordSales = async (body) => {
  try {
    const { flow_token, type, date } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      const payload = {
        init_date: date || "",
        screen: "RECORD_SALES_B",
        account_id,
      };

      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({ ...payload })
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "record_sales",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "add_item") {
        let find_items = await FigoStockModel.find({
          business: account_id,
        })
          .sort({ updatedAt: -1 })
          .limit(20);
        if (find_items.length > 0) {
          find_items = find_items.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `${AmountSeparator(e.price)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_ITEM,
            data: {
              items: find_items,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoRecordSalesB = async (body) => {
  try {
    const {
      flow_token,
      type,
      date,
      items,
      customer,
      payment_status,
      init_items,
      amount,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      const prevPayload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      const payload = {
        init_date: date,
        screen: "RECORD_SALES_B",
        account_id,
        init_amount: amount,
        init_items: prevPayload?.init_items || [],
        init_customer: customer,
        payment_status,
        items: prevPayload?.items || [],
      };

      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({ ...payload })
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "record_sales",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "remove_item") {
        let newItems = payload.items.filter((e) => init_items.includes(e.id));

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_items: init_items,
            items: newItems,
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            // customers: find_customer,
            init_items: init_items,
            is_items: newItems?.length > 0 ? true : false,
            items: newItems,
            payment_status: payload.payment_status || "",
          },
        };
      }

      if (type == "remove_customer") {
        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_customer: "",
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_customer: "",
            payment_status: payload.payment_status || "",
          },
        };
      }

      if (type == "add_item") {
        let find_items = await FigoStockModel.find({ business: account_id })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (find_items.length > 0) {
          find_items = find_items.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `₦${AmountSeparator(e.price)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_ITEM,
            data: {
              items: find_items,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
            data: {},
          };
        }
      }

      if (type == "add_customer") {
        let find_customers = await FigoCustomerModel.find({
          business: account_id,
        })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (find_customers.length > 0) {
          find_customers = find_customers.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.mobile}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_CUSTOMER,
            data: {
              customers: find_customers,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
            data: {},
          };
        }
      }

      if (type == "save") {
        if (!items || items?.length == 0) {
          return ErrorScreen({
            title: "Record sales",
            heading: "Item is required",
            message: `Please add at least one item (product or service)`,
            type: "goBack",
            init_option: "RECORD_SALES_B",
          });
        }
        if (!customer && unpaidOrPartiallyPaid.includes(payment_status)) {
          return ErrorScreen({
            title: "Record sales",
            heading: `Customer is required`,
            message: "Please add a customer",
            type: "goBack",
            init_option: "RECORD_SALES_B",
          });
        }

        /*  Subscription Wall Start*/
        const { is_subscribed, email } = await FigoSubscriptionAccess({
          wa_id,
          account_id,
        });

        if (!is_subscribed)
          return {
            ...FIGO_SCREEN_RESPONSES.SUBSCRIPTION,
            data: {
              is_email: !!email,
            },
          };
        /*  Subscription Wall End*/

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoAddSaleQueue,
            payload: { wa_id, ...body },
          })
        );

        return SuccessScreen({
          title: "New sales",
          heading: "Sales added successfully",
          init_option: "record_sales",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoRecordPayment = async (body) => {
  try {
    const {
      flow_token,
      type,
      date,
      payment_method,
      amount,
      current_page = 0,
      description,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      const prevPayload = JSON.parse(
        (await redisClient.get(`figo_payload_${flow_token}`)) ?? "{}"
      );

      const payload = {
        init_date: date,
        screen: "COLLECT_MONEY",
        account_id,
        init_description: description,
        init_amount: amount,
        init_sale: prevPayload?.init_sale || "",
        payment_method,
        sales: prevPayload.sales || [],
      };

      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({ ...payload })
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "collect_money",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "link_sale") {
        let find_sales = await FigoSaleModel.find({
          business: account_id,
          payment_status: { $in: unpaidOrPartiallyPaid },
          due_amount: { $gt: 0 },
        })
          .populate("customer item._id")
          .sort({ updatedAt: -1 });

        if (!!find_sales.length) {
          const { data, hasNext, hasPrevious, totalCount } = paginateList(
            find_sales,
            adjustedPage,
            limit
          );

          find_sales = data.map((e) => {
            let items = e.item
              .map((item) => `${item?.quantity || 1}x ${item?._id?.name || ""}`)
              .join(", ");

            return {
              id: e._id,
              title: e.customer?.name || "",
              description: `₦${AmountSeparator(
                fromKoboToNaira(e.due_amount)
              )} | ${items}`,
              metadata: `Due on ${dayjs(e.date).format("MMM-DD-YYYY")} | ${
                e.payment_status
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.LINK_SALES,
            data: {
              sales: find_sales,
              is_loaded: !!data.length,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.COLLECT_MONEY,
            data: {
              ...payload,
              link_sale: false,
            },
          };
        }
      }

      if (type == "save") {
        /*  Subscription Wall Start*/
        const { is_subscribed, email } = await FigoSubscriptionAccess({
          wa_id,
          account_id,
        });

        if (!is_subscribed)
          return {
            ...FIGO_SCREEN_RESPONSES.SUBSCRIPTION,
            data: {
              is_email: !!email,
            },
          };
        /*  Subscription Wall End*/

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoAddMoneyQueue,
            payload: { wa_id, ...body },
          })
        );

        return SuccessScreen({
          title: "New payment",
          init_option: "collect_money",
          heading: "Payment added successfully",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoRecordPaymentB = async (body) => {
  try {
    const { flow_token, type } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "save") {
        /*  Subscription Wall Start*/
        const { is_subscribed, email } = await FigoSubscriptionAccess({
          wa_id,
          account_id,
        });

        if (!is_subscribed)
          return {
            ...FIGO_SCREEN_RESPONSES.SUBSCRIPTION,
            data: {
              is_email: !!email,
            },
          };
        /*  Subscription Wall End*/

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoAddMoneyQueue,
            payload: { wa_id, ...body },
          })
        );

        return SuccessScreen({
          title: "New payment",
          init_option: "collect_money",
          heading: "Payment added successfully",
          message: "",
          type: "debtors",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoFindItem = async (body) => {
  try {
    const { flow_token, type, item, keyword } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "select_item") {
        const find_item = await FigoStockModel.findOne({
          _id: item,
          business: account_id,
        });

        return {
          ...FIGO_SCREEN_RESPONSES.FIND_ITEM_SELECT,
          data: {
            item_name: find_item.name,
            init_price: find_item.price,
            init_quantity: find_item.level,
            init_unit: find_item.unit
              ? find_item.unit
              : find_item.level > 1
              ? "Units"
              : "Unit",
            item_id: find_item._id,
          },
        };
      }

      if (type == "search") {
        let find_items = await QueryOpenSearch({
          index: "product",
          filter: [{ term: { businessId: account_id } }],
          must: [
            {
              match: {
                text: {
                  query: keyword || "a",
                  fuzziness: 2,
                },
              },
            },
          ],
        });

        if (!!find_items.length) {
          find_items = find_items.map((e) => {
            return {
              id: e.ProductId,
              title: e.ProductName || e.ServiceName,
              description: `${e.QuantityAvailable} in stock`,
            };
          });

          return {
            ...FIGO_SCREEN_RESPONSES.FIND_ITEM,
            data: {
              items: find_items,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
            data: {},
          };
        }
      }

      if (type == "add_new") {
        return {
          ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
          data: { is_product: true },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoFindItemSelect = async (body) => {
  try {
    const { flow_token, type, item_id, quantity, price, item_name } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      console.log(payload);

      if (type == "save") {
        const newItem = {
          id: item_id,
          title: item_name,
          description: `${quantity}x ₦${AmountSeparator(price)}`,
          metadata: "⊖ Remove",
        };

        const existingItemIndex = payload.items?.findIndex(
          (item) => item.id == item_id
        );

        if (existingItemIndex === -1 || existingItemIndex === undefined) {
          await redisClient.set(
            `figo_payload_${flow_token}`,
            JSON.stringify({
              ...payload,
              init_items: [...(payload.init_items ?? []), newItem.id],
              items: [...(payload.items ?? []), newItem],
            })
          );

          return {
            ...FIGO_SCREEN_RESPONSES[payload.screen],
            data: {
              ...payload,
              init_customer: payload.init_customer || "",
              init_amount: payload.init_amount || "",
              init_items: [...(payload.init_items ?? []), newItem.id],
              is_items: true,
              items: [...(payload.items ?? []), newItem],
              payment_status: payload.payment_status || "",
              add_more: payload?.items?.length >= 20 ? false : true,
            },
          };
        } else {
          // Handle the case where the item already exists, e.g., update the quantity
          const updatedItems = payload.items.map((item) =>
            item.id == item_id
              ? {
                  ...item,
                  description: `${quantity}x ₦${AmountSeparator(price)}`,
                }
              : item
          );
          await redisClient.set(
            `figo_payload_${flow_token}`,
            JSON.stringify({ ...payload, items: updatedItems })
          );

          return {
            ...FIGO_SCREEN_RESPONSES[payload.screen],
            data: {
              ...payload,
              init_customer: payload.init_customer || "",
              init_amount: payload.init_amount || "",
              init_items: [...(payload.init_items ?? [])],
              is_items: true,
              items: updatedItems,
              payment_status: payload.payment_status || "",
              add_more: payload?.items?.length >= 20 ? false : true,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoLinkSale = async (body) => {
  try {
    const { flow_token, type, sale_id, current_page = 0 } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      console.log(payload);

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "select") {
        let find_sale = await FigoSaleModel.findOne({
          _id: sale_id,
          business: account_id,
          payment_status: { $in: unpaidOrPartiallyPaid },
          due_amount: { $gt: 0 },
        }).populate("customer item._id");

        let items = find_sale.item
          .map((item) => `${item.quantity}x ${item._id.name}`)
          .join(", ");

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_sale: find_sale._id,
            due_amount: fromKoboToNaira(find_sale.due_amount),
            due_amount_str: `${fromKoboToNaira(find_sale.due_amount)}`,
            sales: [
              {
                id: find_sale._id,
                title: find_sale.customer?.name || "",
                description: `₦${AmountSeparator(
                  fromKoboToNaira(find_sale.due_amount)
                )} | ${items}`,
                metadata: `Due on ${dayjs(find_sale.date).format(
                  "MMM-DD-YYYY"
                )} | ${find_sale.payment_status}`,
              },
            ],
          },
        };
      }

      if (type == "next_page" || type == "prev_page") {
        let find_sales = await FigoSaleModel.find({
          business: account_id,
          payment_status: { $in: unpaidOrPartiallyPaid },
          due_amount: { $gt: 0 },
        })
          .populate("customer")
          .sort({ updatedAt: -1 });

        if (find_sales.length > 0) {
          const { data, hasNext, hasPrevious } = paginateList(
            find_sales,
            adjustedPage,
            limit
          );

          find_sales = data.map((e) => {
            return {
              id: e._id,
              title: e.customer?.name || "",
              description: `₦${AmountSeparator(fromKoboToNaira(e.due_amount))}`,
              metadata: `Due on ${dayjs(e.date).format("MMM-DD-YYYY")}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.LINK_SALES,
            data: {
              sales: find_sales,
              is_loaded: !!data.length,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoAddItem = async (body) => {
  try {
    const { flow_token, type, quantity, price, item_name, selling_price } =
      body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "save") {
        const item_id = new mongoose.Types.ObjectId();

        const newItem = {
          id: item_id,
          title: item_name,
          description: `${quantity}x ₦${AmountSeparator(
            selling_price || price
          )}`,
          //metadata: "⊖ Remove",
        };

        //Send to queue TODO
        await Promise.all([
          sendToQueue(
            JSON.stringify({
              intent: figoAddItemQueue,
              payload: { wa_id, ...body, _id: item_id },
            })
          ),

          redisClient.set(
            `figo_payload_${flow_token}`,
            JSON.stringify({
              ...payload,
              init_items: [...(payload.init_items ?? []), newItem.id],
              items: [...(payload.items ?? []), newItem],
            })
          ),
        ]);

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            is_items: true,
            init_items: [...(payload.init_items ?? []), newItem.id],
            items: [...(payload.items ?? []), newItem],
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoFindCustomer = async (body) => {
  try {
    const {
      flow_token,

      type,
      customer,
      keyword,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "select_customer") {
        const find_customer = await FigoCustomerModel.findOne({
          _id: customer,
          business: account_id,
        });

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_customer: find_customer._id,
            customers: [
              {
                id: find_customer._id,
                title: find_customer.name,
                description: `${find_customer.mobile}`,
                //metadata: "⊖ Remove",
              },
            ],
          },
        };
      }

      if (type == "search") {
        let find_customers = await QueryOpenSearch({
          index: "contact",
          filter: [
            { term: { businessId: account_id } },
            { term: { userRole: "Customer" } },
          ],
          must: [
            {
              match: {
                text: {
                  query: keyword || "a",
                  fuzziness: 2,
                },
              },
            },
          ],
        });

        if (!!find_customers.length) {
          find_customers = find_customers.map((e) => {
            return {
              id: e.UserId,
              title: e.UserName,
              description: e.UserPhone,
            };
          });

          return {
            ...FIGO_SCREEN_RESPONSES.FIND_CUSTOMER,
            data: {
              customers: find_customers,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
            data: {},
          };
        }
      }

      if (type == "add_new") {
        return {
          ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
          data: {},
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoAddCustomer = async (body) => {
  try {
    const { flow_token, type, customer_phone, customer_name } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });
      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "save") {
        const find_customer = new mongoose.Types.ObjectId();
        //Send to queue TODO
        console.log("here1", body);

        await sendToQueue(
          JSON.stringify({
            intent: figoAddCustomerQueue,
            payload: { ...body, _id: find_customer, wa_id },
          })
        );

        console.log("here2", body);

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_customer: find_customer,
            customers: [
              {
                id: find_customer,
                title: customer_name,
                description: customer_phone,
              },
            ],
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoRecordExpense = async (body) => {
  try {
    const {
      flow_token,

      type,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type != "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "record_expense",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "save") {
        /*  Subscription Wall Start*/
        const { is_subscribed, email } = await FigoSubscriptionAccess({
          wa_id,
          account_id,
        });

        if (!is_subscribed)
          return {
            ...FIGO_SCREEN_RESPONSES.SUBSCRIPTION,
            data: {
              is_email: !!email,
            },
          };
        /*  Subscription Wall End*/

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoAddExpenseQueue,
            payload: { wa_id, ...body },
          })
        );

        return SuccessScreen({
          title: "New expense",
          init_option: "record_expense",
          heading: "Expense recorded successfully",
          message: "",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoCreateInvoice = async (body) => {
  try {
    const {
      flow_token,
      type,
      date,
      items,
      customer,
      payment_status,
      payment_details,
      init_items,
      amount,
      due_date,
      fees,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      const prevPayload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      const payload = {
        init_date: date,
        init_due_date: due_date,
        screen: "CREATE_INVOICE",
        account_id,
        init_amount: amount,
        init_items: prevPayload?.init_items || [],
        init_customer: customer,
        payment_status,
        items: prevPayload?.items || [],
        init_payment_details: payment_details || "",
      };

      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({ ...payload })
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "create_invoice",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "remove_item") {
        let newItems = payload.items.filter((e) => init_items.includes(e.id));

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_items: init_items,
            items: newItems,
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_items: init_items,
            is_items: newItems?.length > 0 ? true : false,
            items: newItems,
            payment_status: payload.payment_status || "",
          },
        };
      }

      if (type == "remove_customer") {
        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_customer: "",
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES[payload.screen],
          data: {
            ...payload,
            init_customer: "",
            payment_status: payload.payment_status || "",
          },
        };
      }

      if (type == "add_item") {
        let find_items = await FigoStockModel.find({ business: account_id })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (find_items.length > 0) {
          find_items = find_items.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `₦${AmountSeparator(e.price)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_ITEM,
            data: {
              items: find_items,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
            data: {},
          };
        }
      }

      if (type == "add_customer") {
        let find_customers = await FigoCustomerModel.find({
          business: account_id,
        })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (find_customers.length > 0) {
          find_customers = find_customers.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.mobile}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_CUSTOMER,
            data: {
              customers: find_customers,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
            data: {},
          };
        }
      }

      if (type == "save") {
        if (!items || items?.length == 0) {
          return ErrorScreen({
            title: "Create Invoice",
            heading: "Item is required",
            message: `Please add at least one item (product or service)`,
            type: "goBack",
            init_option: "CREATE_INVOICE",
          });
        }
        if (!customer) {
          return ErrorScreen({
            title: "Create Invoice",
            heading: `Customer is required`,
            message: "Please add a customer",
            type: "goBack",
            init_option: "CREATE_INVOICE",
          });
        }

        /*  Subscription Wall Start*/
        const { is_subscribed, email } = await FigoSubscriptionAccess({
          wa_id,
          account_id,
        });

        if (!is_subscribed)
          return {
            ...FIGO_SCREEN_RESPONSES.SUBSCRIPTION,
            data: {
              is_email: !!email,
            },
          };
        /*  Subscription Wall End*/

        let ref = customId(5);
        let key = `${ref}_${new Date().getTime()}`;

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoAddInvoiceQueue,
            payload: { wa_id, ...body, key, ref },
          })
        );

        const find_business = await FigoBusinessModel.findOne({
          _id: account_id,
        });
        const find_customer = await FigoCustomerModel.findOne({
          _id: body.customer,
        });

        let previewItems = items.map((e) => {
          const quantity = parseInt(e.description.split("x ₦")[0]);
          const price = parseFloat(
            e.description.split("x ₦")[1].replace(/,/g, "")
          );
          return {
            _id: e.id,
            quantity: quantity,
            price: AmountSeparator(price),
            price_int: price,
            name: e.title,
            subtotal: AmountSeparator(quantity * price),
          };
        });

        let totalCost = previewItems.reduce(
          (acc, item) => acc + item.quantity * item.price_int,
          0
        );

        totalCost = totalCost + parseFloat(fees || 0);

        let generateInvoice = await fetch(`${QUEUE_API_URL}/generate_invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            line_items: previewItems,
            key,
            business: {
              name: find_business.name || "",
              mobile: find_business.mobile || "",
              logo: find_business.logo
                ? `https://figoassets.s3.us-east-1.amazonaws.com/${find_business.logo}`
                : "",
            },
            customer: {
              name: find_customer.name || "",
              mobile: find_customer.mobile || "",
            },
            total: `${AmountSeparator(totalCost)}`,
            due_date: formatDay(due_date),
            date: formatDay(date),
            note: payment_details || "",
            fees: `${AmountSeparator(fees || 0)}`,
            ref,
          }),
        });

        generateInvoice = await generateInvoice.json();

        console.log(generateInvoice, "invoice generated");

        let preview_image = await FileFromAWS(key);

        return {
          ...FIGO_SCREEN_RESPONSES.VIEW_INVOICE,
          data: {
            url: `https://figoassets.s3.us-east-1.amazonaws.com/${key}`,
            preview_image: preview_image,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoMore = async (body) => {
  try {
    const { flow_token, type } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back" && type !== "app_settings")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = 0;

      if (type == "products") {
        let find_items = await FigoStockModel.find({
          business: account_id,
        }).sort({ updatedAt: -1 });

        if (find_items.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_items,
            adjustedPage,
            limit
          );

          find_items = data.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `₦${AmountSeparator(e.price)} per ${e.unit || "unit"}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.PRODUCTS,
            data: {
              items: find_items,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Inventory ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.PRODUCTS,
          };
        }
      }

      if (type == "expenses") {
        let find_expenses = await FigoExpenseModel.find({
          business: account_id,
        }).sort({ updatedAt: -1 });
        if (find_expenses.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_expenses,
            adjustedPage,
            limit
          );

          find_expenses = data.map((e) => {
            return {
              id: e._id,
              title: e.description,
              description: `₦${AmountSeparator(e.amount)}`,
              metadata: toTimeZone(e.date),
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.EXPENSES,
            data: {
              expenses: find_expenses,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Expenses ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.EXPENSES,
          };
        }
      }

      if (type == "debtors") {
        let find_debtors = await FigoSaleModel.find({
          business: account_id,
          payment_status: { $in: unpaidOrPartiallyPaid },
          due_amount: { $gt: 0 },
        })
          .populate("customer item._id")
          .sort({ updatedAt: -1 });

        if (find_debtors.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_debtors,
            adjustedPage,
            limit
          );

          find_debtors = data.map((e) => {
            let items = e.item
              .map((item) => `${item.quantity}x ${item._id.name}`)
              .join(", ");

            return {
              id: e._id,
              title: e.customer?.name || "",
              description: `₦${AmountSeparator(
                fromKoboToNaira(e.due_amount)
              )} • ${items}`,
              metadata: `Due on ${toTimeZone(e.date)} • ${
                FigoPaymentLabel[e.payment_status || "unpaid"]
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.DEBTORS,
            data: {
              debtors: find_debtors,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Debtors ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.DEBTORS,
          };
        }
      }

      if (type == "sales_payments") {
        let find_sales = await FigoSaleModel.find({
          business: account_id,
        })
          .populate("customer item._id")
          .sort({ updatedAt: -1 });

        if (find_sales?.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_sales,
            adjustedPage,
            limit
          );

          find_sales = data.map((e) => {
            let totalCost = e.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            totalCost = totalCost + parseFloat(e?.fees || 0);

            let items = e.item
              .map((item) => `${item.quantity}x ${item._id?.name || ""}`)
              .join(", ");

            return {
              id: e._id,
              title: e.customer?.name || "Customer",
              description:
                "₦" +
                AmountSeparator(totalCost) +
                (e.item && e.item.length ? " • " + items : ""),
              metadata: `${toTimeZone(e.date)} ${
                e.active ? "" : " • Archived"
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.SALES,
            data: {
              sales: find_sales,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Sales ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.SALES,
            data: {
              ...FIGO_SCREEN_RESPONSES.SALES.data,
              is_loaded: false,
            },
          };
        }
      }

      if (type == "invoices") {
        let find_invoices = await FigoInvoiceModel.find({
          business: account_id,
        })
          .populate({
            path: "sale",
            populate: [
              {
                path: "customer",
              },
              { path: "item._id" },
            ],
          })
          .sort({ updatedAt: -1 });

        if (find_invoices.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_invoices,
            adjustedPage,
            limit
          );

          find_invoices = data.map((e) => {
            let totalCost = e.sale.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            totalCost = totalCost + parseFloat(e.sale?.fees || 0);

            let items = e.sale.item
              .map((item) => `${item.quantity}x ${item._id.name}`)
              .join(", ");

            return {
              id: e._id,
              title: e.sale.customer.name,
              description: `₦${AmountSeparator(totalCost)} • ${items}`,
              metadata: `Due on ${toTimeZone(e.due_date)} • ${
                FigoPaymentLabel[e.sale.payment_status || "unpaid"]
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
            data: {
              invoices: find_invoices,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Invoices ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
          };
        }
      }

      if (type == "manage_staff") {
        const business = await FigoBusinessModel.findOne({
          _id: account_id,
        }).populate("user staff._id");

        if (business?.user?.mobile === wa_id) {
          let staff_only = (business.staff || []).filter(
            (e) => e?._id !== account_id
          );

          if (staff_only.length > 0) {
            let staff = await Promise.all(
              staff_only.map(async (e) => {
                const editor = await FigoEditorModel.findOne({
                  business: account_id,
                  "editor._id": e._id._id,
                }).sort({ createdAt: 1 });

                return {
                  id: e._id._id,
                  title: e?.name || "",
                  description: editor
                    ? `${e._id.mobile} • Last Active: ${toTimeZone(
                        editor.createdAt,
                        null,
                        "ddd MMM DD, YYYY. hh:mm a."
                      )}`
                    : `${e._id.mobile} • Last Active: Not Available`,
                  metadata: "⊖ Remove staff",
                };
              })
            );

            let init_staff = staff.map((e) => e.id);

            return {
              ...FIGO_SCREEN_RESPONSES.MANAGE_STAFF,
              data: {
                is_loaded: true,
                init_staff: [account_id, ...init_staff],
                staff: [
                  {
                    id: account_id,
                    title: "You",
                    description: "",
                    metadata: "",
                    enabled: false,
                  },
                  ...staff,
                ],
                add_more: staff_only.length >= 3 ? false : true,
              },
            };
          } else {
            return {
              ...FIGO_SCREEN_RESPONSES.MANAGE_STAFF,
              data: {
                ...FIGO_SCREEN_RESPONSES.MANAGE_STAFF.data,
                is_loaded: false,
              },
            };
          }
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.MORE,
          };
        }
      }

      if (type == "app_settings") {
        const you = await FigoUserModel.findOne({ mobile: wa_id });

        if (you._id.toString() == account_id.toString()) {
          const business = await FigoBusinessModel.findOne({ _id: you._id });
          let business_logo = business.logo
            ? await FileFromAWS(business.logo)
            : "";

          return {
            ...FIGO_SCREEN_RESPONSES.APP_SETTINGS,
            data: {
              is_owner: true,
              business_name: business.name || "",
              business_phone: business.mobile || "",
              business_logo: business_logo,
            },
          };
        } else {
          const business = await FigoBusinessModel.findOne({ _id: account_id });
          let business_logo = business.logo
            ? await FileFromAWS(business.logo)
            : "";

          return {
            ...FIGO_SCREEN_RESPONSES.APP_SETTINGS,
            data: {
              is_owner: false,
              business_name: business.name || "",
              business_phone: business.mobile || "",
              business_logo: business_logo,
            },
          };
        }
      }

      if (type == "spin") {
        const business = await FigoBusinessModel.findOne({
          _id: account_id,
        }).populate("user");

        return {
          ...FIGO_SCREEN_RESPONSES.SPIN,
          data: {
            business_name: business?.name
              ? true
              : business?.user?.mobile === wa_id
              ? false
              : true,
          },
        };
      }

      if (type == "back") {
        let figo_account_stat = await redisClient.get(
          `figo_account_stat_${wa_id}`
        );

        let figo_account_name = await redisClient.get(
          `figo_account_name_${wa_id}`
        );

        let figo_account_id_1 = await redisClient.get(
          `figo_account_id_1_${wa_id}`
        );

        let figo_account_id_2 = await redisClient.get(
          `figo_account_id_2_${wa_id}`
        );

        figo_account_stat = figo_account_stat
          ? await FileFromAWS(figo_account_stat)
          : FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;

        //Empty payload because of FigoInvoices and FigoSales that stores their data in payload
        await redisClient.set(`figo_payload_${flow_token}`, JSON.stringify({}));

        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "more",
            scope: "navigate",
            today: new Date().toISOString().slice(0, 10),
            account_stat: figo_account_stat,
            account_name: figo_account_name || "",
            multi_account: !!figo_account_id_1 && !!figo_account_id_2,
          },
        };
      }
    } else {
      // return UpdateRequiredScreen({     //Max screens reached
      //   data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      // });
      return ErrorScreen({
        message: `Update required. Close this page and send App to Figo.`,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoExpenses = async (body) => {
  try {
    const {
      flow_token,

      type,
      current_page = 0,
      id: expense,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "next_page" || type == "prev_page") {
        let find_expenses = await FigoExpenseModel.find({
          business: account_id,
        }).sort({ updatedAt: -1 });

        if (find_expenses.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_expenses,
            adjustedPage,
            limit
          );

          find_expenses = data.map((e) => {
            return {
              id: e._id,
              title: e.description,
              description: `₦${AmountSeparator(e.amount)}`,
              metadata: `${new Date(e.date).toISOString().slice(0, 10)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.EXPENSES,
            data: {
              expenses: find_expenses,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Expenses ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.EXPENSES,
            data: {
              is_loaded: false,
            },
          };
        }
      }

      if (type == "edit") {
        let find_expense = await FigoExpenseModel.findOne({
          _id: expense,
          business: account_id,
        });

        const editors = await FigoEditorModel.find({
          entry_type: "expense",
          entry_id: expense,
          business: account_id,
        });

        let activity = editors
          .map(
            (editor) =>
              ` ${editor.action.includes("add") ? "Added" : "Edited"} by ${
                editor.editor.name
                  ? editor.editor.name.substring(0, 12)
                  : editor.editor.mobile.substring(0, 12)
              } at ${toTimeZone(editor.createdAt, "", "hh:mm a. MMM DD, YYYY")}`
          )
          .join("\n");

        return {
          ...FIGO_SCREEN_RESPONSES.EDIT_EXPENSE,
          data: {
            activity,
            init_id: expense,
            init_amount: `${find_expense.amount}`,
            init_description: `${find_expense.description}`,
            init_date: new Date(find_expense.date).toISOString().slice(0, 10),
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

//Editor is here
export const FigoEditExpense = async (body) => {
  try {
    const {
      flow_token,
      type,
      current_page = 0,
      id: expense_id,
      date,
      amount,
      description,
      init_amount,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "save") {
        await FigoExpenseModel.updateOne(
          { _id: expense_id },
          {
            $set: {
              date: new Date(date),
              amount,
              description,
            },
          }
        );

        //Add the Editor or staff that's making this changes
        const business = await FigoBusinessModel.findOne({
          _id: account_id,
        }).populate("staff._id");

        const user = await FigoUserModel.findOne({ mobile: wa_id });

        const staff = (business.staff || []).filter(
          (e) => e?._id?._id?.toString() == user._id.toString()
        );

        await FigoEditorModel.insertOne({
          entry_type: FIGO_ENTRY_TYPES.expense,
          entry_id: expense_id,
          business: account_id,
          editor: {
            _id: user._id,
            name: !!staff?.length ? staff[0].name : user.name,
            mobile: wa_id,
          },
          action: FIGO_ENTRY_ACTIONS.edit_expense,
        });

        //Send to RAG to reingest the expense data
        fetch(`${RAG_API_URL}/trigger/expense_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: account_id,
            expenseId: expense_id,
          }),
        });

        let amount_change = parseFloat(amount) - parseFloat(init_amount);

        //Add to Business Money Out
        fetch(`${QUEUE_API_URL}/figo_fifo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amount_change,
            business: account_id,
            type: "out",
          }),
        });

        let find_expenses = await FigoExpenseModel.find({
          business: account_id,
        }).sort({ updatedAt: -1 });

        const { data, hasNext, hasPrevious, range } = paginateList(
          find_expenses,
          adjustedPage,
          limit
        );

        find_expenses = data.map((e) => {
          return {
            id: e._id,
            title: e.description,
            description: `₦${AmountSeparator(e.amount)}`,
            metadata: `${new Date(e.date).toISOString().slice(0, 10)}`,
          };
        });
        return {
          ...FIGO_SCREEN_RESPONSES.EXPENSES,
          data: {
            expenses: find_expenses,
            is_loaded: data.length > 0,
            is_next: hasNext,
            is_previous: hasPrevious,
            current_page: `${adjustedPage}`,
            header: `Expenses ${range}`,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoInvoices = async (body) => {
  try {
    const {
      flow_token,

      type,
      current_page = 0,
      invoice_id,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.MORE,
        };
      }

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "next_page" || type == "prev_page") {
        let find_invoices = await FigoInvoiceModel.find({
          business: account_id,
        })
          .populate({
            path: "sale",
            populate: {
              path: "customer",
            },
          })
          .sort({ updatedAt: -1 });

        if (find_invoices.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_invoices,
            adjustedPage,
            limit
          );

          find_invoices = data.map((e) => {
            const totalCost = e.sale.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            return {
              id: e._id,
              title: e.sale.customer.name,
              description: `Due on ${dayjs(e.due_date).format("MMM-DD-YYYY")}`,
              metadata: `₦${AmountSeparator(totalCost)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
            data: {
              invoices: find_invoices,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Invoices ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
            data: {
              is_loaded: false,
            },
          };
        }
      }

      if (type == "edit") {
        let find_invoice = await FigoInvoiceModel.findOne({
          _id: invoice_id,
          business: account_id,
        }).populate({
          path: "sale",
          populate: [
            {
              path: "item._id",
            },
            { path: "customer" },
          ],
        });

        let find_payments = await FigoPaymentModel.find({
          sale: find_invoice.sale._id,
          business: account_id,
        }).populate("sale");

        const init_items = find_invoice.sale.item.map((e) => e._id._id);

        const items = find_invoice.sale.item.map((e) => {
          return {
            id: e._id?._id || "-",
            title: e._id?.name || "-",
            description: e._id
              ? `${e.quantity}x ₦${AmountSeparator(e.price)}`
              : "",
            metadata: ["partially_paid", "paid"].includes(
              find_invoice.sale.payment_status
            )
              ? ""
              : "⊖ Remove",
          };
        });

        const init_payments = find_payments.map((e) => e._id);

        const payments = find_payments.map((e) => {
          return {
            id: e._id || "-",
            title: `₦${AmountSeparator(e.amount)}`,
            description: `${toTimeZone(e.date)} • ${e.description || ""}`,
            metadata: "⊖ Remove",
          };
        });

        const editors = await FigoEditorModel.find({
          entry_type: "invoice",
          entry_id: invoice_id,
          business: account_id,
        });

        let activity = editors
          .map(
            (editor) =>
              ` ${editor.action.includes("add") ? "Added" : "Edited"} by ${
                editor.editor.name
                  ? editor.editor.name.substring(0, 12)
                  : editor.editor.mobile.substring(0, 12)
              } at ${toTimeZone(editor.createdAt, "", "hh:mm a. MMM DD, YYYY")}`
          )
          .join("\n");

        const newPayload = {
          ...FIGO_SCREEN_RESPONSES.EDIT_INVOICE,
          data: {
            ...FIGO_SCREEN_RESPONSES.EDIT_INVOICE.data,
            activity,
            init_customer: find_invoice.sale?.customer?._id || "",
            customers: [
              {
                id: find_invoice.sale?.customer?._id || "",
                title: find_invoice.sale?.customer?.name || "",
                description: find_invoice.sale?.customer?.mobile || "",
              },
            ],
            init_items,
            init_payments,
            is_items: !!init_items.length ? true : false,
            is_payments: !!find_payments.length,
            items,
            payments,
            init_payment_details: find_invoice.payment_details,
            payment_status: find_invoice.sale.payment_status,
            invoice_id: invoice_id,
            message: ["partially_paid", "paid"].includes(
              find_invoice.sale.payment_status
            )
              ? FIGO_SCREEN_RESPONSES.EDIT_INVOICE.data.message
              : "",
            init_date: new Date(find_invoice.date).toISOString().slice(0, 10),
            init_due_date: new Date(find_invoice.due_date)
              .toISOString()
              .slice(0, 10),
            init_fees: `${find_invoice.sale?.fees || 0}`,
          },
        };

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            screen: FIGO_SCREEN_RESPONSES.EDIT_INVOICE.screen,
            message: newPayload.data.message,
            invoice_id,
          })
        );

        return {
          ...newPayload,
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoViewInvoice = async (body) => {
  try {
    const { flow_token, type } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "done") {
        let figo_account_stat = await redisClient.get(
          `figo_account_stat_${wa_id}`
        );

        let figo_account_name = await redisClient.get(
          `figo_account_name_${wa_id}`
        );

        let figo_account_id_1 = await redisClient.get(
          `figo_account_id_1_${wa_id}`
        );

        let figo_account_id_2 = await redisClient.get(
          `figo_account_id_2_${wa_id}`
        );

        figo_account_stat = figo_account_stat
          ? await FileFromAWS(figo_account_stat)
          : FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;

        //Reset figo payload
        await redisClient.set(`figo_payload_${flow_token}`, JSON.stringify({}));

        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            scope: "reload",
            init_option: "create_invoice",
            today: new Date().toISOString().slice(0, 10),
            account_stat: figo_account_stat,
            account_name: figo_account_name || "",
            multi_account: !!figo_account_id_1 && !!figo_account_id_2,
          },
        };
      }

      if (type == "invoice") {
        let find_invoices = await FigoInvoiceModel.find({
          business: account_id,
        })
          .populate({
            path: "sale",
            populate: [
              {
                path: "customer",
              },
              { path: "item._id" },
            ],
          })
          .sort({ updatedAt: -1 });

        if (find_invoices.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_invoices,
            adjustedPage,
            limit
          );

          find_invoices = data.map((e) => {
            const totalCost = e.sale.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            let items = e.sale.item
              .map((item) => `${item.quantity}x ${item._id.name}`)
              .join(", ");

            return {
              id: e._id,
              title: e.sale.customer?.name || "",
              description: `₦${AmountSeparator(totalCost)} • ${items}`,
              metadata: `Due on ${toTimeZone(e.due_date)} • ${
                FigoPaymentLabel[e.sale.payment_status || "unpaid"]
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
            data: {
              invoices: find_invoices,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Invoices ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoDebtors = async (body) => {
  try {
    const { flow_token, type, current_page = 0, id: sale_id } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.MORE,
        };
      }

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "next_page" || type == "prev_page") {
        let find_debtors = await FigoSaleModel.find({
          business: account_id,
          payment_status: { $in: unpaidOrPartiallyPaid },
          due_amount: { $gt: 0 },
        })
          .populate("customer item._id")
          .sort({ updatedAt: -1 });

        if (find_debtors.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_debtors,
            adjustedPage,
            limit
          );

          find_debtors = data.map((e) => {
            let items = e.item
              .map((item) => `${item.quantity}x ${item._id.name}`)
              .join(", ");

            return {
              id: e._id,
              title: e.customer?.name || "",
              description: `₦${AmountSeparator(
                fromKoboToNaira(e.due_amount)
              )} • ${items}`,
              metadata: `Due on ${toTimeZone(e.date)} • ${
                FigoPaymentLabel[e.payment_status || "unpaid"]
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.DEBTORS,
            data: {
              debtors: find_debtors,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Debtors ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.DEBTORS,
            data: {
              is_loaded: false,
            },
          };
        }
      }

      if (type == "edit") {
        let find_sale = await FigoSaleModel.findOne({
          _id: sale_id,
          business: account_id,
        }).populate("customer item._id");

        const init_items = find_sale.item.map((e) => e._id._id);

        const items = find_sale.item.map((e) => {
          return {
            id: e._id._id,
            title: e._id.name,
            description: `${e.quantity}x ₦${AmountSeparator(e.price)}`,
            metadata: `₦${AmountSeparator(e.quantity * e.price)}`,
          };
        });

        return {
          ...FIGO_SCREEN_RESPONSES.VIEW_DEBTOR,
          data: {
            ...FIGO_SCREEN_RESPONSES.VIEW_DEBTOR.data,
            sale_id,
            init_customer: find_sale?.customer?._id || "",
            customers: [
              {
                id: find_sale?.customer?._id || "",
                title: find_sale?.customer?.name || "",
                description: find_sale?.customer?.mobile || "",
              },
            ],
            init_items,
            items,
            due_date: `Due on ${formatDate(find_sale.date, "MMMM DD, YYYY.")}`,
            balance: `NGN${AmountSeparator(
              fromKoboToNaira(find_sale.due_amount)
            )}`,
            fees: `NGN${AmountSeparator(find_sale?.fees || 0)}`,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoViewDebtor = async (body) => {
  try {
    const { flow_token, type, sale_id } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "remove_item") {
        return {
          ...FIGO_SCREEN_RESPONSES.VIEW_DEBTOR,
          data: {},
        };
      }

      let find_sale = await FigoSaleModel.findOne({
        _id: sale_id,
        business: account_id,
      }).populate([
        {
          path: "business",
          populate: { path: "user" },
        },

        { path: "customer" },
        { path: "item._id" },
      ]);

      console.log(find_sale);

      if (type == "collect_payment") {
        return {
          ...FIGO_SCREEN_RESPONSES.COLLECT_MONEY_B,
          data: {
            due_amount_str: `${fromKoboToNaira(find_sale.due_amount)}`,
            sale_id,
            init_date: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (type == "reminder") {
        if (find_sale?.customer?.mobile !== "__anonymous__") {
          await SendFigoReminder({
            wa_id: find_sale.customer.mobile,
            header: `${
              find_sale.business?.name ||
              find_sale.business?.mobile ||
              find_sale.business?.user?.mobile
            }`,
            body: ` You still owe us ₦${AmountSeparator(
              fromKoboToNaira(find_sale.due_amount)
            )}. Pay now.`,
          });
        }

        return {
          ...FIGO_SCREEN_RESPONSES.VIEW_DEBTOR,
          data: {
            reminder: "🔔 Send reminder again",
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    console.log(error);
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoSales = async (body) => {
  try {
    const { flow_token, type, current_page = 0, sale_id } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.MORE,
        };
      }

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "next_page" || type == "prev_page") {
        let find_sales = await FigoSaleModel.find({
          business: account_id,
        })
          .populate("customer item._id")
          .sort({ updatedAt: -1 });

        if (!!find_sales.length) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_sales,
            adjustedPage,
            limit
          );

          find_sales = data.map((e) => {
            const totalCost = e.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            let items = e.item
              .map((item) => `${item.quantity}x ${item._id?.name || ""}`)
              .join(", ");

            return {
              id: e._id,
              title: e.customer?.name || "Customer",
              description:
                "₦" +
                AmountSeparator(totalCost) +
                (e.item && e.item.length ? " • " + items : ""),
              metadata: `${toTimeZone(e.date)}  ${
                e.active ? "" : " • Archived"
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.SALES,
            data: {
              sales: find_sales,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Sales ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.SALES,
            data: {
              is_loaded: false,
            },
          };
        }
      }

      if (type == "edit") {
        let find_sale = await FigoSaleModel.findOne({
          _id: sale_id,
          business: account_id,
        }).populate("customer item._id");

        let find_payments = await FigoPaymentModel.find({
          sale: sale_id,
          business: account_id,
        }).populate("sale");

        const init_items = find_sale.item.map((e) => e._id._id);

        const items = find_sale.item.map((e) => {
          return {
            id: e._id?._id || "-",
            title: e._id?.name || "-",
            description: e._id
              ? `${e.quantity}x ₦${AmountSeparator(e.price)}`
              : "",
            metadata: ["partially_paid", "paid"].includes(
              find_sale.payment_status
            )
              ? ""
              : "⊖ Remove",
          };
        });

        const init_payments = find_payments.map((e) => e._id);

        const payments = find_payments.map((e) => {
          return {
            id: e._id || "-",
            title: `₦${AmountSeparator(e.amount)}`,
            description: `${toTimeZone(e.date)} • ${e.description || ""}`,
            metadata: "⊖ Remove",
          };
        });

        const editors = await FigoEditorModel.find({
          entry_type: "sale",
          entry_id: sale_id,
          business: account_id,
        });

        let activity = editors
          .map(
            (editor) =>
              ` ${editor.action.includes("add") ? "Added" : "Edited"} by ${
                editor.editor.name
                  ? editor.editor.name.substring(0, 12)
                  : editor.editor.mobile.substring(0, 12)
              } at ${toTimeZone(editor.createdAt, "", "hh:mm a. MMM DD, YYYY")}`
          )
          .join("\n");

        const newPayload = {
          ...FIGO_SCREEN_RESPONSES.EDIT_SALES,
          data: {
            ...FIGO_SCREEN_RESPONSES.EDIT_SALES.data,
            payment_status: find_sale.payment_status || "unpaid",
            init_customer: find_sale?.customer?._id || "",
            customers: [
              {
                id: find_sale?.customer?._id || "",
                title: find_sale?.customer?.name || "",
                description: find_sale?.customer?.mobile || "",
              },
            ],
            init_items,
            init_payments,
            is_items: !!init_items.length,
            is_payments: !!find_payments.length,
            items,
            payments,
            sale_id,
            message: ["partially_paid", "paid"].includes(
              find_sale.payment_status
            )
              ? FIGO_SCREEN_RESPONSES.EDIT_SALES.data.message
              : "",
            init_action: find_sale.active ? "delete_sale" : "add_sale",
            init_date: new Date(find_sale.date).toISOString().slice(0, 10),
            activity,
            init_fees: `${find_sale?.fees || 0}`,
          },
        };

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            screen: FIGO_SCREEN_RESPONSES.EDIT_SALES.screen,
            message: newPayload.data.message,
            sale_id,
          })
        );

        return {
          ...newPayload,
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoEditSales = async (body) => {
  try {
    const {
      flow_token,
      type,
      items,
      due_date,
      date,
      payments,
      init_payments,
      init_items,
      customer,
      current_page = 0,
      sale_id,
      fees,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      const prevPayload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({
          ...prevPayload,
          payment_status: !!init_payments?.length ? "paid" : "unpaid",
          message: !!init_payments?.length
            ? FIGO_SCREEN_RESPONSES.EDIT_SALES.data.message
            : "",
          init_due_date: due_date,
          init_customer: customer,
          items,
          payments,
          init_items,
          init_payments,
          init_fees: fees,
        })
      );

      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      if (type == "back") {
        let find_sales = await FigoSaleModel.find({
          business: account_id,
        })
          .populate("customer item._id")
          .sort({ updatedAt: -1 });

        if (!!find_sales.length) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_sales,
            adjustedPage,
            limit
          );

          find_sales = data.map((e) => {
            let totalCost = e.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            totalCost = totalCost + parseFloat(e?.fees || 0);

            let items = e.item
              .map((item) => `${item.quantity}x ${item._id?.name || ""}`)
              .join(", ");

            return {
              id: e._id,
              title: e.customer?.name || "Customer",
              description:
                "₦" +
                AmountSeparator(totalCost) +
                (e.item && e.item.length ? " • " + items : ""),
              metadata: `${toTimeZone(e.date)} ${
                e.active ? "" : " • Archived"
              }`,
            };
          });

          return {
            ...FIGO_SCREEN_RESPONSES.SALES,
            data: {
              sales: find_sales,
              is_loaded: !!data.length,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Sales ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.SALES,
          };
        }
      }

      if (type == "remove_item") {
        let newPayments = (payments || []).filter((e) =>
          init_payments.includes(e?.id)
        );

        let newItems = (items || []).filter((e) => init_items.includes(e?.id));

        console.log(newPayments, "np");

        if (!!newPayments.length) {
          console.log("end g");
          return {
            ...FIGO_SCREEN_RESPONSES.EDIT_SALES,
            data: {},
          };
        }

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_items: init_items,
            items: newItems,
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES.EDIT_SALES,
          data: {
            ...payload,
            init_items: init_items,
            is_items: !!newItems?.length,
            items: newItems,
          },
        };
      }

      if (type == "remove_payment") {
        let newPayments = (payments || []).filter((e) =>
          init_payments.includes(e?.id)
        );

        let newItems = (items || []).filter((e) => init_items.includes(e?.id));

        if (!newPayments.length) {
          newItems = newItems.map((e) => {
            return {
              ...e,
              metadata: "⊖ Remove",
            };
          });
        }

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_items: init_items,
            items: newItems,
            init_payments,
            payments: newPayments,
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES.EDIT_SALES,
          data: {
            ...payload,
            init_payments: init_payments,
            is_payments: !!newPayments.length,
            payments: newPayments,
            items: newItems,
          },
        };
      }

      if (type == "add_item") {
        let find_items = await FigoStockModel.find({ business: account_id })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (find_items.length > 0) {
          find_items = find_items.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `₦${AmountSeparator(e.price)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_ITEM,
            data: {
              items: find_items,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
            data: {},
          };
        }
      }

      if (type == "add_customer") {
        let find_customers = await FigoCustomerModel.find({
          business: account_id,
        })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (!!find_customers.length) {
          find_customers = find_customers.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.mobile}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_CUSTOMER,
            data: {
              customers: find_customers,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
            data: {},
          };
        }
      }

      if (type == "save") {
        if (!items || !items?.length) {
          return ErrorScreen({
            title: "Edit Sale",
            heading: "Item is required",
            message: `Please add at least one item (product or service)`,
            type: "goBack",
            init_option: "EDIT_SALES",
          });
        }

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoModifySaleQueue,
            payload: { wa_id, ...body },
          })
        );

        return SuccessScreen({
          title: "Edit sale",
          heading: "Sale edited successfully",
          init_option: "record_sales",
          message: "",
          type: "sales",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoEditInvoice = async (body) => {
  try {
    const {
      flow_token,
      type,
      date,
      items,
      payments,
      init_payments,
      init_items,
      customer,
      due_date,
      payment_details,
      current_page = 0,
      invoice_id,
      fees,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      const prevPayload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      await redisClient.set(
        `figo_payload_${flow_token}`,
        JSON.stringify({
          ...prevPayload,
          payment_status: !!init_payments?.length ? "paid" : "unpaid",
          message: !!init_payments?.length
            ? FIGO_SCREEN_RESPONSES.EDIT_INVOICE.data.message
            : "",
          init_due_date: due_date,
          init_date: date,
          init_payment_details: payment_details,
          init_fees: fees,
          init_customer: customer,
          items,
          payments,
          init_items,
          init_payments,
        })
      );

      const payload = JSON.parse(
        await redisClient.get(`figo_payload_${flow_token}`)
      );

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      if (type == "back") {
        let find_invoices = await FigoInvoiceModel.find({
          business: account_id,
        })
          .populate({
            path: "sale",
            populate: [
              {
                path: "customer",
              },
              { path: "item._id" },
            ],
          })
          .sort({ updatedAt: -1 });

        if (find_invoices.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_invoices,
            adjustedPage,
            limit
          );

          find_invoices = data.map((e) => {
            let totalCost = e.sale.item.reduce(
              (acc, item) => acc + item.quantity * item.price,
              0
            );

            totalCost = totalCost + parseFloat(e.sale?.fees || 0);

            let items = e.sale.item
              .map((item) => `${item.quantity}x ${item._id.name}`)
              .join(", ");

            return {
              id: e._id,
              title: e.sale.customer?.name || "",
              description: `₦${AmountSeparator(totalCost)} • ${items}`,
              metadata: `Due on ${toTimeZone(e.due_date)} • ${
                FigoPaymentLabel[e.sale.payment_status || "unpaid"]
              }`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
            data: {
              invoices: find_invoices,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Invoices ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.INVOICES,
          };
        }
      }

      if (type == "remove_item") {
        let newPayments = payments.filter((e) => init_payments.includes(e.id));

        let newItems = items.filter((e) => init_items.includes(e.id));

        if (!!newPayments.length) {
          return {
            ...FIGO_SCREEN_RESPONSES.EDIT_INVOICE,
            data: {},
          };
        }

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_items: init_items,
            items: newItems,
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES.EDIT_INVOICE,
          data: {
            ...payload,
            init_items: init_items,
            is_items: !!newItems?.length,
            items: newItems,
          },
        };
      }

      if (type == "remove_payment") {
        let newPayments = payments.filter((e) => init_payments.includes(e.id));

        let newItems = items.filter((e) => init_items.includes(e.id));

        if (!newPayments.length) {
          newItems = newItems.map((e) => {
            return {
              ...e,
              metadata: "⊖ Remove",
            };
          });
        }

        await redisClient.set(
          `figo_payload_${flow_token}`,
          JSON.stringify({
            ...payload,
            init_items: init_items,
            items: newItems,
            init_payments,
            payments: newPayments,
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES.EDIT_INVOICE,
          data: {
            ...payload,
            init_payments: init_payments,
            is_payments: !!newPayments.length,
            payments: newPayments,
            items: newItems,
          },
        };
      }

      if (type == "add_item") {
        let find_items = await FigoStockModel.find({ business: account_id })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (!!find_items.length) {
          find_items = find_items.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `₦${AmountSeparator(e.price)}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_ITEM,
            data: {
              items: find_items,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_ITEM,
            data: {},
          };
        }
      }

      if (type == "add_customer") {
        let find_customers = await FigoCustomerModel.find({
          business: account_id,
        })
          .sort({ updatedAt: -1 })
          .limit(20);

        if (!!find_customers.length) {
          find_customers = find_customers.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.mobile}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.FIND_CUSTOMER,
            data: {
              customers: find_customers,
              is_loaded: true,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
            data: {},
          };
        }
      }

      if (type == "save") {
        if (!items || !items?.length) {
          return ErrorScreen({
            title: "Edit Invoice",
            heading: "Item is required",
            message: `Please add at least one item (product or service)`,
            type: "goBack",
            init_option: "EDIT_INVOICE",
          });
        }

        if (!customer) {
          return ErrorScreen({
            title: "Edit Invoice",
            heading: `Customer is required`,
            message: "Please add a customer",
            type: "goBack",
            init_option: "EDIT_INVOICE",
          });
        }

        const find_invoice = await FigoInvoiceModel.findOne({
          _id: invoice_id,
          business: account_id,
        }).populate("business");

        let ref = find_invoice.ref;
        let key = `${ref}_${new Date().getTime()}`;

        //Send to queue TODO
        await sendToQueue(
          JSON.stringify({
            intent: figoModifyInvoiceQueue,
            payload: { wa_id, ...body },
          })
        );

        const find_business = find_invoice.business;

        const find_customer = await FigoCustomerModel.findOne({
          _id: body.customer,
        });

        let previewItems = items.map((e) => {
          const quantity = parseInt(e.description.split("x ₦")[0]);
          const price = parseFloat(
            e.description.split("x ₦")[1].replace(/,/g, "")
          );
          return {
            _id: e.id,
            quantity: quantity,
            price: AmountSeparator(price),
            price_int: price,
            name: e.title,
            subtotal: AmountSeparator(quantity * price),
          };
        });

        let totalCost = previewItems.reduce(
          (acc, item) => acc + item.quantity * item.price_int,
          0
        );

        totalCost = totalCost + parseFloat(fees || 0);

        const totalPayment = (payments || []).reduce(
          (acc, item) =>
            acc +
            parseFloat(item.title.replace(/[^\d.-]/g, "").replace(/,/g, "")),
          0
        );

        //{_id:ObjectId('6830eab5ca60421182f9af36')}

        const totalDue = totalCost - totalPayment;

        let generateInvoice = await fetch(`${QUEUE_API_URL}/generate_invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            line_items: previewItems,
            key,
            business: {
              name: find_business.name || "",
              mobile: find_business.mobile || "",
              logo: find_business.logo
                ? `https://figoassets.s3.us-east-1.amazonaws.com/${find_business.logo}`
                : "",
            },
            customer: {
              name: find_customer.name || "",
              mobile: find_customer.mobile || "",
            },
            total: `${AmountSeparator(totalDue)}`,
            due_date: formatDay(due_date),
            date: formatDay(date),
            note: payment_details || "",
            fees: `${AmountSeparator(fees || 0)}`,
            ref,
          }),
        });

        generateInvoice = await generateInvoice.json();

        console.log(generateInvoice, "gni");

        let preview_image = await FileFromAWS(key);

        return {
          ...FIGO_SCREEN_RESPONSES.VIEW_INVOICE,
          data: {
            url: `https://figoassets.s3.us-east-1.amazonaws.com/${key}`,
            preview_image: preview_image,
            type: "invoice",
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoProducts = async (body) => {
  try {
    const {
      flow_token,

      type,
      current_page = 0,
      id: item,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "next_page" || type == "prev_page") {
        let find_items = await FigoStockModel.find({
          business: account_id,
        }).sort({ updatedAt: -1 });

        if (find_items.length > 0) {
          const { data, hasNext, hasPrevious, range } = paginateList(
            find_items,
            adjustedPage,
            limit
          );

          find_items = data.map((e) => {
            return {
              id: e._id,
              title: e.name,
              description: `${e.level} in stock`,
              metadata: `₦${AmountSeparator(e.price)} per ${e.unit || "unit"}`,
            };
          });
          return {
            ...FIGO_SCREEN_RESPONSES.PRODUCTS,
            data: {
              items: find_items,
              is_loaded: data.length > 0,
              is_next: hasNext,
              is_previous: hasPrevious,
              current_page: `${adjustedPage}`,
              header: `Inventory ${range}`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.PRODUCTS,
            data: {
              is_loaded: false,
            },
          };
        }
      }

      if (type == "edit") {
        let find_item = await FigoStockModel.findOne({
          _id: item,
          business: account_id,
        }).populate("supplier");

        const editors = await FigoEditorModel.find({
          entry_type: "stock",
          entry_id: item,
          business: account_id,
        });

        let activity = editors
          .map(
            (editor) =>
              ` ${editor.action.includes("add") ? "Added" : "Edited"} by ${
                editor.editor.name
                  ? editor.editor.name.substring(0, 12)
                  : editor.editor.mobile.substring(0, 12)
              } at ${toTimeZone(
                editor.createdAt,
                null,
                "hh:mm a. MMM DD, YYYY"
              )}`
          )
          .join("\n");

        return {
          ...FIGO_SCREEN_RESPONSES.EDIT_PRODUCT,
          data: {
            init_id: item,
            init_name: find_item.name,
            init_amount: `${find_item.price}`,
            init_stock_level: `${find_item.level}`,
            init_label: find_item.type,
            supplier_name: find_item?.supplier?.name || "",
            supplier_phone: find_item?.supplier?.mobile || "",
            init_expiry: find_item.expiry_date || "",
            activity,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoEditProduct = async (body) => {
  try {
    const { flow_token, type, current_page = 0 } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const limit = 20;

      // Calculate the new current page
      let adjustedPage = current_page;
      if (type === "next_page") {
        adjustedPage = parseFloat(current_page) + 1;
      } else if (type === "prev_page" && current_page > 0) {
        adjustedPage = parseFloat(current_page) - 1;
      }

      if (type == "save") {
        // Send message to queue
        await sendToQueue(
          JSON.stringify({
            intent: figoEditItemQueue,
            payload: { wa_id, ...body, account_id },
          })
        );

        let find_items = await FigoStockModel.find({
          business: account_id,
        }).sort({ updatedAt: -1 });

        const { data, hasNext, hasPrevious, range } = paginateList(
          find_items,
          adjustedPage,
          limit
        );

        find_items = data.map((e) => {
          return {
            id: e._id,
            title: e.name,
            description: `${e.level} in stock`,
            metadata: `₦${AmountSeparator(e.price)} per ${e.unit || "unit"}`,
          };
        });

        return {
          ...FIGO_SCREEN_RESPONSES.PRODUCTS,
          data: {
            items: find_items,
            is_loaded: data.length > 0,
            is_next: hasNext,
            is_previous: hasPrevious,
            current_page: `${adjustedPage}`,
            header: `Inventory ${range}`,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoManageStaff = async (body) => {
  try {
    const { flow_token, type, init_staff, staff } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.MORE,
        };
      }

      if (type == "save") {
        const staff_to_remove_ids = staff
          .filter((e) => !init_staff.includes(e.id))
          .map((e) => e.id);

        await FigoBusinessModel.updateOne(
          { _id: account_id },
          { $pull: { staff: { _id: { $in: staff_to_remove_ids } } } }
        );

        for (const id of staff_to_remove_ids) {
          if (id && id !== account_id) {
            const userStaff = await FigoUserModel.findOne({ _id: id });

            //Remove staff access
            await redisClient.set(
              `figo_staff_${userStaff.mobile}_${account_id}`,
              ""
            );
          }
        }
        return await FigoMore({ flow_token, type: "manage_staff" });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoAddStaff = async (body) => {
  try {
    const { flow_token, type, mobile: staff_mobile, name: staff_name } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      if (wa_id == staff_mobile) {
        return {
          ...FIGO_SCREEN_RESPONSES.ADD_STAFF,
          data: {
            message: "You cannot invite yourself.",
          },
        };
      }

      if (type == "save") {
        const find_business = await FigoBusinessModel.findOne({
          _id: account_id,
        }).populate("user");

        const invite_flow_token = uuidv4();

        await redisClient.set(
          `figo_flow_token_${invite_flow_token}`,
          staff_mobile
        );

        //TODO SEND TEMPLATE MSG
        await SendFigoInvitation({
          wa_id: staff_mobile,
          header: `Figo Invitation`,
          body: `${
            find_business?.name ||
            find_business?.mobile ||
            find_business?.user?.mobile
          }`,
          message: `${
            find_business?.name ||
            find_business?.mobile ||
            find_business?.user?.mobile
          } wants you to join their staff on Figo`,
          name: staff_name,
          mobile: staff_mobile,
          flow_token: invite_flow_token,
          account_id,
        });

        return SuccessScreen({
          title: "Manage staff",
          heading: "Your invitation has been sent successfully",
          message: ``,
          type: "goBack",
          init_option: "MANAGE_STAFF",
        });
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    console.log(error?.data?.error?.[0]);
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoStaffInvite = async (body) => {
  try {
    const {
      flow_token,
      type,
      mobile: staff_mobile,
      name: staff_name,
      account_id,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    if (wa_id == staff_mobile) {
      if (type == "accept") {
        const user = await FigoUserModel.findOne({
          mobile: wa_id,
        }).populate("");

        if (user) {
          await FigoBusinessModel.updateOne(
            {
              _id: account_id,
            },
            {
              $addToSet: {
                staff: {
                  _id: user._id,
                  name: staff_name,
                },
              },
            }
          );

          //Send to Queue
          await sendToQueue(
            JSON.stringify({
              intent: "figoAccountDataQueue",
              payload: { wa_id },
            })
          );

          await fetch(`${RAG_API_URL}/trigger/contact_ingest`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              businessId: account_id,
              role: "Staff",
              customerId: user._id,
            }),
          });
        } else {
          //Send to Queue
          await sendToQueue(
            JSON.stringify({
              intent: "figoAccountDataQueue",
              payload: { wa_id, staff: { account_id, name: staff_name } },
            })
          );
        }

        return SuccessScreen({
          title: "Confirmation",
          heading: "Your Invitation has been confirmed",
          message: ``,
          init_option: "any",
        });
      }

      if (type == "reject") {
        // const businessUser = await FigoBusinessModel.findOne({
        //   _id: account_id,
        // }).populate("user");

        // await SendFigoReminder({
        //   wa_id: businessUser.user.mobile,
        //   header: "Figo Invitation",
        //   body: ` This is to notify you that ${staff_name} has rejected your staff invitation.`,
        // });

        return ErrorScreen({
          heading: `Thank you for letting us know.`,
        });
      }
    } else {
      return ErrorScreen({
        heading: `An error occured. Please contact the business owner or Figo support.`,
      });
    }
  } catch (error) {
    return ErrorScreen({ heading: `${error}` });
  }
};

export const FigoAppSettings = async (body) => {
  try {
    const {
      flow_token,

      type,
      business_name,
      business_phone,
      images_A,
      images_B,
    } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      let logo_key;

      if (type == "save") {
        if (!!images_A?.length || !!images_B?.length) {
          let images = images_A || images_B;

          let image = images[0];

          const decryptedMedia = await processEncryptedMedia({
            encryptionKey: image?.encryption_metadata?.encryption_key,
            hmacKey: image.encryption_metadata?.hmac_key,
            iv: image.encryption_metadata?.iv,
            expectedPlaintextHash: image.encryption_metadata?.plaintext_hash,
            expectedEncryptedHash: image.encryption_metadata?.encrypted_hash,
            imageUrl: image.cdn_url,
            fileName: image.file_name,
          });
          //Upload to aws and update database
          logo_key = `${account_id}_${new Date().getTime()}`;

          await UploadToAWS({
            Body: decryptedMedia,
            Key: logo_key, //`${uuidv4()}.png`,
            ContentType: "application/octet-stream",
          });

          await FigoBusinessModel.updateOne(
            { _id: account_id },
            {
              $set: {
                mobile: business_phone,
                name: business_name,
                logo: logo_key,
              },
            }
          );
        } else {
          await FigoBusinessModel.updateOne(
            { _id: account_id },
            {
              $set: {
                mobile: business_phone,
                name: business_name,
              },
            }
          );
        }

        const business = await FigoBusinessModel.findOne({ _id: account_id });

        let business_logo = business.logo
          ? await FileFromAWS(business.logo)
          : "";

        //Update openseach
        await fetch(`${RAG_API_URL}/trigger/business_ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: account_id,
          }),
        });

        return {
          ...FIGO_SCREEN_RESPONSES.APP_SETTINGS,
          data: {
            is_owner: true,
            business_name: business.name,
            business_phone: business.mobile,
            business_logo: business_logo,
          },
        };
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoResetData = async (body) => {
  try {
    const { flow_token, type } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const user = await FigoUserModel.findOne({ mobile: wa_id });

      if (account_id.toString() !== user._id.toString())
        return ErrorScreen({
          title: "Delete business data",
          heading: "Access denied",
          message: `You're not authorized to take this action`,
          init_option: "more",
        });

      await sendToQueue(
        JSON.stringify({
          intent: "figoDeleteAccountData",
          payload: {
            wa_id,
            account_id,
          },
        })
      );

      return {
        ...FIGO_SCREEN_RESPONSES.HOME,
        data: {
          ...FIGO_SCREEN_RESPONSES.HOME.data,
          scope: "reload",
          init_option: "take_stock",
          today: new Date().toISOString().slice(0, 10),
          account_stat: FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat,
        },
      };
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoSubscription = async (body) => {
  try {
    const { flow_token, type, email } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      let param_email = email;

      const user = await FigoUserModel.findOne({ mobile: wa_id });
      const business = await FigoBusinessModel.findOne({
        _id: account_id,
      }).populate("user");

      //Owner
      if (user._id.toString() === business.user._id.toString()) {
        if (!user.email && param_email) {
          user.email = param_email;
          await user.save();
        }
      }

      let subscription_id = new mongoose.Types.ObjectId();

      await FigoSubscriptionModel.insertOne({
        _id: subscription_id,
        email: param_email || business.user.email,
        user,
        business,
      });

      return {
        ...FIGO_SCREEN_RESPONSES.PAY,
        data: {
          url: `https://main.d32rhz7kbqseiy.amplifyapp.com/pay/${subscription_id}`,
          pay_label: "Pay ₦500 only",
        },
      };
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoSpin = async (body) => {
  try {
    const { flow_token, winners, business_name, prizes } = body;

    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type !== "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      let ref = customId(4).toUpperCase();

      const editor = await FigoUserModel.findOne({ mobile: wa_id });

      await FigoSpinModel.insertOne({
        slot: parseInt(winners?.[0] || "1"),
        prizes,
        editor: editor,
        business: account_id,
        ref,
      });

      if (business_name) {
        await FigoBusinessModel.updateOne(
          { _id: account_id },
          { $set: { name: business_name } }
        );
      }

      return {
        ...FIGO_SCREEN_RESPONSES.SPIN_SHARE,
        data: {
          url: `https://wa.me/send?text=Spin-to-Win%20on%20Figo%20https%3A%2F%2Fwa.me%2F2348107170850%3Ftext%3DLucky%2520Spin%2520${ref}`,
          share_string: `*[Share this with your customers on WhatsApp to spin and win prizes from you.](https://wa.me/send?text=Spin-to-Win%20on%20Figo%20https%3A%2F%2Fwa.me%2F2348107170850%3Ftext%3DLucky%2520Spin%2520${ref})*`,
        },
      };
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

export const FigoSpinHome = async (body) => {
  try {
    const { flow_token, btn_label, type } = body;

    let spin_flow = await redisClient.get(`figo_spin_flow_token_${flow_token}`);

    const spin_ref = spin_flow.split("/")?.[0];
    const wa_id = spin_flow.split("/")?.[1];

    const spin = await FigoSpinModel.findOne({ ref: spin_ref }).populate(
      "business"
    );

    if (spin_ref && spin) {
      let dataPayload = {
        url: `https://wa.me/send?text=Spin-to-Win%20on%20Figo%20https%3A%2F%2Fwa.me%2F2348107170850%3Ftext%3DLucky%2520Spin%2520${spin_ref}`,
        share_string: `*[Share this with your customers on WhatsApp to spin and win prizes from you.](https://wa.me/send?text=Spin-to-Win%20on%20Figo%20https%3A%2F%2Fwa.me%2F2348107170850%3Ftext%3DLucky%2520Spin%2520${spin_ref})*`,
        business_name: spin.business?.name || "",
        current_state: "start_spin",
        result_heading: "",
        result_msg: "",
        result_image: "",
        btn_label: "Continue",
      };

      switch (type) {
        case "start_spin": {
          return {
            screen: "SPIN_HOME",
            data: {
              ...dataPayload,
              current_state: "stop_spin",
            },
          };
        }
        case "stop_spin": {
          const prizes = spin.prizes;
          const probabilityOfNoPrize = 0.1; // 60% chance of no prize
          const randomNum = Math.random();
          let prize_won = 0;

          if (randomNum < probabilityOfNoPrize) {
            //No prize won
          } else {
            const prizeIndex = Math.floor(
              ((randomNum - probabilityOfNoPrize) /
                (1 - probabilityOfNoPrize)) *
                prizes.length
            );
            console.log(prizes[prizeIndex]); // Valid prize
            prize_won = prizes[prizeIndex];
          }

          const pz_message = {
            5: "You've won a 5% discount on your next purchase.\n\nOffer is valid for 24 hrs.",
            10: "You've won a 10% discount on your next purchase.\n\nOffer is valid for 24 hrs.",
            50: "You've won a 50% discount on your next purchase.\n\nOffer is valid for 24 hrs.",
            500: "You've won NGN500 on your next purchase.\n\nOffer is valid for 24 hrs.",
            1000: "You've won NGN1000 on your next purchase.\n\nOffer is valid for 24 hrs.",
            delivery:
              "You've won a free delivery on your next purchase.\n\nOffer is valid for 24 hrs.",
            freebies:
              "You've won freebies on your next purchase.\n\nOffer valid for 24 hrs.",
            bogo: "Buy one, get one free on your next purchase.\n\nOffer is valid for 24 hrs.",
          };

          let pz_images = {
            5: five_wheel,
            10: ten_wheel,
            50: fifty_wheel,
            500: five_h_wheel,
            1000: one_k_wheel,
            delivery: free_delivery_wheel,
            freebies: freebies_wheel,
            bogo: bogo_wheel,
          };

          console.log(prize_won, "prize_won");

          if (!!prize_won) {
            dataPayload.result_heading = "Congratulations 🎉🎉🎉🎉";
            dataPayload.result_msg = pz_message[prize_won];
            dataPayload.result_image = pz_images[prize_won];
            dataPayload.btn_label = "Start shopping";

            await FigoCartModel.updateOne(
              {
                wa_id,
                business: spin.business._id,
              },
              {
                $set: { prize: prize_won, type: "spin" },
              },
              { upsert: true }
            );
          } else {
            dataPayload.result_heading = "";
            dataPayload.result_msg = "You didn't win anything this time";
            dataPayload.result_image = empty_wheel;
            dataPayload.btn_label = "Try again";
          }

          return {
            screen: "SPIN_HOME",
            data: {
              ...dataPayload,
              current_state: "result",
            },
          };
        }

        case "result": {
          if (btn_label == "Try again") {
            return {
              screen: "SPIN_HOME",
              data: {
                ...dataPayload,
                current_state: "stop_spin",
              },
            };
          }
          let find_items = await FigoStockModel.find({
            business: spin.business._id,
            level: { $gte: 1 },
          })
            .sort({ updatedAt: -1 })
            .limit(2);

          const cart = await FigoCartModel.findOne({
            wa_id,
            business: spin.business._id,
          });

          if (!!find_items?.length) {
            let quantity_available_a = [];
            let quantity_available_b = [];

            find_items = find_items.map((e, i) => {
              const targetValue = Math.min(e.level, 10);
              for (let value = 0; value <= targetValue; value++) {
                if (i == 0) {
                  quantity_available_a.push({
                    id: `${value}`,
                    title: `${value}`,
                  });
                }
                if (i == 1) {
                  quantity_available_b.push({
                    id: `${value}`,
                    title: `${value}`,
                  });
                }
              }
              return {
                id: e._id,
                title: e.name,
                description: `${e.level} in stock`,
                metadata: "NGN" + AmountSeparator(e.price),
                image: "",
                "on-select-action": {
                  name: "update_data",
                  payload: {
                    quantity_available:
                      i == 0
                        ? "${data.quantity_available_a}"
                        : "${data.quantity_available_b}",
                    show_quantity: e.level > 0 ? true : false,
                  },
                },
              };
            });

            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: true,
                items: find_items,
                quantity_available_a,
                quantity_available_b,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          } else {
            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: false,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          }
        }

        default:
          break;
      }
    } else {
      return {
        screen: "COMPLETE",
      };
    }
  } catch (error) {
    return {
      screen: "COMPLETE",
    };
  }
};

export const FigoSpinShop = async (body) => {
  try {
    const { flow_token, type, keyword, item, quantity } = body;

    let spin_flow = await redisClient.get(`figo_spin_flow_token_${flow_token}`);

    const spin_ref = spin_flow.split("/")?.[0];
    const wa_id = spin_flow.split("/")?.[1];

    const spin = await FigoSpinModel.findOne({ ref: spin_ref });

    if (spin_ref && spin) {
      const cart = await FigoCartModel.findOne({
        wa_id,
        business: spin.business._id,
      });

      switch (type) {
        case "search": {
          let find_items = await QueryOpenSearch({
            size: 2,
            index: "product",
            filter: [{ term: { businessId: spin.business } }],
            must: [
              {
                match: {
                  text: {
                    query: keyword || "a",
                    fuzziness: 2,
                  },
                },
              },
            ],
          });

          if (!!find_items.length) {
            let quantity_available_a = [];
            let quantity_available_b = [];

            find_items = find_items
              .filter(
                (item, index, self) =>
                  index ===
                  self.findIndex((t) => t.ProductId === item.ProductId)
              )
              .map((e, i) => {
                const targetValue = Math.min(e.QuantityAvailable, 10);
                for (let value = 0; value <= targetValue; value++) {
                  if (i == 0) {
                    quantity_available_a.push({
                      id: `${value}`,
                      title: `${value}`,
                    });
                  }
                  if (i == 1) {
                    quantity_available_b.push({
                      id: `${value}`,
                      title: `${value}`,
                    });
                  }
                }

                return {
                  id: e.ProductId,
                  title: e.ProductName || e.ServiceName,
                  description: `${e.QuantityAvailable} in stock`,
                  metadata: e?.Price || "",
                  image: "",
                  "on-select-action": {
                    name: "update_data",
                    payload: {
                      quantity_available:
                        i == 0
                          ? "${data.quantity_available_a}"
                          : "${data.quantity_available_b}",
                      show_quantity: e.QuantityAvailable > 0 ? true : false,
                    },
                  },
                };
              });

            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: true,
                items: find_items,
                quantity_available_a,
                quantity_available_b,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          } else {
            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: false,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          }
        }

        case "add_to_cart": {
          const product = await FigoStockModel.findOne({ _id: item });

          const afterCartUpdate = await FigoCartModel.updateOne(
            {
              wa_id,
              business: spin.business,
            },
            {
              $addToSet: {
                item: {
                  _id: item,
                  quantity: parseInt(quantity?.[0] || "1"),
                  price: product.price,
                },
              },
            },
            { returnDocument: "after" }
          );

          let find_items = await QueryOpenSearch({
            size: 2,
            index: "product",
            filter: [{ term: { businessId: spin.business } }],
            must: [
              {
                match: {
                  text: {
                    query: keyword || "a",
                    fuzziness: 2,
                  },
                },
              },
            ],
          });

          if (!!find_items.length) {
            let quantity_available_a = [];
            let quantity_available_b = [];
            find_items = find_items
              .filter(
                (item, index, self) =>
                  index ===
                  self.findIndex((t) => t.ProductId === item.ProductId)
              )
              .map((e, i) => {
                const targetValue = Math.min(e.QuantityAvailable, 10);
                for (let value = 0; value <= targetValue; value++) {
                  if (i == 0) {
                    quantity_available_a.push({
                      id: `${value}`,
                      title: `${value}`,
                    });
                  }
                  if (i == 1) {
                    quantity_available_b.push({
                      id: `${value}`,
                      title: `${value}`,
                    });
                  }
                }

                return {
                  id: e.ProductId,
                  title: e.ProductName || e.ServiceName,
                  description: `${e.QuantityAvailable} in stock`,
                  metadata: e?.Price || "",
                  image: "",
                  "on-select-action": {
                    name: "update_data",
                    payload: {
                      quantity_available:
                        i == 0
                          ? "${data.quantity_available_a}"
                          : "${data.quantity_available_b}",
                      show_quantity: e.QuantityAvailable > 0 ? true : false,
                    },
                  },
                };
              });

            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: keyword ? true : false,
                items: find_items,
                quantity_available_a,
                quantity_available_b,
                cart:
                  afterCartUpdate?.item?.length > 0
                    ? `🛒 ${afterCartUpdate.item.length} Items in Cart →`
                    : "",
              },
            };
          } else {
            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: false,
                cart:
                  afterCartUpdate?.item?.length > 0
                    ? `🛒 ${afterCartUpdate.item.length} Items in Cart →`
                    : "",
              },
            };
          }
        }

        case "checkout": {
          const cart = await FigoCartModel.findOne({
            wa_id,
            business: spin.business._id,
          }).populate("item._id");

          let items;

          if (!!cart.item?.length) {
            items = cart.item.map((item) => {
              return {
                id: item._id._id,
                title: item._id.name,
                description: `${item.quantity} X ${item.price}`,
                metadata: "⊖ Remove",
                image: "",
              };
            });

            return {
              screen: "SPIN_CHECKOUT",
              data: {
                is_loaded: true,
                prize: "",
                subtotal: "",
                total: "",
                items,
              },
            };
          } else {
            return {
              screen: "SPIN_CHECKOUT",
              data: {
                is_loaded: false,
              },
            };
          }
        }

        default:
          break;
      }
    } else {
      return {
        screen: "COMPLETE",
      };
    }
  } catch (error) {
    console.log(error);
    return {
      screen: "COMPLETE",
    };
  }
};

export const FigoSpinCheckout = async (body) => {
  try {
    const { flow_token, type, keyword, items, quantity } = body;

    let spin_flow = await redisClient.get(`figo_spin_flow_token_${flow_token}`);

    const spin_ref = spin_flow.split("/")?.[0];
    const wa_id = spin_flow.split("/")?.[1];

    const spin = await FigoSpinModel.findOne({ ref: spin_ref });

    if (spin_ref && spin) {
      const cart = await FigoCartModel.findOne({
        wa_id,
        business: spin.business._id,
      });

      switch (type) {
        case "continue_shopping": {
          let find_items = await QueryOpenSearch({
            size: 2,
            index: "product",
            filter: [{ term: { businessId: spin.business } }],
            must: [
              {
                match: {
                  text: {
                    query: keyword || "a",
                    fuzziness: 2,
                  },
                },
              },
            ],
          });

          if (!!find_items.length) {
            let quantity_available = [{ id: "0", title: "0" }];
            find_items = find_items.map((e, i) => {
              if (i < 11) {
                quantity_available.push({
                  id: `${i + 1}`,
                  title: `${i + 1}`,
                });
              }

              return {
                id: e.ProductId,
                title: e.ProductName || e.ServiceName,
                description: `${e.QuantityAvailable} in stock`,
                metadata: "NGN" + AmountSeparator(e.Price),
                image: "",
              };
            });

            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: true,
                items: find_items,
                quantity_available,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          } else {
            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: false,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          }
        }

        case "remove_item": {
          const cart = await FigoCartModel.findOne({
            wa_id,
            business: spin.business,
          }).populate("item._id");

          let newItems = cart.item.filter((e) => items.includes(e._id._id));

          await FigoCartModel.updateOne(
            {
              wa_id,
              business: spin.business,
            },
            {
              $unset: {
                item: "",
              },
            }
          );

          await FigoCartModel.updateOne(
            {
              wa_id,
              business: spin.business,
            },
            {
              $set: {
                item: newItems,
              },
            }
          );

          let subtotal = newItems.reduce(
            (acc, item) => acc + item.quantity * item.price,
            0
          );

          let discounted_pz = {
            5: (5 / 100) * subtotal,
            10: (10 / 100) * subtotal,
            50: (50 / 100) * subtotal,
            500: 500,
            1000: 1000,
            delivery: "✨ Free delivery included",
            freebies: "✨ Freebies included",
            bogo: "✨ Buy one, get one free",
          };

          let totalCost = subtotal;
          let prize;

          if (["5", "10", "50", "500", "1000"].includes(spin.prize)) {
            prize = `✨ Discount: NGN${AmountSeparator(
              discounted_pz[spin.prize]
            )}`;
            totalCost = subtotal - discounted_pz[spin.prize];
          }

          if (["delivery", "freebies"].includes(spin.prize)) {
            prize = discounted_pz[spin.prize];
          }

          // if (["bogo"].includes(spin.prize)) {
          //   prize = discounted_pz[spin.prize];
          // }

          return {
            screen: "SPIN_CHECKOUT",
            data: {
              is_loaded: !!newItems?.length ? true : false,
              items: newItems,
              pay_label: "Pay NGN" + totalCost,
              prize,
              subtotal: `NGN${subtotal}`,
              total: `NGN${totalCost}`,
            },
          };
        }

        case "pay": {
          const cart = await FigoCartModel.findOne({
            wa_id,
            business: spin.business._id,
          }).populate("item._id");

          let items;

          if (!!cart.item?.length) {
            items = cart.item.map((item) => {
              return {
                id: item._id._id,
                title: item._id.name,
                description: `${item.quantity} X ${item._id.price}`,
                metadata: "⊖ Remove",
                image: "",
              };
            });

            return {
              screen: "SPIN_CHECKOUT",
              data: {
                prize: "",
                subtotal: "",
                total: "",
                items,
              },
            };
          } else {
            return {
              screen: "SPIN_SHOP",
              data: {
                is_loaded: false,
                cart:
                  cart?.item?.length > 0
                    ? `🛒 ${cart.item.length} Items in Cart →`
                    : "",
              },
            };
          }
        }

        default:
          break;
      }
    } else {
      return {
        screen: "COMPLETE",
      };
    }
  } catch (error) {
    return {
      screen: "COMPLETE",
    };
  }
};

export const FigoPayStatus = async (body) => {
  try {
    const { _id } = body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return { success: false, message: "Error" };
    }

    const subscription = await FigoSubscriptionModel.findOne({
      _id,
      complete: false,
    }).populate("user business");

    if (!subscription) {
      return { success: false, message: "Not found" };
    }

    const _active = await FigoBusinessModel.findOne({
      _id: subscription.business._id,
      subscription: {
        $elemMatch: {
          user: subscription.user._id,
          is_active: true,
        },
      },
    }).populate("user");

    if (_active) {
      return { success: false, message: "User is currently subscribed" };
    } else {
      return {
        success: true,
        message: "Proceed to pay",
        email: subscription.email,
        mobile: subscription.user.mobile,
      };
    }
  } catch (error) {
    console.log(error);
    return {
      success: false,
      message: "Error",
    };
  }
};

export const FigoPayHook = async (body) => {
  try {
    const {
      type,
      data: { referenceCode },
    } = body;

    if (type !== "checkout.payment") return;

    const sfh_access_token = await Sfh_Token();

    let verifyTnx = await fetch(
      `${SFH_ENDPOINT}/checkout/${referenceCode}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sfh_access_token}`,
          "Content-Type": "application/json",
          ClientID: SFH_CLIENT_ID,
        },
      }
    );

    verifyTnx = await verifyTnx.json();
    console.log(verifyTnx, "verify");
    if (verifyTnx?.statusCode !== 200) return;
    const {
      amount,
      currencyCode,
      status,
      metadata: { _id },
    } = verifyTnx.data;

    const subscription = await FigoSubscriptionModel.findOne({ _id }).populate(
      "user"
    );

    if (!subscription || subscription?.complete) return;

    subscription.complete = true;
    await subscription.save();

    const user = subscription.user;

    const business = await FigoBusinessModel.findOne({
      _id: subscription.business,
    }).populate("user");

    if (amount !== 500 || currencyCode !== "NGN" || status !== "Paid") {
      await SendFigoReminder({
        wa_id: user.mobile,
        header: "Subscription",
        body: "There is a problem with your payment. Please contact support.",
      });
      return;
    }

    const today = dayjs();
    const endDate = dayjs(today).add(30, "day").hour(19).startOf("hour");
    //9PM WAT or 8pm gmt+0

    const twentyEightDaysLater = dayjs(today)
      .add(28, "day")
      .hour(9)
      .startOf("hour"); //10am am WAT or 9pm gmt+0

    await Promise.all([
      FigoBusinessModel.updateOne(
        {
          _id: business,
        },
        {
          $push: {
            subscription: {
              user: user,
              start_date: new Date(),
              end_date: endDate.toDate(),
              is_active: true,
            },
          },
        }
      ),

      SendFigoReminder({
        wa_id: user.mobile,
        header: "✅ Subscription",
        body: `Payment received. Your subscription is now active and will expire on ${toTimeZone(
          endDate
        )}. Thank you.`,
      }),

      //Send Sub Reminder
      await scheduleReminder({
        when: getScheduleExpression(twentyEightDaysLater, "cron"),
        detail: {
          businessName: business.name || business.user.mobile,
          wa_id: user.mobile,
        },
        rule: `sr-${user._id.toString()}-${business._id.toString()}`,
        eventType: "subscription-reminder",
      }),

      //Send Sub Termination
      await scheduleReminder({
        when: getScheduleExpression(endDate, "cron"),
        detail: {
          user: user._id,
          end: true,
          business: business._id,
        },
        rule: `se-${user._id.toString()}-${business._id.toString()}`,
        eventType: "subscription-reminder",
      }),
    ]);
  } catch (error) {
    console.log(error);
  }
};

export const FigoReferralCode = async (body) => {
  try {
    console.log(body);
    const { wa_id } = body;

    const referral_code = body.referral_code?.trim() || "";

    const referrer = await FigoReferralModel.findOne({
      referral_code,
      active: true,
    }).populate("user");

    if (!referrer) {
      await sendToWA({
        message: "Invalid referral code",
        wa_id,
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
      });
      throw new Error("Invalid referral code");
    }

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    console.log(user, "explain");

    if (user.mobile == referrer.user.mobile) {
      await sendToWA({
        message:
          "You cannot use your own referral code. Share it with another business.",
        wa_id,
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
      });
      throw new Error("Can't use your own Referral code");
    }

    if (user.referrer) {
      await sendToWA({
        message: "A referrer is already linked to your account.",
        wa_id,
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
      });
      throw new Error("Referral code linked already");
    } else {
      user.referrer = referrer.user._id;
      await user.save();
      await sendToWA({
        message: "Hey, your referral code is valid. How can I help you today?",
        wa_id,
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
      });

      //Ingest Referral
      await fetch(`${RAG_API_URL}/trigger/referral_ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: referrer.user._id.toString(),
          referralCode: referral_code,
          user: {
            _id: user._id.toString(),
            name: user.name,
            mobile: wa_id,
          },
        }),
      });
    }

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
};

export const FigoSpinCode = async (body) => {
  try {
    const { wa_id } = body;

    const spin_code = body.referral_code?.trim() || "";

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const spin = await FigoSpinModel.findOne({
      ref: spin_code,
      createdAt: { $gte: oneDayAgo },
      complete: false,
    }).populate("business");

    if (!spin) {
      await sendToWA({
        message: "Invalid spin code",
        wa_id,
        PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
      });
      throw new Error("Invalid spin code");
    }

    const flow_token = uuidv4();

    await redisClient.set(
      `figo_spin_flow_token_${flow_token}`,
      spin.ref + "/" + wa_id
    );

    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
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
            text: "Spin-to-Win 🎡",
          },
          body: {
            text: "Win free delivery, discounts, freebies and more prizes from your vendor.",
          },
          footer: {
            text: spin.business?.name || "Figo by Carrot",
          },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: flow_token,
              flow_id: "1298064171766874",
              flow_cta: "Spin now",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "SPIN_HOME",
                data: {
                  business_name: spin.business?.name || "",
                  url: `https://wa.me/send?text=Spin-to-Win%20on%20Figo%20https%3A%2F%2Fwa.me%2F2348107170850%3Ftext%3DLucky%2520Spin%2520${spin.ref}`,
                  share_string: `*[Share this with your customers on WhatsApp to spin and win prizes from you.](https://wa.me/send?text=Spin-to-Win%20on%20Figo%20https%3A%2F%2Fwa.me%2F2348107170850%3Ftext%3DLucky%2520Spin%2520${spin.ref})*`,
                  current_state: "start_spin",
                  result_heading: "",
                  result_msg: "",
                  result_image: "",
                },
              },
            },
          },
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
};

export const FigoAddReferralCode = async (body) => {
  try {
    const { wa_id, referral_code } = body;

    const user = await FigoUserModel.findOne({ mobile: wa_id });

    if (!user) throw new Error("No user found. At Add referral code");

    await FigoReferralModel.insertOne({
      referral_code,
      user,
    });

    //Ingest Referral
    // await fetch(`${RAG_API_URL}/trigger/referral_ingest`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     businessId: user._id.toString(),
    //     referralCode: referral_code,
    //     user: {
    //       _id: "",
    //       name: "",
    //       mobile: "",
    //     },
    //   }),
    // });

    return { success: true, message: "Done" };
  } catch (error) {
    return { success: false, message: error };
  }
};

export const FigoWallet = async (body) => {
  try {
    const { flow_token, type, account_number, bank_code, active, pin } = body;

    const amount = parseFloat(body.amount);
    const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

    let account_id = await redisClient.get(`figo_active_account_${wa_id}`);

    const WalletError = ({ message }) => {
      return {
        ...FIGO_SCREEN_RESPONSES.WALLET,
        data: {
          ...FIGO_SCREEN_RESPONSES.WALLET.data,
          active: "transfer",
          balance,
          pin_memo: "",
          account_name: "",
          narration: message,
          account_number,
          bank_code,
          amount: body.amount,
        },
      };
    };

    if (wa_id) {
      const staff_access = await FigoStaffAccess({ wa_id, account_id });

      if (!staff_access && type != "back")
        return ErrorScreen({
          heading: "Access denied",
          message: `You'll need staff access to take this action`,
        });

      if (type == "back") {
        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            init_option: "wallet",
            scope: "reload",
            today: new Date().toISOString().slice(0, 10),
          },
        };
      }

      if (!mongoose.Types.ObjectId.isValid(account_id)) {
        const { _id } = await FigoUserModel.findOne({ mobile: account_id });
        account_id = _id;
      }

      const user = await UserModel.findOne({ mobile: wa_id }); //Carrot User

      let generateWallet = await fetch(`${QUEUE_API_URL}/generate_wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_balance: `₦${AmountSeparator(user.account_balance || 0)}`,
          account_number: "",
        }),
      });

      let balance = await generateWallet.json();

      if (type == "transfer") {
        if (user.pin) {
          const isMatch = await bcrypt.compare(pin, user?.pin || "");
          if (!isMatch) {
            return WalletError(`Incorrect PIN. Try again`);
          }
        } else {
          user.pin = pin;
          await user.save();
        }

        if (user.account_balance < amount) {
          return WalletError(`Insufficient balance to complete this transfer`);
        }

        //Resolve account name
        const sfh_access_token = await Sfh_Token();

        const transaction_id = new mongoose.Types.ObjectId();

        let payment_ref = customId({
          name: user._id.toString(),
          email: sfh_access_token,
          randomLength: 2,
        });

        let resolveName = await fetch(
          `${SFH_ENDPOINT}/transfers/name-enquiry`,
          {
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
          }
        );
        resolveName = await resolveName.json();

        if (resolveName?.statusCode !== 200) {
          return WalletError("Incorrect account details");
        }

        const transaction = {
          _id: transaction_id,
          payment_ref,
          misc: {
            name_enquiry: resolveName.data.sessionId,
            account_name: resolveName.data.accountName,
            account_number: resolveName.data.accountNumber,
            bank_code: resolveName.data.bankCode,
            debit_account: "0114974709",
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
            debitAccountNumber: "0114974709", //Peepee for shop
            amount,
            nameEnquiryReference: resolveName.data.sessionId,
            beneficiaryBankCode: resolveName.data.bankCode,
            beneficiaryAccountNumber: resolveName.data.accountNumber,
            saveBeneficiary: true,
          }),
        });

        Pay = await Pay.json();
        console.log(Pay, "Pay");

        if (Pay?.statusCode == 200) {
          console.log("Transfer success");

          const afterBalanceUpdate = await UserModel.updateOne(
            { _id: user._id },
            {
              $inc: {
                account_balance: -amount,
              },
            },
            { returnDocument: "after" }
          );

          await BalanceHistoryModel.insertOne({
            user: user,
            balanceBefore: afterBalanceUpdate.account_balance + amount,
            balanceAfter: afterBalanceUpdate.account_balance,
            type: HISTORY_TYPE.DEBIT,
            transaction: transaction_id,
            description: `Transfer to ${resolveName.data.accountName}`,
          });

          await TransactionModel.updateOne(
            { _id: transaction_id },
            {
              $set: {
                status: TRANSACTION_STATUS.SUCCESS,
                paymentReference: Pay.data.sessionId,
              },
            }
          );

          let history = await BalanceHistoryModel.find({
            user: user?._id,
          })
            .populate("transaction link")
            .sort({ updatedAt: -1 })
            .limit(5);

          if (!!history?.length) {
            history = history.map((e) => {
              return {
                id: e._id,
                title: e.description || "-",
                description: e?.transaction?.status || "",
                metadata: `₦${AmountSeparator(
                  e?.transaction?.amount || 0
                )} • ${dayjs(e.createdAt).format("MMM-DD-YYYY")}`,
                image:
                  FIGO_SCREEN_RESPONSES.WALLET.data?.history[0]?.image || "",
              };
            });

            let generateWallet = await fetch(
              `${QUEUE_API_URL}/generate_wallet`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  account_balance: `₦${AmountSeparator(
                    afterBalanceUpdate.account_balance || 0
                  )}`,
                  account_number: "",
                }),
              }
            );

            let newBalance = await generateWallet.json();

            return {
              ...FIGO_SCREEN_RESPONSES.WALLET,
              data: {
                ...FIGO_SCREEN_RESPONSES.WALLET.data,
                history,
                is_loaded: true,
                active: active || "recent",
                balance: newBalance,
                success: true,
              },
            };
          }
        } else {
          await TransactionModel.updateOne(
            { _id: transaction_id },
            {
              $set: {
                status: TRANSACTION_STATUS.FAILED,
              },
            }
          );
          return WalletError("Transfer failed");
        }
      }

      if (type == "resolve") {
        const sfh_access_token = await Sfh_Token();

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

        if (resolve.statusCode == 200) {
          return {
            ...FIGO_SCREEN_RESPONSES.WALLET,
            data: {
              ...FIGO_SCREEN_RESPONSES.WALLET.data,
              active: "transfer",
              balance,
              pin_memo: "Use a secure 6 digit number that you can remember.",
              account_name: resolve.data.accountName,
              narration: `Transfer ₦${AmountSeparator(amount)} to ${
                resolve.data.accountName
              }`,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.WALLET,
            data: {
              ...FIGO_SCREEN_RESPONSES.WALLET.data,
              active: "transfer",
              balance,
              account_name: resolve?.message || "Invalid account details",
              active: "transfer",
            },
          };
        }
      }

      if (type == "refresh") {
        let history = await BalanceHistoryModel.find({
          user: user?._id,
        })
          .populate("transaction link")
          .sort({ updatedAt: -1 })
          .limit(5);

        if (!!history?.length) {
          history = history.map((e) => {
            return {
              id: e._id,
              title: e.description || "-",
              description: e?.transaction?.status || "",
              metadata: `₦${AmountSeparator(
                e?.transaction?.amount || 0
              )} • ${dayjs(e.createdAt).format("MMM-DD-YYYY")}`,
              image: FIGO_SCREEN_RESPONSES.WALLET.data?.history[0]?.image || "",
            };
          });

          return {
            ...FIGO_SCREEN_RESPONSES.WALLET,
            data: {
              ...FIGO_SCREEN_RESPONSES.WALLET.data,
              history,
              is_loaded: true,
              active: active || "recent",
              balance,
            },
          };
        } else {
          return {
            ...FIGO_SCREEN_RESPONSES.WALLET,
            data: {
              ...FIGO_SCREEN_RESPONSES.WALLET.data,
              active: active || "none",
              balance,
            },
          };
        }
      }
    } else {
      return UpdateRequiredScreen({
        data: FIGO_SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      });
    }
  } catch (error) {
    return ErrorScreen({ message: `${error}` });
  }
};

const FigoStaffAccess = async ({ wa_id, account_id }) => {
  try {
    //const staff = await redisClient.get(`figo_staff_${wa_id}_${wa_id}`);
    const _staff = await redisClient.get(`figo_staff_${wa_id}_${account_id}`);

    if (!_staff) {
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.log(error);
  }
};

const FigoSubscriptionAccess = async ({ wa_id, account_id }) => {
  try {
    const business = await FigoBusinessModel.findOne({
      _id: account_id,
    }).populate("user subscription.user");

    if (business) {
      const activeSubscription = business.subscription.find(
        (sub) => sub.user?.mobile === wa_id && sub.is_active
      );

      return {
        is_subscribed: !!activeSubscription,
        email: business?.user?.email,
      };
    } else {
      return {
        is_subscribed: false,
        email: null,
      };
    }
  } catch (error) {
    console.log(error);
  }
};

export const SendFigoApp = async ({ wa_id, text }) => {
  try {
    const flow_token = uuidv4();

    await redisClient.set(`figo_flow_token_${flow_token}`, wa_id);

    //Send to Queue
    sendToQueue(
      JSON.stringify({
        intent: "figoAccountDataQueue",
        payload: {
          wa_id,
        },
      })
    );

    let figo_account_id_1 = await redisClient.get(`figo_account_id_1_${wa_id}`);
    let figo_account_id_2 = await redisClient.get(`figo_account_id_2_${wa_id}`);

    if (!figo_account_id_1) {
      //Enable staff access
      await redisClient.set(`figo_staff_${wa_id}_${wa_id}`, "true");

      //Set active account
      await redisClient.set(`figo_active_account_${wa_id}`, wa_id);
    }

    //name
    let figo_account_name_1 = await redisClient.get(
      `figo_account_name_1_${wa_id}`
    );
    let figo_account_name_2 = await redisClient.get(
      `figo_account_name_2_${wa_id}`
    );

    //stat
    let figo_account_stat = await redisClient.get(`figo_account_stat_${wa_id}`);

    figo_account_stat = figo_account_stat
      ? await FileFromAWS(figo_account_stat)
      : FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;

    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: wa_id,
        type: "interactive",
        interactive: {
          type: "flow",
          header: { type: "text", text: "Figo" },
          body: { text: `*${text}*` },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token,
              flow_id: "1860120724835856",
              flow_cta: "Open App",
              flow_action: "navigate",
              flow_action_payload: {
                screen: "LOGIN",
                data: {
                  account_name_1: figo_account_name_1 || wa_id,
                  account_name_2: figo_account_name_2 || "Business 2",
                  account_id_1: figo_account_id_1 || "",
                  account_id_2: figo_account_id_2 || "",
                  account_stat: figo_account_stat,
                  today: new Date().toISOString().slice(0, 10),
                  multi_account: !!figo_account_id_1 && !!figo_account_id_2,
                },
              },
            },
          },
        },
      },
    });
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
};

//  "account_id": "${screen.HOME.data.account_id}"
//  ₦
//  eval $(minikube docker-env)
