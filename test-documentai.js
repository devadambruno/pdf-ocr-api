require("dotenv").config();
const fs = require("fs");
const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

// ✅ UM ÚNICO CLIENT, CONFIGURADO
const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// 🧪 Sanidade
console.log("Project:", process.env.GCP_PROJECT_ID);
console.log("Location:", process.env.GCP_LOCATION);
console.log("Processor:", process.env.DOCUMENT_AI_PROCESSOR_ID);

function getTextFromLayout(layout, fullText) {
  if (!layout || !layout.textAnchor || !layout.textAnchor.textSegments) {
    return "";
  }

  return layout.textAnchor.textSegments
    .map(seg => {
      const start = Number(seg.startIndex || 0);
      const end = Number(seg.endIndex);
      return fullText.substring(start, end);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

async function test() {
  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  const pdfBuffer = fs.readFileSync("teste.pdf");

  const request = {
    name,
    rawDocument: {
      content: pdfBuffer,
      mimeType: "application/pdf",
    },
  };

  const [result] = await client.processDocument(request);

  const document = result.document;

  /* ================= TEXTO LINEAR ================= */

  console.log("\n================ TEXTO OCR =================\n");
  console.log(document.text.slice(0, 1000));

  /* ================= TABELAS ================= */

  console.log("\n================ TABELAS =================\n");

  document.pages.forEach((page, pageIndex) => {
    console.log(`\n📄 PÁGINA ${pageIndex + 1}`);

    if (!page.tables || page.tables.length === 0) {
      console.log("⚠️ Nenhuma tabela nesta página");
      return;
    }

    page.tables.forEach((table, tableIndex) => {
      console.log(`\n📊 TABELA ${tableIndex + 1}`);

      table.bodyRows.forEach((row, rowIndex) => {
        const cells = row.cells.map(cell =>
          getTextFromLayout(cell.layout, document.text)
        );

        console.log(`Linha ${rowIndex + 1}:`, cells);
      });
    });
  });
}





test().catch(console.error);
