import mongoose from "mongoose";
import router from "./routes/index.js";
import { getSecrets } from "./shared/config/secrets.js";

let { DATABASE_URL: dbUri } = await getSecrets();

mongoose.Promise = global.Promise;

let conn = null;

mongoose.connection
  .on("error", (err) => console.error("Unable to connect to database", err))
  .on("close", () => console.log("Database connection closed."));

async function connectDB() {
  if (mongoose.connection.readyState === 1) return conn;
  conn = await mongoose.connect(dbUri, {});
  return conn;
}

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
    await connectDB();
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
    headers: { "Content-Type": "application/json" },
    body: responseBody,
  };
};
