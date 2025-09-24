import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    complete: { type: Boolean, default: false },
    email: { type: String, default: "" },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoSubscription", IndexSchema);
export default IndexModel;
