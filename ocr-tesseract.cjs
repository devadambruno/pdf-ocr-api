const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

async function ocrWithTesseract(pdfPath) {
  const workDir = path.join(__dirname, "ocr-work");
  fs.mkdirSync(workDir, { recursive: true });

  // PDF → PNG (equilíbrio qualidade x tempo)
  await execAsync(`pdftoppm -r 200 "${pdfPath}" "${workDir}/page" -png`);

  const images = fs
    .readdirSync(workDir)
    .filter(f => f.endsWith(".png"))
    .sort();

  let fullText = "";

  for (const img of images) {
    const imgPath = path.join(workDir, img);
    const outBase = imgPath.replace(".png", "");

    await execAsync(
      `tesseract "${imgPath}" "${outBase}" -l por --psm 6`
    );

    fullText += fs.readFileSync(`${outBase}.txt`, "utf8") + "\n";
  }

  // Limpeza pós-OCR
  fullText = fullText
    .replace(/\b[eac]{3,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/(\n\s*){2,}/g, "\n")
    .replace(/\s+([.,;:])/g, "$1");

  fs.rmSync(workDir, { recursive: true, force: true });
  return fullText;
}

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, err =>
      err ? reject(err) : resolve()
    );
  });
}

module.exports = { ocrWithTesseract };
