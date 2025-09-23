import { Router } from "../shared/routes/router.js";
import mainRoute from "./main.js";

const router = Router();

router.use("", mainRoute);

export default router;
