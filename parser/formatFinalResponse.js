function isServicoValido(item) {
  if (!item.Descricao) return false;

  const lixo = [
    /^UF:/i,
    /^CEP:/i,
    /^Início da Obra/i,
    /^Término da Obra/i,
    /ENGENHEIRO/i
  ];

  return !lixo.some(rx => rx.test(item.Item || ""));
}

module.exports.formatFinalResponse = ({ cabecalhoGPT, servicos }) => {
  return {
    NumerodaCertidao: cabecalhoGPT.numero || null,
    ObjetodaCertidao: cabecalhoGPT.objeto || null,
    TipodaCertidao: cabecalhoGPT.tipoCertidao || null,
    QualificacaoObra: cabecalhoGPT.qualificacaoObra || null,
    QualificacaoEspecifica: cabecalhoGPT.qualificacaoEspecifica || null,
    NiveldeAtividade: cabecalhoGPT.nivelAtividade || null,
    Estado: cabecalhoGPT.estado || null,

    Servicos: servicos
      .filter(isServicoValido)
      .map(s => ({
        Item: s.Item ?? null,
        Descricao: s.Descricao ?? null,
        Quantidade: s.Quantidade ?? null,
        Categoria: null,
        Unidade: null
      }))
  };
};
