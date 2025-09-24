import { Router } from "./router.js";
import flowRoute from "./flow.js";
import webhookRoute from "./webhook.js";
import mainRoute from "./main.js";

const router = Router();

router.use("/flow", flowRoute);
router.use("/webhook", webhookRoute);
router.use("", mainRoute);


export default router;
