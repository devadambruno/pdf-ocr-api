const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const Tesseract = require("tesseract.js");

async function ocrWithTesseract(pdfPath) {
  const imagesDir = path.join(__dirname, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  // PDF → PNG
  await new Promise((resolve, reject) => {
    exec(
      `pdftoppm -r 300 "${pdfPath}" "${imagesDir}/page" -png`,
      err => (err ? reject(err) : resolve())
    );
  });

  const files = fs
    .readdirSync(imagesDir)
    .filter(f => f.endsWith(".png"))
    .sort();

  let fullText = "";

  for (const file of files) {
    const { data } = await Tesseract.recognize(
      path.join(imagesDir, file),
      "por"
    );
    fullText += data.text + "\n";
  }

  return fullText;
}

module.exports = { ocrWithTesseract };
