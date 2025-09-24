import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    mobile: { type: String, default: "" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    country: { type: String, default: "NG" },
    business: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FigoBusiness",
      },
    ],
    pin: { type: String, default: "" },
    last_seen: Date,
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
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

const FigoUserModel = mongoose.model("FigoUser", userSchema);

export default FigoUserModel;

// user.password = password;
// await user.save();
