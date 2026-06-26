# MEI no Controle — SaaS completo

Sistema full-stack para controle de faturamento, DAS, obrigações fiscais, assinatura mensal, suporte por protocolo, moderação de denúncias, LGPD e área administrativa.

## O que vem pronto

- Landing page pública responsiva.
- Cadastro e login com senha criptografada por PBKDF2.
- Token de sessão assinado com HMAC SHA-256.
- Usuários iniciais de equipe:
  - Founder/Owner: `owner@meinocontrole.local` / `Owner@123456!`
  - Suporte: `suporte@meinocontrole.local` / `Suporte@123456!`
  - Moderação: `moderacao@meinocontrole.local` / `Moderacao@123456!`
- Cargos e permissões:
  - `owner`: acesso administrativo completo.
  - `support`: atende apenas protocolos de suporte.
  - `moderator`: atende apenas denúncias/moderação.
  - `customer`: usa o painel MEI e abre protocolos.
- Cadastro de cliente com aceite dos termos.
- Trial de 7 dias e bloqueio de funcionalidades antes do checkout.
- Integração preparada com Asaas Checkout/Payment Link.
- Webhook Asaas para atualizar status de pagamento e assinatura.
- Painel MEI com faturamento, limite anual, lançamentos, obrigações, relatórios e comprovantes.
- Chat de suporte com protocolo `SUP-AAAAMMDD-00001`.
- Chat de moderação/denúncia com protocolo `MOD-AAAAMMDD-00001`.
- Bloqueio de atendimento: quando um suporte inicia, outro suporte não consegue entrar no mesmo protocolo.
- Encerramento de conversa: depois de finalizada, ninguém envia novas mensagens no protocolo.
- Upload de imagens em mensagens e comprovantes.
- Notificações internas de trial, cobrança e mensagens.
- Termos de uso, política de privacidade e cookies.
- Solicitação de exclusão de conta com regra para pagamento pendente.
- Testes automatizados de fluxo principal.

## Requisitos

- Node.js 18.18 ou superior.
- Nenhuma dependência externa obrigatória para rodar localmente.

## Como rodar localmente

```bash
cp .env.example .env
npm start
```

Abra:

```text
http://localhost:3000
```

Para testar com dados locais sem gateway real, mantenha no `.env`:

```env
PAYMENT_MOCK=true
```

## Como ativar pagamento real com Asaas

1. Crie uma conta no Asaas.
2. Gere sua chave de API no painel do Asaas.
3. Configure o `.env`:

```env
PAYMENT_MOCK=false
ASAAS_API_KEY=sua_chave_aqui
ASAAS_BASE_URL=https://sandbox.asaas.com/api
APP_URL=https://seudominio.com.br
ASAAS_WEBHOOK_TOKEN=um_token_secreto_grande
```

4. No painel do Asaas, configure o webhook apontando para:

```text
https://seudominio.com.br/api/webhooks/asaas?token=um_token_secreto_grande
```

5. Depois de testar no sandbox, altere `ASAAS_BASE_URL` para o ambiente de produção indicado pela sua conta/API Asaas.

## Importante sobre cartão

O sistema usa checkout/link seguro do gateway. O cliente informa o cartão no ambiente do gateway, e este sistema salva apenas identificadores técnicos de assinatura/cobrança. Não salve número completo de cartão no banco do projeto.

## Testes

```bash
npm test
```

O teste cobre:

- Login do owner.
- Cadastro de cliente.
- Bloqueio antes do trial.
- Início de trial.
- Criação de lançamento.
- Dashboard liberado.
- Abertura de protocolo de suporte.
- Início de atendimento pelo suporte.
- Mensagem no chat.
- Encerramento do protocolo.
- Bloqueio de nova mensagem após encerramento.

## Estrutura

```text
public/
  index.html
  style.css
  app.js
src/
  server.js
  db.js
  auth.js
  asaas.js
  config.js
  utils.js
  seed.js
tests/
  api.test.js
data/
  database.json gerado automaticamente
uploads/
  imagens enviadas por clientes/equipe
```

## Banco de dados

Esta versão usa arquivo JSON persistente para facilitar instalação em VPS simples. Para produção com muitos usuários, migre a camada `src/db.js` para PostgreSQL ou MySQL mantendo os mesmos modelos lógicos.

## Publicação em servidor

Exemplo em VPS:

```bash
git clone seu-repositorio
cd mei-no-controle-real
cp .env.example .env
nano .env
npm start
```

Para manter online, use PM2:

```bash
npm install -g pm2
pm2 start src/server.js --name mei-no-controle
pm2 save
pm2 startup
```

Configure Nginx/Apache como proxy reverso para a porta do Node e ative HTTPS antes de usar pagamento real.
