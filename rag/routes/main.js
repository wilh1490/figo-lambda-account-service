import { BaseAgent, CreateKB } from "../services/bedrockService.js";
import { ListTool } from "../agents/ListTool.js";

export default function registerMainRoute(router) {
  router.get("/", (req, res) => {
    return res.send("👉🏾 Hello from RAG");
  });

  router.post("/create_kb", async (req, res) => {
    const response = await CreateKB(req, res);
    return res.json(response);
  });

  router.post("/ask", async (req, res) => {
    let response = {};
    console.log(req.body);
    if (req.body?.is_list) {
      response = await ListTool(req, res);
    } else {
      if (req.body?.lucky_spin) {
        //response = await SpinTool(req, res);
      } else {
        response = await BaseAgent(req, res);
      }
    }
    return res.json(response);
  });
}
