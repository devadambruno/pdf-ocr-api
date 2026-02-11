const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não configurada");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.extractHeader = async function ({
  textoOCR,
  depara,
}) {
  const prompt = `
Você receberá um TEXTO OCR correspondente a parte de uma certidão técnica (CAT ou CAO).
Extraia apenas as informações de cabeçalho.
Responda apenas com JSON válido.

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

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "Você é um extrator estruturado de dados." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0].message.content;

  return JSON.parse(content);
};
