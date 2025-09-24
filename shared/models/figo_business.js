import mongoose from "mongoose";
import moongooseLong from "mongoose-long";
import { FIGO_STAT } from "../config/statusError.js";

moongooseLong(mongoose);

const { Schema, Types } = mongoose;
const { Long } = Schema.Types;

const IndexSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    mobile: { type: String, default: "" },
    money_in: {
      type: Long,
      default: Types.Long.fromNumber(0),
    },
    money_out: {
      type: Long,
      default: Types.Long.fromNumber(0),
    },
    logo: { type: String, default: "" },
    preference: {
      stock_level_alert: { type: Number, default: 5 },
      closing_hour: { type: Number, default: 21 },
      home_stat: { type: String, default: FIGO_STAT.WEEKLY },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FigoUser",
    },
    subscription: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "FigoUser" },
        start_date: Date,
        end_date: Date,
        is_active: { type: Boolean, default: false },
      },
    ],
    staff: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FigoUser",
        },
        name: { type: String, default: "" },
        last_active: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

const IndexModel = mongoose.model("FigoBusiness", IndexSchema);
export default IndexModel;
