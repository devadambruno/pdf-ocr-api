function normalize(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

module.exports.normalizeUnidade = function (unidadeExtraida, listaUnidades = []) {
  if (!unidadeExtraida) return null;
  if (!Array.isArray(listaUnidades)) return null;

  const unidadeNormalizada = normalize(unidadeExtraida.trim());

  for (const item of listaUnidades) {
    if (!item?.unidadeNome) continue; // 🔥 blindagem

    const sigla = item.unidadeNome.split(" - ")[0];

    if (normalize(sigla) === unidadeNormalizada) {
      return item.id;
    }
  }

  return null;
};
