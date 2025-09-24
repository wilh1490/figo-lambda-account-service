import redis from "redis";
import { getSecrets } from "./shared/config/secrets.js";

// Create a Redis client

const { REDIS_URL } = await getSecrets();

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
    console.log("Connected to Rag Redis");
  })
  .catch((err) => {
    console.error("Redis connection error: ", err);
  });

// Error handling for Redis
redisClient.on("error", (err) => {
  console.error("Redis error: ", err);
});
