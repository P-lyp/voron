---
trigger: always_on
description: Diretrizes mandatórias de desenvolvimento, contexto e banco de dados do projeto AI DB
---

# Diretrizes Mandatórias do Projeto AI DB (Voron)

## 1. Conexão ao Banco de Dados Supabase
- **Projeto Supabase Oficial:** O banco de dados deste projeto possui o `project_ref`: `lxucntgxipmpjjdlkgmi`.
- **Servidor MCP:** Utilize estritamente as ferramentas associadas a este projeto (`ai-db` / `lxucntgxipmpjjdlkgmi`).
- **Restrição de Acesso:** NUNCA execute consultas SQL, migrações ou inspeções em bancos de dados de outros projetos (como `ilidyxwajvlessgibstv` ou `zpcpcydqutomotjybuge`). Todas as operações de banco de dados deste workspace devem ser direcionadas exclusivamente para o projeto `lxucntgxipmpjjdlkgmi`.

## 2. Preservação de Contexto e Arquitetura
- Antes de propor refatorações estruturais ou criar novas rotas/módulos, consulte os documentos centrais:
  - [`ARCHITECTURE.md`](file:///c:/Users/Felipe/Desktop/Programação/AI%20DB/ARCHITECTURE.md): Topologia de WebSocket Reverso, pacotes (`shared`, `agent`, `backend`, `mobile`) e fluxo de dados.
  - [`STATE.md`](file:///c:/Users/Felipe/Desktop/Programação/AI%20DB/STATE.md): Estado atual de implementação, áreas sensíveis e roadmap.
  - [`docs/database-schema.md`](file:///c:/Users/Felipe/Desktop/Programação/AI%20DB/docs/database-schema.md): Modelagem do banco local Firebird 5.0 (`TGA.FDB`).

## 3. Contratos de Dados & Tipagem Forte
- **Single Source of Truth:** Qualquer DTO, interface de mensagem, envelope de túnel ou modelo compartilhado DEVE ser declarado em [`shared/types.ts`](file:///c:/Users/Felipe/Desktop/Programação/AI%20DB/shared/types.ts) e importado nos pacotes correspondentes.
- **Não Duplique Tipos:** Nunca crie interfaces espelho com os mesmos nomes dentro de `mobile/` ou `backend/` se elas pertencerem ao contrato compartilhado.

## 4. Padrões de Front-end e UI/UX
- Seguir estritamente as diretrizes **Apple HIG** e **Google Material Design 3**.
- Todos os elementos clicáveis ou interativos em telas móveis devem ter área útil de toque $\ge 44\times44\text{px}$ (Apple HIG) ou $\ge 48\times48\text{px}$ (M3).
- Manter feedback tátil e elástico suave em interações (`active:scale-[0.98]`).
