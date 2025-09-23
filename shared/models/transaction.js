import mongoose from "mongoose";
import { TRANSACTION_STATUS, TRANSACTION_TYPE } from "../config/statusError.js";

const TransacSchema = new mongoose.Schema(
  {
    payment_ref: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
    },
    amount: {
      type: Number,
      default: 0,
    },
    fee: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    description: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      enum: Object.values(TRANSACTION_TYPE),
      type: String,
    },
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
    misc: Object,
    balance_before: Number,
    balance_after: Number,
  },
  { timestamps: true }
);

const TransactionModel = mongoose.model("Transaction", TransacSchema);
export default TransactionModel;
