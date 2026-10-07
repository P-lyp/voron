import WebSocket from 'ws';
import {
  QueryRequestEnvelope,
  QueryResponseEnvelope,
  HeartbeatMessage,
  AgentUpdateCommandEnvelope,
} from '@ai-db/shared';
import { executeTool } from './executor.js';
import { AgentUpdater } from './updater.js';

export interface TunnelOptions {
  gatewayUrl: string;
  companyId: string;
  agentToken: string;
  agentVersion?: string;
  heartbeatIntervalMs?: number;
}

export class AgentTunnel {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isClosing = false;
  private reconnectAttempts = 0;

  constructor(private options: TunnelOptions) {}

  public start(): void {
    this.isClosing = false;
    this.connect();
  }

  public stop(): void {
    this.isClosing = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    if (this.isClosing) return;

    const version = this.options.agentVersion || process.env.AGENT_VERSION || '1.0.0';
    console.log(`Conectando ao Gateway em nuvem: ${this.options.gatewayUrl} (Voron - Agente Local v${version})...`);

    this.ws = new WebSocket(this.options.gatewayUrl, {
      headers: {
        'x-company-id': this.options.companyId,
        'x-agent-token': this.options.agentToken,
        'x-agent-version': version,
      },
    });

    this.ws.on('open', () => {
      console.log('Tunel WebSocket Reverso estabelecido com sucesso!');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const messageStr = data.toString('utf-8');
        const envelope = JSON.parse(messageStr);

        if (envelope.type === 'AGENT_UPDATE_COMMAND') {
          console.log(`[Update Command] Nova versao v${envelope.targetVersion} solicitada pela nuvem.`);
          this.handleUpdateCommand(envelope as AgentUpdateCommandEnvelope);
          return;
        }

        if (envelope.type === 'QUERY_REQUEST') {
          console.log(`[Query Request] Tool: ${envelope.toolName} (ID: ${envelope.correlationId})`);
          const response: QueryResponseEnvelope = await executeTool(envelope as QueryRequestEnvelope);
          console.log(`[Query Response] ID: ${response.correlationId} | Sucesso: ${response.success} (${response.executionTimeMs}ms)`);
          
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(response));
          }
        }
      } catch (err: any) {
        console.error('[ERRO] Falha ao processar mensagem recebida:', err.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.warn(`[AVISO] Tunel desconectado (codigo: ${code}, motivo: ${reason.toString() || 'sem detalhes'})`);
      this.cleanup();
      if (code === 4009) {
        console.warn('[AVISO] Conexao sobreposta/duplicada detectada pelo gateway. Aguardando 15s antes de reconectar...');
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 15000);
        return;
      }
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[ERRO] Falha no socket do tunel:', err.message);
    });
  }

  private startHeartbeat(): void {
    const interval = this.options.heartbeatIntervalMs || 30000;
    const version = this.options.agentVersion || process.env.AGENT_VERSION || '1.0.0';

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const ping: HeartbeatMessage = {
          type: 'HEARTBEAT',
          companyId: this.options.companyId,
          timestamp: Date.now(),
          version,
        };
        this.ws.send(JSON.stringify(ping));
      }
    }, interval);
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isClosing) return;

    this.reconnectAttempts++;
    // Backoff inteligente: 2s, 3s, 4.5s, 6.7s, máx 10s para recuperação rápida
    const delay = Math.round(Math.min(2000 * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 6)), 10000));
    console.log(`Tentando reconectar ao tunel em ${delay / 1000}s (tentativa #${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async handleUpdateCommand(cmd: AgentUpdateCommandEnvelope): Promise<void> {
    try {
      await AgentUpdater.executeUpdate(
        cmd,
        {
          gatewayUrl: this.options.gatewayUrl,
          companyId: this.options.companyId,
          agentToken: this.options.agentToken,
          currentVersion: this.options.agentVersion || process.env.AGENT_VERSION || '1.0.0',
        },
        (progress) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(progress));
          }
        }
      );
    } catch (err: any) {
      console.error('[ERRO] Falha ao processar comando de atualizacao:', err.message);
    }
  }
}

