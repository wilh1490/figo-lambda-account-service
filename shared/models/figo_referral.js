import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    referral_code: { type: String, unique: true },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoReferral", IndexSchema);
export default IndexModel;
