const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const Tesseract = require("tesseract.js");

async function ocrWithTesseract(pdfPath) {
  const imagesDir = path.join(__dirname, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  // PDF → PNG (300 DPI = melhor custo/benefício)
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

  // 🔥 OCR EM PARALELO (ganho grande de performance)
  const ocrPromises = files.map(file =>
    Tesseract.recognize(
      path.join(imagesDir, file),
      "por",
      {
        // PSM correto para texto jurídico
        tessedit_pageseg_mode: 3,
        preserve_interword_spaces: 1,
        // whitelist mais enxuta (opcional)
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/()-ºªÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç "
      }
    ).then(({ data }) => data.text)
  );

  let fullText = (await Promise.all(ocrPromises)).join("\n");

  // 🧹 LIMPEZA PÓS-OCR
  fullText = fullText
    .replace(/\b[eac]{3,}\b/gi, "")     // remove eee aaa ccc
    .replace(/\s{2,}/g, " ")            // espaços duplicados
    .replace(/(\n\s*){2,}/g, "\n")      // quebras excessivas
    .replace(/\s+([.,;:])/g, "$1");     // espaço antes de pontuação

  return fullText;
}

module.exports = { ocrWithTesseract };
