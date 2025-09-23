import {
  AccountDebit,
  BVN_OTP,
  ChangePin,
  ChatSupport,
  ChatSupportDemo,
  ContinueToChat,
  ContinueToChatDemo,
  ContinueToPinwall,
  FetchAccount,
  FetchProfile,
  FetchStatement,
  FigoAddCustomer,
  FigoAddItem,
  FigoAddReferralCode,
  FigoAddStaff,
  FigoAddSupplier,
  FigoAppSettings,
  FigoChooseAccount,
  FigoCreateInvoice,
  FigoDebtors,
  FigoEditExpense,
  FigoEditInvoice,
  FigoEditProduct,
  FigoEditSales,
  FigoExpenses,
  FigoFindCustomer,
  FigoFindItem,
  FigoFindItemSelect,
  FigoFindSupplier,
  FigoIntroLink,
  FigoInvoices,
  FigoLinkSale,
  FigoManageStaff,
  FigoMore,
  FigoPayHook,
  FigoPayStatus,
  FigoProducts,
  FigoRecordExpense,
  FigoRecordPayment,
  FigoRecordPaymentB,
  FigoRecordSales,
  FigoRecordSalesB,
  FigoReferralCode,
  FigoResetData,
  FigoSales,
  FigoSpin,
  FigoSpinCode,
  FigoSpinHome,
  FigoSpinShop,
  FigoStaffInvite,
  FigoSubscription,
  FigoTakeStock,
  FigoViewDebtor,
  FigoViewInvoice,
  FigoWallet,
  HomeData,
  IntroLink,
  InwardTransferWebhook,
  JoinCardWaitlist,
  MoringaChangePin,
  MoringaChat,
  MoringaChatSupport,
  MoringaHome,
  MoringaIntroLink,
  MoringaInwardCrypto,
  MoringaPinWall,
  MoringaResolveAccountDetails,
  MoringaSecurity,
  MoringaSetPin,
  MoringaSwap,
  MoringaVerifyEmail,
  MoringaVerifyNIN,
  NIN_OTP,
  NewPinWall,
  PrintReceipt,
  Recent,
  RecentTransfer,
  ResolveAccountDetails,
  RestartFlow,
  ReturnToHome,
  ReturnToKYC,
  Security,
  SendFigoApp,
  SetPin,
  UploadBvn,
  UploadDocument,
  UploadNin,
  UploadProfilePhoto,
  UploadSelfie,
  UploadSelfieBVN,
  ViewReceipt,
} from "../query/index.js";

