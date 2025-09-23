import mongoose from "mongoose";
import PLimit from "p-limit";
import {
  accountDataQueue,
  accountNumberQueue,
  figoAccountDataQueue,
  figoAddCustomerQueue,
  figoAddExpenseQueue,
  figoAddInvoiceQueue,
  figoAddItemQueue,
  figoAddMoneyQueue,
  figoAddSaleQueue,
  figoAddSupplierQueue,
  figoEditItemQueue,
  figoDeleteAccountData,
  finishTransactionQueue,
  moringaAccountDataQueue,
  moringafinishTransactionQueue,
  selfServiceQueue,
  sendBVNOTPQueue,
  sendNINOTPQueue,
  sendReceiptQueue,
  statementQueue,
  uploadIDQueue,
  uploadProfilePhoto,
  figoModifyInvoiceQueue,
  figoModifySaleQueue,
} from "./shared/config/statusError.js";

import {
  CompleteUploadID,
  CreateAccountNumber,
  FigoAccountData,
  FigoAddCustomer,
  FigoAddExpense,
  FigoAddInvoice,
  FigoAddItem,
  FigoAddMoney,
  FigoAddSale,
  FigoAddSupplier,
  FigoDeleteAccount,
  FigoEditItem,
  FigoExpiryReminder,
  FigoListNewInvoice,
  FigoListNewSale,
  FigoListRestock,
  FigoModifyInvoice,
  FigoModifySale,
  FigoRestockReminder,
  FigoSubReminder,
  FinishUploadProfilePhoto,
  GenerateStatement,
  MoringaAccountData,
  MoringaFinishTransaction,
  NewFinishTransaction,
  ProcessAccountData,
  SelfService,
  SendOtpToBVN,
  SendOtpToNIN,
  SendReceipt,
} from "./rabbitmq/consumers.js";
import { BrowserManager } from "./browser/index.js";
import { getSecrets } from "./shared/config/secrets.js";

let { DATABASE_URL: dbUri } = await getSecrets();

const pLimit = PLimit(5);

mongoose.Promise = global.Promise;

let conn = null;

mongoose.connection
  .on("error", (err) => console.error("Unable to connect to database", err))
  .on("close", () => console.log("Database connection closed."));

async function connectDB() {
  if (mongoose.connection.readyState === 1) return conn;
  conn = await mongoose.connect(dbUri, {});
  return conn;
}

async function processEvent(message) {
  const { intent, payload: msg } = message;
  const browser = BrowserManager.getBrowser();

  switch (intent) {
    case statementQueue:
      await GenerateStatement(msg);
      break;
    case accountNumberQueue:
      await CreateAccountNumber(msg);
      break;
    case sendBVNOTPQueue:
      await SendOtpToBVN(msg);
      break;
    case sendNINOTPQueue:
      await SendOtpToNIN(msg);
      break;
    case uploadProfilePhoto:
      await FinishUploadProfilePhoto(msg);
      break;
    case uploadIDQueue:
      await CompleteUploadID(msg);
      break;
    case finishTransactionQueue:
      await NewFinishTransaction(msg);
      break;
    case sendReceiptQueue:
      await SendReceipt(msg, browser);
      break;
    case accountDataQueue:
      await ProcessAccountData(msg);
      break;
    case selfServiceQueue:
      await SelfService(msg);
      break;
    case moringafinishTransactionQueue:
      await MoringaFinishTransaction(msg);
      break;
    case moringaAccountDataQueue:
      await MoringaAccountData(msg);
      break;
    case figoAccountDataQueue:
      await FigoAccountData(msg, browser);
      break;
    case figoAddItemQueue:
      await FigoAddItem(msg, browser);
      break;
    case figoAddCustomerQueue:
      await FigoAddCustomer(msg, browser);
      break;
    case figoAddSupplierQueue:
      await FigoAddSupplier(msg, browser);
      break;
    case figoAddExpenseQueue:
      await FigoAddExpense(msg, browser);
      break;
    case figoAddInvoiceQueue:
      await FigoAddInvoice(msg, browser);
      break;
    case figoModifyInvoiceQueue:
      await FigoModifyInvoice(msg, browser);
      break;
    case figoModifySaleQueue:
      await FigoModifySale(msg, browser);
      break;
    case figoAddSaleQueue:
      await FigoAddSale(msg, browser);
      break;
    case figoAddMoneyQueue:
      await FigoAddMoney(msg, browser);
      break;
    case figoEditItemQueue:
      await FigoEditItem(msg, browser);
      break;
    case figoDeleteAccountData:
      await FigoDeleteAccount(msg, browser);
      break;
    case "subscription-reminder":
      await FigoSubReminder(msg, browser);
      break;
    case "restock-alert":
      await FigoRestockReminder(msg, browser);
      break;
    case "expiry-alert":
      await FigoExpiryReminder(msg, browser);
      break;
    case "figoListRestock":
      await FigoListRestock(msg, browser);
      break;
    case "figoListNewSale":
      await FigoListNewSale(msg, browser);
      break;
    case "figoListNewInvoice":
      await FigoListNewInvoice(msg, browser);
      break;
    default:
      console.warn("Unknown intent:", intent);
      break;
  }
}

// 👇 Main Lambda entrypoint
export const handler = async (event, context) => {
  await connectDB();
  await BrowserManager.init();

  // event.Records comes from SQS trigger
  const results = await Promise.all(
    event.Records.map((record) =>
      pLimit(async () => {
        try {
          const body = JSON.parse(record.body || {});
          console.log("Processing message:", body);
          await processEvent(body);
          return { ok: true };
        } catch (err) {
          console.error("Error processing message:", err);
          return { ok: false, error: err.message };
        }
      })
    )
  );

  console.log("Queue Batch complete:", results);
  return {};
};
