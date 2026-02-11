const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const { parseServices } = require("../parser/parseServices");
const { callGPTCabecalho } = require("../gpt/cabecalho");

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

module.exports.processJob = async ({ pdf_url, depara }) => {
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

  const document = result.document;

  // 🔥 1. GPT — CABEÇALHO
  const cabecalho = await callGPTCabecalho(document.text);

  // 🔧 2. Parser determinístico — SERVIÇOS
  const servicos = parseServices(document, depara);

  return {
    ...cabecalho,
    Servicos: servicos
  };
};
