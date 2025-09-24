import express from "express";
import HelixDB from "helix-ts";
import ollama from "ollama";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new HelixDB("http://localhost:6969"); //("https://your-aws-endpoint:6969");
const bedrockRuntimeClient = new BedrockRuntimeClient({ region: "us-east-1" });
const modelId = "amazon.titan-embed-text-v2:0";
const CLAUDE_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.send("👉🏾 Hello from Helix");
});

app.post("/", async (req, res) => {
  // For AWS/cloud instance, use your cloud endpoint URL
  try {
    //Vector
    let query = req.body?.msg || "";

    const start = performance.now();

    const response = await ollama.embeddings({
      model: "nomic-embed-text",
      prompt: query,
    });

    const embedF64 = response.embedding;
    // const embedF64 = Array.from(embedF32, Number)

    console.log({ embedF64: embedF64.length });

    // Query your User vector nodes
    const result = await client.query("addUserE", {
      userId: "user123",
      businessId: "biz456",
      text: query,
      embedding: embedF64, // your embedding vector
      joinedAt: new Date(),
    });
    const end = performance.now();
    console.log("latency", end - start, "ms");
    res.status(200).send(result);
  } catch (error) {
    console.log(error);
    res.status(402).send(error);
  }
});

app.post("/search", async (req, res) => {
  // For AWS/cloud instance, use your cloud endpoint URL
  try {
    let query = req.body?.msg || "Orange Foods";
    //Vector

    // const cmd = new InvokeModelCommand({
    //   modelId,
    //   contentType: "application/json",
    //   accept: "application/json",
    //   body: JSON.stringify({ inputText: query }),

    // });
    const start = performance.now();
    const response = await ollama.embeddings({
      model: "nomic-embed-text",
      prompt: query,
    });
    const end = performance.now();

    //let response = await bedrock.send(cmd);

    // const body = JSON.parse(new TextDecoder("utf-8").decode(response.body));

    //const embedF32 = body.embedding; //body.embedding;
    const embedF64 = response.embedding; //Array.from(embedF32, Number);

    console.log({ embedF64: embedF64.length });
    ``;

    // Query your User vector nodes

    const result = await client.query("searchUserE", {
      query_vector: embedF64,
      limit: 3,
    });

    console.log("latency", end - start, "ms");
    res.status(200).send(
      result?.results?.map((e) => {
        return { score: e.score, text: e.text };
      }) || "nothing"
    );
  } catch (error) {
    console.log(error);
    res.status(402).send(error);
  }
});

app.post("/ask", async (req, res) => {
  try {
    const graph = {};

    const prompt = `
  Here is an realtionship-tree you should summarize in one sentence:

  Jerry - Purchased - Groundnut - Paid NGN6,000 - Remaining Balance of NGN1,000 - Groundnut stock was then reduced to 14.- It's Jerry's 9th purchase for the month.

  Please explain this relationship in a simple natural language.
  `;

    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
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
        temperature: 0.3,
      }),
    });

    const response = await bedrockRuntimeClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const text = responseBody?.content?.[0]?.text?.trim() || "{}";
    console.log(text);
    return res.status(200).send(text);
  } catch (error) {
    console.log(error);
    res.status(402).send(error);
  }
});

app.listen(3000, () => {
  console.log("Helix on port 3000");
});
