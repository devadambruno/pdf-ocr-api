require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const AdmZip = require("adm-zip");
const crypto = require("crypto");

const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult
} = require("@adobe/pdfservices-node-sdk");

const { ocrWithTesseract } = require("./ocr-tesseract.cjs");


const app = express();
app.use(express.json());

/* ================= CONFIG ================= */

const TMP_DIR = path.join(__dirname, "tmp");
const CHUNK_SIZE = 10;

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

/* ================= MIDDLEWARE ================= */

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ================= UTILS ================= */

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    );
  });
}

async function extractTextDirect(pdfPath) {
  return await execAsync(`pdftotext "${pdfPath}" -`);
}

function splitTextIntoPages(text) {
  return text
    .split("\f")
    .map((t, i) => ({ page: i + 1, text: t.trim() }))
    .filter(p => p.text);
}

function chunkPages(pages, size) {
  const chunks = [];
  for (let i = 0; i < pages.length; i += size) {
    chunks.push(pages.slice(i, i + size));
  }
  return chunks;
}

/* ================= CLAUDE ================= */

async function callClaude({ prompt, contexto, texto }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `
${prompt}

CONTEXTO:
${JSON.stringify(contexto, null, 2)}

TEXTO OCR:
${texto}
          `
        }
      ]
    })
  });

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}

/* ================= MERGE ================= */

function mergeResultado(final, parcial, contexto) {
  if (!final.Cabecalho && parcial.Cabecalho) {
    final.Cabecalho = parcial.Cabecalho;
  }

  for (const serv of parcial.Servicos || []) {
    const existente = final.Servicos.find(s => s.Item === serv.Item);

    if (existente) {
      existente.Descricao += " " + serv.Descricao;
      existente.Quantidade ||= serv.Quantidade;
      existente.Unidade ||= serv.Unidade;
      existente.Categoria ||= serv.Categoria;
    } else {
      final.Servicos.push(serv);
    }
  }

  if (parcial.Meta) {
    contexto.ultimoItem = parcial.Meta.ultimoItemNesteLote;
    contexto.descricaoParcialAnterior = parcial.Meta.descricaoFinalParcial;
    contexto.servicosExtraidos = final.Servicos.length;
  }
}

/* ================= ROUTE OCR + PARSE ================= */

app.post("/ocr/parse", async (req, res) => {
  const id = crypto.randomUUID();
  const pdfPath = path.join(TMP_DIR, `${id}.pdf`);

  try {
    const {
      pdf_url,
      prompt_base,
      json_tipos_certidao,
      json_nivel_atividade,
      json_qualificacao_obra,
      json_qualificacao_especifica,
      json_unidades
    } = req.body;

    if (!pdf_url || !prompt_base) {
      return res.status(400).json({ error: "pdf_url e prompt_base são obrigatórios" });
    }

    /* -------- DOWNLOAD -------- */

    const buffer = Buffer.from(await (await fetch(pdf_url)).arrayBuffer());
    fs.writeFileSync(pdfPath, buffer);

    /* -------- OCR DIGITAL -------- */

    const rawText = await extractTextDirect(pdfPath);
    const pages = splitTextIntoPages(rawText);
    const chunks = chunkPages(pages, CHUNK_SIZE);

    /* -------- CONTEXTO -------- */

    const contexto = {
      ultimoItem: null,
      descricaoParcialAnterior: null,
      servicosExtraidos: 0
    };

    const resultadoFinal = {
      Cabecalho: null,
      Servicos: []
    };

    /* -------- LOOP LLM -------- */

    for (const chunk of chunks) {
      const texto = chunk.map(p => `--- PAGINA ${p.page} ---\n${p.text}`).join("\n\n");

      const prompt = `
${prompt_base}

TIPOS_CERTIDAO:
${JSON.stringify(json_tipos_certidao)}

NIVEL_ATIVIDADE:
${JSON.stringify(json_nivel_atividade)}

QUALIFICACAO_OBRA:
${JSON.stringify(json_qualificacao_obra)}

QUALIFICACAO_ESPECIFICA:
${JSON.stringify(json_qualificacao_especifica)}

UNIDADES:
${JSON.stringify(json_unidades)}
      `;

      const parcial = await callClaude({
        prompt,
        contexto,
        texto
      });

      mergeResultado(resultadoFinal, parcial, contexto);
    }

    return res.json({
      success: true,
      resultado: resultadoFinal
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* ================= HEALTH ================= */

app.get("/health", (_, res) => res.json({ status: "ok" }));

/* ================= START ================= */

app.listen(3000, () => {
  console.log("✅ OCR + Claude API rodando — JSON final automático");
});
