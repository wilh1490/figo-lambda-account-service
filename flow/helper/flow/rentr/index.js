import dayjs from "dayjs";
import RENTR_SCREEN_RESPONSES from "./responses.js";
import fetch from "node-fetch";

export const getNextScreenRentr = async (decryptedBody) => {
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
  if (action?.toUpperCase() === "INIT") {
    console.log("init_action navigate to screen");
    //Create User if not exist
    await fetch(`http://rentr-service/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...data, flow_token }), //Query param ""
    });

    return {
      screen: "HOME",
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
      // handles when user interacts with screen
      case "HOME": {
        //Create User if not exist
        await fetch(`http://rentr-service/create-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param ""
        });

        // Handles user selecting
        if (data.type == "search") {
          const res = await fetch(`http://rentr-service/fetch-areas`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param ""
          });
          return await res.json();
        }
        if (data.type == "list") {
          const res = await fetch(`http://rentr-service/start-listing`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param ""
          });
          return await res.json();
        }
        if (data.type == "more") {
          return {
            ...RENTR_SCREEN_RESPONSES.MORE,
          };
        }
      }

      case "SEARCH": {
        const res = await fetch(`http://rentr-service/fetch-listings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "keyword"
        });
        return await res.json();
      }

      case "SEARCH_BY_ID": {
        if (
          data.type == "search" ||
          data.type == "next_page" ||
          data.type == "prev_page"
        ) {
          const res = await fetch(`http://rentr-service/fetch-listings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "keyword /current_page"
          });
          return await res.json();
        }
        if (data.type == "details") {
          const res = await fetch(
            `http://rentr-service/fetch-listing-details`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token }), //Query param "listing_id"
            }
          );
          return await res.json();
        }
      }

      case "SEARCH_LISTS": {
        if (data.type == "next_page" || data.type == "prev_page") {
          const res = await fetch(`http://rentr-service/fetch-listings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "keyword /current_page"
          });
          return await res.json();
        }
        if (data.type == "details") {
          const res = await fetch(
            `http://rentr-service/fetch-listing-details`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token }), //Query param "listing_id"
            }
          );
          return await res.json();
        }
      }

      case "SEARCH_DETAILS": {
        if (data.type == "photo_tour") {
          const res = await fetch(`http://rentr-service/photo-tour`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "current_page"
          });
          return await res.json();
        }

        if (data.type == "host_page") {
          const res = await fetch(`http://rentr-service/fetch-host`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "host_id"
          });
          return await res.json();
        }
      }

      case "DURATION": {
        if (data.type == "checkin_date") {
          const res = await fetch(`http://rentr-service/duration`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "checkin_date"
          });
          return await res.json();
        }

        if (data.type == "create_booking") {
          const res = await fetch(`http://rentr-service/create-booking`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "listing_type listing_id chekin checkout duration"
          });
          return await res.json();
        }
      }

      case "CONFIRM_PAY": {
        const res = await fetch(`http://rentr-service/confirm-pay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "reference"
        });
        return await res.json();
      }

      case "PAY": {
        const res = await fetch(`http://rentr-service/have-paid`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "reference"
        });
        return await res.json();
      }

      case "HOST_PAGE": {
        const res = await fetch(`http://rentr-service/fetch-listing-details`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "listing_id"
        });
        return await res.json();
      }

      case "CHAT_HOST": {
        const res = await fetch(`http://rentr-service/chat-host`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "host_id, comment"
        });
        return await res.json();
      }

      case "CHAT_HOST_TEMPLATE": {
        const res = await fetch(`http://rentr-service/chat-host-template`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "host_id, comment"
        });
        return await res.json();
      }

      case "CHAT_SUPPORT_TEMPLATE": {
        const res = await fetch(`http://rentr-service/chat-support-template`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "host_id, comment"
        });
        return await res.json();
      }

      case "SEARCH_PHOTOS_A": {
        const res = await fetch(`http://rentr-service/photo-tour`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "next_page"
        });
        return await res.json();
      }

      case "SEARCH_PHOTOS_B": {
        const res = await fetch(`http://rentr-service/photo-tour`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "next_page"
        });
        return await res.json();
      }

      case "SEARCH_PHOTOS_C": {
        const res = await fetch(`http://rentr-service/photo-tour`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "next_page"
        });
        return await res.json();
      }

      case "SEARCH_PHOTOS_D": {
        const res = await fetch(`http://rentr-service/photo-tour`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "next_page"
        });
        return await res.json();
      }

      case "TAKE_SELFIE": {
        const res = await fetch(`http://rentr-service/selfie`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "nin, images, prev_screen"
        });
        return await res.json();
      }

      case "MORE": {
        if (data.type == "account") {
          const res = await fetch(`http://rentr-service/your-account`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param
          });
          return await res.json();
        }
        if (data.type == "rents") {
          const res = await fetch(`http://rentr-service/your-rents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param
          });
          return await res.json();
        }
        if (data.type == "transactions") {
          const res = await fetch(`http://rentr-service/your-transactions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param
          });
          return await res.json();
        }
        if (data.type == "listings") {
          const res = await fetch(`http://rentr-service/your-listings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param
          });
          return await res.json();
        }
        if (data.type == "terms") {
          return {
            ...RENTR_SCREEN_RESPONSES.TERMS_AND_CONDITIONS,
          };
        }
        if (data.type == "help") {
          return {
            ...RENTR_SCREEN_RESPONSES.CHAT_SUPPORT,
          };
        }
      }

      case "UPLOAD_PROFILE_PHOTO": {
        const res = await fetch(`http://rentr-service/upload-profile-photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "images"
        });
        return await res.json();
      }

      case "WITHDRAW": {
        if (data.type == "resolve") {
          const res = await fetch(`http://rentr-service/resolve-bank-account`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "account_number" "bank_code"
          });
          return await res.json();
        }

        if (data.type == "withdraw") {
          if (data.intent == "balance") {
            const res = await fetch(`http://rentr-service/withdraw-balance`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...data, flow_token }), //Query param "account_number "amount" "bank_code" ""
            });
            return await res.json();
          }

          if (data.intent == "commission") {
            const res = await fetch(
              `http://rentr-service/withdraw-commission`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...data, flow_token }), //Query param "account_number "amount" "bank_code" ""
              }
            );
            return await res.json();
          }
        }
      }

      case "OTP_WALL": {
        const res = await fetch(`http://rentr-service/otp-wall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "reference" "otp" "pin_id"
        });
        return await res.json();
      }

      case "ACCOUNT": {
        return {
          ...RENTR_SCREEN_RESPONSES.WITHDRAW,
          data: {
            intent: data.selection,
            is_loaded: false,
          },
        };
      }

      case "CHAT_SUPPORT": {
        const res = await fetch(`http://rentr-service/chat-support`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "comment"
        });
        return await res.json();
      }

      case "YOUR_RENTS": {
        const res = await fetch(`http://rentr-service/fetch-listing-details`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "listing_id"
        });
        return await res.json();
      }

      case "YOUR_LISTINGS": {
        if (data.type == "next_page" || data.type == "prev_page") {
          const res = await fetch(`http://rentr-service/your-listings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "keyword /current_page"
          });
          return await res.json();
        }

        if (data.type == "create_list") {
          const res = await fetch(`http://rentr-service/start-listing`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param ""
          });
          return await res.json();
        }

        if (data.type == "edit_list") {
          const res = await fetch(`http://rentr-service/edit-listing`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }), //Query param "listing_id"
          });
          return await res.json();
        }
      }

      case "LIST_AMOUNT": {
        const res = await fetch(`http://rentr-service/list-amount`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "" ""
        });
        return await res.json();
      }

      case "LIST_AMOUNT_EXTRA": {
        const res = await fetch(`http://rentr-service/list-amount`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "" ""
        });
        return await res.json();
      }

      case "EDIT_LIST_AMOUNT": {
        const res = await fetch(`http://rentr-service/edit-list-amount`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "" ""
        });
        return await res.json();
      }

      case "EDIT_LIST_AMOUNT_EXTRA": {
        const res = await fetch(`http://rentr-service/edit-list-amount`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "" ""
        });
        return await res.json();
      }

      case "UPLOAD_LIST_PHOTOS": {
        const res = await fetch(`http://rentr-service/create-listing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "" "" Lots of params expected
        });
        return await res.json();
      }

      case "CHANGE_LIST_PHOTOS": {
        const res = await fetch(`http://rentr-service/update-listing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "" "Lots of params expected"
        });
        return await res.json();
      }

      case "UPLOAD_LIST_PHOTOS_EDIT": {
        const res = await fetch(`http://rentr-service/update-listing-images`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }), //Query param "listing_id" "images"
        });
        return await res.json();
      }

      case "CANCEL_BOOKING_HOST": {
        const res = await fetch(`http://rentr-service/cancel-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data.data, screen, flow_token }), //Query param "listing_id" "images"
        });
        return await res.json();
      }

      case "CANCEL_BOOKING_GUEST": {
        const res = await fetch(`http://rentr-service/cancel-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data.data, screen, flow_token }), //Query param "listing_id" "images"
        });
        return await res.json();
      }

      case "PRIMARY_FINISH_NAV": {
        if (data.prev_screen == "WITHDRAW") {
          return {
            ...RENTR_SCREEN_RESPONSES.WITHDRAW,
          };
        }

        if (data.prev_screen == "DURATION") {
          if (data.listing_type == "fixed") {
            return {
              ...RENTR_SCREEN_RESPONSES.DURATION,
              data: { is_loaded: false },
            };
          }
        } else {
          return {
            ...RENTR_SCREEN_RESPONSES.DURATION,
            data: {
              min_date_in: dayjs().format("YYYY-MM-DD"),
            },
          };
        }
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
