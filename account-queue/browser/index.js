import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export class BrowserManager {
  static browser = null;

  static async init() {
    if (!this.browser) {
      const executablePath = await chromium.executablePath();

      this.browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath, // Lambda-compatible Chromium
        headless: chromium.headless,
      });

      console.log("✅ Puppeteer launched in Lambda");
    }
  }

  static getBrowser() {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }
    return this.browser;
  }

  static async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
