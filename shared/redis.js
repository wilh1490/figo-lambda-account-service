import redis from "redis";
import { getSecrets } from "./config/secrets.js";
const { REDIS_URL } = await getSecrets();
// Create a Redis client
export const redisClient = redis.createClient({
  url: `${REDIS_URL}`, // Use the service name and port directly
  socket: {
    connectTimeout: 5000, // Timeout for connection (in milliseconds)
    disconnectTimeout: 5000, // Timeout for disconnection
  },
});

// Connect to Redis and handle events
redisClient
  .connect()
  .then(() => {
    console.log("Connected to Shared Redis");
  })
  .catch((err) => {
    console.error("Redis connection error: ", err);
  });

// Error handling for Redis
redisClient.on("error", (err) => {
  console.error("Redis error: ", err);
});

export async function setValue(key, value) {
  await redisClient.set(key, value);
}

export async function getValue(key) {
  const value = await redisClient.get(key);
  return value;
}

