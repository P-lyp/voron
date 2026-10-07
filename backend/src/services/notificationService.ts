import webpush from 'web-push';
import { supabase } from './supabase.js';
import {
  AppNotificationDTO,
  NotificationType,
  PushSubscriptionPayload,
} from '@ai-db/shared';

// Configuração ou geração sob demanda de chaves VAPID
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:suporte@voron.com.br';

if (!vapidPublicKey || !vapidPrivateKey) {
  // Gera par de chaves VAPID estável em tempo de execução se não configurado no .env
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  console.log('[PushNotification] Chaves VAPID temporárias geradas para esta sessão:');
  console.log(`   Pública: ${vapidPublicKey}`);
  console.log(`   Privada: ${vapidPrivateKey.slice(0, 8)}... (oculta)`);
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export interface PushNotificationPayload {
  title: string;
  body: string;
  tipo: NotificationType;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, any>;
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public getPublicKey(): string {
    return vapidPublicKey;
  }

  /**
   * Salva ou atualiza a inscrição Push de um dispositivo
   */
  public async saveSubscription(
    companyId: string,
    userId: string | null,
    payload: PushSubscriptionPayload
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          company_id: companyId,
          user_id: userId,
          endpoint: payload.endpoint,
          keys_p256dh: payload.keys.p256dh,
          keys_auth: payload.keys.auth,
          user_agent: payload.userAgent || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        console.error('[NotificationService] Erro ao salvar push_subscription:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[NotificationService] Falha inesperada ao salvar push_subscription:', err.message);
      return false;
    }
  }

  /**
   * Remove a inscrição quando o usuário desativa ou o navegador expira
   */
  public async removeSubscription(endpoint: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      if (error) {
        console.warn('[NotificationService] Erro ao remover push_subscription:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cria registro in-app na tabela app_notifications
   */
  public async createAppNotification(
    companyId: string,
    userId: string | null,
    tipo: NotificationType,
    titulo: string,
    mensagem: string,
    dados: Record<string, any> = {}
  ): Promise<AppNotificationDTO | null> {
    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .insert({
          company_id: companyId,
          user_id: userId,
          tipo,
          titulo,
          mensagem,
          dados,
          lida: false,
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('[NotificationService] Falha ao persistir app_notification:', error?.message);
        return null;
      }

      return {
        id: data.id,
        companyId: data.company_id,
        userId: data.user_id,
        tipo: data.tipo as NotificationType,
        titulo: data.titulo,
        mensagem: data.mensagem,
        dados: data.dados,
        lida: data.lida,
        createdAt: data.created_at,
      };
    } catch (err: any) {
      console.warn('[NotificationService] Erro ao gravar app_notification:', err.message);
      return null;
    }
  }

  /**
   * Lista notificações recentes da empresa para a central in-app
   */
  public async listAppNotifications(companyId: string, limit: number = 30): Promise<AppNotificationDTO[]> {
    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        console.error('[NotificationService] Erro ao listar notificações:', error?.message);
        return [];
      }

      return data.map((item: any) => ({
        id: item.id,
        companyId: item.company_id,
        userId: item.user_id,
        tipo: item.tipo as NotificationType,
        titulo: item.titulo,
        mensagem: item.mensagem,
        dados: item.dados || {},
        lida: Boolean(item.lida),
        createdAt: item.created_at,
      }));
    } catch (err: any) {
      console.error('[NotificationService] Erro inesperado ao listar notificações:', err.message);
      return [];
    }
  }

  /**
   * Marca notificação como lida
   */
  public async markAsRead(id: string, companyId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_notifications')
        .update({ lida: true })
        .eq('id', id)
        .eq('company_id', companyId);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Marca todas as notificações da empresa como lidas
   */
  public async markAllAsRead(companyId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_notifications')
        .update({ lida: true })
        .eq('company_id', companyId)
        .eq('lida', false);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Dispara notificação push para todos os dispositivos inscritos da empresa
   * e salva no histórico in-app
   */
  public async sendPushToCompany(
    companyId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    // 1. Grava no histórico in-app
    await this.createAppNotification(
      companyId,
      null,
      payload.tipo,
      payload.title,
      payload.body,
      payload.data || {}
    );

    // 2. Busca inscrições ativas da empresa
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys_p256dh, keys_auth')
      .eq('company_id', companyId);

    if (error || !subs || subs.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const pushPayloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tipo: payload.tipo,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/favicon-32x32.png',
      url: payload.url || '/?tab=dashboard',
      data: payload.data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      subs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayloadString, {
            TTL: 60 * 60 * 24, // 24 horas de validade na fila push
          });
          sent++;
        } catch (err: any) {
          failed++;
          // Se a assinatura expirou ou foi revogada pelo usuário (404/410), remove do banco
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`[PushNotification] Removendo endpoint expirado: ${sub.endpoint.slice(0, 35)}...`);
            await this.removeSubscription(sub.endpoint);
          } else {
            console.warn(`[PushNotification] Erro ao enviar para endpoint: ${err.message}`);
          }
        }
      })
    );

    return { sent, failed };
  }

  // ========================================================
  // DISPARADORES ESPECÍFICOS DA OPÇÃO A
  // ========================================================

  /**
   * 1. Queda do Servidor / Agente Local Offline
   */
  public async notifyServerOffline(
    companyId: string,
    companyName: string,
    toleranceMinutes: number
  ): Promise<void> {
    const title = `Servidor Local Offline - ${companyName}`;
    const body = `O servidor da empresa parou de responder há ${toleranceMinutes} min. O ERP local está inacessível.`;

    await this.sendPushToCompany(companyId, {
      title,
      body,
      tipo: 'offline',
      data: { toleranceMinutes, companyName },
    });
  }

  /**
   * 1b. Restabelecimento da Conexão com o Servidor Local
   */
  public async notifyServerOnline(companyId: string, companyName: string): Promise<void> {
    const title = `Servidor Local Restabelecido - ${companyName}`;
    const body = `A conexão do túnel com o ERP Firebird foi restaurada com sucesso.`;

    await this.sendPushToCompany(companyId, {
      title,
      body,
      tipo: 'online',
      data: { companyName },
    });
  }

  /**
   * 2. Resumo Executivo de Fechamento do Dia
   */
  public async notifyFechamentoDia(
    companyId: string,
    companyName: string,
    dados: {
      totalVendas: number;
      quantidadePedidos: number;
      crescimentoOntemPercent?: number;
      topProdutoNome?: string;
    }
  ): Promise<void> {
    const totalFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(dados.totalVendas);

    let body = `Hoje foram faturados ${totalFormatado} em ${dados.quantidadePedidos} vendas.`;
    if (dados.crescimentoOntemPercent !== undefined) {
      const sinal = dados.crescimentoOntemPercent >= 0 ? '+' : '';
      body += ` (${sinal}${dados.crescimentoOntemPercent.toFixed(1)}% vs ontem).`;
    }
    if (dados.topProdutoNome) {
      body += ` Top item: ${dados.topProdutoNome}.`;
    }

    await this.sendPushToCompany(companyId, {
      title: `Fechamento do Dia - ${companyName}`,
      body,
      tipo: 'fechamento',
      data: dados,
    });
  }

  /**
   * 3. Marco de Meta Batida (50%, 80%, 100%, etc.)
   */
  public async notifyMetaBatida(
    companyId: string,
    companyName: string,
    percentual: number,
    totalVendas: number,
    metaDiaria: number
  ): Promise<void> {
    const totalFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalVendas);
    const metaFormatada = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(metaDiaria);

    const is100 = percentual >= 100;
    const title = is100
      ? `Meta do Dia Batida! (${percentual.toFixed(0)}%)`
      : `Marco de Meta: ${percentual.toFixed(0)}% Atingido`;

    const body = `${companyName}: ${totalFormatado} faturados hoje (Meta: ${metaFormatada}).`;

    await this.sendPushToCompany(companyId, {
      title,
      body,
      tipo: 'meta',
      data: { percentual, totalVendas, metaDiaria },
    });
  }

  /**
   * 3b. Pedido Expressivo / Alto Valor
   */
  public async notifyPedidoExpressivo(
    companyId: string,
    companyName: string,
    valorPedido: number,
    cliente?: string,
    vendedor?: string
  ): Promise<void> {
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valorPedido);

    let body = `Pedido de ${valorFormatado} concluído!`;
    if (cliente) body += ` Cliente: ${cliente}.`;
    if (vendedor) body += ` Vendedor: ${vendedor}.`;

    await this.sendPushToCompany(companyId, {
      title: `Pedido Expressivo - ${companyName}`,
      body,
      tipo: 'pedido_expressivo',
      data: { valorPedido, cliente, vendedor },
    });
  }
}
