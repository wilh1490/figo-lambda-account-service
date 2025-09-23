import SCREEN_RESPONSES from "./responses.js";
import axios from "axios";
import fetch from "node-fetch";
import { getSecrets } from "../../../secrets.js";

const { ACCOUNT_SERVICE_URL: account_service_url } = await getSecrets();

export const getNextScreenMain = async (decryptedBody) => {
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
      data: {
        account_number_string: "Safe Haven MFB - XXXXXXXXX",
        account_name: "Go to KYC to activate your account",
        intro: "Activate account number",
      },
    };
  }

  if (action === "BACK") {
    switch (screen) {
      case "KYC_LEVEL_THREE": {
        const res = await axios({
          method: "GET",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/return-to-kyc/${flow_token}`,
        });
        return res.data;
      }

      case "UPDATE_REQUIRED": {
        console.log();
        return {
          screen: "ZONE_A",
          data: { is_loaded: false, account_name: "", bundles: [] },
        };
      }

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
          const res = await fetch(`${account_service_url}/intro-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }

      case "MORE_ACCOUNT":
        if (data.type == "kyc") {
          const res = await fetch(
            `${account_service_url}/return-to-kyc/${flow_token}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          return await res.json();
        }

      case "MORE_SETTINGS": {
        if (data.type == "security") {
          const res = await fetch(
            `${account_service_url}/security/${flow_token}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          return await res.json();
        }
      }

      case "CHAT_SUPPORT": {
        const res = await fetch(`${account_service_url}/continue-to-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "DEBIT_CARD": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/join-card-waitlist/${flow_token}`,
        });
        return res.data;
      }

      case "STATEMENT": {
        const res = await axios({
          method: "GET",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/fetch-statement`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "ZONE_A": {
        if (data.resolve) {
          const res = await fetch(`${account_service_url}/resolve-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token, screen }),
          });
          return await res.json();
        } else {
          if (data.recent) {
            const res = await fetch(`${account_service_url}/recent`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token }),
            });
            return await res.json();
          } else {
            const res = await fetch(`${account_service_url}/pin-wall`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token }),
            });
            return await res.json();
          }
        }
      }

      case "RECENT_AIRTIME": {
        return {
          ...SCREEN_RESPONSES.PIN_WALL,
          data: {
            init_pin: "",
            tag: "Airtime to",
            to: `${data.to}`,
            amount: `${data.amount}`,
            is_valid: true,
            type: "airtime",
            metadata: {
              to: `${data.to}`,
              network: "recent",
              bank_code: "",
              account_number: "",
              bundle: "",
            },
          },
        };
      }

      case "RECENT_TRANSFER": {
        const res = await fetch(`${account_service_url}/recent-transfer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "ZONE_B": {
        if (data.resolve) {
          const res = await fetch(`${account_service_url}/resolve-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        } else {
          const res = await fetch(`${account_service_url}/pin-wall`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }
      }

      case "AIRTIME": {
        const res = await fetch(`${account_service_url}/continue-to-pinwall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token, type: "airtime" }),
        });
        return await res.json();
      }

      case "DATA":
        if (data.type === "resolve") {
          const res = await fetch(`${account_service_url}/resolve-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token, type: "data" }),
          });
          return await res.json();
        } else {
          const res = await fetch(
            `${account_service_url}/continue-to-pinwall/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token, type: "data" }),
            }
          );
          return await res.json();
        }

      case "DSTV":
        if (data.type === "resolve") {
          const res = await fetch(`${account_service_url}/resolve-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token, type: "dstv" }),
          });
          return await res.json();
        } else {
          const res = await fetch(
            `${account_service_url}/continue-to-pinwall/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token, type: "dstv" }),
            }
          );
          return await res.json();
        }

      case "ELECTRICITY":
        if (data.type === "resolve") {
          const res = await fetch(`${account_service_url}/resolve-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token, type: "power" }),
          });
          return await res.json();
        } else {
          const res = await fetch(
            `${account_service_url}/continue-to-pinwall/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token, type: "power" }),
            }
          );
          return await res.json();
        }

      case "TRANSFER":
        if (data.type === "resolve") {
          const res = await fetch(`${account_service_url}/resolve-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token, type: "transfer" }),
          });
          return await res.json();
        } else {
          const res = await fetch(
            `${account_service_url}/continue-to-pinwall/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token, type: "transfer" }),
            }
          );
          return await res.json();
        }

      case "RECEIPT": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/print-receipt/`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "PIN_WALL": {
        const res = await fetch(`${account_service_url}/pin-wall/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return await res.json();
      }

      case "SET_TRANSACTION_PIN": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/set-pin/`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "CHANGE_TRANSACTION_PIN":
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/change-pin/`,
          data: JSON.stringify({
            ...data,
            flow_token,
            resend_code: data.type == "resend_code" ? true : false,
          }),
        });
        return res.data;

      case "UPLOAD_BVN": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/upload-bvn`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "UPLOAD_NIN": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/upload-nin`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "TAKE_SELFIE": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/upload-selfie-nin`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "TAKE_SELFIE_BVN": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/upload-selfie-bvn`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      case "BVN_OTP":
        if (data.type === "resend_code") {
          const res = await fetch(`${account_service_url}/upload-bvn`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        } else {
          const res = await fetch(`${account_service_url}/bvn-otp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }

      case "NIN_OTP":
        if (data.type === "resend_code") {
          const res = await fetch(`${account_service_url}/upload-nin`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        } else {
          const res = await fetch(`${account_service_url}/nin-otp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        }

      case "UPLOAD_DOCUMENT_PHOTO": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/upload-document`,
          data: JSON.stringify({
            ...data,
            flow_token,
          }),
        });
        return res.data;
      }

      case "UPLOAD_DOCUMENT_FILE": {
        const res = await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/upload-document`,
          data: JSON.stringify({
            ...data,
            flow_token,
          }),
        });
        return res.data;
      }

      case "SECURITY":
        // if (data.type == "set_pin") {
        //   return {
        //     ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
        //   };
        // }
        if (data.is_pin) {
          const res = await axios({
            method: "POST",
            timeout: 90000,
            headers: {
              "Content-Type": "application/json",
            },
            url: `${account_service_url}/change-pin`,
            data: JSON.stringify({
              flow_token,
              resend_code: true,
              is_otp: true,
            }),
          });
          return res.data;
        } else {
          return {
            ...SCREEN_RESPONSES.SET_TRANSACTION_PIN,
          };
        }

      case "PRIMARY_FINISH": {
        const res = await axios({
          method: "GET",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/return-to-home/${flow_token}`,
        });
        return res.data;
      }
      default:
        break;
    }
  }
  if (action === "complete") {
    switch (screen) {
      case UPDATE_REQUIRED:
        await axios({
          method: "POST",
          timeout: 90000,
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/restart_flow/${flow_token}`,
        });
        break;

      default:
        console.log("Nothing here 12cc");
        break;
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};
