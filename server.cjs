require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

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
  return execAsync(`pdftotext "${pdfPath}" -`);
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

function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ================= MATCH ================= */

function matchTipoCertidao(texto, lista) {
  if (!texto) return null;
  const t = texto.toUpperCase();
  const hasCAT = t.includes("CAT");
  const hasCAO = t.includes("CAO");
  const siglas = ["CREA", "CAU", "CRA", "CRT", "CFTA"];

  for (const sigla of siglas) {
    if (t.includes(sigla)) {
      const tipo = hasCAT ? "CAT" : hasCAO ? "CAO" : null;
      if (!tipo) return null;

      const found = lista.find(
        i => i.tipoCertidao.includes(tipo) && i.tipoCertidao.includes(sigla)
      );
      if (found) return found.id;
    }
  }
  return null;
}

function matchByTexto(texto, lista, campo) {
  if (!texto) return null;
  const t = normalize(texto);

  let best = null;
  let scoreMax = 0;

  for (const item of lista) {
    const nome = normalize(item[campo]);
    let score = 0;

    if (nome.includes(t) || t.includes(nome)) score += 3;

    const parts = nome.match(/[a-z0-9]{3,}/g) || [];
    for (const p of parts) {
      if (t.includes(p)) score += 1;
    }

    if (score > scoreMax) {
      scoreMax = score;
      best = item;
    }
  }

  return scoreMax > 0 ? best.id : null;
}

/* ================= CLAUDE ================= */

async function callClaude(prompt, contexto, texto) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      temperature: 0,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${prompt}

CONTEXTO:
${JSON.stringify(contexto, null, 2)}

TEXTO OCR:
${texto}`
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok || !Array.isArray(data.content)) {
    throw new Error(`Claude error: ${JSON.stringify(data)}`);
  }

  return JSON.parse(data.content[0].text);
}

/* ================= ROUTE ================= */

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
      return res.status(400).json({ error: "pdf_url e prompt_base obrigatórios" });
    }

    const buffer = Buffer.from(await (await fetch(pdf_url)).arrayBuffer());
    fs.writeFileSync(pdfPath, buffer);

    const rawText = await extractTextDirect(pdfPath);
    const pages = splitTextIntoPages(rawText);
    const chunks = chunkPages(pages, CHUNK_SIZE);

    const contexto = {
      ultimoItem: null,
      descricaoParcialAnterior: null,
      servicosExtraidos: 0
    };

    const resultadoFinal = {
      Cabecalho: {},
      Servicos: []
    };

    for (const chunk of chunks) {
      const texto = chunk.map(p => `--- PAGINA ${p.page} ---\n${p.text}`).join("\n\n");
      const parcial = await callClaude(prompt_base, contexto, texto);

      if (parcial.Cabecalho) {
        resultadoFinal.Cabecalho = {
          ...resultadoFinal.Cabecalho,
          ...parcial.Cabecalho
        };
      }

      for (const s of parcial.Servicos || []) {
        if (!resultadoFinal.Servicos.find(x => x.Item === s.Item)) {
          resultadoFinal.Servicos.push(s);
        }
      }

      if (parcial.Meta) {
        contexto.ultimoItem = parcial.Meta.ultimoItemNesteLote;
        contexto.descricaoParcialAnterior = parcial.Meta.descricaoFinalParcial;
      }
    }

    /* ===== MATCH FINAL ===== */

    resultadoFinal.Cabecalho.TipoCertidao =
      matchTipoCertidao(
        resultadoFinal.Cabecalho.TipoCertidaoTexto,
        json_tipos_certidao
      );

    resultadoFinal.Cabecalho.NivelAtividade =
      matchByTexto(
        resultadoFinal.Cabecalho.NivelAtividadeTexto,
        json_nivel_atividade,
        "nivelAtividade"
      );

    resultadoFinal.Cabecalho.QualificacaoObra =
      matchByTexto(
        resultadoFinal.Cabecalho.QualificacaoObraTexto,
        json_qualificacao_obra,
        "qualificacao"
      );

    resultadoFinal.Cabecalho.QualificacaoEspecifica =
      matchByTexto(
        resultadoFinal.Cabecalho.QualificacaoEspecificaTexto,
        json_qualificacao_especifica,
        "qualificacaoEspecifica"
      );

    resultadoFinal.Servicos = resultadoFinal.Servicos.map(s => ({
      ...s,
      Unidade: matchByTexto(s.UnidadeTexto, json_unidades, "unidadeNome")
    }));

    return res.json({ success: true, resultado: resultadoFinal });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* ================= HEALTH ================= */

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(3000, () => {
  console.log("✅ OCR + Claude + Match determinístico rodando");
});
