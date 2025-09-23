import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agentsPath = path.join(__dirname, "..", "agents");

//const files = fs.readdirSync(agentsPath).filter((file) => file.endsWith(".js"));

export const tools = [];
export const handlers = {};

(async () => {
  try {
    const files = fs
      .readdirSync(agentsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of files) {
      const agent = await import(path.join(agentsPath, file));
      tools.push(agent?.schema);
      handlers[agent?.schema?.name] = agent?.handler;
    }
  } catch (err) {
    console.error("❌ Failed to load agents:", err);
  }
})();

// for (const file of files) {
//   const agent = await import(path.join(agentsPath, file));
//   tools.push(agent.schema);
//   handlers[agent.schema.name] = agent.handler;
// }
