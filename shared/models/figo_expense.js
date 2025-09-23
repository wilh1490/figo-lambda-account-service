import mongoose from "mongoose";
import { FIGO_PAYMENT_METHOD } from "../config/statusError.js";

const IndexSchema = new mongoose.Schema(
  {
    date: Date,
    amount: {
      type: Number,
      default: 0,
    },
    description: { type: String, default: "" },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoSupplier",
    },
    editor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    payment_method: {
      enum: Object.values(FIGO_PAYMENT_METHOD),
      type: String,
      default: FIGO_PAYMENT_METHOD.CASH,
    },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoExpense", IndexSchema);
export default IndexModel;
