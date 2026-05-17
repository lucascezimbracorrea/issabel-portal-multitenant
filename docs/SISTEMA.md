# Inventário do sistema — Issabel Portal e contexto

Este documento descreve o que existe no **workspace** em torno do produto **Issabel Portal**: aplicação multi-inquilino (SPA + API Node) e a relação com o **Issabel** (PHP/PBX). Para checklist de telas e maturidade da UI, ver também `docs/screens-checklist.md`. Para deploy e variáveis, ver `docs/deployment.md`.

---

## 1. Estrutura do repositório (`issabel_one`)

| Área | Caminho | Descrição |
|------|---------|-----------|
| **Portal (este produto)** | `issabel-portal/` | Monorepo Node: `apps/web` (React) + `apps/api` (Hono). Base de dados **MySQL própria** do portal (não é a BD `asterisk` do Issabel). |
| **Código Issabel / FreePBX** | Raiz do repo (`index.php`, `modules/`, `admin/`, `libs/`, …) | Instalação típica Issabel: módulos PHP, integrações (ex.: `modules/ia_ura`, `modules/ia_agents`), `libs/paloSantoDB.class.php`, etc. |
| **PBX API REST** | `pbxapi/` | API REST do Issabel 4 (Fat-Free Framework): autenticação JWT (`/authenticate`), recursos como `extensions`, `queues`, `trunks`, … Usa BD `asterisk` e credenciais de `/etc/issabel.conf`. O portal pode integrar ramais via este serviço (ver secção 6). |

O portal **não substitui** o painel Issabel por completo: muitas telas PBX no SPA são **consolas nativas** com dados da API do portal ou leitura CDR; operações avançadas podem continuar a abrir o Issabel clássico (deep links).

---

## 2. Monorepo `issabel-portal`

| Item | Detalhe |
|------|---------|
| **Gestor** | npm workspaces (`apps/*`). |
| **Scripts raiz** | `npm run dev` — API + Web em paralelo; `npm run build` — API depois Web; `lint` / `test` (Vitest no web). |
| **Node** | `>= 18` (ver `package.json`). |

### 2.1 `apps/web` — SPA

| Tópico | Tecnologias |
|--------|-------------|
| Framework | React 19, Vite 6 |
| Roteamento | TanStack Router |
| Dados | TanStack Query |
| UI | Tailwind CSS, Radix UI, componentes em `src/shared/ui/` |
| Formulários | react-hook-form + Zod (onde aplicável) |
| Gráficos | Recharts |
| Fluxos (preparado) | `@xyflow/react` (editor visual de call flows ainda evolutivo — ver checklist) |
| Estado global leve | Zustand (`ui-store`) |
| i18n | i18next + `src/shared/i18n/locales/{en,pt,es}` (`common`, `auth`, `navigation`, `callflow`, `extensions-form`, …) |
| Tema | `next-themes`, variáveis CSS em `src/index.css` (`--primary`, sidebar, dark mode) |

**Entrada:** `src/main.tsx`, estilos `src/index.css`, API via `src/shared/api/client.ts` (base relativa `/api` em dev com proxy Vite).

**Variáveis Vite** (exemplo em `.env.example` na raiz do portal):

- `VITE_ISSABEL_BASE_URL` — base para abrir menus Issabel (mesma origem ou absoluto).
- `VITE_BASE` — path público opcional (ex.: `/console/`).

### 2.2 `apps/api` — Backend

| Tópico | Tecnologias |
|--------|-------------|
| Runtime | Node (ESM), `tsx` em dev |
| Framework HTTP | Hono |
| Servidor | `@hono/node-server` |
| BD portal | **MySQL** via `mysql2` + **Drizzle ORM** |
| Schema / migrações leves | `src/db/init.ts` (`CREATE TABLE IF NOT EXISTS` + `ALTER` pontuais ao subir a API); `drizzle.config.ts` + `npm run db:push` opcional |
| Auth | JWT (`jose`), cookie `portal_session` + header `Authorization: Bearer` |
| Validação | Zod |
| Segurança extra | Rate limit login, bloqueio SSRF em URLs de regras (`lib/ssrf.ts`) |

**Variáveis API** (ver `.env.example`):

- `PORT`, `NODE_ENV`, `INTERNAL_TELEPHONY_TOKEN`, `CORS_ORIGINS`
- `DB_*` — MySQL **aplicação portal**
- CDR (leitura Issabel): `ISSABEL_CDR_MYSQL_JSON` **ou** `ISSABEL_MYSQL_HOST` / `USER` / `PASSWORD` / `DATABASE` / `PORT` / `ISSABEL_MYSQL_CDR_TABLE`

**Scripts:** `dev`, `build`, `start`, `db:push`, `db:seed`, `lint`.

---

