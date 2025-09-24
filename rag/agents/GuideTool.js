import { sendFigoApp } from "../controllers/askController.js";

export const schema = {
  name: "GuideTool",
  description: `Get details about app intent.`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function handler({ memory, userQuery, sessionId, wa_id }) {
  // const history = memory?.history || [];

  // const formattedHistory = history
  //   .map((turn) => {
  //     const role = turn.role === "user" ? "User" : "Assistant";
  //     return `${role}: ${turn.content}`;
  //   })
  //   .join("\n");

  // const prompt = `
  // <context>
  // Tap 'Open app' to record sales, inventory, create invoice, add expense and more.
  // </context>

  // <user_input>
  // Question: ${userQuery}
  // </user_input>

  // <instructions>
  //  You are a friendly business assistant. Answer user questions using the provided context
  // </instructions>
  // `;
  let text =
    "Tap 'Open app' to record sales, inventory, create invoice, add expense and more";

  await sendFigoApp({
    wa_id,
    message: text,
  });
}
