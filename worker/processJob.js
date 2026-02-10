const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const { parseDocument } = require("../parser/parseDocument");

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

module.exports.processJob = async ({ job_id, pdf_url, depara }) => {
  const pdfResp = await fetch(pdf_url);
  if (!pdfResp.ok) throw new Error("Falha ao baixar PDF");

  const buffer = Buffer.from(await pdfResp.arrayBuffer());

  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: buffer,
      mimeType: "application/pdf"
    }
  });

  return parseDocument(result.document, depara);
};
