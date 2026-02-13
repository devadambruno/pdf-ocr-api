// parser/normalizeUnidade.js

function cleanOCR(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[×]/g, "X")      // multiplicação unicode
    .replace(/[\/\-]/g, "X")   // transforma / e - em X
    .replace(/[^A-Z0-9X]/g, "");
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

    const siglaOriginal = raw.split(" - ")[0];
    const siglaLimpa = cleanOCR(siglaOriginal);

    if (siglaLimpa === unidadeLimpa) {
      return item.id;
    }
  }

  return null;
};
