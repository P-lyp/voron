// ==========================================
// Contratos de Comunicação e Tipagens Comuns
// ==========================================

export type ToolName =
  | 'consultar_resumo_vendas'
  | 'consultar_ranking_produtos'
  | 'consultar_ranking_clientes'
  | 'consultar_fluxo_financeiro'
  | 'consultar_posicao_estoque'
  | 'consultar_itens'
  | 'consultar_historico_cliente'
  | 'consultar_tipos_movimento_erp'
  | 'consultar_vendedores_erp'
  | 'consultar_pedidos_orcamentos'
  | 'cadastrar_cliente_erp'
  | 'consultar_clientes_erp'
  | 'executar_consulta_leitura_segura';

// DTO de Consulta Direta de Itens do ERP
export interface ItemProdutoDTO {
  codigo: string;
  nome: string;
  unidade: string;
  preco: number;
  preco1?: number;
  preco2?: number;
  saldo: number;
  saldoFisico?: number; // Saldo 1 (Físico / Principal)
  saldoFiscal?: number; // Saldo 2 (Fiscal)
  codigoBarras?: string | null;
}

// Envelope de Envio (Express -> Agente Local)
export interface QueryRequestEnvelope {
  correlationId: string;
  type: 'QUERY_REQUEST';
  toolName: ToolName;
  params: Record<string, any>;
  timeoutMs?: number;
}

// Envelope de Resposta (Agente Local -> Express)
export interface QueryResponseEnvelope {
  correlationId: string;
  type: 'QUERY_RESPONSE';
  success: boolean;
  executionTimeMs: number;
  data?: any[];
  error?: string;
}

// Informações de Heartbeat
export interface HeartbeatMessage {
  type: 'HEARTBEAT';
  companyId: string;
  timestamp: number;
  version?: string;
}

// ==========================================
// Contratos de Auto-Update e Versionamento
// ==========================================

export interface AgentUpdateCommandEnvelope {
  correlationId: string;
  type: 'AGENT_UPDATE_COMMAND';
  targetVersion: string;
  downloadUrl: string;
  sha256: string;
  force?: boolean;
}

export type AgentUpdateStage =
  | 'IDLE'
  | 'CHECKING'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'STAGING'
  | 'APPLYING'
  | 'SUCCESS'
  | 'ROLLED_BACK'
  | 'FAILED';

export interface AgentUpdateProgressEnvelope {
  correlationId?: string;
  type: 'AGENT_UPDATE_PROGRESS';
  stage: AgentUpdateStage;
  percent?: number;
  message?: string;
  targetVersion: string;
  error?: string;
  timestamp: number;
}

export interface AgentVersionInfoDTO {
  current?: string;
  latest: string;
  hasUpdate: boolean;
  isMandatory?: boolean;
  sha256?: string;
  sizeBytes?: number;
  releaseDate?: string;
  downloadUrl?: string;
  changelog?: string[];
}

// DTO do Dashboard Executivo Móvel
export interface DashboardTopProduct {
  code: string;
  name: string;
  quantity: number;
  total: number;
  unit?: string;
  percent?: number;
}

export interface DashboardOverviewDTO {
  companyName: string;
  isOnline: boolean;
  lastPingMs?: number;
  revenueToday: number;
  revenueYesterday: number;
  growthVsYesterdayPercent: number;
  salesCountToday: number;
  averageTicketToday: number;
  quotesTotalToday?: number;
  quotesCountToday?: number;
  quotesConvertedCountToday?: number;
  quotesConvertedTotalToday?: number;
  quotesPartialCountToday?: number;
  quotesTotalIssuedToday?: number;
  receivablesToday: number;
  payablesToday: number;
  topProducts: DashboardTopProduct[];
  cardsConfig?: DashboardCardConfigItem[];
  updatedAt: string;
  periodLabel?: string;
  periodDateRange?: {
    startDate: string;
    endDate: string;
  };
  dailyGoal?: number;
  dailyGoalEnabled?: boolean;
}

export type DashboardPeriod =
  | 'dia'
  | 'ontem'
  | 'este_mes'
  | 'mes'
  | 'semana'
  | 'semana_passada'
  | 'mes_anterior'
  | '30d'
  | 'ano'
  | 'custom'
  | 'total';

// DTOs de Detalhes dos Cards da Visão Geral (Drill-Down Drawer)
export type DashboardDetailType = 'faturamento' | 'orcamentos' | 'receber' | 'pagar';

