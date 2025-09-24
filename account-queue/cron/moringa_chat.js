import { MoringaChatSupportModel } from  "../shared/models/index.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { CHAT_RESPONSES } from "../shared/config/responses.js";
import { redisClient } from "../shared/redis.js";
import { getSecrets } from "../shared/config/secrets.js";

const { GRAPH_API_TOKEN, MORINGA_WA_PHONE_NUMBER } = await getSecrets();

const Index = async () => {
  try {
    console.log("chat moringa cron account");
    const support_lines = ["2348148026795"];
    const not_read = await MoringaChatSupportModel.find({ read: false });

    not_read.forEach(async (e) => {
      let not_seen_user = await MoringaChatSupportModel.findOne({
        ticket: e.ticket,
        user: { $nin: "64c3a63647b1e2bf45a19a2e" },
      }).populate("user");

      await MoringaChatSupportModel.updateMany(
        { ticket: e.ticket },
        { $set: { read: true } }
      );

      let result = {};
      const chat_flow_token = uuidv4();

      await redisClient.set(
        `moringa_chat_flow_token_${chat_flow_token}`,
        not_seen_user.user.mobile
      );

      //Fetch
      const allChats = await MoringaChatSupportModel.find({
        ticket: e.ticket,
      }).sort({
        createdAt: -1,
      });

      console.log(e.ticket, not_seen_user.user.mobile, allChats);

      // Use a loop to map the values dynamically
      if (allChats.length > 0)
        allChats.forEach((item, index) => {
          result[`field${index + 1}_author`] = support_lines.includes(
            item.author
          )
            ? "**David.**"
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
        url: `https://graph.facebook.com/v23.0/${MORINGA_WA_PHONE_NUMBER}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: not_seen_user.user.mobile,
          type: "template",
          template: {
            name: "moringa_chat_support",
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
                      link: "https://slashit.s3.eu-west-1.amazonaws.com/frame-11-1740950440565", //Customer support person photo
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
    console.log(error, "Error at Moringa Chat cron");
  }
};

export default Index;
