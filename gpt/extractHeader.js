const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não configurada");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.extractHeader = async function ({ textoOCR, depara }) {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    temperature: 0,

    text: {
      format: {
        type: "json_schema",
        name: "header_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            TipodaCertidao: { type: ["number", "null"] },
            NiveldeAtividade: { type: ["number", "null"] },
            QualificacaoObra: { type: ["number", "null"] },
            QualificacaoEspecifica: { type: ["number", "null"] }
          },
          required: [
            "TipodaCertidao",
            "NiveldeAtividade",
            "QualificacaoObra",
            "QualificacaoEspecifica"
          ]
        }
      }
    },

    input: [
      {
        role: "system",
        content: `
Você é um extrator estruturado de dados.
Retorne APENAS JSON válido.
Não use markdown.
Não explique nada.
Retorne apenas IDs das listas fornecidas.
Se não encontrar, retorne null.
`
      },
      {
        role: "user",
        content: `
LISTAS:

TIPOS_CERTIDAO:
${JSON.stringify(depara.tipoCertidao)}

NIVEL_ATIVIDADE:
${JSON.stringify(depara.nivelAtividade)}

QUALIFICACAO_OBRA:
${JSON.stringify(depara.qualificacaoObra)}

QUALIFICACAO_ESPECIFICA:
${JSON.stringify(depara.qualificacaoEspecifica)}

TEXTO OCR:
${textoOCR}
`
      }
    ]
  });

  return response.output_parsed;
};
