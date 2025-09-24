//import { Router } from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../redis.js";
import fetch from "node-fetch";
import {
  AmountSeparator,
  FileFromAWS,
  ParseFlowFigo,
  sendToQueue,
  sendToWA,
} from "../helper/tools.js";
import { MORINGA_RESPONSES } from "../helper/flow/moringa/responses.js";
import { FIGO_SCREEN_RESPONSES } from "../helper/flow/figo/responses.js";
import { parsePhoneNumber } from "libphonenumber-js";
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
  RAG_API_URL,
} = await getSecrets();

//const router = Router();

export default function registerWebhookRoute(router) {
  router.post("/", async (req, res) => {
    try {
      //log incoming messages
      console.log("***Incoming Webhook***");

      const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
      const user_phone_number = message?.from;
      const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
      const user_display_name = contact?.profile?.name || "";
      let phone_number_id =
        req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

      //Start Typing Indicator
      if (
        message &&
        ["text", "interactive", "image", "document"].includes(message?.type)
      ) {
        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v23.0/${phone_number_id}/messages`,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          },
          data: {
            messaging_product: "whatsapp",
            status: "read",
            message_id: message?.id,
            typing_indicator: {
              type: "text",
            },
          },
        });
      }

      //End Typing Indicator
      let nfm_reply = message?.interactive?.nfm_reply?.response_json;

      if (nfm_reply) nfm_reply = JSON.parse(nfm_reply);

      /** Figo **/
      if (phone_number_id === FIGO_WA_PHONE_NUMBER) {
        console.log("Incoming webhook at Figo:", message);

        let figo_active_account = await redisClient.get(
          `figo_active_account_${user_phone_number}`
        );

        //Check if country is supported
        if (
          ["text", "interactive", "image", "video", "document"].includes(
            message?.type
          )
        ) {
          const _parsePhone = parsePhoneNumber(`+${user_phone_number}`);
          const user_country_code = _parsePhone.country;

          //If user country is not in supported countries, terminate
          if (!["NG"].includes(user_country_code)) {
            await sendToWA({
              message:
                "Figo is unavailable in your country at the moment. Please check back later.",
              wa_id: user_phone_number,
              PHONE_NUMBER_ID: FIGO_WA_PHONE_NUMBER,
            });
            return;
          }
        }

        console.log({ RAG_API_URL, phone_number_id, GRAPH_API_TOKEN, message });

        switch (message?.type) {
          case "text": {
            let message_text = message?.text?.body || "";

            const listPart = message_text
              .split("\n")
              .find((line) => line.trim())
              ?.trim()
              .toLowerCase();

            // const spinPart = (message_text.match(/(\/.*?_.*?)(?=_|$)/) || [
            //   message_text,
            // ])[0].toLowerCase();

            console.log(listPart, "list part");

            //Send to Queue
            if (!figo_active_account) {
              sendToQueue(
                JSON.stringify({
                  intent: "figoAccountDataQueue",
                  payload: {
                    wa_id: user_phone_number,
                    display_name: user_display_name,
                  },
                })
              );
            }

            await fetch(`${RAG_API_URL}/ask`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: message_text || "App",
                wa_id: user_phone_number,
                businessId: figo_active_account,
                is_list: listPart == "/list",
                //lucky_spin: spinPart == "/lucky_spin",
              }),
            });
            break;
          }

          case "interactive": {
            if (message?.interactive?.type == "button_reply") {
              if (
                message?.interactive?.button_reply?.id.includes(
                  "restock-button"
                )
              ) {
                await sendToQueue(
                  JSON.stringify({
                    intent: "figoListRestock",
                    payload: {
                      wa_id: user_phone_number,
                      button_id: message?.interactive?.button_reply?.id,
                    },
                  })
                );
              } else {
                if (
                  message?.interactive?.button_reply?.id.includes(
                    "new-sale-button"
                  )
                ) {
                  await sendToQueue(
                    JSON.stringify({
                      intent: "figoListNewSale",
                      payload: {
                        wa_id: user_phone_number,
                        button_id: message?.interactive?.button_reply?.id,
                      },
                    })
                  );
                }
                if (
                  message?.interactive?.button_reply?.id.includes(
                    "new-invoice-button"
                  )
                ) {
                  await sendToQueue(
                    JSON.stringify({
                      intent: "figoListNewInvoice",
                      payload: {
                        wa_id: user_phone_number,
                        button_id: message?.interactive?.button_reply?.id,
                      },
                    })
                  );
                }
              }
            }
            break;
          }
          default:
            console.warn("Figo webhook default");
            break;
        }
      }

      /** Carrot **/
      if (phone_number_id === WA_PHONE_NUMBER_ID) {
        console.log("Incoming webhook at Carrot:", message);
        // check if the incoming message contains text
        if (
          message?.type === "text" ||
          nfm_reply?.screen === "UPDATE_REQUIRED"
        ) {
          // extract the business number to send the reply from it
          let message_text = message?.text?.body || "";
          // const business_phone_number_id =
          //   req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
          const user_phone_number = message?.from;

          const flow_token = uuidv4();
          // console.log(flow_token, "Carrot");
          await redisClient.set(`flow_token_${flow_token}`, user_phone_number);

          let is_verified = await redisClient.get(
            `is_verified_${user_phone_number}`
          );
          let account_number_string = await redisClient.get(
            `account_number_string_${user_phone_number}`
          );
          let account_number_copy = await redisClient.get(
            `account_number_copy_${user_phone_number}`
          );
          let account_name = await redisClient.get(
            `account_name_${user_phone_number}`
          );

          //message_text.replace(/\s+/g, "") === "/self_recharge_100"

          const match_self_recharge = message_text.match(/_recharge_(\d+)/);

          if (match_self_recharge) {
            // fetch(``, {
            //   method: "POST",
            //   headers: {
            //     "Content-Type": "application/json",
            //   },
            //   body: JSON.stringify({
            //     wa_id: user_phone_number,
            //     amount: parseFloat(match_self_recharge[1]),
            //   }),
            // });

            await sendToQueue(
              JSON.stringify({
                intent: "selfServiceQueue",
                payload: {
                  wa_id: user_phone_number,
                  amount: parseFloat(match_self_recharge[1]),
                },
              })
            );
          } else {
            if (message_text.trim() == "/payments" && is_verified) {
              await axios({
                method: "POST",
                url: `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
                headers: {
                  Authorization: `Bearer ${GRAPH_API_TOKEN}`,
                },
                data: {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: user_phone_number,
                  type: "interactive",
                  interactive: {
                    type: "flow",
                    header: {
                      type: "text",
                      text: "Payments",
                    },
                    body: {
                      text: "Airtime, Transfer, Bills, Data, DSTV, Commission",
                    },
                    // footer: {
                    //   text: "Bank on your WhatsApp.",
                    // },
                    action: {
                      name: "flow",
                      parameters: {
                        flow_message_version: "3",
                        flow_token,
                        flow_id: "1018091070182873",
                        flow_cta: "Open",
                        flow_action: "navigate",
                        flow_action_payload: {
                          screen: "MORE_PAYMENTS",
                          data: {
                            is_verified: !!is_verified,
                          },
                        },
                      },
                    },
                  },
                },
              });
            } else {
              await axios({
                method: "POST",
                url: `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
                headers: {
                  Authorization: `Bearer ${GRAPH_API_TOKEN}`,
                },
                data: {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: user_phone_number,
                  type: "interactive",
                  interactive: {
                    type: "flow",
                    header: {
                      type: "text",
                      text: "Welcome to Carrot",
                    },
                    body: {
                      text: "Airtime, Transfer, Bills, Data, Commission",
                    },
                    footer: {
                      text: "Bank on your WhatsApp.",
                    },
                    action: {
                      name: "flow",
                      parameters: {
                        flow_message_version: "3",
                        flow_token,
                        flow_id: "410422032142598",
                        flow_cta: "Open App",
                        flow_action: "navigate",
                        flow_action_payload: {
                          screen: "LOGIN",
                          data: {
                            account_number_string:
                              account_number_string ||
                              "Safe Haven MFB - XXXXXXXXX",
                            account_number_copy:
                              account_number_copy ||
                              "Safe Haven MFB - XXXXXXXXX",
                            account_name:
                              account_name ||
                              "Go to KYC to activate your account",
                            is_verified: !!is_verified,
                          },
                        },
                      },
                    },
                  },
                },
              });
            }
          }

          //Send to Queue
          // fetch(``, {
          //   method: "POST",
          //   headers: {
          //     "Content-Type": "application/json",
          //   },
          //   body: JSON.stringify({ wa_id: user_phone_number }),
          // });

          sendToQueue(
            JSON.stringify({
              intent: "accountDataQueue",
              payload: { wa_id: user_phone_number },
            })
          );

          //const user_name =
          //req.body.entry?.[0].changes?.[0].value?.contacts[0]?.profile?.name;
          // send a reply message as per the docs here https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
        }
      }

      /** Moringa **/
      if (phone_number_id === MORINGA_WA_PHONE_NUMBER) {
        console.log("Incoming webhook at Moringa:", message);

        // check if the incoming message contains text
        if (
          message?.type === "text" ||
          nfm_reply?.screen === "UPDATE_REQUIRED"
        ) {
          // extract the business number to send the reply from it
          // let message_text = message?.text?.body || "";
          // const business_phone_number_id =
          //   req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
          const user_phone_number = message?.from;

          const flow_token = uuidv4();

          await redisClient.set(
            `moringa_flow_token_${flow_token}`,
            user_phone_number
          );

          let is_verified = await redisClient.get(
            `moringa_is_verified_${user_phone_number}`
          );
          let balance_avatar_key_usd = await redisClient.get(
            `moringa_balance_usd_${user_phone_number}`
          );

          let balance = balance_avatar_key_usd
            ? await FileFromAWS(balance_avatar_key_usd)
            : MORINGA_RESPONSES.HOME.data.balance;

          let moringa_usdt = await redisClient.get(
            `moringa_usdt_${user_phone_number}`
          );
          let moringa_usdt_usd = await redisClient.get(
            `moringa_usdt_usd_${user_phone_number}`
          );
          let moringa_usdc = await redisClient.get(
            `moringa_usdc_${user_phone_number}`
          );
          let moringa_usdc_usd = await redisClient.get(
            `moringa_usdc_usd_${user_phone_number}`
          );
          let moringa_ngn = await redisClient.get(
            `moringa_ngn_${user_phone_number}`
          );
          let moringa_ngn_usd = await redisClient.get(
            `moringa_ngn_usd_${user_phone_number}`
          );

          await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${MORINGA_WA_PHONE_NUMBER}/messages`,
            headers: {
              Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            },
            data: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: user_phone_number,
              type: "interactive",
              interactive: {
                type: "flow",
                header: {
                  type: "text",
                  text: "Moringa",
                },
                body: {
                  text: "USDT, USDC, Naira, Swap, Transfer",
                },
                footer: {
                  text: "Crypto to cash in minutes.",
                },
                action: {
                  name: "flow",
                  parameters: {
                    flow_message_version: "3",
                    flow_token,
                    flow_id: "1367557567624185",
                    flow_cta: "Open App",
                    flow_action: "navigate",
                    flow_action_payload: {
                      screen: "LOGIN",
                      data: {
                        usdt: moringa_usdt || "0.00000 USDT",
                        usdc: moringa_usdc || "0.00000 USDC",
                        ngn: moringa_ngn || "₦0.00",
                        usdt_usd: moringa_usdt_usd || "",
                        usdc_usd: moringa_usdc_usd || "",
                        ngn_usd: moringa_ngn_usd || "",
                        balance,
                        is_verified: !!is_verified,
                      },
                    },
                  },
                },
              },
            },
          });

          //Send to Queue
          // fetch(``, {
          //   method: "POST",
          //   headers: {
          //     "Content-Type": "application/json",
          //   },
          //   body: JSON.stringify({ wa_id: user_phone_number }),
          // });

          sendToQueue(
            JSON.stringify({
              intent: "moringaAccountDataQueue",
              payload: { wa_id: user_phone_number },
            })
          );
        }
      }

      /* Rentr */
      if (phone_number_id === RENTR_WA_PHONE_NUMBER_ID) {
        //log incoming messages
        console.log(
          "Incoming webhook at Rentr:",
          JSON.stringify(req.body, null, 2)
        );

        // check if the incoming message contains text
        if (
          message?.type === "text" ||
          nfm_reply?.screen === "UPDATE_REQUIRED"
        ) {
          const user_phone_number = message?.from;

          const flow_token = uuidv4();

          await redisClient.set(
            `rentr_flow_token_${flow_token}`,
            user_phone_number
          );

          //Search Flow
          if (message?.text?.body?.length == 4 && !isNaN(message?.text?.body)) {
            let references = await redisClient.get("rentr_listings");
            references = JSON.parse(references);
            let search = references.filter(
              (e) => e.reference == message?.text?.body
            );

            if (search.length == 0) search = references;

            let places = await Promise.all(
              search.map(async (listing) => {
                try {
                  const image = await FileFromAWS(listing.thumbnail);
                  return {
                    id: listing._id,
                    title: listing.title,
                    description: (listing.description || "").substring(0, 300),
                    metadata:
                      listing.listing_type === "flexible"
                        ? `NGN ${AmountSeparator(
                            listing.duration?.[0]?.price || 0
                          )}`
                        : `NGN ${AmountSeparator(
                            listing.duration?.[1]?.price ||
                              listing.duration?.[2]?.price ||
                              listing.duration?.[3]?.price ||
                              listing.duration?.[4]?.price ||
                              listing.duration?.[5]?.price ||
                              0
                          )}`,
                    image: image || "DefaultImageBase64String",
                  };
                } catch (err) {
                  console.log(err);
                }
              })
            );

            console.log("at search", places);

            await axios({
              method: "POST",
              url: `https://graph.facebook.com/v22.0/${RENTR_WA_PHONE_NUMBER_ID}/messages`,
              headers: {
                Authorization: `Bearer ${GRAPH_API_TOKEN}`,
              },
              data: {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: user_phone_number,
                type: "interactive",
                interactive: {
                  type: "flow",
                  header: {
                    type: "image",
                    image: {
                      link: search[0].cover_png, //Cover Image
                    },
                  },
                  body: {
                    text: `*Found some great places near ${search[0].area}*`,
                  },
                  footer: {
                    text: `${search[0].title}`,
                  },
                  action: {
                    name: "flow",
                    parameters: {
                      flow_message_version: "3",
                      flow_token,
                      flow_id: RENTR_SEARCH_FLOW,
                      mode: "published",
                      flow_cta: "Open",
                      flow_action: "navigate",
                      flow_action_payload: {
                        screen: "SEARCH_BY_ID",
                        data: {
                          is_loaded: true,
                          places,
                          is_next: false,
                          is_previous: false,
                          show_message: false,
                          message: `Found ${search.length} results matching your search.`,
                        },
                      },
                    },
                  },
                },
              },
            });

            // mark incoming message as read
            await axios({
              method: "POST",
              url: `https://graph.facebook.com/v22.0/${RENTR_WA_PHONE_NUMBER_ID}/messages`,
              headers: {
                Authorization: `Bearer ${GRAPH_API_TOKEN}`,
              },
              data: {
                messaging_product: "whatsapp",
                status: "read",
                message_id: message.id,
              },
            });

            return;
          }

          console.log("at home");
          //Home Flow
          await axios({
            method: "POST",
            url: `https://graph.facebook.com/v22.0/${RENTR_WA_PHONE_NUMBER_ID}/messages`,
            headers: {
              Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            },
            data: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: user_phone_number,
              type: "interactive",
              interactive: {
                type: "flow",
                header: {
                  type: "image",
                  image: {
                    link: "https://slashit.s3.us-east-1.amazonaws.com/cover-1733771088998", //Cover Image
                  },
                },
                body: {
                  text: "*Welcome to Rentr*",
                },
                footer: {
                  text: "Rent, List a place, Earn.",
                },
                action: {
                  name: "flow",
                  parameters: {
                    flow_message_version: "3",
                    flow_token,
                    flow_id: RENTR_HOME_FLOW,
                    mode: "published",
                    flow_cta: "Open",
                    flow_action: "navigate",
                    flow_action_payload: {
                      screen: "HOME",
                    },
                  },
                },
              },
            },
          });

          // mark incoming message as read
          await axios({
            method: "POST",
            url: `https://graph.facebook.com/v22.0/${RENTR_WA_PHONE_NUMBER_ID}/messages`,
            headers: {
              Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            },
            data: {
              messaging_product: "whatsapp",
              status: "read",
              message_id: message.id,
            },
          });

          //const user_name =
          //req.body.entry?.[0].changes?.[0].value?.contacts[0]?.profile?.name;
          // send a reply message as per the docs here https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
        }

        if (
          nfm_reply?.screen === "CANCEL_BOOKING_HOST" ||
          nfm_reply?.screen === "CANCEL_BOOKING_GUEST"
        ) {
          await fetch(`http://rentr-service/cancel-booking`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...nfm_reply }), //Query param "reference" ""
          });
        }
      }
      res.sendStatus(200);
    } catch (error) {
      console.log("Error at flow incoming webhook", error);
      res.sendStatus(200);
    }
  });

  router.get("/", (req, res) => {
    console.log(req.query, "i got here");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // check the mode and token sent are correct
    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      // respond with 200 OK and challenge token from the request
      console.log("Webhook verified successfully!");
      res.status(200).send(challenge);
    } else {
      // respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  });
}
