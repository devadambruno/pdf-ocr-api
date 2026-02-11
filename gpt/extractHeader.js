const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não configurada");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.extractHeader = async function (textoOCR, depara) {
  const prompt = `
Você receberá um TEXTO OCR de uma certidão técnica (CAT ou CAO).

Sua tarefa é extrair e NORMALIZAR apenas:

- TipodaCertidao
- NiveldeAtividade
- QualificacaoObra
- QualificacaoEspecifica

Regras:
1) Responda APENAS JSON válido
2) Não use markdown
3) Não invente valores
4) Se não tiver certeza use null
5) Retorne apenas os IDs das opções

TIPOS_CERTIDAO:
${JSON.stringify(depara.tipoCertidao)}

NIVEL_ATIVIDADE:
${JSON.stringify(depara.nivelAtividade)}

QUALIFICACAO_OBRA:
${JSON.stringify(depara.qualificacaoObra)}

QUALIFICACAO_ESPECIFICA:
${JSON.stringify(depara.qualificacaoEspecifica)}

TEXTO:
${textoOCR}
`;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    temperature: 0,
  });

  const content = response.output_text;

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error("Resposta inválida do GPT:", content);
    throw new Error("Resposta inválida do GPT");
  }

  return {
    TipodaCertidao: parsed.TipodaCertidao ?? null,
    NiveldeAtividade: parsed.NiveldeAtividade ?? null,
    QualificacaoObra: parsed.QualificacaoObra ?? null,
    QualificacaoEspecifica: parsed.QualificacaoEspecifica ?? null,
  };
};
