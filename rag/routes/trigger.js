import {
  TriggerBusinessIngest,
  TriggerCashFlowIngest,
  TriggerContactIngest,
  TriggerExpenseIngest,
  TriggerInvoiceIngest,
  TriggerProductIngest,
  TriggerReferralIngest,
  TriggerSalesIngest,
} from "../job/index.js";

export default function registerTriggerRoute(router) {
  router.post("/business_ingest", async (req, res) => {
    return await TriggerBusinessIngest(req, res);
  });

  router.post("/product_ingest", async (req, res) => {
    return await TriggerProductIngest(req, res);
  });

  router.post("/sales_ingest", async (req, res) => {
    return await TriggerSalesIngest(req, res);
  });

  router.post("/invoice_ingest", async (req, res) => {
    return await TriggerInvoiceIngest(req, res);
  });

  router.post("/expense_ingest", async (req, res) => {
    return await TriggerExpenseIngest(req, res);
  });

  router.post("/contact_ingest", async (req, res) => {
    return await TriggerContactIngest(req, res);
  });

  router.post("/cashflow_ingest", async (req, res) => {
    return await TriggerCashFlowIngest(req, res);
  });

  router.post("/referral_ingest", async (req, res) => {
    return await TriggerReferralIngest(req, res);
  });
}
