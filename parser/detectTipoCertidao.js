module.exports.detectTipoCertidao = function (texto, listaTipos = []) {
  if (!texto || !Array.isArray(listaTipos)) return null;

  const upper = texto.toUpperCase();

  // Detecta tipo base
  const isCAT = /CERTID[ÃA]O\s+DE\s+ACERVO\s+T[ÉE]CNICO/.test(upper);
  const isCAO = /CERTID[ÃA]O\s+DE\s+ACERVO\s+OPERACIONAL/.test(upper);

  // Detecta conselho
  const isCREA = /\bCREA\b/.test(upper);
  const isCAU = /\bCAU\b/.test(upper);
  const isCRT = /\bCRT\b/.test(upper);
  const isCRA = /\bCRA\b/.test(upper);
  const isCFTA = /\bCFTA\b/.test(upper);

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

  if (!nomeNormalizado) return null;

  const encontrado = listaTipos.find((item) =>
    item.tipoCertidao?.toUpperCase() === nomeNormalizado.toUpperCase()
  );

  return encontrado ? encontrado.id : null;
};
