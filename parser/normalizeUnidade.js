module.exports.normalizeUnidade = function (unidadeExtraida, listaUnidades = []) {
  if (!unidadeExtraida) return null;
  if (!Array.isArray(listaUnidades)) return null;

  const unidadeNormalizada = normalize(
    unidadeExtraida.replace(/\s+/g, "").trim()
  );

  for (const item of listaUnidades) {
    if (!item?.unidadeNome) continue;

    const sigla = item.unidadeNome
      .split(" - ")[0]
      .replace(/\s+/g, "");

    if (normalize(sigla) === unidadeNormalizada) {
      return item.id;
    }
  }

  return null;
};
