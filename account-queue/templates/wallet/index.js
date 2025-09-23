import { generateImageFromHtml } from "../index.js";
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
  "wallet",
  "index.ejs"
);
const cssPath = path.join(process.cwd(), "templates", "wallet", "index.css");

const rawHtmlTemplate = fs.readFileSync(templatePath, "utf-8");
const rawCssTemplate = fs.readFileSync(cssPath, "utf-8");

export async function GenerateWalletBanner(body) {
  const { browser } = body;

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

    const element = await page.$(".balance-card");

    // Generate the image as a buffer
    const imageBuffer = await element.screenshot({
      type: "png", // You can change this to "jpeg" if you prefer
      encoding: "base64",
      omitBackground: true,
    });

    return imageBuffer;
  } catch (error) {
    console.error("Wallet template error", error);
  } finally {
    await page.close();
  }
}
