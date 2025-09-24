import { getSecrets } from "../shared/config/secrets.js";

export const schema = {
  name: "LuckySpin",
  description: `Lucky spin.`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const { ACCOUNT_SERVICE_URL } = await getSecrets();

export async function handler({
  memory,
  userMessage,
  businessId,
  sessionId,
  wa_id,
  intents,
  entities,
}) {
  await fetch(`${ACCOUNT_SERVICE_URL}/figo-spin-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wa_id,
      referral_code: entities?.referral_code,
    }),
  });
  return;
}
