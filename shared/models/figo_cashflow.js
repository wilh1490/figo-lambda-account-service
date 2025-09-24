import mongoose from "mongoose";
import moongooseLong from "mongoose-long";

moongooseLong(mongoose);

const { Schema, Types } = mongoose;
const { Long } = Schema.Types;

const IndexSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoBusiness",
    },
    amount: { type: Long, default: Types.Long.fromNumber(0) },
    balance_before: { type: Long, default: Types.Long.fromNumber(0) },
    balance_after: { type: Long, default: Types.Long.fromNumber(0) },
    type: { type: String, default: "" }, //Credit || Debit
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoCashFlow", IndexSchema);
export default IndexModel;
