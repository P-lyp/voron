# Estado Atual do Projeto & Roadmap (STATE.md)

> **Documento de Sincronização de Estado (Live State Tracker)**  
> **Última Atualização:** Outubro de 2026  
> **Como Usar:** Ao iniciar uma nova conversa com a IA, consulte este arquivo ou peça para ela ler o `STATE.md` para situá-la imediatamente sobre o progresso do projeto.

---

## 1. Status Geral dos Módulos

| Módulo / Funcionalidade | Status | Localização Principal | Observações |
| :--- | :---: | :--- | :--- |
| **Arquitetura Base & Monorepo** | Concluído | `package.json`, `shared/` | Monorepo npm com workspaces (`shared`, `agent`, `backend`, `mobile`). |
| **Contratos & Tipos Comuns** | Concluído | `shared/types.ts` | Single source of truth para DTOs, tools e envelopes de mensagem. |
| **Túnel WebSocket Reverso** | Concluído | `agent/src/tunnel.ts`, `backend/src/gateway/` | Conexão de saída estável com heartbeat (30s) e reconexão automática. |
| **Executor de SQL Local (Firebird)** | Concluído | `agent/src/executor.ts`, `agent/src/db-bridge.py` | Transações Read-Only sobre `TGA.FDB` com bridge de compatibilidade. |
| **Autenticação Multi-Tenant & RBAC** | Concluído | `backend/src/routes/auth.ts`, `mobile/src/context/AuthContext.tsx` | Supabase Auth integrado com vínculo via convite ou código de ativação. |
| **Portal Administrativo** | Concluído | `mobile/src/screens/admin/`, `backend/src/routes/admin.ts` | Gestão de empresas, tokens de agente, códigos de ativação e convites. |
| **Dashboard Executivo Móvel** | Concluído | `mobile/src/screens/DashboardScreen.tsx`, `components/dashboard/` | Cards de faturamento, financeiro, orçamentos, produtos e filtros. |
| **Copilot de IA (Gemini Flash)** | Concluído | `backend/src/ai/copilot.ts`, `mobile/src/screens/CopilotScreen.tsx` | Function Calling orquestrado despachando tools ao agente local. |
| **Consulta de Produtos & Saldos** | Concluído | `mobile/src/screens/ItemsScreen.tsx`, `backend/src/routes/items.ts` | Busca rápida com visualização de saldo físico e preços. |
| **Gestão e Cadastro de Clientes** | Concluído | `mobile/src/screens/CustomersScreen.tsx`, `CustomerRegistrationScreen.tsx` | Lista, formulário de cadastro e modal de link de auto-cadastro. |
| **Configuração PWA & UI/UX** | Concluído | `mobile/src/components/PwaInstallGate.tsx`, `public/` | Ícones oficiais, manifest PWA e ergonomia Apple HIG / M3 ($\ge 44\text{px}$). |
| **Auto-Update e Voron - Agente Local** | Concluído | `agent/src/updater.ts`, `backend/src/routes/agentUpdates.ts`, `scripts/package-agent.ts` | Sistema de atualização atômica (swap + rollback) servido via Render, nome padronizado para Voron e ausência de emojis. |

---

## 2. Áreas Sensíveis & Atenção Crítica (Não Alterar Sem Necessidade)

1. **Protocolo do Túnel WebSocket (`shared/types.ts` e `backend/src/gateway/agentManager.ts`):**
   - As interfaces `QueryRequestEnvelope` e `QueryResponseEnvelope` coordenam o tráfego assíncrono por `correlationId`. Não renomeie nem remova propriedades dessas interfaces para não romper a comunicação com agentes locais em produção.
2. **Conexão com Firebird (`agent/src/executor.ts`):**
   - As consultas SQL devem manter as condições de exclusão de cancelados e status do padrão TGA (ex: `STATUS <> 'C'` e `DATACANCELAMENTOMOV IS NULL` em `TMOV`).
3. **Restrição do Supabase (`.agents/rules/AGENTS.md`):**
   - O projeto oficial no Supabase é **`lxucntgxipmpjjdlkgmi`**. Nunca execute scripts ou comandos apontando para bancos de terceiros.
4. **Ergonomia e Tamanho de Alvo de Toque no Front-end:**
   - Qualquer botão, ícone interativo ou elemento clicável no mobile deve possuir no mínimo `min-h-[44px]` ou `min-h-[48px]` e padding proporcional para evitar cliques fantasmas em dispositivos móveis.

---

## 3. Próximos Passos & Oportunidades Futuras (Backlog Priorizado)

- [ ] **Notificações Push no PWA:** Alertar o gestor sobre vendas anormais, metas diárias batidas ou títulos financeiros com vencimento crítico.
- [ ] **Cache Inteligente no Backend:** Armazenar temporariamente consultas de dashboard para reduzir latência e poupar conexões repetidas no Firebird.
- [ ] **Métricas de Latência do Agente:** Exibir no Portal Admin a latência média das consultas de cada agente local conectado.
- [ ] **Suporte Offline Parcial:** Armazenar em IndexedDB local no mobile a lista básica de produtos e clientes favoritos para consulta mesmo sem internet.

---

## 4. Dica de Uso com Agentes de IA

Para iniciar um novo desenvolvimento sem perder tempo e sem risco de regressão, comece seu prompt com uma referência direta:
```text
"Por favor, leia o ARCHITECTURE.md e o STATE.md.
Vamos trabalhar no item [Nome da Tarefa].
Mantenha os padrões de tipos em shared/types.ts e os critérios de UI em mobile/."
```
