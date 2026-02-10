function splitSiglas(txt) {
  if (!txt) return [];
  return txt
    .toUpperCase()
    .split(/[-–/]/)
    .map(s => s.trim())
    .filter(Boolean);
}

module.exports.normalizeDepara = (input, fieldName) => {
  if (!Array.isArray(input)) return [];

  return input.map(item => ({
    id: item.id,
    siglas: splitSiglas(item[fieldName])
  }));
};
