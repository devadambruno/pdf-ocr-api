const { normalizeUnidade } = require("./normalizeUnidade");

module.exports.parseServices = (doc, depara) => {
  const resultado = [];

  for (const page of doc.pages || []) {
    for (const table of page.tables || []) {
      for (const row of table.bodyRows || []) {
        const cells = row.cells.map(c => {
          const seg = c.layout.textAnchor.textSegments?.[0];
          if (!seg) return null;
          return doc.text
            .substring(seg.startIndex, seg.endIndex)
            .trim();
        });

        const item = cells[0];
        const descricao = cells[1];
        const unidade = cells[2];
        const quantidade = cells[3];

        // 🔥 FILTRO ANTI-LIXO
        if (!item || !/^\d+(\.\d+)*$/.test(item)) continue;

        resultado.push({
          Item: item,
          Descricao: descricao || null,
          Quantidade: quantidade || null,
          Categoria: null,
          Unidade: normalizeUnidade(unidade, depara.unidades),
        });
      }
    }
  }

  return resultado;
};
