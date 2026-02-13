function cleanOCR(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9/]/g, "");
}

const DEBUG_UNIDADE = true;

module.exports.normalizeUnidade = function (
  unidadeExtraida,
  listaUnidades = []
) {
  if (!unidadeExtraida) return null;
  if (!Array.isArray(listaUnidades)) return null;

  const unidadeLimpa = cleanOCR(unidadeExtraida);

  if (DEBUG_UNIDADE) {
    console.log("\n---- DEBUG UNIDADE ----");
    console.log("Extraída:", unidadeExtraida);
    console.log("Normalizada:", unidadeLimpa);
  }

  for (const item of listaUnidades) {
    const raw =
      item.unidadeNome ||
      item.valor ||
      item.nome ||
      "";

    if (!raw) continue;

    const siglaOriginal = raw.split(" - ")[0].trim();
    const siglaLimpa = cleanOCR(siglaOriginal);

    if (!siglaLimpa) continue;

    if (DEBUG_UNIDADE) {
      console.log("Comparando com:", siglaOriginal, "|", siglaLimpa);
    }

    // 🔥 Match exato
    if (siglaLimpa === unidadeLimpa) {
      if (DEBUG_UNIDADE) {
        console.log("✅ MATCH EXATO → ID:", item.id);
      }
      return item.id;
    }

    // 🔥 Match parcial (ex: M3XKM começa com M3)
    if (unidadeLimpa.startsWith(siglaLimpa)) {
      if (DEBUG_UNIDADE) {
        console.log("🟡 MATCH PARCIAL → ID:", item.id);
      }
      return item.id;
    }
  }

  if (DEBUG_UNIDADE) {
    console.log("❌ NÃO ENCONTROU MATCH");
  }

  return null;
};
