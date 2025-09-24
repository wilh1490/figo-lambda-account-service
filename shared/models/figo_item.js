import mongoose from "mongoose";
import { FIGO_ITEM_TYPES } from "../config/statusError.js";

const StockSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      default: "NGN",
    },
    name: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    unit: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
    },
    cost_price: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    image: {
      type: String,
      default: "",
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoSupplier",
    },
    expiry_date: Date,
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    editor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    type: {
      enum: Object.values(FIGO_ITEM_TYPES),
      type: String,
      default: FIGO_ITEM_TYPES.PRODUCT,
    },
  },
  { timestamps: true }
);

const FigoStockModel = mongoose.model("FigoItem", StockSchema);
export default FigoStockModel;
