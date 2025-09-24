import mongoose from "mongoose";
import moongooseLong from "mongoose-long";
import { FIGO_PAYMENT_STATUS } from "../config/statusError.js";

moongooseLong(mongoose);

const { Schema, Types } = mongoose;
const { Long } = Schema.Types;

const IndexSchema = new mongoose.Schema(
  {
    date: Date,
    due_amount: {
      type: Long,
      default: Types.Long.fromNumber(0),
    },
    item: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FigoItem",
        },
        quantity: { type: Number, default: 1 },
        price: {
          type: Number,
          default: 0,
        },
      },
    ],
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoCustomer",
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    editor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    payment_status: {
      enum: Object.values(FIGO_PAYMENT_STATUS),
      type: String,
      default: FIGO_PAYMENT_STATUS.UNPAID,
    },
    active: {
      type: Boolean,
      default: true,
    },
    fees: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoSale", IndexSchema);
export default IndexModel;