export default function registerRoute(router) {
  router.get("/", (req, res) => {
    res.send("👉🏾 Account 🦐");
  });

  /*Carrot App*/
  router.post("/login/:wa_id", async (req, res) => {
    const homeDataResponse = await HomeData(req.params);
    return res.json(homeDataResponse);
  });

  router.get("/home/:wa_id", async (req, res) => {
    const homeDataResponse = await HomeData(req.params);
    return res.json(homeDataResponse);
  });

  router.get("/return-to-home/:flow_token", async (req, res) => {
    const response = await ReturnToHome(req.params, req.body);
    return res.json(response);
  });

  router.get("/account/:flow_token", async (req, res) => {
    const response = await FetchAccount(req.params);
    return res.json(response);
  });

  router.post("/intro-link", async (req, res) => {
    const response = await IntroLink(req.body);
    return res.json(response);
  });

  router.post("/upload-bvn", async (req, res) => {
    const response = await UploadBvn(req.body);
    return res.json(response);
  });

  router.post("/upload-nin", async (req, res) => {
    const response = await UploadNin(req.body);
    return res.json(response);
  });

  router.post("/bvn-otp", async (req, res) => {
    const response = await BVN_OTP(req.body);
    return res.json(response);
  });

  router.post("/nin-otp", async (req, res) => {
    const response = await NIN_OTP(req.body);
    return res.json(response);
  });

  router.post("/upload-selfie-nin", async (req, res) => {
    const response = await UploadSelfie(req.body);
    return res.json(response);
  });

  router.post("/upload-selfie-bvn", async (req, res) => {
    const response = await UploadSelfieBVN(req.body);
    return res.json(response);
  });

  router.post("/upload-document", async (req, res) => {
    const response = await UploadDocument(req.body);
    return res.json(response);
  });

  router.post("/upload-profile-photo", async (req, res) => {
    const response = await UploadProfilePhoto(req.body);
    return res.json(response);
  });

  router.post("/return-to-kyc/:flow_token", async (req, res) => {
    const response = await ReturnToKYC(req.params);
    return res.json(response);
  });
  router.post("/restart_flow", async (req, res) => {
    const response = await RestartFlow(req.params);
    return res.json(response);
  });
  router.post("/continue-to-pinwall", async (req, res) => {
    const response = await ContinueToPinwall(req.body);
    return res.json(response);
  });
  router.post("/pin-wall", async (req, res) => {
    const response = await NewPinWall(req.body);
    return res.json(response);
  });

  router.post("/continue-to-chat", async (req, res) => {
    const response = await ContinueToChat(req.body);
    return res.json(response);
  });

  router.post("/continue-to-chat-demo", async (req, res) => {
    const response = await ContinueToChatDemo(req.body);
    return res.json(response);
  });

  router.post("/chat-support-demo", async (req, res) => {
    const response = await ChatSupportDemo(req.body);
    return res.json(response);
  });

  router.post("/chat-support", async (req, res) => {
    const response = await ChatSupport(req.body);
    return res.json(response);
  });

  router.post("/print-receipt", async (req, res) => {
    const response = await PrintReceipt(req.body);
    return res.json(response);
  });

  router.post("/view-receipt", async (req, res) => {
    const response = await ViewReceipt(req.body);
    return res.json(response);
  });

  router.post("/security/:flow_token", async (req, res) => {
    const response = await Security(req.params);
    return res.json(response);
  });
  router.post("/join-card-waitlist/:flow_token", async (req, res) => {
    const response = await JoinCardWaitlist(req.params);
    return res.json(response);
  });
  router.post("/set-pin", async (req, res) => {
    const response = await SetPin(req.body);
    return res.json(response);
  });
  router.post("/change-pin", async (req, res) => {
    const response = await ChangePin(req.body);
    return res.json(response);
  });

  // router.get("/test", async (req, res) => {
  //   let response = await axios({
  //     method: "POST",
  //     url: `${CANVAS_SERVICE_URL}/text-image`,
  //     data: JSON.stringify({
  //       text: `₦"25,690" Debit`,
  //     }),
  //   });
  //   return res.json(response);
  // });

  router.post("/resolve-payment", async (req, res) => {
    const response = await ResolveAccountDetails(req.body);
    return res.json(response);
  });
  router.get("/fetch-statement", async (req, res) => {
    const response = await FetchStatement(req.body);
    return res.json(response);
  });
  router.get("/fetch-account/:flow_token", async (req, res) => {
    const response = await FetchAccount(req.params);
    return res.json(response);
  });

  router.get("/fetch-profile/:flow_token", async (req, res) => {
    const response = await FetchProfile(req.params);
    return res.json(response);
  });

  router.post("/inward-transfer", async (req, res) => {
    await InwardTransferWebhook(req.body.data);
    return res.json({ status: "Sent" });
  });

  router.post("/account-debit", async (req, res) => {
    const response = await AccountDebit(req.body);
    return res.json(response);
  });

  router.post("/recent", async (req, res) => {
    const response = await Recent(req.body);
    return res.json(response);
  });

  router.post("/recent-transfer", async (req, res) => {
    const response = await RecentTransfer(req.body);
    return res.json(response);
  });

  /*Moringa App*/

  router.post("/moringa-intro-link", async (req, res) => {
    const response = await MoringaIntroLink(req.body);
    return res.json(response);
  });

  router.post("/moringa-home", async (req, res) => {
    const response = await MoringaHome(req.body);
    return res.json(response);
  });

  // router.post("/moringa-refresh", async (req, res) => {
  //   const response = await MoringaHome(req.body);
  //   return res.json(response);
  // });

  router.post("/moringa-transfer", async (req, res) => {
    const response = await MoringaResolveAccountDetails(req.body);
    return res.json(response);
  });

  router.post("/moringa-swap", async (req, res) => {
    const response = await MoringaSwap(req.body);
    return res.json(response);
  });

  router.post("/moringa-verify-email", async (req, res) => {
    const response = await MoringaVerifyEmail(req.body);
    return res.json(response);
  });

  router.post("/moringa-verify-nin", async (req, res) => {
    const response = await MoringaVerifyNIN(req.body);
    return res.json(response);
  });

  router.post("/moringa-security", async (req, res) => {
    const response = await MoringaSecurity(req.body);
    return res.json(response);
  });

  router.post("/moringa-chat", async (req, res) => {
    const response = await MoringaChat(req.body);
    return res.json(response);
  });

  router.post("/moringa-chat-support", async (req, res) => {
    const response = await MoringaChatSupport(req.body);
    return res.json(response);
  });

  router.post("/moringa-pin-wall", async (req, res) => {
    const response = await MoringaPinWall(req.body);
    return res.json(response);
  });

  router.post("/moringa-set-pin", async (req, res) => {
    const response = await MoringaSetPin(req.body);
    return res.json(response);
  });

  router.post("/moringa-change-pin", async (req, res) => {
    const response = await MoringaChangePin(req.body);
    return res.json(response);
  });
  router.post("/moringa-inward-crypto", async (req, res) => {
    const response = await MoringaInwardCrypto(req.body);
    return res.json(response);
  });

  /*Figo App*/

  router.post("/figo-home", async (req, res) => {
    const response = await MoringaInwardCrypto(req.body);
    return res.json(response);
  });

  router.post("/figo-intro-link", async (req, res) => {
    const response = await FigoIntroLink(req.body);
    return res.json(response);
  });

  router.post("/figo-choose-account", async (req, res) => {
    const response = await FigoChooseAccount(req.body);
    return res.json(response);
  });

  router.post("/figo-take-stock", async (req, res) => {
    const response = await FigoTakeStock(req.body);
    return res.json(response);
  });

  router.post("/figo-create-invoice", async (req, res) => {
    const response = await FigoCreateInvoice(req.body);
    return res.json(response);
  });

  router.post("/figo-record-sales", async (req, res) => {
    const response = await FigoRecordSales(req.body);
    return res.json(response);
  });

  router.post("/figo-record-sales-b", async (req, res) => {
    const response = await FigoRecordSalesB(req.body);
    return res.json(response);
  });

  router.post("/figo-record-expense", async (req, res) => {
    const response = await FigoRecordExpense(req.body);
    return res.json(response);
  });

  router.post("/figo-collect-money", async (req, res) => {
    const response = await FigoRecordPayment(req.body);
    return res.json(response);
  });
  router.post("/figo-collect-money-b", async (req, res) => {
    const response = await FigoRecordPaymentB(req.body);
    return res.json(response);
  });

  router.post("/figo-find-item", async (req, res) => {
    const response = await FigoFindItem(req.body);
    return res.json(response);
  });

  router.post("/figo-find-item-select", async (req, res) => {
    const response = await FigoFindItemSelect(req.body);
    return res.json(response);
  });

  router.post("/figo-add-item", async (req, res) => {
    const response = await FigoAddItem(req.body);
    return res.json(response);
  });

  router.post("/figo-find-customer", async (req, res) => {
    const response = await FigoFindCustomer(req.body);
    return res.json(response);
  });

  router.post("/figo-add-customer", async (req, res) => {
    const response = await FigoAddCustomer(req.body);
    return res.json(response);
  });

  router.post("/figo-add-supplier", async (req, res) => {
    const response = await FigoAddSupplier(req.body);
    return res.json(response);
  });

  router.post("/figo-find-supplier", async (req, res) => {
    const response = await FigoFindSupplier(req.body);
    return res.json(response);
  });

  router.post("/figo-link-sales", async (req, res) => {
    const response = await FigoLinkSale(req.body);
    return res.json(response);
  });

  router.post("/figo-more", async (req, res) => {
    const response = await FigoMore(req.body);
    return res.json(response);
  });

  router.post("/figo-expenses", async (req, res) => {
    const response = await FigoExpenses(req.body);
    return res.json(response);
  });

  router.post("/figo-invoices", async (req, res) => {
    const response = await FigoInvoices(req.body);
    return res.json(response);
  });

  router.post("/figo-sales", async (req, res) => {
    const response = await FigoSales(req.body);
    return res.json(response);
  });

  router.post("/figo-products", async (req, res) => {
    const response = await FigoProducts(req.body);
    return res.json(response);
  });

  router.post("/figo-edit-product", async (req, res) => {
    const response = await FigoEditProduct(req.body);
    return res.json(response);
  });

  router.post("/figo-edit-sales", async (req, res) => {
    const response = await FigoEditSales(req.body);
    return res.json(response);
  });

  router.post("/figo-edit-invoice", async (req, res) => {
    const response = await FigoEditInvoice(req.body);
    return res.json(response);
  });

  router.post("/figo-edit-expense", async (req, res) => {
    const response = await FigoEditExpense(req.body);
    return res.json(response);
  });

  router.post("/figo-view-debtor", async (req, res) => {
    const response = await FigoViewDebtor(req.body);
    return res.json(response);
  });

  router.post("/figo-view-invoice", async (req, res) => {
    const response = await FigoViewInvoice(req.body);
    return res.json(response);
  });

  router.post("/figo-debtors", async (req, res) => {
    const response = await FigoDebtors(req.body);
    return res.json(response);
  });
  router.post("/figo-manage-staff", async (req, res) => {
    const response = await FigoManageStaff(req.body);
    return res.json(response);
  });
  router.post("/figo-add-staff", async (req, res) => {
    const response = await FigoAddStaff(req.body);
    return res.json(response);
  });
  router.post("/figo-staff-invite", async (req, res) => {
    const response = await FigoStaffInvite(req.body);
    return res.json(response);
  });
  router.post("/figo-app-settings", async (req, res) => {
    const response = await FigoAppSettings(req.body);
    return res.json(response);
  });
  router.post("/figo-reset-data", async (req, res) => {
    const response = await FigoResetData(req.body);
    return res.json(response);
  });
  router.post("/figo-subscription", async (req, res) => {
    const response = await FigoSubscription(req.body);
    return res.json(response);
  });
  router.post("/figo-pay-hook", async (req, res) => {
    const response = await FigoPayHook(req.body);
    return res.json(response);
  });
  router.post("/figo-pay-status", async (req, res) => {
    const response = await FigoPayStatus(req.body);
    return res.json(response);
  });
  router.post("/figo-send-app", async (req, res) => {
    const response = await SendFigoApp(req.body);
    return res.json(response);
  });
  router.post("/figo-referral-code", async (req, res) => {
    const response = await FigoReferralCode(req.body);
    return res.json(response);
  });
  router.post("/figo-add-referral-code", async (req, res) => {
    const response = await FigoAddReferralCode(req.body);
    return res.json(response);
  });
  router.post("/figo-spin", async (req, res) => {
    const response = await FigoSpin(req.body);
    return res.json(response);
  });
  router.post("/figo-spin-home", async (req, res) => {
    const response = await FigoSpinHome(req.body);
    return res.json(response);
  });
  router.post("/figo-spin-shop", async (req, res) => {
    const response = await FigoSpinShop(req.body);
    return res.json(response);
  });
  router.post("/figo-spin-code", async (req, res) => {
    const response = await FigoSpinCode(req.body);
    return res.json(response);
  });
  router.post("/figo-wallet", async (req, res) => {
    const response = await FigoWallet(req.body);
    return res.json(response);
  });
  router.get("/ping", (req, res) => {
    res.status(200).send("Pong Account 🔔.");
  });
}
