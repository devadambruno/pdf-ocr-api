const { mapBySigla } = require("./mapBySigla");
const deparaDefault = require("./depara");

function parseDocument(document, depara = deparaDefault) {
  const texto = document.text || "";

  const resultado = {
    Cabecalho: {
      TipoCertidaoId: mapBySigla(texto, depara.tipoCertidao),
      NivelAtividadeId: mapBySigla(texto, depara.nivelAtividade),
      QualificacaoObraId: mapBySigla(texto, depara.qualificacaoObra),
      QualificacaoEspecificaId: mapBySigla(texto, depara.qualificacaoEspecifica),
      Estado: texto.match(/\b(BA|SP|RJ|MG)\b/)?.[1] ?? null
    },
    Servicos: []
  };

  for (const page of document.pages || []) {
    for (const table of page.tables || []) {
      for (const row of table.bodyRows || []) {
        const cells = row.cells.map(c => {
          const seg = c.layout?.textAnchor?.textSegments?.[0];
          if (!seg) return null;
          return document.text.substring(seg.startIndex, seg.endIndex).trim();
        });

        resultado.Servicos.push({
          Item: cells[0] || null,
          Descricao: cells[1] || null,
          UnidadeId: mapBySigla(cells[2], depara.unidades),
          Quantidade: cells[3] || null
        });
      }
    }
  }

  return resultado;
}

module.exports = { parseDocument };
