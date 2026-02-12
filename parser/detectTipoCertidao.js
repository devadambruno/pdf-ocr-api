function normalize(texto = "") {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

module.exports.detectTipoCertidao = function (texto, listaTipos = []) {
  if (!texto || !Array.isArray(listaTipos)) return null;

  const upper = normalize(texto);

  const isCAT = upper.includes("ACERVOTECNICO") || upper.includes("CAT");
  const isCAO = upper.includes("ACERVOOPERACIONAL") || upper.includes("CAO");

  const isCREA = upper.includes("CREA");
  const isCAU = upper.includes("CAU");
  const isCRT = upper.includes("CRT");
  const isCRA = upper.includes("CRA");
  const isCFTA = upper.includes("CFTA");

  let nomeDetectado = null;

  if (isCAT && isCREA) nomeDetectado = "CATCREA";
  else if (isCAO && isCREA) nomeDetectado = "CAOCREA";
  else if (isCAT && isCAU) nomeDetectado = "CATCAU";
  else if (isCAO && isCAU) nomeDetectado = "CAOCAU";
  else if (isCAT && isCRT) nomeDetectado = "CATCRT";
  else if (isCAO && isCRT) nomeDetectado = "CAOCRT";
  else if (isCAT && isCRA) nomeDetectado = "CATCRA";
  else if (isCAO && isCRA) nomeDetectado = "CAOCRA";
  else if (isCAO && isCFTA) nomeDetectado = "CAOCFTA";

  if (!nomeDetectado) return null;

  for (const item of listaTipos) {
    const textoLista = item.tipoCertidao || item.valor || "";
    if (normalize(textoLista) === nomeDetectado) {
      return item.id;
    }
  }

  return null;
};
