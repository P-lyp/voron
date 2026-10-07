import dotenv from 'dotenv';
import net from 'net';
import { AgentTunnel } from './tunnel.js';
import { AgentUpdater } from './updater.js';

dotenv.config();

const AGENT_VERSION = process.env.AGENT_VERSION || '1.0.0';

// Trava de Instância Única: garante que jamais haverá dois processos do agente competindo pela mesma empresa
const LOCK_PORT = Number(process.env.AGENT_LOCK_PORT) || 3059;
const lockServer = net.createServer();

lockServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n[SINGLE INSTANCE] Ja existe outra instancia do Voron - Agente Local ativa nesta maquina (porta ${LOCK_PORT} em uso).`);
    console.warn('Encerrando processo duplicado para evitar desconexoes em loop.');
    process.exit(0);
  } else {
    console.error('[ERRO] Falha no socket de trava de instancia:', err.message);
  }
});

const companyId = process.env.COMPANY_ID || 'empresa-piloto-001';
const agentToken = process.env.AGENT_TOKEN || 'token-secreto-agente-001';
const gatewayUrl = process.env.CLOUD_GATEWAY_URL || 'ws://localhost:3001/agent-tunnel';

console.log('==================================================');
console.log('VORON - AGENTE LOCAL (FIREBIRD 5.0)');
console.log('==================================================');
console.log(`Empresa ID: ${companyId}`);
console.log(`Versao: v${AGENT_VERSION}`);
console.log(`Gateway Nuvem: ${gatewayUrl}`);

const tunnel = new AgentTunnel({
  gatewayUrl,
  companyId,
  agentToken,
  agentVersion: AGENT_VERSION,
});

async function runUpdateCheck(): Promise<void> {
  try {
    console.log('[Voron Updater] Verificando integridade e atualizacoes com a nuvem...');
    const updateInfo = await AgentUpdater.checkUpdate({
      gatewayUrl,
      companyId,
      agentToken,
      currentVersion: AGENT_VERSION,
    });

    if (updateInfo && updateInfo.hasUpdate) {
      console.log(`[Voron Updater] Nova versao disponivel: v${updateInfo.latest} (versao instalada: v${AGENT_VERSION})`);
      if (updateInfo.changelog && updateInfo.changelog.length > 0) {
        console.log(`Novidades: \n  - ${updateInfo.changelog.join('\n  - ')}`);
      }

      const autoUpdateEnabled = process.env.AUTO_UPDATE !== 'false';
      if (autoUpdateEnabled || updateInfo.isMandatory) {
        console.log('[Voron Updater] Disparando atualizacao automatica programada...');
        await AgentUpdater.executeUpdate(
          {
            correlationId: `sched_${Date.now()}`,
            type: 'AGENT_UPDATE_COMMAND',
            targetVersion: updateInfo.latest,
            downloadUrl: updateInfo.downloadUrl || '/api/agent/update/download',
            sha256: updateInfo.sha256 || '',
          },
          {
            gatewayUrl,
            companyId,
            agentToken,
            currentVersion: AGENT_VERSION,
          },
          (progress) => {
            console.log(`[Progresso de Atualizacao] ${progress.stage} (${progress.percent ?? 0}%) | ${progress.message ?? ''}`);
          }
        );
      }
    } else {
      console.log('[Voron Updater] Voron - Agente Local ja esta na versao mais recente.');
    }
  } catch (err: any) {
    console.warn(`[Voron Updater] Falha na checagem periodica: ${err.message}`);
  }
}

lockServer.listen(LOCK_PORT, '127.0.0.1', () => {
  console.log(`Trava de instancia unica ativada (porta local ${LOCK_PORT}).`);
  tunnel.start();

  // Checagem inicial 12 segundos após o início e periódica a cada 4 horas
  setTimeout(runUpdateCheck, 12000);
  setInterval(runUpdateCheck, 4 * 60 * 60 * 1000);
});

process.on('SIGINT', () => {
  console.log('\nEncerrando Voron - Agente Local com seguranca...');
  try { lockServer.close(); } catch {}
  tunnel.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nEncerrando Voron - Agente Local com seguranca...');
  try { lockServer.close(); } catch {}
  tunnel.stop();
  process.exit(0);
});
