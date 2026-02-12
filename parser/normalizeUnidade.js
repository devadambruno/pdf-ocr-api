function normalize(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, "") // remove espaços
    .replace(/[^A-Z0-9\/]/g, ""); // remove caracteres estranhos
}

module.exports.normalizeUnidade = function (valorOCR, listaUnidades = []) {
  if (!valorOCR) return null;

  const normalOCR = normalize(valorOCR);

  for (const unidade of listaUnidades) {
    const nomeLista = unidade.unidadeNome.split(" - ")[0];
    const normalLista = normalize(nomeLista);

    if (normalOCR === normalLista) {
      return unidade.id;
    }
  }

  // 🔥 tentativa inteligente para casos como M3XKM
  for (const unidade of listaUnidades) {
    const nomeLista = unidade.unidadeNome.split(" - ")[0];
    const normalLista = normalize(nomeLista);

    if (
      normalOCR.includes(normalLista) ||
      normalLista.includes(normalOCR)
    ) {
      return unidade.id;
    }
  }

  return null;
};
