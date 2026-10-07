import { Router, Request, Response } from 'express';
import { CompanyService } from '../services/companyService.js';
import { AgentManager } from '../gateway/agentManager.js';
import { CustomerErpDTO } from '@ai-db/shared';
import { authenticateToken, requireCompanyAccess } from '../middleware/authMiddleware.js';

const router = Router();
const companyService = CompanyService.getInstance();
const agentManager = AgentManager.getInstance();

// Proteção Obrigatória: Exige autenticação em todas as operações de clientes da empresa
router.use(authenticateToken);

// 1. Busca direta de clientes no ERP Firebird via Agente (Isolamento por empresa)
router.get('/search', requireCompanyAccess, async (req: Request, res: Response) => {

  try {
    const companySlug = (req.query.companySlug as string) || (req.headers['x-company-id'] as string) || 'empresa-piloto-001';
    const busca = (req.query.busca as string) || '';
    const limite = Number(req.query.limite) || 30;

    const company = await companyService.getCompanyBySlug(companySlug);
    const statusCheck = companyService.isCompanySuspended(company);
    if (statusCheck.suspended) {
      return res.status(403).json({
        success: false,
        error: 'COMPANY_SUSPENDED',
        message: statusCheck.reason,
        data: [],
      });
    }

    if (!agentManager.isAgentOnline(companySlug)) {
      return res.status(503).json({
        success: false,
        error: `O servidor local da empresa [${companySlug}] está indisponível ou offline.`,
        isOnline: false,
        data: [],
      });
    }

    const result = await agentManager.sendQuery(
      companySlug,
      'consultar_clientes_erp',
      { busca, limite },
      8000
    );

    const rows: any[] = Array.isArray(result) ? result : (result as any)?.data || [];
    const customers: CustomerErpDTO[] = rows.map((row: any) => ({
      codcfo: (row.CODCFO || '').trim(),
      nome: (row.NOME || '').trim(),
      nomeFantasia: (row.NOMEFANTASIA || row.NOME || '').trim(),
      cpfCnpj: (row.CGCCFO || '').trim(),
      telefone: (row.TELEFONE || '').trim() || undefined,
      cidade: (row.CIDADE || '').trim() || undefined,
      uf: (row.UF || '').trim() || undefined,
      ativo: (row.ATIVO || 'T').trim(),
    }));

    return res.json({ success: true, data: customers });
  } catch (err: any) {
    console.error('Erro ao consultar clientes no ERP:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Erro ao consultar clientes no banco local', data: [] });
  }
});

// 2. Consulta fila de cadastros de clientes da empresa (Supabase)
router.get('/registrations', requireCompanyAccess, async (req: Request, res: Response) => {
  try {
    const companySlug = (req.query.companySlug as string) || (req.headers['x-company-id'] as string) || 'empresa-piloto-001';
    const status = (req.query.status as string) || undefined;

    const list = await companyService.getCustomerRegistrations(companySlug, status);
    return res.json(list);
  } catch (err: any) {
    console.error('Erro ao listar cadastros de clientes:', err.message);
    return res.status(500).json({ error: err.message || 'Erro ao carregar fila de cadastros' });
  }
});

// 3. Aprovação de cadastro pendente -> envia para o ERP Firebird
router.post('/registrations/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Utiliza o ID do usuário autenticado no sistema
    const userId = req.user!.id;

    const result = await companyService.approveCustomerRegistration(id, userId);
    return res.json(result);
  } catch (err: any) {
    console.error('Erro ao aprovar cadastro de cliente:', err.message);
    return res.status(400).json({ error: err.message || 'Falha ao aprovar cadastro' });
  }
});

// 4. Rejeição de cadastro pendente
router.post('/registrations/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason as string | undefined;

    const success = await companyService.rejectCustomerRegistration(id, reason);
    return res.json({ success });
  } catch (err: any) {
    console.error('Erro ao rejeitar cadastro de cliente:', err.message);
    return res.status(400).json({ error: err.message || 'Falha ao rejeitar cadastro' });
  }
});

export default router;
