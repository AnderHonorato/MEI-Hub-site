const cfg = require('./configuracao');
const { adicionarDias, anoMesDia } = require('./utilidades');

async function asaasFetch(path, options = {}) {
  if (!cfg.asaasApiKey) {
    const err = new Error('ASAAS_API_KEY não configurada. Defina no .env ou use PAYMENT_MOCK=true para testar local.');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${cfg.asaasBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': cfg.asaasApiKey,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data?.errors?.[0]?.description || data?.message || `Erro Asaas ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function createCheckout({ user, company, subscriptionId }) {
  const trialDueDate = anoMesDia(adicionarDias(new Date(), cfg.trialDays));
  const payload = {
    externalReference: subscriptionId,
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 60,
    customerData: {
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpfCnpj || company.cnpj || undefined,
      phone: user.phone || undefined
    },
    items: [{
      name: cfg.planName,
      description: `Assinatura mensal do ${cfg.planName} com ${cfg.trialDays} dias de teste antes da primeira cobrança.`,
      value: cfg.planPrice,
      quantity: 1
    }],
    subscription: {
      cycle: 'MONTHLY',
      nextDueDate: `${trialDueDate}T03:00:00+0000`
    },
    callback: {
      successUrl: `${cfg.appUrl}/?checkout=success`,
      cancelUrl: `${cfg.appUrl}/?checkout=cancel`,
      expiredUrl: `${cfg.appUrl}/?checkout=expired`
    }
  };
  const data = await asaasFetch('/v3/checkouts', { method: 'POST', body: JSON.stringify(payload) });
  return {
    provider: 'asaas',
    providerCheckoutId: data.id || data.checkoutId || data.object || '',
    checkoutUrl: data.url || data.checkoutUrl || data.paymentUrl || data.link || '',
    raw: data
  };
}

async function createPaymentLink({ user, company, subscriptionId }) {
  const payload = {
    billingType: 'CREDIT_CARD',
    chargeType: 'RECURRENT',
    name: cfg.planName,
    description: `Assinatura mensal do ${cfg.planName}. Cliente: ${user.email}.`,
    value: cfg.planPrice,
    subscriptionCycle: 'MONTHLY',
    externalReference: subscriptionId,
    notificationEnabled: true
  };
  const data = await asaasFetch('/v3/paymentLinks', { method: 'POST', body: JSON.stringify(payload) });
  return {
    provider: 'asaas',
    providerCheckoutId: data.id || '',
    checkoutUrl: data.url || data.paymentUrl || '',
    raw: data
  };
}

module.exports = { asaasFetch, createCheckout, createPaymentLink };
