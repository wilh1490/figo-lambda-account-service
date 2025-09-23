import mongoose from "mongoose";

const statementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    active: {
      type: Boolean,
      default: true,
    },
    period: String,
    filePath: String,
    sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const statementModel = mongoose.model("StatementModel", statementSchema);

export default statementModel;
