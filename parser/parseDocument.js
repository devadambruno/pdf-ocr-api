const { parseServices } = require("./parseServices");
const { extractHeader } = require("../gpt/extractHeader");

module.exports.parseDocument = async (doc, depara) => {
  const texto = doc.text || "";

  const headerGPT = await extractHeader({
  textoOCR: texto,
  depara: depara
});


  return {
    NumerodaCertidao:
      texto.match(/\b\d{5,}\/\d{4}\b/)?.[0] ?? null,

    ObjetodaCertidao:
      texto.match(/RECUPERAÇÃO.+/i)?.[0] ?? null,

    TipodaCertidao: headerGPT.TipodaCertidao ?? null,
    NiveldeAtividade: headerGPT.NiveldeAtividade ?? null,
    QualificacaoObra: headerGPT.QualificacaoObra ?? null,
    QualificacaoEspecifica: headerGPT.QualificacaoEspecifica ?? null,

    Estado:
      texto.match(/\b(BA|SP|RJ|MG|PR|RS|SC)\b/)?.[1] ?? null,

    Servicos: parseServices(doc, depara)
  };
};
