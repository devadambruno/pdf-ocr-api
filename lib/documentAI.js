const fs = require("fs");
const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

async function processPDF(pdfPath) {
  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  const pdfBuffer = fs.readFileSync(pdfPath);

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: pdfBuffer,
      mimeType: "application/pdf",
    },
  });

  return result.document;
}

module.exports = { processPDF };
