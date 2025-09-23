import mongoose from "mongoose";

const emailCodeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: { type: Date, required: true, default: Date.now, expires: 600 },
});

const EmailCodeModel = mongoose.model("EmailCodeModel", emailCodeSchema);

export default EmailCodeModel;
