import webpush from 'web-push';
import { supabase } from './supabase.js';
import { CompanyService } from './companyService.js';
import {
  AppNotificationDTO,
  NotificationType,
  PushSubscriptionPayload,
  PushNotificationPayload,
  NotificationFilterDTO,
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
} else {
  console.log('[PushNotification] Chaves VAPID estáveis configuradas com sucesso via .env');
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
   * Converte slug ou identificador de empresa em um UUID válido cadastrado no Supabase
   */
  private async resolveCompanyUuid(companyIdOrSlug?: string | null): Promise<string | null> {
    if (!companyIdOrSlug || companyIdOrSlug === 'null' || companyIdOrSlug === 'undefined') {
      return null;
    }
    const clean = companyIdOrSlug.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (isUuid) {
      return clean;
    }
    try {
      const company = await CompanyService.getInstance().getCompanyBySlug(clean);
      if (company?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company.id)) {
        return company.id;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Salva ou atualiza a inscrição Push de um dispositivo
   */
  public async saveSubscription(
    companyIdOrSlug: string,
    userId: string | null,
    payload: PushSubscriptionPayload
  ): Promise<boolean> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) {
      console.warn('[NotificationService] saveSubscription ignorado: companyId inválido:', companyIdOrSlug);
      return false;
    }

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

      // Se o mesmo usuário estiver registrando no mesmo dispositivo/navegador,
      // limpa tokens anteriores obsoletos para evitar duplicidade de alertas no mesmo celular
      if (userId && payload.userAgent) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .eq('user_agent', payload.userAgent)
          .neq('endpoint', payload.endpoint);
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
    companyIdOrSlug: string,
    userId: string | null,
    tipo: NotificationType,
    titulo: string,
    mensagem: string,
    dados: Record<string, any> = {}
  ): Promise<AppNotificationDTO | null> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) {
      console.warn('[NotificationService] createAppNotification ignorado: companyId não é um UUID válido:', companyIdOrSlug);
      return null;
    }

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
   * Lista notificações recentes da empresa para a central in-app com paginação e filtros
   */
  public async listAppNotifications(
    companyIdOrSlug: string,
    filterOrLimit: NotificationFilterDTO | number = 30
  ): Promise<AppNotificationDTO[]> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) {
      return [];
    }

    const filter: NotificationFilterDTO =
      typeof filterOrLimit === 'number'
        ? { limit: filterOrLimit }
        : filterOrLimit;

    const limit = Math.min(Math.max(filter.limit || 30, 1), 100);
    const offset = Math.max(filter.offset || 0, 0);

    try {
      let query = supabase
        .from('app_notifications')
        .select('*')
        .eq('company_id', companyId);

      if (filter.unreadOnly) {
        query = query.eq('lida', false);
      }

      if (filter.tipo) {
        query = query.eq('tipo', filter.tipo);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

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
   * Retorna a contagem exata de notificações não lidas
   */
  public async getUnreadCount(companyIdOrSlug: string): Promise<number> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) return 0;

    try {
      const { count, error } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('lida', false);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Marca notificação como lida
   */
  public async markAsRead(id: string, companyIdOrSlug: string): Promise<boolean> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) return false;

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
  public async markAllAsRead(companyIdOrSlug: string): Promise<boolean> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) return false;

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
   * Remove inscrições push inativas/antigas (ex: mais de 90 dias sem atualização)
   */
  public async cleanStaleSubscriptions(daysInactive: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('push_subscriptions')
        .delete()
        .lt('updated_at', cutoffDate)
        .select('id');

      if (error) {
        console.warn('[NotificationService] Falha na limpeza periódica de subscriptions:', error.message);
        return 0;
      }
      return data?.length || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Dispara notificação push para todos os dispositivos inscritos da empresa
   * e salva no histórico in-app
   */
  public async sendPushToCompany(
    companyIdOrSlug: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    const companyId = await this.resolveCompanyUuid(companyIdOrSlug);
    if (!companyId) {
      console.warn('[NotificationService] sendPushToCompany ignorado: companyId inválido:', companyIdOrSlug);
      return { sent: 0, failed: 0 };
    }

    // 1. Grava no histórico in-app
    await this.createAppNotification(
      companyId,
      null,
      payload.tipo,
      payload.title,
      payload.body,
      payload.data || {}
    );

    // 2. Busca inscrições ativas da empresa (e também administradores globais sem company_id fixo)
    console.log(`[PushNotification] Buscando inscrições Push para empresa ${companyId}...`);
    const { data: rawSubs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth, user_id, user_agent, company_id, updated_at')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[PushNotification] Erro ao consultar push_subscriptions:', error.message);
      return { sent: 0, failed: 0 };
    }

    if (!rawSubs || rawSubs.length === 0) {
      console.warn(`[PushNotification] Nenhuma inscrição Push encontrada para empresa ${companyId} ou administradores.`);
      return { sent: 0, failed: 0 };
    }

    // Deduplica inscrições do mesmo usuário no mesmo aparelho (mantém a mais recente e descarta tokens duplicados)
    const seenUserDevice = new Set<string>();
    const subs: typeof rawSubs = [];
    const staleIdsToRemove: string[] = [];

    for (const sub of rawSubs) {
      if (sub.user_id && sub.user_agent) {
        const deviceKey = `${sub.company_id || 'global'}:${sub.user_id}:${sub.user_agent}`;
        if (seenUserDevice.has(deviceKey)) {
          staleIdsToRemove.push(sub.id);
          continue;
        }
        seenUserDevice.add(deviceKey);
      }
      subs.push(sub);
    }

    if (staleIdsToRemove.length > 0) {
      (async () => {
        try {
          await supabase.from('push_subscriptions').delete().in('id', staleIdsToRemove);
          console.log(`[PushNotification] ${staleIdsToRemove.length} inscrição(ões) duplicada(s) do mesmo aparelho removida(s) automaticamente.`);
        } catch (delErr: any) {
          console.warn('[PushNotification] Aviso ao limpar inscrições duplicadas:', delErr?.message);
        }
      })();
    }

    console.log(`[PushNotification] Encontrada(s) ${subs.length} inscrição(ões) apta(s) para receber o alerta.`);

    // 3. Ajuste fino de TTL, Urgência e Tópico (RFC 8030 / Apple Web Push)
    let ttlSeconds = 86400; // 24 horas por padrão
    let urgencyLevel: 'high' | 'normal' = 'normal';
    let topicString: string = payload.tag || `voron-${payload.tipo}`;

    switch (payload.tipo) {
      case 'offline':
        ttlSeconds = 3600; // 1 hora
        urgencyLevel = 'high';
        topicString = 'voron-offline';
        break;
      case 'online':
        ttlSeconds = 3600; // 1 hora
        urgencyLevel = 'high';
        topicString = 'voron-offline'; // Substitui o alerta de queda anterior
        break;
      case 'meta':
      case 'pedido_expressivo':
        ttlSeconds = 21600; // 6 horas
        urgencyLevel = 'high';
        break;
      case 'fechamento':
        ttlSeconds = 50400; // 14 horas
        urgencyLevel = 'normal';
        topicString = 'voron-fechamento';
        break;
      default:
        ttlSeconds = 86400;
        urgencyLevel = 'normal';
        break;
    }

    const pushPayloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tipo: payload.tipo,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/favicon-32x32.png',
      image: payload.image,
      url: payload.url || '/?tab=dashboard',
      tag: topicString,
      actions: payload.actions || [],
      requireInteraction: payload.requireInteraction ?? (payload.tipo === 'offline'),
      silent: payload.silent ?? false,
      data: payload.data || {},
      timestamp: payload.timestamp || Date.now(),
    });

    let sent = 0;
    let failed = 0;

    // 4. Despacho em lotes controlados (chunks de 6) com timeout defensivo de 8s por envio
    const BATCH_SIZE = 6;
    for (let i = 0; i < subs.length; i += BATCH_SIZE) {
      const batch = subs.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth,
            },
          };

          try {
            // Omitimos o cabeçalho HTTP 'topic' pois o Apple APNs (web.push.apple.com) rejeita strings customizadas com BadWebPushTopic.
            // O agrupamento e substituição de alertas é realizado de forma segura via payload.tag no Service Worker do cliente.
            const sendPromise = webpush.sendNotification(pushSubscription, pushPayloadString, {
              TTL: ttlSeconds,
              urgency: urgencyLevel,
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout de 8s ao despachar push')), 8000)
            );

            const res: any = await Promise.race([sendPromise, timeoutPromise]);
            console.log(`[PushNotification] Push entregue ao gateway (${sub.endpoint.includes('apple') ? 'Apple APNs' : 'WebPush'}) [Status: ${res.statusCode}]: ${sub.endpoint.slice(0, 45)}...`);
            sent++;
          } catch (err: any) {
            failed++;
            console.error(`[PushNotification] Falha ao enviar para ${sub.endpoint.slice(0, 45)}...`);
            console.error(`   Status HTTP: ${err.statusCode || 'N/A'} - Detalhe: ${err.message}`);
            if (err.body) {
              console.error(`   Resposta do serviço Push:`, err.body);
            }

            // Descarta endpoints inválidos (404/410/403 ou VapidPkHashMismatch)
            const bodyStr = typeof err.body === 'string' ? err.body : JSON.stringify(err.body || '');
            const isVapidMismatch = err.statusCode === 400 && bodyStr.includes('VapidPkHashMismatch');
            const isBadDevice = err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 403 || isVapidMismatch;

            if (isBadDevice) {
              console.log(`[PushNotification] Descartando endpoint inválido/revogado do banco: ${sub.endpoint.slice(0, 38)}... (Motivo: HTTP ${err.statusCode || 400})`);
              await this.removeSubscription(sub.endpoint);
            }
          }
        })
      );
    }

    return { sent, failed };
  }

  // ========================================================
  // DISPARADORES ESPECÍFICOS DE NEGÓCIO DO VORON
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
      tag: 'voron-offline',
      requireInteraction: true,
      url: '/?tab=admin',
      actions: [
        { action: 'check_status', title: 'Verificar Túnel' },
      ],
      data: { toleranceMinutes, companyName, critical: true },
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
      tag: 'voron-offline', // Mesmo tópico: substitui o alerta de queda
      url: '/?tab=dashboard',
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
      tag: 'voron-fechamento',
      url: '/?tab=dashboard',
      actions: [
        { action: 'open_dashboard', title: 'Ver Faturamento' },
      ],
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
      tag: `voron-meta-${percentual}`,
      url: '/?tab=dashboard',
      actions: [
        { action: 'open_dashboard', title: 'Ver Metas' },
      ],
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
      tag: 'voron-pedido',
      url: '/?tab=dashboard',
      actions: [
        { action: 'open_dashboard', title: 'Ver Vendas' },
      ],
      data: { valorPedido, cliente, vendedor },
    });
  }
}
