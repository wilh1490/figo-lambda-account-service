import mongoose from "mongoose";
import moongooseLong from "mongoose-long";
import { FIGO_PAYMENT_METHOD } from "../config/statusError.js";

moongooseLong(mongoose);

const IndexSchema = new mongoose.Schema(
  {
    date: Date,
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoSale",
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    editor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    amount: {
      type: Number,
      default: 0,
    },
    description: { type: String, default: "" },
    payment_method: {
      enum: Object.values(FIGO_PAYMENT_METHOD),
      type: String,
      default: FIGO_PAYMENT_METHOD.CASH,
    },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoPayment", IndexSchema);
export default IndexModel;
