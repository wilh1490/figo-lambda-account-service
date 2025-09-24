import mongoose from "mongoose";
import bcrypt from "bcryptjs";

//evs means Eversend,
const userSchema = new mongoose.Schema(
  {
    mobile: String,
    account_balance: { type: Number, default: 0 },
    country: { type: String, default: "NG" },
    address: [String],
    wallet: {
      usdt: {
        balance: { type: Number, default: 0 },
        address: {
          binance: { type: String, default: "" },
          polygon: { type: String, default: "" },
          ethereum: { type: String, default: "" },
          tron: { type: String, default: "" },
          solana: { type: String, default: "" },
          optimism: { type: String, default: "" },
          arbitrum: { type: String, default: "" },
        },
      },
      usdc: {
        balance: { type: Number, default: 0 },
        address: {
          binance: { type: String, default: "" },
          polygon: { type: String, default: "" },
          ethereum: { type: String, default: "" },
          stellar: { type: String, default: "" },
          base: { type: String, default: "" },
          solana: { type: String, default: "" },
          optimism: { type: String, default: "" },
          arbitrum: { type: String, default: "" },
        },
      },
      ngn: {
        balance: { type: Number, default: 0 },
      },
    },

    kyc: {
      bio: Object,
      nin: {
        value: String,
        is_verified: { type: Boolean, default: false },
      },
      email: { value: String, is_verified: { type: Boolean, default: false } },
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

const MoringaUserModel = mongoose.model("MoringaUser", userSchema);

export default MoringaUserModel;

// user.password = password;
// await user.save();
