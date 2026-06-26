const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const root = process.cwd();
const config = {
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-before-production-123456789',
  dataFile: path.resolve(root, process.env.DATA_FILE || './data/database.json'),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || './uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
  paymentMock: String(process.env.PAYMENT_MOCK || 'true').toLowerCase() === 'true',
  asaasApiKey: process.env.ASAAS_API_KEY || '',
  asaasBaseUrl: (process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api').replace(/\/$/, ''),
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN || 'dev-webhook-token',
  planPrice: Number(process.env.PLAN_PRICE || 24.90),
  planName: process.env.PLAN_NAME || 'Plano Pro MEI no Controle',
  trialDays: Number(process.env.TRIAL_DAYS || 7),
};

module.exports = config;
