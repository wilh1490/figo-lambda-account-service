// import express from "express";
// import dotenv from "dotenv";
// import webhookRoute from "./routes/index.js";
// import https from "https";
// import fs from "fs";
// import cors from "cors";
import router from "./routes/index.js";

// dotenv.config();

// const options = {
//   key: fs.readFileSync("/etc/ssl/certs/tls.key"),
//   cert: fs.readFileSync("/etc/ssl/certs/tls.crt"),
// };

// const app = express();

// app.use(cors());

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Routes
// app.use("/", webhookRoute);

// https.createServer(options, app).listen(443, "0.0.0.0", () => {
//   console.log("Webhook on port 443");
// });

export const handler = async (event, context) => {
  const httpMethod =
    event.httpMethod || (event.requestContext?.http?.method ?? "GET");
  const path = event.path || event.rawPath || "/";

  // Keep raw string for HMAC
  const rawBody =
    typeof event.body === "string"
      ? event.body
      : JSON.stringify(event.body || {});

  // Parse body safely
  let parsedBody = {};
  if (typeof event.body === "string") {
    try {
      parsedBody = JSON.parse(event.body);
    } catch {
      parsedBody = {};
    }
  } else if (typeof event.body === "object") {
    parsedBody = event.body;
  }

  // Normalize headers to lowercase
  const normalizedHeaders = {};
  for (const key in event.headers || {}) {
    normalizedHeaders[key.toLowerCase()] = event.headers[key];
  }

  const request = {
    method: httpMethod,
    path,
    body: parsedBody,
    rawBody, // <-- keep raw body for signature validation
    headers: normalizedHeaders,
    query: event.queryStringParameters || {},
    get: (header) => normalizedHeaders[header.toLowerCase()] || undefined,
  };

  console.log({ path, httpMethod, body: parsedBody });

  let response;
  try {
    response = await router.handle(request);
  } catch (err) {
    response = {
      statusCode: 500,
      body: { error: err.message },
    };
  }

  // Ensure body is string (AWS requires string)
  const responseBody =
    typeof response.body === "string"
      ? response.body
      : JSON.stringify(response.body ?? {});

  return {
    statusCode: response.statusCode || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: responseBody,
  };
};
