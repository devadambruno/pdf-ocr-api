const { parseServices } = require("./parseServices");
const { extractHeader } = require("../gpt/extractHeader");
const { detectTipoCertidao } = require("./detectTipoCertidao");

/** Considera vazio: null, string vazia ou só espaços */
function semQuantidade(qtd) {
  if (qtd == null) return true;
  const s = String(qtd).trim();
  return s === "";
}

/** Fallback A: extrai prefixo da Descricao até " - " ou ":" */
function categoriaPorPrefixo(descricao) {
  if (!descricao || typeof descricao !== "string") return null;
  const d = descricao.trim();
  if (!d) return null;
  const idxTraco = d.indexOf(" - ");
  const idxDoisPontos = d.indexOf(":");
  let fim = d.length;
  if (idxTraco !== -1) fim = Math.min(fim, idxTraco);
  if (idxDoisPontos !== -1) fim = Math.min(fim, idxDoisPontos);
  const prefixo = d.slice(0, fim).trim();
  return prefixo || null;
}

/**
 * Preenche Categoria: prioridade B (linha sem quantidade = mãe, próximas herdam),
 * fallback A (prefixo da Descricao até " - " ou ":").
 */
function preencherCategoria(servicos) {
  if (!Array.isArray(servicos) || servicos.length === 0) return servicos;

  let categoriaVigente = null;

  const resultado = servicos.map((s) => {
    const descricao = s.Descricao;
    const ehLinhaMae = semQuantidade(s.Quantidade);

    if (ehLinhaMae && descricao) {
      categoriaVigente = descricao.trim();
      return { ...s, Categoria: categoriaVigente };
    }

    const categoriaB = categoriaVigente;
    const categoriaA = categoriaPorPrefixo(descricao);
    const categoria = categoriaB ?? categoriaA ?? null;

    return { ...s, Categoria: categoria };
  });

  return resultado;
}

module.exports.parseDocument = async (docs, depara) => {
  const documentos = Array.isArray(docs) ? docs : [docs];

  /* ================= TEXTO COMPLETO (SERVIÇOS) ================= */

  const textoCompleto = documentos
    .map((d) => d?.text || "")
    .join("\n");

  /* ================= SOMENTE PRIMEIRA PÁGINA (HEADER) ================= */

  const textoCabecalho = documentos[0]?.text || "";

  /* ================= GPT HEADER ================= */

  let header = {
    TipodaCertidao: null,
    NiveldeAtividade: null,
    QualificacaoObra: null,
    QualificacaoEspecifica: null,
    ObjetodaCertidao: null,
  };

  try {
    header = await extractHeader(textoCabecalho, depara);
  } catch (e) {
    console.error("Erro no GPT header:", e.message);
  }

  /* ================= EXTRAÇÕES DETERMINÍSTICAS ================= */

  const numero =
    textoCompleto.match(/\b\d{5,}\/\d{4}\b/)?.[0] ?? null;

  const estado =
    textoCompleto.match(
      /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/
    )?.[1] ?? null;

  /* ================= SERVIÇOS ================= */

  let todosServicos = documentos.flatMap((doc) =>
    parseServices(doc, depara)
  );

  /*
   * Numeração automática do Item (1, 2, 3...) quando todos estiverem em branco.
   * Adaptado ao cenário com Categoria: só linhas com Quantidade recebem número;
   * linhas "mãe" (sem quantidade) mantêm Item = null.
   */
  const todosItensEmBranco = todosServicos.every(
    (s) => s.Item == null || String(s.Item).trim() === ""
  );
  if (todosItensEmBranco && todosServicos.length > 0) {
    let contador = 0;
    todosServicos = todosServicos.map((s) => {
      const temQuantidade = !semQuantidade(s.Quantidade);
      const item = temQuantidade ? String(++contador) : null;
      return { ...s, Item: item };
    });
  }

  /* Categoria: B = linha sem quantidade é "mãe", próximas herdam; A = fallback prefixo da Descricao */
  todosServicos = preencherCategoria(todosServicos);

  /*
   * Remove do JSON as linhas que são apenas cabeçalhos de categoria (replicada nas demais).
   * Critério: Item, Unidade e Quantidade nulos e Categoria === Descricao.
   */
  todosServicos = todosServicos.filter((s) => {
    const semItem = s.Item == null || String(s.Item).trim() === "";
    const semUnidade = s.Unidade == null || String(s.Unidade).trim() === "";
    const semQtd = semQuantidade(s.Quantidade);
    const cat = s.Categoria != null ? String(s.Categoria).trim() : "";
    const desc = s.Descricao != null ? String(s.Descricao).trim() : "";
    const categoriaIgualDescricao = cat !== "" && cat === desc;
    const ehSoCabecalhoCategoria =
      semItem && semUnidade && semQtd && categoriaIgualDescricao;
    return !ehSoCabecalhoCategoria;
  });

  /* ================= RETORNO FINAL ================= */

 /* ================= DEBUG ================= */

console.log("=== DEBUG TIPO CERTIDÃO ===");
console.log("Lista recebida:", depara.tipoCertidao);
console.log("Texto início:", textoCompleto.slice(0, 1500));

const tipoCertidaoId = detectTipoCertidao(
  textoCompleto,
  depara.listaTiposOriginal
);




  return {
    NumerodaCertidao: numero,
    ObjetodaCertidaCertidao: header?.ObjetodaCertidao ?? null,
    TipodaCertidao: tipoCertidaoId,
    QualificacaoObra: header?.QualificacaoObra ?? null,
    QualificacaoEspecifica: header?.QualificacaoEspecifica ?? null,
    NiveldeAtividade: header?.NiveldeAtividade ?? null,
    Estado: estado,
    Servicos: todosServicos,
  };
};
