const fs = require('fs');
const prisma = require('./prisma');

async function migrar() {
  const db = JSON.parse(fs.readFileSync('./data/database.json', 'utf8'));

  if (db.users?.length) {
    await prisma.user.createMany({ data: db.users, skipDuplicates: true });
  }
  if (db.companies?.length) {
    await prisma.company.createMany({ data: db.companies, skipDuplicates: true });
  }
  if (db.subscriptions?.length) {
    await prisma.subscription.createMany({ data: db.subscriptions, skipDuplicates: true });
  }
  if (db.payments?.length) {
    await prisma.payment.createMany({ data: db.payments, skipDuplicates: true });
  }
  if (db.launches?.length) {
    await prisma.launch.createMany({ data: db.launches, skipDuplicates: true });
  }
  if (db.obligations?.length) {
    await prisma.obligation.createMany({ data: db.obligations, skipDuplicates: true });
  }
  if (db.notifications?.length) {
    await prisma.notification.createMany({ data: db.notifications, skipDuplicates: true });
  }
  if (db.tickets?.length) {
    await prisma.ticket.createMany({ data: db.tickets, skipDuplicates: true });
  }
  if (db.messages?.length) {
    await prisma.message.createMany({ data: db.messages, skipDuplicates: true });
  }
  if (db.ticketFeedbacks?.length) {
    await prisma.ticketFeedback.createMany({ data: db.ticketFeedbacks, skipDuplicates: true });
  }
  if (db.flaggedUsers?.length) {
    await prisma.flaggedUser.createMany({ data: db.flaggedUsers, skipDuplicates: true });
  }
  if (db.templates?.length) {
    await prisma.template.createMany({ data: db.templates, skipDuplicates: true });
  }
  if (db.teamConversations?.length) {
    await prisma.teamConversation.createMany({ data: db.teamConversations, skipDuplicates: true });
  }
  if (db.teamMessages?.length) {
    await prisma.teamMessage.createMany({ data: db.teamMessages, skipDuplicates: true });
  }
  if (db.legalAcceptances?.length) {
    await prisma.legalAcceptance.createMany({ data: db.legalAcceptances, skipDuplicates: true });
  }
  if (db.cookieConsents?.length) {
    await prisma.cookieConsent.createMany({ data: db.cookieConsents, skipDuplicates: true });
  }
  if (db.auditLogs?.length) {
    await prisma.auditLog.createMany({ data: db.auditLogs, skipDuplicates: true });
  }

  console.log('Migracao concluida.');
}

migrar().catch(console.error).finally(() => prisma.$disconnect());
