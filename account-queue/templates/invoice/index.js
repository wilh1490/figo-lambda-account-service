import fs from "fs";
import path from "path";
import { UploadToAWS } from "../../shared/config/fileHandler.js";
import ejs from "ejs";

// function loadIndexHtml() {
//   const filePath = path.join(process.cwd(), "invoice", "index.html");
//   const html = fs.readFileSync(filePath, "utf-8");
//   return html;
// }

const templatePath = path.join(
  process.cwd(),
  "templates",
  "invoice",
  "invoice.ejs"
);
const cssPath = path.join(process.cwd(), "templates", "invoice", "invoice.css");

const rawHtmlTemplate = fs.readFileSync(templatePath, "utf-8");
const rawCssTemplate = fs.readFileSync(cssPath, "utf-8");

export async function GenerateInvoice(body) {
  const { browser, key } = body;

  const page = await browser.newPage();

  const htmlContent = ejs.render(rawHtmlTemplate, {
    ...body,
    css: rawCssTemplate, // inject CSS into the <style> tag
  });

  try {
    // Set the HTML content
    await page.setContent(htmlContent);

    // Set the viewport to match the content size (optional but recommended for better results)
    await page.setViewport({
      width: 1920, // You can adjust these values based on your needs
      height: 1080,
      deviceScaleFactor: 3,
    });

    const element = await page.$(".web-container");

    // Generate the image as a buffer
    const imageBuffer = await element.screenshot({
      type: "png", // You can change this to "jpeg" if you prefer
      encoding: "binary",
      //omitBackground: true,
    });

    await UploadToAWS({
      Body: imageBuffer, //TODO
      Key: key,
      ContentType: "image/png",
      //ContentDisposition: `attachment; filename="invoice.png"`,
    });

    console.log("Invoice Image generated");
    return { message: "Uploaded", success: true };
  } catch (error) {
    console.error("Invoice template error", error);
  } finally {
    await page.close();
  }
}
