import mongoose from "mongoose";
import { HISTORY_TYPE } from "../config/statusError.js";

const BalanceHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(HISTORY_TYPE),
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    link: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Link",
    },
    balanceBefore: Number,
    balanceAfter: Number,
    description: String,
    accountId: String,
  },
  { timestamps: true }
);

const BalanceHistoryModel = mongoose.model(
  "BalanceHistory",
  BalanceHistorySchema
);
export default BalanceHistoryModel;
