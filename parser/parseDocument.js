const { parseServices } = require("./parseServices");
const { extractHeader } = require("../gpt/extractHeader");

module.exports.parseDocument = async (docs, depara) => {
  // Garante que sempre seja array
  const documentos = Array.isArray(docs) ? docs : [docs];

  /* ================= TEXTO COMPLETO ================= */

  const textoCompleto = documentos
    .map((d) => d?.text || "")
    .join("\n");

  /* ================= GPT HEADER ================= */

  let header = {
    TipodaCertidao: null,
    NiveldeAtividade: null,
    QualificacaoObra: null,
    QualificacaoEspecifica: null,
  };

  try {

    header = await extractHeader(textoCompleto, depara);



  } catch (e) {
    console.error("Erro no GPT header:", e.message);
  }

  /* ================= EXTRAÇÕES DETERMINÍSTICAS ================= */

  const numero =
    textoCompleto.match(/\b\d{5,}\/\d{4}\b/)?.[0] ?? null;

  const objeto = header?.ObjetodaCertidao ?? null;


  const estado =
    textoCompleto.match(
      /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/
    )?.[1] ?? null;

  /* ================= SERVIÇOS (TODOS CHUNKS) ================= */

  const todosServicos = documentos.flatMap((doc) =>
    parseServices(doc, depara)
  );

  /* ================= RETORNO FINAL FIXO ================= */

  return {
    NumerodaCertidao: numero,
    ObjetodaCertidao: objeto,
    TipodaCertidao: header?.TipodaCertidao ?? null,
    QualificacaoObra: header?.QualificacaoObra ?? null,
    QualificacaoEspecifica: header?.QualificacaoEspecifica ?? null,
    NiveldeAtividade: header?.NiveldeAtividade ?? null,
    Estado: estado,
    Servicos: todosServicos,
  };
};
