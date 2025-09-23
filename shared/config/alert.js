import {
  SQSClient,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  PutEventsCommand,
  RemoveTargetsCommand,
  DeleteRuleCommand,
} from "@aws-sdk/client-eventbridge";
import { getSecrets } from "./secrets.js";

const { AWS_REGION, AWS_ACCOUNT_ID, SQS_QUEUE_URL } = await getSecrets();

const eventBridgeClient = new EventBridgeClient({
  AWS_REGION,
});

const sqsClient = new SQSClient({ AWS_REGION });

export async function scheduleReminder({ detail, when, rule, eventType }) {
  try {
    const { QueueArn } = await createSharedQueue();

    if (!QueueArn) return;

    await setQueuePolicy(rule, QueueArn);

    await createEventRule({ rule, QueueArn, when, detail, eventType });

    //await emitEvent(eventType, detail);
  } catch (error) {
    console.log("error at schedule reminder");
  }
}

async function createSharedQueue() {
  try {
    const { Attributes } = await sqsClient.send(
      new GetQueueAttributesCommand({
        SQS_QUEUE_URL,
        AttributeNames: ["QueueArn"],
      })
    );
    return { QueueArn: Attributes.QueueArn };
  } catch (error) {
    console.log("error at createSharedQueue");
    return { QueueArn: null };
  }
}

async function setQueuePolicy(ruleName, queueArn) {
  try {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowEventBridgeToSend",
          Effect: "Allow",
          Principal: { Service: "events.amazonaws.com" },
          Action: "sqs:SendMessage",
          Resource: queueArn,
          Condition: {
            ArnEquals: {
              "aws:SourceArn": `arn:aws:events:${AWS_REGION}:${AWS_ACCOUNT_ID}:rule/${ruleName}`,
            },
          },
        },
      ],
    };

    await sqsClient.send(
      new SetQueueAttributesCommand({
        SQS_QUEUE_URL,
        Attributes: { Policy: JSON.stringify(policy) },
      })
    );
  } catch (error) {
    console.log("error at setQueuePolicy");
  }
}

async function createEventRule({
  rule: ruleName,
  QueueArn,
  when,
  detail,
  eventType,
}) {
  try {
    await eventBridgeClient.send(
      new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: when,
        State: "ENABLED",
      })
    );

    await eventBridgeClient.send(
      new PutTargetsCommand({
        Rule: ruleName,
        Targets: [
          {
            Id: `${ruleName}`,
            Arn: QueueArn,
            Input: JSON.stringify({
              intent: eventType, // e.g. "sendWhatsAppReminder"
              payload: detail, // your actual payload here
            }),
          },
        ],
      })
    );
  } catch (error) {
    console.log("error at createEventRule");
  }
}

export async function deleteReminder(ruleName) {
  try {
    // 1. Remove the target
    await eventBridgeClient.send(
      new RemoveTargetsCommand({
        Rule: ruleName,
        Ids: [ruleName],
      })
    );

    // 2. Delete the rule
    await eventBridgeClient.send(
      new DeleteRuleCommand({
        Name: ruleName,
      })
    );
  } catch (error) {
    console.log("deleteRule error");
  }
}

// async function emitEvent(eventType, detail) {
//   try {
//     await eventBridgeClient.send(
//       new PutEventsCommand({
//         Entries: [
//           {
//             DetailType: eventType,
//             Detail: JSON.stringify(detail),
//             EventBusName: "default",
//           },
//         ],
//       })
//     );
//     console.log(`📤 Event sent: ${eventType}`);
//   } catch (error) {
//     console.log(error, "emitEvent");
//   }
// }
