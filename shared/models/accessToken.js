import mongoose from "mongoose";

const accessTokenSchema = new mongoose.Schema({
  accessToken: String,
  createdAt: { type: Date, required: true, default: Date.now, expires: 3000 },
});

const AccessToken = mongoose.model("AccessToken", accessTokenSchema);

export default AccessToken;
