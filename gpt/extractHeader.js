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
Você receberá um TEXTO OCR de uma certidão técnica (CAT ou CAO).

Extraia APENAS os campos abaixo.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com JSON válido.
2. NÃO use markdown.
3. NÃO escreva comentários.
4. NÃO invente informações.
5. Se não tiver segurança, retorne null.
6. Normalize EXCLUSIVAMENTE usando as listas fornecidas.
7. Retorne o ID correspondente.

===================================
LISTA TIPOS_CERTIDAO
${JSON.stringify(depara.tipoCertidao)}

LISTA NIVEL_ATIVIDADE
${JSON.stringify(depara.nivelAtividade)}

LISTA QUALIFICACAO_OBRA
${JSON.stringify(depara.qualificacaoObra)}

LISTA QUALIFICACAO_ESPECIFICA
${JSON.stringify(depara.qualificacaoEspecifica)}

===================================

Extraia:

- TipodaCertidao (retorne apenas o ID)
- NiveldeAtividade (retorne apenas o ID)
- QualificacaoObra (retorne apenas o ID)
- QualificacaoEspecifica (retorne apenas o ID)
- ObjetodaCertidao (texto literal do objeto da obra)

===================================

TEXTO OCR:
${textoOCR}
`;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    input: prompt,
  });

  const content = response.output_text;

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error("Erro ao parsear resposta do GPT:", content);
    throw new Error("Resposta inválida do GPT");
  }

  return parsed;
};
