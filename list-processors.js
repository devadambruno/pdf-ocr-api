require("dotenv").config();
const { DocumentProcessorServiceClient } =
  require("@google-cloud/documentai").v1;

const client = new DocumentProcessorServiceClient({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

async function list() {
  const parent = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}`;
  const [processors] = await client.listProcessors({ parent });

  console.log("PROCESSORS ENCONTRADOS:");
  processors.forEach(p => {
    console.log("➡", p.name);
  });
}

list().catch(console.error);
