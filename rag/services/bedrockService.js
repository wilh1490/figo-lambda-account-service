import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentClient,
  CreateKnowledgeBaseCommand,
} from "@aws-sdk/client-bedrock-agent";

import { loadMemory, saveMemory, updateMemory } from "./memoryService.js";
import { sendFigoApp, sendToWA } from "../controllers/askController.js";
import { handlers } from "./agentLoader.js";
import { FigoUserModel } from "../shared/models/index.js";

const bedrockRuntimeClient = new BedrockRuntimeClient({ region: "us-east-1" });
const bedrockAgentClient = new BedrockAgentClient({ region: "us-east-1" });

const ROLE_ARN = "arn:aws:iam::881490088456:role/may-role";
const CLAUDE_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";
const CLAUDE_MODEL_ID_2 = "anthropic.claude-3-sonnet-20240229-v1:0";

// Helper to extract valid JSON chunks from stream input
// Safe JSON extraction from Claude stream chunk
let incompleteChunkBuffer = "";
function extractTextFromChunk(chunk) {
  try {
    const str = new TextDecoder().decode(chunk.chunk.bytes);
    incompleteChunkBuffer += str;

    const results = [];
    let startIdx = 0;
    let openBraces = 0;
    let inString = false;

    for (let i = 0; i < incompleteChunkBuffer.length; i++) {
      const char = incompleteChunkBuffer[i];

      if (char === '"' && incompleteChunkBuffer[i - 1] !== "\\") {
        inString = !inString;
      } else if (!inString) {
        if (char === "{") openBraces++;
        if (char === "}") openBraces--;
      }

      if (openBraces === 0 && !inString && i > startIdx) {
        const jsonChunk = incompleteChunkBuffer.slice(startIdx, i + 1);
        try {
          const parsed = JSON.parse(jsonChunk);
          const text = parsed?.delta?.text || "";
          if (text) results.push(text);
        } catch (err) {
          console.warn("Malformed JSON skipped:", jsonChunk);
        }
        startIdx = i + 1;
      }
    }

    // Save leftover (partial) JSON for next chunk
    incompleteChunkBuffer = incompleteChunkBuffer.slice(startIdx);

    // Return the combined valid delta text
    return results.join("");
  } catch (err) {
    console.error("Chunk decode error:", err);
    return "";
  }
}

