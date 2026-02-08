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
const { createJob, setJobResult, setJobError, getJob } = require("./jobs");

const app = express();
app.use(express.json());

/* ================= CONFIG ================= */

const MAX_ASYNC_PAGES = 20;
const JOB_TIMEOUT = 3 * 60 * 1000;
const TMP_DIR = path.join(__dirname, "tmp");

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

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

function buildPagesFromAdobe(json) {
  const pagesMap = {};

  for (const el of json.elements) {
    const page = el.Page || el.PageNumber || 1;
    if (!pagesMap[page]) pagesMap[page] = [];

    if (el.Text) pagesMap[page].push(el.Text);

    if (el.Type === "Table" && el.Rows) {
      pagesMap[page].push("[TABELA]");
      for (const row of el.Rows) {
        pagesMap[page].push(
          row.Cells
            .map(c => (c.Text || "").replace(/\n/g, " ").trim())
            .join(" | ")
        );
      }
      pagesMap[page].push("[/TABELA]");
    }
  }

  return Object.keys(pagesMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(page => ({
      page: Number(page),
      text: pagesMap[page].join("\n")
    }));
}

function splitTextIntoPages(text) {
  return text
    .split("\f")
    .map((t, i) => ({
      page: i + 1,
      text: t.trim()
    }))
    .filter(p => p.text.length > 0);
}

/* ================= ROUTES ================= */

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.post("/ocr", async (req, res) => {
  const id = crypto.randomUUID();
  const inputPath = path.join(TMP_DIR, `${id}.pdf`);
  let readStream;

  try {
    const { pdf_url } = req.body;
    if (!pdf_url) {
      return res.status(400).json({ error: "pdf_url é obrigatório" });
    }

    /* -------- DOWNLOAD -------- */

    const buffer = Buffer.from(await (await fetch(pdf_url)).arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    const pagesCount = await getPdfPageCount(inputPath);

    /* -------- ADOBE ASYNC -------- */

    if (pagesCount > 10) {
      const jobId = createJob();

      res.json({
        success: false,
        provider: "adobe",
        status: "processing",
        job_id: jobId,
        total_pages: pagesCount
      });

      (async () => {
        try {
          await processAdobeAsync(jobId, inputPath);
        } catch (e) {
          setJobError(jobId, e.message);
        }
      })();

      return;
    }

    /* -------- ADOBE SYNC -------- */

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
        elementsToExtract: [ExtractElementType.TEXT]
      });

      const job = new ExtractPDFJob({ inputAsset, params });
      const pollingURL = await pdfServices.submit({ job });

      const result = await pdfServices.getJobResult({
        pollingURL,
        resultType: ExtractPDFResult
      });

      const asset = result.result.resource;
      const streamAsset = await pdfServices.getContent({ asset });

      const zipPath = path.join(TMP_DIR, `${id}.zip`);
      await new Promise(resolve =>
        streamAsset.readStream
          .pipe(fs.createWriteStream(zipPath))
          .on("finish", resolve)
      );

      const zip = new AdmZip(zipPath);
      const json = JSON.parse(zip.readAsText("structuredData.json"));
      const pages = buildPagesFromAdobe(json);

      return res.json({
        success: true,
        provider: "adobe",
        total_pages: pages.length,
        pages
      });

    } catch (adobeErr) {
      if (
        adobeErr?._statusCode !== 429 &&
        adobeErr?._errorCode !== "QUOTA_EXCEEDED"
      ) {
        throw adobeErr;
      }
    }

    /* -------- FALLBACK DIGITAL -------- */

    if (await hasDigitalText(inputPath)) {
      const text = await extractTextDirect(inputPath);
      const pages = splitTextIntoPages(text);

      return res.json({
        success: true,
        provider: "direct",
        total_pages: pages.length,
        pages
      });
    }

    /* -------- OCR TESSERACT ASYNC -------- */

    if (pagesCount > MAX_ASYNC_PAGES) {
      return res.json({
        success: false,
        provider: "tesseract",
        reason: "PAGE_LIMIT_EXCEEDED",
        total_pages: pagesCount,
        max_allowed: MAX_ASYNC_PAGES
      });
    }

    const jobId = createJob();

    res.json({
      success: false,
      provider: "tesseract",
      status: "processing",
      job_id: jobId,
      total_pages: pagesCount
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
        const pages = splitTextIntoPages(text);

        finished = true;
        clearTimeout(timer);

        setJobResult(jobId, {
          success: true,
          provider: "tesseract",
          total_pages: pages.length,
          pages
        });
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
  }
});

/* ================= ADOBE ASYNC ================= */

async function processAdobeAsync(jobId, inputPath) {
  const credentials = new ServicePrincipalCredentials({
    clientId: process.env.PDF_SERVICES_CLIENT_ID,
    clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET
  });

  const pdfServices = new PDFServices({ credentials });
  const readStream = fs.createReadStream(inputPath);

  const inputAsset = await pdfServices.upload({
    readStream,
    mimeType: MimeType.PDF
  });

  const params = new ExtractPDFParams({
    elementsToExtract: [ExtractElementType.TEXT]
  });

  const job = new ExtractPDFJob({ inputAsset, params });
  const pollingURL = await pdfServices.submit({ job });

  const result = await pdfServices.getJobResult({
    pollingURL,
    resultType: ExtractPDFResult
  });

  const asset = result.result.resource;
  const streamAsset = await pdfServices.getContent({ asset });

  const zipPath = path.join(TMP_DIR, `${jobId}.zip`);
  await new Promise(resolve =>
    streamAsset.readStream
      .pipe(fs.createWriteStream(zipPath))
      .on("finish", resolve)
  );

  const zip = new AdmZip(zipPath);
  const json = JSON.parse(zip.readAsText("structuredData.json"));
  const pages = buildPagesFromAdobe(json);

  setJobResult(jobId, {
    success: true,
    provider: "adobe",
    total_pages: pages.length,
    pages
  });
}

/* ================= STATUS ================= */

app.get("/ocr/status/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job não encontrado" });
  res.json(job);
});

/* ================= START ================= */

app.listen(3000, () => {
  console.log("✅ OCR API rodando — retorno por página");
});
