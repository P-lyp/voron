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
} from 'lucide-react';
import { AppNotificationDTO, NotificationType } from '@ai-db/shared';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/api.js';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
} from '../utils/pushNotifications.js';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<AppNotificationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getNotificationPermission()
  );
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState<string | null>(null);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const items = await fetchNotifications();
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
    if (isOpen) {
      loadNotifications();
      setPermission(getNotificationPermission());
    }
  }, [isOpen]);

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
      const res = await subscribeToPushNotifications();
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

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.lida).length;
  const isPushSupported = isPushNotificationSupported();

  const getNotificationIcon = (tipo: NotificationType) => {
    switch (tipo) {
      case 'offline':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'online':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'fechamento':
        return <TrendingUp className="w-4 h-4 text-emerald-700" />;
      case 'meta':
        return <Award className="w-4 h-4 text-amber-600" />;
      case 'pedido_expressivo':
        return <Sparkles className="w-4 h-4 text-cyan-600" />;
      default:
        return <Bell className="w-4 h-4 text-stone-600" />;
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
        {/* Cabeçalho do Drawer */}
        <div className="px-5 py-4 border-b border-stone-200/80 bg-white/80 backdrop-blur-xl flex items-center justify-between min-h-[64px]">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 leading-tight">
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
                className="min-h-[44px] px-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
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
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
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

        {/* Lista de Notificações */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              <span className="text-xs">Carregando notificações...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-300">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">
                Nenhuma notificação por enquanto
              </h3>
              <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                Quando seu servidor sofrer oscilações ou quando metas de vendas forem alcançadas, os alertas aparecerão aqui.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.lida && handleMarkAsRead(item.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] space-y-1.5 ${
                  item.lida
                    ? 'bg-white/70 border-stone-200/60 opacity-80'
                    : 'bg-white border-emerald-200/90 shadow-xs ring-1 ring-emerald-500/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                      {getNotificationIcon(item.tipo)}
                    </div>
                    <span className="text-xs font-bold text-stone-900">
                      {item.titulo}
                    </span>
                  </div>

                  <span className="text-[10px] text-stone-400 shrink-0 font-medium">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-stone-600 pl-9 leading-relaxed">
                  {item.mensagem}
                </p>

                {!item.lida && (
                  <div className="flex justify-end pt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
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
