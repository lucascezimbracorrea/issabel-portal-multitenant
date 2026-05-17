# Portal PBX — Apresentação de funcionalidades (cliente)

**Documento para apresentação comercial e onboarding.**  
Descreve **o que o seu cliente passa a ter** ao utilizar este portal em conjunto com a central telefónica (Issabel / Asterisk), sem detalhes de instalação técnica.

---

## 1. Resumo executivo

O produto é um **portal web multi-empresa** com:

- **Área geral**: painel inicial, chamadas, relatórios de CDR, integrações, webhooks, definições da empresa e perfil do utilizador.  
- **Consola PBX**: módulos dedicados à **operação telefónica** — ramais, campanhas, filas, troncos, números de entrada, relatórios operacionais, áudio, URA, conferências, gravações, feriados e pausas.

O interface está preparado para **várias línguas** (português, inglês e espanhol), **tema claro ou escuro** e **white label** (logótipo, cores e domínio próprio da empresa).

> **Nota importante:** Muitas métricas e listas (chamadas, CDR, dashboards) mostram **dados reais** quando a central e a base de **CDR** estão ligadas ao portal. Outras áreas permitem **configurar e guardar** dados no próprio portal (campanhas, filas, troncos, etc.), úteis como **fonte única de gestão** ou como camada de demonstração até à integração total com a central.

---

## 2. O que o utilizador vê no dia a dia

| Experiência | Descrição |
|-------------|-----------|
| **Início de sessão seguro** | Acesso por email e palavra-passe; sessão protegida. |
| **Marca da empresa** | No primeiro contacto, o ecrã de login pode mostrar o **nome comercial**, **logótipo** e **cores** da empresa (quando configurado o domínio e a aparência). |
| **Escolha da empresa** | Utilizadores com acesso a mais do que uma empresa escolhem **qual organização** estão a gerir no momento. |
| **Idioma** | Alternância entre português, inglês e espanhol. |
| **Aparência** | Modo claro ou escuro, confortável para operação prolongada. |
| **Perfil** | Nome apresentado e **foto de perfil** (URL), visível no cabeçalho. |

---

## 3. Painel inicial (dashboard)

- **Indicadores de telefonia**: volume de chamadas, taxa de atendimento, visão das últimas chamadas (quando há dados de CDR/overview).  
- **Atalhos** para as áreas mais usadas (chamadas, relatórios, PBX).  
- Para quem gere **várias empresas na plataforma**, o painel pode incluir visão de **faturação / utilização** ao nível do operador (conforme configuração do serviço).

---

## 4. Chamadas e histórico

| Funcionalidade | Benefício para o cliente |
|----------------|---------------------------|
| **Visão geral de chamadas** | KPIs e lista de chamadas recentes com pesquisa rápida. |
| **Chamadas em curso** | Indicador de atividade “ao vivo” (conforme integração de métricas). |
| **Histórico detalhado** | Consulta paginada ao histórico de chamadas (CDR). |
| **Relatório global de CDR** | Filtros, resumo e **exportação para Excel/CSV** para análise externa ou arquivo. |

---

## 5. Ramais e organização interna

| Funcionalidade | Benefício para o cliente |
|----------------|---------------------------|
| **Diretório de ramais** | Lista com número, nome e origem (criado no portal, sincronizado com a central, etc.). |
| **Criação e edição de ramal** | Formulário completo: identificação, grupo, tempos, **palavra-passe SIP**, opções de identificação de chamada, planos, música de espera, captura de chamada, centro de custo, opções BLF/gravação, **análise de chamadas (IA)** em vários níveis, segurança, correio de voz e **encaminhamentos**. |
| **Ligação à central** | Quando o parceiro configura a integração com a **API da central (Issabel)**, as alterações podem **replicar-se no PABX** (criação/atualização de extensão SIP). |
| **Pessoas e equipas** | Vista operacional de pessoas/ramais; **grupos de ramais** e **equipas** para organizar o contact center ou departamentos. |

---

## 6. Consola PBX — módulos incluídos

A **consola PBX** concentra a operação telefónica num só sítio. Segue o **catálogo de módulos** que o cliente pode apresentar.

### 6.1 Entrada e voz

| Módulo | O que oferece |
|--------|----------------|
| **Consola PBX (entrada)** | Página inicial da área PBX com indicadores e atalhos. |
| **Correio de voz** | Visão das caixas de correio de voz e indicadores associados. |

### 6.2 Campanhas e outbound

| Módulo | O que oferece |
|--------|----------------|
| **Campanhas** | Lista de campanhas, estado e progresso. |
| **Horários de campanha** | Definição de janelas (dias da semana, horas início/fim). |
| **Áudio de campanha** | Gestão de áudios usados nas campanhas. |
| **Classificações / tentativas** | Regras de tentativa e recontacto (ratings). |

