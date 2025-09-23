import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    item: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FigoItem",
        },
        quantity: { type: Number, default: 1 },
        price: {
          type: Number,
          default: 0,
        },
      },
    ],
    wa_id: { type: String, default: "" },
    prize: { type: String, default: "0" },
    type: { type: String, default: "" },
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoCart", IndexSchema);
export default IndexModel;
