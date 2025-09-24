import PDFDocument from "pdfkit";
import { HISTORY_TYPE } from "../shared/config/statusError.js";
import { AmountSeparator, formatDate } from "../shared/config/helper.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import streamBuffers from "stream-buffers";
import customId from "custom-id/index.js";
import { getSecrets } from "../shared/config/secrets.js";

// Configure the AWS S3 client
const { AWS_REGION, S3_BUCKET, WA_PHONE_NUMBER_ID, GRAPH_API_TOKEN } =
  await getSecrets();

const s3 = new S3Client({ region: AWS_REGION });

export async function StatementTemplate(data) {
  try {
    const {
      history,
      period,
      user,
      opening_balance,
      closing_balance,
      total_debit,
      total_credit,
    } = data;

    const response = await axios.get(
      "https://lvdqpp.stripocdn.email/content/guids/CABINET_debe0faeba31da11e7961e39dbd43503/images/carroticon_tDC.png",
      { responseType: "arraybuffer" }
    );
    const imageBuffer = Buffer.from(response.data, "binary");

    const doc = new PDFDocument();

    // Create a writeable buffer stream to hold the PDF data in memory
    const pdfStream = new streamBuffers.WritableStreamBuffer({
      initialSize: 100 * 1024, // Start with a buffer size of 100KB
      incrementAmount: 10 * 1024, // Grow by 10KB increments if buffer gets full
    });

    // Pipe the document to the in-memory buffer
    doc.pipe(pdfStream);

    doc.rect(0, 1, doc.page.width, doc.page.height).fill("#FFF");

    doc
      .rect(0, 1, doc.page.width, 90)
      .fill("#FFF3E0")
      .image(imageBuffer, 50, 15, { fit: [100, 35] })
      .fillColor("#000")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Carrot Monie", 78, 20)
      .fontSize(10)
      .font("Helvetica")
      .text("7 Ibiyinka Olorunbe, VI, Lagos 101241.", 78, 38)
      .font("Helvetica-Bold")
      .text("Account Statement", 200, 20, { align: "right" })
      .font("Helvetica")
      .text(period, 200, 38, { align: "right" });

    doc
      .rect(0, 78, doc.page.width, 125)
      .fill("#FFF3E0")
      .fillColor("#000")
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text(
        `Bank name: ${user.kyc.sfh_account?.bank_name || "Safe Haven MFB"}`,
        50,
        100
      )
      .text(`Account name: ${user.sfh_account?.account_name || ""}`, 50, 118)
      .text(
        `Account number: ${user.sfh_account?.account_number || "XXXXXXXXX"}`,
        50,
        136
      )
      .text(`Address: ${user.kyc.proof_of_address?.value || ""}`, 50, 154)
      .text(`WhatsApp: +${user.mobile}`, 50, 172)
      .text(`Country: NG`, 50, 100, { align: "right" })
      .text(`Total Credit: NGN ${AmountSeparator(total_credit)}`, 200, 118, {
        align: "right",
      })
      .text(`Total Debit: NGN ${AmountSeparator(total_debit)}`, 200, 136, {
        align: "right",
      })
      .text(
        `Opening balance: NGN ${AmountSeparator(opening_balance)}`,
        200,
        154,
        {
          align: "right",
        }
      )
      .text(
        `Closing balance: NGN ${AmountSeparator(closing_balance)}`,
        200,
        172,
        {
          align: "right",
        }
      );

    doc.moveDown(2.5);

    function isOdd(number) {
      return number % 2 !== 0;
    }

    doc
      // .rect(0,200,doc.page.width,10).fill('red')
      .fillColor("#000")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Date", 50, 220)
      .text("Payment Ref.", 125, 220, { width: 100 })
      .text("Description", 210, 220)
      .text("Credit", 385, 220)
      .text("Debit", 450, 220)
      .text("Balance", 0, 220, { align: "right" });

    doc.moveUp(1.5);

    history.map((item, i) => {
      let yPos = doc.y + 40;
      let color = "#FFF";

      if (!isOdd(i)) color = "#FFF3E0";

      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
      }
      doc
        .rect(0, yPos - 17, doc.page.width, 50)
        .fill(color)
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#000")
        .text(
          formatDate(item?.createdAt, "YYYY-MM-DD h:mm a") || " ",
          50,
          yPos,
          {
            width: 60,
          }
        )
        .text(
          item?.link?.payment_ref || item?.transaction?.payment_ref || "-",
          125,
          yPos,
          { width: 60 }
        )
        .text(item?.description || "-", 210, yPos, {
          width: 160,
        })

        .fillColor("green")
        .text(
          `${
            item.type == HISTORY_TYPE.CREDIT
              ? (item.balanceAfter - item.balanceBefore).toFixed(2)
              : "0"
          }`,
          385,
          yPos,
          { width: 60 }
        )
        .fillColor("red")
        .text(
          `${
            item.type == HISTORY_TYPE.DEBIT
              ? (item.balanceBefore - item.balanceAfter).toFixed(2)
              : "0"
          }`,
          450,
          yPos,
          { width: 60 }
        )
        .fillColor("#000")
        .text(AmountSeparator(item.balanceAfter), 0, yPos, { align: "right" });
    });

    doc.end();

    // Wait for the stream to finish
    pdfStream.on("finish", async () => {
      const pdfBuffer = pdfStream.getContents(); // Get the buffered PDF data
      let Key = `${customId({
        name: user._id.toString(),
        email: "123456789",
        randomLength: 2,
      })}.pdf`;
      // Upload to S3
      const params = {
        Bucket: S3_BUCKET,
        Key, // File name in S3
        Body: pdfBuffer, // The PDF content
        ContentType: "application/pdf", // Set the content type
        ACL: "public-read", // Set the file permissions (optional)
      };

      try {
        const uploadResult = {
          Location: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${Key}`,
        };

        await s3.upload(new PutObjectCommand(params));

        //Send to WhatsApp
        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
          headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          },
          data: {
            messaging_product: "whatsapp",
            to: user.mobile,
            type: "template",
            template: {
              name: "carrot_statement",
              language: {
                code: "en",
              },
              components: [
                {
                  type: "header",
                  parameters: [
                    {
                      type: "document",
                      document: {
                        link: uploadResult.Location,
                        filename: Key,
                      },
                    },
                  ],
                },
              ],
            },
          },
        });

        console.log("PDF uploaded successfully:", uploadResult.Location);
      } catch (error) {
        console.error("Error uploading PDF to S3:", error);
      }
    });
  } catch (error) {
    console.error("Statement template error", error);
  }
}
