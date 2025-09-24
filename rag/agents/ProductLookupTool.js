import { sendFigoApp } from "../controllers/askController.js";
import { promptModel } from "../services/bedrockService.js";
import { queryOpenSearch } from "../services/openSearch.js";
import { GeneralExample, GeneralInstruction } from "./instructions.js";

export const schema = {
  name: "ProductLookupTool",
  description: `Get specific details about a particular product or inventory.`,
  input_schema: {
    type: "object",
    properties: {
      productName: {
        type: "string",
        description: "The name of the product.",
      },
    },
    required: ["productName"],
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
  const history = memory?.history || [];

  const formattedHistory = history
    .map((turn) => {
      const role = turn.role === "user" ? "User" : "Assistant";
      return `${role}: ${turn.content}`;
    })
    .join("\n");

  let must = [
    {
      match: {
        product: {
          query: userMessage,
          fuzziness: 3,
        },
      },
    },
  ];
  let filter = [{ term: { businessId } }];

  const context = await queryOpenSearch({ index: "product", filter, must });

  if (!context && intents?.length <= 1) {
    let text =
      "Not enough inventory information available yet. Open the app to add inventory.";

    await sendFigoApp({
      wa_id,
      message: text,
    });
    return;
  }

  const knownContext = `
  Known context:
  - Last product mentioned: ${memory.lastProduct || "N/A"}
  - Last customer mentioned: ${memory.customer || "N/A"}
  - Last invoice ID: ${memory.invoiceId || "N/A"}
  - Time period: ${memory.timeRange || "N/A"}
  - Top intents so far: ${(memory.intentHistory || []).join(", ") || "N/A"}
  - Product history: ${(memory.productHistory || []).join(", ") || "N/A"}
  `.trim();

  const prompt = `
  <information>
  ${context}
  </information>

  <context>
  ${knownContext}
  </context>
  
  <conversation_history>
  ${formattedHistory || "None."}
  </conversation_history>
   
  <user_input>
  Question: ${userMessage}
  </user_input>
  
  <examples> 
  ${GeneralExample}
  </examples>

  <instructions> 
  ${GeneralInstruction}
  </instructions>
 `;

  return await promptModel({
    prompt,
    userMessage,
    wa_id,
    sessionId,
    memory,
    intents,
  });
}
