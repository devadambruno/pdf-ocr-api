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
    "por",
    {
      tessedit_pageseg_mode: 1,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/()-ºªÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç "
    }
  );

  fullText += data.text + "\n";
}

// 🔥 LIMPEZA PÓS-OCR (AQUI 👇)
fullText = fullText
  // remove lixo tipo eee aaa ccc
  .replace(/\b[eac]{3,}\b/gi, "")
  // remove espaços duplicados
  .replace(/\s{2,}/g, " ")
  // remove quebras excessivas
  .replace(/(\n\s*){2,}/g, "\n")
  // corrige espaçamento antes de pontuação
  .replace(/\s+([.,;:])/g, "$1");

return fullText;
}

module.exports = { ocrWithTesseract };
