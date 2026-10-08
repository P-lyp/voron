import { GoogleGenAI, Type } from '@google/genai';
import { AgentManager } from '../gateway/agentManager.js';
import { CompanyService } from '../services/companyService.js';
import { ToolName, CompanyDTO } from '@ai-db/shared';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSystemInstruction(company?: CompanyDTO, userRole?: string, vendedorId?: string): string {
  const companyName = company?.name || 'sua empresa';
  const codsVenda = company?.businessRules?.movimentos?.venda?.join(', ') || '2.2.03';
  const codsOrcamento = company?.businessRules?.movimentos?.orcamento?.join(', ') || '2.2.01';
  const tiposDoc = company?.businessRules?.financeiro?.tiposDocumento?.join(', ') || 'DP, BO';
  const moduloFin = company?.businessRules?.financeiro?.moduloAtivo || 'AMBOS';

  let roleRestriction = '';
  if (userRole === 'vendedor' && vendedorId) {
    roleRestriction = `
RESTRIÇÃO ESTRITA DE CARGO (VENDEDOR CÓDIGO ${vendedorId}):
- O usuário conectado é um VENDEDOR.
- Você tem permissão EXCLUSIVAMENTE para responder sobre vendas, orçamentos e clientes deste vendedor (CODVEN1 = '${vendedorId}').
- NUNCA informe o faturamento total da empresa, lucro, margem ou contas a pagar da empresa.
- Se ele perguntar sobre o total da loja ou despesas, informe educadamente que sua permissão contempla apenas os resultados individuais dele.
`;
  } else if (userRole === 'gerente') {
    roleRestriction = `
PERMISSÕES DO CARGO ATUAL (GERENTE):
- Você pode consultar o faturamento geral da loja, metas e o ranking da equipe.
- Não detalhe dados confidenciais de pró-labore ou despesas administrativas sensíveis.
`;
  }

  return `
Você é o Copilot de Negócios e Assistente Estratégico da empresa ${companyName}, operando sobre o ERP TGA Sistemas (banco Firebird 5.0).
Sua missão é responder perguntas com inteligência e precisão sobre vendas, orçamentos, financeiro, clientes e produtos.

Regras de Negócio e Contexto da Empresa:
1. VENDAS FATURADAS: Códigos de movimento configurados: [${codsVenda}] (tabela TMOV, STATUS <> 'C', DATACANCELAMENTOMOV IS NULL).
2. ORÇAMENTOS E PROPOSTAS: Códigos de movimento configurados: [${codsOrcamento}].
   - Controle de Faturamento no ERP (campo STATUSPEDIDO da tabela TMOV):
     * 'D' = Disponível / em aberto (sem faturamento, compõe o pipeline ativo de propostas).
     * 'P' = Parcialmente faturado (já gerou venda parcial, mas ainda restam itens pendentes).
     * 'A' = Atendido / Completamente faturado (já foi 100% faturado e virou venda concluída).
   - Ao responder sobre orçamentos em aberto, considere apenas os status 'D' e 'P'.
   - Quando perguntarem sobre orçamentos faturados ou convertidos em venda, considere o status 'A'.
3. CLIENTES: Tabela FCFO (campos: CODCFO, NOME, NOMEFANTASIA, CGCCFO, CIDADE). O relacionamento é SEMPRE TMOV.CODCFO = FCFO.CODCFO.
4. PRODUTOS: Tabela TPRODUTO com CODPRD e DESCRICAO / NOMEFANTASIA.
5. ITENS VENDIDOS: Tabela TMOVITENS vinculada com TMOV através de IDMOV (i.IDMOV = v.IDMOV) para vendas válidas, com QUANTIDADE e VALORTOTALITEM.
6. CONTAS A PAGAR E RECEBER: Tabela FLAN (PAGREC = 'R' ou 'P', STATUSLAN = 'A', tipos de documentos: [${tiposDoc}], módulo: ${moduloFin}) com filtro por DATAVENCIMENTO.
7. SALDO DE ESTOQUE: Tabela TPRODSALDO (SALDOFISICO2).
8. A data atual local do sistema (hoje) é ${getLocalDateString()}.
${roleRestriction}

Diretrizes Obrigatórias de Resposta Executiva (Padrão BLUF - Direto ao Ponto):
- SEJA DIRETO E OBJETIVO. Jamais use saudações ou enrolações como "Com certeza!", "Como você pediu...", "Analisando os dados...". Comece IMEDIATAMENTE com a resposta.
- ESTRUTURA EM 3 BLOCOS CURTOS:
  1. **Conclusão Principal**: Valor chave ou resposta direta em negrito na primeira linha (Ex: "Faturamento total: **R$ 48.250,00** (38 pedidos válidos)").
  2. **Destaques Chave**: 3 a 5 pontos mais importantes em tópicos limpos (bullets ou ranking curto).
  3. **Próximo Passo Estratégico**: 1 pergunta curta e provocativa sugerindo uma nova consulta analítica ou aprofundamento de dados que ajude na tomada de decisão (Ex: "Deseja ver a relação nominal desses clientes?", "Quer comparar com os mesmos dias da semana passada?").
- Moeda: Formate SEMPRE no padrão brasileiro: R$ 1.250,50.
- Economia de Tokens: Não gere tabelas prolixas em markdown. Os dados estruturados já são exibidos separadamente na interface gráfica. Concentre-se nos números e conclusões.

Limites Rígidos de Escopo e Ação (IMPORTANTE):
- Você é EXCLUSIVAMENTE um assistente de inteligência e consulta de dados (somente leitura).
- Você NÃO realiza ações operacionais: NÃO envia e-mails, NÃO envia WhatsApp/SMS, NÃO dispara notificações, NÃO gera cobranças e NÃO altera nenhum dado no ERP.
- NUNCA ofereça, sugira ou pergunte se o usuário deseja que você execute ações inexistentes (ex: NUNCA diga "Deseja que eu envie um lembrete?", "Posso notificar os clientes?", "Quer que eu envie cobrança automática?"). Suas perguntas de continuidade devem ser SEMPRE sobre consultas analíticas e detalhamento de dados do banco.
`;
}

