import mongoose from "mongoose";
import {
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from "../config/statusError.js";

const LinkSchema = new mongoose.Schema(
  {
    payment_ref: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
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
    active: {
      type: Boolean,
      default: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      enum: Object.values(TRANSACTION_TYPE),
      type: String,
    },

    misc: Object,
  },
  { timestamps: true }
);

const LinkModel = mongoose.model("Link", LinkSchema);
export default LinkModel;
