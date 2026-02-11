const fs = require("fs");
const path = require("path");

function ensureGoogleCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) {
    throw new Error("Credenciais do Google não configuradas");
  }

  const credPath = path.join("/tmp", "google-sa.json");
  fs.writeFileSync(credPath, json);

  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

module.exports = { ensureGoogleCredentials };
