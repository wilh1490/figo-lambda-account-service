import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    payment_ref: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    filePath: String,
  },
  { timestamps: true }
);

const receiptModel = mongoose.model("ReceiptModel", receiptSchema);

export default receiptModel;
