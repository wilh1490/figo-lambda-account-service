import axios from "axios";
import fetch from "node-fetch";
import { getSecrets } from "../shared/config/secrets.js";

const { FIGO_WA_PHONE_NUMBER, GRAPH_API_TOKEN, ACCOUNT_SERVICE_URL } =
  await getSecrets();

export const sendToWA = async ({ message, wa_id }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
    headers: {
      "Content-Type": "application/json",
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

export const sendFigoApp = async ({ message, wa_id }) => {
  await fetch(`${ACCOUNT_SERVICE_URL}/figo-send-app`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wa_id,
      text: message,
    }),
  });
};

export const sendReplyButton = async ({ message, wa_id, button_id }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa_id,
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "text",
          text: "List",
        },
        body: {
          text: `${message}`,
        },
        footer: {
          text: "Figo by Carrot",
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `restock-button-${button_id}`,
                title: "Restock",
              },
            },
            {
              type: "reply",
              reply: {
                id: `new-sale-button-${button_id}`,
                title: "New sale",
              },
            },
            {
              type: "reply",
              reply: {
                id: `new-invoice-button-${button_id}`,
                title: "New invoice",
              },
            },
          ],
        },
      },
    },
  });
};
