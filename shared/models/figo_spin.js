import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    editor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    complete: { type: Boolean, default: false },
    prizes: [{ type: String }], //prizes that can be won
    slot: { type: Number, default: 1 },
    winners: [{ type: String }], //winners phone number
    claims: [{ type: String }], //winners that have claimed
    players: [{ type: String }], //users that have spinned
    ref: { type: String, default: "" },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoSpin", IndexSchema);
export default IndexModel;
