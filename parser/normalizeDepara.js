function normaliza(txt) {
  return txt
    ?.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDepara(lista, campoTexto) {
  if (!Array.isArray(lista)) return [];

  return lista.map(item => ({
    id: item.id,
    siglas: [
      normaliza(item[campoTexto])
    ]
  }));
}

module.exports = { normalizeDepara };
