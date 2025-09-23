export const statusCode = {
  400: { name: "Bad request", code: 400 },
  401: { name: "Unauthorized", code: 401 },
  403: { name: "Forbidden", code: 403 },
  404: { name: "Not found", code: 404 },
  405: { name: "Method not allowed", code: 405 },
  409: { name: "Record conflict", code: 409 },
  422: { name: "Unprocessable entity", code: 422 },
  429: { name: "Too many requests.", code: 429 },
  500: { name: "Internal server error", code: 500 },
  501: { name: "Not implemented", code: 501 },
  503: { name: "Service unavailable", code: 501 },
  200: { name: "Success", code: 200 },
};

export const TRANSACTION_TYPE = Object.freeze({
  AIRTIME: "Airtime",
  DATA: "Mobile data",
  DEPOSIT: "Deposit",
  BILL: "Bill",
  REFUND: "Refund",
  TRANSFER: "Transfer",
  SEND_TO_PHONE: "Send_to_phone",
  ADD_CARD: "Add card",
  VIRTUAL_CARD_CREATION: "Virtual card creation",
  VIRTUAL_CARD_FUNDING: "Virtual card funding",
});

export const TRANSACTION_STATUS = Object.freeze({
  SUCCESS: "Success",
  PENDING: "Pending",
  FAILED: "Failed",
});

export const HISTORY_TYPE = Object.freeze({
  DEBIT: "Debit",
  CREDIT: "Credit",
});

export const FLW_STATUS = Object.freeze({
  ERROR: "error",
  SUCCESS: "success",
  SUCCESSFUL: "successful",
  FAILED: "failed",
  PENDING: "pending",
  COMPLETED: "completed",
});

export const ACTION_TYPES = Object.freeze({
  LAUNCH_ADD_CARD: "LAUNCH_ADD_CARD",
  LAUNCH_EXCHANGE_RATE: "LAUNCH_EXCHANGE_RATE",
  CREATE_VIRTUAL_CARD: "CREATE_VIRTUAL_CARD",
  FUND_VIRTUAL_CARD: "FUND_VIRTUAL_CARD",
  PERMANENT_NUBAN: "PERMANENT_NUBAN",
  PENDING_DEPOSIT: "PENDING_DEPOSIT",
});

export const FIGO_ITEM_TYPES = Object.freeze({
  PRODUCT: "Product",
  SERVICE: "Service",
});

export const FIGO_ENTRY_TYPES = Object.freeze({
  sale: "sale",
  stock: "stock",
  invoice: "invoice",
  expense: "expense",
  customer: "customer",
  supplier: "supplier",
  payment: "payment",
});

export const FIGO_PAYMENT_STATUS = Object.freeze({
  paid: "paid",
  unpaid: "unpaid",
  partially_paid: "partially_paid",
});

export const FIGO_PAYMENT_METHOD = Object.freeze({
  cash: "cash",
  transfer: "transfer",
  card: "card",
});
export const FIGO_STAT = Object.freeze({
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
});

export const statementQueue = "statementQueue";
export const accountNumberQueue = "accountNumberQueue";
export const sendBVNOTPQueue = "sendBVNOTPQueue";
export const sendNINOTPQueue = "sendNINOTPQueue";
export const uploadIDQueue = "uploadIDQueue";
export const finishTransactionQueue = "finishTransactionQueue";
export const moringafinishTransactionQueue = "moringafinishTransactionQueue";
export const sendReceiptQueue = "sendReceiptQueue";
export const uploadProfilePhoto = "uploadProfilePhoto";
export const accountDataQueue = "accountDataQueue";
export const moringaAccountDataQueue = "moringaAccountDataQueue";
export const selfServiceQueue = "selfServiceQueue";
export const figoAccountDataQueue = "figoAccountDataQueue";
export const figoAddItemQueue = "figoAddItemQueue";
export const figoAddCustomerQueue = "figoAddCustomerQueue";
export const figoAddSupplierQueue = "figoAddSupplierQueue";
export const figoAddSaleQueue = "figoAddSaleQueue";
export const figoAddInvoiceQueue = "figoAddInvoiceQueue";
export const figoAddExpenseQueue = "figoAddExpenseQueue";
export const figoAddMoneyQueue = "figoAddMoneyQueue";
export const figoEditItemQueue = "figoEditItemQueue";
export const figoDeleteAccountData = "figoDeleteAccountData";
export const figoModifyInvoiceQueue = "figoModifyInvoiceQueue";
export const figoModifySaleQueue = "figoModifySaleQueue";
