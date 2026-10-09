import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Award,
  Sparkles,
  Check,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { AppNotificationDTO, NotificationType } from '@ai-db/shared';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  triggerTestNotification,
} from '../services/api.js';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
} from '../utils/pushNotifications.js';
import { supabase } from '../services/supabase.js';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  companyId?: string;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
  companyId,
}) => {
  const [notifications, setNotifications] = useState<AppNotificationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'todas' | 'nao_lidas'>('todas');
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getNotificationPermission()
  );
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState<string | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const items = await fetchNotifications(companyId);
      setNotifications(items);
      const unread = items.filter((n) => !n.lida).length;
      onUnreadCountChange?.(unread);
    } catch (err) {
      console.warn('Falha ao carregar notificações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    loadNotifications();
    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    // Se já possui permissão concedida, sincroniza silenciosamente com as chaves VAPID atuais
    if (currentPerm === 'granted') {
      subscribeToPushNotifications(companyId).catch((err) => {
        console.warn('[NotificationsDrawer] Verificação silenciosa de inscrição push:', err);
      });
    }

    // 1. Canal Supabase Realtime para app_notifications
    let channel: any = null;
    if (companyId && companyId !== 'null') {
      channel = supabase
        .channel(`drawer-notifications-${companyId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_notifications',
            filter: `company_id=eq.${companyId}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    }

    // 2. Listener para eventos de Push recebidos pelo Service Worker em tempo real
    const handlePushMsg = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
        loadNotifications();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handlePushMsg);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handlePushMsg);
      }
    };
  }, [isOpen, companyId]);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
    const unread = notifications.filter((n) => n.id !== id && !n.lida).length;
    onUnreadCountChange?.(unread);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
    onUnreadCountChange?.(0);
  };

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    setSubscribeMessage(null);
    try {
      const res = await subscribeToPushNotifications(companyId);
      setPermission(res.permission);
      if (res.success) {
        setSubscribeMessage('Notificações no dispositivo ativadas com sucesso!');
      } else if (res.error) {
        setSubscribeMessage(res.error);
      }
    } catch (err: any) {
      setSubscribeMessage(err.message || 'Erro ao ativar notificações');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleRenewPush = async () => {
    setIsSubscribing(true);
    setTestFeedback(null);
    try {
      const res = await subscribeToPushNotifications(companyId, { forceRenew: true });
      setPermission(res.permission);
      if (res.success) {
        setTestFeedback({ success: true, message: 'Inscrição do dispositivo renovada com sucesso!' });
      } else {
        setTestFeedback({ success: false, message: res.error || 'Falha ao renovar inscrição' });
      }
    } catch (err: any) {
      setTestFeedback({ success: false, message: err.message || 'Erro ao renovar inscrição' });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestPush = async () => {
    setIsTestingPush(true);
    setTestFeedback(null);
    try {
      // 1. Sincroniza a assinatura antes do disparo
      await subscribeToPushNotifications(companyId);
      // 2. Dispara a notificação de teste no backend
      const res = await triggerTestNotification('sistema', companyId);
      setTestFeedback({ success: res.success, message: res.message });
      // 3. Atualiza a lista in-app
      await loadNotifications();
    } catch (err: any) {
      setTestFeedback({
        success: false,
        message: err.message || 'Falha ao disparar notificação de teste',
      });
    } finally {
      setIsTestingPush(false);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.lida).length;
  const isPushSupported = isPushNotificationSupported();

  const displayedNotifications =
    filterMode === 'nao_lidas'
      ? notifications.filter((n) => !n.lida)
      : notifications;

  const getNotificationIconBadge = (tipo: NotificationType) => {
    switch (tipo) {
      case 'offline':
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case 'online':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'fechamento':
        return (
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        );
      case 'meta':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
        );
      case 'pedido_expressivo':
        return (
          <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  const getNotificationContainerStyle = (tipo: NotificationType, lida: boolean) => {
    if (lida) {
      return 'bg-white/70 border-stone-200/60 opacity-75';
    }
    switch (tipo) {
      case 'offline':
        return 'bg-rose-50/40 border-rose-200 shadow-xs ring-1 ring-rose-500/10';
      case 'online':
        return 'bg-emerald-50/40 border-emerald-200 shadow-xs ring-1 ring-emerald-500/10';
      case 'meta':
        return 'bg-amber-50/40 border-amber-200 shadow-xs ring-1 ring-amber-500/10';
      case 'fechamento':
        return 'bg-indigo-50/40 border-indigo-200 shadow-xs ring-1 ring-indigo-500/10';
      case 'pedido_expressivo':
        return 'bg-cyan-50/40 border-cyan-200 shadow-xs ring-1 ring-cyan-500/10';
      default:
        return 'bg-white border-emerald-200/90 shadow-xs ring-1 ring-emerald-500/10';
    }
  };

  const formatTimestamp = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);

      if (diffMin < 1) return 'Agora mesmo';
      if (diffMin < 60) return `Há ${diffMin} min`;
      if (diffHours < 24) return `Hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop Translúcido com Desfoque (Apple HIG) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Conteúdo do Drawer */}
      <div className="relative w-full max-w-md bg-[#fafaf6] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Cabeçalho do Drawer com Frosted Glass */}
        <div className="px-5 py-4 border-b border-stone-200/80 bg-white/80 backdrop-blur-xl flex items-center justify-between min-h-[64px]">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">
                Notificações
              </h2>
              <span className="text-[11px] text-stone-500">
                {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                title="Marcar todas como lidas"
                className="min-h-[44px] px-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer rounded-xl hover:bg-emerald-50/50"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Ler todas</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Banner de Ativação do Web Push se ainda não autorizado */}
        {isPushSupported && permission !== 'granted' && (
          <div className="p-4 mx-4 mt-4 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white border border-emerald-200/80 rounded-2xl space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-emerald-950">
                  Receba alertas no seu celular
                </h3>
                <p className="text-[11px] text-emerald-800/80 leading-relaxed mt-0.5">
                  Seja avisado sobre metas batidas, fechamento do dia e servidor offline mesmo com o app fechado.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubscribing}
              onClick={handleEnablePush}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#0f3928] text-white text-xs font-bold hover:bg-[#154c36] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubscribing ? 'Solicitando...' : 'Ativar Notificações no Dispositivo'}</span>
            </button>

            {subscribeMessage && (
              <p className="text-[11px] text-emerald-900 font-medium text-center">
                {subscribeMessage}
              </p>
            )}
          </div>
        )}

        {/* Painel de Dispositivo Conectado com Sincronização e Teste de Push (Apple HIG & M3) */}
        {isPushSupported && permission === 'granted' && (
          <div className="mx-4 mt-4 p-3.5 bg-white/90 backdrop-blur-md border border-stone-200/80 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-stone-900 block leading-tight">
                    Notificações no Dispositivo
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Ativo neste aparelho
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubscribing || isTestingPush}
                onClick={handleRenewPush}
                title="Sincronizar chave de notificação do aparelho"
                className="min-h-[44px] px-3 text-[11px] font-semibold text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSubscribing ? 'animate-spin text-emerald-700' : ''}`} />
                <span>Sincronizar</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isTestingPush}
              onClick={handleTestPush}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#0f3928] text-white text-xs font-bold hover:bg-[#154c36] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isTestingPush ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Disparando alerta de teste...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Testar Notificação no Celular</span>
                </>
              )}
            </button>

            {testFeedback && (
              <div
                className={`p-2.5 rounded-xl text-[11px] leading-relaxed font-medium transition-all ${
                  testFeedback.success
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/60'
                    : 'bg-rose-50 text-rose-900 border border-rose-200/60'
                }`}
              >
                {testFeedback.message}
              </div>
            )}
          </div>
        )}

        {/* Filtros Segmentados Apple HIG (Todas vs Não Lidas) com Hit Area >= 44px */}
        <div className="px-4 pt-3 pb-1">
          <div className="bg-stone-200/60 p-1 rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => setFilterMode('todas')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                filterMode === 'todas'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Todas</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                {notifications.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('nao_lidas')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                filterMode === 'nao_lidas'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Não lidas</span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Lista de Notificações com Rolagem Fluida */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              <span className="text-xs">Carregando notificações...</span>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-300">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">
                {filterMode === 'nao_lidas' ? 'Tudo em dia!' : 'Nenhuma notificação por enquanto'}
              </h3>
              <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                {filterMode === 'nao_lidas'
                  ? 'Você já leu todas as notificações recentes.'
                  : 'Quando seu servidor sofrer oscilações ou quando metas de vendas forem alcançadas, os alertas aparecerão aqui.'}
              </p>
            </div>
          ) : (
            displayedNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.lida && handleMarkAsRead(item.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] space-y-2 ${getNotificationContainerStyle(
                  item.tipo,
                  item.lida
                )}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    {getNotificationIconBadge(item.tipo)}
                    <span className="text-xs font-bold text-stone-900 leading-tight">
                      {item.titulo}
                    </span>
                  </div>

                  <span className="text-[10px] text-stone-400 shrink-0 font-medium">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-stone-600 pl-10 leading-relaxed">
                  {item.mensagem}
                </p>

                {!item.lida && (
                  <div className="flex justify-end pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Nova
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

