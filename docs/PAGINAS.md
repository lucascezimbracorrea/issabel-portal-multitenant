# Guia de páginas do portal

Documento de referência: **cada rota da aplicação web** e **o que a página faz**. As rotas listadas são relativas à raiz do SPA (ex.: `https://seu-dominio/`). Se o portal for servido num subcaminho (ex.: `/console/`), esse prefixo aplica-se a todos os caminhos.

**Legenda de dados**

- **API real** — lê ou grava na API do portal (MySQL).
- **CDR / telefonia** — depende de CDR ou métricas configuradas na organização ou no ambiente.
- **Conteúdo de exemplo** — dados mock ou listas geradas na UI quando ainda não há integração completa com a central; útil para demonstração e navegação.

---

## Autenticação e erros

| Rota | O que faz |
|------|-----------|
| **`/login`** | Ecrã de início de sessão (email e palavra-passe). Carrega **marca e cores** pelo domínio (`/public/branding-by-host`). Permite escolher idioma, alternar tema e ver palavra-passe. Após login, redireciona para o dashboard. |
| **`/403`** | Página “acesso negado” quando o utilizador não tem permissão para um recurso. |

---

## Área autenticada (menu lateral e cabeçalho)

Todas as rotas abaixo exigem sessão válida. O **seletor de organização** no cabeçalho define o contexto da empresa; várias telas mostram mensagem para escolher organização se for necessário e ainda não houver seleção.

---

## Início e plataforma

| Rota | O que faz |
|------|-----------|
| **`/`** (Dashboard) | Visão geral: para **administrador da plataforma**, resumo de faturação/MRR e gráficos de utilização; para utilizadores de **empresa**, KPIs de telefonia (chamadas 24h, taxa de atendimento, volume por intervalos), chamadas recentes e atalhos. Dados de telefonia via **CDR/overview** quando configurado. |
| **`/organizations`** | Lista **empresas** (organizações) com pesquisa, paginação, tipo (PABX/dialer), estado, contagens de espaços e ramais, domínio e logótipo. **Apenas administrador da plataforma.** |
| **`/organizations/:orgId`** | **Detalhe da empresa**: dados resumidos, membros, quotas, aparência, domínio, atalhos. Permite gerir a organização conforme o papel do utilizador. |
| **`/users`** | Lista **utilizadores do portal** (email, nome, papel), exportação CSV, criação e remoção, reposição de palavra-passe. Destinado sobretudo a gestão global / administração. |
| **`/diagnostics`** | Resumo técnico para **administrador da plataforma** (contagens, versão da API, indicadores de saúde). |
| **`/reports`** | Relatório de **CDR**: filtros, KPIs, tabela paginada de chamadas e exportação **CSV** (quando a ligação à base CDR está configurada). |

---

## Chamadas (secção “Chamadas” no menu)

| Rota | O que faz |
|------|-----------|
| **`/calls`** | Índice: KPIs de telefonia e **lista de chamadas recentes** com filtro de texto (origem, destino, disposição). Dados via `telephony-overview`. |
| **`/calls/online`** | Vista de **chamadas em curso / estimativa** (dados da API de métricas “online”). |
| **`/calls/history`** | **Histórico** de chamadas com paginação (API CDR/history quando disponível). |

---

## Segurança (só administrador da plataforma)

| Rota | O que faz |
|------|-----------|
| **`/security`** | Redireciona para `/security/blocklist`. |
| **`/security/blocklist`** | **Lista de bloqueio** (IP/porta/protocolo): consultar, adicionar e remover entradas manuais ou automáticas. |
| **`/security/trustlist`** | **Lista de confiança** (libertação de IPs após bloqueio). |
| **`/security/auto-config`** | Parâmetros de **bloqueio automático** (limiares, durações, o que analisar). |
| **`/security/logs`** | **Registo de ações** de segurança (auditoria de bloqueios e eventos). |

---

## Definições e perfil

| Rota | O que faz |
|------|-----------|
| **`/settings`** | **Definições da organização** ativa: marca (cor primária em HSL, slogan de login, URL do logótipo), **domínio próprio** (pedido e verificação), gestão de **espaços** (spaces). Respeita permissões (apenas papéis autorizados alteram marca/domínio). |
| **`/profile`** | **Perfil do utilizador**: nome apresentado e URL de **foto/avatar** (gravado na API). |

---

## Integrações

| Rota | O que faz |
|------|-----------|
| **`/integrations`** | **Hub de integrações**: visão geral com separadores (ex.: integrações HTTP genéricas, eventos, atalhos para WhatsApp e fluxos). Permite criar/editar/remover integrações e associar eventos. |
| **`/integrations/flows`** | **Fluxos de chamada** e **regras de reação** (HTTP em resposta a eventos): CRUD sobre `call-flows` e `call-reaction-rules` na API. |
| **`/integrations/whatsapp`** | Estado e configuração do **WhatsApp** (gateway / integração conforme implementado na API). |

---

## Ramais

| Rota | O que faz |
|------|-----------|
| **`/extensions`** | **Lista de ramais** da organização (número, nome, origem portal/sincronizado/ligado), criar novo, editar e eliminar (conforme permissões). |
| **`/extensions/new`** | **Criar ramal**: formulário completo (identificação, SIP, análise de chamadas, encaminhamentos, etc.); grava na API; opcionalmente **sincroniza com Issabel** se a empresa tiver `issabel_pbx_api` configurado. |
| **`/extensions/:id`** | **Editar ramal** existente: mesmo formulário; atualização na API e sync opcional para Issabel. |

---

## Webhooks

