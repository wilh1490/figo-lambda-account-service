import mongoose from "mongoose";

const phoneCodeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    phoneVerificationCode: {
      type: String,
    },
    mobile: {
      type: String,
    },
  },
  { timestamps: true }
);

const PhoneCodeModel = mongoose.model("PhoneCodeModel", phoneCodeSchema);

export default PhoneCodeModel;
