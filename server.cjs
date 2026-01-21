require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const { ocrWithTesseract } = require("./ocr-tesseract.cjs");
const {
  createJob,
  setJobResult,
  setJobError,
  getJob
} = require("./jobs");

const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult
} = require("@adobe/pdfservices-node-sdk");

const app = express();
app.use(express.json());

// 🔐 API KEY
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

// ======================================================
// POST /ocr  → tenta Adobe, senão cria job assíncrono
// ======================================================
app.post("/ocr", async (req, res) => {
  const { pdf_url } = req.body;
  if (!pdf_url) {
    return res.status(400).json({ error: "pdf_url é obrigatório" });
  }

  try {
    console.log("🔵 Tentando Adobe OCR");

    const pdfBuffer = Buffer.from(
      await (await fetch(pdf_url)).arrayBuffer()
    );

    const inputPath = path.join(__dirname, "input-sync.pdf");
    fs.writeFileSync(inputPath, pdfBuffer);

    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.PDF_SERVICES_CLIENT_ID,
      clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET
    });

    const pdfServices = new PDFServices({ credentials });

    const inputAsset = await pdfServices.upload({
      readStream: fs.createReadStream(inputPath),
      mimeType: MimeType.PDF
    });

    const job = new ExtractPDFJob({
      inputAsset,
      params: new ExtractPDFParams({
        elementsToExtract: [ExtractElementType.TEXT]
      })
    });

    const pollingURL = await pdfServices.submit({ job });

    const result = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult
    });

    const content = await pdfServices.getContent({
      asset: result.result.resource
    });

    const zipPath = path.join(__dirname, "result.zip");
    await new Promise(r =>
      content.readStream
        .pipe(fs.createWriteStream(zipPath))
        .on("finish", r)
    );

    const zip = new AdmZip(zipPath);
    const data = JSON.parse(zip.readAsText("structuredData.json"));

    const text = data.elements
      .filter(e => e.Text)
      .map(e => e.Text)
      .join("\n");

    return res.json({
      success: true,
      provider: "adobe",
      text
    });

  } catch (err) {
    console.warn("🟠 Adobe falhou → async");

    const jobId = createJob();

    (async () => {
      try {
        const buffer = Buffer.from(
          await (await fetch(pdf_url)).arrayBuffer()
        );

        const inputPath = path.join(__dirname, `input-${jobId}.pdf`);
        fs.writeFileSync(inputPath, buffer);

        const text = await ocrWithTesseract(inputPath);
        setJobResult(jobId, text);
        fs.unlinkSync(inputPath);

      } catch (e) {
        setJobError(jobId, e.message);
      }
    })();

    return res.json({
      success: false,
      provider: "async",
      status: "processing",
      job_id: jobId
    });
  }
});

// =================================
// GET /ocr/status/:job_id
// =================================
app.get("/ocr/status/:job_id", (req, res) => {
  const job = getJob(req.params.job_id);

  if (!job) {
    return res.status(404).json({ error: "Job não encontrado" });
  }

  return res.json(job);
});

app.listen(3000, () =>
  console.log("✅ OCR API (Adobe + Async) rodando na porta 3000")
);
