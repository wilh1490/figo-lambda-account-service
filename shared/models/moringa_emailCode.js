import mongoose from "mongoose";

const emailCodeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MoringaUser",
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: { type: Date, required: true, default: Date.now, expires: 600 },
});

const MoringaEmailCodeModel = mongoose.model("MoringaEmailCode", emailCodeSchema);

export default MoringaEmailCodeModel;
