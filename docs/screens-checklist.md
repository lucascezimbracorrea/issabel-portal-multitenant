# Checklist de telas — Portal PBX (web)

Legenda: **Feito** = UI nativa com conteúdo útil ou integração clara · **Parcial** = stub/demo ou só link externo · **Falta** = não existe rota ou é placeholder vazio

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
| `/users`             | **Feito**  | Tabela API (roles admin)                                 |
| `/security`          | **Feito**  | Blocklist, trustlist, auto-config, logs com API real     |
| `/reports`           | **Feito**  | CDR com KPIs, tabela paginada, exportação CSV            |
| `/diagnostics`       | **Feito**  | Resumo MySQL (platform_admin)                            |
| `/settings`          | **Feito**  | Aparência + domínio                                      |
| `/integrations`      | **Feito**  | Hub com abas: webhooks, WhatsApp, AI agents              |
| `/integrations/flows`| **Feito**  | CRUD de fluxos e regras HTTP                             |
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
| `/pbx/termination`      | **Feito**  | Tabela de troncos SIP + estado                               |
| `/pbx/inbound-numbers`  | **Feito**  | Inventário DID + destinos                                    |
| `/pbx/features`         | **Feito**  | Códigos de função                                            |
| `/pbx/reports`          | **Feito**  | 7 sub-páginas: filas, operações, detalhe, exports, ASR, agentes, campanhas |
| `/pbx/settings`         | **Feito**  | 5 sub-páginas: centro de custo, geral, sistema, feriados, pausas |
| `/extensions`           | **Feito**  | Menu PBX aponta aqui — lista real da API                     |

## UX / Shell

| Funcionalidade          | Estado     | Notas                                                  |
| ----------------------- | ---------- | ------------------------------------------------------ |
| Notificações no header  | **Feito**  | Bell icon com badge, dropdown com lidas/não-lidas      |
| Menu mobile             | **Feito**  | Sidebar como drawer overlay em mobile, botão hamburger |
| Menu por contexto       | **Feito**  | Platform menu oculto ao acessar empresa; botão Voltar  |
| Branding sem "Issabel"  | **Feito**  | Título, labels, mensagens — todos sem referência       |
| Tema claro/escuro       | **Feito**  | Toggle persistido                                      |

## O que ainda pode evoluir (prioridade sugerida)

1. **Editor visual de Call Flows**: XYFlow instalado mas editor drag-and-drop ainda não implementado.
2. **Dados reais PBX**: CDR/queues/voicemail/campanhas via AMI em tempo real.
3. **Testes E2E** das rotas.
4. **Busca global**: atalho de teclado para pesquisar empresas, ramais, chamadas.
5. **Code splitting**: bundle principal > 500 kB, considerar lazy imports por feature.

Última revisão: alinhada ao router em `apps/web/src/app/router.tsx` e `nav-config.ts`.
