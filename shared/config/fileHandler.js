import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import https from "https";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getSecrets } from "./secrets.js";

// Configure the AWS S3 client
const { AWS_REGION, S3_BUCKET, SQS_QUEUE_URL, RAG_SQS_URL } =
  await getSecrets();

const s3 = new S3Client({ region: AWS_REGION });

const SQClient = new SQSClient({ region: "us-east-1" });

export const UploadToAWS = async ({
  Body,
  Key,
  ContentType,
  ContentDisposition,
}) => {
  try {
    //Upload to S3
    const params = {
      Bucket: S3_BUCKET,
      Key, //"uploads/compressed-image.png", // The S3 key (filename) where the image will be stored
      Body,
      ContentType, //"image/png", // Adjust if using other formats
      ACL: "public-read", // Make the image publicly readable,
      ContentDisposition,
    };

    // Upload the image to S3
    const location = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${Key}`;
    await s3.send(new PutObjectCommand(params));
    console.log(`Image uploaded successfully at ${location}`);
    return location;
  } catch (error) {
    console.log(error, "upload to aws");
    return null;
  }
};

export const FileFromAWS = async (Key) => {
  try {
    //Upload to S3
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key });
    const data = await s3.send(command);

    // Convert the stream into a buffer
    const streamToBuffer = async (stream) => {
      return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    };

    const buffer = await streamToBuffer(data.Body);
    console.log(`Image retrieved successfully from s3://${S3_BUCKET}/${Key}`);
    return buffer.toString("base64");
  } catch (error) {
    console.log("error file from aws");
    return null;
  }
};

// Function to download the encrypted file
const downloadEncryptedFile = async (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });
};

// Function to validate the encrypted file hash
const validateEncryptedFileHash = (encryptedFile, expectedEncryptedHash) => {
  const hash = crypto.createHash("sha256");
  hash.update(encryptedFile);
  const calculatedHash = hash.digest("base64");

  if (calculatedHash !== expectedEncryptedHash) {
    throw new Error("Encrypted file hash does not match!");
  }
  console.log("Encrypted file hash validated.");
};

// Function to validate the HMAC-SHA256 (first 10 bytes)
const validateHMAC = (ciphertext, hmacKey, iv, expectedHMAC) => {
  const hmac = crypto.createHmac("sha256", hmacKey);
  hmac.update(Buffer.concat([iv, ciphertext]));
  const calculatedHMAC = hmac.digest();

  // Compare only the first 10 bytes
  if (!calculatedHMAC.slice(0, 10).equals(expectedHMAC)) {
    throw new Error("HMAC validation failed!");
  }

  console.log("HMAC validated.");
};

// Function to decrypt the media using AES-256-CBC
const decryptMedia = (ciphertext, encryptionKey, iv) => {
  const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
  decipher.setAutoPadding(true);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  console.log("Media decrypted successfully.");
  return decrypted;
};

// Function to validate the decrypted media's hash
const validateDecryptedMediaHash = (decryptedMedia, expectedPlaintextHash) => {
  const hash = crypto.createHash("sha256");
  hash.update(decryptedMedia);
  const calculatedHash = hash.digest("base64");

  if (calculatedHash !== expectedPlaintextHash) {
    throw new Error("Decrypted media hash does not match!");
  }

  console.log("Decrypted media hash validated.");
};

// Main function to process the encrypted media file
export const processEncryptedMedia = async ({
  encryptionKey,
  hmacKey,
  iv,
  imageUrl,
  expectedEncryptedHash,
  expectedPlaintextHash,
  buffer,
}) => {
  // Encryption metadata from WhatsApp
  const encryptionKeyBuffer = Buffer.from(encryptionKey, "base64");
  const hmacKeyBuffer = Buffer.from(hmacKey, "base64");
  const ivBuffer = Buffer.from(iv, "base64");

  try {
    const encryptedFile = await downloadEncryptedFile(imageUrl);
    console.log("Encrypted file downloaded successfully.");

    // Separate the ciphertext and the appended 10-byte HMAC
    const ciphertext = encryptedFile.slice(0, -10); // All except last 10 bytes
    const hmac10 = encryptedFile.slice(-10); // Last 10 bytes

    // Validate the encrypted file hash
    validateEncryptedFileHash(encryptedFile, expectedEncryptedHash);

    // Validate the HMAC-SHA256
    validateHMAC(ciphertext, hmacKeyBuffer, ivBuffer, hmac10);

    // Decrypt the media content
    const decryptedMedia = decryptMedia(
      ciphertext,
      encryptionKeyBuffer,
      ivBuffer
    );

    // Validate the decrypted media's hash
    validateDecryptedMediaHash(decryptedMedia, expectedPlaintextHash);
    console.log("Decryption and validation successful.");

    // Optionally, save decrypted media to file (e.g., as an image)
    //fs.writeFileSync("decrypted_image.png", decryptedMedia);

    return decryptedMedia;
  } catch (error) {
    console.error("Error processing the encrypted media:", error.message);
  }
};

export async function sendToQueue(message) {
  const command = new SendMessageCommand({
    QueueUrl: SQS_QUEUE_URL, // e.g., https://sqs.us-east-1.amazonaws.com/123456789012/figo-events-queue
    MessageBody: message,
  });

  await SQClient.send(command);
}

export async function sendToQueueRag(message) {
  const command = new SendMessageCommand({
    QueueUrl: RAG_SQS_URL, // e.g., https://sqs.us-east-1.amazonaws.com/123456789012/figo-events-queue
    MessageBody: message,
  });

  await SQClient.send(command);
}
