function normalize(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, ""); // 🔥 remove tudo que não for letra ou número
}

module.exports.normalizeUnidade = function (unidadeExtraida, listaUnidades = []) {
  if (!unidadeExtraida) return null;
  if (!Array.isArray(listaUnidades)) return null;

  const unidadeNormalizada = normalize(unidadeExtraida);

  for (const item of listaUnidades) {
    if (!item?.unidadeNome) continue;

    // pega só a sigla antes do hífen
    const sigla = item.unidadeNome.split(" - ")[0];

    const siglaNormalizada = normalize(sigla);

    if (siglaNormalizada === unidadeNormalizada) {
      return item.id;
    }
  }

  return null;
};
