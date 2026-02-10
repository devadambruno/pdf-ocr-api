const fs = require("fs");
const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const { parseDocument } = require("../parser/parseDocument");

/**
 * 🔐 Configuração de credencial via ENV (Railway-safe)
 */
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credPath = "/tmp/gcp-sa.json";

  if (!fs.existsSync(credPath)) {
    fs.writeFileSync(
      credPath,
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

/**
 * ✅ NÃO passe keyFilename
 * O SDK usa GOOGLE_APPLICATION_CREDENTIALS automaticamente
 */
const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
});

module.exports.processJob = async ({ job_id, pdf_url, depara }) => {
  // 1️⃣ Baixa PDF
  const pdfResp = await fetch(pdf_url);
  if (!pdfResp.ok) throw new Error("Falha ao baixar PDF");

  const buffer = Buffer.from(await pdfResp.arrayBuffer());

  // 2️⃣ Processa com Document AI
  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: buffer,
      mimeType: "application/pdf"
    }
  });

  // 3️⃣ Parser determinístico + de/para
  return parseDocument(result.document, depara);
};
