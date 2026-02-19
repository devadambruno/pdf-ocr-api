const { normalizeUnidade } = require("./normalizeUnidade");

/* =======================================================
   UTIL
======================================================= */

function getTextFromCell(doc, cell) {
  const segs = cell?.layout?.textAnchor?.textSegments;
  if (!segs?.length) return null;
  const start = segs[0]?.startIndex ?? 0;
  const end = segs[0]?.endIndex ?? 0;
  return (doc.text || "").substring(start, end).trim() || null;
}

function normalizeHeader(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function guessServiceColumns(headerCells = []) {
  const headers = headerCells.map((h) => normalizeHeader(h || ""));

  const idxItem = headers.findIndex((h) => /\bITEM\b/.test(h));
  const idxUnidade = headers.findIndex((h) => /\bUNIDADE\b/.test(h));
  const idxQuantidade = headers.findIndex(
    (h) => /\bQUANTIDADE\b/.test(h) || /\bQTD\b/.test(h)
  );
  const idxDescricao = headers.findIndex(
    (h) =>
      /\bNATUREZA\b/.test(h) ||
      /\bSERVIC/.test(h) ||
      /\bDESCRIC/.test(h) ||
      /\bDESCRICAO\b/.test(h)
  );

  return { idxItem, idxDescricao, idxUnidade, idxQuantidade };
}

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

  const buildRegex = (termo) => {
    const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // \b não funciona para símbolos como '%' (não são "word chars")
    const isWordLike = /^[A-Za-z0-9_]+$/.test(termo);
    return isWordLike ? new RegExp(`\\b${escaped}\\b`, "i") : new RegExp(escaped, "i");
  };

  const partes = (u) => {
    const raw = u?.unidadeNome || u?.valor || u?.nome || "";
    const [sigla, ...rest] = raw.split(" - ");
    const nomeCompleto = rest.join(" - ").trim();
    return [sigla?.trim(), nomeCompleto].filter(Boolean);
  };

  for (const item of listaUnidades) {
    const [sigla, nomeCompleto] = partes(item);
    if (!sigla) continue;

    for (const termo of [sigla, nomeCompleto]) {
      if (!termo) continue;
      const regex = buildRegex(termo);
      if (regex.test(linha)) {
        const novaLinha = linha.replace(regex, "").trim();
        return {
          unidadeId: normalizeUnidade(termo, listaUnidades),
          linha: novaLinha
        };
      }
    }
  }

  return { unidadeId: null, linha };
}

function inferUnidadeFromDescricao(descricao, listaUnidades = []) {
  if (!descricao) return null;
  // Ex.: "(48,69%)" ou "17.6%"
  if (/%/.test(descricao)) {
    return normalizeUnidade("%", listaUnidades);
  }
  // Ex.: "por cento", "percentual" (OCR varia)
  const descNorm = normalizeHeader(descricao);
  if (/\bPOR\s+CENTO\b/.test(descNorm) || /\bPERCENT(UAL|O)?\b/.test(descNorm)) {
    return normalizeUnidade("%", listaUnidades);
  }
  return null;
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
      let headerRow = table.headerRows?.[0] || null;
      let bodyRows = table.bodyRows || [];

      // Document AI às vezes coloca o header como primeira linha do body
      if (!headerRow && bodyRows.length > 0) {
        const firstCells = bodyRows[0].cells.map((c) => getTextFromCell(doc, c));
        const firstRowText = firstCells.join(" ").toUpperCase();
        if (
          /\bUNIDADE\b/.test(firstRowText) &&
          (/\bQUANTIDADE\b/.test(firstRowText) || /\bQTD\b/.test(firstRowText))
        ) {
          headerRow = bodyRows[0];
          bodyRows = bodyRows.slice(1);
        }
      }

      const headerCells = headerRow
        ? headerRow.cells.map((c) => getTextFromCell(doc, c))
        : [];

      const { idxItem, idxDescricao, idxUnidade, idxQuantidade } =
        guessServiceColumns(headerCells);

      const hasServiceShape =
        idxUnidade !== -1 &&
        idxQuantidade !== -1 &&
        (idxDescricao !== -1 || idxItem !== -1 || headerCells.length > 0);

      for (const row of bodyRows) {
        const cells = row.cells.map((c) => getTextFromCell(doc, c));
        if (!cells.some(Boolean)) continue;

        // Se a tabela tem cabeçalho típico de serviços, usa o mapeamento de colunas
        if (hasServiceShape) {
          const itemRaw = idxItem !== -1 ? cells[idxItem] : null;
          const item = itemRaw && /^\d+(\.\d+)*$/.test(itemRaw) ? itemRaw : null;
          const descricao =
            (idxDescricao !== -1 ? cells[idxDescricao] : cells[0]) || null;
          const unidadeRaw =
            (idxUnidade !== -1 ? cells[idxUnidade] : null) || null;
          const quantidade =
            (idxQuantidade !== -1 ? cells[idxQuantidade] : null) || null;

          // ignora linhas vazias/“total”
          const descNorm = normalizeHeader(descricao || "");
          if (!descricao && !item) continue;
          if (/^TOTAL\b/.test(descNorm)) continue;

          resultado.push({
            Item: item,
            Categoria: null,
            Descricao: descricao,
            Unidade:
              normalizeUnidade(unidadeRaw, depara.unidades) ??
              inferUnidadeFromDescricao(descricao, depara.unidades),
            Quantidade: quantidade,
          });

          continue;
        }

        // Caso antigo (tabelas com coluna item numérica)
        const item = cells[0];
        if (item && /^\d+(\.\d+)*$/.test(item)) {
          resultado.push({
            Item: item,
            Categoria: null,
            Descricao: cells[1] || null,
            Unidade: normalizeUnidade(cells[2] || null, depara.unidades),
            Quantidade: cells[3] || null,
          });
        }
      }
    }
  }

  if (resultado.length > 0) return resultado;

  console.log("⚠️ Nenhuma tabela detectada. Aplicando fallback inteligente....");

  /* ===============================================
     2️⃣ FALLBACK: FORMATO CAT (Atividade Técnica com ";")
  =============================================== */

  const textoCompleto = (doc.text || "").replace(/\r\n/g, "\n");
  const catSegmentos = textoCompleto.split(/;\s*(?=\d+\s*-\s*(?:Execução|Coordenação|Elaboração|Planejamento|Projeto|obra|Obra|serviço|Serviço|técnico|Técnico))/i);

  if (catSegmentos.length > 1) {
    for (let seg of catSegmentos) {
      seg = cleanLine(seg.replace(/^Atividade\s+Técnica:\s*/i, "").trim());
      if (!seg || seg.length < 10) continue;

      const { quantidade, linha: semQtd } = detectQuantidade(seg);
      const { unidadeId, linha: resto } = detectUnidade(semQtd, depara.unidades);

      if (!quantidade && !unidadeId) continue;

      const { item, linha: descricao } = detectItem(resto);
      resultado.push({
        Item: item,
        Categoria: null,
        Descricao: descricao || resto || null,
        Unidade: unidadeId,
        Quantidade: quantidade,
      });
    }
    if (resultado.length > 0) return resultado;
  }

  /* ===============================================
     3️⃣ FALLBACK: LINHA POR LINHA (texto corrido genérico)
  =============================================== */

  const linhas = textoCompleto.split("\n");

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