## 3. Modelo de dados (MySQL — portal)

Tabelas definidas em `apps/api/src/db/schema.ts` e criadas em `init.ts` (síntese):

| Tabela | Função |
|--------|--------|
| `users` | Utilizadores do portal: email, password hash, `display_name`, `avatar_url`, `role` (`platform_admin`, `org_admin`, `org_operator`, `org_viewer`). |
| `organizations` | Inquilinos: nome, `trade_name`, `active`, `appearance` (JSON branding), domínio customizado, `issabel_base_url`, `org_kind` (pabx/dialer), quotas (`extensions_limit`, `channels_limit`, `disk_quota_gb`), `cdr_mysql` (JSON conexão CDR), **`issabel_pbx_api`** (JSON: URL + credenciais `pbxapi` para sync de ramais). |
| `organization_members` | N:N utilizador ↔ organização com papel org. |
| `spaces` | “Espaços” dentro da organização. |
| `extensions` | Ramais do portal: `number`, `display_name`, `metadata` (JSON — inclui campos do formulário e `issabelSync`), `source` (`portal` \| `synced` \| `linked`). |
| `webhook_endpoints` / `webhook_deliveries` | Endpoints de webhook e histórico de entregas. |
| `integrations` | Integrações genéricas por tipo + `config` JSON. |
| `campaigns`, `campaign_schedules`, `campaign_ratings` | Campanhas e auxiliares. |
| `holidays`, `pause_types`, `cost_centers` | Configurações operacionais. |
| `extension_groups`, `teams` | Grupos de ramais / equipas (`extension_ids` JSON). |
| `ai_agents` | Agentes IA (nome, modelo, prompt). |
| `call_flows` | Fluxos (`graph_json`). |
| `call_reaction_rules` / `call_reaction_delivery_log` | Reações a eventos telefónicos (HTTP, etc.) + log. |
| `queues`, `conference_rooms`, `hold_groups`, `trunks`, `outbound_routes` | Objetos PBX modelados no portal. |
| `audio_files` | Ficheiros de áudio (upload/stream). |
| `security_auto_config`, `security_blocklist`, `security_trustlist`, `security_block_log` | Segurança / anti-abuso SIP. |
| `platform_settings` | Chave/valor global. |

---

## 4. API HTTP — superfície (resumo)

Todas as rotas abaixo estão em `apps/api/src/index.ts` (prefixo real depende do reverse proxy, ex. `/console/api/`).

### Autenticação e sessão

- `POST /auth/login`, `POST /auth/logout`
- `GET /me`, `PATCH /me` (perfil, incl. `avatarUrl`)

### Público

- `GET /public/branding-by-host?host=…` — white-label antes do login

### Organizações e membros

- `GET /organizations` (lista paginada; inclui contagens e `logoUrl` derivado)
- `GET /organizations/:id`
- `POST /organizations`, `PATCH /organizations/:id`, `DELETE /organizations/:id` (maioria **platform_admin**)
- `PATCH /organizations/:id/quotas` — quotas, `cdrMysql`, `issabelPbxApi`, `active`, …
- `PATCH /organizations/:id/appearance`, `PATCH /organizations/:id/custom-domain`, `POST /organizations/:id/custom-domain/verify`
- `GET/POST/PATCH/DELETE` spaces em `/organizations/:orgId/spaces`…

### Utilizadores

- `GET /users`, `POST /users`, `DELETE /users/:id`
- `POST /users/:id/reset-password`
- `GET /users/export.csv`
- `GET/POST/…/organizations/:orgId/members`

### Métricas e relatórios

- `GET /metrics/billing-summary`
- `GET /metrics/telephony-overview` — agrega CDR / demo (`lib/telephony.ts`)
- `GET /metrics/platform-overview`
- `GET /metrics/calls-online`
- `GET /metrics/cdr/history` — paginação CDR
- `GET /reports/cdr-export.csv`
- `GET /metrics/queue-log`

### Ramais

- `GET /extensions?organizationId=`
- `GET /extensions/:id` — detalhe com `metadata` “achatado” no JSON
- `POST /extensions`, `PATCH /extensions/:id`, `DELETE /extensions/:id`  
  - Corpo do formulário: campos core + resto em `metadata`; com `issabelPbxApi` configurado, após gravar corre **sync** para Issabel `pbxapi` (`lib/issabel-pbx-api.ts`).

### Webhooks

- CRUD `/webhooks/endpoints`…

### Interno

- `POST /internal/telephony/events` — token `INTERNAL_TELEPHONY_TOKEN` em produção; dispara `call_reaction_rules`

### Integrações e PBX “app data”

