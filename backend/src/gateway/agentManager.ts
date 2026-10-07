import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import {
  QueryRequestEnvelope,
  QueryResponseEnvelope,
  ToolName,
  AgentUpdateCommandEnvelope,
  AgentUpdateProgressEnvelope,
} from '@ai-db/shared';
import crypto from 'crypto';
import { CompanyService } from '../services/companyService.js';
import { NotificationService } from '../services/notificationService.js';

interface ConnectedAgent {
  companyId: string;
  companyUuid?: string;
  agentToken: string;
  ws: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
  latencyMs?: number;
  agentVersion?: string;
  lastUpdateProgress?: AgentUpdateProgressEnvelope;
}

export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, ConnectedAgent> = new Map();
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timer: NodeJS.Timeout;
    }
  > = new Map();
  private offlineTimers: Map<string, NodeJS.Timeout> = new Map();
  private offlineAlertsSent: Map<string, boolean> = new Map();

  private constructor() {}

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  public getConnectedCount(): number {
    return new Set(this.agents.values()).size;
  }

  public getAgent(identifier: string): ConnectedAgent | undefined {
    const direct = this.agents.get(identifier);
    if (direct) return direct;
    for (const agent of this.agents.values()) {
      if (agent.companyUuid === identifier || agent.companyId === identifier) {
        return agent;
      }
    }
    return undefined;
  }

  public async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const rawCompanyId = (req.headers['x-company-id'] as string) || '';
    const agentToken = (req.headers['x-agent-token'] as string) || '';
    const rawAgentVersion = (req.headers['x-agent-version'] as string) || '';

    // 1. Rejeição imediata se cabeçalho de token não for fornecido
    if (!agentToken || !agentToken.trim()) {
      console.warn(`[AgentManager] Conexao rejeitada: Cabecalho 'x-agent-token' nao fornecido.`);
      try {
        ws.close(4001, 'Token de autenticação não fornecido');
      } catch {}
      return;
    }

    // 2. Validação obrigatória do token através do CompanyService
    try {
      const validation = await CompanyService.getInstance().validateAgentToken(agentToken.trim());
      if (!validation.valid) {
        console.warn(`[AgentManager] Conexao rejeitada: Token do agente invalido ou revogado.`);
        try {
          ws.close(4003, 'Token de autenticação inválido ou revogado');
        } catch {}
        return;
      }

      // Se a conexão foi abortada/fechada antes da conclusão da validação assíncrona
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        return;
      }

      const companyId = validation.companySlug || rawCompanyId || 'empresa-piloto-001';
      const companyUuid = validation.companyId;

      console.log(`[AgentManager] Agente autenticado com sucesso para empresa: [${companyId}]${companyUuid ? ` (UUID: ${companyUuid})` : ''}${rawAgentVersion ? ` [v${rawAgentVersion}]` : ''}`);

      // Substitui conexão anterior se houver
      const existing = this.getAgent(companyId);
      if (existing && existing.ws !== ws) {
        console.log(`[AgentManager] Substituindo conexao anterior do agente para [${companyId}]`);
        try {
          existing.ws.close(4009, 'Nova conexão estabelecida para a empresa');
          setTimeout(() => {
            try {
              if (existing.ws.readyState !== WebSocket.CLOSED) {
                existing.ws.terminate();
              }
            } catch {}
          }, 1000);
        } catch {}
      }

      const agent: ConnectedAgent = {
        companyId,
        companyUuid,
        agentToken,
        ws,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        agentVersion: rawAgentVersion || undefined,
      };

      this.agents.set(companyId, agent);
      if (companyUuid && companyUuid !== companyId) {
        this.agents.set(companyUuid, agent);
      }

      // Cancela timer de queda pendente caso o agente tenha reconectado a tempo
      const pendingTimer = this.offlineTimers.get(companyId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        this.offlineTimers.delete(companyId);
      }

      // Se havia alerta de queda disparado, notifica restabelecimento
      if (this.offlineAlertsSent.get(companyId)) {
        this.offlineAlertsSent.delete(companyId);
        CompanyService.getInstance().getCompanyById(companyUuid || companyId).then((comp: any) => {
          if (comp && comp.businessRules?.notificacoes?.offline?.notificarReconexao !== false) {
            NotificationService.getInstance().notifyServerOnline(comp.id, comp.name).catch(() => {});
          }
        }).catch(() => {});
      }

      console.log(`[AgentManager] Agente conectado com sucesso para [${companyId}]! Total agentes ativos: ${this.getConnectedCount()}`);

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const messageStr = data.toString('utf-8');
          const payload = JSON.parse(messageStr);

          if (payload.type === 'HEARTBEAT') {
            agent.lastHeartbeat = new Date();
            if (payload.version) {
              agent.agentVersion = payload.version;
            }
            return;
          }

          if (payload.type === 'AGENT_UPDATE_PROGRESS') {
            const progress = payload as AgentUpdateProgressEnvelope;
            agent.lastUpdateProgress = progress;
            console.log(`[Update Progress] Empresa: [${companyId}] | Estagio: ${progress.stage} (${progress.percent ?? 0}%) | ${progress.message ?? ''}`);
            return;
          }

          if (payload.type === 'QUERY_RESPONSE') {
            const response = payload as QueryResponseEnvelope;
            const pending = this.pendingRequests.get(response.correlationId);
            if (pending) {
              clearTimeout(pending.timer);
              this.pendingRequests.delete(response.correlationId);

              if (response.success) {
                pending.resolve(response.data);
              } else {
                const err: any = new Error(response.error || (response as any).message || 'Erro na execução da consulta local');
                err.code = (response as any).code;
                err.existingClient = (response as any).existingClient;
                pending.reject(err);
              }
            }
          }
        } catch (err: any) {
          console.error('[AgentManager] Erro ao parsear mensagem do agente:', err.message);
        }
      });

      ws.on('close', (code, reason) => {
        const current = this.agents.get(companyId);
        if (current && current.ws === ws) {
          this.agents.delete(companyId);
          if (companyUuid) {
            this.agents.delete(companyUuid);
          }
        }
        console.warn(`[AgentManager] Agente da empresa [${companyId}] desconectado (código: ${code}). Total agentes ativos: ${this.getConnectedCount()}`);

        // Inicia tolerância para notificação de queda do servidor
        CompanyService.getInstance().getCompanyById(companyUuid || companyId).then((comp: any) => {
          if (!comp) return;
          const offlineConfig = comp.businessRules?.notificacoes?.offline;
          if (offlineConfig?.habilitado === false) return;

          const toleranceMin = Math.max(1, offlineConfig?.tempoToleranciaMinutos || 3);
          const timer = setTimeout(() => {
            this.offlineTimers.delete(companyId);
            if (!this.isAgentOnline(companyId)) {
              this.offlineAlertsSent.set(companyId, true);
              NotificationService.getInstance().notifyServerOffline(comp.id, comp.name, toleranceMin).catch(() => {});
            }
          }, toleranceMin * 60 * 1000);

          this.offlineTimers.set(companyId, timer);
        }).catch(() => {});
      });

      ws.on('error', (err) => {
        console.error(`[AgentManager] Erro no socket do agente [${companyId}]:`, err.message);
      });
    } catch (err: any) {
      console.error('[AgentManager] Erro inesperado no handshake do agente:', err.message);
      try {
        ws.close(4000, 'Erro interno de validação do handshake');
      } catch {}
    }
  }

  public isAgentOnline(identifier: string): boolean {
    const agent = this.getAgent(identifier);
    if (!agent) return false;
    return agent.ws.readyState === WebSocket.OPEN;
  }

  public disconnectCompanyAgent(identifier: string, reason: string = 'Acesso da empresa suspenso'): boolean {
    const agent = this.getAgent(identifier);
    if (!agent) return false;

    console.warn(`[AgentManager] Desconectando forçadamente agente da empresa [${identifier}]. Motivo: ${reason}`);
    try {
      agent.ws.close(4003, reason);
      setTimeout(() => {
        try {
          if (agent.ws.readyState !== WebSocket.CLOSED) {
            agent.ws.terminate();
          }
        } catch {}
      }, 500);
    } catch {}

    this.agents.delete(agent.companyId);
    if (agent.companyUuid) {
      this.agents.delete(agent.companyUuid);
    }
    return true;
  }

  public async sendQuery(
    identifier: string,
    toolName: ToolName,
    params: Record<string, any> = {},
    timeoutMs: number = 6000
  ): Promise<any> {
    const agent = this.getAgent(identifier);

    if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Servidor local da empresa [${identifier}] está indisponível ou offline.`);
    }

    const correlationId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const envelope: QueryRequestEnvelope = {
      correlationId,
      type: 'QUERY_REQUEST',
      toolName,
      params,
      timeoutMs,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Tempo limite esgotado (${timeoutMs}ms) aguardando resposta do servidor local.`));
      }, timeoutMs);

      this.pendingRequests.set(correlationId, { resolve, reject, timer });
      agent.ws.send(JSON.stringify(envelope));
    });
  }

  public executeTool = this.sendQuery.bind(this);

  public getAgentVersion(identifier: string): string | undefined {
    const agent = this.getAgent(identifier);
    return agent?.agentVersion;
  }

  public getAgentUpdateProgress(identifier: string): AgentUpdateProgressEnvelope | undefined {
    const agent = this.getAgent(identifier);
    return agent?.lastUpdateProgress;
  }

  public sendUpdateCommand(
    identifier: string,
    params: { targetVersion: string; downloadUrl: string; sha256: string; force?: boolean }
  ): boolean {
    const agent = this.getAgent(identifier);
    if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Servidor local da empresa [${identifier}] está indisponível ou offline.`);
    }

    const correlationId = `update_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const envelope: AgentUpdateCommandEnvelope = {
      correlationId,
      type: 'AGENT_UPDATE_COMMAND',
      targetVersion: params.targetVersion,
      downloadUrl: params.downloadUrl,
      sha256: params.sha256,
      force: params.force,
    };

    agent.ws.send(JSON.stringify(envelope));
    console.log(`[AgentManager] Comando de atualizacao para v${params.targetVersion} despachado com sucesso para a empresa [${identifier}]`);
    return true;
  }
}

