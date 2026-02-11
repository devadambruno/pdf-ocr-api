const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.extractHeader = async (texto, depara) => {
  const prompt = `
Você receberá o texto OCR de uma certidão técnica.

Sua tarefa é extrair e NORMALIZAR os seguintes campos:

- TipodaCertidao (retorne o ID correto conforme lista)
- NiveldeAtividade (retorne o ID correto conforme lista)
- QualificacaoObra (retorne o ID correto conforme lista)
- QualificacaoEspecifica (retorne o ID correto conforme lista)

Regras:
- Use apenas IDs existentes nas listas fornecidas.
- Se não tiver certeza absoluta, retorne null.
- Responda apenas JSON válido.

Lista Tipos:
${JSON.stringify(depara.json_tipos_certidao)}

Lista Nível:
${JSON.stringify(depara.json_nivel_atividade)}

Lista Qualificação Obra:
${JSON.stringify(depara.json_qualificacao_obra)}

Lista Qualificação Específica:
${JSON.stringify(depara.json_qualificacao_especifica)}

Texto OCR:
"""
${texto.slice(0, 6000)}
"""
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "Você é um especialista em certidões técnicas brasileiras." },
      { role: "user", content: prompt }
    ],
  });

  return JSON.parse(response.choices[0].message.content);
};
