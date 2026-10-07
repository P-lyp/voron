import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Headset,
  ArrowLeft,
  Building2,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/useAuth.js';
import { checkEmailAccess } from '../services/api.js';
import { CheckEmailResultDTO } from '@ai-db/shared';
import { VoronLogo } from '../components/VoronLogo.js';

interface AuthScreenProps {
  onSuccess?: () => void;
  onOpenAdminLogin?: () => void;
}

type AuthStep = 'email' | 'password' | 'first_access' | 'not_found' | 'forgot';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onOpenAdminLogin }) => {
  const { signIn, signUp, sendPasswordReset } = useAuth();

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [emailCheckData, setEmailCheckData] = useState<CheckEmailResultDTO | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(6);
    }
  };

  // Etapa 1: Verificar se o e-mail existe, é 1º acesso ou se não está cadastrado
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Informe um endereço de e-mail válido.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await checkEmailAccess(cleanEmail);
      setEmailCheckData(result);

      if (result.status === 'registered') {
        setStep('password');
      } else if (result.status === 'first_access') {
        if (result.fullName) {
          setFullName(result.fullName);
        }
        setStep('first_access');
      } else {
        setStep('not_found');
      }
    } catch (err: any) {
      // Fallback em caso de instabilidade da rede: permite digitar a senha para tentar login direto
      console.warn('Falha na rota check-email, fallback para login direto:', err);
      setStep('password');
    } finally {
      setIsLoading(false);
    }
  };

  // Submissão de login com senha existente
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic();

    if (!password) {
      setErrorMsg('Digite sua senha de acesso.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email.trim().toLowerCase(), password);
      if (error) {
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? 'Senha incorreta. Verifique os dados ou redefina sua senha.'
            : error.message
        );
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submissão do primeiro acesso: cria conta e define senha
  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic();

    if (!fullName.trim()) {
      setErrorMsg('Informe seu nome completo para o cadastro.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      const { error, user } = await signUp(email.trim().toLowerCase(), password, fullName.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        if (user && !user.confirmed_at) {
          setSuccessMsg('Conta criada! Caso a confirmação de e-mail esteja ativada, verifique sua caixa de entrada.');
        }
        onSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao concluir primeiro acesso.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submissão de recuperação de senha
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic();

    if (!email.trim()) {
      setErrorMsg('Informe seu e-mail cadastrado.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await sendPasswordReset(email.trim().toLowerCase());
      if (error) {
        setErrorMsg(error.message || 'Erro ao enviar e-mail de recuperação.');
      } else {
        setSuccessMsg('Enviamos um link de recuperação para o seu e-mail!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToEmail = () => {
    triggerHaptic();
    setStep('email');
    setPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-stone-200/50 flex justify-center font-sans">
      <div className="w-full max-w-md min-h-screen bg-[#f9f9fa] flex flex-col justify-between shadow-2xl relative px-6 py-8">
        {/* Topo / Marca */}
        <div className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <VoronLogo size="md" showWordmark={true} />
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-600/15">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Conexão Segura</span>
            </div>
          </div>

          {/* Cabeçalho dinâmico conforme a etapa */}
          <div>
            {step === 'email' && (
              <>
                <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
                  Acessar sua Conta
                </h1>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Inteligência executiva Voron conectada em tempo real com seu ERP Firebird.
                </p>
              </>
            )}

            {step === 'password' && (
              <>
                <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
                  {emailCheckData?.fullName
                    ? `Olá, ${emailCheckData.fullName.split(' ')[0]}!`
                    : 'Digite sua Senha'}
                </h1>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  {emailCheckData?.companyName
                    ? `Acesso à ${emailCheckData.companyName}. Digite sua senha cadastrada.`
                    : 'Digite sua senha cadastrada para entrar.'}
                </p>
              </>
            )}

            {step === 'first_access' && (
              <>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-900 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Primeiro Acesso Detectado</span>
                </div>
                <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
                  Crie sua Senha
                </h1>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Identificamos seu convite para{' '}
                  <strong className="text-stone-800">
                    {emailCheckData?.companyName || 'sua empresa'}
                  </strong>
                  . Defina sua senha para começar.
                </p>
              </>
            )}

            {step === 'not_found' && (
              <>
                <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
                  Acesso Não Habilitado
                </h1>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Não encontramos autorização ativa para este endereço de e-mail.
                </p>
              </>
            )}

            {step === 'forgot' && (
              <>
                <h1 className="text-2xl font-black text-[#0f291e] tracking-tight">
                  Recuperar Senha
                </h1>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Enviaremos as instruções de redefinição para o seu e-mail.
                </p>
              </>
            )}
          </div>

          {/* Pill de Identificação do E-mail (quando não está na etapa inicial) */}
          {step !== 'email' && (
            <div className="flex items-center justify-between p-2.5 bg-stone-100/90 rounded-xl border border-stone-200 text-xs">
              <div className="flex items-center space-x-2 truncate pr-2">
                <Mail className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="font-semibold text-stone-800 truncate">{email}</span>
              </div>
              <button
                type="button"
                onClick={handleResetToEmail}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded-md hover:bg-white transition-all cursor-pointer shrink-0 min-h-[36px] flex items-center"
              >
                Trocar
              </button>
            </div>
          )}

          {/* Mensagens de Erro ou Sucesso */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-900 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {/* 1. Formulário Etapa 1: Digitar E-mail */}
          {step === 'email' && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  E-mail Profissional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@sualoja.com"
                    required
                    autoFocus
                    autoCapitalize="none"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:border-transparent min-h-[48px] transition-all"
                  />
                </div>
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
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. Formulário Etapa 2A: Usuário Já Cadastrado (Digitar Senha) */}
          {step === 'password' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Sua Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setStep('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer min-h-[44px] flex items-center"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                    autoFocus
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:border-transparent min-h-[48px] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                    <span>Entrar no Aplicativo</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. Formulário Etapa 2B: Primeiro Acesso (Definir Senha) */}
          {step === 'first_access' && (
            <form onSubmit={handleFirstAccess} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:border-transparent min-h-[48px] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Crie sua Senha de Acesso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:border-transparent min-h-[48px] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                    <span>Ativar Conta e Entrar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 4. Etapa 2C: E-mail Não Habilitado (Acesso Fechado com Aviso de Suporte) */}
          {step === 'not_found' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                  <Headset className="w-4 h-4 text-amber-700" />
                  <span>Acesso não habilitado</span>
                </div>
                <p className="text-xs text-amber-950/80 leading-relaxed">
                  O <strong>Voron</strong> é uma plataforma corporativa exclusiva. Para liberar seu acesso, entre em contato diretamente com o suporte técnico.
                </p>
              </div>

              <div className="p-4 bg-stone-100/80 border border-stone-200/80 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-stone-800">
                  Como solicitar a ativação?
                </p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Entre em contato com o suporte para habilitar sua conta de acesso.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleResetToEmail}
                  className="w-full py-3 px-4 bg-[#1e5841] text-white text-xs font-bold rounded-xl hover:bg-[#154c36] active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm min-h-[48px] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Tentar outro e-mail</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. Sub-fluxo: Recuperação de Senha */}
          {step === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  E-mail para Redefinição
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu-email@empresa.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0f3928] focus:border-transparent min-h-[48px] transition-all"
                  />
                </div>
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
                    <span>Enviar Link de Redefinição</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setStep('password');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer min-h-[44px] inline-flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para digitar a senha</span>
                </button>
              </div>
            </form>
          )}

          {/* Dica amigável apenas na tela inicial de e-mail */}
          {step === 'email' && (
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-900/10 text-[11px] text-stone-600 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-950">
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Acesso exclusivo para empresas autorizadas</span>
              </div>
              <p className="leading-relaxed">
                Digite o e-mail cadastrado pelo administrador da sua loja. O sistema reconhecerá automaticamente sua permissão e empresa vinculada.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé: Link para Portal Admin */}
        <div className="pt-6 border-t border-stone-200 text-center">
          {onOpenAdminLogin && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onOpenAdminLogin();
              }}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer py-2 px-3 rounded-lg min-h-[44px]"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-400" />
              <span>Área Restrita: Acessar Painel Admin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
