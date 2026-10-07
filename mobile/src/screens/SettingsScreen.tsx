import React, { useState } from 'react';
import { ViewTransition, startTransition } from '../utils/view-transitions.js';
import { Server, Bell, HelpCircle, LogOut, CheckCircle2, XCircle, ChevronRight, Database, ShieldCheck, Sliders, User, KeyRound, Headset, X } from 'lucide-react';
import { useAuth } from '../context/useAuth.js';
import { VoronLogo } from '../components/VoronLogo.js';

interface SettingsScreenProps {
  isOnline: boolean;
  companyName?: string;
  onOpenAdmin?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ isOnline, companyName, onOpenAdmin }) => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [showNotice, setShowNotice] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const displayName = companyName || 'Empresa Piloto';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'EP';

  const toggleNotice = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
    startTransition(() => {
      setShowNotice((prev) => !prev);
    });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Título da Seção */}
      <div className="pt-1 pb-1">
        <h2 className="text-[18px] font-bold text-[#0f291e] tracking-tight">
          Configurações & Conexão
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Diagnóstico do servidor e informativos da empresa
        </p>
      </div>

      {/* Card do Usuário Autenticado */}
      {user && (
        <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-5 h-5 text-stone-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-900 truncate">
                {profile?.fullName || user.email?.split('@')[0]}
              </p>
              <p className="text-[11px] text-stone-500 truncate font-mono">
                {user.email}
              </p>
            </div>
          </div>
          <span className="capitalize text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-600/15">
            {profile?.role || 'vendedor'}
          </span>
        </div>
      )}

      {/* Card do Perfil da Empresa com Shared Morph */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-900/10 shadow-sm flex items-center space-x-3.5">
        <ViewTransition name="company-brand-badge" share="morph">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0f3928] to-[#1e5841] text-[#c0ecd6] flex items-center justify-center font-bold text-sm shadow-xs ring-1 ring-emerald-900/10 shrink-0">
            {initials}
          </div>
        </ViewTransition>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[#0f291e] truncate">
            {displayName}
          </h3>
          <p className="text-xs text-stone-500">
            Gestão Comercial • Firebird 5.0
          </p>
        </div>
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-600/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Ativo</span>
        </div>
      </div>

      {/* Lista Minimalista Direta */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm divide-y divide-stone-100 overflow-hidden">
        {/* Item 1: Status do Servidor ERP */}
        <div className="p-4 flex items-center justify-between min-h-[52px]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0f291e]">
                Servidor da Loja (ERP)
              </p>
              <p className="text-[11px] text-stone-500">
                Sincronização em tempo real
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {isOnline ? (
              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Conectado</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-600">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Item 2: Base de Dados Firebird */}
        <div className="p-4 flex items-center justify-between min-h-[52px]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0f291e]">
                Banco de Dados
              </p>
              <p className="text-[11px] text-stone-500">
                Firebird 5.0 (TGA.FDB)
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
            Somente Leitura
          </span>
        </div>

        {/* Item 3: Informativos e Dicas do Sistema com Expansão Animada */}
        <button
          onClick={toggleNotice}
          className="w-full p-4 flex items-center justify-between hover:bg-stone-50/60 active:bg-stone-100/60 transition-colors text-left cursor-pointer min-h-[52px]"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0f291e]">
                Avisos e Informativos
              </p>
              <p className="text-[11px] text-stone-500">
                Dicas de gestão e novidades
              </p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${showNotice ? 'rotate-90' : ''}`} />
        </button>

        {showNotice && (
          <ViewTransition enter="slide-down" exit="fade-out" default="none">
            <div className="px-4 py-3.5 bg-emerald-50/40 text-xs text-emerald-950 space-y-1.5 border-t border-emerald-900/5">
              <p className="font-semibold text-emerald-900">
                Dica de Gestão:
              </p>
              <p className="leading-relaxed text-stone-700">
                Consulte seu Assistente IA perguntando: <em>"Quais contas vencem amanhã?"</em> para planejar o fluxo de caixa com antecedência.
              </p>
            </div>
          </ViewTransition>
        )}

        {/* Item 4: Segurança do Túnel */}
        <div className="p-4 flex items-center justify-between min-h-[52px]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0f291e]">
                Segurança do Túnel
              </p>
              <p className="text-[11px] text-stone-500">
                Zero portas abertas no roteador
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            Seguro
          </span>
        </div>

        {/* Item 5: Painel de Controle Admin (Exclusivo para papel admin) */}
        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="w-full p-4 flex items-center justify-between hover:bg-emerald-50/50 active:bg-emerald-100/50 transition-colors text-left min-h-[52px] cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0f291e]">
                  Painel de Controle Admin
                </p>
                <p className="text-[11px] text-stone-500">
                  Gerenciar empresas, rotinas do ERP e tokens
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Admin
              </span>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>
          </button>
        )}

        {/* Item 6: Ajuda e Suporte */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate?.(6);
            }
            setShowSupportModal(true);
          }}
          className="w-full p-4 flex items-center justify-between hover:bg-stone-50/60 active:bg-stone-100/60 transition-colors text-left min-h-[52px] cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0f291e]">
                Ajuda e Suporte
              </p>
              <p className="text-[11px] text-stone-500">
                Entre em contato com o suporte
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>

        {/* Item 7: Sair da Conta */}
        <button
          type="button"
          onClick={signOut}
          className="w-full p-4 flex items-center justify-between hover:bg-rose-50/40 active:bg-rose-100/40 transition-colors text-left text-rose-700 min-h-[52px] cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-900">
                Sair da Conta
              </p>
              <p className="text-[11px] text-rose-500">
                Desconectar este dispositivo
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </button>
      </div>

      {/* Modal Informativo de Suporte (Sem links externos) */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-stone-200/80 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-600/15">
              <Headset className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-stone-900">
                Ajuda e Suporte
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Entre em contato diretamente com o suporte para esclarecer dúvidas, solicitar assistência técnica ou obter auxílio com a plataforma.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                  navigator.vibrate?.(6);
                }
                setShowSupportModal(false);
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#1e5841] text-white font-bold text-xs hover:bg-[#154c36] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Rodapé da Marca Voron */}
      <div className="pt-4 pb-2 flex flex-col items-center justify-center text-center space-y-1.5 opacity-85 select-none">
        <VoronLogo size="sm" showWordmark={true} />
        <p className="text-[11px] text-stone-500 font-medium">
          Voron v1.0 • Inteligência Executiva Firebird
        </p>
      </div>
    </div>
  );
};
