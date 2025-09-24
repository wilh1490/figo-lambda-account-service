import mongoose from "mongoose";
import { TRANSACTION_STATUS } from "../config/statusError.js";

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
    wallet: {
      type: String,
    },
    description: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MoringaUser",
    },
    type: {
      type: String,
    },
    misc: Object,
    balance_before: Number,
    balance_after: Number,
  },
  { timestamps: true }
);

const MoringaTransactionModel = mongoose.model(
  "MoringaTransaction",
  TransacSchema
);
export default MoringaTransactionModel;
