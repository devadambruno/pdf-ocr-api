function normaliza(txt) {
  return txt
    ?.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function mapBySigla(valor, lista) {
  if (!valor || !Array.isArray(lista)) return null;

  const v = normaliza(valor);

  for (const item of lista) {
    if (!item?.siglas) continue;

    if (
      item.siglas.some(s =>
        v.includes(normaliza(s))
      )
    ) {
      return item.id;
    }
  }

  return null;
}

module.exports = { mapBySigla };
