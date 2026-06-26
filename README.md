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
- PostgreSQL (local, Docker ou [Neon](https://neon.tech) serverless gratuito).
- Dependencias gerenciadas via npm.

## Como rodar localmente

### 1. Configurar o banco de dados

**Opcao A — Neon (recomendado, sem instalacao):**

1. Crie uma conta gratuita em https://console.neon.tech
2. Crie um projeto e copie a **connection string**
3. Cole no `.env` como `DATABASE_URL`

**Opcao B — Docker:**

```bash
docker compose up -d
```

**Opcao C — Instalacao local:**

Instale o PostgreSQL 16+ e crie o banco `mei_no_controle`.

### 2. Configurar e rodar

```bash
cp .env.example .env
# Edite .env e ajuste DATABASE_URL com sua connection string

# Rode a migration inicial
npx prisma migrate dev --name inicial

# Se tiver dados antigos no JSON, migre-os:
npm run migrate-json

# Inicie o servidor
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
# Certifique-se de que o PostgreSQL está rodando e que a migration foi aplicada:
npx prisma migrate dev --name inicial

# Execute os testes
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
  servidor.js
  banco.js
  autenticacao.js
  asaas.js
  configuracao.js
  utilidades.js
  semente.js
  prisma.js
  migrarJsonParaPostgres.js
prisma/
  schema.prisma
  migrations/
tests/
  api.test.js
uploads/
  imagens enviadas por clientes/equipe
```

## Banco de dados

O projeto usa **PostgreSQL** via **Prisma ORM**. O schema define 17 modelos mapeados para as coleções originais do JSON.

### Migração de dados antigos

Se você tem um arquivo `data/database.json` com dados, execute:

```bash
npm run migrate-json
```

Isso insere todos os registros do JSON no PostgreSQL.

### Variaveis de ambiente do banco

| Chave | Padrao | Uso |
|-------|--------|-----|
| `DATABASE_URL` | `postgresql://usuario:senha@localhost:5432/mei_no_controle?schema=public` | Conexao PostgreSQL (local, Docker ou Neon) |

## Configuracao de e-mail (SMTP)

Para habilitar verificacao de e-mail e recuperacao de senha, configure as variaveis SMTP:

| Chave | Padrao | Uso |
|-------|--------|-----|
| `SMTP_HOST` | `smtp.seudominio.com.br` | Servidor SMTP |
| `SMTP_PORT` | `587` | Porta SMTP |
| `SMTP_USER` | `naoresponda@seudominio.com.br` | Usuario SMTP |
| `SMTP_PASS` | (vazio) | Senha SMTP |
| `SMTP_FROM` | `"MEI no Controle <naoresponda@...>"` | Remetente |

Se `SMTP_PASS` estiver vazio, os e-mails sao logados no console (modo dev) e o e-mail e verificado automaticamente no cadastro.

## Funcionalidades de seguranca

- **Verificacao de e-mail**: codigo de 6 digitos enviado no cadastro
- **Limite de tentativas**: 5 erros de senha bloqueiam a conta por 15 minutos
- **Recuperacao de senha**: fluxo com codigo enviado por e-mail
- **Autenticacao de dois fatores (2FA)**: compatível com Google Authenticator (TOTP RFC 6238), com QR code e 10 codigos de backup

## Publicação em servidor

Exemplo em VPS:

```bash
git clone seu-repositorio
cd mei-no-controle-real
cp .env.example .env
nano .env
# Configure DATABASE_URL, JWT_SECRET e demais variáveis
npm install
npx prisma migrate deploy
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
