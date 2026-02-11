const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não configurada");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.extractHeader = async function (textoOCR, depara) {
  if (!textoOCR) {
    return {
      TipodaCertidao: null,
      NiveldeAtividade: null,
      QualificacaoObra: null,
      QualificacaoEspecifica: null,
      ObjetodaCertidao: null
    };
  }

  // 🔥 IMPORTANTÍSSIMO: limitar ao início do documento
  const textoCabecalho = textoOCR.slice(0, 8000);

  const prompt = `
Você receberá o TEXTO OCR do CABEÇALHO de uma certidão técnica.

O texto corresponde APENAS ao início do documento.

Sua tarefa é extrair e NORMALIZAR os campos abaixo.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com JSON válido.
2. NÃO use markdown.
3. NÃO escreva comentários.
4. NÃO invente informações.
5. Se não encontrar com segurança, retorne null.
6. Use EXCLUSIVAMENTE as listas fornecidas.
7. Retorne apenas o ID correspondente.
8. Para Tipo de Certidão:
   - Se encontrar "Certidão de Acervo Técnico - CAT" → usar lista CAT – CREA
   - Se encontrar "CAO" → usar lista correspondente
9. Para Qualificação:
   - Hospital → OBRAS HOSPITALARES
   - Escola → OBRAS EDUCACIONAIS
   - Residencial → RESIDENCIAL
   - Industrial → OBRAS INDUSTRIAIS
10. Para Nível de Atividade:
   - Execução → Execução
   - Coordenação → Coordenação
   - Supervisão → Supervisão
   - Condução → Condução

===================================

LISTA TIPOS_CERTIDAO:
${JSON.stringify(depara?.tipoCertidao ?? [])}

LISTA NIVEL_ATIVIDADE:
${JSON.stringify(depara?.nivelAtividade ?? [])}

LISTA QUALIFICACAO_OBRA:
${JSON.stringify(depara?.qualificacaoObra ?? [])}

LISTA QUALIFICACAO_ESPECIFICA:
${JSON.stringify(depara?.qualificacaoEspecifica ?? [])}

===================================

RETORNE EXATAMENTE NESTE FORMATO:

{
  "TipodaCertidao": number | null,
  "NiveldeAtividade": number | null,
  "QualificacaoObra": number | null,
  "QualificacaoEspecifica": number | null,
  "ObjetodaCertidao": string | null
}

===================================

TEXTO OCR:
${textoCabecalho}
`;

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1",
      temperature: 0,
      input: prompt,
      text: {
        format: {
          type: "json_object"
        }
      }
    });

    const content = response.output_text;

    return JSON.parse(content);

  } catch (err) {
    console.error("Erro GPT Header:", err.message);

    return {
      TipodaCertidao: null,
      NiveldeAtividade: null,
      QualificacaoObra: null,
      QualificacaoEspecifica: null,
      ObjetodaCertidao: null
    };
  }
};
