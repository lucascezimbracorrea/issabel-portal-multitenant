# Deploy LensLead → Portal

## 1. Edge Function `portal-sync`

No repositório LensLead (`lenslead-pro`):

```bash
cd lenslead-pro
supabase secrets set PORTAL_SYNC_SECRET=<mesmo valor do portal>
supabase functions deploy portal-sync
```

URL usada no portal: `LENSLEAD_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1`

## 2. Portal (Vercel / .env)

| Variável | Valor |
|----------|--------|
| `PORTAL_SYNC_SECRET` | Segredo partilhado com a Edge Function |
| `LENSLEAD_FUNCTIONS_URL` | Base das functions Supabase |
| `CRON_SECRET` | Bearer para `/api/cron/sync-lenslead` |

Por organização, em **Integrações → LensLead**: `lensleadUserId` (UUID do utilizador LensLead).

## 3. Webhook inbound (push)

LensLead pode enviar alterações em tempo real:

```http
POST /api/webhooks/lenslead/inbound
Authorization: Bearer <PORTAL_SYNC_SECRET>
Content-Type: application/json

{
  "organizationId": 1,
  "event": "lead.upsert",
  "lead": { "id": "...", "name": "...", "phone": "..." }
}
```

## 4. Validação

1. Guardar integração LensLead na org.
2. `POST /api/organizations/:id/integrations/lenslead/sync`
3. Verificar leads em `/integrations/lenslead` e screen-pop em `/pbx/calls`.
