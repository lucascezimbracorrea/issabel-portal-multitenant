# Hook Issabel: apply bundle do portal

O portal envia fluxos/URAs para o PBX via webhook. Implementação em `issabel_one/api/`.

## 1. Instalar no servidor Issabel

```bash
# Ficheiros já no repo em issabel_one/api/
cp api/portal_apply.conf.example /etc/issabel-portal.conf
chmod 600 /etc/issabel-portal.conf
# Editar PORTAL_APPLY_SECRET (min. 32 caracteres)
```

## 2. Configurar no portal (por organização)

Campo `issabel_pbx_api` (JSON):

```json
{
  "enabled": true,
  "baseUrl": "https://pbx.example.com/pbxapi",
  "username": "admin",
  "password": "***",
  "applyWebhookUrl": "https://pbx.example.com/api/portal_apply_bundle.php",
  "applyWebhookSecret": "MESMO_VALOR_QUE_PORTAL_APPLY_SECRET"
}
```

## 3. Fluxo

1. Utilizador clica **Apply** em fluxo ou URA no portal.
2. Job `issabel_apply_jobs` fica `pending`.
3. Cron Vercel `GET /api/cron/issabel-apply-jobs` (10 min) envia POST ao webhook.
4. `portal_apply_bundle.php` aplica:
   - **portal-ura-v1** → `ia_ura_context` + destino `ia_ura_context,IA-{nome},1`
   - **portal-call-flow-v1** → `ivr_details` + `ivr_entries` + destino `ivr-{id},s,1`
5. `issabel-helper applychanges` recarrega dialplan.

## 4. Listar agentes de voz (URA IA)

```bash
curl -s "https://pbx.example.com/api/portal_list_ia_agents.php" \
  -H "Authorization: Bearer SEU_PORTAL_APPLY_SECRET"
```

No portal: `GET /api/organizations/:orgId/issabel/ia-agents` (sessão autenticada).

## 5. Testar AMI no PBX

```bash
curl -s "https://pbx.example.com/api/portal_ami_test.php?queue=vendas&mailbox=101@default" \
  -H "Authorization: Bearer SEU_PORTAL_APPLY_SECRET"
```

Opcional click-to-call de teste (cuidado — disca de verdade):

```bash
curl -s "https://pbx.example.com/api/portal_ami_test.php?originate=1&fromExtension=101&toNumber=11999999999" \
  -H "Authorization: Bearer SEU_SECRET"
```

## 6. Testar apply manual

```bash
curl -s -X POST "https://pbx.example.com/api/portal_apply_bundle.php" \
  -H "Authorization: Bearer SEU_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "portal-ura-v1",
    "name": "Atendimento Portal",
    "extensionNumber": "8000",
    "graph": {"nodes":[],"edges":[]},
    "dtmfActions": []
  }'
```

Log: `/var/log/issabel-portal-apply.log`

## 7. Portal — ping AMI (sem ir ao PBX)

Com sessão autenticada:

`GET /api/organizations/:orgId/telephony/ami-ping?queue=nome`

Usa `amiHost` / `amiUser` / `amiSecret` no JSON da org ou variáveis `AMI_*` no ambiente da API.
