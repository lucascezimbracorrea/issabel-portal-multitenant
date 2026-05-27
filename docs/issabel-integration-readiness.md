# Issabel integration readiness

Gate document before enabling full PBX sync (troncos, fluxos, URAs, AMI). The portal can operate locally and integrate hotel, CRM, and softphone without completing phase 2.

## What works today (production-safe)

| Capability | Portal | Issabel / external |
|------------|--------|-------------------|
| Multitenant auth, orgs, roles | MySQL | — |
| Extensions CRUD | MySQL | Optional `pbxapi` sync when `organizations.issabel_pbx_api` is set |
| CDR / call history | API | `issabel-cdr` (MySQL CDR on org or env) |
| URAs, call flows, DIDs, queues (config) | MySQL + UI | Not pushed to dialplan |
| Trunks form (Siptek parity) | MySQL | Not synced |
| Queue dashboard KPIs | UI | Demo metrics unless AMI configured |
| Hotel inventory + stays | MySQL + ramal_cloud proxy | `ramal_cloud_*` on Issabel ONE host |
| LensLead contacts cache | MySQL | Edge Function `portal-sync` + cron |
| Softphone provision | API JSON + QR | App reads provision; push via `register_push_token.php` |

## Gaps before “full Issabel” (phase 2)

| Item | Risk if assumed done | Phase 2 work |
|------|----------------------|--------------|
| Troncos | Portal-only; calls use real PBX trunks configured on Issabel | `POST/PUT` via pbxapi or Issabel module |
| Fluxos / URAs (XYFlow) | Graph not applied to Asterisk | Export format + apply job |
| Filas (live KPIs) | Dashboard may show `demo: true` | AMI `QueueSummary` / queue_log |
| MOH / audio files | Metadata only | Upload to Asterisk paths |
| DIDs | Portal routing model | Sync inbound routes |

## Go criteria (per organization)

1. `issabel_pbx_api` JSON tested: authenticate + one extension create/update succeeds.
2. `issabel_base_url` or ramal_cloud `ipbxUrl` reachable from API (Vercel egress).
3. Stakeholders accept [screens-checklist.md](./screens-checklist.md) partial items for troncos/filas until phase 2.
4. For hotel: cron `process_ramal_cloud_jobs.php` running on Issabel ONE server.
5. For LensLead: `portal-sync` deployed; `PORTAL_SYNC_SECRET` set in both projects.

## Recommended rollout order

1. Staff extensions + softphone provision (QR).
2. Hotel inventory → check-in/out (ramal_cloud).
3. LensLead cron + screen-pop on calls.
4. AMI queue metrics.
5. Trunk + flow export to Issabel.

## Environment variables (integration)

| Variable | Used by |
|----------|---------|
| `CRON_SECRET` | Vercel cron → `/api/cron/sync-lenslead` |
| `PORTAL_SYNC_SECRET` | Portal → LensLead Edge Function |
| `LENSLEAD_FUNCTIONS_URL` | Optional override for Edge Function base URL |

## Apply webhook (Issabel)

Deploy `issabel_one/api/portal_apply_bundle.php` and `/etc/issabel-portal.conf`. See [issabel-apply-hook.md](./issabel-apply-hook.md).

Last updated: roadmap implementation.
