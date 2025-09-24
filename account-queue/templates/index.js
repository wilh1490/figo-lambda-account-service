export async function generatePdfFromHtml(htmlContent, browser) {
  const page = await browser.newPage();
  try {
    // Set the HTML content
    await page.setContent(htmlContent);

    await page.setViewport({
      width: 1920, // You can adjust these values based on your needs
      height: 1080,
      deviceScaleFactor: 2,
    });

    // Generate the PDF as a buffer
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    return pdfBuffer;
  } finally {
    await page.close();
  }
}

export async function generateImageFromHtml(browser, htmlContent, selector) {
  const page = await browser.newPage();
  try {
    // Set the HTML content
    await page.setContent(htmlContent);

    // Set the viewport to match the content size (optional but recommended for better results)
    await page.setViewport({
      width: 1920, // You can adjust these values based on your needs
      height: 1080,
      deviceScaleFactor: 3,
    });

    const element = await page.$(selector);

    // Generate the image as a buffer
    const imageBuffer = await element.screenshot({
      type: "png", // You can change this to "jpeg" if you prefer
      encoding: "binary",
      omitBackground: true,
    });

    return imageBuffer;
  } finally {
    await page.close();
  }
}
