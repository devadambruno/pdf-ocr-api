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
const CHUNK_SIZE = 5;        // páginas por chunk
const SLEEP_MS = 20_000;     // 20s entre chamadas GPT

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

/* ================= MIDDLEWARE ================= */

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (process.env.API_KEY && req.headers["x-api-key"] !== process.env.API_KEY) {
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ================= XANO ================= */

async function xanoCreateJob(data) {
  return fetch(`${process.env.XANO_BASE_URL}/ocr_jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

async function xanoUpdateJob(job_id, data) {
  await fetch(`${process.env.XANO_BASE_URL}/ocr_jobs/by_job_id/${job_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

async function xanoGetJob(job_id) {
  return fetch(`${process.env.XANO_BASE_URL}/ocr_jobs/by_job_id/${job_id}`)
    .then(r => r.json());
}

/* ================= GPT ================= */

async function callGPT(prompt, contexto, texto) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
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

  if (!response.ok) {
    throw new Error(`GPT error: ${JSON.stringify(data)}`);
  }

  // 🔥 RETORNA TEXTO CRU — SEM PARSE
  return data.choices[0].message.content;
}

/* ================= WORKER ================= */

async function processJob(job_id, pdf_url, prompt_base) {
  try {
    await xanoUpdateJob(job_id, {
      status: "processing",
      started_at: new Date(),
      updated_at: new Date()
    });

    const pdfPath = path.join(TMP_DIR, `${job_id}.pdf`);

    /* -------- DOWNLOAD PDF -------- */

    const pdfResp = await fetch(pdf_url);
    if (!pdfResp.ok) throw new Error("Falha ao baixar PDF");

    const buffer = Buffer.from(await pdfResp.arrayBuffer());
    fs.writeFileSync(pdfPath, buffer);

    /* -------- OCR DIGITAL -------- */

    const rawText = await extractTextDirect(pdfPath);
    const pages = splitTextIntoPages(rawText);
    const chunks = chunkPages(pages, CHUNK_SIZE);

    await xanoUpdateJob(job_id, {
      total_pages: pages.length,
      chunk_size: CHUNK_SIZE,
      total_chunks: chunks.length,
      chunk_atual: 0,
      updated_at: new Date()
    });

    const resultadoFinal = { Cabecalho: {}, Servicos: [] };
    const contexto = {
      ultimoItem: null,
      descricaoParcialAnterior: null
    };

    /* -------- LOOP CHUNKS -------- */

    for (let i = 0; i < chunks.length; i++) {
      await xanoUpdateJob(job_id, {
        chunk_atual: i + 1,
        updated_at: new Date()
      });

      const texto = chunks[i]
        .map(p => `--- PAGINA ${p.page} ---\n${p.text}`)
        .join("\n\n");

      let raw;
      let parcial;

      try {
        raw = await callGPT(prompt_base, contexto, texto);
        parcial = JSON.parse(
          raw.replace(/```json/gi, "").replace(/```/g, "").trim()
        );
      } catch (e) {
       await xanoUpdateJob(job_id, {
        status: "error",
        error: `JSON inválido no chunk ${i + 1}: ${e.message}`,
        resultado: {
          chunk: i + 1,
          gpt_raw: raw
        },
        updated_at: new Date()
      });

      }

      /* -------- MERGE -------- */

      if (parcial.Cabecalho) {
        Object.assign(resultadoFinal.Cabecalho, parcial.Cabecalho);
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

      await sleep(SLEEP_MS);
    }

    /* -------- FINALIZA -------- */

    JSON.stringify(resultadoFinal); // valida JSON

    await xanoUpdateJob(job_id, {
      status: "done",
      resultado: resultadoFinal,
      updated_at: new Date()
    });

  } catch (e) {
    await xanoUpdateJob(job_id, {
      status: "error",
      error: e.message,
      updated_at: new Date()
    });
  }
}

/* ================= ROUTES ================= */

app.post("/ocr/parse", async (req, res) => {
  const { pdf_url, prompt_base } = req.body;

  if (!pdf_url || !prompt_base) {
    return res.status(400).json({
      error: "pdf_url e prompt_base obrigatórios"
    });
  }

  const job_id = crypto.randomUUID();

  await xanoCreateJob({
    job_id,
    status: "processing",
    pdf_url,
    created_at: new Date(),
    updated_at: new Date()
  });

  processJob(job_id, pdf_url, prompt_base);

  res.json({
    success: true,
    job_id,
    status: "processing"
  });
});

app.get("/ocr/status/:job_id", async (req, res) => {
  const job = await xanoGetJob(req.params.job_id);
  if (!job || !job.job_id) {
    return res.status(404).json({ error: "Job não encontrado" });
  }
  res.json(job);
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

/* ================= START ================= */

app.listen(3000, () => {
  console.log("✅ OCR + GPT + Xano (job async robusto) rodando");
});
