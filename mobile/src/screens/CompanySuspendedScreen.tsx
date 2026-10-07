import React from 'react';
import { ShieldAlert, RefreshCw, LogOut, Lock, CalendarX, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth.js';

interface CompanySuspendedScreenProps {
  companyName?: string;
  reason?: string;
  activeUntil?: string | null;
  onRetry: () => void;
  isRetrying?: boolean;
  onOpenAdmin?: () => void;
}

export const CompanySuspendedScreen: React.FC<CompanySuspendedScreenProps> = ({
  companyName,
  reason,
  activeUntil,
  onRetry,
  isRetrying = false,
  onOpenAdmin,
}) => {
  const { user, signOut, isAdmin } = useAuth();

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8);
    }
  };

  const formattedExpiration = React.useMemo(() => {
    if (!activeUntil) return null;
    try {
      const d = new Date(activeUntil);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [activeUntil]);

  const isExpired = React.useMemo(() => {
    if (!activeUntil) return false;
    try {
      return new Date(activeUntil).getTime() < Date.now();
    } catch {
      return false;
    }
  }, [activeUntil]);

  return (
    <div className="min-h-screen bg-stone-200/50 flex justify-center font-sans">
      <div className="w-full max-w-md min-h-screen bg-[#f9f9fa] flex flex-col justify-between shadow-2xl relative px-6 py-8">
        <div className="pt-10 flex flex-col items-center text-center space-y-6">
          {/* Ícone Tonal de Status */}
          <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shadow-sm">
            {isExpired ? (
              <CalendarX className="w-10 h-10 stroke-[2.2]" />
            ) : (
              <ShieldAlert className="w-10 h-10 stroke-[2.2]" />
            )}
          </div>

          <div className="space-y-2 max-w-xs">
            {companyName && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200/80 text-[11px] font-bold text-stone-700">
                <Lock className="w-3 h-3 text-stone-500" />
                <span>{companyName}</span>
              </div>
            )}

            <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
              {isExpired ? 'Assinatura Expirada' : 'Acesso Suspenso'}
            </h1>

            <p className="text-xs text-stone-600 leading-relaxed pt-1">
              {reason ||
                'O acesso da sua empresa ao aplicativo está temporariamente suspenso. Por favor, entre em contato com o suporte para regularizar o acesso.'}
            </p>
          </div>

          {/* Card com Detalhes da Expiração se aplicável */}
          {formattedExpiration && (
            <div className="w-full bg-white rounded-2xl p-4 border border-rose-100 shadow-2xs space-y-1 text-left">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                Data Limite de Acesso
              </span>
              <p className="text-xs text-stone-700">
                O período de ativação contratado encerrou em{' '}
                <strong className="text-rose-950 font-bold">{formattedExpiration}</strong>.
              </p>
            </div>
          )}

          {/* Aviso Amigável para Contato */}
          <div className="w-full bg-white rounded-2xl p-4 border border-stone-200/70 shadow-2xs text-left space-y-1.5">
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
              Como regularizar?
            </span>
            <p className="text-xs text-stone-600 leading-relaxed">
              Entre em contato diretamente com o responsável pelo sistema para reativar seu acesso ou estender o prazo de utilização.
            </p>
          </div>
        </div>

        {/* Ações Inferiores com Alvo de Toque Mínimo 48px */}
        <div className="space-y-3 pt-6 pb-2">
          {/* Botão de Verificar Novamente */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onRetry();
            }}
            disabled={isRetrying}
            className="w-full min-h-[48px] rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Verificando status...' : 'Verificar Novamente'}</span>
          </button>

          {/* Se o usuário for Admin, atalho para abrir o painel admin e desbloquear */}
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onOpenAdmin();
              }}
              className="w-full min-h-[48px] rounded-2xl bg-stone-100 hover:bg-stone-200 border border-stone-200/80 text-emerald-950 font-bold text-xs flex items-center justify-center space-x-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Gerenciar no Painel Admin</span>
            </button>
          )}

          {/* Botão de Logout */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              signOut();
            }}
            className="w-full min-h-[48px] rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 font-semibold text-xs flex items-center justify-center space-x-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Conta ({user?.email})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
