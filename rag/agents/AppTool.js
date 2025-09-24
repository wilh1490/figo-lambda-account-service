import { sendFigoApp } from "../controllers/askController.js";
import { promptModel } from "../services/bedrockService.js";
import { queryOpenSearch } from "../services/openSearch.js";
import { GeneralExample, GeneralInstruction } from "./instructions.js";

export const schema = {
  name: "AppTool",
  description: `Get details about app .`,
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
  await sendFigoApp({
    wa_id,
    message: "Simple bookkeping and accounting for your small business",
  });
  return;
}
