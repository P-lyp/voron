import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CompanyService } from '../services/companyService.js';
import { AgentManager } from '../gateway/agentManager.js';
import { ErpTipoMovimentoDTO, ErpVendedorDTO, UserRole } from '@ai-db/shared';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

export const adminRouter = Router();
const companyService = CompanyService.getInstance();
const agentManager = AgentManager.getInstance();

// Proteção Obrigatória: Toda rota administrativa exige JWT de Super Administrador
adminRouter.use(authenticateToken);
adminRouter.use(requireAdmin);


// 1. Listar todas as empresas cadastradas com status online ao vivo
adminRouter.get('/companies', async (_req: Request, res: Response) => {
  try {
    const companies = await companyService.getAllCompanies();
    const enriched = companies.map((c) => ({
      ...c,
      isOnline: agentManager.isAgentOnline(c.slug),
      agentVersion: agentManager.getAgentVersion(c.slug),
      updateProgress: agentManager.getAgentUpdateProgress(c.slug),
    }));
    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Criar nova empresa com token inicial
adminRouter.post('/companies', async (req: Request, res: Response) => {
  try {
    const { slug, name, token, phone } = req.body;
    if (!slug || !name || !token) {
      return res.status(400).json({ error: 'Campos slug, name e token são obrigatórios.' });
    }

    const created = await companyService.createCompany(
      slug.trim().toLowerCase(),
      name.trim(),
      token.trim(),
      phone ? String(phone).trim() : undefined
    );
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Obter detalhes e configurações de uma empresa
adminRouter.get('/companies/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const company = await companyService.getCompanyBySlug(slug);
    return res.json({
      ...company,
      isOnline: agentManager.isAgentOnline(slug),
      agentVersion: agentManager.getAgentVersion(slug),
      updateProgress: agentManager.getAgentUpdateProgress(slug),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3.1 Consultar tokens do agente da empresa
adminRouter.get('/companies/:slug/tokens', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const tokens = await companyService.getCompanyTokens(slug);
    return res.json({ success: true, count: tokens.length, data: tokens });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3.2 Gerar/adicionar novo token do agente para a empresa
adminRouter.post('/companies/:slug/tokens', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const { token, name } = req.body || {};
    const created = await companyService.createCompanyToken(slug, token, name);
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Salvar configurações e regras de negócio da empresa
adminRouter.put('/companies/:slug/config', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const { businessRules, name } = req.body;

    if (!businessRules) {
      return res.status(400).json({ error: 'businessRules é obrigatório.' });
    }

    const updated = await companyService.updateCompanyConfig(slug, businessRules, name);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4.1 Atualizar status de bloqueio e validade da empresa
adminRouter.put('/companies/:slug/status', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const { isActive, activeUntil, blockedReason } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ error: 'Campo isActive é obrigatório.' });
    }

    const updated = await companyService.updateCompanyStatus(
      slug,
      Boolean(isActive),
      activeUntil || null,
      blockedReason
    );
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Buscar tipos de movimentos diretamente do Firebird do cliente (2.1% e 2.2%)
adminRouter.get('/companies/:slug/erp-movimentos', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    if (!agentManager.isAgentOnline(slug)) {
      return res.status(503).json({
        error: 'O agente local da empresa está offline. Conecte o servidor da loja para consultar o ERP.',
      });
    }

    const rows = await agentManager.sendQuery(slug, 'consultar_tipos_movimento_erp', {}, 10000);
    const movimentos: ErpTipoMovimentoDTO[] = Array.isArray(rows)
      ? rows.map((r: any) => ({
          codtmv: String(r.CODTMV || '').trim(),
          descricao: String(r.DESCRICAO || '').trim(),
        }))
      : [];

    return res.json({ success: true, count: movimentos.length, data: movimentos });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Buscar vendedores cadastrados no Firebird para vínculo de usuários
adminRouter.get('/companies/:slug/erp-vendedores', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    if (!agentManager.isAgentOnline(slug)) {
      return res.status(503).json({
        error: 'O agente local da empresa está offline. Conecte o servidor da loja para consultar os vendedores.',
      });
    }

    const rows = await agentManager.sendQuery(slug, 'consultar_vendedores_erp', {}, 10000);
    const vendedores: ErpVendedorDTO[] = Array.isArray(rows)
      ? rows.map((r: any) => ({
          codven: String(r.CODVEN || '').trim(),
          nome: String(r.NOME || '').trim(),
        }))
      : [];

    return res.json({ success: true, count: vendedores.length, data: vendedores });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Teste de conexão e diagnóstico ao vivo com o Firebird
adminRouter.post('/companies/:slug/test-connection', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const isOnline = agentManager.isAgentOnline(slug);

    if (!isOnline) {
      return res.json({
        online: false,
        message: 'Servidor local offline. O agente do Windows não está conectado ao gateway.',
      });
    }

    const start = Date.now();
    const rows = await agentManager.sendQuery(
      slug,
      'executar_consulta_leitura_segura',
      { sql: 'SELECT 1 AS PING FROM RDB$DATABASE' },
      5000
    );
    const latencyMs = Date.now() - start;

    return res.json({
      online: true,
      latencyMs,
      message: `Conexão bem-sucedida com Firebird 5.0 (latência: ${latencyMs}ms)`,
      raw: rows,
    });
  } catch (err: any) {
    return res.status(500).json({ online: false, error: err.message });
  }
});

// 8. Consultar usuários e convites da empresa
adminRouter.get('/companies/:slug/users', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const data = await companyService.getCompanyUsersAndInvites(slug);
    return res.json({ success: true, ...data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 9. Criar convite para novo usuário na empresa
adminRouter.post('/companies/:slug/invites', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const { email, role, erpVendedorId } = req.body || {};
    if (!email || !role) {
      return res.status(400).json({ error: 'Campos email e role são obrigatórios.' });
    }

    const invite = await companyService.createCompanyInvite(slug, email, role as UserRole, erpVendedorId);
    return res.status(201).json({ success: true, data: invite });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 10. Remover convite pendente
adminRouter.delete('/companies/:slug/invites/:inviteId', async (req: Request, res: Response) => {
  try {
    const { inviteId } = req.params;
    const success = await companyService.deleteCompanyInvite(inviteId);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 11. Atualizar cargo ou vendedor vinculado de usuário
adminRouter.put('/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role, erpVendedorId } = req.body || {};
    if (!role) {
      return res.status(400).json({ error: 'Campo role é obrigatório.' });
    }

    const updated = await companyService.updateUserRole(userId, role as UserRole, erpVendedorId);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 12. Disparar comando de atualizacao remota para o Voron - Agente Local da empresa
adminRouter.post('/companies/:slug/update-agent', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    if (!agentManager.isAgentOnline(slug)) {
      return res.status(503).json({
        error: 'O Voron - Agente Local da empresa esta offline. Conecte o servidor da loja para atualizar.',
      });
    }

    let targetVersion = req.body?.targetVersion;
    let sha256 = req.body?.sha256;
    let downloadUrl = req.body?.downloadUrl || '/api/agent/update/download';
    const force = !!req.body?.force;

    if (!targetVersion || !sha256) {
      const candidates = [
        path.resolve(process.cwd(), 'releases', 'version.json'),
        path.resolve(process.cwd(), 'backend', 'releases', 'version.json'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(c, 'utf-8'));
            targetVersion = targetVersion || parsed.version;
            sha256 = sha256 || parsed.sha256;
            break;
          } catch {}
        }
      }
    }

    if (!targetVersion) {
      return res.status(400).json({ error: 'Nenhuma versao de atualizacao disponivel no servidor.' });
    }

    agentManager.sendUpdateCommand(slug, {
      targetVersion,
      downloadUrl,
      sha256: sha256 || '',
      force,
    });

    return res.json({
      success: true,
      message: `Comando de atualizacao para v${targetVersion} despachado com sucesso para o Voron - Agente Local [${slug}].`,
      targetVersion,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

