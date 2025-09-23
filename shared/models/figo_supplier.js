import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
  {
    mobile: { type: String, default: "" },
    name: { type: String, default: "" },
    editor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoSupplier", IndexSchema);
export default IndexModel;
