import { Router, Request, Response } from 'express';
import { AgentManager } from '../gateway/agentManager.js';
import { CompanyService } from '../services/companyService.js';
import { authenticateToken, requireCompanyAccess } from '../middleware/authMiddleware.js';
import {
  DashboardOverviewDTO,
  DashboardTopProduct,
  DEFAULT_DASHBOARD_CARDS,
  DashboardDetailType,
  DashboardDetailsResponseDTO,
  DashboardOrderItemDTO,
  DashboardFinancialItemDTO,
} from '@ai-db/shared';

export const dashboardRouter = Router();
const companyService = CompanyService.getInstance();

// Proteção Obrigatória: Exige autenticação e isolamento por empresa
dashboardRouter.use(authenticateToken);
dashboardRouter.use(requireCompanyAccess);


export function getPreviousPeriodDates(
  period: string,
  dataInicio?: string,
  dataFim?: string
): { prevDataInicio: string; prevDataFim: string } | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Se período customizado via datas explícitas
  if (dataInicio && dataFim) {
    const [y1, m1, d1] = dataInicio.split('-').map(Number);
    const [y2, m2, d2] = dataFim.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);

    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (diffDays - 1));

    return {
      prevDataInicio: toISODate(prevStart),
      prevDataFim: toISODate(prevEnd),
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'dia' || !period || period === 'hoje' || period === 'today') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toISODate(yesterday);
    return { prevDataInicio: yStr, prevDataFim: yStr };
  }

  if (period === 'ontem' || period === 'yesterday') {
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const anteontemStr = toISODate(dayBeforeYesterday);
    return { prevDataInicio: anteontemStr, prevDataFim: anteontemStr };
  }

  if (period === 'semana' || period === '7d' || period === 'ultimos_7_dias') {
    const prevEnd = new Date(today);
    prevEnd.setDate(prevEnd.getDate() - 8);
    const prevStart = new Date(today);
    prevStart.setDate(prevStart.getDate() - 15);
    return {
      prevDataInicio: toISODate(prevStart),
      prevDataFim: toISODate(prevEnd),
    };
  }

  if (period === 'semana_passada' || period === 'semana_anterior') {
    const weekday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - weekday);
    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
    const startOfLastWeek = new Date(endOfLastWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);

    const prevEnd = new Date(startOfLastWeek);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    return {
      prevDataInicio: toISODate(prevStart),
      prevDataFim: toISODate(prevEnd),
    };
  }

  if (period === 'mes' || period === 'este_mes' || period === 'mtd') {
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      prevDataInicio: toISODate(prevMonthStart),
      prevDataFim: toISODate(prevMonthEnd),
    };
  }

  if (period === 'mes_anterior' || period === 'last_month') {
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return {
      prevDataInicio: toISODate(prevMonthStart),
      prevDataFim: toISODate(prevMonthEnd),
    };
  }

  if (period === '30d' || period === 'ultimos_30') {
    const prevEnd = new Date(today);
    prevEnd.setDate(prevEnd.getDate() - 31);
    const prevStart = new Date(today);
    prevStart.setDate(prevStart.getDate() - 61);
    return {
      prevDataInicio: toISODate(prevStart),
      prevDataFim: toISODate(prevEnd),
    };
  }

  if (period === 'ano' || period === 'este_ano' || period === 'ytd') {
    const prevYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    return {
      prevDataInicio: toISODate(prevYearStart),
      prevDataFim: toISODate(prevYearEnd),
    };
  }

  // Para 'total' / consolidado geral, não há comparativo anterior aplicável
  return null;
}

