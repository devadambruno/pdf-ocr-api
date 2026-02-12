function normalize(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

module.exports.detectTipoCertidao = function (texto, listaTipos = []) {
  if (!texto || !Array.isArray(listaTipos)) return null;

  const upper = normalize(texto);

  // 🔥 Detecta CAT ou CAO de forma flexível
  const isCAT =
    upper.includes("ACERVO TECNICO") ||
    upper.includes("CAT");

  const isCAO =
    upper.includes("ACERVO OPERACIONAL") ||
    upper.includes("CAO");

  // 🔥 Detecta conselho
  const isCREA = upper.includes("CREA");
  const isCAU = upper.includes("CAU");
  const isCRT = upper.includes("CRT");
  const isCRA = upper.includes("CRA");
  const isCFTA = upper.includes("CFTA");

  let nomeNormalizado = null;

  if (isCAT && isCREA) nomeNormalizado = "CAT – CREA";
  else if (isCAO && isCREA) nomeNormalizado = "CAO – CREA";
  else if (isCAT && isCAU) nomeNormalizado = "CAT – CAU";
  else if (isCAO && isCAU) nomeNormalizado = "CAO – CAU";
  else if (isCAT && isCRT) nomeNormalizado = "CAT – CRT";
  else if (isCAO && isCRT) nomeNormalizado = "CAO – CRT";
  else if (isCAT && isCRA) nomeNormalizado = "CAT - CRA";
  else if (isCAO && isCRA) nomeNormalizado = "CAO - CRA";
  else if (isCAO && isCFTA) nomeNormalizado = "CAO – CFTA";

  if (!nomeNormalizado) {
    console.log("⚠️ Tipo não detectado no texto");
    return null;
  }

  const encontrado = listaTipos.find((item) =>
    normalize(item.tipoCertidao) === normalize(nomeNormalizado)
  );

  if (!encontrado) {
    console.log("⚠️ Tipo detectado mas não encontrado na lista:", nomeNormalizado);
    return null;
  }

  return encontrado.id;
};