async function sendChunk({ response, userMessage, sessionId, memory, wa_id }) {
  try {
    let buffer = "";

    for await (const chunk of response.body) {
      const chunkText = extractTextFromChunk(chunk);
      console.log(chunkText, "ck");

      if (!chunkText) continue;

      buffer += chunkText;

      // Detect end of a sentence
      if (buffer.length > 30 && /[.?!]['")\]]?\s*$/.test(buffer)) {
        const agentMessage = buffer.trim();
        buffer = "";

        console.log("Sending to WhatsApp:", agentMessage);
        sendToWA({ message: agentMessage, wa_id });

        // ⬇️ Add user message and agent response to memory.history
        memory.history = [
          ...(memory.history || []),
          { role: "user", content: userMessage },
          { role: "assistant", content: agentMessage },
        ].slice(-50); // Enlarge Memory anytime - last 50 user-agent chat
        saveMemory(sessionId, memory);
      }
    }

    // Flush leftover
    if (buffer.trim()) {
      sendToWA({ message: buffer.trim(), wa_id });

      memory.history = [
        ...(memory.history || []),
        { role: "user", content: userMessage },
        { role: "assistant", content: buffer.trim() },
      ].slice(-50); // Enlarge Memory anytime - last 50 user-agent chat

      saveMemory(sessionId, memory);
    }
  } catch (error) {}
}

function buildIntentPrompt(userMessage, memory = {}) {
  const history = memory.history || [];

  const contextTurns = history //Make Memory Context Longer
    .slice(-10)
    .map((turn) => `User: ${turn}`)
    .join("\n");

  return `
You are a classification assistant for a business insights app - Figo, used by small businesses in Nigeria.  
Your job is to analyze the user's message and return a list of detected intents and related entities in JSON format.

Supported intents:
- ProductLookupTool: Questions about stock levels, availability, or quantity of a product.
- SalesLookupTool: Questions about how much was sold or sales value over a period.
- InvoiceLookupTool: Questions about invoices issued, received, paid, unpaid or partially paid.
- ExpenseLookupTool: Questions about business expenses or spending.
- SupplierLookupTool: Questions about the supplier of a product.
- ContactLookupTool: Questions about a contact's name or phone number, e.g What's James phone number?.
- BusinessLookupTool: Questions about business profile, name or phone number e.g 'What is my business phone number?', 'What is my business name?', 'When will my subscription expire?', 'When is my next subscription date?' etc.
- DebtLookupTool: Questions about who is owing money, unpaid debts or outstanding payments.
- ComplimentsTool: Greetings or polite messages with no business intent.
- CashFlowTool: Questions about margin, profit & loss and cashflow.
- MemoryLookupTool: Questions about past messages and memory e.g 'Do you remember what I asked last?'
- GuideTool: Questions about how to create invoice, record sales, record expense, manage inventory, mange customer or supplier e.g How to create an invoice.
- AppTool: Questions about app install, app update and other app enquiries e.g 'Is the app available on iOS or App Store?', 'App', 'Show me the app.' , 'Where's the app?' e.tc.
- ModifyInvoiceRecord: Messages about a user intent to modify or edit an invoice record e.g 'Add banana to my last invoice'.
- ModifyProductRecord: Messages about a user intent to modify or edit a product or service record e.g 'Change the price of the ripe orange to NGN300'.
- ModifySaleRecord: Messages about a user intent to modify or edit a sale record e.g 'Change the payment status of my last invoice to paid'.
- ModifyExpenseRecord: Messages about a user intent to modify or edit an expense e.g 'I recorded that I spent NGN500 to market yetereday', 'change the amount to NGN300 instead'.
- GetReferralCode: Get referral code from a user's message e.g 'Hi, Figo Referral Code AT615526' 
- GetReferralDetails: Messages about a user's referral history e.g 'How many users have joined through my referral code', 'Have I referred anyone today?'.
- LuckySpin:  User's message to participate in the lucky spin game e.g 'Hi, Figo Lucky Spin AT615526' 

Your output MUST be valid JSON with the structure:
{
  "intents": [/* one or more of the above */],
  "entities": {
    "questions: [/* one or more questions like 'how many banana is left and what did i sell last' '*/]
    "products": [/* one or more products */]",
    "period": "<optional date range like 'last week', 'June', etc.>",
    "customer": "<optional customer name>",
    "supplier": "<optional supplier name>",
    "task": "<optional task description like 'remind me to restock Tomatoes tomorrow', 'Lucky Spin', 'Lucky spin' etc.>",   
    "task_time": "<optional task time like 'tomorrow' 'Friday' 'Net week Monday' etc.>",  
    "referral_code": "<optional referral code like 'ATCOOKIE' 'ZTAFISH' 'MRBEAST00' etc.>", 
    "item_list": "<optional list of items e.g 'Rice 1 Bag, Spaghetti 2 Pack, Tomatoes 3 Baskets, Sugar 1 Cup' etc.>", 
  }
}

Extract multiple intents if applicable. If uncertain, return an empty array.

Use recent history for context.

Recent conversation:
${contextTurns}

Current message:
User: ${userMessage}
`.trim();
}

async function extractIntentsFromClaude(prompt, no_guard) {
  let guardrail = {
    guardrailIdentifier: "9l6kjdr48biz",
    guardrailVersion: "3",
  };

  if (no_guard) {
    delete guardrail.guardrailIdentifier;
    delete guardrail.guardrailVersion;
  }
  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    ...guardrail,
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });
  try {
    const response = await bedrockRuntimeClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const text = responseBody?.content?.[0]?.text?.trim() || "{}";
    console.log(text, "extract-intent");
    return JSON.parse(text);
  } catch (err) {
    console.log("Claude intent detection error:");
    return { intents: [], entities: {} };
  }
}

