import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
  CreateDataSourceCommand,
  ListDataSourcesCommand,
  ListIngestionJobsCommand,
} from "@aws-sdk/client-bedrock-agent";

import {
  FigoUserModel,
  FigoStockModel,
  FigoCustomerModel,
  FigoInvoiceModel,
  FigoExpenseModel,
  FigoSupplierModel,
  FigoSaleModel,
  FigoPaymentModel,
  FigoBusinessModel,
  FigoEditorModel,
  FigoCashFlowModel,
} from "../shared/models/index.js";
import {
  formatDay,
  fromKoboToNaira,
  AmountSeparator,
  toTimeZone,
} from "../shared/config/helper.js";
import { sendToQueueRag } from "../shared/config/fileHandler.js";
import { checkDeleteOpenSearch } from "../services/openSearch.js";

const FIGO_ENTRY_ACTIONS_LABEL = {
  edit_product: "Edit product",
  add_product: "Add product",
  add_invoice: "Add invoice",
  edit_invoice: "Edit invoice",
  add_sale: "Add sale",
  edit_sale: "Edit sale",
  add_expense: "Add expense",
  edit_expense: "Edit expense",
  add_customer: "Add cutsomer",
  edit_customer: "Edit customer",
  add_supplier: "Add supplier",
  edit_supplier: "Edit supplier",
  add_payment: "Add payment",
};

const s3 = new S3Client({ region: "us-east-1" });
const bedrockAgentClient = new BedrockAgentClient({ region: "us-east-1" });

export async function pollIngestion(msg) {
  try {
    const { knowledgeBaseId, dataSourceId, filter, index } = msg;

    // Check last ingestion job status
    const { ingestionJobSummaries } = await bedrockAgentClient.send(
      new ListIngestionJobsCommand({
        knowledgeBaseId: knowledgeBaseId,
        dataSourceId,
        maxResults: 1,
      })
    );

    const latest = ingestionJobSummaries?.[0];

    if (latest && latest?.status !== "COMPLETE") {
      throw new Error("Job already in progress. Re-queueing...");
    }

    const params = {
      knowledgeBaseId: knowledgeBaseId,
      dataSourceId: dataSourceId,
    };

    //
    await checkDeleteOpenSearch({
      index,
      filter,
    });
    //

    const ingestionResponse = await bedrockAgentClient.send(
      new StartIngestionJobCommand(params)
    );

    console.log(`✅ ${dataSourceId} synced:`, ingestionResponse);
  } catch (err) {
    console.log("pollIngestion Error");
    // Optional: requeue the message or use DLQ
    //throw err;
  }
}

export const createDataSource = async (req) => {
  try {
    const { kb_id, data_source_name, prefix, BUCKET } = req;

    // 1. List all data sources for the given knowledge base
    const listCommand = new ListDataSourcesCommand({
      knowledgeBaseId: kb_id,
    });

    const existing = await bedrockAgentClient.send(listCommand);

    const found = existing.dataSourceSummaries?.find(
      (ds) => ds.name === data_source_name
    );

    console.log(found, "found");

    if (found) {
      console.log(`✅ Data source "${data_source_name}" already exists.`);
      return {
        dataSource: {
          dataSourceId: found.dataSourceId,
          status: "EXISTING",
        },
      };
    }

    const createDataSourceCmd = new CreateDataSourceCommand({
      knowledgeBaseId: kb_id,
      name: data_source_name,
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: `arn:aws:s3:::${BUCKET}`,
          bucketName: BUCKET,
          inferenceConfig: {
            documentSchema: {
              textType: "PLAIN_TEXT",
              metadataSchema: {
                businessId: "string",
              },
            },
          },
          s3Prefix: prefix,
        },
      },
    });

    return await bedrockAgentClient.send(createDataSourceCmd);
  } catch (e) {
    console.log("Unable to create data source", e);
    return false;
  }
};

