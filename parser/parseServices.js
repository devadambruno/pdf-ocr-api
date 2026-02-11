const { mapBySigla } = require("./mapBySigla");

function parseServices(doc, depara) {
  const servicos = [];

  for (const page of doc.pages || []) {
    for (const table of page.tables || []) {
      for (const row of table.bodyRows || []) {
        const cells = row.cells.map(c => c.text?.trim() || null);

        // ❌ FILTRA LIXO (UF, CEP, datas, etc)
        if (!cells[0] || !cells[1]) continue;
        if (/^UF|CEP|DATA|IN[IÍ]CIO|T[EÉ]RMINO/i.test(cells[0])) continue;

        servicos.push({
          Item: cells[0],
          Descricao: cells[1],
          Quantidade: cells[3] || null,
          Categoria: null, // pode deduzir depois
          Unidade: cells[2] || null
        });
      }
    }
  }

  return servicos;
}

module.exports = { parseServices };
