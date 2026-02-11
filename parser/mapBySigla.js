function mapBySigla(valor, lista) {
  if (!valor) return null;
  if (!Array.isArray(lista)) return null;

  const v = normaliza(valor);

  for (const item of lista) {
    if (
      Array.isArray(item.siglas) &&
      item.siglas.some(s => v.includes(normaliza(s)))
    ) {
      return item.id;
    }
  }

  return null;
}
