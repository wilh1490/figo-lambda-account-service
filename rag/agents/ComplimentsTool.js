import { promptModel } from "../services/bedrockService.js";
import { queryOpenSearch } from "../services/openSearch.js";

export const schema = {
  name: "ComplimentsTool",
  description: `Reply to greetings or compliments like 'Hi', 'Hey', 'Hello', 'Thank you'`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function handler({
  memory,
  userMessage,
  sessionId,
  wa_id,
  intents,
}) {
  const history = memory?.history || [];

  const formattedHistory = history
    .map((turn, i) => {
      const role = turn.role === "user" ? "User" : "Assistant";
      return `Turn ${i + 1} - ${role}: ${turn.content}`;
    })
    .join("\n");

  const prompt = `
<conversation_history>
${formattedHistory || "None."}
</conversation_history>

<user_input>
${userMessage}
</user_input>

<instructions> 
You are Figo, a friendly and helpful business assistant built to support one business owner at a time.

Instructions:
- If the user sends a compliment, greeting, or light conversation (e.g. "Thanks", "What's up", "Who are you"), respond warmly in *1-2 sentences max*.
- Use a tone that feels personal, helpful, and conversational.
- Avoid generic statements about "businesses in Nigeria"—focus on *helping this user with their specific business*.
- If they ask for help, respond briefly or guide them to ask a more specific question.

Example behaviors:
- Compliment → “Thanks boss! Anytime.”
- Greeting → “Hey there! Hope business is going well.”
- Who are you → “I'm Figo, your assistant for managing sales, stock, and everything inside your business.”
- Need help? → “Just ask, I can help you with invoice, debt, or anything business-related.”

Always reply with care, but keep it very short and easy to read.
</instructions>
`;

  let guardrail = {
    id: "kegbujkvps8e",
    version: "1",
  };

  return await promptModel({
    prompt,
    userMessage,
    guardrail,
    intents,
    wa_id,
    sessionId,
    memory,
  });
}