| Rota | O que faz |
|------|-----------|
| **`/webhooks`** | **Endpoints de webhook**: URL, segredo, tipos de evento, ativar/desativar; histórico de **entregas** (estado, tentativas, erros). |

---

## Consola PBX (`/pbx/...`)

Área dedicada à **telefonia e operação**, com ecrãs nativos no portal. Muitas subpáginas usam **dados da API do portal** (campanhas, filas, troncos, etc.) ou **métricas/CDR**; algumas tabelas podem mostrar **dados de exemplo** quando não há registos.

### Entrada e correio de voz

| Rota | O que faz |
|------|-----------|
| **`/pbx`** | **Consola PBX**: hero com KPIs, atalhos (correio de voz, campanhas, ramais, chamadas) e texto de apoio à integração. |
| **`/pbx/voicemail`** | **Correio de voz**: KPIs e tabela de caixas postais (dados conforme API/mocks). |

### Campanhas

| Rota | O que faz |
|------|-----------|
| **`/pbx/campaigns`** | Lista de **campanhas** com estado, progresso e gráficos. |
| **`/pbx/campaigns/schedules`** | **Horários** de campanha (agenda por dias/horas). |
| **`/pbx/campaigns/audio`** | **Áudio** associado a campanhas (lista/gestão). |
| **`/pbx/campaigns/ratings`** | **Classificações / tentativas** de contacto (regras de re-marcação). |

### Pessoas e equipas

| Rota | O que faz |
|------|-----------|
| **`/pbx/people`** | Vista **pessoas / ramais** na operação PBX (lista, KPIs). |
| **`/pbx/extension-groups`** | **Grupos de ramais** (CRUD na API). |
| **`/pbx/teams`** | **Equipas** (CRUD na API). |

### Chamadas PBX

| Rota | O que faz |
|------|-----------|
| **`/pbx/calls`** | **Chamadas** na consola PBX: KPIs e pernas recentes (telephony overview). |
| **`/pbx/calls/recordings`** | **Gravações** de chamada (lista/gestão conforme API). |

### Terminação e troncos

| Rota | O que faz |
|------|-----------|
| **`/pbx/termination`** | Vista geral de **terminação** (troncos SIP, estado). |
| **`/pbx/termination/calling-plan`** | **Plano de chamadas** / rotas de saída (dados de exemplo ou API). |
| **`/pbx/termination/trunks`** | **Troncos SIP**: tabela e detalhe (API `trunks`). |

### Números de entrada

| Rota | O que faz |
|------|-----------|
| **`/pbx/inbound-numbers`** | **Inventário de DIDs** e destinos (números de entrada). |

### Funcionalidades

| Rota | O que faz |
|------|-----------|
| **`/pbx/features`** | **Índice de funcionalidades** PBX: códigos de função e atalhos para subpáginas. |
| **`/pbx/features/audio`** | **Ficheiros de áudio** (lista, upload, reprodução via API). |
| **`/pbx/features/queues`** | **Filas** de atendimento (CRUD na API). |
| **`/pbx/features/call-flows`** | **Fluxos de chamada** no contexto PBX (lista/gestão). |
| **`/pbx/features/hold-group`** | **Grupos de música em espera**. |
| **`/pbx/features/internal-numbers`** | **Números internos** / extensões internas (vista operacional). |
| **`/pbx/features/conference-rooms`** | **Salas de conferência**. |
| **`/pbx/features/uras`** | **URAs** (menus de voz). |

### Relatórios PBX

| Rota | O que faz |
|------|-----------|
| **`/pbx/reports`** | **Entrada dos relatórios** PBX: navegação para sub-relatórios. |
| **`/pbx/reports/queues`** | Relatório de **filas**. |
| **`/pbx/reports/operations`** | Relatório de **operações**. |
| **`/pbx/reports/detail`** | **Detalhe** de chamadas/operacional. |
| **`/pbx/reports/exports`** | **Exportações** (ficheiros/CSV conforme implementação). |
| **`/pbx/reports/asr`** | Métricas **ASR** (taxa de atendimento / qualidade). |
| **`/pbx/reports/agents`** | Relatório de **agentes**. |
| **`/pbx/reports/campaigns`** | Relatório de **campanhas**. |

### Definições PBX

| Rota | O que faz |
|------|-----------|
| **`/pbx/settings`** | **Índice de definições** PBX (subpáginas). |
| **`/pbx/settings/cost-center`** | **Centros de custo** (CRUD na API). |
| **`/pbx/settings/general`** | **Definições gerais** da operação. |
| **`/pbx/settings/system`** | **Sistema / diagnóstico** (versão API, ambiente). |
| **`/pbx/settings/holidays`** | **Feriados** (calendário operacional, CRUD na API). |
| **`/pbx/settings/pauses`** | **Tipos de pausa** (códigos de pausa para agentes, CRUD na API). |

---

## Shell da aplicação (comum a todas as páginas autenticadas)

- **Barra superior**: breadcrumb ou título, **idioma** (PT/EN/ES), **notificações**, **tema claro/escuro**, **menu do utilizador** (perfil, terminar sessão).
- **Barra lateral**: navegação por módulos; em ecrãs pequenos pode aparecer como **drawer**.
- **Contexto de empresa**: o utilizador com várias empresas escolhe a organização ativa; várias APIs recebem `organizationId` implícito ou explícito.

---

## Manutenção deste documento

Ao adicionar rotas em `apps/web/src/app/router.tsx`, atualize esta tabela. Para maturidade “feito vs demonstração” por ecrã, ver também `docs/screens-checklist.md`.