### 6.3 Chamadas e gravações (área PBX)

| Módulo | O que oferece |
|--------|----------------|
| **Chamadas (consola)** | KPIs e pernas recentes no contexto PBX. |
| **Gravações** | Área para listar e gerir gravações de chamada (conforme política e integração). |

### 6.4 Rede e números

| Módulo | O que oferece |
|--------|----------------|
| **Terminação / troncos** | Visão dos **troncos SIP** e estado. |
| **Plano de chamadas** | Rotas e regras de saída (chamadas externas). |
| **Números de entrada (DID)** | Inventário de números entrantes e destinos. |

### 6.5 Funcionalidades avançadas do PABX

| Módulo | O que oferece |
|--------|----------------|
| **Códigos de função** | Referência rápida a códigos úteis no dia a dia. |
| **Ficheiros de áudio** | Biblioteca de áudios (mensagens, prompts) com possibilidade de carregar e ouvir. |
| **Filas de atendimento** | Configuração de **filas** (estratégia, timeout, música, etc.). |
| **Fluxos de chamada** | Definição de fluxos no portal (encaminhamentos lógicos). |
| **Música em espera** | Grupos de música / espera. |
| **Números internos** | Gestão da numeração interna. |
| **Salas de conferência** | Salas com PIN e limite de participantes. |
| **URAs** | Menus de voz (URA) para encaminhar o cliente. |

### 6.6 Relatórios operacionais

| Módulo | O que oferece |
|--------|----------------|
| **Relatórios de filas** | Desempenho das filas. |
| **Operações** | Vista operacional agregada. |
| **Detalhe** | Análise ao detalhe de chamadas/eventos. |
| **Exportações** | Saída de dados para arquivo ou BI. |
| **ASR** | Indicadores de **taxa de atendimento** / qualidade. |
| **Agentes** | Desempenho por agente. |
| **Campanhas (relatório)** | Resultados de campanhas. |

### 6.7 Definições operacionais

| Módulo | O que oferece |
|--------|----------------|
| **Centros de custo** | Códigos e nomes para imputação de custo por departamento ou projeto. |
| **Definições gerais** | Parâmetros gerais da operação. |
| **Sistema / informação** | Informação de versão e ambiente (útil para suporte). |
| **Feriados** | Calendário que pode afetar regras de encaminhamento ou operação. |
| **Pausas** | Tipos de pausa para agentes (códigos e descrições). |

---

## 7. Integrações e automação

| Área | O que oferece |
|------|----------------|
| **Hub de integrações** | Ponto único para ver e configurar integrações. |
| **Fluxos e reações** | Desenho/gestão de **fluxos de chamada** e **regras** que disparam ações (por exemplo pedidos HTTP a CRM ou outros sistemas) em eventos telefónicos. |
| **WhatsApp** | Secção dedicada ao estado e configuração do canal WhatsApp (conforme o parceiro ative o gateway). |
| **Webhooks** | Registo de **endpoints** externos, tipos de evento e **histórico de entregas** (sucesso/falha), para CRM, ERP ou ferramentas próprias do cliente. |

---

## 8. Segurança (nível operador de plataforma)

Destinado ao **parceiro / operador** que gere a infraestrutura para vários clientes:

- Listas de **bloqueio** e **confiança** (IPs e portos).  
- **Bloqueio automático** por padrão de falhas (anti-abuso em SIP).  
- **Registo de auditoria** das ações de segurança.

*(O cliente final empresarial pode não ver estes menus — depende do modelo de serviço contratado.)*

---

## 9. Gestão multi-empresa (operador / revendedor)

Para quem vende o serviço a **várias empresas**:

- Lista de **organizações**, quotas (ramais, canais, espaço), tipo de serviço (PABX ou dialer).  
- **Utilizadores do portal** e respetivos papéis.  
- **Diagnóstico** resumido do estado da plataforma.

---

## 10. White label (marca do cliente)

| Item | Descrição |
|------|-----------|
| **Nome comercial** | Apresentado no login e em vários ecrãs. |
| **Logótipo** | Imagem servida por URL segura (HTTPS). |
| **Cor principal** | Alinhamento visual com a marca do cliente. |
| **Slogan no login** | Mensagem curta (ex.: “Portal da sua empresa”). |
| **Domínio próprio** | Possibilidade de aceder pelo **domínio do cliente** (ex.: `voice.cliente.pt`), após configuração de DNS e certificado SSL pelo parceiro. |



*Última atualização: alinhada à consola PBX e menus do portal web. Ajuste o texto “parceiro” / “operador” conforme o seu modelo comercial (revenda, SaaS, instalação única).*
