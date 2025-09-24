import crypto from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getSecrets } from "../secrets.js";

const {
  WEBHOOK_VERIFY_TOKEN,
  GRAPH_API_TOKEN,
  WA_PHONE_NUMBER_ID,
  RENTR_WA_PHONE_NUMBER_ID,
  MORINGA_WA_PHONE_NUMBER,
  FIGO_WA_PHONE_NUMBER,
  RENTR_HOME_FLOW,
  RENTR_SEARCH_FLOW,
  SQS_QUEUE_URL,
} = await getSecrets();

const {
  APP_SECRET: CA_APP_SECRET,
  RENTR_APP_SECRET,
  AWS_REGION,
  S3_BUCKET,
} = await getSecrets();

const s3 = new S3Client({ region: AWS_REGION });

const SQClient = new SQSClient({ region: AWS_REGION });

export function isRequestSignatureValid(req, app) {
  console.log(req.rawBody, "rawBody", req.headers);
  const APP_SECRET = CA_APP_SECRET; // or pick based on app

  if (!APP_SECRET) {
    console.warn("App Secret not set");
    return true;
  }

  const signatureHeader = req.get("x-hub-signature-256");
  if (!signatureHeader) {
    console.error("Missing signature header", signatureHeader);
    return false;
  }

  const signatureBuffer = Buffer.from(
    signatureHeader.replace("sha256=", ""),
    "hex" // use hex instead of utf-8
  );

  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest("hex");
  const digestBuffer = Buffer.from(digestString, "hex");

  if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request Signature did not match");
    return false;
  }
  return true;
}

export const decryptRequest = (body, privatePem, passphrase) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const privateKey = crypto.createPrivateKey({ key: privatePem, passphrase });
  let decryptedAesKey = null;
  try {
    // decrypt AES key created by client
    decryptedAesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );
  } catch (error) {
    console.error(error);
    /*
    Failed to decrypt. Please verify your private key.
    If you change your public key. You need to return HTTP status code 421 to refresh the public key on the client
    */
    throw new FlowEndpointException(
      421,
      "Failed to decrypt the request. Please verify your private key."
    );
  }

  // decrypt flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer
  );
  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
};

export const encryptResponse = (
  response,
  aesKeyBuffer,
  initialVectorBuffer
) => {
  // flip initial vector
  const flipped_iv = [];
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1]);
  }

  // encrypt response data
  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    Buffer.from(flipped_iv)
  );
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
};

export const FlowEndpointException = class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
};

export const FileFromAWS = async (Key) => {
  try {
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
    console.log(error, "upload to aws");
    return null;
  }
};

export const AmountSeparator = (amount) => {
  const separate = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  let rounding = (Math.round(amount * 100) / 100).toFixed(2);
  const cal = separate(rounding);
  return cal;
};

export const ParseFlowFigo = async ({
  header,
  body,
  flow_id,
  flow_cta,
  flow_action_payload,
  flow_token,
  to,
}) => {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v22.0/${FIGO_WA_PHONE_NUMBER}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "flow",
          header: header,
          body: body,
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token,
              flow_id,
              flow_cta,
              flow_action: "navigate",
              flow_action_payload,
            },
          },
        },
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

export async function sendToQueue(message) {
  const command = new SendMessageCommand({
    QueueUrl: SQS_QUEUE_URL, // e.g., https://sqs.us-east-1.amazonaws.com/123456789012/figo-events-queue
    MessageBody: message,
  });
  await SQClient.send(command);
}

export const sendToWA = async ({ message, wa_id, PHONE_NUMBER_ID }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa_id,
      type: "text",
      text: {
        body: `*${message}*`,
      },
    },
  });
};
