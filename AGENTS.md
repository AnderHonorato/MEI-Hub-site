# AGENTS.md — MEI no Controle

SaaS full-stack para controle de faturamento, DAS, obrigações fiscais e assinatura de MEIs brasileiros.

## Stack

- **Runtime:** Node.js >= 18.18.0 (usa `fetch`, `crypto.randomUUID`, `crypto.timingSafeEqual`)
- **Servidor:** `http` nativo (sem Express)
- **Banco:** JSON file (`data/database.json`) com escrita atômica via `.tmp` + rename
- **Frontend:** Vanilla JS SPA (sem React/Vue), CSS puro com variáveis
- **Dependências:** **ZERO** (runtime + dev)
- **Testes:** `node:test` + `node:assert/strict`
- **Gateway:** Asaas (pagamentos brasileiros)

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia servidor em produção (porta 3000) |
| `npm run dev` | Inicia com `NODE_ENV=development` |
| `npm test` | Roda testes de integração (`node --test tests/*.test.js`) |
| `npm run seed` | Re-cria usuários base (owner, suporte, moderação) |

## Estrutura

```
src/
  server.js    — Servidor HTTP + rotas API + lógica de negócio (872 linhas)
  db.js        — Camada de banco JSON (163 linhas)
  auth.js      — PBKDF2, JWT custom, RBAC (73 linhas)
  asaas.js     — Integração com gateway Asaas (88 linhas)
  config.js    — Configuração via .env (38 linhas)
  utils.js     — Funções utilitárias puras (24 linhas)
  seed.js      — Seed de usuários base (7 linhas)
public/
  index.html   — Shell SPA
  app.js       — SPA vanilla (438 linhas)
  style.css    — CSS completo com variáveis
tests/
  api.test.js  — Teste de integração do fluxo principal (181 linhas)
```

## Arquitetura

### Autenticação
- Senhas: PBKDF2 120k iterações SHA-256, salt aleatório por hash
- Token: JWT custom HMAC-SHA256, expiração 12h
- Permissões: RBAC com 4 papéis (owner, support, moderator, customer)
- Owner tem `['*']`, support acessa tickets SUP, moderator acessa tickets MOD, customer vê seus próprios dados

### Banco de Dados
- Arquivo JSON único com 16 coleções (users, companies, subscriptions, payments, launches, obligations, notifications, tickets, messages, ticketFeedbacks, teamConversations, teamMessages, legalAcceptances, cookieConsents, auditLogs, meta)
- `readDb()` garante que usuários seed existam sempre
- `withDb(fn)` para operações atômicas read-modify-write

### Fluxo de Pagamento
1. Cliente registra → subscription `pending_checkout`
2. Inicia trial → mock (`PAYMENT_MOCK=true`) ou checkout Asaas
3. Webhook Asaas confirma pagamento → status `active`
4. `refreshSubscriptionStatus()` chamado em toda requisição autenticada

### Tickets/Suporte
- Protocolos: `SUP-YYYYMMDD-NNNNN` (suporte), `MOD-YYYYMMDD-NNNNN` (moderação)
- Bloqueio: um ticket só pode ter um atendente por vez
- Fila: estimativa de espera com detecção de urgência por keyword
- Feedback: 1-5 estrelas após fechamento, vinculado ao atendente

## Convenções de Código

- **Idioma:** Português (pt-BR) para strings, mensagens e labels
- **Estilo:** sem ponto-e-vírgula, arrow functions, template literals para HTML
- **IDs:** prefixados por tipo (`usr_`, `cmp_`, `sub_`, `tck_`, `msg_`, etc.)
- **Nomenclatura:** camelCase, booleanos com prefixo `is`/`can`/`has`
- **Segurança:** `timingSafeEqual` para toda comparação sensível, `safeString()` para inputs, `escapeHtml()` no frontend
- **Validação:** early returns com `fail(res, 400, ...)`

## Testes

- Um único teste de integração (`fluxo principal`) com ~34 assertions
- Cobre: auth, registro, trial, dashboard, lançamentos, tickets, mensagens, feedback, time chat, admin
- Usa servidor em porta aleatória e banco temporário
- NÃO cobre: Asaas real, upload de arquivos, renderização CSS

## Configuração (.env)

| Chave | Padrão | Uso |
|-------|--------|-----|
| `PORT` | 3000 | Porta do servidor |
| `JWT_SECRET` | (dev) | Chave de assinatura HMAC |
| `PAYMENT_MOCK` | true | Mock do gateway Asaas |
| `ASAAS_API_KEY` | — | Chave API Asaas |
| `ASAAS_BASE_URL` | sandbox | URL base Asaas |
| `ASAAS_WEBHOOK_TOKEN` | (dev) | Token de autenticação do webhook |
| `APP_URL` | localhost:3000 | URL pública para callbacks |
| `TRIAL_DAYS` | 7 | Dias de trial gratuito |