async function normalizeUserQuery(userQuery) {
  const prompt = `
  <examples>
  User: Abeg, how much tomatoes remain
  Claude-normalized: How many tomatoes is remaining?

  User: Create an invoice for 3 cartons indomie sgarp sharp.
  Claude-normalized: Create an invoice for 3 cartons on indomie right away.

  User: Hw much dey stock self?
  Claude-normalized: Your total inventory is worth NGN300,000.

  User: How many gala remain for stock abeg ?
  Claude-normalized: How many Gala are left in stock ?

  User: That Ada girl don pay for her cookies ?
  Claude-normalized: Has Ada paid for the cookies ?

  User: Please help me buy indomie again, e don nerly finish .
  Claude-normalized: Please reorder Indomie, it is almost out of stock .
  
  User: I wan add one new customer wey dey buy well .
  Claude-normalized: I want to add a new customer who buys a lot .
  
  User: Wetin I don sell toaday ?
  Claude-normalized: What are my total sales for today ?
  
  User: Make invoice for Ayodeji. He carry 2 bags of rice, 3 oil and 1 packet of Maggi.
  Claude-normalized: Create an invoice for Ayodeji. He bought 2 bags of rice, 3 units of oil and 1 packet of Maggi.
  
  User: How much Emeka dey owe me self ?
  Claude-normalized: How much does Chinedu owe me ?
  
  User: Change tomatoes to 3 for Ayodeji invoice .
  Claude-normalized: Change the quantity of tomatoes to 3 for Ayodeji's invoice .
  
  User: U fit tell me how many biscuit dey ground?
  Claude-normalized: Can you tell me how many Biscuits are cureently in stock ?
  
  User: Show me anytin wey dey finish for shop .
  Claude-normalized: Show me any item that is low on stock or almost finished.
  
  User: Dat Ayodeji invoice don pass due date ?
  Claude-normalized: Is Ayodeji invoice past the due date ?
  
  User: Add 1 boy to help me dey enter sales .
  Claude-normalized: Add a new staff member to assist with entering sales .

  User: How market today ?
  Claude-normalized: What are today's sales ?
  
  User: Na who still dey owe me ?
  Claude-normalized: Which customers still owe me money ?
  
  User: Help me buy tins wey finish quick las week .
  Claude-normalized: Help to restock items that sold out quickly last week ?
  
  User: That one wey I just mark paid, u fit undo am ?
  Claude-normalized: Can you mark my last sale as unpaid ?
  
  User: This ur app too make sense, but I no sabi use am well .
  Claude-normalized: This app is great, but I don't fully understand how to use it .
  
  User: Add 3k for diesel this morning ?
  Claude-normalized: Add an expense of NGN3,000 for diesel this morning ?
  
  User: Wetin Blessing don sell this week ?
  Claude-normalized: How much has Blessing sold this week ?

  User: Market dull toady .
  Claude-normalized: Sales were low today .
  </examples>

  <instructions> 
  1.You are a help assistant that rewrites user input into clean and clear English .
  2.Fix spelling mistakes, clarify intent, and convert local slangs or informal speech into correct English.
  3. Don't provide an answer to a user input.
  4. Only return the corrected query.
  5. If there's nothing to correct, return the query as it is.
  6. Under no circumstance should you provide an answer to the user query.
  </instructions>
 
  <user_input>
  ${userQuery}
  </user_input>
`;

  const cmd = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.3,
    }),
  });

  const response = await bedrockRuntimeClient.send(cmd);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  return responseBody?.content?.[0]?.text?.trim(); // Clean English query ready for Lex
}

