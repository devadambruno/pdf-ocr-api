function extractText(document) {
  return document.text || "";
}

function extractTables(document) {
  const pages = document.pages || [];
  const tables = [];

  pages.forEach((page, pageIndex) => {
    (page.tables || []).forEach((table, tableIndex) => {
      const rows = table.bodyRows.map(row =>
        row.cells.map(cell => {
          const start = cell.layout.textAnchor.textSegments?.[0]?.startIndex || 0;
          const end = cell.layout.textAnchor.textSegments?.[0]?.endIndex || 0;
          return document.text.substring(start, end).trim();
        })
      );

      tables.push({
        page: pageIndex + 1,
        table: tableIndex + 1,
        rows
      });
    });
  });

  return tables;
}

module.exports = { extractText, extractTables };
