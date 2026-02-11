const { parseServices } = require("./parseServices");
const { extractHeader } = require("../gpt/extractHeader");

module.exports.parseDocument = async (doc, depara) => {
  const texto = doc?.text || "";

  /* ================= GPT HEADER ================= */

  let header = {
    TipodaCertidao: null,
    NiveldeAtividade: null,
    QualificacaoObra: null,
    QualificacaoEspecifica: null,
  };

  try {
    header = await extractHeader(texto, depara);
  } catch (e) {
    console.error("Erro no GPT header:", e.message);
  }

  /* ================= EXTRAÇÕES DETERMINÍSTICAS ================= */

  const numero =
    texto.match(/\b\d{5,}\/\d{4}\b/)?.[0] ?? null;

  const objeto =
    texto.match(/RECUPERAÇÃO.+/i)?.[0] ?? null;

  const estado =
    texto.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/)
      ?. [1] ?? null;

  /* ================= RETORNO FINAL FIXO ================= */

  return {
    NumerodaCertidao: numero,
    ObjetodaCertidao: objeto,
    TipodaCertidao: header.TipodaCertidao ?? null,
    QualificacaoObra: header.QualificacaoObra ?? null,
    QualificacaoEspecifica: header.QualificacaoEspecifica ?? null,
    NiveldeAtividade: header.NiveldeAtividade ?? null,
    Estado: estado,
    Servicos: parseServices(doc, depara),
  };
};
