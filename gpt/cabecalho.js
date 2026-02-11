async function callGPTCabecalho(textoOCR) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      temperature: 0,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `
Extraia e NORMALIZE o cabeçalho da certidão abaixo.

Responda APENAS com JSON válido.

Formato obrigatório:
{
  "NumerodaCertidao": string | null,
  "ObjetodaCertidao": string | null,
  "TipodaCertidao": string | null,
  "QualificacaoObra": string | null,
  "QualificacaoEspecifica": string | null,
  "NiveldeAtividade": string | null,
  "Estado": string | null
}

Texto:
${textoOCR}
`
        }
      ]
    })
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

module.exports = { callGPTCabecalho };
