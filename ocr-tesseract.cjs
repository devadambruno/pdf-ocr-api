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

  // 👇 DECLARADO UMA ÚNICA VEZ (escopo correto)
  const files = fs
    .readdirSync(imagesDir)
    .filter(f => f.endsWith(".png"))
    .sort();

  const results = [];
  const CONCURRENCY = 2;

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
    .replace(/\b[eac]{3,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/(\n\s*){2,}/g, "\n")
    .replace(/\s+([.,;:])/g, "$1");

  // 🧼 LIMPEZA DE ARQUIVOS (AGORA FUNCIONA)
  for (const file of files) {
    fs.unlinkSync(path.join(imagesDir, file));
  }

  return fullText;
}

module.exports = { ocrWithTesseract };
