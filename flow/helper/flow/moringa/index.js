import fetch from "node-fetch";
import { MORINGA_RESPONSES } from "./responses.js";
import { getSecrets } from "../../../secrets.js";

const { ACCOUNT_SERVICE_URL: account_service_url } = await getSecrets();

export const getNextScreenMoringa = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;
  // handle health check request
  if (action === "ping") {
    return {
      version,
      data: {
        status: "active",
      },
    };
  }

  // handle error notification
  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      version,
      data: {
        acknowledged: true,
      },
    };
  }

  // handle initial request when opening the flow and display welcome screen
  if (action === "INIT") {
    return {
      screen: "LOGIN",
      data: {},
    };
  }

  if (action === "BACK") {
    switch (screen) {
      default:
        console.log("Nothing here 12cc");
        break;
    }
  }

  if (action === "data_exchange") {
    // handle the request based on the current screen
    switch (screen) {
      // handles when user interacts with screens
      case "HOME":
        // Handles user selecting
        if (data.type == "intro") {
          const res = await fetch(`${account_service_url}/moringa-intro-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        } else {
          const res = await fetch(`${account_service_url}/moringa-home`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }

      case "USDT_WALLET": {
        const res = await fetch(`${account_service_url}/moringa-home`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "USDC_WALLET": {
        const res = await fetch(`${account_service_url}/moringa-home`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "NGN_WALLET": {
        if (data.type == "transfer") {
          const res = await fetch(`${account_service_url}/moringa-transfer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        } else {
          const res = await fetch(`${account_service_url}/moringa-home`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }
      }

      case "SWAP": {
        const res = await fetch(`${account_service_url}/moringa-swap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "VERIFY_EMAIL": {
        const res = await fetch(`${account_service_url}/moringa-verify-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "TAKE_SELFIE": {
        const res = await fetch(`${account_service_url}/moringa-verify-nin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "SETTINGS": {
        if (data.type == "security") {
          const res = await fetch(`${account_service_url}/moringa-security`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }
      }

      case "SECURITY": {
        const res = await fetch(`${account_service_url}/moringa-security`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "CHAT_SUPPORT": {
        const res = await fetch(`${account_service_url}/moringa-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "PIN_WALL": {
        const res = await fetch(`${account_service_url}/moringa-pin-wall/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "SET_TRANSACTION_PIN": {
        const res = await fetch(`${account_service_url}/moringa-set-pin/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "CHANGE_TRANSACTION_PIN":
        const res = await fetch(`${account_service_url}/moringa-change-pin/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...data,
            flow_token,
          }),
        });
        return await res.json();

      case "PRIMARY_FINISH": {
        const res = await fetch(`${account_service_url}/moringa-intro-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }
      default:
        break;
    }
  }
  if (action === "complete") {
    switch (screen) {
      default:
        console.log("Nothing here 12cc");
        break;
    }
  }

  console.log("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};
