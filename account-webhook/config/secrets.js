import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: "us-east-1" });
let cachedSecrets = null;

export const getSecrets = async () => {
  if (cachedSecrets) return cachedSecrets; // re-use across Lambda invocations

  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: "/figo/prod/secrets",
      WithDecryption: true,
    })
  );

  cachedSecrets = JSON.parse(response?.Parameter?.Value);

  console.log("Secrets loaded and cached");
  return cachedSecrets;
};
