function normaliza(txt) {
  return txt
    ?.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapBySigla(valor, lista) {
  if (!valor) return null;

  const tokens = normaliza(valor).split(" ");

  for (const item of lista) {
    for (const sigla of item.siglas) {
      const s = normaliza(sigla);
      if (tokens.includes(s)) {
        return item.id;
      }
    }
  }

  return null;
}

module.exports = { mapBySigla };
