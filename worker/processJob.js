const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const { normalizeDepara } = require("../parser/normalizeDepara");
const { parseDocument } = require("../parser/parseDocument");

/* ================= CLIENT ================= */

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  throw new Error("Credencial Google não configurada");
}

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ),
});

/* ================= WORKER ================= */

module.exports.processJob = async ({ job_id, pdf_url, depara }) => {
  if (!depara) {
    throw new Error("De/para não informado");
  }

  /* -------- NORMALIZA DE/PARA -------- */

  const deparaNormalizado = {
    tipoCertidao: normalizeDepara(
      depara.json_tipos_certidao,
      "tipoCertidao"
    ),
    nivelAtividade: normalizeDepara(
      depara.json_nivel_atividade,
      "nivelAtividade"
    ),
    qualificacaoObra: normalizeDepara(
      depara.json_qualificacao_obra,
      "qualificacao"
    ),
    qualificacaoEspecifica: normalizeDepara(
      depara.json_qualificacao_especifica,
      "qualificacaoEspecifica"
    ),
    unidades: normalizeDepara(
      depara.json_unidades,
      "unidadeNome"
    ),
  };

  /* -------- DOWNLOAD PDF -------- */

  const pdfResp = await fetch(pdf_url);
  if (!pdfResp.ok) throw new Error("Falha ao baixar PDF");

  const buffer = Buffer.from(await pdfResp.arrayBuffer());

  /* -------- DOCUMENT AI -------- */

  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: buffer,
      mimeType: "application/pdf",
    },
  });

  /* -------- PARSER FINAL -------- */

  return parseDocument(result.document, deparaNormalizado);
};
