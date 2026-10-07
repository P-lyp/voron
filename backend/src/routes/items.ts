import { Router, Request, Response } from 'express';
import { AgentManager } from '../gateway/agentManager.js';
import { CompanyService } from '../services/companyService.js';
import { ItemProdutoDTO, ItensConfig } from '@ai-db/shared';
import { authenticateToken, requireCompanyAccess } from '../middleware/authMiddleware.js';

export const itemsRouter = Router();

// Proteção Obrigatória: Autenticação e isolamento por empresa
itemsRouter.use(authenticateToken);
itemsRouter.use(requireCompanyAccess);


itemsRouter.get('/', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'empresa-piloto-001';
  const busca = (req.query.busca as string) || '';
  const filtroEstoque = (req.query.filtroEstoque as string) || 'todos';
  const limite = Math.min(Math.max(Number(req.query.limite) || 40, 1), 100);

  // Busca configurações da empresa para saber qual tabela de preço e saldos utilizar
  const companyService = CompanyService.getInstance();
  const company = await companyService.getCompanyBySlug(companyId);
  const statusCheck = companyService.isCompanySuspended(company);
  if (statusCheck.suspended) {
    return res.status(403).json({
      success: false,
      error: 'COMPANY_SUSPENDED',
      message: statusCheck.reason,
      items: [],
    });
  }

  const itensConfig: ItensConfig = company?.businessRules?.itens || {
    tabelaPreco: 'PRECO1',
    exibirSaldoFisico: true,
    exibirSaldoFiscal: false,
  };

  // Proteção de sobrecarga do servidor: se o usuário não digitou nada, retorna lista vazia imediatamente
  if (!busca || !busca.trim()) {
    return res.json({
      success: true,
      count: 0,
      items: [],
      config: itensConfig,
    });
  }

  const manager = AgentManager.getInstance();

  if (!manager.isAgentOnline(companyId)) {
    return res.status(503).json({
      success: false,
      error: 'O agente local da empresa está desconectado. Verifique se o computador principal e o serviço estão em execução.',
      items: [],
      config: itensConfig,
    });
  }

  try {
    const rawData = await manager.sendQuery(
      companyId,
      'consultar_itens',
      {
        busca: busca.trim(),
        filtroEstoque,
        tabelaSaldo: itensConfig.exibirSaldoFisico ? 'saldo1' : 'saldo2',
        limite,
      },
      6000
    );

    const items: ItemProdutoDTO[] = (rawData || []).map((row: any) => {
      const preco1 = typeof row.PRECO1 === 'number' ? row.PRECO1 : parseFloat(row.PRECO1 || 0);
      const preco2 = typeof row.PRECO2 === 'number' ? row.PRECO2 : parseFloat(row.PRECO2 || 0);
      const saldoFisico = typeof row.SALDO_FISICO === 'number' ? row.SALDO_FISICO : parseFloat(row.SALDO_FISICO || 0);
      const saldoFiscal = typeof row.SALDO_FISCAL === 'number' ? row.SALDO_FISCAL : parseFloat(row.SALDO_FISCAL || 0);

      // Aplica a regra de negócio da empresa para preço ativo e saldo principal
      const preco = itensConfig.tabelaPreco === 'PRECO2' ? preco2 : preco1;
      const saldo = itensConfig.exibirSaldoFisico ? saldoFisico : saldoFiscal;

      return {
        codigo: String(row.CODIGO || '').trim(),
        nome: String(row.NOME || 'Item sem descrição').trim(),
        unidade: String(row.UNIDADE || 'UN').trim(),
        preco,
        preco1,
        preco2,
        saldo,
        saldoFisico,
        saldoFiscal,
        codigoBarras: row.CODIGO_BARRAS ? String(row.CODIGO_BARRAS).trim() : null,
      };
    });

    return res.json({
      success: true,
      count: items.length,
      items,
      config: itensConfig,
    });
  } catch (err: any) {
    console.error('[Items Route] Erro ao consultar itens:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Falha ao consultar itens no banco Firebird',
      items: [],
      config: itensConfig,
    });
  }
});
