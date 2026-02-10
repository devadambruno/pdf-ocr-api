const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const { parseDocument } = require("../parser/parseDocument");
const { normalizeDepara } = require("../parser/normalizeDepara");

/* ================= CLIENT ================= */

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
});

/* ================= WORKER ================= */

module.exports.processJob = async ({ job_id, pdf_url, depara }) => {
  // 1️⃣ Normaliza de/para recebido da API
  const deparaNormalizado = {
    tipoCertidao: normalizeDepara(depara.tipoCertidao, "tipoCertidao"),
    nivelAtividade: normalizeDepara(depara.nivelAtividade, "nivelAtividade"),
    qualificacaoObra: normalizeDepara(depara.qualificacaoObra, "qualificacao"),
    qualificacaoEspecifica: normalizeDepara(
      depara.qualificacaoEspecifica,
      "qualificacaoEspecifica"
    ),
    unidades: normalizeDepara(depara.unidades, "unidadeNome"),
  };

  // 2️⃣ Baixa PDF
  const pdfResp = await fetch(pdf_url);
  if (!pdfResp.ok) throw new Error("Falha ao baixar PDF");

  const buffer = Buffer.from(await pdfResp.arrayBuffer());

  // 3️⃣ Processa no Document AI
  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: buffer,
      mimeType: "application/pdf",
    },
  });

  // 4️⃣ Parser determinístico (sem GPT)
  return parseDocument(result.document, deparaNormalizado);
};