export interface DashboardOrderItemDTO {
  idMov: number;
  numeroMov: string;
  codTmv: string;
  tipoMovimento?: string;
  dataEmissao: string;
  valorLiquido: number;
  statusPedido?: string; // 'A' (Faturado), 'D' (Aberto), 'P' (Parcial)
  descricaoStatusPedido?: string;
  nomeCliente: string;
  codCfo?: string;
  vendedor?: string;
}

export interface DashboardFinancialItemDTO {
  idLan: number;
  tipo: 'R' | 'P';
  nomeCfo: string;
  dataVencimento: string;
  valorOriginal: number;
  valorAberto: number;
  statusLan: string;
}

export interface DashboardDetailsResponseDTO {
  tipo: DashboardDetailType;
  period: DashboardPeriod;
  periodLabel?: string;
  count: number;
  totalValor: number;
  orders?: DashboardOrderItemDTO[];
  financial?: DashboardFinancialItemDTO[];
}

// Mensagens do Chat Copilot
export interface ChatMessageDTO {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tableData?: Array<Record<string, any>>;
  suggestedQuestions?: string[];
}

// ==========================================
// Configurações Multi-Tenant & Regras ERP
// ==========================================

export interface ErpTipoMovimentoDTO {
  codtmv: string;
  descricao: string;
}

export interface ErpVendedorDTO {
  codven: string;
  nome: string;
}

export interface RolePermissions {
  ver_faturamento_total: boolean;
  ver_ranking: boolean;
  ver_orcamentos_todos: boolean;
  ver_financeiro_receber: boolean;
  ver_financeiro_pagar: boolean;
  copilot_escopo: 'total' | 'loja' | 'individual';
}

export type DashboardCardId = 'faturamento' | 'orcamentos' | 'financeiro' | 'produtos';

export interface DashboardCardConfigItem {
  id: DashboardCardId;
  label: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
  roles: {
    diretor: boolean;
    gerente: boolean;
    vendedor: boolean;
  };
}

export interface VisaoGeralConfig {
  cards: DashboardCardConfigItem[];
}

export const DEFAULT_DASHBOARD_CARDS: DashboardCardConfigItem[] = [
  {
    id: 'faturamento',
    label: 'Faturamento de Vendas',
    descricao: 'Total faturado, comparativo com período anterior e contagem de pedidos concluídos.',
    ativo: true,
    ordem: 1,
    roles: { diretor: true, gerente: true, vendedor: true },
  },
  {
    id: 'orcamentos',
    label: 'Orçamentos & Cotações',
    descricao: 'Pipeline de propostas abertas e negociações comerciais ativas.',
    ativo: true,
    ordem: 2,
    roles: { diretor: true, gerente: true, vendedor: true },
  },
  {
    id: 'financeiro',
    label: 'Ciclo Financeiro',
    descricao: 'Distribuição proporcional e valores de contas a receber versus a pagar.',
    ativo: true,
    ordem: 3,
    roles: { diretor: true, gerente: true, vendedor: false },
  },
  {
    id: 'produtos',
    label: 'Produtos Vendidos',
    descricao: 'Ranking dos itens mais vendidos com representatividade sobre o faturamento.',
    ativo: true,
    ordem: 4,
    roles: { diretor: true, gerente: true, vendedor: true },
  },
];

export interface BusinessRules {
  movimentos: {
    orcamento: string[];
    venda: string[];
  };
  financeiro: {
    moduloAtivo: 'RECEBER' | 'PAGAR' | 'AMBOS';
    tiposDocumento: string[];
    ignorarPrevisoes: boolean;
  };
  roles_permissions: {
    diretor: RolePermissions;
    gerente: RolePermissions;
    vendedor: RolePermissions;
  };
  copilot: {
    tomResposta: 'bluf' | 'detalhado';
    sugestoesPerguntas: string[];
    rateLimitEnabled?: boolean;
    rateLimitPerMinute?: number;
  };
  visao_geral?: VisaoGeralConfig;
  itens?: ItensConfig;
  cadastro_clientes?: CadastroClientesConfig;
  notificacoes?: NotificacoesConfig;
}

export interface NotificacaoOfflineConfig {
  habilitado: boolean;
  tempoToleranciaMinutos: number; // Tolerância sem heartbeat (ex: 2, 3, 5, 10 min)
  notificarReconexao: boolean; // Avisar quando a conexão com o ERP for restabelecida
}