dashboardRouter.get('/overview', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || process.env.DEFAULT_COMPANY_ID || 'empresa-piloto-001';
  const manager = AgentManager.getInstance();
  const company = await companyService.getCompanyBySlug(companyId);
  const statusCheck = companyService.isCompanySuspended(company);
  if (statusCheck.suspended) {
    return res.status(403).json({
      error: 'COMPANY_SUSPENDED',
      message: statusCheck.reason,
      company: {
        id: company.id,
        slug: company.slug,
        name: company.name,
        isActive: company.isActive,
        activeUntil: company.activeUntil,
        blockedReason: company.blockedReason,
      },
    });
  }

  const cardsConfig = company.businessRules?.visao_geral?.cards || DEFAULT_DASHBOARD_CARDS;
  const isOnline = manager.isAgentOnline(companyId);

  const metaConfig = company.businessRules?.notificacoes?.metas;
  const dailyGoalEnabled = metaConfig?.habilitado !== false;
  const dailyGoal = Number(metaConfig?.valorMetaDiaria) || 0;

  if (!isOnline) {
    return res.json({
      companyName: company.name,
      isOnline: false,
      revenueToday: 0,
      revenueYesterday: 0,
      growthVsYesterdayPercent: 0,
      salesCountToday: 0,
      averageTicketToday: 0,
      receivablesToday: 0,
      payablesToday: 0,
      topProducts: [],
      cardsConfig,
      dailyGoal,
      dailyGoalEnabled,
      updatedAt: new Date().toISOString(),
    } as DashboardOverviewDTO);
  }

  try {
    const period = (req.query.period as string) || 'dia';
    const dataInicio = req.query.dataInicio as string | undefined;
    const dataFim = req.query.dataFim as string | undefined;
    const vendedorId = req.query.vendedorId as string | undefined;

    const codigosVenda = company.businessRules?.movimentos?.venda || ['2.2.03'];
    const codigosOrcamento = company.businessRules?.movimentos?.orcamento || ['2.2.01'];
    const tiposDocumento = company.businessRules?.financeiro?.tiposDocumento || ['DP', 'BO'];
    const excluirPrevisao = company.businessRules?.financeiro?.ignorarPrevisoes ?? true;
    const moduloFinanceiro = company.businessRules?.financeiro?.moduloAtivo || 'AMBOS';

    // Checagem de quais cards estão habilitados para a empresa
    const isCardAtivo = (id: string) => {
      const c = cardsConfig.find((item) => item.id === id);
      return c ? c.ativo : true;
    };

    const faturamentoAtivo = isCardAtivo('faturamento');
    const orcamentosAtivo = isCardAtivo('orcamentos');
    const produtosAtivo = isCardAtivo('produtos');
    const financeiroAtivo = isCardAtivo('financeiro');

    // Período comparativo anterior real
    const prevPeriod = getPreviousPeriodDates(period, dataInicio, dataFim);

    // Consultas paralelas através do túnel reverso apenas para os módulos ativos (economia de chamadas ao Firebird)
    const [salesSummary, prevSalesSummary, quotesSummary, topProductsData, financeData] = await Promise.all([
      faturamentoAtivo
        ? manager.sendQuery(companyId, 'consultar_resumo_vendas', {
            period,
            dataInicio,
            dataFim,
            tipoOperacao: 'venda',
            codigosVenda,
            vendedorId,
          }).catch(() => [{ TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 }])
        : Promise.resolve([{ TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 }]),

      faturamentoAtivo && prevPeriod
        ? manager.sendQuery(companyId, 'consultar_resumo_vendas', {
            dataInicio: prevPeriod.prevDataInicio,
            dataFim: prevPeriod.prevDataFim,
            tipoOperacao: 'venda',
            codigosVenda,
            vendedorId,
          }).catch(() => [{ TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 }])
        : Promise.resolve([{ TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 }]),

      orcamentosAtivo
        ? manager.sendQuery(companyId, 'consultar_resumo_vendas', {
            period,
            dataInicio,
            dataFim,
            tipoOperacao: 'orcamento',
            codigosOrcamento,
            vendedorId,
          }).catch(() => [{ TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 }])
        : Promise.resolve([{ TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 }]),

      produtosAtivo
        ? manager.sendQuery(companyId, 'consultar_ranking_produtos', {
            period,
            dataInicio,
            dataFim,
            limite: 3,
            codigosVenda,
            vendedorId,
          }).catch(() => [])
        : Promise.resolve([]),

      financeiroAtivo
        ? manager.sendQuery(companyId, 'consultar_fluxo_financeiro', {
            period,
            dataInicio,
            dataFim,
            consolidado: true,
            apenasPendentes: true,
            excluirPrevisao,
            tiposDocumento,
            tipo: moduloFinanceiro,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const salesItem = salesSummary?.[0] || { TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 };
    const revenue = Number(salesItem.FATURAMENTO_TOTAL || 0);
    const salesCount = Number(salesItem.TOTAL_VENDAS || 0);
    const averageTicket = Number(salesItem.TICKET_MEDIO || 0);

    const prevSalesItem = prevSalesSummary?.[0] || { TOTAL_VENDAS: 0, FATURAMENTO_TOTAL: 0, TICKET_MEDIO: 0 };
    const prevRevenue = Number(prevSalesItem.FATURAMENTO_TOTAL || 0);

    // Cálculo real do crescimento percentual vs período anterior
    let growthVsYesterdayPercent = 0;
    if (prevRevenue > 0) {
      growthVsYesterdayPercent = Number((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1));
    } else if (revenue > 0) {
      growthVsYesterdayPercent = 100;
    } else {
      growthVsYesterdayPercent = 0;
    }

    const quotesItem = quotesSummary?.[0] || {
      TOTAL_VENDAS: 0,
      FATURAMENTO_TOTAL: 0,
      TICKET_MEDIO: 0,
      TOTAL_FATURADOS: 0,
      VALOR_FATURADOS: 0,
      TOTAL_PARCIAIS: 0,
      TOTAL_EMITIDOS: 0,
      VALOR_EMITIDO: 0,
    };
    const quotesTotal = Number(quotesItem.FATURAMENTO_TOTAL || 0);
    const quotesCount = Number(quotesItem.TOTAL_VENDAS || 0);
    const quotesConvertedCount = Number(quotesItem.TOTAL_FATURADOS || 0);
    const quotesConvertedTotal = Number(quotesItem.VALOR_FATURADOS || 0);
    const quotesPartialCount = Number(quotesItem.TOTAL_PARCIAIS || 0);
    const quotesTotalIssued = Number(quotesItem.VALOR_EMITIDO || 0);

    // Processamento do financeiro dinâmico (tabela FLAN com STATUSLAN='A', TIPODOC/CODTDO<>'PRE', DATAVENCIMENTO)
    let totalReceivables = 0;
    let totalPayables = 0;
    if (Array.isArray(financeData)) {
      for (const item of financeData) {
        const tipo = String(item.TIPO || item.PAGREC || '').toUpperCase();
        const valor = Number(
          item.VALORABERTO ??
          item.VALOR_ABERTO ??
          item.TOTAL_ABERTO ??
          item.VALORORIGINAL ??
          item.TOTAL_ORIGINAL ??
          0
        );
        if (tipo === 'R') {
          totalReceivables += valor;
        } else if (tipo === 'P') {
          totalPayables += valor;
        }
      }
    }

    // Mapeamento dinâmico dos produtos da tabela TMOVITENS vinculada com TMOV via IDMOV
    const topProducts: DashboardTopProduct[] = (topProductsData || []).map((p: any) => {
      const itemTotal = Number(p.VALOR_TOTAL || 0);
      const percent = revenue > 0 ? Math.round((itemTotal / revenue) * 100) : 0;
      return {
        code: p.CODPRD,
        name: p.DESCRICAO,
        quantity: Number(p.QTD_TOTAL || 0),
        total: itemTotal,
        unit: p.UNIDADE || 'UN',
        percent: percent > 0 ? percent : undefined,
      };
    });

    const response: DashboardOverviewDTO = {
      companyName: company.name,
      isOnline: true,
      revenueToday: revenue,
      revenueYesterday: prevRevenue,
      growthVsYesterdayPercent,
      salesCountToday: salesCount,
      averageTicketToday: averageTicket,
      quotesTotalToday: quotesTotal,
      quotesCountToday: quotesCount,
      quotesConvertedCountToday: quotesConvertedCount,
      quotesConvertedTotalToday: quotesConvertedTotal,
      quotesPartialCountToday: quotesPartialCount,
      quotesTotalIssuedToday: quotesTotalIssued,
      receivablesToday: totalReceivables,
      payablesToday: totalPayables,
      topProducts,
      cardsConfig,
      dailyGoal,
      dailyGoalEnabled,
      updatedAt: new Date().toISOString(),
    };

    return res.json(response);
  } catch (err: any) {
    console.error('[Dashboard] Erro ao compilar dados do Dashboard:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint de Detalhamento dos Cards da Visão Geral (Drill-Down)
dashboardRouter.get('/details', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || process.env.DEFAULT_COMPANY_ID || 'empresa-piloto-001';
  const tipo = (req.query.tipo as DashboardDetailType) || 'faturamento';
  const period = (req.query.period as any) || 'dia';
  const dataInicio = req.query.dataInicio as string | undefined;
  const dataFim = req.query.dataFim as string | undefined;
  const busca = (req.query.busca as string | undefined)?.trim();
  const statusPedido = (req.query.statusPedido as string | undefined)?.trim();
  const vendedorId = req.query.vendedorId as string | undefined;

  const manager = AgentManager.getInstance();
  const company = await companyService.getCompanyBySlug(companyId);
  const statusCheck = companyService.isCompanySuspended(company);
  if (statusCheck.suspended) {
    return res.status(403).json({
      error: 'COMPANY_SUSPENDED',
      message: statusCheck.reason,
    });
  }

  const isOnline = manager.isAgentOnline(companyId);
  if (!isOnline) {
    return res.status(503).json({
      error: 'SERVER_OFFLINE',
      message: 'O servidor local da loja está desconectado.',
    });
  }

  try {
    const codigosVenda = company.businessRules?.movimentos?.venda || ['2.2.03'];
    const codigosOrcamento = company.businessRules?.movimentos?.orcamento || ['2.2.01'];
    const tiposDocumento = company.businessRules?.financeiro?.tiposDocumento || ['DP', 'BO'];
    const excluirPrevisao = company.businessRules?.financeiro?.ignorarPrevisoes ?? true;

    if (tipo === 'faturamento') {
      const rows = await manager.sendQuery(companyId, 'consultar_pedidos_orcamentos', {
        period,
        dataInicio,
        dataFim,
        tipoOperacao: 'venda',
        codigosVenda,
        vendedorId,
        busca,
        limite: 2000,
      });

      const orders: DashboardOrderItemDTO[] = (rows || []).map((r: any) => ({
        idMov: Number(r.IDMOV),
        numeroMov: String(r.NUMEROMOV || '').trim(),
        codTmv: String(r.CODTMV || '').trim(),
        tipoMovimento: r.TIPO_MOVIMENTO ? String(r.TIPO_MOVIMENTO).trim() : undefined,
        dataEmissao: r.DATAEMISSAO ? String(r.DATAEMISSAO).split('T')[0] : '',
        valorLiquido: Number(r.VALORLIQUIDO || 0),
        statusPedido: r.STATUSPEDIDO ? String(r.STATUSPEDIDO).trim() : undefined,
        descricaoStatusPedido: r.DESCRICAO_STATUS_PEDIDO ? String(r.DESCRICAO_STATUS_PEDIDO).trim() : 'Faturado',
        nomeCliente: String(r.NOME_CLIENTE || 'Cliente Não Identificado').trim(),
        codCfo: r.CODCFO ? String(r.CODCFO).trim() : undefined,
        vendedor: r.VENDEDOR ? String(r.VENDEDOR).trim() : undefined,
      }));

      const totalValor = orders.reduce((acc, curr) => acc + curr.valorLiquido, 0);

      const response: DashboardDetailsResponseDTO = {
        tipo: 'faturamento',
        period,
        count: orders.length,
        totalValor,
        orders,
      };
      return res.json(response);
    }

    if (tipo === 'orcamentos') {
      const rows = await manager.sendQuery(companyId, 'consultar_pedidos_orcamentos', {
        period,
        dataInicio,
        dataFim,
        tipoOperacao: 'orcamento',
        codigosOrcamento,
        vendedorId,
        statusPedido: statusPedido || 'TODOS',
        busca,
        limite: 2000,
      });

      const orders: DashboardOrderItemDTO[] = (rows || []).map((r: any) => ({
        idMov: Number(r.IDMOV),
        numeroMov: String(r.NUMEROMOV || '').trim(),
        codTmv: String(r.CODTMV || '').trim(),
        tipoMovimento: r.TIPO_MOVIMENTO ? String(r.TIPO_MOVIMENTO).trim() : undefined,
        dataEmissao: r.DATAEMISSAO ? String(r.DATAEMISSAO).split('T')[0] : '',
        valorLiquido: Number(r.VALORLIQUIDO || 0),
        statusPedido: r.STATUSPEDIDO ? String(r.STATUSPEDIDO).trim() : undefined,
        descricaoStatusPedido: r.DESCRICAO_STATUS_PEDIDO ? String(r.DESCRICAO_STATUS_PEDIDO).trim() : 'Em Aberto',
        nomeCliente: String(r.NOME_CLIENTE || 'Cliente Não Identificado').trim(),
        codCfo: r.CODCFO ? String(r.CODCFO).trim() : undefined,
        vendedor: r.VENDEDOR ? String(r.VENDEDOR).trim() : undefined,
      }));

      const totalValor = orders.reduce((acc, curr) => acc + curr.valorLiquido, 0);

      const response: DashboardDetailsResponseDTO = {
        tipo: 'orcamentos',
        period,
        count: orders.length,
        totalValor,
        orders,
      };
      return res.json(response);
    }

    if (tipo === 'receber' || tipo === 'pagar') {
      const tipoFin = tipo === 'receber' ? 'R' : 'P';
      const rows = await manager.sendQuery(companyId, 'consultar_fluxo_financeiro', {
        period,
        dataInicio,
        dataFim,
        consolidado: false,
        apenasPendentes: true,
        excluirPrevisao,
        tiposDocumento,
        tipo: tipoFin,
        limite: 2000,
      });

      let financial: DashboardFinancialItemDTO[] = (rows || []).map((r: any) => ({
        idLan: Number(r.IDLAN),
        tipo: tipoFin,
        nomeCfo: String(r.NOMECFO || 'Sem Identificação').trim(),
        dataVencimento: r.DATAVENCIMENTO ? String(r.DATAVENCIMENTO).split('T')[0] : '',
        valorOriginal: Number(r.VALORORIGINAL || 0),
        valorAberto: Number(r.VALORABERTO ?? r.TOTAL_ABERTO ?? r.VALORORIGINAL ?? 0),
        statusLan: String(r.STATUSLAN || 'A').trim(),
      }));

      // Filtro local por busca textual se houver
      if (busca) {
        const query = busca.toLowerCase();
        financial = financial.filter((item) =>
          item.nomeCfo.toLowerCase().includes(query) || String(item.idLan).includes(query)
        );
      }

      const totalValor = financial.reduce((acc, curr) => acc + curr.valorAberto, 0);

      const response: DashboardDetailsResponseDTO = {
        tipo,
        period,
        count: financial.length,
        totalValor,
        financial,
      };
      return res.json(response);
    }

    return res.status(400).json({ error: 'Tipo de detalhamento inválido.' });
  } catch (err: any) {
    console.error('[Dashboard] Erro ao consultar detalhes do dashboard:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

