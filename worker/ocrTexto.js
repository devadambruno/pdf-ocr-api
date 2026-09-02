// OCR de TEXTO CRU (síncrono) — separado do fluxo de certidão (processJob.js).
// Baixa um PDF por URL e devolve o texto extraído via Google DocumentAI, SEM
// de/para e SEM protocolos_id. Serve para o chat de IA ler editais ESCANEADOS
// (imagem) que o pypdf não consegue extrair.
//
// NÃO altera o /ocr/parse existente — é um caminho independente.

const { DocumentProcessorServiceClient } = require("@google-cloud/documentai").v1;
const { splitPdfBuffer } = require("../utils/splitPdf");

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}"),
});

// Limites para manter a resposta rápida o suficiente para o chat (síncrono).
const MAX_PAGINAS = Number(process.env.OCR_TEXTO_MAX_PAGINAS || 15);
const MAX_CHARS = Number(process.env.OCR_TEXTO_MAX_CHARS || 60000);

/**
 * Baixa um PDF por URL e devolve o texto cru (OCR via DocumentAI).
 * @param {string} pdf_url
 * @returns {Promise<string>} texto extraído (truncado a MAX_CHARS)
 */
async function ocrPdfUrlToText(pdf_url) {
  const pdfResp = await fetch(pdf_url);
  if (!pdfResp.ok) throw new Error(`Falha ao baixar PDF (HTTP ${pdfResp.status})`);
  const buffer = Buffer.from(await pdfResp.arrayBuffer());

  const name = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`;

  // splitPdfBuffer devolve chunks de 15 páginas; limita o nº de chunks pelo teto de páginas.
  const todosChunks = await splitPdfBuffer(buffer, 15);
  const maxChunks = Math.max(1, Math.ceil(MAX_PAGINAS / 15));
  const chunks = todosChunks.slice(0, maxChunks);

  let texto = "";
  for (const chunk of chunks) {
    const [result] = await client.processDocument({
      name,
      rawDocument: { content: chunk, mimeType: "application/pdf" },
      ...(process.env.DOCUMENT_AI_IMAGELESS_MODE === "true"
        ? { processOptions: { imagelessMode: true } }
        : {}),
    });
    texto += (result.document && result.document.text ? result.document.text : "") + "\n";
    if (texto.length > MAX_CHARS) break;
  }

  texto = texto.trim();
  if (texto.length > MAX_CHARS) {
    texto = texto.slice(0, MAX_CHARS) + "\n\n[...documento truncado...]";
  }
  return texto;
}

module.exports = { ocrPdfUrlToText };
