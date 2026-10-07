import { Router, Request, Response } from 'express';
import { CompanyService } from '../services/companyService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

export const authRouter = Router();
const companyService = CompanyService.getInstance();

// 0. Checagem inteligente de e-mail (Login Unificado / Onboarding - Rota Pública Pré-Login)
authRouter.post('/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
    }

    const result = await companyService.checkEmailAccess(email);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 1. Sincronizar ou obter perfil de usuário autenticado (Blindado contra falsificação de identidade)
authRouter.post('/sync-profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Extrai identidade garantida pelo JWT validado do Supabase
    const userId = req.user!.id;
    const email = req.user!.email;
    const fullName = req.body?.fullName || undefined;

    const profile = await companyService.syncUserProfile(userId, email, fullName);
    let company = null;
    if (profile.companyId) {
      const companies = await companyService.getAllCompanies();
      company = companies.find((c) => c.id === profile.companyId) || null;
    }

    return res.json({ profile, company });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Consultar perfil atual (Restrito ao próprio usuário ou admin)
authRouter.get('/profile/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Acesso negado ao perfil solicitado.' });
    }

    const profile = await companyService.getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    let company = null;
    if (profile.companyId) {
      const companies = await companyService.getAllCompanies();
      company = companies.find((c) => c.id === profile.companyId) || null;
    }

    return res.json({ profile, company });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Vincular usuário a uma empresa através do Código de Ativação
authRouter.post('/claim-company', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { activationCode } = req.body || {};
    if (!activationCode) {
      return res.status(400).json({ error: 'Campo activationCode é obrigatório.' });
    }

    const result = await companyService.claimCompanyWithCode(userId, activationCode);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Validar código de ativação antes do envio (Autenticado)
authRouter.post('/verify-code', authenticateToken, async (req: Request, res: Response) => {

  try {
    const { activationCode } = req.body || {};
    if (!activationCode) {
      return res.status(400).json({ error: 'Código de ativação é obrigatório.' });
    }

    const company = await companyService.getCompanyByActivationCode(activationCode);
    if (!company) {
      return res.status(404).json({ valid: false, error: 'Código de ativação não encontrado.' });
    }

    return res.json({
      valid: true,
      companyId: company.id,
      companySlug: company.slug,
      companyName: company.name,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
