require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
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

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.path === "/health") return next();

  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
});


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/ocr", async (req, res) => {
  let readStream;

  try {
    const { pdf_url } = req.body;
    if (!pdf_url) {
      return res.status(400).json({ error: "pdf_url é obrigatório" });
    }

    console.log("📥 Baixando PDF...");
    const response = await fetch(pdf_url);
    if (!response.ok) throw new Error("Erro ao baixar PDF");

    const buffer = Buffer.from(await response.arrayBuffer());
    const inputPath = path.join(__dirname, "input.pdf");
    fs.writeFileSync(inputPath, buffer);

    // Credenciais
    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.PDF_SERVICES_CLIENT_ID,
      clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET
    });

    const pdfServices = new PDFServices({ credentials });

    // Upload
    readStream = fs.createReadStream(inputPath);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.PDF
    });

    // 🔥 Extract com OCR automático
    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT]
    });

    const job = new ExtractPDFJob({ inputAsset, params });

    const pollingURL = await pdfServices.submit({ job });
    const result = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult
    });

    const resultAsset = result.result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Salvar ZIP
    const zipPath = path.join(__dirname, "result.zip");
    const writeStream = fs.createWriteStream(zipPath);
    await new Promise(resolve =>
      streamAsset.readStream.pipe(writeStream).on("finish", resolve)
    );

    // Extrair TEXTO
    const zip = new AdmZip(zipPath);
    const jsondata = zip.readAsText("structuredData.json");
    const data = JSON.parse(jsondata);

    const text = data.elements
      .filter(e => e.Text)
      .map(e => e.Text)
      .join("\n");

    res.json({
      success: true,
      pages: data.pages?.length || null,
      text
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    readStream?.destroy();
  }
});

app.listen(3000, () => {
  console.log("✅ Adobe Extract + OCR API rodando na porta 3000");
});
