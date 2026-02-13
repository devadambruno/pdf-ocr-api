require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const { processJob } = require("./worker/processJob");

const app = express();
app.use(express.json());

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

/* ================= ROUTES ================= */

app.post("/ocr/parse", async (req, res) => {
  const {
    pdf_url,
    protocolo_id, // 🔥 NOVO CAMPO
    json_tipos_certidao,
    json_nivel_atividade,
    json_qualificacao_obra,
    json_qualificacao_especifica,
    json_unidades
  } = req.body;

  if (!pdf_url) {
    return res.status(400).json({ error: "pdf_url obrigatório" });
  }

  if (!protocolo_id) {
    return res.status(400).json({ error: "protocolo_id obrigatório" });
  }

  const job_id = crypto.randomUUID();

  // 🔥 AGORA SALVA O protocolo_id
  await xanoCreateJob({
    job_id,
    protocolo_id, // 👈 salva vínculo
    status: "processing",
    pdf_url,
    created_at: new Date(),
    updated_at: new Date()
  });

  // 🔥 Worker async
  (async () => {
    try {
      const result = await processJob({
        job_id,
        pdf_url,
        depara: {
          tipoCertidao: json_tipos_certidao,
          nivelAtividade: json_nivel_atividade,
          qualificacaoObra: json_qualificacao_obra,
          qualificacaoEspecifica: json_qualificacao_especifica,
          unidades: json_unidades
        }
      });

      await xanoUpdateJob(job_id, {
        status: "done",
        resultado: result,
        updated_at: new Date()
      });

    } catch (e) {
      await xanoUpdateJob(job_id, {
        status: "error",
        error: e.message,
        updated_at: new Date()
      });
    }
  })();

  res.json({ success: true, job_id, protocolo_id });
});


app.get("/ocr/status/:job_id", async (req, res) => {
  const job = await xanoGetJob(req.params.job_id);
  if (!job) return res.status(404).json({ error: "Job não encontrado" });
  res.json(job);
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(3000, () => {
  console.log("✅ OCR DocumentAI + De/Para + Xano rodando");
});
