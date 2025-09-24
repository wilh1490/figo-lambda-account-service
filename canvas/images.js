import { createCanvas, loadImage, registerFont } from "canvas";

registerFont("/usr/share/fonts/truetype/custom/SF-Pro-Text-Regular.otf", {
  family: "SF-Pro-Text-Regular",
});

export async function createImageWithText(req, res) {
  try {
    const { text, receipt, color } = req.body;
    const backgroundImagePath = receipt
      ? "https://figoassets.s3.us-east-1.amazonaws.com/alert-bg-1745503544307"
      : "https://figoassets.s3.us-east-1.amazonaws.com/ts-bg-1745503661827";

    // Load the background image
    const backgroundImage = await loadImage(backgroundImagePath);

    // Create a canvas with the same dimensions as the background image
    const canvas = createCanvas(backgroundImage.width, backgroundImage.height);
    const ctx = canvas.getContext("2d");

    // Draw the background image onto the canvas
    ctx.drawImage(backgroundImage, 0, 0);

    // Set the font style
    ctx.font = "regular 200px SF-Pro-Text-Regular";

    // Set the text color
    ctx.fillStyle = color || "#43A574"; // Green text

    // Measure the text width to center it
    const textWidth = ctx.measureText(text).width;

    // Center the text on the canvas
    receipt
      ? ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 1.5)
      : ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 1.4);

    // Return the image as a buffer
    let bufferResponse = canvas.toBuffer("image/png");

    return res.json({ buffer: bufferResponse.toString("base64") });
  } catch (error) {
    console.error("Error generating image:", error);
    return res.json({ buffer: null });
  }
}
