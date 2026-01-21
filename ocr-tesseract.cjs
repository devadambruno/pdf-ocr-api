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
  

const results = [];
const CONCURRENCY = 2; // 👈 limite seguro para Railway

for (let i = 0; i < files.length; i += CONCURRENCY) {
  const batch = files.slice(i, i + CONCURRENCY);

  const texts = await Promise.all(
    batch.map(file =>
      Tesseract.recognize(
        path.join(imagesDir, file),
        "por",
        {
          tessedit_pageseg_mode: 3,
          preserve_interword_spaces: 1,
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/()-ºªÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç "
        }
      ).then(({ data }) => data.text)
    )
  );

  results.push(...texts);
}

let fullText = results.join("\n");


  // 🧹 LIMPEZA PÓS-OCR
  fullText = fullText
    .replace(/\b[eac]{3,}\b/gi, "")     // remove eee aaa ccc
    .replace(/\s{2,}/g, " ")            // espaços duplicados
    .replace(/(\n\s*){2,}/g, "\n")      // quebras excessivas
    .replace(/\s+([.,;:])/g, "$1");     // espaço antes de pontuação

  return fullText;
}

module.exports = { ocrWithTesseract };
