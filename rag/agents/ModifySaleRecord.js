import { sendFigoApp } from "../controllers/askController.js";

export const schema = {
  name: "ModifySaleRecord",
  description: `Modify sale record.`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function handler({
  memory,
  userMessage,
  businessId,
  sessionId,
  wa_id,
  intents,
}) {
  if (intents && intents?.length == 1)
    await sendFigoApp({
      wa_id,
      message: "Simple bookkeping and accounting for your small business",
    });
  return;
}
