import React from 'react';
import { useAuth } from '../context/useAuth.js';
import {
  X,
  User,
  Building2,
  Server,
  ShieldCheck,
  LogOut,
  Sliders,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  companyName: string;
  onOpenAdmin?: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  isOnline,
  companyName,
  onOpenAdmin,
}) => {
  const { user, profile, isAdmin, signOut } = useAuth();

  if (!isOpen) return null;

  const initials = (profile?.fullName || user?.email?.split('@')[0] || 'U')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    onClose();
    await signOut();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xs sm:max-w-sm h-full bg-[#fafaf7] shadow-2xl flex flex-col justify-between border-l border-stone-200 animate-slide-left">
        {/* Header do Drawer */}
        <div className="p-5 border-b border-stone-200/80 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0f3928] to-[#1e5841] text-[#c0ecd6] flex items-center justify-center font-bold text-sm shadow-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900 truncate">
                {profile?.fullName || 'Minha Conta'}
              </h3>
              <p className="text-[11px] text-stone-500 font-mono truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu de perfil"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Corpo do Drawer com Opções */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Card da Empresa */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Empresa Atual
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-emerald-800 shrink-0" />
                <span className="text-xs font-bold text-stone-900 truncate">
                  {companyName}
                </span>
              </div>
              <span className="capitalize text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-600/15">
                {profile?.role || 'vendedor'}
              </span>
            </div>
          </div>

          {/* Status do Servidor Local */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Diagnóstico do ERP
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-stone-600" />
                <span className="text-xs font-semibold text-stone-800">
                  Agente Local Firebird
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                {isOnline ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Online</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-rose-600">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Atalho Portal Admin (se for admin) */}
          {isAdmin && onOpenAdmin && (
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200/80 shadow-xs flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-stone-900 block">
                    Voron Admin & Configurações
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Empresas, tokens e cadastros
                  </span>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </button>
          )}
        </div>

        {/* Rodapé com Botão Sair */}
        <div className="p-4 border-t border-stone-200/80 bg-white">
          <button
            onClick={handleLogout}
            className="w-full min-h-[48px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
