import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
  {
    date: Date,
    due_date: Date,
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
    payment_details: { type: String, default: "" },
    ref: { type: String, default: "" },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoInvoice", IndexSchema);
export default IndexModel;
