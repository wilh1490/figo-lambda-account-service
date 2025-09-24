import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    author: String,
    comment: String,
    ticket: String,
    documents: [String],
    read: {
      type: Boolean,
      default: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const MoringaChatModel = mongoose.model("MoringaChatSupport", ChatSchema);

export default MoringaChatModel;
