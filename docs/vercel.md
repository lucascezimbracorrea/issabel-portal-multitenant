# Deploy na Vercel (SPA + API)

O repositório está configurado para publicar **frontend e API no mesmo projeto Vercel**:

- **Web**: build Vite → `apps/web/dist`
- **API**: Hono em serverless Node (`api/[[...route]].ts`) em `/api/*`
- **MySQL**: base externa (obrigatória) — Vercel não hospeda MySQL

## 1. Criar projeto na Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Importe o repositório GitHub `issabel-portal-multitenant`
3. **Root Directory**: deixe `.` (raiz do monorepo)
4. A Vercel deve detectar `vercel.json` (build, output, rewrites). Não altere para “Vite” manualmente.

## 2. Variáveis de ambiente

Configure em **Settings → Environment Variables** (marque **Production** e **Preview**).

### API (obrigatórias)

| Variável | Exemplo | Notas |
|----------|---------|--------|
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | *(openssl rand -base64 48)* | Mín. 32 caracteres |
| `DB_HOST` | `xxx.mysql.database.azure.com` | MySQL acessível da internet |
| `DB_PORT` | `3306` | |
| `DB_USER` | `portal` | |
| `DB_PASSWORD` | `***` | |
| `DB_NAME` | `issabel_portal` | |
| `INTERNAL_TELEPHONY_TOKEN` | *(segredo longo)* | Webhooks internos |

### API (opcionais)

| Variável | Uso |
|----------|-----|
| `CORS_ORIGINS` | Só se o front estiver noutro domínio. Na mesma Vercel, `VERCEL_URL` é adicionado automaticamente. |
| `ISSABEL_CDR_MYSQL_JSON` | CDR global (JSON) |
| `ISSABEL_MYSQL_*` | Alternativa ao JSON de CDR |
| `AUDIO_FILES_DIR` | Por defeito `/tmp` na Vercel (efémero entre invocações) |
| `CRON_SECRET` | Protege `GET /api/cron/sync-lenslead` (header `Authorization: Bearer`) |
| `PORTAL_SYNC_SECRET` | Mesmo valor na Edge Function LensLead `portal-sync` |
| `LENSLEAD_FUNCTIONS_URL` | Base URL Supabase functions (ex. `https://xxx.supabase.co/functions/v1`) |
| `AMI_HOST`, `AMI_PORT`, `AMI_USER`, `AMI_SECRET` | Métricas de filas (fase 2, opcional) |
| `CREDENTIALS_ENCRYPTION_KEY` | Criptografia senhas SIP de hóspedes (hotelaria); min. 16 caracteres |

Crons adicionais: `dispatch-webhooks` (5 min), `issabel-apply-jobs` (10 min). Ver `vercel.json`.

### Web (build-time)

| Variável | Uso |
|----------|-----|
| `VITE_ISSABEL_BASE_URL` | URL do Issabel para deep links (ex. `https://pbx.cliente.com`) |
| `VITE_BASE` | Só se publicar num subpath (ex. `/console/`) |
| `VITE_API_URL` | Por defeito `/api` (mesma origem). Use URL absoluta só com API noutro host. |

## 3. Base de dados MySQL

Crie a base antes do primeiro deploy (ex.: [PlanetScale](https://planetscale.com), [Railway](https://railway.app), [Aiven](https://aiven.io), MySQL na cloud).

1. Crie database + utilizador com permissões DDL/DML
2. Preencha `DB_*` na Vercel
3. Após o primeiro deploy com sucesso, rode o seed **uma vez** (local ou CI), apontando para a mesma base:

```bash
cd apps/api
cp ../../.env.example .env   # preencha DB_* e JWT_SECRET iguais à Vercel
npm run db:seed
```

Na subida, a API executa `initSchema` (tabelas `CREATE IF NOT EXISTS`).

## 4. Deploy

```bash
git push origin main
```

Ou ligue o GitHub na Vercel para deploy automático.

## 5. Verificar

- `https://<seu-projeto>.vercel.app/api/health` → `{"ok":true}`
- Abra o site → login (utilizador criado no seed)
- Se login falhar: confira `JWT_SECRET`, `DB_*` e logs em **Vercel → Deployments → Functions**

## 6. Domínio customizado (white-label)

1. **Vercel** → Domains → adicione `portal.cliente.com`
2. Na organização, configure `custom_domain` no portal (Settings)
3. Se usar domínio próprio na Vercel, adicione `https://portal.cliente.com` em `CORS_ORIGINS` se necessário

## Limitações na Vercel

- **Upload de áudio**: ficheiros ficam em `/tmp` e **não persistem** entre invocações frias; para produção grave, use S3/R2 e `AUDIO_FILES_DIR` ou storage object.
- **MySQL**: use pool com limite baixo; a API já usa `mysql2` pool (10 conexões).
- **Issabel PBX API / CDR**: o servidor Issabel deve ser acessível **a partir da internet** (ou allowlist IPs da Vercel) para sync e relatórios.

## Desenvolvimento local (inalterado)

```bash
npm run dev
```

Web em `http://localhost:5173`, API em `http://localhost:8787`, proxy `/api` no Vite.
