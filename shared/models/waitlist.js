import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: String,
  },
  { timestamps: true }
);

const WaitlistModel = mongoose.model("WaitlistModel", waitlistSchema);

export default WaitlistModel;
