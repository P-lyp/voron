import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService.js';
import { CompanyService } from '../services/companyService.js';
import { authenticateToken, requireCompanyAccess } from '../middleware/authMiddleware.js';

export const notificationRouter = Router();
const notificationService = NotificationService.getInstance();
const companyService = CompanyService.getInstance();

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

    const companyId = req.user!.companyId!;
    const userId = req.user!.id;

    const ok = await notificationService.saveSubscription(companyId, userId, {
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

// 4. Lista as notificações recentes in-app da empresa
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId!;
    const notifications = await notificationService.listAppNotifications(companyId, 40);
    return res.json({ notifications });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Marca notificação individual como lida
notificationRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId!;
    const ok = await notificationService.markAsRead(id, companyId);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Marca todas como lidas
notificationRouter.post('/read-all', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId!;
    const ok = await notificationService.markAllAsRead(companyId);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Dispara notificação de teste (Admin ou Gestor testando se o PWA apita na hora)
notificationRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId!;
    const company = await companyService.getCompanyById(companyId);
    const companyName = company?.name || 'Voron ERP';

    const { tipo = 'sistema' } = req.body;

    let title = `Teste de Notificacao - ${companyName}`;
    let body = 'As notificacoes push do Voron estao funcionando perfeitamente!';

    if (tipo === 'offline') {
      title = `Teste: Servidor Local Offline - ${companyName}`;
      body = 'Simulacao: O servidor da empresa parou de responder ha 3 min.';
    } else if (tipo === 'fechamento') {
      title = `Teste: Fechamento do Dia - ${companyName}`;
      body = 'Simulacao: Hoje foram faturados R$ 48.950,00 em 29 vendas (+12.5% vs ontem).';
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

    return res.json({
      success: true,
      message: `Notificação enviada para ${result.sent} dispositivo(s).`,
      details: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
