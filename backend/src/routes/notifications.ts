import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService.js';
import { CompanyService } from '../services/companyService.js';
import { authenticateToken, requireCompanyAccess } from '../middleware/authMiddleware.js';

export const notificationRouter = Router();
const notificationService = NotificationService.getInstance();
const companyService = CompanyService.getInstance();

// Helper para resolução determinística da empresa vinculada à requisição
async function resolveRequestCompany(req: Request) {
  const requested = (
    req.body?.companyId ||
    req.body?.companySlug ||
    req.query.companyId ||
    req.query.companySlug ||
    req.headers['x-company-id'] ||
    req.user?.companyId ||
    ''
  ).toString().trim();

  const user = req.user;
  const isMasterOrAdmin = user?.role === 'admin' || user?.email === 'felipealves13tga@hotmail.com';

  // 1. Se foi explicitamente informado e não é "null"/"undefined", busca a empresa correspondente
  if (requested && requested !== 'null' && requested !== 'undefined') {
    const comp = await companyService.getCompanyBySlug(requested);
    if (comp?.id) {
      return comp;
    }
  }

  // 2. Se o usuário tem empresa vinculada em seu perfil
  if (user?.companyId && user.companyId !== 'null' && user.companyId !== 'undefined') {
    const comp = await companyService.getCompanyById(user.companyId);
    if (comp?.id) {
      return comp;
    }
  }

  // 3. Administrador acessando sem empresa especificada: fallback para a empresa padrão
  if (isMasterOrAdmin) {
    return await companyService.getCompanyBySlug('empresa-piloto-001');
  }

  return null;
}

// 1. Rota pública para obter a chave pública VAPID necessária para a inscrição Web Push no PWA
notificationRouter.get('/vapid-key', (_req: Request, res: Response) => {
  const publicKey = notificationService.getPublicKey();
  res.json({ publicKey });
});

// A partir daqui, as rotas exigem autenticação
notificationRouter.use(authenticateToken);
notificationRouter.use(requireCompanyAccess);

// 2. Salva ou atualiza a inscrição Push do navegador/dispositivo
notificationRouter.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint, keys, userAgent } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Assinatura Push inválida (faltam endpoint ou chaves)' });
    }

    const company = await resolveRequestCompany(req);
    if (!company) {
      return res.status(400).json({ error: 'Empresa não identificada para associar a inscrição Push.' });
    }

    const userId = req.user?.id || null;

    const ok = await notificationService.saveSubscription(company.id, userId, {
      endpoint,
      keys,
      userAgent,
    });

    if (!ok) {
      return res.status(500).json({ error: 'Erro ao registrar assinatura no servidor' });
    }

    return res.status(201).json({ success: true, message: 'Dispositivo cadastrado para notificações' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Remove inscrição Push (usuário desativou)
notificationRouter.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint não fornecido' });
    }

    await notificationService.removeSubscription(endpoint);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Lista as notificações recentes in-app da empresa com paginação e filtros
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const company = await resolveRequestCompany(req);
    if (!company) {
      return res.status(400).json({ error: 'Empresa não identificada para listar notificações' });
    }

    const limit = req.query.limit ? Number(req.query.limit) : 40;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
    const tipo = (req.query.tipo as any) || undefined;

    const notifications = await notificationService.listAppNotifications(company.id, {
      limit,
      offset,
      unreadOnly,
      tipo,
    });
    return res.json({ notifications });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4b. Retorna a contagem exata de notificações pendentes não lidas
notificationRouter.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const company = await resolveRequestCompany(req);
    if (!company) {
      return res.status(400).json({ error: 'Empresa não identificada' });
    }

    const count = await notificationService.getUnreadCount(company.id);
    return res.json({ count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Marca notificação individual como lida
notificationRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const company = await resolveRequestCompany(req);
    if (!company) {
      return res.status(400).json({ error: 'Empresa não identificada' });
    }

    const ok = await notificationService.markAsRead(id, company.id);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Marca todas como lidas
notificationRouter.post('/read-all', async (req: Request, res: Response) => {
  try {
    const company = await resolveRequestCompany(req);
    if (!company) {
      return res.status(400).json({ error: 'Empresa não identificada' });
    }

    const ok = await notificationService.markAllAsRead(company.id);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Dispara notificação de teste (Admin ou Gestor testando se o PWA apita na hora)
notificationRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const company = await resolveRequestCompany(req);
    if (!company) {
      return res.status(400).json({ error: 'Empresa não identificada para disparo do teste de notificação' });
    }

    const companyId = company.id;
    const companyName = company.name || 'Voron ERP';

    const { tipo = 'sistema' } = req.body;

    let title = `Teste de Notificação - ${companyName}`;
    let body = 'As notificações push do Voron estão funcionando perfeitamente!';

    if (tipo === 'offline') {
      title = `Teste: Servidor Local Offline - ${companyName}`;
      body = 'Simulação: O servidor da empresa parou de responder há 3 min.';
    } else if (tipo === 'fechamento') {
      title = `Teste: Fechamento do Dia - ${companyName}`;
      body = 'Simulação: Hoje foram faturados R$ 48.950,00 em 29 vendas (+12.5% vs ontem).';
    } else if (tipo === 'meta') {
      title = `Teste: Meta do Dia Batida! (102%)`;
      body = `${companyName}: R$ 30.600,00 faturados hoje (Meta: R$ 30.000,00).`;
    }

    const result = await notificationService.sendPushToCompany(companyId, {
      title,
      body,
      tipo,
      data: { isTest: true },
    });

    let message = '';
    if (result.sent > 0) {
      message = `Notificação push enviada com sucesso para ${result.sent} aparelho(s)!`;
    } else if (result.failed > 0) {
      message = `Notificação registrada no app, porém o gateway push rejeitou a entrega para ${result.failed} aparelho(s).`;
    } else {
      message = `Notificação registrada na Central In-App. Nenhum dispositivo móvel encontrado cadastrado para a empresa ${companyName}.`;
    }

    return res.json({
      success: true,
      message,
      sent: result.sent,
      failed: result.failed,
      details: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
