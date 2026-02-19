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

  /*
   * Remove linhas que são claramente boilerplate (cabeçalho/rodapé de certidão,
   * número de página, texto legal, assinaturas, endereços, etc.) e não serviços reais.
   */
  const boilerplatePatterns = [
    /Certidão\s+de\s+Acervo\s+Técnico/i,
    /Conselho\s+Regional\s+de\s+Engenharia\s+(e\s+)?Agronomia/i,
    /Conselho\s+Regional\s+de\s+Engenharia\s*$/i,
    /Regional\s+de\s+Engenharia\s+.*Agronomia\s+da\s+Bahia/i,
    /CREA-\s*BA|CREA\s*-\s*BA/i,
    /Página\s*\d+\s*\/\s*\d+/i,
    /vinculado\s+à\s+Certidão/i,
    /Chave\s+de\s+Impress[ãa]?o?/i,
    /Certidão\s*[°º]\s*\d+\s*\/\s*\d*/i,
    /\/\d{2}\/\d{4},\s*\d{2}:\s*$/i,
    /^\/\d{2}\/\d{4},\s*\d{2}:$/i,
    /Tel:\s*\+\s*55\s*\(\d{2}\)/i,
    /Avenida\s+\d+|Avanida\s+\d+/i,
    /Rua\s+[A-ZÀ-Ú]/i,
    /Plataforma\s+[GL]\s*,?\s*Lado\s+[AB]/i,
    /Centro\s+Administrativo\s+da\s+Bahia/i,
    /Salvador-Bahia\s+CEP/i,
    /Impresso\s+em:\s*\d{2}\/\d{2}\/\d{4}/i,
    /Este\s+documento\s+encontra-se\s+registrado/i,
    /O\s+documento\s+neste\s+ato\s+registrado/i,
    /Resolução\s+N[°º]\s*\d+/i,
    /CERTIFICAMOS\s*,/i,
    /Coordenação\s+Executiva\s+de\s+Infraestrutura\s+da\s+Rede/i,
    /Declaramos\s+que\s+todos\s+os\s+serviços/i,
    /Comissão\s+Transitória\s+de\s+Recebimento/i,
    /Coordenador\s+Executivo\s*$/i,
    /Mat\.\s*\d+\.\d+\.\d+-\d*/i,
    /E-mail:\s*creaba@creaba/i,
    /Fax:\s*\+\s*55/i,
    /Site:\s*www\./i,
    /GOVERNO\s+DO\s+ESTADO/i,
    /Secretaria\s+da\s+Saúde\s+do\s+Estado/i,
    /under\s+F\.L\./i,
    /^un\s*$/i,
    /(?:Silvia|ílvia|Sílvia)\s+Maria\s+Pereira/i,
    /Fernando\s+\.?\s*da\s+Cunha/i,
    /Cesar\s+Maurício\s+B/i,
    /ésar\s+Mauricio\s+Chastinet/i,
    /^\d{2}\/\d{2}\/\d{4},\s*09:\s*$/i,
    /^\s*\/\d{2}\/\d{4},\s*\d{2}:\s*$/i,
  ];
  const descMaxLength = 600;
  /* Quantidade/Item que são claramente lixo (OCR, índice, número gigante) */
  function isGarbageQuantidade(qtd) {
    if (qtd == null) return false;
    const s = String(qtd).trim();
    if (/^[.,;:\s]+$/.test(s) || s === "" || s.length > 25) return true;
    if (/^\d+$/.test(s) && s.length > 12) return true;
    if (/^[\d.,]+$/.test(s) && (s.replace(/\D/g, "").length > 15)) return true;
    return false;
  }
  function isGarbageItem(item) {
    if (item == null) return false;
    const s = String(item).trim();
    return /^\d+$/.test(s) && s.length > 10;
  }
  /** Unidade que parece índice de bloco (número puro) em vez de unidade de medida */
  function unidadePareceIndice(unidade) {
    if (unidade == null) return false;
    const u = String(unidade).trim();
    return /^\d{1,4}$/.test(u) && parseInt(u, 10) > 0;
  }
  todosServicos = todosServicos.filter((s) => {
    const cat = (s.Categoria != null && String(s.Categoria).trim()) || "";
    const desc = (s.Descricao != null && String(s.Descricao).trim()) || "";
    const text = `${cat} ${desc}`.trim();
    if (text.length > descMaxLength) return false;
    if (desc && /^Página\s*\d+\s*\/?\s*$/i.test(desc)) return false;
    if (s.Quantidade != null && String(s.Quantidade).trim() === "47" && !desc) return false;
    if (isGarbageQuantidade(s.Quantidade)) return false;
    if (isGarbageItem(s.Item)) return false;
    if ((cat === "un" || desc === "un") && !s.Quantidade && !s.Item) return false;
    if (unidadePareceIndice(s.Unidade) && semQuantidade(s.Quantidade) && cat && cat === desc) return false;
    const isBoilerplate = boilerplatePatterns.some((re) => re.test(text));
    return !isBoilerplate;
  });

  /* ================= RETORNO FINAL ================= */

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
