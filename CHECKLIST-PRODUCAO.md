# Checklist antes de colocar online

- [ ] Trocar `JWT_SECRET` por uma chave longa e exclusiva.
- [ ] Trocar `ASAAS_WEBHOOK_TOKEN`.
- [ ] Definir `PAYMENT_MOCK=false`.
- [ ] Informar `ASAAS_API_KEY` real ou sandbox.
- [ ] Configurar `APP_URL` com domínio HTTPS.
- [ ] Configurar webhook no Asaas.
- [ ] Testar checkout em sandbox.
- [ ] Trocar senhas dos usuários iniciais.
- [ ] Criar e-mail real para suporte e privacidade.
- [ ] Ativar HTTPS no servidor.
- [ ] Configurar backup de `data/database.json` e pasta `uploads`.
- [ ] Revisar Termos de Uso e Política de Privacidade com um profissional antes de publicar comercialmente.
- [ ] Migrar para PostgreSQL/MySQL se o volume de clientes crescer.