const compressAndUpload = async (
  filename,
  kb_id,
  BUCKET, //This is s3 BUCKET Name or Opensearch Index Name
  lines,
  businessId,
  index,
  role,
  meta
) => {
  const jsonl = lines.map((params) => JSON.stringify({ ...params })).join("\n");

  let metadata = {
    metadataAttributes: {
      businessId: businessId,
      fileKey: filename,
    },
  };
  if (meta) metadata = meta;

  if (role) {
    metadata = {
      metadataAttributes: {
        businessId: businessId,
        fileKey: filename,
        userRole: role,
      },
    };
  }

  console.log(jsonl);
  //const compressed = zlib.gzipSync(Buffer.from(jsonl, "utf-8"));
  const key = `${filename}.jsonl`;
  const metadata_key = `${key}.metadata.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: jsonl,
      ContentType: "application/x-ndjson", //"application/json",
    })
  );

  //Upload metadata file
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: metadata_key,
      Body: JSON.stringify(metadata),
      ContentType: "application/json",
    })
  );

  const DS = await createDataSource(
    {
      kb_id,
      data_source_name: `${BUCKET}`,
      prefix: `${BUCKET}/`,
      BUCKET,
    },
    null
  );

  if (!DS) throw new Error("Invalid DS");

  const { dataSource } = DS;

  console.log(DS, "createDS");

  const params = {
    knowledgeBaseId: kb_id,
    dataSourceId: dataSource.dataSourceId,
    filter: [{ term: { businessId } }, { term: { fileKey: filename } }],
    index,
  };

  await sendToQueueRag(
    JSON.stringify({
      intent: "pollIngestion",
      payload: {
        ...params,
      },
    })
  );

  // const ingestionResponse = await bedrockAgentClient.send(
  //   new StartIngestionJobCommand(params)
  // );

  //console.log(`✅ ${filename} synced:`, key, ingestionResponse);
  return;
};

export const TriggerBusinessIngest = async (req, res) => {
  try {
    const { businessId } = req?.body;

    console.log(req.body, "b_id");

    const findBusiness = await FigoBusinessModel.findOne({
      _id: businessId,
    }).populate("user staff subscription.user");

    if (!findBusiness) throw new Error("Not found");

    let subscription = findBusiness.subscription || "";

    if (subscription) {
      subscription = subscription.map((e) => {
        return {
          StaffNameOrPhone: e.user?.name || e.user?.mobile,
          Status: !!e.is_active,
          StartDate: formatDay(e.start_date),
          EndDate: formatDay(e.end_date),
        };
      });
    }

    let business = {
      BusinessName: findBusiness.name || "N/A",
      BusinessPhone: findBusiness?.mobile || "",
      PersonalPhone: findBusiness?.user?.mobile || "",
      JoinedOn: formatDay(findBusiness.createdAt),
      SubscribedStaff: subscription,
      StaffMembers: findBusiness?.staff || "",
    };

    await compressAndUpload(
      `${businessId}`,
      "HKCVQMZRES",
      "figobusiness",
      [business],
      businessId,
      "business"
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerProductIngest = async (req, res) => {
  try {
    const { businessId, productId } = req?.body;

    console.log(req.body, "b_id");

    const p = await FigoStockModel.findOne({
      _id: productId,
      business: businessId,
    }).populate("supplier editor business");

    if (!p) throw new Error("Not found");

    const key = `${p._id.toString()}`;

    const product = {
      ProductName: p.name,
      ServiceName: p.type == "Service" ? p.name : "",
      Description: p.description,
      Currency: p.currency,
      Price: `₦${AmountSeparator(p.price)}`,
      QuantityAvailable: p.level,
      Unit: p.unit,
      Supplier: p.supplier?.name || "N/A",
      SuppplierPhone: p?.supplier?.mobile || "N/A",
      IsProductOrService: p.type,
      ExpiryDate: p?.expiry_date ? formatDay(p.expiry_date) : "",
      CreatedAt: formatDay(p.createdAt),
      Staff: p.editor?.name || "",
      StaffPhone: p.editor.mobile,
      Business: p.business?.name || "",
      ProductId: p._id.toString(),
    };

    const meta = {
      metadataAttributes: {
        businessId: businessId,
        fileKey: key,
        product: p.name,
      },
    };

    await compressAndUpload(
      key,
      "ZBCKKGTDNX", //KB ID
      "figoproduct",
      [product],
      businessId,
      "product",
      null,
      meta
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerSalesIngest = async (req, res) => {
  try {
    const { businessId, saleId } = req?.body;

    console.log(req.body, "b_id");

    const e = await FigoSaleModel.findOne({
      business: businessId,
      _id: saleId,
    }).populate([
      {
        path: "item._id", // Populate the _id field within each item object
        populate: {
          path: "supplier", // Populate the supplier field within the FigoItem document
        },
      },
      { path: "customer" },
      { path: "business" },
      { path: "editor" },
    ]);

    if (!e) throw new Error("Not found");

    const findPayments = await FigoPaymentModel.find({ sale: e._id });

    // for (const e of sales) {
    const key = `${e._id.toString()}`;

    let fees = e.fees || 0;

    let totalCost = e.item.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );

    totalCost = totalCost + fees;

    const Products = (e.item || []).map((item) => ({
      Quantity: item.quantity,
      SellingPrice: item.price,
      ProductName: item._id.name,
      Description: item._id?.description || "",
      Supplier: item._id?.supplier?.name || "N/A",
      CostPrice: item._id.price,
      Profit: item.price - (item._id?.price || 0),
    }));

    const Payments = findPayments.map((item) => {
      return {
        AmountPaid: parseFloat(item.amount),
        PaymentDate: formatDay(item.date),
        PaymentMethod: item.payment_method,
      };
    });

    const sale = {
      Total: `₦${AmountSeparator(totalCost)}`,
      Fees: `₦${AmountSeparator(fees)}`,
      Balance: `₦${AmountSeparator(fromKoboToNaira(e.due_amount))}`,
      PaymentStatus: e.payment_status,
      Staff: e.editor?.name || "",
      StaffPhone: e.editor.mobile,
      Business: e.business?.name || "",
      Customer: {
        CustomerName: e?.customer?.name || "Not available",
        CustomerMobile: e?.customer?.mobile || "Not available",
      },
      Payments,
      Products,
      RecordCreatedDate: formatDay(e.createdAt) || "",
      DayOfSale: formatDay(e.date) || "",
    };

    await compressAndUpload(
      key,
      "DJGJVEUAA2", //KB ID
      "figosale",
      [sale],
      businessId,
      "sale"
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerInvoiceIngest = async (req, res) => {
  try {
    const { businessId, invoiceId } = req?.body;

    console.log(req.body, "b_id");

    const el = await FigoInvoiceModel.findOne({
      _id: invoiceId,
      business: businessId,
    }).populate([
      {
        path: "sale", // Populate the sale field within each Invoice object
        populate: [
          {
            path: "item._id", // Populate the item field within the FigoSale document
          },
          { path: "customer" },
        ],
      },
      { path: "editor" },
      { path: "business" },
    ]);

    if (!el) throw new Error("Not found");

    //for (const el of invoices) {
    const key = `${el._id.toString()}`;

    const totalCost = el.sale.item.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );

    const products = el.sale.item.map((e) => {
      return {
        quantity: e.quantity,
        price: e.price,
        name: e._id.name,
        description: e._id.description,
      };
    });

    const findPayments = await FigoPaymentModel.find({ sale: el.sale._id });

    const Payments = findPayments.map((item) => {
      return {
        AmountPaid: parseFloat(item.amount),
        PaymentDate: formatDay(item.date),
        PaymentMethod: item.payment_method,
      };
    });

    let invoice = {
      InvoiceId: el.ref,
      Total: `₦${totalCost}`,
      Balance: `₦${AmountSeparator(fromKoboToNaira(el.sale.due_amount))}`,
      PaymentStatus: el.sale.payment_status,
      Staff: el.editor?.name || "",
      StaffPhone: el.editor.mobile,
      Business: el.business?.name || "",
      Payments,
      Customer: {
        name: el.sale.customer.name,
        mobile: el.sale.customer.mobile,
      },
      Products: products,
      RecordCreatedDate: formatDay(el.createdAt) || "",
      DayOfInvoice: formatDay(el.date) || "",
      DueDayOfInvoice: formatDay(el.due_date) || "",
    };

    await compressAndUpload(
      key,
      "EBAT1RWKFO", //KB ID
      "figoinvoice",
      [invoice],
      businessId,
      "invoice"
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerExpenseIngest = async (req, res) => {
  try {
    const { businessId, expenseId } = req?.body;

    console.log(req.body, "b_id");

    const p = await FigoExpenseModel.findOne({
      business: businessId,
      _id: expenseId,
    }).populate("editor business");

    if (!p) throw new Error("Not found");

    const editors = await FigoEditorModel.find({
      entry_type: "expense",
      entry_id: expenseId,
      business: businessId,
    });

    let activity = editors.map((editor) => {
      return {
        Editor: editor.editor?.name || editor.editor.mobile,
        EditDate: toTimeZone(editor.createdAt, "", "hh:mm a. MMM DD, YYYY"),
        Reason: FIGO_ENTRY_ACTIONS_LABEL[editor.action || "edit_expense"],
      };
    });

    const key = `${p._id.toString()}`;

    let expense = {
      About: `${p.description}`,
      Amount: `₦${AmountSeparator(p.amount)}`,
      PaymentMethod: p.payment_method,
      DayOfExpense: formatDay(p.date) || "",
      RecordCreatedDate: formatDay(p.createdAt) || "",
      Business: p.business?.name || "",
      RecordHistory: activity,
    };

    const meta = {
      metadataAttributes: {
        businessId: businessId,
        fileKey: key,
        expenseName: p.description,
      },
    };

    await compressAndUpload(
      key,
      "M4GA0DEYIQ", //KB ID
      "figoexpense",
      [expense],
      businessId,
      "expense",
      null,
      meta
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerContactIngest = async (req, res) => {
  try {
    const { businessId, customerId, role } = req?.body;

    console.log(req.body, "b_id");
    let contact = {};
    let businessName = "";
    if (role == "Customer") {
      console.log("ul1");
      contact = await FigoCustomerModel.findOne({
        business: businessId,
        mobile: customerId,
      }).populate("business");
      businessName = contact?.business?.name || "";
    }
    if (role == "Supplier") {
      console.log("ul2");
      contact = await FigoSupplierModel.findOne({
        business: businessId,
        mobile: customerId,
      }).populate("business");
      businessName = contact?.business?.name || "";
    }
    if (role == "Staff") {
      //FUTURE What if i'm a staff and I belong to more than one business,
      //the current implementation assumes a user can only be staff of one business
      contact = await FigoBusinessModel.findOne({
        _id: businessId,
        "staff._id": customerId,
      });
      businessName = contact?.name || "";
    }

    if (!contact) throw new Error("Not found");

    console.log(contact);

    const key = `${contact._id.toString()}`;

    const contactLines = {
      UserId: contact._id.toString(),
      UserName: contact.name,
      UserPhone: contact.mobile,
      CreatedAt: formatDay(contact.createdAt) || "",
      Staff: contact?.editor?.name || "",
      StaffPhone: contact?.editor?.mobile || "",
      Business: businessName,
      UserRole: role,
    };

    await compressAndUpload(
      key,
      "1WMIXUDNWQ", //KB ID
      "figocontact",
      [contactLines],
      businessId,
      "contact",
      role
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerCashFlowIngest = async (req, res) => {
  try {
    const { businessId, cashFlowId } = req?.body;

    console.log(req.body, "b_id");

    const p = await FigoCashFlowModel.findOne({
      business: businessId,
      _id: cashFlowId,
    }).populate("business");

    if (!p) throw new Error("Not found");

    const key = `${p._id.toString()}`;

    let cashflow = {
      Amount: `₦${AmountSeparator(fromKoboToNaira(p.amount))}`,
      Type: p.type == "Credit" ? "Money In" : "Money Out",
      BalanceBefore: `₦${AmountSeparator(fromKoboToNaira(p.balance_before))}`,
      BalanceAfter: `₦${AmountSeparator(fromKoboToNaira(p.balance_after))}`,
    };

    await compressAndUpload(
      key,
      "I6ZCH9HCPH", //KB ID
      "figocashflow",
      [cashflow],
      businessId,
      "cashflow"
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

export const TriggerReferralIngest = async (req, res) => {
  try {
    const { businessId, referralCode, user } = req?.body;

    console.log(req.body, "b_id");

    const key = `${user?._id || user?.mobile || referralCode}`;

    let result = {
      ReferralCode: referralCode,
      Referee: {
        Name: user?.name || "",
        Mobile: user?.mobile || "",
      },
      ReferralDate: formatDay(new Date()) || "",
    };

    await compressAndUpload(
      key,
      "MGHIRPTMLU", //KB ID
      "figoreferral",
      [result],
      businessId,
      "referral"
    );

    res.status(200).json({ message: "Ingestion jobs started." });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Error." });
  }
};

//business KB = HKCVQMZRES
//product KB  = ZBCKKGTDNX
//sale KB = DJGJVEUAA2
//invoice KB = EBAT1RWKFO
//expense KB = M4GA0DEYIQ
//contact KB = 1WMIXUDNWQ
//cashflow KB = I6ZCH9HCPH
//debt KB = MXCLXTQNQ7
//platform KB =  OZGYWHOMZO
//referral KB =
