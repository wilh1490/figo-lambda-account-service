// import mainRoute from "./routes/main.js";
// import flowRoute from "./routes/flow.js";
// import webhookRoute from "./routes/webhook.js";
// import serverless from "serverless-http";
import router from "./routes/index.js";

//const app = express();

//app.use("/flow", flowRoute);

//app.use("/webhook", webhookRoute);

// https.createServer(options, app).listen(443, "0.0.0.0", () => {
//   console.log("Flow on port 3000");
// });

// async function initApp() {
//   if (!app._router) {
//     app.use(
//       express.json({
//         // store the raw request body to use it for signature verification
//         verify: (req, res, buf, encoding) => {
//           req.rawBody = buf?.toString(encoding || "utf8");
//         },
//       })
//     );

//     app.get("/ping", (req, res) => {
//       res.json({ message: "Pong" });
//     });

//     app.use(express.json());
//     app.use(express.urlencoded({ extended: true }));

//     // Routes
//     app.use("/", mainRoute);
//   }
// }

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
    headers: { "Content-Type": "application/json" },
    body: responseBody,
  };
};
