import { CompanyService } from './companyService.js';
import { NotificationService } from './notificationService.js';
import { AgentManager } from '../gateway/agentManager.js';

export class NotificationScheduler {
  private static instance: NotificationScheduler;
  private intervalTimer: NodeJS.Timeout | null = null;
  // Mapa de controle para evitar disparos duplicados no mesmo dia: Map<companyId, "YYYY-MM-DD">
  private sentFechamentoMap: Map<string, string> = new Map();
  // Mapa de marcos de meta já disparados hoje: Map<`${companyId}-${marco}`, "YYYY-MM-DD">
  private sentMetasMap: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler();
    }
    return NotificationScheduler.instance;
  }

  public start(): void {
    if (this.intervalTimer) return;

    console.log('[NotificationScheduler] Iniciando agendador de Fechamento e Metas do Voron...');
    // Checagem a cada 60 segundos
    this.intervalTimer = setInterval(() => {
      this.checkScheduledTasks().catch((err) => {
        console.error('[NotificationScheduler] Erro no ciclo de tarefas agendadas:', err.message);
      });
    }, 60 * 1000);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async checkScheduledTasks(): Promise<void> {
    const now = new Date();
    // Horário no fuso horário do Brasil (America/Sao_Paulo)
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const currentTimeStr = timeFormatter.format(now); // Ex: "18:30"
    const todayStr = dateFormatter.format(now); // Ex: "06/10/2026"

    const companyService = CompanyService.getInstance();
    const notificationService = NotificationService.getInstance();
    const agentManager = AgentManager.getInstance();

    const companies = await companyService.getAllCompanies();

    for (const company of companies) {
      if (!company.isActive) continue;

      const notifConfig = company.businessRules?.notificacoes;
      if (!notifConfig) continue;

      // 1. CHECAGEM DO FECHAMENTO DO DIA
      if (notifConfig.fechamento?.habilitado) {
        const configHorario = notifConfig.fechamento.horarioEnvio || '18:30';
        const jaEnviadoHoje = this.sentFechamentoMap.get(company.id) === todayStr;

        if (currentTimeStr === configHorario && !jaEnviadoHoje) {
          this.sentFechamentoMap.set(company.id, todayStr);

          // Verifica se o agente local está online para obter os dados frescos
          if (agentManager.isAgentOnline(company.id)) {
            try {
              const resVendas: any = await agentManager.executeTool(
                company.id,
                'consultar_resumo_vendas',
                {
                  periodo: 'dia',
                  tiposMovimento: company.businessRules?.movimentos?.venda,
                },
                12000
              );

              const dadosVendas = Array.isArray(resVendas) ? resVendas[0] : resVendas;
              const totalVendas = Number(dadosVendas?.TOTAL_VALOR || dadosVendas?.VALOR_TOTAL || 0);
              const qtdVendas = Number(dadosVendas?.QUANTIDADE || dadosVendas?.QTD || 0);

              await notificationService.notifyFechamentoDia(company.id, company.name, {
                totalVendas,
                quantidadePedidos: qtdVendas,
              });
              console.log(`[NotificationScheduler] Fechamento do dia disparado com sucesso para ${company.name}`);
            } catch (err: any) {
              console.warn(`[NotificationScheduler] Falha ao coletar dados para fechamento de ${company.name}:`, err.message);
            }
          }
        }
      }

      // 2. CHECAGEM DE MARCOS DE META BATIDA (Apenas se o agente estiver online)
      if (notifConfig.metas?.habilitado && agentManager.isAgentOnline(company.id)) {
        const metaDiaria = Number(notifConfig.metas.valorMetaDiaria) || 0;
        const marcos = notifConfig.metas.marcosPercentuais || [50, 100];

        if (metaDiaria > 0) {
          try {
            const resVendas: any = await agentManager.executeTool(
              company.id,
              'consultar_resumo_vendas',
              {
                periodo: 'dia',
                tiposMovimento: company.businessRules?.movimentos?.venda,
              },
              10000
            );

            const dadosVendas = Array.isArray(resVendas) ? resVendas[0] : resVendas;
            const totalVendas = Number(dadosVendas?.TOTAL_VALOR || dadosVendas?.VALOR_TOTAL || 0);
            const percentualAtingido = (totalVendas / metaDiaria) * 100;

            for (const marco of marcos) {
              const marcoKey = `${company.id}-${marco}`;
              const jaDisparouMarco = this.sentMetasMap.get(marcoKey) === todayStr;

              if (percentualAtingido >= marco && !jaDisparouMarco) {
                this.sentMetasMap.set(marcoKey, todayStr);
                await notificationService.notifyMetaBatida(
                  company.id,
                  company.name,
                  marco,
                  totalVendas,
                  metaDiaria
                );
                console.log(`[NotificationScheduler] Notificação de marco ${marco}% disparada para ${company.name}`);
              }
            }
          } catch {
            // Ignora silenciosamente em caso de timeout de leitura
          }
        }
      }
    }
  }
}
