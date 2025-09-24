import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { redisClient } from "../shared/redis.js";

const dynamoClient = new DynamoDBClient({ region: "us-east-1" });

const MEMORY_TABLE = "FigoUserMemory";

export async function loadMemory(sessionId) {
  try {
    //Get memory from redis before dynamo
    let memory = await redisClient.get(sessionId);
    if (memory) {
      return JSON.parse(memory);
    }

    const command = new GetItemCommand({
      TableName: MEMORY_TABLE,
      Key: { sessionId: { S: sessionId } },
    });

    const response = await dynamoClient.send(command);
    if (response.Item && response.Item.data) {
      return JSON.parse(response.Item.data.S);
    }
    return {};
  } catch (err) {
    console.error("Error loading memory:", err);
    return {};
  }
}

export async function saveMemory(sessionId, memory) {
  try {
    //Save memory in redis for 1 Hr
    await redisClient.set(sessionId, JSON.stringify(memory), "EX", 3600);

    //Persist in dynamo
    const command = new PutItemCommand({
      TableName: MEMORY_TABLE,
      Item: {
        sessionId: { S: sessionId },
        data: { S: JSON.stringify(memory) },
        updatedAt: { S: new Date().toISOString() },
      },
    });
    await dynamoClient.send(command);
  } catch (err) {
    console.error("Error saving memory:", err);
  }
}

export function updateMemory(existing, detected) {
  return {
    ...existing,
    lastProduct:
      detected.entities?.products?.slice(-1)[0] || existing.lastProduct,
    lastIntent: detected.intents?.slice(-1)[0] || existing.lastIntent,
    productHistory: Array.from(
      new Set([
        ...(existing.productHistory || []),
        ...(detected.entities?.products || []),
      ])
    ),
    intentHistory: Array.from(
      new Set([...(existing.intentHistory || []), ...(detected.intents || [])])
    ),
    timeRange: detected.entities?.timeRange || existing.timeRange || "30d",
    customer: detected.entities?.customer || existing.customer,
    supplier: detected.entities?.supplier || existing.supplier,
    referralCode: detected.entities?.referral_code || existing.referralCode,
    //history: [...(existing.history || []), detected.raw || ""].slice(-10), //Make Memory Context Longer
  };
}
