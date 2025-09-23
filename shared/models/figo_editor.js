import mongoose from "mongoose";
import { FIGO_ENTRY_TYPES } from "../config/statusError.js";

const IndexSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    entry_type: { type: String, enum: Object.values(FIGO_ENTRY_TYPES) },
    entry_id: { type: mongoose.Schema.Types.ObjectId },
    editor: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "FigoUser" },
      name: { type: String, default: "" },
      mobile: { type: String, default: "" },
    },
    action: { type: String, default: "" },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoEditor", IndexSchema);
export default IndexModel;