- `GET/POST/PATCH/DELETE /integrations`
- `extension-groups`, `teams`, `ai-agents`, `call-flows`, `call-reaction-rules`
- `GET /whatsapp/status`
- `campaigns`, `holidays`, `pause-types`, `cost-centers`, `queues`, `conference-rooms`, `hold-groups`, `trunks`, `outbound-routes`, `campaign-schedules`, `campaign-ratings`, `audio-files` (+ `GET /audio-files/:id/stream`)

### Segurança (platform_admin)

- `GET/POST/DELETE` blocklist e trustlist
- `GET/PATCH` auto-config, `GET` logs

### Outros

- `GET /diagnostics/summary`
- `GET /health`

---

## 5. SPA — rotas (TanStack Router)

Definição: `apps/web/src/app/router.tsx`. Navegação lateral: `src/shared/config/nav-config.ts`.

| Caminho | Área |
|---------|------|
| `/login` | Autenticação |
| `/403` | Proibido |
| `/` | Dashboard |
| `/organizations`, `/organizations/$orgId` | Empresas / detalhe |
| `/calls`, `/calls/online`, `/calls/history` | Chamadas |
| `/users` | Utilizadores |
| `/security/*` | Blocklist, trustlist, auto-config, logs (**admin plataforma**) |
| `/reports` | Relatórios (CDR no portal) |
| `/diagnostics` | Diagnóstico (**admin**) |
| `/settings` | Aparência, domínio |
| `/profile` | Perfil do utilizador |
| `/integrations`, `/integrations/flows`, `/integrations/whatsapp` | Hub integrações |
| `/extensions`, `/extensions/new`, `/extensions/$extId` | Ramais |
| `/webhooks` | Webhooks |
| `/pbx` e sub-rotas | Consola PBX: voicemail, campaigns (+ schedules, audio, ratings), people (+ extension-groups, teams), calls (+ recordings), termination (+ calling-plan, trunks), inbound-numbers, features (+ audio, queues, call-flows, hold-group, internal-numbers, conference-rooms, uras), reports (+ 7 sub-rotas), settings (+ cost-center, general, system, holidays, pauses) |

**Shell:** `AppShell` (header com idioma, notificações, tema, menu utilizador), `AppSidebar` (scroll, altura viewport).

---

## 6. Integração com Issabel

| Mecanismo | Onde | Notas |
|-----------|------|--------|
| **Deep links / UI clássica** | `issabelBaseUrl` + `VITE_ISSABEL_BASE_URL` | Abrir menus Issabel; cookies `issabelSession` same-site se mesmo host (`deployment.md`). |
| **CDR (leitura)** | `cdr_mysql` por org **ou** env global | `lib/issabel-cdr.ts` — tabela `cdr` (ou nome configurável). Alimenta histórico, exports, parte das métricas. |
| **PBX API (escrita ramais)** | `organizations.issabel_pbx_api` | `lib/issabel-pbx-api.ts`: JWT via `POST …/authenticate`, depois `POST/PUT /extensions`. Password na resposta API mascarada. |
| **Eventos telefonia → automação** | `POST /internal/telephony/events` | Para o Issabel/Asterisk chamar (dialplan, script) com token interno. |

Limitações conhecidas: o `pbxapi` stock do Issabel 4 mira sobretudo **chan_sip**; ambientes **PJSIP-only** podem exigir extensão ou outro conector.

---

## 7. Papéis e permissões (resumo)

- **platform_admin**: organizações, segurança global, diagnóstico, quotas, muitos CRUDs transversais.
- **org_admin / org_operator / org_viewer**: acesso por `organization_members`; escrita de ramais e recursos org conforme helpers em `apps/web/src/shared/lib/can.ts` e checagens na API.

---

## 8. Documentação auxiliar no repo

| Ficheiro | Conteúdo |
|----------|----------|
| `docs/deployment.md` | nginx, env, CORS, domínio customizado, **Issabel PBX API** |
| `docs/screens-checklist.md` | Estado das telas (feito/parcial/evolução) |
| `docs/SISTEMA.md` | Este inventário |

---

## 9. Seed e desenvolvimento

- `apps/api/scripts/seed.ts` — utilizadores demo, várias organizações, spaces, extensions de exemplo, membros.
- Após alterações de schema, **reiniciar a API** para `initSchema` aplicar `ALTER`s idempotentes.

---

## 10. O que este documento não cobre em profundidade

- **Todo o código PHP Issabel** na raiz (`modules/*`, `admin/*`, …): centenas de ficheiros; cada módulo tem o seu próprio README ou lógica de negócio.
- **Conteúdo exato** de cada ecrã PBX no SPA (KPIs, mocks vs API): ver código em `apps/web/src/features/pbx/` e o checklist de telas.

Para alterações futuras, mantenha este ficheiro alinhado quando adicionar **rotas API**, **tabelas** ou **áreas de produto** novas.
