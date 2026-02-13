
const { normalizeUnidade } = require("./normalizeUnidade");

/* =======================================================
   UTIL
======================================================= */

function cleanLine(texto = "") {
  return texto
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function detectQuantidade(linha) {
  const match = linha.match(/([\d.,]+)$/);
  if (!match) return { quantidade: null, linha };

  return {
    quantidade: match[1],
    linha: linha.replace(/([\d.,]+)$/, "").trim()
  };
}

function detectItem(linha) {
  const match = linha.match(/^\d+(\.\d+)*/);
  if (!match) return { item: null, linha };

  return {
    item: match[0],
    linha: linha.replace(match[0], "").trim()
  };
}

function detectUnidade(linha, listaUnidades = []) {
  if (!linha) return { unidadeId: null, linha };

  for (const item of listaUnidades) {
    if (!item?.unidadeNome) continue;

    const sigla = item.unidadeNome.split(" - ")[0];

    const regex = new RegExp(`\\b${sigla}\\b`, "i");

    if (regex.test(linha)) {
      const novaLinha = linha.replace(regex, "").trim();

      return {
        unidadeId: normalizeUnidade(sigla, listaUnidades),
        linha: novaLinha
      };
    }
  }

  return { unidadeId: null, linha };
}

/* =======================================================
   PARSER PRINCIPAL
======================================================= */

module.exports.parseServices = (doc, depara) => {
  const resultado = [];

  /* ===============================================
     1️⃣ TENTA PARSEAR TABELAS DO DOCUMENT AI
  =============================================== */

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

        if (!item || !/^\d+(\.\d+)*$/.test(item)) continue;

        resultado.push({
          Item: item,
          Categoria: null,
          Descricao: descricao || null,
          Unidade: normalizeUnidade(unidade, depara.unidades),
          Quantidade: quantidade || null
        });
      }
    }
  }

  if (resultado.length > 0) return resultado;

  console.log("⚠️ Nenhuma tabela detectada. Aplicando fallback inteligente...");

  /* ===============================================
     2️⃣ FALLBACK POR TEXTO CORRIDO
  =============================================== */

  const linhas = doc.text.split("\n");

  for (let linha of linhas) {
    linha = cleanLine(linha);

    if (!linha) continue;

    // Ignora linhas muito curtas
    if (linha.length < 5) continue;

    // Detecta quantidade (sempre no final)
    const { quantidade, linha: semQuantidade } =
      detectQuantidade(linha);

    // Detecta unidade
    const { unidadeId, linha: semUnidade } =
      detectUnidade(semQuantidade, depara.unidades);

    // Detecta item no início
    const { item, linha: resto } =
      detectItem(semUnidade);

    // Se não tem quantidade e nem unidade → pode ser categoria
    if (!quantidade && !unidadeId && !item) {
      // Categoria costuma ser linha isolada
      if (/^[A-Z\s]+$/.test(linha) && linha.length < 60) {
        resultado.push({
          Item: null,
          Categoria: linha,
          Descricao: null,
          Unidade: null,
          Quantidade: null
        });
      }

      continue;
    }

    // O que restou vira descrição
    const descricao = resto || null;

    resultado.push({
      Item: item,
      Categoria: null,
      Descricao: descricao,
      Unidade: unidadeId,
      Quantidade: quantidade
    });
  }

  return resultado;
};


```
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
```