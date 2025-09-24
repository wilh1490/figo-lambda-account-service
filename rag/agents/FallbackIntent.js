import axios from "axios";
import { promptModel } from "../services/bedrockService.js";
import { queryOpenSearch } from "../services/openSearch.js";
import { getSecrets } from "../shared/config/secrets.js";

const { FIGO_WA_PHONE_NUMBER, GRAPH_API_TOKEN } = await getSecrets();

export const schema = {
  name: "FallbackIntent",
  description: "Default intent when no other intent matches.",
  input_schema: {
    type: "object",
    properties: {},
    required: ["insightType", "days"],
  },
};

export async function handler(_, userQuery, businessId, sessionId) {
  let filter = [{ term: { businessId } }];

  const context_1 = await queryOpenSearch({ index: "business", filter });
  const context_2 = await queryOpenSearch({ index: "product", filter });
  const context_3 = await queryOpenSearch({ index: "sale", filter });

  const context = `${context_1}\n${context_2}\n${context_3}`;

  const prompt = `
  <information>
  ${context}
  </information>
 
  <instructions> 
  1. Provide a natural response to the user's question based on the provided data.
  2. Don't ever show the raw data.
  3. Don't add "according to the information provided".
  4. Don't add "based on the information provided".
  5. If you're asked a question that cannot be answered using the provided information, say "I don't know."
  6. Don't use phrases like "According to the information provided" .
  7. Don't use phrases like "The information shows that" .
  8. Don't use phrases like "The data shows that" .
  9. If you're asked a question that borders religion, sex, hate, insult, politics, news, gossip, conspiracy theories or any other question that cannot be answered directly with the information provided, say "I don't know."
  </instructions>

  <user_input>
  Question: ${userQuery}
  </user_input>
  `;

  const result = await promptModel(prompt, null, sessionId);

  return result;
}
