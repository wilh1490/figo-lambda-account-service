import fetch from "node-fetch";
import { sendFigoApp } from "../controllers/askController.js";
import { getSecrets } from "../shared/config/secrets.js";

const { ACCOUNT_SERVICE_URL } = await getSecrets();

export const schema = {
  name: "GetReferralCode",
  description: `Get referral code.`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function handler({ wa_id, entities }) {
  await fetch(`${ACCOUNT_SERVICE_URL}/figo-referral-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wa_id,
      referral_code: entities?.referral_code,
    }),
  });

  await sendFigoApp({
    wa_id,
    message: "Simple bookkeping and accounting for your small business",
  });
  return;
}
