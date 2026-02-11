const { PDFDocument } = require("pdf-lib");

module.exports.splitPdfBuffer = async (buffer, chunkSize = 30) => {
  const pdfDoc = await PDFDocument.load(buffer);
  const totalPages = pdfDoc.getPageCount();

  const chunks = [];

  for (let i = 0; i < totalPages; i += chunkSize) {
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(
      pdfDoc,
      Array.from(
        { length: Math.min(chunkSize, totalPages - i) },
        (_, idx) => i + idx
      )
    );

    pages.forEach((page) => newPdf.addPage(page));

    const newBuffer = await newPdf.save();
    chunks.push(Buffer.from(newBuffer));
  }

  return chunks;
};