export interface NotificacaoFechamentoConfig {
  habilitado: boolean;
  horarioEnvio: string; // Formato HH:MM (ex: "18:30")
  incluirComparativoOntem: boolean; // Comparativo % com o faturamento do dia anterior
  incluirTopProdutos: boolean; // Listar principais produtos vendidos do dia
}

export interface NotificacaoMetaConfig {
  habilitado: boolean;
  valorMetaDiaria: number; // Meta monetária diária em reais (ex: 30000)
  marcosPercentuais: number[]; // Marcos para notificar (ex: [50, 80, 100, 120])
  alertaPedidoExpressivo: boolean; // Notificar venda/pedido de valor excepcional
  valorMinimoPedidoExpressivo: number; // Piso mínimo do pedido expressivo em reais (ex: 5000)
}

export interface NotificacoesConfig {
  offline: NotificacaoOfflineConfig;
  fechamento: NotificacaoFechamentoConfig;
  metas: NotificacaoMetaConfig;
}

export const DEFAULT_NOTIFICACOES_CONFIG: NotificacoesConfig = {
  offline: {
    habilitado: true,
    tempoToleranciaMinutos: 3,
    notificarReconexao: true,
  },
  fechamento: {
    habilitado: true,
    horarioEnvio: '18:30',
    incluirComparativoOntem: true,
    incluirTopProdutos: true,
  },
  metas: {
    habilitado: true,
    valorMetaDiaria: 30000,
    marcosPercentuais: [50, 100],
    alertaPedidoExpressivo: false,
    valorMinimoPedidoExpressivo: 5000,
  },
};

export type NotificationType =
  | 'offline'
  | 'online'
  | 'fechamento'
  | 'meta'
  | 'pedido_expressivo'
  | 'sistema';

export interface AppNotificationDTO {
  id: string;
  companyId: string;
  userId?: string | null;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  dados?: Record<string, any>;
  lida: boolean;
  createdAt: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface CadastroClientesConfig {
  habilitado: boolean;
  modo: 'direto' | 'pre_aprovacao';
  whatsappContato?: string;
}

export interface CustomerRegistrationPayload {
  tipoPessoa: 'F' | 'J';
  nome: string;
  nomeFantasia?: string;
  cpfCnpj: string;
  rgIe?: string;
  inscricaoEstadual?: string;
  email?: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  idCidade?: number;
  indicadorIe?: 'C' | 'N' | 'I';
}

export type CustomerRegistrationStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'duplicado' | 'erro_agente';

export interface CustomerRegistrationRecord {
  id: string;
  companyId: string;
  tipoPessoa: 'F' | 'J';
  nome: string;
  nomeFantasia?: string | null;
  cpfCnpj: string;
  rgIe?: string | null;
  inscricaoEstadual?: string | null;
  indicadorIe?: 'C' | 'N' | 'I' | null;
  email?: string | null;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  idCidade?: number | null;
  status: CustomerRegistrationStatus;
  codcfoGerado?: string | null;
  erroMensagem?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
}

export interface CustomerErpDTO {
  codcfo: string;
  nome: string;
  nomeFantasia?: string;
  cpfCnpj: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  ativo?: string;
}

export interface ItensConfig {
  tabelaPreco: 'PRECO1' | 'PRECO2';
  exibirSaldoFisico: boolean; // Saldo 1 (Físico / Principal)
  exibirSaldoFiscal: boolean; // Saldo 2 (Fiscal)
}

export interface AgentTokenDTO {
  id: string;
  companyId?: string;
  token: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
}

export interface CompanyDTO {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  activeUntil?: string | null;
  blockedReason?: string | null;
  isOnline?: boolean;
  lastPingMs?: number;
  tokens?: AgentTokenDTO[];
  businessRules: BusinessRules;
  activationCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'diretor' | 'gerente' | 'vendedor';

export interface CompanyInviteDTO {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  erpVendedorId?: string | null;
  createdAt: string;
}

export interface UserProfileDTO {
  id: string;
  companyId: string | null;
  role: UserRole;
  erpVendedorId?: string | null;
  fullName: string;
  email?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EmailAuthStatus = 'registered' | 'first_access' | 'not_found';

export interface CheckEmailResultDTO {
  status: EmailAuthStatus;
  email: string;
  fullName?: string;
  companyName?: string;
  role?: UserRole;
  message?: string;
  whatsappSupport?: string;
}

