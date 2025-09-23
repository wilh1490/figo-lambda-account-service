import PLimit from "p-limit";
import { pollIngestion } from "./job/index.js";
import mongoose from "mongoose";
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

const pLimit = PLimit(5);

async function processEvent(message) {
  const { intent, payload: msg } = message;
  switch (intent) {
    case "pollIngestion":
      await pollIngestion(msg);
      break;

    default:
      console.warn("Unknown intent:", intent);
      break;
  }
}

// 👇 Main Lambda entrypoint
export const handler = async (event, context) => {
  await connectDB();
  // event.Records comes from SQS trigger
  const results = await Promise.all(
    event.Records.map((record) =>
      pLimit(async () => {
        try {
          const body = JSON.parse(record.body || {});
          console.log("Processing message:", body);
          await processEvent(body);
          return { ok: true };
        } catch (err) {
          console.error("Error processing message:", err);
          return { ok: false, error: err.message };
        }
      })
    )
  );

  console.log("Rag Batch complete:", results);
  return {};
};
