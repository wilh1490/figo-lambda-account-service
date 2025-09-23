import mongoose from "mongoose";
import bcrypt from "bcryptjs";

//evs means Eversend, sfh means safe haven mfb
const userSchema = new mongoose.Schema(
  {
    mobile: String,
    email: String,
    avatar: {
      type: String,
      default: "",
    },
    profile_photo: {
      type: String,
      default: "",
    },
    account_balance: { type: Number, default: 0 },
    country: { type: String, default: "NG" },
    sfh_account: {
      _id: { type: String, default: "" },
      account_number: { type: String, default: "" },
      account_name: { type: String, default: "" },
      bank_code: { type: String, default: "090286" },
      bank_name: { type: String, default: "Safe Haven Microfinance Bank" },
      daily_limit: { type: Number, default: 0 },
      single_limit: { type: Number, default: 0 },
      daily_limit_count: { type: Number, default: 0 },
      migration_complete: { type: Boolean, default: false },
      reference: { type: String, default: "" },
    },
    kyc: {
      bvn: {
        value: String,
        is_verified: { type: Boolean, default: false },
        verification_id: String,
        otp: String,
      },
      nin: {
        value: String,
        is_verified: { type: Boolean, default: false },
        verification_id: String,
        otp: String,
      },
      proof_of_address: {
        value: String,
        is_verified: { type: Boolean, default: false },
      },
      id_card: {
        value: String,
        is_verified: { type: Boolean, default: false },
        type: { type: String },
      },
      selfie: {
        value: String,
        is_verified: { type: Boolean, default: false },
      },
      signature: {
        value: String,
        is_verified: { type: Boolean, default: false },
      },
      email: { value: String, is_verified: { type: Boolean, default: false } },
      bio: Object,
      level: { type: Number, default: 0 },
    },
    evs_virtual_card: {
      id: String,
    },
    pin: String,
    last_seen: Date,
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

//hashing password
userSchema.pre("save", function (next) {
  if (this.isModified("pin")) {
    const salt = bcrypt.genSaltSync(8);
    this.pin = bcrypt.hashSync(this.pin, salt);
  }
  next();
});

const UserModel = mongoose.model("User", userSchema);

export default UserModel;

// user.password = password;
// await user.save();
