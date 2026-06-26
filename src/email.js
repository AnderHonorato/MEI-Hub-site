const nodemailer = require('nodemailer');
const cfg = require('./configuracao');

const transportador = cfg.smtpPass
  ? nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpPort === 465,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    })
  : null;

async function enviarEmail(destinatario, assunto, html) {
  if (!transportador) {
    console.log(`[EMAIL MOCK] Para: ${destinatario} | Assunto: ${assunto}`);
    return;
  }
  await transportador.sendMail({ from: cfg.smtpFrom, to: destinatario, subject: assunto, html });
}

module.exports = { enviarEmail, transportador };
