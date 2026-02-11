const { parseServices } = require("./parseServices");
const { mapByTexto } = require("./normalizeDepara");

module.exports.parseDocument = (doc, depara) => {
  const texto = doc.text || "";

  return {
    NumerodaCertidao:
      texto.match(/\b\d{5,}\/\d{4}\b/)?.[0] ?? null,

    ObjetodaCertidao:
      texto.match(/RECUPERAÇÃO.+/i)?.[0] ?? null,

    TipodaCertidao:
      mapByTexto(texto, depara.tipoCertidao),

    QualificacaoObra:
      mapByTexto(texto, depara.qualificacaoObra),

    QualificacaoEspecifica:
      mapByTexto(texto, depara.qualificacaoEspecifica),

    NiveldeAtividade:
      mapByTexto(texto, depara.nivelAtividade),

    Estado:
      texto.match(/\b(BA|SP|RJ|MG|PR|RS|SC)\b/)?.[1] ?? null,

    Servicos: parseServices(doc, depara)
  };
};