// Definição das ferramentas para o Gemini
const toolsConfig = [
  {
    functionDeclarations: [
      {
        name: 'consultar_resumo_vendas',
        description: 'Consulta o resumo de faturamento total, quantidade de vendas válidas e ticket médio para um intervalo de datas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipoOperacao: {
              type: Type.STRING,
              description: "Tipo de operação: 'venda' (padrão) para faturamento ou 'orcamento' para orçamentos e propostas comerciais.",
            },
            statusPedido: {
              type: Type.STRING,
              description: "Filtro de status do orçamento: 'D' ou 'aberto' (pendente), 'P' ou 'parcial', 'A' ou 'faturado' (convertido), 'todos'.",
            },
            dataInicio: {
              type: Type.STRING,
              description: 'Data de início no formato YYYY-MM-DD. Deixe vazio para todo o histórico.',
            },
            dataFim: {
              type: Type.STRING,
              description: 'Data final no formato YYYY-MM-DD.',
            },
          },
        },
      },
      {
        name: 'consultar_pedidos_orcamentos',
        description: 'Consulta a listagem de propostas, orçamentos e pedidos individuais no ERP, com número do movimento, cliente, valor, data e status de faturamento (STATUSPEDIDO: D para em aberto, P para parcial, A para faturado).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipoOperacao: {
              type: Type.STRING,
              description: "Tipo de operação: 'orcamento' (padrão) ou 'venda'.",
            },
            statusPedido: {
              type: Type.STRING,
              description: "Filtro de status: 'D' (em aberto), 'P' (parcial), 'A' (faturado/convertido) ou 'todos'.",
            },
            dataInicio: {
              type: Type.STRING,
              description: 'Data de início no formato YYYY-MM-DD.',
            },
            dataFim: {
              type: Type.STRING,
              description: 'Data final no formato YYYY-MM-DD.',
            },
            busca: {
              type: Type.STRING,
              description: 'Número do movimento ou termo do nome do cliente.',
            },
            limite: {
              type: Type.INTEGER,
              description: 'Quantidade máxima de registros a retornar (padrão 15).',
            },
          },
        },
      },
      {
        name: 'consultar_ranking_produtos',
        description: 'Consulta o ranking dos produtos mais vendidos por valor ou quantidade no ERP, vinculando os itens faturados na tabela TMOVITENS às vendas na tabela TMOV através do campo IDMOV.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            limite: {
              type: Type.INTEGER,
              description: 'Quantidade de produtos a retornar (padrão 5).',
            },
            dataInicio: {
              type: Type.STRING,
              description: 'Data de início no formato YYYY-MM-DD.',
            },
            dataFim: {
              type: Type.STRING,
              description: 'Data de término no formato YYYY-MM-DD.',
            },
          },
        },
      },
      {
        name: 'consultar_ranking_clientes',
        description: 'Consulta o ranking dos clientes que mais compraram (maior valor faturado) em um período ou geral.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            limite: {
              type: Type.INTEGER,
              description: 'Quantidade de clientes a retornar (padrão 5).',
            },
            dataInicio: {
              type: Type.STRING,
              description: 'Data de início no formato YYYY-MM-DD.',
            },
            dataFim: {
              type: Type.STRING,
              description: 'Data de término no formato YYYY-MM-DD.',
            },
          },
        },
      },
      {
        name: 'consultar_fluxo_financeiro',
        description: 'Consulta a relação detalhada de contas a pagar e a receber pendentes ou em aberto na tabela FLAN, retornando fornecedor/cliente (NOMECFO), vencimento e valores, filtrando por data de vencimento (DATAVENCIMENTO) e tipo ("P" ou "R"). Desconsidera automaticamente previsões (CODTDO <> "PRE").',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipo: {
              type: Type.STRING,
              description: "Filtro opcional do tipo de lançamento: 'RECEBER' (ou 'R'), 'PAGAR' (ou 'P') ou 'TODOS'.",
            },
            dataInicio: {
              type: Type.STRING,
              description: 'Data inicial de vencimento no formato YYYY-MM-DD.',
            },
            dataFim: {
              type: Type.STRING,
              description: 'Data final de vencimento no formato YYYY-MM-DD.',
            },
            apenasPendentes: {
              type: Type.BOOLEAN,
              description: 'Se true, consulta apenas títulos em aberto/pendentes (STATUSLAN = "A"). Padrão: true.',
            },
          },
        },
      },
      {
        name: 'executar_consulta_leitura_segura',
        description: 'Executa um comando SQL SELECT direto no Firebird 5.0 para perguntas específicas não cobertas pelas outras ferramentas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            sql: {
              type: Type.STRING,
              description: 'Comando SQL SELECT válido para Firebird 5.0 (somente leitura).',
            },
          },
          required: ['sql'],
        },
      },
    ],
  },
];

