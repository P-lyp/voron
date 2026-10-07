import React, { useState } from 'react';
import { Building2, KeyRound, ArrowRight, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/useAuth.js';
import { VoronLogo } from '../components/VoronLogo.js';

interface ClaimCompanyScreenProps {
  onSuccess?: () => void;
}

export const ClaimCompanyScreen: React.FC<ClaimCompanyScreenProps> = ({ onSuccess }) => {
  const { user, profile, claimCompany, signOut } = useAuth();
  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic();

    if (!activationCode.trim()) {
      setErrorMsg('Digite o código de ativação fornecido pela sua equipe.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await claimCompany(activationCode.trim());
      setSuccessMsg(`Empresa "${res.company.name}" vinculada com sucesso!`);
      setTimeout(() => {
        onSuccess?.();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Código de ativação inválido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-200/50 flex justify-center font-sans">
      <div className="w-full max-w-md min-h-screen bg-[#f9f9fa] flex flex-col justify-between shadow-2xl relative px-6 py-8">
        <div className="pt-4 space-y-6">
          {/* Logo Voron */}
          <div className="pb-1">
            <VoronLogo size="sm" showWordmark={true} />
          </div>

          {/* Ícone e Boas-Vindas */}
          <div className="w-14 h-14 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center shadow-xs">
            <Building2 className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
              Quase lá, {profile?.fullName || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Sua conta foi criada com sucesso, mas ainda não está associada a uma empresa ativa.
            </p>
          </div>

          {/* Card com Código de Ativação */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0f291e]">
                Código de Ativação da Loja
              </label>
              <p className="text-[11px] text-stone-500">
                Insira a chave fornecida pelo suporte ou pela gerência (ex: <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700 font-mono">PILOTO-001</code>).
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleClaim} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                  placeholder="EX: PILOTO-001"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold tracking-wider text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:bg-white min-h-[48px] uppercase transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#0f3928] text-white text-xs font-bold rounded-xl hover:bg-[#154c36] active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm min-h-[48px] cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Ativar e Carregar Dados</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Orientação de Suporte */}
          <div className="p-4 bg-stone-100/80 rounded-2xl border border-stone-200/80 space-y-1.5 text-center">
            <p className="text-xs font-bold text-stone-900">
              Não tem um código de ativação?
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              Entre em contato com o suporte para solicitar a ativação e liberação do seu acesso.
            </p>
          </div>
        </div>

        {/* Rodapé: Desconectar */}
        <div className="pt-6 border-t border-stone-200 flex items-center justify-between">
          <div className="text-[11px] text-stone-400">
            Conectado como <strong className="text-stone-600">{user?.email}</strong>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer py-2 px-3 rounded-lg min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
};
