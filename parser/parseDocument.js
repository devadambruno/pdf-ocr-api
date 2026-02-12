const { parseServices } = require("./parseServices");
const { extractHeader } = require("../gpt/extractHeader");
const { detectTipoCertidao } = require("./detectTipoCertidao");


module.exports.parseDocument = async (docs, depara) => {
  const documentos = Array.isArray(docs) ? docs : [docs];

  /* ================= TEXTO COMPLETO (SERVIÇOS) ================= */

  const textoCompleto = documentos
    .map((d) => d?.text || "")
    .join("\n");

  /* ================= SOMENTE PRIMEIRA PÁGINA (HEADER) ================= */

  const textoCabecalho = documentos[0]?.text || "";

  /* ================= GPT HEADER ================= */

  let header = {
    TipodaCertidao: null,
    NiveldeAtividade: null,
    QualificacaoObra: null,
    QualificacaoEspecifica: null,
    ObjetodaCertidao: null,
  };

  try {
    header = await extractHeader(textoCabecalho, depara);
  } catch (e) {
    console.error("Erro no GPT header:", e.message);
  }

  /* ================= EXTRAÇÕES DETERMINÍSTICAS ================= */

  const numero =
    textoCompleto.match(/\b\d{5,}\/\d{4}\b/)?.[0] ?? null;

  const estado =
    textoCompleto.match(
      /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/
    )?.[1] ?? null;

  /* ================= SERVIÇOS ================= */

  const todosServicos = documentos.flatMap((doc) =>
    parseServices(doc, depara)
  );

  /* ================= RETORNO FINAL ================= */

 const tipoCertidaoId = detectTipoCertidao(
  textoCompleto,
  depara.tipoCertidaoOriginal
);


  return {
    NumerodaCertidao: numero,
    ObjetodaCertidaCertidao: header?.ObjetodaCertidao ?? null,
    TipodaCertidao: tipoCertidaoId,
    QualificacaoObra: header?.QualificacaoObra ?? null,
    QualificacaoEspecifica: header?.QualificacaoEspecifica ?? null,
    NiveldeAtividade: header?.NiveldeAtividade ?? null,
    Estado: estado,
    Servicos: todosServicos,
  };
};