// Cache em memória para perguntas repetidas (TTL: 3 minutos) - 0 chamadas de API
interface CacheEntry {
  response: {
    role: 'assistant';
    content: string;
    tableData?: any[];
    suggestedQuestions?: string[];
  };
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;

function normalizeQuery(companyId: string, text: string): string {
  return `${companyId}:${text.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function getFromCache(cacheKey: string) {
  const entry = queryCache.get(cacheKey);
  if (entry) {
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      console.log(`[Cache Hit] Resposta servida da memória: ${cacheKey}`);
      return entry.response;
    }
    queryCache.delete(cacheKey);
  }
  return null;
}

function saveToCache(cacheKey: string, response: any) {
  if (queryCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of queryCache.entries()) {
      if (now - v.timestamp >= CACHE_TTL_MS) {
        queryCache.delete(k);
      }
    }
  }
  queryCache.set(cacheKey, { response, timestamp: Date.now() });
}

// Sanitização e projeção de dados para não estourar tokens do plano gratuito
function sanitizeToolOutput(data: any): any {
  if (!Array.isArray(data)) {
    return data;
  }
  // Envia no máximo 5 registros para a IA raciocinar com economia de tokens
  const limited = data.slice(0, 5);
  return limited.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== undefined && v !== '') {
        clean[k] = typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(2)) : v;
      }
    }
    return clean;
  });
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export async function askCopilot(
  userMessage: string,
  companyId: string = 'empresa-piloto-001',
  history?: ChatHistoryItem[],
  userRole?: string,
  vendedorId?: string
) {
  const companyService = CompanyService.getInstance();
  const company = await companyService.getCompanyBySlug(companyId);

  const cacheKey = normalizeQuery(`${companyId}:${userRole || 'dono'}:${vendedorId || ''}`, userMessage);

  // Se não houver histórico anterior acumulado, aproveita o cache de curto prazo
  const isInitialQuestion = !history || history.length === 0;
  if (isInitialQuestion) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const aiClient = getAiClient();

  if (!aiClient) {
    return {
      role: 'assistant',
      content:
        '**Chave da API do Gemini não configurada**\n\nPara conversar comigo e fazer perguntas em linguagem natural sobre o seu banco de dados, adicione sua chave gratuita do Gemini no arquivo `backend/.env`:\n\n```env\nGEMINI_API_KEY=sua_chave_aqui\n```\n\n*(Você pode obter sua chave gratuitamente em https://aistudio.google.com)*\n\nEnquanto isso, o **Dashboard Executivo** continua funcionando 100% ao vivo com os dados do seu Firebird!',
      suggestedQuestions: [
        'Quanto faturamos no total?',
        'Quais os 3 produtos mais vendidos?',
        'Como está o contas a receber e a pagar?',
      ],
    };
  }

  const manager = AgentManager.getInstance();
  if (!manager.isAgentOnline(companyId)) {
    return {
      role: 'assistant',
      content:
        '**Servidor Local Indisponível**\n\nNão foi possível conectar ao servidor da sua loja física. Verifique se o computador principal está ligado e com o agente em execução.',
    };
  }

  // Modelos suportados no SDK oficial @google/genai com base no volume de cotas (RPD/RPM)
  const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const candidateModels = Array.from(
    new Set([
      defaultModel,
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
    ])
  );

  // Sliding window enxuta: últimos 4 turnos sem reenviar tabelas antigas
  const recentHistory = (history || [])
    .slice(-4)
    .filter((h) => h.content && (h.role === 'user' || h.role === 'assistant' || h.role === 'model'))
    .map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content.slice(0, 500) }],
    }));

  const initialContents = [
    ...recentHistory,
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ];

  const systemInstruction = getSystemInstruction(company, userRole, vendedorId);

  for (const model of candidateModels) {
    try {
      console.log(`[Copilot] Consultando Gemini com modelo ${model}...`);

      let currentContents: any[] = [...initialContents];
      let tableData: any[] | undefined = undefined;
      const MAX_TOOL_TURNS = 3;
      let finalText = '';

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const isLastAllowedTurn = turn === MAX_TOOL_TURNS - 1;

        const response = await aiClient.models.generateContent({
          model,
          contents: currentContents as any,
          config: {
            systemInstruction,
            // No último turno omitimos tools para forçar o fechamento textual
            tools: isLastAllowedTurn ? undefined : (toolsConfig as any),
          },
        });

        const candidate = response.candidates?.[0];
        const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

        // Se o Gemini não pediu nenhuma ferramenta, extrai o texto final e encerra o loop
        if (!functionCalls || functionCalls.length === 0) {
          const textParts = candidate?.content?.parts?.filter((p: any) => p.text && !p.thought);
          if (textParts && textParts.length > 0) {
            finalText = textParts.map((p: any) => p.text).join('\n');
          } else {
            finalText = response.text || '';
          }
          break;
        }

        // Executa todas as ferramentas pedidas pelo Gemini neste turno
        const toolResultsParts: any[] = [];

        for (const part of functionCalls) {
          const call = part.functionCall!;
          const toolName = call.name as ToolName;
          const args = (call.args || {}) as Record<string, any>;

          // Injeta regras da empresa e restrição de vendedor
          if (
            toolName === 'consultar_resumo_vendas' ||
            toolName === 'consultar_ranking_produtos' ||
            toolName === 'consultar_ranking_clientes' ||
            toolName === 'consultar_pedidos_orcamentos'
          ) {
            if (!args.codigosVenda && company.businessRules?.movimentos?.venda) {
              args.codigosVenda = company.businessRules.movimentos.venda;
            }
            if (!args.codigosOrcamento && company.businessRules?.movimentos?.orcamento) {
              args.codigosOrcamento = company.businessRules.movimentos.orcamento;
            }
            if (vendedorId && !args.vendedorId) {
              args.vendedorId = vendedorId;
            }
          } else if (toolName === 'consultar_fluxo_financeiro') {
            if (!args.tiposDocumento && company.businessRules?.financeiro?.tiposDocumento) {
              args.tiposDocumento = company.businessRules.financeiro.tiposDocumento;
            }
            if (args.excluirPrevisao === undefined && company.businessRules?.financeiro?.ignorarPrevisoes !== undefined) {
              args.excluirPrevisao = company.businessRules.financeiro.ignorarPrevisoes;
            }
          }

          // Blindagem contra consultas SQL não limitadas no Firebird
          if (toolName === 'executar_consulta_leitura_segura' && args.sql) {
            let sql = String(args.sql).trim();
            if (/^select\s+/i.test(sql) && !/first\s+\d+/i.test(sql) && !/rows\s+\d+/i.test(sql)) {
              sql = sql.replace(/^select\s+/i, 'SELECT FIRST 5 ');
              args.sql = sql;
            }
          }

          console.log(`[Gemini Copilot] (Turno ${turn + 1}) Invocando ferramenta: ${toolName}`, args);

          try {
            const queryData = await manager.sendQuery(companyId, toolName, args, 8000);

            // Guarda até 8 registros originais para renderização gráfica no frontend
            if (Array.isArray(queryData) && queryData.length > 0 && !tableData) {
              tableData = queryData.slice(0, 8);
            }

            // Para a IA, sanitiza e trunca a no máximo 5 registros (redução drástica de tokens)
            const sanitized = sanitizeToolOutput(queryData);

            toolResultsParts.push({
              functionResponse: {
                name: toolName,
                id: call.id,
                response: {
                  output: sanitized,
                },
              },
            });
          } catch (err: any) {
            toolResultsParts.push({
              functionResponse: {
                name: toolName,
                id: call.id,
                response: {
                  error: err.message,
                },
              },
            });
          }
        }

        // Alimenta o histórico com o retorno do modelo e as respostas das ferramentas
        currentContents.push(candidate!.content!);
        currentContents.push({
          role: 'user',
          parts: toolResultsParts,
        });
      }

      // Se o texto final ainda estiver vazio após as rodadas de ferramentas, solicita síntese final
      if (!finalText || finalText.trim() === '') {
        try {
          const recoveryResponse = await aiClient.models.generateContent({
            model,
            contents: [
              ...currentContents,
              {
                role: 'user',
                parts: [{ text: 'Com base em todos os dados obtidos pelas ferramentas acima, forneça a resposta executiva final direta ao usuário.' }],
              },
            ] as any,
            config: {
              systemInstruction,
            },
          });
          const textParts = recoveryResponse.candidates?.[0]?.content?.parts?.filter((p: any) => p.text && !p.thought);
          if (textParts && textParts.length > 0) {
            finalText = textParts.map((p: any) => p.text).join('\n');
          } else {
            finalText = recoveryResponse.text || 'Dados obtidos com sucesso.';
          }
        } catch {
          finalText = 'Dados obtidos com sucesso.';
        }
      }

      // Perguntas contextuais configuradas para a empresa
      const configuredQuestions = company.businessRules?.copilot?.sugestoesPerguntas;
      const suggestedQuestions = Array.isArray(configuredQuestions) && configuredQuestions.length > 0
        ? configuredQuestions
        : [
            'Quanto faturamos hoje em vendas?',
            'Quais orçamentos estão em aberto?',
            'Qual o ticket médio das vendas?',
          ];


      const finalResult = {
        role: 'assistant' as const,
        content: finalText,
        tableData,
        suggestedQuestions,
      };

      if (isInitialQuestion) {
        saveToCache(cacheKey, finalResult);
      }

      return finalResult;
    } catch (err: any) {
      console.warn(`[Aviso] Tentativa com ${model} falhou: ${err.message || err}`);

      const isRateLimit =
        err.status === 429 ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.message?.includes('quota');

      // Se for o último modelo testado e for Rate Limit, exibe o aviso amigável
      if (isRateLimit && model === candidateModels[candidateModels.length - 1]) {
        return {
          role: 'assistant' as const,
          content:
            '⏳ **Limite de requisições atingido no Plano Gratuito**\n\nO Google AI Studio possui cotas na camada gratuita. Por favor, aguarde alguns instantes antes de enviar a próxima pergunta.',
          suggestedQuestions: [
            'Quanto faturamos no total de vendas válidas?',
            'Quais os 3 produtos mais vendidos?',
            'Qual a posição de contas a receber e pagar?',
          ],
        };
      }

      // Se for o último modelo, propaga o erro
      if (model === candidateModels[candidateModels.length - 1]) {
        throw err;
      }
    }
  }

  return {
    role: 'assistant' as const,
    content: 'Não foi possível processar a consulta no momento.',
  };
}
