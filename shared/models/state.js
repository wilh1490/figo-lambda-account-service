import mongoose from "mongoose";

const stateSchema = new mongoose.Schema(
  {
    status: { type: Boolean, default: true },
    question: { type: String, default: "" },
    answer: [String],
  },
  { timestamps: true }
);

const stateModel = mongoose.model("StateModel", stateSchema);

export default stateModel;
