import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/useAuth.js';
import { VoronLogo } from '../../components/VoronLogo.js';

interface AdminLoginScreenProps {
  onBackToApp: () => void;
  onSuccess: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onBackToApp, onSuccess }) => {
  const { user, profile, isAdmin, signIn, sendPasswordReset, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
  };

  // Se o usuário já estiver logado, mas não for admin
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-stone-800 border border-stone-700 rounded-3xl p-6 shadow-2xl text-stone-100 space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">
              Acesso Restrito ao Painel Admin
            </h2>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
              Você está autenticado como <strong className="text-stone-200">{user.email}</strong> com papel de <strong className="text-amber-400">{profile?.role || 'usuário'}</strong>.
            </p>
            <p className="text-xs text-rose-300 mt-2 bg-rose-950/40 p-3 rounded-xl border border-rose-800/40">
              Esta área é restrita a Super Administradores do sistema.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={onBackToApp}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all min-h-[48px] cursor-pointer"
            >
              Voltar para o Aplicativo Padrão
            </button>
            <button
              onClick={signOut}
              className="w-full py-2.5 px-4 bg-stone-700/60 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-xl active:scale-95 transition-all min-h-[44px] cursor-pointer"
            >
              Trocar de Conta (Sair)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic();

    if (!email.trim()) {
      setErrorMsg('Informe seu e-mail de administrador.');
      return;
    }

    if (isForgotMode) {
      setIsLoading(true);
      try {
        const { error } = await sendPasswordReset(email);
        if (error) {
          setErrorMsg(error.message || 'Erro ao enviar e-mail de recuperação.');
        } else {
          setSuccessMsg('Link de redefinição enviado com sucesso para seu e-mail.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao processar solicitação.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Digite a senha de administrador.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMsg(error.message === 'Invalid login credentials' ? 'Credenciais inválidas.' : error.message);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#181a1b] border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-stone-100 relative">
        {/* Botão Voltar ao App */}
        <button
          onClick={onBackToApp}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-stone-800/80 cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao App Padrão</span>
        </button>

        {/* Cabeçalho */}
        <div className="space-y-3">
          <VoronLogo size="md" showWordmark={true} variant="light" subtitle="Portal Administrativo" />
          <p className="text-xs text-stone-400 leading-relaxed">
            {isForgotMode
              ? 'Digite o e-mail do administrador para redefinir as credenciais de acesso mestre.'
              : 'Gerenciamento de empresas clientes, instâncias Firebird e inteligência executiva.'}
          </p>
        </div>

        {/* Mensagens de Feedback */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-xl flex items-start space-x-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
              E-mail de Administrador
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="felipealves13tga@hotmail.com"
                required
                autoCapitalize="none"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 bg-stone-900/90 border border-stone-700/80 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px] transition-all"
              />
            </div>
          </div>

          {!isForgotMode && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                  Senha Mestre
                </label>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setIsForgotMode(true);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-3 bg-stone-900/90 border border-stone-700/80 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px] transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-md min-h-[48px] cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isForgotMode ? 'Enviar Link de Redefinição' : 'Acessar Painel de Controle'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {isForgotMode && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsForgotMode(false);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-xs font-bold text-stone-400 hover:text-stone-200 cursor-pointer min-h-[44px]"
            >
              ← Voltar para Login Admin
            </button>
          </div>
        )}

        <div className="p-3 bg-stone-900/60 rounded-xl border border-stone-800 text-[11px] text-stone-400 flex items-center space-x-2">
          <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Acesso estritamente monitorado com token JWT criptografado.</span>
        </div>
      </div>
    </div>
  );
};
