# Plano de Implementação: Mobile ERP Copilot & Dashboard

- **Data:** 2026-09-29
- **Especificação de Referência:** [docs/superpowers/specs/2026-09-29-mobile-erp-copilot-design.md](file:///c:/Users/Felipe/Desktop/Programação/AI%20DB/docs/superpowers/specs/2026-09-29-mobile-erp-copilot-design.md)
- **Status:** Pronto para Execução

---

## Estrutura do Projeto (Workspace Modular)

O repositório será organizado de forma limpa e modular:

```text
/
├── agent/                 # Agente Local (Node.js Service para o servidor da loja)
│   ├── src/
│   │   ├── config.ts      # Configurações locais (caminho do TGA.FDB, tokens)
│   │   ├── firebird.ts    # Conexão e transação Read-Only com Firebird 5.0
│   │   ├── queries/       # Consultas SQL parametrizadas (vendas, produtos, financeiro)
│   │   ├── tunnel.ts      # Cliente WebSocket com auto-reconnect e heartbeat
│   │   └── index.ts
│   └── package.json
│
├── backend/               # Nuvem Express.js (Gateway WebSocket + Gemini AI + Supabase)
│   ├── src/
│   │   ├── config.ts      # Variáveis de ambiente (GEMINI_API_KEY, SUPABASE_URL...)
│   │   ├── gateway/       # Servidor WebSocket gerenciador de conexões por company_id
│   │   ├── ai/            # Orquestrador Gemini Flash (Function Calling / Tools)
│   │   ├── routes/        # Rotas REST (/api/dashboard, /api/chat, /api/status)
│   │   ├── supabase.ts    # Cliente Supabase (Auth & Tenants)
│   │   └── server.ts
│   └── package.json
│
├── mobile/                # Frontend React Mobile-First (PWA)
│   ├── src/
│   │   ├── components/    # BottomNav, Header Frosted Glass, MetricCard, ChatBubble
│   │   ├── screens/       # DashboardScreen, CopilotScreen, SettingsScreen
│   │   ├── services/      # Chamadas de API para o backend Express
│   │   └── App.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
│
└── shared/                # Contratos e tipos comuns
    └── types.ts           # Interfaces de envelopes WebSocket, DTOs de métricas
```

---

## Fases de Execução e Tarefas

### Fase 1: Fundação do Monorepo e Contratos Compartilhados (`shared`)
- [ ] **Tarefa 1.1:** Inicializar a estrutura raiz com workspaces no `package.json` (`agent`, `backend`, `mobile`, `shared`).
- [ ] **Tarefa 1.2:** Criar `shared/types.ts` com as tipagens dos envelopes WebSocket (`QueryRequestEnvelope`, `QueryResponseEnvelope`, `DashboardMetricsDTO`, `ChatMessageDTO`).

### Fase 2: Agente Local On-Premise (`agent`) & Driver Firebird 5.0
- [ ] **Tarefa 2.1:** Configurar o projeto do agente com dependências (`node-firebird` / `node-firebird-driver-native`, `ws`, `dotenv`).
- [ ] **Tarefa 2.2:** Implementar camada de conexão segura com Firebird em `src/firebird.ts` (transação estritamente Read-Only, timeout de 4 segundos e liberação de conexões).
- [ ] **Tarefa 2.3:** Escrever e validar script de probe contra `TGA.FDB` para mapear os nomes exatos das tabelas do ERP (vendas, itens, produtos, financeiro).
- [ ] **Tarefa 2.4:** Implementar as 5 consultas parametrizadas essenciais em `src/queries/`:
  - `resumoVendas(dataInicio, dataFim)`
  - `rankingProdutos(dataInicio, dataFim, limite, ordenacao)`
  - `fluxoFinanceiro(dataReferencia)`
  - `saldoEstoque(filtro, apenasAbaixoMinimo)`
  - `consultaLivreLeitura(sql)` (com validação estrita anti-mutação via regex).
- [ ] **Tarefa 2.5:** Implementar o cliente WebSocket reverso (`src/tunnel.ts`) com envio de credenciais no handshake, heartbeat a cada 30s e reconexão exponencial.

### Fase 3: Backend em Nuvem Express.js (`backend`) & Orquestrador Gemini
- [ ] **Tarefa 3.1:** Configurar o projeto Express com `ws`, `@google/genai` (ou `@google/generative-ai`), `@supabase/supabase-js`, `cors` e `dotenv`.
- [ ] **Tarefa 3.2:** Implementar o gerenciador de túnel em `src/gateway/agentManager.ts`:
  - Mapa em memória de clientes conectados: `Map<company_id, WebSocket>`.
  - Método `sendQueryToAgent(companyId, toolName, params, timeoutMs)` retornando Promise com correlação por ID.
- [ ] **Tarefa 3.3:** Implementar as rotas do Dashboard em `src/routes/dashboard.ts` (consulta direta ao agente via túnel, 0 tokens gastos).
- [ ] **Tarefa 3.4:** Configurar a orquestração do Gemini Flash com *Function Calling* em `src/ai/copilot.ts`:
  - Declaração dos esquemas das 5 ferramentas parametrizadas.
  - Loop de execução: Gemini gera tool call ➔ backend executa no agente ➔ resultado volta para o Gemini sintetizar a resposta em português executivo.
  - Tratamento de erro 429 (rate-limit do plano gratuito) com fallback amigável.
- [ ] **Tarefa 3.5:** Implementar rotas de autenticação/validação do Supabase em `src/routes/auth.ts`.

### Fase 4: Frontend React Mobile-First (`mobile`) - Apple HIG & M3
- [ ] **Tarefa 4.1:** Criar boilerplate Vite + React + TypeScript + Tailwind CSS configurado para PWA.
- [ ] **Tarefa 4.2:** Construir o shell do app mobile com:
  - Header *Frosted Glass* (`backdrop-blur-xl`, `bg-white/85`) com badge de status do servidor local (🟢 Online / 🔴 Desconectado).
  * Bottom Tab Bar com altura ergonômica (`min-h-[48px]`), alvos de toque mínimos de 48px e feedback elástico (`active:scale-95`).
- [ ] **Tarefa 4.3:** Desenvolver a tela **Dashboard Executivo**:
  - Card Hero de Faturamento Hoje com tipografia de destaque.
  - Grid de métricas 2×2 (Vendas, Ticket Médio, Contas a Receber, Contas a Pagar).
  - Lista de Top 3 Produtos do Dia.
  - Pull-to-refresh nativo.
- [ ] **Tarefa 4.4:** Desenvolver a tela **Copilot IA (Chat)**:
  - Carrossel horizontal de chips de toque com perguntas rápidas prontas.
  - Lista de mensagens com suporte a mini-tabelas formatadas e valores em R$ (BRL).
  - Campo de digitação ergonômico com padding lateral (`pr-12`) e botão de envio tátil.
- [ ] **Tarefa 4.5:** Desenvolver a tela **Configurações**:
  - Dados da empresa conectada, latência em ms do servidor local e opção de logout.

### Fase 5: Integração de Ponta a Ponta e Validação
- [ ] **Tarefa 5.1:** Executar o Agente Local e o Backend Express simultaneamente e confirmar o handshake do WebSocket.
- [ ] **Tarefa 5.2:** Testar o Dashboard no navegador mobile: confirmar que os dados reais do `TGA.FDB` chegam ao celular em menos de 200ms.
- [ ] **Tarefa 5.3:** Testar o Copilot com perguntas em português coloquial ("quanto faturamos hoje?", "qual foi o item mais vendido?") e conferir a sintetização da resposta.
- [ ] **Tarefa 5.4:** Simular desconexão do agente e validar que o app exibe a badge vermelha e mensagens claras ao gestor.

---

## Verificação e Critérios de Aceite

1. **Segurança:** O agente local opera estritamente em transações Read-Only no Firebird; nenhum comando de escrita (`INSERT/UPDATE/DELETE`) é aceito.
2. **Performance:** As métricas do Dashboard carregam em menos de 300ms a partir do banco local via túnel reverso.
3. **Cota Gemini:** O Dashboard consome 0 tokens; somente interações ativas no chat acionam a API do Gemini.
4. **Ergonomia UI/UX:** Nenhum botão ou alvo de clique com menos de 48×48px; nenhum texto cortado com reticências no mobile; interface translúcida moderna e responsiva.
