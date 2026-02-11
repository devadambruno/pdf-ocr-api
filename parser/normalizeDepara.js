function normaliza(txt) {
  return txt
    ?.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDepara(lista, campo) {
  return (lista || []).map(item => ({
    id: item.id,
    valor: normaliza(item[campo])
  }));
}

function mapByTexto(texto, lista) {
  const t = normaliza(texto);
  for (const item of lista || []) {
    if (t.includes(item.valor)) {
      return item.valor;
    }
  }
  return null;
}

module.exports = {
  normalizeDepara,
  mapByTexto
};
