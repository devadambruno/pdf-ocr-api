function cleanOCR(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9/]/g, "");
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

    const siglaOriginal = raw.split(" - ")[0].trim();
    const siglaLimpa = cleanOCR(siglaOriginal);

    // 🔥 IGNORA SIGLA VAZIA
    if (!siglaLimpa) continue;

    // Match exato
    if (siglaLimpa === unidadeLimpa) {
      return item.id;
    }

    // Match por início (para casos tipo M3XKM)
    if (unidadeLimpa.startsWith(siglaLimpa)) {
      return item.id;
    }
  }

  return null;
};
