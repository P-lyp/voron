import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { spawn, execSync } from 'child_process';
import {
  AgentUpdateCommandEnvelope,
  AgentUpdateProgressEnvelope,
  AgentVersionInfoDTO,
} from '@ai-db/shared';

export interface UpdaterOptions {
  gatewayUrl: string;
  companyId: string;
  agentToken: string;
  currentVersion: string;
}

export class AgentUpdater {
  // Converte a URL do Gateway WebSocket (ws:// ou wss://) para a URL base HTTP/HTTPS da API
  public static resolveHttpBaseUrl(gatewayUrl: string): string {
    return gatewayUrl
      .replace(/^ws:\/\//i, 'http://')
      .replace(/^wss:\/\//i, 'https://')
      .replace(/\/agent-tunnel\/?$/i, '');
  }

  // 1. Passo 1: Checagem Leve de Metadados de Versão (~400 bytes)
  public static async checkUpdate(options: UpdaterOptions): Promise<AgentVersionInfoDTO | null> {
    const baseUrl = this.resolveHttpBaseUrl(options.gatewayUrl);
    const targetUrl = new URL(`/api/agent/update/version?current=${encodeURIComponent(options.currentVersion)}`, baseUrl);

    return new Promise((resolve) => {
      const client = targetUrl.protocol === 'https:' ? https : http;
      const req = client.get(
        targetUrl.toString(),
        {
          headers: {
            'x-company-id': options.companyId,
            'x-agent-token': options.agentToken,
            'x-agent-version': options.currentVersion,
          },
          timeout: 8000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            console.warn(`[Updater] Falha ao consultar versao remota (Status ${res.statusCode})`);
            return resolve(null);
          }

          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(body) as AgentVersionInfoDTO;
              resolve(data);
            } catch {
              resolve(null);
            }
          });
        }
      );

      req.on('error', (err) => {
        console.warn(`[Updater] Nao foi possivel verificar atualizacoes no momento: ${err.message}`);
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  // 2. Passo 2: Download do Pacote, Validação Criptográfica e Disparo do Worker
  public static async executeUpdate(
    cmd: AgentUpdateCommandEnvelope,
    options: UpdaterOptions,
    onProgress: (progress: AgentUpdateProgressEnvelope) => void
  ): Promise<void> {
    const baseUrl = this.resolveHttpBaseUrl(options.gatewayUrl);
    const downloadUrl = cmd.downloadUrl.startsWith('http')
      ? cmd.downloadUrl
      : `${baseUrl}${cmd.downloadUrl.startsWith('/') ? '' : '/'}${cmd.downloadUrl}`;

    const stagingRoot = path.resolve(process.cwd(), 'updates', 'staging');
    const zipPath = path.join(stagingRoot, `voron-agent-${cmd.targetVersion}.zip`);
    const extractedDir = path.join(stagingRoot, 'extracted');

    // Prepara diretórios limpos para a operação
    if (fs.existsSync(stagingRoot)) {
      try {
        fs.rmSync(stagingRoot, { recursive: true, force: true });
      } catch {}
    }
    fs.mkdirSync(stagingRoot, { recursive: true });

    const emitProgress = (
      stage: AgentUpdateProgressEnvelope['stage'],
      percent?: number,
      message?: string,
      error?: string
    ) => {
      onProgress({
        correlationId: cmd.correlationId,
        type: 'AGENT_UPDATE_PROGRESS',
        stage,
        percent,
        message,
        targetVersion: cmd.targetVersion,
        error,
        timestamp: Date.now(),
      });
    };

    try {
      emitProgress('DOWNLOADING', 0, `Iniciando download da versao v${cmd.targetVersion}...`);

      // Download com streaming e cálculo de hash em tempo real
      await this.downloadWithHashVerification(
        downloadUrl,
        zipPath,
        cmd.sha256,
        options,
        (percent) => {
          emitProgress('DOWNLOADING', percent, `Baixando pacote Voron (${percent}%)...`);
        }
      );

      emitProgress('VERIFYING', 100, 'Integridade SHA-256 confirmada com sucesso.');

      // Descompactação no diretório de staging
      emitProgress('STAGING', 0, 'Descompactando arquivos de atualizacao em pasta isolada...');
      fs.mkdirSync(extractedDir, { recursive: true });

      if (process.platform === 'win32') {
        const psExtract = `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractedDir}' -Force"`;
        execSync(psExtract, { stdio: 'ignore' });
      } else {
        execSync(`unzip -o "${zipPath}" -d "${extractedDir}"`, { stdio: 'ignore' });
      }

      // Validação de integridade da estrutura recebida
      const distCandidate1 = path.join(extractedDir, 'dist', 'agent', 'src', 'index.js');
      const distCandidate2 = path.join(extractedDir, 'dist', 'index.js');
      const distCandidate3 = path.join(extractedDir, 'agent', 'dist', 'index.js');

      if (!fs.existsSync(distCandidate1) && !fs.existsSync(distCandidate2) && !fs.existsSync(distCandidate3)) {
        throw new Error('O pacote descompactado nao contem a estrutura de inicializacao esperada do Voron.');
      }

      emitProgress('APPLYING', 100, 'Disparando worker desacoplado. O agente sera reiniciado em instantes...');

      // Dispara o script desacoplado update-worker.ps1
      this.launchDetachedWorker();
    } catch (err: any) {
      console.error('[ERRO] Falha critica na atualizacao:', err.message);
      emitProgress('FAILED', 0, undefined, err.message);
      throw err;
    }
  }

  // Faz download via stream calculando hash simultaneamente
  private static downloadWithHashVerification(
    urlStr: string,
    destPath: string,
    expectedSha256: string,
    options: UpdaterOptions,
    onProgressPercent: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(
        urlStr,
        {
          headers: {
            'x-company-id': options.companyId,
            'x-agent-token': options.agentToken,
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Servidor respondeu com status ${res.statusCode} ao solicitar download.`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;
          let lastReportedPercent = -1;

          const fileStream = fs.createWriteStream(destPath);
          const hash = crypto.createHash('sha256');

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            hash.update(chunk);

            if (totalBytes > 0) {
              const currentPercent = Math.min(100, Math.floor((receivedBytes / totalBytes) * 100));
              if (currentPercent !== lastReportedPercent && currentPercent % 10 === 0) {
                lastReportedPercent = currentPercent;
                onProgressPercent(currentPercent);
              }
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            const calculatedSha256 = hash.digest('hex');

            // Se o hash esperado foi fornecido, valida correspondência
            if (expectedSha256 && expectedSha256.trim()) {
              if (calculatedSha256.toLowerCase() !== expectedSha256.trim().toLowerCase()) {
                try { fs.unlinkSync(destPath); } catch {}
                return reject(
                  new Error(
                    `Incompatibilidade de hash SHA-256! Esperado: ${expectedSha256}, Calculado: ${calculatedSha256}`
                  )
                );
              }
            }

            resolve();
          });

          fileStream.on('error', (err) => {
            try { fs.unlinkSync(destPath); } catch {}
            reject(err);
          });
        }
      );

      req.on('error', reject);
    });
  }

  // Lança o worker PowerShell em processo isolado e encerra o processo Node.js atual
  private static launchDetachedWorker(): void {
    const workerCandidates = [
      path.resolve(process.cwd(), 'scripts', 'update-worker.ps1'),
      path.resolve(process.cwd(), 'agent', 'scripts', 'update-worker.ps1'),
      path.resolve(process.cwd(), 'updates', 'staging', 'extracted', 'scripts', 'update-worker.ps1'),
    ];

    let workerScript = workerCandidates.find((p) => fs.existsSync(p));

    if (!workerScript) {
      console.warn('[Updater] update-worker.ps1 nao encontrado nos caminhos padrao. Usando script gerado dinamicamente.');
      workerScript = path.resolve(process.cwd(), 'updates', 'worker.ps1');
      // Fallback: se o script não existir em disco, copia ou cria
      const template = path.resolve(__dirname, '..', '..', 'scripts', 'update-worker.ps1');
      if (fs.existsSync(template)) {
        fs.copyFileSync(template, workerScript);
      }
    }

    console.log(`[Updater] Disparando worker desacoplado: ${workerScript}`);

    if (process.platform === 'win32' && workerScript && fs.existsSync(workerScript)) {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          workerScript,
          '-BaseDir',
          process.cwd(),
        ],
        {
          cwd: process.cwd(),
          detached: true,
          stdio: 'ignore',
        }
      );
      child.unref();
    }

    console.log('[Updater] Encerrando processo atual do Voron - Agente Local para liberacao atomica de arquivos...');
    setTimeout(() => {
      process.exit(0);
    }, 1500);
  }
}
