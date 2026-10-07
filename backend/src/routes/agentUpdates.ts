import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CompanyService } from '../services/companyService.js';
import { AgentVersionInfoDTO } from '@ai-db/shared';

export const agentUpdatesRouter = Router();

// Diretórios candidatos onde os arquivos de release podem residir
function getReleasesDir(): string {
  const candidates = [
    process.env.AGENT_RELEASES_DIR,
    path.resolve(process.cwd(), 'releases'),
    path.resolve(process.cwd(), 'backend', 'releases'),
    path.resolve(__dirname, '..', '..', 'releases'),
    path.resolve(__dirname, '..', '..', '..', 'releases'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  // Padrão de fallback: cria ou retorna 'releases' na raiz atual de execução
  const defaultDir = path.resolve(process.cwd(), 'releases');
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {}
  }
  return defaultDir;
}

// Função utilitária para comparação semântica de versões (ex: 1.1.0 > 1.0.0)
function isVersionNewer(remote: string, current: string): boolean {
  if (!current || !current.trim()) return true;
  const clean = (v: string) =>
    v
      .replace(/^[^\d]*/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const [rMaj = 0, rMin = 0, rPat = 0] = clean(remote);
  const [cMaj = 0, cMin = 0, cPat = 0] = clean(current);

  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

// 1. Passo 1: Checagem Leve de Metadados da Versão (~400 bytes)
agentUpdatesRouter.get('/version', async (req: Request, res: Response) => {
  try {
    const currentVersion =
      (req.query.current as string) ||
      (req.headers['x-agent-version'] as string) ||
      '';

    const releasesDir = getReleasesDir();
    const versionJsonPath = path.join(releasesDir, 'version.json');

    let latestVersion = '1.0.0';
    let sha256 = '';
    let sizeBytes = 0;
    let releaseDate = new Date().toISOString();
    let changelog: string[] = ['Versao estavel do Voron - Agente Local'];
    let isMandatory = false;

    if (fs.existsSync(versionJsonPath)) {
      try {
        const raw = fs.readFileSync(versionJsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        latestVersion = parsed.version || latestVersion;
        sha256 = parsed.sha256 || '';
        sizeBytes = parsed.sizeBytes || 0;
        releaseDate = parsed.releaseDate || releaseDate;
        changelog = parsed.changelog || changelog;
        isMandatory = !!parsed.isMandatory;
      } catch (err: any) {
        console.warn(`[AgentUpdates] Falha ao ler version.json: ${err.message}`);
      }
    } else {
      // Fallback para desenvolvimento: tenta ler a versão do package.json do agent
      const agentPkgPath = path.resolve(process.cwd(), 'agent', 'package.json');
      if (fs.existsSync(agentPkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(agentPkgPath, 'utf-8'));
          latestVersion = pkg.version || '1.0.0';
        } catch {}
      }
    }

    const hasUpdate = isVersionNewer(latestVersion, currentVersion);

    const info: AgentVersionInfoDTO = {
      current: currentVersion || undefined,
      latest: latestVersion,
      hasUpdate,
      isMandatory,
      sha256: hasUpdate ? sha256 : undefined,
      sizeBytes: hasUpdate ? sizeBytes : undefined,
      releaseDate: hasUpdate ? releaseDate : undefined,
      downloadUrl: hasUpdate ? '/api/agent/update/download' : undefined,
      changelog: hasUpdate ? changelog : undefined,
    };

    return res.json(info);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Passo 2: Download do Pacote Completo (Apenas quando hasUpdate === true)
agentUpdatesRouter.get('/download', async (req: Request, res: Response) => {
  try {
    const rawCompanyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string) || '';
    const agentToken = (req.headers['x-agent-token'] as string) || (req.query.token as string) || '';

    // Validação de autenticação para evitar downloads não autorizados
    if (!agentToken || !agentToken.trim()) {
      return res.status(401).json({ error: "Cabeçalho de autenticação 'x-agent-token' não fornecido." });
    }

    const validation = await CompanyService.getInstance().validateAgentToken(agentToken.trim());
    if (!validation.valid) {
      return res.status(403).json({ error: 'Token do agente inválido ou revogado.' });
    }

    const releasesDir = getReleasesDir();
    // Procura por voron-agent-latest.zip ou agent-latest.zip
    const candidates = [
      path.join(releasesDir, 'voron-agent-latest.zip'),
      path.join(releasesDir, 'agent-latest.zip'),
    ];

    let targetZip: string | null = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        targetZip = c;
        break;
      }
    }

    if (!targetZip) {
      return res.status(404).json({
        error: 'Pacote de atualização não encontrado no servidor. O build de release ainda não foi gerado.',
      });
    }

    const stat = fs.statSync(targetZip);
    const fileName = path.basename(targetZip);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const stream = fs.createReadStream(targetZip);
    stream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
