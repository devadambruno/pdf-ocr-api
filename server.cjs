require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const AdmZip = require("adm-zip");

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
const { createJob, setJobResult, setJobError, getJob } = require("./jobs");

const app = express();
app.use(express.json());

/* ================= CONFIG ================= */

const MAX_ASYNC_PAGES = 20;
const JOB_TIMEOUT = 3 * 60 * 1000;

/* ================= MIDDLEWARE ================= */

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
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

async function getPdfPageCount(pdfPath) {
  const out = await execAsync(`pdfinfo "${pdfPath}"`);
  const match = out.match(/Pages:\s+(\d+)/);
  if (!match) throw new Error("Não foi possível contar páginas");
  return parseInt(match[1], 10);
}

async function hasDigitalText(pdfPath) {
  const text = await execAsync(`pdftotext "${pdfPath}" - -f 1 -l 1`);
  return text.trim().length > 50;
}

async function extractTextDirect(pdfPath) {
  return await execAsync(`pdftotext "${pdfPath}" -`);
}

/* ================= ROUTES ================= */

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.post("/ocr", async (req, res) => {
  let readStream;
  const inputPath = path.join(__dirname, "input.pdf");

  try {
    const { pdf_url } = req.body;
    if (!pdf_url) {
      return res.status(400).json({ error: "pdf_url é obrigatório" });
    }

    /* -------- DOWNLOAD -------- */

    const buffer = Buffer.from(
      await (await fetch(pdf_url)).arrayBuffer()
    );
    fs.writeFileSync(inputPath, buffer);

    const pages = await getPdfPageCount(inputPath);



    /* -------- ADOBE OCR -------- */

    try {
      const credentials = new ServicePrincipalCredentials({
        clientId: process.env.PDF_SERVICES_CLIENT_ID,
        clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET
      });

      const pdfServices = new PDFServices({ credentials });

      readStream = fs.createReadStream(inputPath);

      const inputAsset = await pdfServices.upload({
        readStream,
        mimeType: MimeType.PDF
      });

      const params = new ExtractPDFParams({
        elementsToExtract: [
          ExtractElementType.TEXT,
          ExtractElementType.TABLES
        ]
            });

      const job = new ExtractPDFJob({ inputAsset, params });

      const pollingURL = await pdfServices.submit({ job });
      const result = await pdfServices.getJobResult({
        pollingURL,
        resultType: ExtractPDFResult
      });

      const asset = result.result.resource;
      const streamAsset = await pdfServices.getContent({ asset });

      const zipPath = path.join(__dirname, "result.zip");
      await new Promise(resolve =>
        streamAsset.readStream
          .pipe(fs.createWriteStream(zipPath))
          .on("finish", resolve)
      );

      const zip = new AdmZip(zipPath);
      const json = JSON.parse(zip.readAsText("structuredData.json"));

      let output = "";

        for (const el of json.elements) {
          // TEXTO NORMAL
          if (el.Text) {
            output += el.Text + "\n";
          }

          // TABELAS
          if (el.Type === "Table" && el.Rows) {
            output += "\n[TABELA]\n";

            for (const row of el.Rows) {
              const line = row.Cells
                .map(c => (c.Text || "").replace(/\n/g, " ").trim())
                .join(" | ");

              output += line + "\n";
            }

            output += "[/TABELA]\n\n";
          }
        }


      return res.json({
      success: true,
      provider: "adobe",
      pages: json.pages?.length || null,
      text: output
    });


    } catch (adobeErr) {
      if (
        adobeErr?._statusCode !== 429 &&
        adobeErr?._errorCode !== "QUOTA_EXCEEDED"
      ) {
        throw adobeErr;
      }
    }


   /* -------- FALLBACK PDF DIGITAL -------- */

if (await hasDigitalText(inputPath)) {
  console.log("🔁 Adobe indisponível, usando extração direta");

  const text = await extractTextDirect(inputPath);

  return res.json({
    success: true,
    provider: "direct",
    pages,
    text
  });
}


    /* -------- OCR GRATUITO (ASYNC) -------- */

    if (pages > MAX_ASYNC_PAGES) {
      return res.json({
        success: false,
        provider: "async",
        reason: "PAGE_LIMIT_EXCEEDED",
        pages,
        max_allowed: MAX_ASYNC_PAGES
      });
    }

    const jobId = createJob();

    res.json({
      success: false,
      provider: "async",
      status: "processing",
      job_id: jobId
    });

    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        setJobError(jobId, "OCR excedeu tempo máximo");
      }
    }, JOB_TIMEOUT);

    (async () => {
      try {
        const text = await ocrWithTesseract(inputPath);
        finished = true;
        clearTimeout(timer);
        setJobResult(jobId, text);
      } catch (e) {
        finished = true;
        clearTimeout(timer);
        setJobError(jobId, e.message);
      }
    })();

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    readStream?.destroy();
    // ⚠️ NÃO apagar input.pdf aqui enquanto estiver testando síncrono
  }
});

/* ================= STATUS ================= */

app.get("/ocr/status/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job não encontrado" });
  res.json(job);
});

app.listen(3000, () => {
  console.log("✅ OCR API rodando (modo teste síncrono para PDF digital)");
});
