# Roadmap de completude do ecossistema PBX

Atualizado após a segunda onda de implementação (todos os itens pendentes com código mínimo viável).

## Legenda

| Estado | Significado |
|--------|-------------|
| Done | Implementado; testável com config |
| Parcial | Código + dependência externa (PBX, deploy, Issabel) |
| Pendente | Fora de escopo ou só operação |

---

## 1. Portal multitenant

| Item | Estado |
|------|--------|
| Auth, orgs, roles | Done |
| CDR por org | Parcial — banner demo se sem `cdr_mysql` |
| Testes unitários | Done |
| E2E Playwright | Parcial — `e2e/smoke.spec.ts` (login smoke) |

---

## 2. Issabel / PBX

| Item | Estado |
|------|--------|
| Sync troncos/DIDs | Parcial |
| AMI TCP (QueueSummary, Originate, MailboxCount) | Done — portal `ami-ping` + PBX `portal_ami_test.php` |
| queue_log KPIs | Done |
| Apply dialplan automático | Done — fila + cron portal + `issabel_one/api/portal_apply_bundle.php` |
| MOH no Asterisk | Parcial — aviso na UI hold-group |
| Voicemail MWI | Parcial — `GET .../voicemail/mailboxes` via AMI |

**Config AMI na org** (`issabel_pbx_api` JSON):

```json
{
  "baseUrl": "https://pbx.example.com/pbxapi",
  "username": "admin",
  "password": "***",
  "amiHost": "pbx.example.com",
  "amiPort": 5038,
  "amiUser": "admin",
  "amiSecret": "***",
  "applyWebhookUrl": "https://pbx.example.com/portal-apply-hook",
  "applyWebhookSecret": "secret"
}
```

---

## 3. Hotelaria

| Item | Estado |
|------|--------|
| Inventário, check-in/out, logs, cron | Done |
| WhatsApp boas-vindas | Pendente |

---

## 4. LensLead

| Item | Estado |
|------|--------|
| Pull sync + cron | Done |
| Webhook inbound | Done — `POST /webhooks/lenslead/inbound` |
| Click-to-call | Done — AMI Originate + botão no screen-pop |
| Deploy Edge | Parcial — ver [lenslead-deploy.md](./lenslead-deploy.md) |

---

## 5. IA no portal

| Item | Estado |
|------|--------|
| AI Agents (CRUD prompts) | Done |
| URA modo IA + voz (PBX) | Done — aba IA, sync `ia_ura_context` via apply |
| Lista agentes Issabel | Done — `GET .../issabel/ia-agents` + `portal_list_ia_agents.php` |
| Runtime voz / chamada ao vivo | Parcial — no PBX (`ia_ura`) |

---

## 6. Softphone Flutter

| Item | Estado |
|------|--------|
| Provision + deep link | Done |
| Login JWT portal | Done — `/auth/softphone-login`, ecrã `/portal-login` |
| Push E2E | Parcial — README |

---

## 6. Billing, campanhas, webhooks

| Item | Estado |
|------|--------|
| MRR platform admin | Done |
| Billing por org | Done — `GET /organizations/:id/billing-summary` |
| Webhooks entrega | Done — dispatcher + cron 5 min |
| Campanhas ↔ discador | Parcial — `externalDiscadorId` + `POST /campaigns/:id/sync-discador` |

---

## Crons Vercel

| Path | Schedule |
|------|----------|
| `/api/cron/sync-lenslead` | */15 |
| `/api/cron/hotel-auto-checkout` | hourly |
| `/api/cron/dispatch-webhooks` | */5 |
| `/api/cron/issabel-apply-jobs` | */10 |

---

## Comandos

```bash
npm run build
npm run test
npx playwright test --config e2e/playwright.config.ts   # com apps/web a correr
```
