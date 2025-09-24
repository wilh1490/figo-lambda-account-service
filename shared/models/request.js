import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: String,
  },
  { timestamps: true }
);

const RequestModel = mongoose.model("RequestModel", requestSchema);

export default RequestModel;
