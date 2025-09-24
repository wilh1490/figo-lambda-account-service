import { ChatSupportModel } from "../shared/models/index.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { CHAT_RESPONSES } from "../shared/config/responses.js";
import { getSecrets } from "../shared/config/secrets.js";
import { redisClient } from "../shared/redis.js";

const { GRAPH_API_TOKEN, WA_PHONE_NUMBER_ID } = await getSecrets();

const Index = async () => {
  try {
    console.log("chat cron account");
    const support_lines = ["2348148026795"];
    const not_read = await ChatSupportModel.find({ read: false });

    not_read.forEach(async (e) => {
      let not_seen_user = await ChatSupportModel.findOne({
        ticket: e.ticket,
        user: { $nin: "64c3a63647b1e2bf45a19a2e" },
      }).populate("user");

      await ChatSupportModel.updateMany(
        { ticket: e.ticket },
        { $set: { read: true } }
      );

      let result = {};
      const chat_flow_token = uuidv4();

      await redisClient.set(
        `chat_flow_token_${chat_flow_token}`,
        not_seen_user.user.mobile
      );

      //Fetch
      const allChats = await ChatSupportModel.find({ ticket: e.ticket }).sort({
        createdAt: -1,
      });

      console.log(e.ticket, not_seen_user.user.mobile, allChats);

      // Use a loop to map the values dynamically
      if (allChats.length > 0)
        allChats.forEach((item, index) => {
          result[`field${index + 1}_author`] = support_lines.includes(
            item.author
          )
            ? "**David PF.**"
            : "**You**";
          result[`field${index + 1}_comment`] = item.comment;
          result[`field${index + 1}_visible`] = true;
          result[`field${index + 1}_date`] = `**${dayjs(item.createdAt)
            .add(1, "hour")
            .format("MMM DD YYYY. h:mm a")}**`;
        });

      console.log(result);

      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: not_seen_user.user.mobile,
          type: "template",
          template: {
            name: "carrot_chat_support",
            language: {
              code: "en",
            },

            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "image",
                    image: {
                      link: "https://figoassets.s3.us-east-1.amazonaws.com/support-david-1745503906292", //Customer support person photo
                    },
                  },
                ],
              },
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: `${e.ticket}`,
                  },
                ],
              },

              {
                type: "button",
                sub_type: "flow",
                index: "0",
                parameters: [
                  {
                    type: "action",
                    action: {
                      flow_token: chat_flow_token,
                      flow_action_data: {
                        ...CHAT_RESPONSES.CHAT_SUPPORT.data,
                        ticket: e.ticket,
                        ...result,
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      });
    });
  } catch (error) {
    console.log(error, "Error at Chat cron");
  }
};

export default Index;
