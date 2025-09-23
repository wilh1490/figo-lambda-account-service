import crypto from "crypto";
import fetch from "node-fetch";
import axios from "axios";
import { getSecrets } from "../config/secrets.js";
import { Router } from "./router.js";

const {
  FIGO_WA_PHONE_NUMBER,
  GRAPH_API_TOKEN,
  ACCOUNT_SERVICE_URL: account_service_url,
  RAG_API_URL,
} = await getSecrets();

const router = Router();

function registerMainRoute(router) {
  router.get("/", (req, res) => {
    res.send(`🦐`);
  });

  router.post("/", async (req, res) => {
    switch (req.body?.type) {
      //Carrot
      case "transfer": {
        if (!req.body?.eventType) {
          console.log("Incoming Account Webhook:");
          //InwardTransferWebhook(req.body.data);
          const ss = await fetch(`${account_service_url}/inward-transfer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body),
          });
          console.log(ss);
        }
        //Rentr
        // case "virtualAccount.transfer":
        //   if (req.body?.data) {
        //     await fetch(`https://rentr-service/inward-transfer`, {
        //       method: "POST",
        //       headers: {
        //         "Content-Type": "application/json",
        //       },
        //       body: JSON.stringify(req.body.data),
        //     });
        //   }
      }
    }

    switch (req.body?.eventType) {
      // case "account.debit":
      //   if (req.body?.data) {
      //     await fetch(`https://rentr-service/outward-transfer`, {
      //       method: "POST",
      //       headers: {
      //         "Content-Type": "application/json",
      //       },
      //       body: JSON.stringify(req.body.data),
      //     });
      //   }

      case "account.credit": {
        //Carrot
        if (req.body.type == "transfer" && req.body?.data) {
          //InwardTransferWebhook(req.body.data);
          const ss = await fetch(`${account_service_url}/inward-transfer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body),
          });

          console.log(ss);
        }
      }
    }
    res.sendStatus(200);
    //return res.json({});
  });

  router.post("/figo-pay-hook", async (req, res) => {
    console.log(req.body);

    await fetch(`${account_service_url}/figo-pay-hook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: req.body?.type || "",
        data: req.body?.data || {},
      }),
    });
    res.sendStatus(200);
  });

  router.post("/figo-pay-status", async (req, res) => {
    console.log(req.body);
    //res.send({ message: "Got it" });

    const response = await fetch(`${account_service_url}/figo-pay-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _id: req.body._id }),
    });

    const data = await response.json();

    console.log(req.body, data);

    return res.send(data);
  });

  router.post("/moringa", async (req, res) => {
    console.log("Incoming Moringa Webhook:", JSON.stringify(req.body, null, 2));

    const hash = crypto
      .createHash("sha512", "nlvkj60u50g3ux96guh8fm") //Webhook secret
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (hash !== req.headers["x-eversend-signature"]) {
      console.log("rejected");
      return res.status(401).send("Unauthorized request!");
    }
    // Do something
    console.log("accepted");
    res.status(200).send("Success!");
    switch (req.body?.eventType) {
      case "transaction.cryptoStatusUpdate":
        console.log("inside switch");
        await fetch(`${account_service_url}/moringa-inward-crypto`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        });
    }
  });

  router.get("/rag", async (req, res) => {
    return await fetch(`${RAG_API_URL}/create_kb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kb_name: req.query.kb_name,
      }),
    });
  });

  // router.post("/ingest", async (req, res) => {
  //   return await fetch(`${RAG_API_URL}/trigger/${req.body.path}`, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       ...req.body,
  //     }),
  //   });
  // });

  router.post("/add-referral-code", async (req, res) => {
    const { wa_id, referral_code } = req.body;

    const response = await fetch(
      `${account_service_url}/figo-add-referral-code`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wa_id,
          referral_code,
        }),
      }
    );
    return res.json(await response.json());
  });

  router.post("/send-reminder", async (req, res) => {
    const { header, body, wa_id } = req.body;
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: wa_id,
        type: "template",
        template: {
          name: "figo_reminder",
          language: {
            code: "en",
          },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "text",
                  text: header,
                },
              ],
            },
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: body,
                },
              ],
            },
          ],
        },
      },
    });

    return res.sendStatus(200);
  });

  router.post("/send-app", async (req, res) => {
    const { body, wa_id } = req.body;
    await fetch(`${account_service_url}/figo-send-app`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wa_id,
        text: body,
      }),
    });
    return res.sendStatus(200);
  });
}

router.use("", registerMainRoute);

export default router;
