// parser/normalizeUnidade.js

const ALIASES = {
  METROQUADRADO: ["M2", "M²", "METROQUADRADO"],
  METROCUBICO: ["M3", "M³", "METROCUBICO"],
  QUILOGRAMA: ["KG", "QUILOGRAMA"],
  METRO: ["M", "METRO"],
  UNIDADE: ["UN", "UNIDADE", "UT"],
  MES: ["MES", "MÊS"],
  HORA: ["H", "HORA"],
};

function cleanOCR(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[×]/g, "X")
    .replace(/[\/\-]/g, "X")
    // Mantém '%' para suportar unidade de porcentagem
    .replace(/[^A-Z0-9X%]/g, "");
}

module.exports.normalizeUnidade = function (
  unidadeExtraida,
  listaUnidades = []
) {
  if (!unidadeExtraida) return null;
  if (!Array.isArray(listaUnidades)) return null;

  const unidadeLimpa = cleanOCR(unidadeExtraida);

  for (const item of listaUnidades) {
    const raw =
      item.unidadeNome ||
      item.valor ||
      item.nome ||
      "";

    if (!raw) continue;

    const partes = raw.split(" - ");
    const primeiro = (partes[0] || "").trim();
    const siglaLimpa = cleanOCR(
      primeiro.includes(" ") ? primeiro.split(/\s+/)[0] : primeiro
    );
    const nomeLimpo = cleanOCR(partes[1] || "");

    if (siglaLimpa === unidadeLimpa || nomeLimpo === unidadeLimpa) {
      return item.id;
    }
  }

  // Fallback: aliases comuns do texto CAT (metro quadrado, quilograma, etc.)
  for (const variantes of Object.values(ALIASES)) {
    if (!variantes.some((v) => cleanOCR(v) === unidadeLimpa)) continue;
    for (const item of listaUnidades) {
      const raw = item.unidadeNome || item.valor || item.nome || "";
      const sigla = cleanOCR((raw.split(" - ")[0] || ""));
      if (variantes.some((v) => cleanOCR(v) === sigla)) return item.id;
    }
  }

  return null;
};
