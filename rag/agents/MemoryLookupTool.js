import { promptModel } from "../services/bedrockService.js";
import { GeneralExample, GeneralInstruction } from "./instructions.js";

export const schema = {
  name: "MemoryLookupTool",
  description: `Get details about past messages.`,
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
  let must = [
    {
      match: {
        text: {
          query: userMessage,
          fuzziness: 2,
        },
      },
    },
  ];

  const history = memory?.history || [];

  const formattedHistory = history
    .map((turn) => {
      const role = turn.role === "user" ? "User" : "Assistant";
      return `${role}: ${turn.content}`;
    })
    .join("\n");

  let filter = [{ term: { businessId } }];

  //const context = await queryOpenSearch({ index: "sale", filter, must });

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
