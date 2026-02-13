function normalize(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

module.exports.normalizeUnidade = function (unidadeExtraida, listaUnidades = []) {
  if (!unidadeExtraida) return null;
  if (!Array.isArray(listaUnidades)) return null;

  const unidadeNormalizada = normalize(unidadeExtraida);

  console.log("---- DEBUG UNIDADE ----");
  console.log("Extraída:", unidadeExtraida);
  console.log("Normalizada extraída:", unidadeNormalizada);

  for (const item of listaUnidades) {
    if (!item?.unidadeNome) continue;

    const sigla = item.unidadeNome.split(" - ")[0];
    const siglaNormalizada = normalize(sigla);

    console.log("Comparando com:", sigla, "=>", siglaNormalizada);

    if (siglaNormalizada === unidadeNormalizada) {
      console.log("✅ MATCH:", item.id);
      return item.id;
    }
  }

  console.log("❌ NÃO ENCONTROU MATCH");
  return null;
};