async function summarizeResponses({
  userMessage,
  sessionId,
  memory,
  agentResponses,
  wa_id,
}) {
  const prompt = `
  {
    user_query: ${userMessage},
    prompt:
      "Summarize the array of answers into 1-2 sentences in short, casual English for a Nigerian small business owner using the user_query for context.",
    input_array_to_summarize: ${agentResponses},
    examples: [
      {
        input: [
          "We sold 45 crates of eggs.",
          "Tomatoes sales increased by 15%.",
          "Most buyers were repeat customers.",
        ],
        output:
          "You sold 45 crates of eggs. Tomato sales rose 15%. Most customers were returning buyers.",
      },
      {
        input: ["₦8,000 from bread.", "₦5,000 from snacks.", "No drinks sold."],
        output: "Bread made ₦8,000 and snacks ₦5,000. No drink sales recorded.",
      },
      {
        input: [
          "You earned ₦120,000 this week.",
          "₦30,000 used for restocking.",
          "No new debts.",
        ],
        output:
          "You earned ₦120,000 this week and spent ₦30,000 on stock. No new debts were added.",
      },
      {
        input: [
          "₦20,000 came from oil.",
          "Rice brought ₦40,000.",
          "2 customers still owe ₦7,000.",
        ],
        output:
          "Rice earned ₦40,000 and oil ₦20,000. Two customers still owe ₦7,000.",
      },
      {
        input: [
          "3 items out of stock: soap, sugar, milk.",
          "Sold mostly groceries.",
          "₦75,000 total sales.",
        ],
        output:
          "Total sales reached ₦75,000. Most sales were groceries. Soap, sugar and milk are out of stock.",
      },
      {
        input: [
          "₦50,000 earned from fashion sales.",
          "₦15,000 spent on ads.",
          "Instagram brought in most buyers.",
        ],
        output:
          "You made ₦50,000 in fashion sales and spent ₦15,000 on ads. Instagram drove most traffic.",
      },
      {
        input: [
          "No new sales this week.",
          "₦2,000 spent on repairs.",
          "1 customer asked for refund.",
        ],
        output:
          "No new sales this week. ₦2,000 was spent on repairs and one refund was requested.",
      },
      {
        input: [
          "Sold 15 units of body lotion.",
          "₦9,000 total.",
          "All came from returning customers.",
        ],
        output:
          "You sold 15 lotions for ₦9,000. All sales came from existing customers.",
      },
      {
        input: [
          "₦11,000 came from Facebook orders.",
          "₦5,000 from walk-ins.",
          "1 POS charge of ₦500.",
        ],
        output:
          "₦11,000 came from Facebook, ₦5,000 from walk-ins. You paid a ₦500 POS charge.",
      },
      {
        input: [
          "Top sellers: soap, cream, oil.",
          "₦60,000 sales.",
          "3 customers paid in cash.",
        ],
        output:
          "You made ₦60,000. Soap, cream, and oil were top sellers. Three customers paid in cash.",
      },
    ],
    instructions: {
      task: "Summarize the array of answers into 1-2 sentences in short, casual English for a Nigerian small business owner.",
      language:
        "Use clear and simple English. Avoid slang or overly formal words. Make it sound polite, helpful, and professional.",
      audience:
        "Nigerian small and medium business owners with basic business knowledge.",
      constraints: {
        length: "1-2 sentences, under 160 characters total",
        tone: "Casual, personal, and informative",
        context: "Focus on insights or info relevant to the business owner.",
      },
    },
   }
   `;

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: CLAUDE_MODEL_ID_2,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0,
    }),
  });

  const response = await bedrockRuntimeClient.send(command);
  //const responseBody = responseBody?.content?.[0]?.text?.trim() || ""; //One single summary response from multiple responses
  sendChunk({ response, userMessage, sessionId, memory, wa_id });
  return { success: true };
}

