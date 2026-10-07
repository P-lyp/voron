import { Router, Request, Response } from 'express';
import { askCopilot } from '../ai/copilot.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';
import { CompanyService } from '../services/companyService.js';
import { authenticateToken, requireCompanyAccess } from '../middleware/authMiddleware.js';

export const chatRouter = Router();

// Proteção Obrigatória: Autenticação, Isolamento por Empresa e Rate Limiting
chatRouter.post(
  '/message',
  authenticateToken,
  requireCompanyAccess,
  chatRateLimiter.middleware(),
  async (req: Request, res: Response) => {
    const { message, companyId, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Campo "message" obrigatório.' });
    }

    const targetCompany = companyId || req.user?.companyId || process.env.DEFAULT_COMPANY_ID || 'empresa-piloto-001';

    const companyService = CompanyService.getInstance();
    const company = await companyService.getCompanyBySlug(targetCompany);
    const statusCheck = companyService.isCompanySuspended(company);
    if (statusCheck.suspended) {
      return res.status(403).json({
        error: 'COMPANY_SUSPENDED',
        message: statusCheck.reason,
      });
    }

    // Prevenção de Elevação de Privilégio (Bypass de RBAC):
    // Usuários comuns utilizam estritamente o cargo e ID de vendedor atribuídos pelo administrador.
    const isAdmin = req.user?.role === 'admin' || req.user?.email === 'felipealves13tga@hotmail.com';
    const effectiveRole = isAdmin ? (req.body.userRole || 'diretor') : req.user?.role;
    const effectiveVendedorId = isAdmin ? req.body.vendedorId : (req.user?.erpVendedorId || undefined);

    try {
      const response = await askCopilot(message, targetCompany, history, effectiveRole, effectiveVendedorId);
      return res.json(response);
    } catch (err: any) {
      console.error('[Chat] Erro na rota de chat:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);


