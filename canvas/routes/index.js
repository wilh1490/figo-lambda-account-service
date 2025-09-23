import { Router } from "./router.js";
import { createImageWithText } from "../images.js";

const router = Router();

// Routes
router.get("/", (req, res) => {
  res.send("👉🏾 Hello from Canvas");
});

router.post("/text-image", createImageWithText);

export default router;
