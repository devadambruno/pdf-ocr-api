const { mapBySigla } = require("./mapBySigla");
const depara = require("./depara");

function extractCellText(cell, fullText) {
  const segments = cell.layout?.textAnchor?.textSegments || [];
  return segments
    .map(s => fullText.substring(s.startIndex || 0, s.endIndex || 0))
    .join(" ")
    .trim();
}

module.exports.parseDocumentAI = (doc, contexto = {}) => {
  const texto = doc.text || "";

  const resultado = {
    Cabecalho: {
      TipoCertidaoId: mapBySigla(texto, depara.tipoCertidao),
      NivelAtividadeId: mapBySigla(texto, depara.nivelAtividade),
      QualificacaoObraId: mapBySigla(texto, depara.qualificacaoObra),
      QualificacaoEspecificaId: mapBySigla(texto, depara.qualificacaoEspecifica),
      Estado: texto.match(/\b(BA|SP|RJ|MG|ES|PR|RS)\b/)?.[1] ?? null
    },
    Servicos: []
  };

  for (const page of doc.pages || []) {
    for (const table of page.tables || []) {
      for (const row of table.bodyRows || []) {
        const cells = row.cells.map(c =>
          extractCellText(c, texto)
        );

        const [item, descricao, unidade, quantidade] = cells;

        // ignora cabeçalho ou linha vazia
        if (!item || item.toLowerCase() === "item") continue;
        if (!descricao) continue;

        resultado.Servicos.push({
          Item: String(item).trim(),
          Descricao: descricao,
          UnidadeId: mapBySigla(unidade, depara.unidades),
          Quantidade: quantidade || null
        });
      }
    }
  }

  return resultado;
};
