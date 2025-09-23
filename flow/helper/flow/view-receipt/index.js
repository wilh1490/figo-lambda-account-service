import axios from "axios";
import { getSecrets } from "../../../secrets.js";

const { ACCOUNT_SERVICE_URL: account_service_url } = await getSecrets();

export const getNextScreenViewReceipt = async (decryptedBody) => {
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
      screen: "VIEW_RECEIPT",
      data: {},
    };
  }

  //if (action === "BACK") {
  //return {
  // screen: "VIEW_RECEIPT",
  // data: {},
  //};
  // }

  if (action === "data_exchange") {
    // handle the request based on the current screen
    switch (screen) {
      // handles when user interacts with LOAN screen
      case "VIEW_RECEIPT": {
        // Handles user selecting
        const res = await axios({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          url: `${account_service_url}/view-receipt`,
          data: JSON.stringify({ ...data, flow_token }),
        });
        return res.data;
      }

      default:
        break;
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};
