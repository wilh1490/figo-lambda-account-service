import { Router } from "../shared/routes/router.js";
import { GenerateWalletBanner } from "../templates/wallet/index.js";
import { FigoFIFO } from "../rabbitmq/consumers.js";
import { GenerateInvoice } from "../templates/invoice/index.js";
import { BrowserManager } from "../browser/index.js";

const router = Router();

function registerMainRoute(router) {
  router.post("/generate_invoice", async (req, res) => {
    const browser = BrowserManager.getBrowser();

    const response = await GenerateInvoice({
      browser,
      ...req.body,
    });
    return res.json(response);
  });

  router.post("/generate_wallet", async (req, res) => {
    const browser = BrowserManager.getBrowser();

    const response = await GenerateWalletBanner({
      browser,
      ...req.body,
    });
    return res.json(response);
  });

  router.post("/figo_fifo", async (req, res) => {
    const response = await FigoFIFO({
      ...req.body,
    });
    return res.json(response);
  });

  router.get("/", async (req, res) => {
    return res.json({ success: false, message: "Restricted!" });
  });
}

router.use("", registerMainRoute);

export default router;
