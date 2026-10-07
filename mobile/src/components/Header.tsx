import React from 'react';
import { ViewTransition } from '../utils/view-transitions.js';
import { RotateCw, Eye, EyeOff, Menu, Bell } from 'lucide-react';

interface HeaderProps {
  companyName: string;
  isOnline: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  title?: string;
  onOpenProfile?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  userInitials?: string;
}

export const Header: React.FC<HeaderProps> = ({
  companyName,
  isOnline: _isOnline,
  onRefresh,
  isRefreshing,
  isPrivacyMode,
  onTogglePrivacy,
  title = 'Visão Geral',
  onOpenProfile,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  userInitials: _userInitials = 'U',
}) => {
  return (
    <header
      className="sticky top-0 w-full z-50 bg-[#fafaf6]/90 backdrop-blur-xl border-b border-emerald-950/5 shadow-[0_1px_8px_rgba(0,0,0,0.03)]"
    >
      <div className="max-w-md mx-auto h-16 px-4 flex items-center justify-between">
        {/* Título da Tela e Identidade Textual Limpa (Apple HIG) */}
        <div className="flex flex-col justify-center min-w-0 flex-1 mr-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#476053] truncate">
            {companyName}
          </span>
          <ViewTransition key={title} enter="fade-in" exit="fade-out" default="none">
            <span className="text-[19px] font-bold text-[#0f291e] tracking-tight leading-tight truncate">
              {title}
            </span>
          </ViewTransition>
        </div>

        {/* Ações Rápidas com área de toque mínima de 44x44px (Apple HIG & M3) */}
        <div className="flex items-center gap-1.5">
          {/* Botão de Alternar Privacidade */}
          <button
            onClick={onTogglePrivacy}
            aria-label={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
            title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores confidenciais'}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100/80 text-emerald-900 hover:bg-stone-200/80 active:scale-95 transition-all cursor-pointer"
          >
            {isPrivacyMode ? (
              <EyeOff className="w-4 h-4 text-emerald-800" />
            ) : (
              <Eye className="w-4 h-4 text-emerald-900" />
            )}
          </button>

          {/* Botão de Recarregar */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Atualizar dados"
            title="Atualizar dados"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100/80 text-emerald-900 hover:bg-stone-200/80 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RotateCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`}
            />
          </button>

          {/* Botão de Notificações com Badge */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              aria-label="Abrir notificações"
              title="Notificações e Alertas"
              className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100/80 text-emerald-900 hover:bg-stone-200/80 active:scale-95 transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4 text-emerald-900" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Botão de Menu / Configurações com Ícone Ergonômico de 44x44px */}
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              aria-label="Abrir menu e configurações"
              title="Menu e Configurações"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100/80 text-emerald-900 hover:bg-stone-200/80 active:scale-95 transition-all cursor-pointer"
            >
              <Menu className="w-5 h-5 text-emerald-950 stroke-[2.2]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
