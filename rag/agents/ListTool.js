import { sendReplyButton, sendToWA } from "../controllers/askController.js";
import { structureList } from "../services/bedrockService.js";
import { queryOpenSearch } from "../services/openSearch.js";
import { redisClient } from "../shared/redis.js";
import { AmountSeparator } from "../shared/config/helper.js";
import { v4 as uuidv4 } from "uuid";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const schema = {
  name: "ListTool",
  description: `Get item list.`,
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function ListTool(req) {
  try {
    const { query: userMessage, wa_id, businessId } = req.body;

    const structure_list = await structureList({ list: userMessage });

    const list_items = structure_list?.items;
    const list_entities = structure_list?.entities;

    if (!list_items?.length) return;

    //filter and remove ones without productName
    const new_list = list_items.filter((item) => item?.productName);

    if (!new_list?.length) return;

    let filter = [{ term: { businessId } }];
    const validatedItems = [];

    let internationalFormat;

    if (list_entities?.customerMobile) {
      const _parsePhone = parsePhoneNumberFromString(
        `${list_entities?.customerMobile}`,
        "NG"
      );

      if (_parsePhone && _parsePhone.isValid()) {
        // Use internationalFormat
        internationalFormat = _parsePhone.number.replace(/\+/g, "");
      }
    }

    const shared_data = {
      note: list_entities?.note?.substr(0, 100) || "",
      customerName: list_entities?.customerName || "",
      customerMobile: internationalFormat || "",
      totalFees: parseFloat(list_entities?.totalFees || 0),
    };

    for (const item of new_list) {
      let must = [
        {
          match: {
            product: {
              query: `${item.productName}`,
              fuzziness: 2,
            },
          },
        },
      ];
      const context = await queryOpenSearch({ index: "product", filter, must });

      if (!context) {
        const priceInt = item?.price ? parseFloat(item.price) : 0;

        validatedItems.push({
          productName: item.productName,
          quantity: item?.quantity || 1,
          unit: "",
          price: priceInt,
          //add_new: true,
          ...shared_data,
        });
        continue;
      }

      let parsedContext = JSON.parse(context);
      parsedContext = parsedContext?.[0];

      const priceInt = item?.price
        ? parseFloat(item.price)
        : parseFloat(parsedContext.Price.split("₦")[1].replace(/,/g, ""));

      validatedItems.push({
        _id: parsedContext.ProductId,
        productName: parsedContext.ProductName,
        quantity: item?.quantity || 1,
        unit: `${parsedContext?.Unit}` || "",
        price: priceInt,
        ...shared_data,
        //priceInt,
      });
    }

    if (!!validatedItems.length) {
      const button_id = uuidv4();

      let items_to_wa = `${validatedItems
        .map(
          (e) =>
            `*${e.quantity}* x *${e.productName}* ${
              e.unit
            } = *₦${AmountSeparator(parseFloat(e.quantity) * e.price)}*`
        )
        .join("\n")}`;

      let totalCost = validatedItems.reduce(
        (acc, item) => acc + item.quantity * item.price,
        0
      );

      totalCost = totalCost + (list_entities?.totalFees || 0);

      let metadata_to_wa = "";

      if (list_entities?.note)
        metadata_to_wa = `\n*Note: ${list_entities.note}*`;

      if (list_entities?.customerName) {
        metadata_to_wa =
          metadata_to_wa +
          "\n" +
          `*Customer Name: ${list_entities.customerName}*`;
      }

      if (shared_data.customerMobile) {
        metadata_to_wa =
          metadata_to_wa + "\n" + `*Customer Mobile: ${internationalFormat}*`;
      }

      if (list_entities?.totalFees)
        metadata_to_wa =
          metadata_to_wa +
          "\n" +
          `*Fees: ₦${AmountSeparator(list_entities.totalFees || 0)}*`;

      metadata_to_wa =
        metadata_to_wa + "\n" + `*Total: ₦${AmountSeparator(totalCost || 0)}*`;

      await Promise.all([
        redisClient.set(
          `figo_list_payload_${wa_id}_${businessId}`,
          JSON.stringify(validatedItems),
          {
            EX: 600,
          }
        ),

        redisClient.set(`figo_list_button_${wa_id}`, `${button_id}`, {
          EX: 600,
        }),
      ]);

      await sendReplyButton({
        message: `${items_to_wa} \n ${metadata_to_wa}`,
        wa_id,
        button_id,
      });
    }

    console.log(validatedItems);
  } catch (error) {
    console.log(error, "listTool");
  }
}