export async function structureList({ list }) {
  try {
    const promptEx = buildIntentPrompt(list);

    const parsed = await extractIntentsFromClaude(promptEx, true);

    if (!parsed?.entities?.item_list && !parsed?.entities?.products)
      return null;

    const prompt = `
You are a smart JSON generator that extracts structured data from informal item lists.

Your job is to:
- Detect products or services, with their quantity, unit, and price if available.
- Extract other details such as notes, customer names, phone numbers and total fees.
- Return a valid JSON in the following format:

{
  "items": [
    {
      "productName": "<product or service name>",
      "quantity": "<item quantity (optional)>",
      "unit": "<item unit e.g. Bag, Crate (optional)>",
      "price": "<item price e.g. 8000, 5k (optional)>"
    }
  ],
  "entities": {
    "note": "<optional note>",
    "customerName": "<optional customer name>",
    "customerMobile": "<optional phone number>"
    "totalFees": "<optional sum of all fees>"
  }
}

### Example Input:
Rice 2 Bags NGN8,000, 1 beans bag NGN10k, 8 coconuts ₦5k, Egg Crates 5 NGN6k, Tomato 3 Baskets ₦12000, Cooking Oil 5 Bottles, 3 Avocado, 16 Congo Millets, 5 Pineapples. Note: Make Payment to First Bank 01929911. Customer - James Tope

### Example Output:
{
  "items": [
    { "productName": "Rice", "quantity": 2, "unit": "Bag", "price": 8000 },
    { "productName": "Beans", "quantity": 1, "unit": "Bag", "price": 10000 },
    { "productName": "Coconut", "quantity": 8, "unit": "", "price": 5000 },
    { "productName": "Egg", "quantity": 5, "unit": "Crate", "price": 6000 },
    { "productName": "Tomato", "quantity": 3, "unit": "Basket", "price": 12000 },
    { "productName": "Cooking Oil", "quantity": 5, "unit": "Bottle" },
    { "productName": "Avocado", "quantity": 3, "unit": "" },
    { "productName": "Millets", "quantity": 16, "unit": "Congo" },
    { "productName": "Wine", "quantity": 5, "unit": "" },
    { "productName": "Grape", "quantity": 25, "unit": "" }
  ],
  "entities": {
    "note": "Make Payment to First Bank 01929911",
    "customerName": "James Tope",
    "customerMobile": ""
  }
}

### Input:
${list}

### Output:
`;

    function cleanMalformedJson(rawText) {
      // Check if the object contains an unnamed array immediately after the opening {
      const startsWithUnnamedArray = /{\s*\[/.test(rawText);

      let fixedText = rawText;

      // Step 1: If it starts with an unnamed array, inject "items":
      if (startsWithUnnamedArray) {
        fixedText = rawText.replace(/{\s*\[/, '{ "items": [');
      }

      // Step 2: Normalize keys (quote unquoted keys if needed)
      const normalized = fixedText.replace(/([a-zA-Z0-9_]+):/g, '"$1":');

      // Step 3: Replace single quotes with double quotes
      const doubleQuoted = normalized.replace(/'/g, '"');

      // Step 4: Try parsing
      try {
        return JSON.parse(doubleQuoted);
      } catch (err) {
        console.error("❌ JSON parse failed:", err.message);
        return null;
      }
    }

    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID_2,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
    });

    const response = await bedrockRuntimeClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody?.content?.[0]?.text?.trim() || [];
    const jsonString = text.replace(/.*?:/, "").trim();
    console.log(jsonString, "structureList");
    return cleanMalformedJson(jsonString);
  } catch (error) {
    console.log(error, "structureList");
  }
}

export const CreateKB = async (req, res) => {
  try {
    const { kb_name } = req.body;

    const kb = await bedrockAgentClient.send(
      new CreateKnowledgeBaseCommand({
        name: kb_name,
        knowledgeBaseConfiguration: {
          type: "VECTOR",
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0`,
          },
        },
        roleArn: ROLE_ARN,
        storageConfiguration: {
          type: "OPENSEARCH_MANAGED_CLUSTER",
          opensearchManagedClusterConfiguration: {
            domainArn: "arn:aws:es:us-east-1:881490088456:domain/figo",
            domainEndpoint:
              "https://search-figo-csbha53skwrkhtun42fmr42tui.us-east-1.es.amazonaws.com",
            vectorIndexName: `${kb_name}`,
            fieldMapping: {
              vectorField: "embedding",
              textField: "text",
              metadataField: "metadata",
            },
          },
        },
      })
    );
    console.log(kb);
    return { message: "Successful", kb };
  } catch (error) {
    console.log(error, "e at kb");
    return { message: "Bad request" };
  }
};

export const promptModel = async ({
  prompt,
  userMessage,
  sessionId,
  guardrail,
  memory,
  wa_id,
  intents,
}) => {
  try {
    const input = {
      modelId: CLAUDE_MODEL_ID_2, //"anthropic.claude-3-sonnet-20240229-v1:0", // or haiku
      contentType: "application/json",
      accept: "application/json",
      // guardrailIdentifier: guardrail?.id || "9l6kjdr48biz",
      // guardrailVersion: guardrail?.version || "DRAFT",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
    };

    let command;
    if (intents?.length > 1) {
      command = new InvokeModelCommand(input);
      const response = await bedrockRuntimeClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody?.content?.[0]?.text?.trim() || "";
    } else {
      command = new InvokeModelWithResponseStreamCommand(input);
      const response = await bedrockRuntimeClient.send(command);

      await sendChunk({
        response,
        userMessage,
        sessionId,
        memory,
        wa_id,
      });
      return false;
    }
  } catch (error) {
    console.log(error, "at generate command");
    return null;
  }
};

// Multi-intent detection Lambda using Claude + memory + OpenSearch filters
export const BaseAgent = async (req) => {
  try {
    const { query: userMessage, wa_id, businessId } = req.body;

    const sessionId = `${wa_id}_${businessId}`;

    const previousMemory = await loadMemory(sessionId);

    // Detect multi-intent with Claude
    const prompt = buildIntentPrompt(userMessage, previousMemory);

    const parsed = await extractIntentsFromClaude(prompt);

    if (!!parsed.intents?.length) {
      // sendToWA({ message: `${parsed.intents.join(", ")}`, wa_id });
      // return;
    } else {
      //sendToWA({ message: "Sorry, I'm unable to answer that.", wa_id });
      await sendFigoApp({
        wa_id,
        message: "Simple bookkeping and accounting for your small business",
      });
      return;
    }

    const detected = {
      intents: parsed.intents || [],
      entities: parsed.entities || {},
    };

    let memory = updateMemory(previousMemory, detected);

    const agentResponses = await Promise.all(
      detected.intents.map(async (tool_name, index) => {
        const agentFunction = handlers[tool_name];
        return await agentFunction({
          memory,
          userMessage: detected.entities?.questions?.[index] || userMessage,
          businessId,
          sessionId,
          wa_id,
          intents: detected.intents,
          entities: detected.entities,
        });
      })
    );

    console.log(agentResponses, "agrs");

    const responsesAreValid = agentResponses.some((response) => response);

    //Last seen
    await FigoUserModel.updateOne(
      {
        mobile: wa_id,
      },
      { $set: { last_seen: new Date() } }
    );

    if (!responsesAreValid) {
      console.log("No valid response in responses");
      return;
    }

    if (detected.intents?.length > 1) {
      await summarizeResponses({
        userMessage,
        sessionId,
        memory,
        agentResponses,
        wa_id,
      });
    }

    return {
      success: true,
    };
  } catch (error) {
    console.log(error, "error at BaseAgent");
  }
};
