import fetch from "node-fetch";
import { FIGO_SCREEN_RESPONSES } from "./responses.js";
import { redisClient } from "../../../redis.js";
import { FileFromAWS, sendToQueue } from "../../tools.js";
import { parsePhoneNumber } from "libphonenumber-js";
import { getSecrets } from "../../../secrets.js";

const { ACCOUNT_SERVICE_URL: account_service_url } = await getSecrets();

console.log(account_service_url, "acc_url");

export const getNextScreenFigo = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;

  const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

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
    switch (screen) {
      default:
        console.log("Nothing here 11cc");
        break;
    }
  }

  if (action === "BACK") {
    switch (screen) {
      case "HOME": {
        let figo_account_stat = await redisClient.get(
          `figo_account_stat_${wa_id}`
        );

        let figo_account_name = await redisClient.get(
          `figo_account_name_${wa_id}`
        );

        let figo_account_id_1 = await redisClient.get(
          `figo_account_id_1_${wa_id}`
        );

        let figo_account_id_2 = await redisClient.get(
          `figo_account_id_2_${wa_id}`
        );

        figo_account_stat = figo_account_stat
          ? await FileFromAWS(figo_account_stat)
          : FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;

        //Send to Queue
        sendToQueue(
          JSON.stringify({
            intent: "figoAccountDataQueue",
            payload: { wa_id },
          })
        );

        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            ...FIGO_SCREEN_RESPONSES.HOME.data,
            init_option: "take_stock",
            today: new Date().toISOString().slice(0, 10),
            account_stat: figo_account_stat,
            account_name: figo_account_name || "",
            multi_account: !!figo_account_id_1 && !!figo_account_id_2,
          },
        };
      }

      case "CHOOSE_ACCOUNT": {
        const res = await fetch(`${account_service_url}/figo-choose-account`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token }),
        });
        return res.json();
      }

      case "TAKE_STOCK": {
        const res = await fetch(`${account_service_url}/figo-take-stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token }),
        });
        return res.json();
      }

      case "RECORD_SALES": {
        const res = await fetch(`${account_service_url}/figo-record-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "RECORD_SALES_B": {
        const res = await fetch(`${account_service_url}/figo-record-sales-b`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "CREATE_INVOICE": {
        const res = await fetch(`${account_service_url}/figo-create-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "COLLECT_MONEY": {
        const res = await fetch(`${account_service_url}/figo-collect-money`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "RECORD_EXPENSE": {
        const res = await fetch(`${account_service_url}/figo-record-expense`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "FIND_ITEM": {
        const res = await fetch(`${account_service_url}/figo-find-item`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "FIND_CUSTOMER": {
        const res = await fetch(`${account_service_url}/figo-find-customer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "FIND_SUPPLIER": {
        const res = await fetch(`${account_service_url}/figo-find-supplier`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token }),
        });
        return res.json();
      }

      case "MORE": {
        const res = await fetch(`${account_service_url}/figo-more`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "DEBTORS": {
        const res = await fetch(`${account_service_url}/figo-debtors`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "SALES": {
        const res = await fetch(`${account_service_url}/figo-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "INVOICES": {
        const res = await fetch(`${account_service_url}/figo-invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "MANAGE_STAFF": {
        const res = await fetch(`${account_service_url}/figo-manage-staff`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "EDIT_SALES": {
        const res = await fetch(`${account_service_url}/figo-edit-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "EDIT_INVOICE": {
        const res = await fetch(`${account_service_url}/figo-edit-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token, screen }),
        });
        return res.json();
      }

      case "WALLET": {
        const res = await fetch(`${account_service_url}/figo-wallet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, type: "back", flow_token }),
        });
        return res.json();
      }

      default:
        console.log("Nothing here 12cc");
        break;
    }
  }

  if (action === "data_exchange") {
    switch (screen) {
      // handles when user interacts with screens
      case "HOME": {
        // Handles user selecting
        if (data.type == "intro") {
          const res = await fetch(`${account_service_url}/figo-intro-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...data, flow_token }),
          });
          return await res.json();
        } else {
          switch (data.type) {
            case "take_stock": {
              return {
                ...FIGO_SCREEN_RESPONSES.TAKE_STOCK,
              };
            }
            case "record_sales": {
              return {
                ...FIGO_SCREEN_RESPONSES.RECORD_SALES,
              };
            }
            case "create_invoice": {
              return {
                ...FIGO_SCREEN_RESPONSES.CREATE_INVOICE,
                data: {
                  ...FIGO_SCREEN_RESPONSES.CREATE_INVOICE.data,
                  init_date: new Date().toISOString().slice(0, 10),
                  init_due_date: new Date().toISOString().slice(0, 10),
                },
              };
            }
            case "collect_money": {
              return {
                ...FIGO_SCREEN_RESPONSES.COLLECT_MONEY,
                data: {
                  ...FIGO_SCREEN_RESPONSES.COLLECT_MONEY.data,
                  init_date: new Date().toISOString().slice(0, 10),
                },
              };
            }
            case "record_expense": {
              return {
                ...FIGO_SCREEN_RESPONSES.RECORD_EXPENSE,
                data: {
                  ...FIGO_SCREEN_RESPONSES.RECORD_EXPENSE.data,
                  init_date: new Date().toISOString().slice(0, 10),
                },
              };
            }
            case "more": {
              return {
                ...FIGO_SCREEN_RESPONSES.MORE,
              };
            }
            case "wallet": {
              sendToQueue(
                JSON.stringify({
                  intent: "accountDataQueue",
                  payload: { wa_id: wa_id },
                })
              );

              const res = await fetch(`${account_service_url}/figo-wallet`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...data, type: "refresh", flow_token }),
              });
              return res.json();
            }

            default:
              break;
          }
        }
      }

      case "CHOOSE_ACCOUNT": {
        const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

        await redisClient.set(`figo_active_account_${wa_id}`, data.account);

        //Send to Queue
        sendToQueue(
          JSON.stringify({
            intent: "figoAccountDataQueue",
            payload: { wa_id },
          })
        );

        const res = await fetch(`${account_service_url}/figo-choose-account`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "TAKE_STOCK": {
        const res = await fetch(`${account_service_url}/figo-take-stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "RECORD_SALES": {
        const res = await fetch(`${account_service_url}/figo-record-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "RECORD_SALES_B": {
        const res = await fetch(`${account_service_url}/figo-record-sales-b`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "CREATE_INVOICE": {
        const res = await fetch(`${account_service_url}/figo-create-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "COLLECT_MONEY": {
        const res = await fetch(`${account_service_url}/figo-collect-money`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "COLLECT_MONEY_B": {
        const res = await fetch(`${account_service_url}/figo-collect-money-b`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "RECORD_EXPENSE": {
        const res = await fetch(`${account_service_url}/figo-record-expense`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "FIND_SUPPLIER": {
        const res = await fetch(`${account_service_url}/figo-find-supplier`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "ADD_SUPPLIER": {
        const _parsePhone = parsePhoneNumber(`${data.supplier_phone}`, {
          defaultCountry: "NG",
        });
        let internationalFormat;

        if (_parsePhone.isValid()) {
          // Use internationalFormat
          internationalFormat = _parsePhone
            .formatInternational()
            .replace(/\+/g, "");
          internationalFormat = internationalFormat.replace(/\s+/g, "");
        } else {
          // Handle invalid phone number
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_SUPPLIER,
            data: {
              ...FIGO_SCREEN_RESPONSES.ADD_SUPPLIER.data,
              message: "Please enter a valid phone number.",
            },
          };
        }

        const res = await fetch(`${account_service_url}/figo-add-supplier`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            ...data,
            flow_token,
            screen,
            supplier_phone: internationalFormat,
          }),
        });
        return res.json();
      }

      case "FIND_ITEM": {
        const res = await fetch(`${account_service_url}/figo-find-item`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "FIND_ITEM_SELECT": {
        const res = await fetch(
          `${account_service_url}/figo-find-item-select`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({ ...data, flow_token, screen }),
          }
        );
        return res.json();
      }

      case "ADD_ITEM": {
        const res = await fetch(`${account_service_url}/figo-add-item`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "FIND_CUSTOMER": {
        const res = await fetch(`${account_service_url}/figo-find-customer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "ADD_CUSTOMER": {
        const _parsePhone = parsePhoneNumber(`${data.customer_phone}`, {
          defaultCountry: "NG",
        });
        let internationalFormat;

        if (_parsePhone.isValid()) {
          // Use internationalFormat
          internationalFormat = _parsePhone
            .formatInternational()
            .replace(/\+/g, "");
          internationalFormat = internationalFormat.replace(/\s+/g, "");
        } else {
          // Handle invalid phone number
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER,
            data: {
              ...FIGO_SCREEN_RESPONSES.ADD_CUSTOMER.data,
              message: "Please enter a valid phone number.",
            },
          };
        }

        const res = await fetch(`${account_service_url}/figo-add-customer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            ...data,
            flow_token,
            screen,
            customer_phone: internationalFormat,
          }),
        });
        return res.json();
      }

      case "LINK_SALES": {
        const res = await fetch(`${account_service_url}/figo-link-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token, screen }),
        });
        return res.json();
      }

      case "CHAT_SUPPORT": {
        const res = await fetch(`${account_service_url}/figo-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "PRIMARY_FINISH": {
        if (data.type == "goBack") {
          const payload = JSON.parse(
            await redisClient.get(`figo_payload_${flow_token}`)
          );
          return {
            ...FIGO_SCREEN_RESPONSES[data.init_option],
            data: {
              ...payload,
            },
          };
        }

        if (
          data.type == "debtors" ||
          data.type == "sales_payments" ||
          data.type == "expenses" ||
          data.type == "products"
        ) {
          const res = await fetch(`${account_service_url}/figo-more`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({ ...data, flow_token, screen }),
          });
          return res.json();
        }

        if (data.type == "reset_data") {
          const res = await fetch(`${account_service_url}/figo-reset-data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({ ...data, flow_token, screen }),
          });
          return res.json();
        }

        //default starts here

        const wa_id = await redisClient.get(`figo_flow_token_${flow_token}`);

        let figo_account_stat = await redisClient.get(
          `figo_account_stat_${wa_id}`
        );

        let figo_account_name = await redisClient.get(
          `figo_account_name_${wa_id}`
        );

        figo_account_stat = figo_account_stat
          ? await FileFromAWS(figo_account_stat)
          : FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;

        //Reset Payload - used when navigating between screens
        await redisClient.set(`figo_payload_${flow_token}`, JSON.stringify({}));

        if (data.type == "leave_business") {
          let figo_account_id_1 = await redisClient.get(
            `figo_account_id_1_${wa_id}`
          );

          let init_staff = [];
          let staff = [{ id: figo_account_id_1 }];

          //Resetting values to default state
          await Promise.all([
            //Call manage staff to
            fetch(`${account_service_url}/figo-manage-staff`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...data,
                flow_token,
                type: "save",
                screen,
                staff,
                init_staff,
              }),
            }),
            redisClient.set(`figo_account_name_2_${wa_id}`, ""),
            redisClient.set(`figo_account_id_2_${wa_id}`, ""),
            redisClient.set(`figo_active_account_${wa_id}`, figo_account_id_1),
          ]);

          //Send to Queue
          await sendToQueue(
            JSON.stringify({
              intent: "figoAccountDataQueue",
              payload: { wa_id },
            })
          );
          figo_account_name = await redisClient.get(
            `figo_account_name_1_${wa_id}`
          );
          figo_account_stat = FIGO_SCREEN_RESPONSES.LOGIN.data.account_stat;
        }

        return {
          ...FIGO_SCREEN_RESPONSES.HOME,
          data: {
            ...FIGO_SCREEN_RESPONSES.HOME.data,
            scope: "reload",
            init_option: data?.init_option || "take_stock",
            today: new Date().toISOString().slice(0, 10),
            account_stat: figo_account_stat,
            account_name: figo_account_name || wa_id,
          },
        };
      }

      case "MORE": {
        const res = await fetch(`${account_service_url}/figo-more`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "SALES": {
        const res = await fetch(`${account_service_url}/figo-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "EDIT_SALES": {
        const res = await fetch(`${account_service_url}/figo-edit-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "EDIT_INVOICE": {
        const res = await fetch(`${account_service_url}/figo-edit-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "INVOICES": {
        const res = await fetch(`${account_service_url}/figo-invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "EXPENSES": {
        const res = await fetch(`${account_service_url}/figo-expenses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "DEBTORS": {
        const res = await fetch(`${account_service_url}/figo-debtors`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "PRODUCTS": {
        const res = await fetch(`${account_service_url}/figo-products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "EDIT_PRODUCT": {
        if (data.supplier_phone) {
          const _parsePhone = parsePhoneNumber(`${data.supplier_phone}`, {
            defaultCountry: "NG",
          });
          let internationalFormat;

          if (_parsePhone.isValid()) {
            // Use internationalFormat
            internationalFormat = _parsePhone
              .formatInternational()
              .replace(/\+/g, "");
            internationalFormat = internationalFormat.replace(/\s+/g, "");
          } else {
            // Handle invalid phone number
            return {
              ...FIGO_SCREEN_RESPONSES.EDIT_PRODUCT,
              data: {
                message: "Please enter a valid phone number.",
              },
            };
          }
        }

        const res = await fetch(`${account_service_url}/figo-edit-product`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "EDIT_EXPENSE": {
        const res = await fetch(`${account_service_url}/figo-edit-expense`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "VIEW_DEBTOR": {
        const res = await fetch(`${account_service_url}/figo-view-debtor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "VIEW_INVOICE": {
        const res = await fetch(`${account_service_url}/figo-view-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "MANAGE_STAFF": {
        const res = await fetch(`${account_service_url}/figo-manage-staff`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "ADD_STAFF": {
        const _parsePhone = parsePhoneNumber(`${data.mobile}`, {
          defaultCountry: "NG",
        });
        let internationalFormat;

        if (_parsePhone.isValid()) {
          // Use internationalFormat
          internationalFormat = _parsePhone
            .formatInternational()
            .replace(/\+/g, "");
          internationalFormat = internationalFormat.replace(/\s+/g, "");
        } else {
          // Handle invalid phone number
          return {
            ...FIGO_SCREEN_RESPONSES.ADD_STAFF,
            data: {
              message: "Please enter a valid phone number.",
            },
          };
        }

        const res = await fetch(`${account_service_url}/figo-add-staff`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            ...data,
            flow_token,
            mobile: internationalFormat,
          }),
        });
        return res.json();
      }

      case "APP_SETTINGS": {
        const res = await fetch(`${account_service_url}/figo-app-settings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "SUBSCRIPTION": {
        const res = await fetch(`${account_service_url}/figo-subscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "SUBSCRIPTION_B": {
        const res = await fetch(`${account_service_url}/figo-subscription-b`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "WALLET": {
        const res = await fetch(`${account_service_url}/figo-wallet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "SPIN": {
        const res = await fetch(`${account_service_url}/figo-spin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "SPIN_HOME": {
        console.log("spin_home i am here");
        const res = await fetch(`${account_service_url}/figo-spin-home`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "SPIN_SHOP": {
        const res = await fetch(`${account_service_url}/figo-spin-shop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
      }

      case "STAFF_INVITE": {
        const res = await fetch(`${account_service_url}/figo-staff-invite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, flow_token }),
        });
        return res.json();
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
