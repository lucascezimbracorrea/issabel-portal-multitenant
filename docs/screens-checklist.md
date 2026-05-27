# Checklist de telas — Portal PBX (web)

Legenda: **Feito** = UI nativa com conteúdo útil ou integração clara · **Parcial** = CRUD básico, falta UX Siptek · **Stub** = placeholder ou só link · **Falta** = não existe rota ou é placeholder vazio

## Autenticação

| Tela            | Estado   | Notas                                      |
| --------------- | -------- | ------------------------------------------ |
| `/login`        | **Feito** | Form + i18n + branding host                |
| `/logout` (POST)| **Feito** | Via botão header                           |
| `/403`          | **Feito** | Forbidden                                  |

## Plataforma (shell)

| Rota                 | Estado     | Notas                                                    |
| -------------------- | ---------- | -------------------------------------------------------- |
| `/` Dashboard        | **Feito**  | Billing (admin), telefonia, gráfico, chamadas recentes  |
| `/organizations`     | **Feito**  | Lista com logo, espaços, ramais, domínio/PBX            |
| `/calls`             | **Feito**  | KPIs + tabela + filtro                                   |
| `/users`             | **Feito**  | Tabela API (roles admin) + export CSV                    |
| `/security`          | **Feito**  | Blocklist, trustlist, auto-config, logs com API real     |
| `/reports`           | **Feito**  | CDR com KPIs, tabela paginada, exportação CSV            |
| `/diagnostics`       | **Feito**  | Resumo MySQL (platform_admin)                            |
| `/settings`          | **Feito**  | Aparência + domínio                                      |
| `/integrations`      | **Feito**  | Hub com abas: webhooks, WhatsApp, AI agents              |
| `/integrations/flows`| **Parcial** | CRUD nome + regras HTTP; sem editor visual PBX          |
| `/integrations/whatsapp` | **Feito** | Status real do gateway + configuração              |
| `/extensions`        | **Feito**  | Lista com navegação para formulário completo             |
| `/extensions/new`    | **Feito**  | Formulário completo: 6 seções, todos os campos           |
| `/extensions/:id`    | **Feito**  | Edição completa com todos os campos                      |
| `/webhooks`          | **Feito**  | Endpoints + entregas                                     |

## PBX (telas nativas no portal)

| Rota                    | Estado     | Notas                                                         |
| ----------------------- | ---------- | ------------------------------------------------------------- |
| `/pbx`                  | **Feito**  | Consola: KPIs telefonia + atalhos + bullets de integração    |
| `/pbx/voicemail`        | **Feito**  | KPIs + tabela de caixas postais                               |
| `/pbx/campaigns`        | **Feito**  | KPIs + tabela de campanhas + barras de progresso             |
| `/pbx/calls`            | **Feito**  | KPIs + pernas recentes (API telephony)                        |
| `/pbx/termination`      | **Parcial** | Hero/atalhos; troncos reais em sub-rota                      |
| `/pbx/termination/trunks` | **Parcial** | Lista CRUD; form dedicado Siptek em sub-rota                |
| `/pbx/termination/trunks/new` | **Feito** | Form: status, host, dígitos, auth, codecs, tarifas      |
| `/pbx/termination/trunks/:id` | **Feito** | Edição tronco                                              |
| `/pbx/inbound-numbers`  | **Feito**  | Tabela DID + KPIs + form new/edit                             |
| `/pbx/features`         | **Feito**  | Códigos de função                                            |
| `/pbx/features/uras`    | **Feito**  | Lista + form (Geral, **IA/Voz**, horário, DTMF) + apply Issabel |
| `/pbx/features/call-flows` | **Feito** | Lista Siptek (nome, número, ações) + editor visual           |
| `/pbx/features/call-flows/:flowId/flow` | **Feito** | Editor XYFlow (Nova chamada / nós PBX)              |
| `/pbx/features/queues`  | **Parcial** | Dashboard KPIs + operadores (add/remove); métricas demo até AMI |
| `/pbx/features/internal-numbers` | **Feito** | Mapa número → URA/Fila/Fluxo/Ramal                    |
| `/pbx/features/hold-group` | **Parcial** | MOH padrão/custom + áudio; CRUD grupos                     |
| `/pbx/features/conference-rooms` | **Parcial** | Lista + CRUD + painel configurações (gravar/anúncio/MOH) |
| `/pbx/features/audio`   | **Feito**  | Arquivos de áudio                                            |
| `/pbx/people`           | **Parcial** | Tabela + export/import CSV + inserir via /extensions       |
| `/pbx/reports`          | **Feito**  | 7 sub-páginas                                                |
| `/pbx/settings`         | **Feito**  | 5 sub-páginas                                                |

## UX / Shell

| Funcionalidade          | Estado     | Notas                                                  |
| ----------------------- | ---------- | ------------------------------------------------------ |
| Notificações no header  | **Feito**  | Bell icon com badge, dropdown com lidas/não-lidas      |
| Menu mobile             | **Feito**  | Sidebar como drawer overlay em mobile                  |
| Menu por contexto       | **Feito**  | Platform menu oculto ao acessar empresa                |
| Tema claro/escuro       | **Feito**  | Toggle persistido                                      |

## Integrações (roadmap)

| Rota | Estado | Notas |
|------|--------|-------|
| `/integrations/lenslead` | **Feito** | Config LensLead + sync manual + busca CRM cache |
| `/pbx/hospitality/rooms` | **Feito** | Inventário quartos, CSV, check-in/out ramal_cloud, QR softphone |
| Softphone provision | **Feito** | API + QR em `/extensions/:id` e após check-in |
| Readiness Issabel | **Feito** | [issabel-integration-readiness.md](./issabel-integration-readiness.md) |

## Evolução futura

1. AMI filas em tempo real (env `AMI_*` ou org config).
2. Apply automático export Issabel (hoje só bundle JSON).
3. Import/export CSV DIDs.

Última revisão: hotelaria, LensLead cron, softphone, Issabel phase-2 (sync tronco, export fluxos/URAs).
