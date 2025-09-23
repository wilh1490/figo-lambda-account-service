import mongoose from "mongoose";

const VCShema = new mongoose.Schema(
  {
    misc: Object,
    provider: {
      type: String,
      default: "Eversend",
    },
    // terminated: { type: Boolean, default: false },
    // retained: { type: Boolean, default: false },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const VCModel = mongoose.model("VirtualCard", VCShema);

export default VCModel;
