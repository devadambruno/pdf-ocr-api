const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

async function ocrWithTesseract(pdfPath) {
  const workDir = path.join(__dirname, "ocr-work");
  fs.mkdirSync(workDir, { recursive: true });

  // 1️⃣ PDF → PNG (300 DPI)
  await execAsync(
    `pdftoppm -r 300 "${pdfPath}" "${workDir}/page" -png`
  );

  const images = fs
    .readdirSync(workDir)
    .filter(f => f.endsWith(".png"))
    .sort();

  let fullText = "";

  // 2️⃣ OCR SEQUENCIAL COM BINÁRIO (rápido e leve)
  for (const img of images) {
    const imgPath = path.join(workDir, img);
    const outBase = imgPath.replace(".png", "");

    await execAsync(
      `tesseract "${imgPath}" "${outBase}" -l por --psm 3`
    );

    const text = fs.readFileSync(`${outBase}.txt`, "utf8");
    fullText += text + "\n";
  }

  // 3️⃣ LIMPEZA PÓS-OCR
  fullText = fullText
    .replace(/\b[eac]{3,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/(\n\s*){2,}/g, "\n")
    .replace(/\s+([.,;:])/g, "$1");

  // 4️⃣ LIMPEZA DE ARQUIVOS TEMPORÁRIOS
  fs.rmSync(workDir, { recursive: true, force: true });

  return fullText;
}

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, err =>
      err ? reject(err) : resolve()
    );
  });
}

module.exports = { ocrWithTesseract };
