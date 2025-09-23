import mongoose from "mongoose";
import { TRANSACTION_TYPE } from "../config/statusError.js";

const EmbeddingSchema = new mongoose.Schema(
  {
    type: String,
    message: String,
    embedding: [Number],
    id: String,
  },
  { timestamps: true }
);

const EmbeddingModel = mongoose.model("EmbeddingModel", EmbeddingSchema);

export default EmbeddingModel;
