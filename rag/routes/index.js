import { Router } from "../shared/routes/router.js";
import mainRoute from "./main.js";
import triggerRoute from "./trigger.js";

const router = Router();

router.use("", mainRoute);
router.use("/trigger", triggerRoute);

export default router;
