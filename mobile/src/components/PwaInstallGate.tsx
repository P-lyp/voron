import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  ExternalLink, 
  ArrowDown, 
  Sparkles,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { 
  isStandaloneMode, 
  isIosDevice, 
  isIosSafari, 
  onInstallPromptChange, 
  triggerPwaInstall 
} from '../utils/pwa.js';
import { VoronLogo } from './VoronLogo.js';

interface PwaInstallGateProps {
  children: React.ReactNode;
}

export const PwaInstallGate: React.FC<PwaInstallGateProps> = ({ children }) => {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandaloneMode());
  const [isDev, setIsDev] = useState<boolean>(false);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [bypassPwa, setBypassPwa] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Permite bypass persistido na sessão ou via parâmetro de URL
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.get('dev') === 'true' ||
      urlParams.get('bypass_pwa') === 'true' ||
      sessionStorage.getItem('voron_pwa_bypass') === 'true'
    );
  });

  const isIos = isIosDevice();
  const isSafari = isIosSafari();

  // Detecção de ambiente de desenvolvimento e rotas isentas
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname;
    const isLocalhost = 
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname.endsWith('.local') ||
      Boolean((import.meta as any)?.env?.DEV);

    const pathname = window.location.pathname;
    const isExemptRoute = 
      pathname.startsWith('/admin') || 
      pathname.startsWith('/cadastro');

    if (isLocalhost || isExemptRoute) {
      setIsDev(true);
    }

    // Monitora evento de instalação do Android/Chrome
    const unsubscribe = onInstallPromptChange((available) => {
      setCanInstall(available);
    });

    // Listener para quando o app for instalado enquanto aberto
    const handleAppInstalled = () => {
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Se estiver no ambiente de dev, em modo PWA instalado ou se tiver bypass autorizado, renderiza o ERP direto
  if (isDev || isStandalone || bypassPwa) {
    return <>{children}</>;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const accepted = await triggerPwaInstall();
      if (accepted) {
        setIsStandalone(true);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleTemporaryWebAccess = () => {
    sessionStorage.setItem('voron_pwa_bypass', 'true');
    setBypassPwa(true);
  };

  return (
    <div className="min-h-screen bg-[#071913] text-stone-100 flex flex-col justify-between p-5 sm:p-8 selection:bg-emerald-400 selection:text-[#071913] relative overflow-hidden">
      {/* Background Decorativo com iluminação volumétrica suave */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Cabeçalho de Boas-Vindas */}
      <header className="relative z-10 pt-6 sm:pt-10 flex flex-col items-center text-center max-w-sm mx-auto">
        <div className="mb-5 drop-shadow-xl">
          <VoronLogo size="xl" variant="light" boxVariant="emerald" showWordmark={false} />
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wider uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Voron ERP Executivo</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
          Acesse direto pelo aplicativo instalado
        </h1>
        
        <p className="mt-2.5 text-sm text-emerald-100/70 leading-relaxed font-normal">
          Para garantir máxima agilidade, segurança de dados e tela cheia sem barras de navegação, adicione o Voron à sua tela inicial.
        </p>
      </header>

      {/* Conteúdo Central Específico por Plataforma */}
      <main className="relative z-10 my-auto py-6 max-w-sm w-full mx-auto">
        {/* Caso 1: Dispositivo iOS (iPhone / iPad) */}
        {isIos ? (
          <div className="bg-[#0b241c]/90 backdrop-blur-2xl border border-emerald-500/20 rounded-[28px] p-6 shadow-2xl space-y-5">
            {isSafari ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-300 font-semibold text-sm pb-2 border-b border-emerald-500/15">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>3 passos rápidos no seu iPhone:</span>
                </div>

                {/* Passo 1 */}
                <div className="flex items-start gap-3.5 pt-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-400 text-[#071913] font-bold flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                    1
                  </div>
                  <div className="flex-1 text-sm text-stone-200 leading-snug">
                    <span>Toque no botão </span>
                    <strong className="text-white font-semibold">Compartilhar</strong>
                    <span className="inline-flex items-center align-middle mx-1.5 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-inner">
                      <Share className="w-3.5 h-3.5" />
                    </span>
                    <span>na barra inferior do Safari.</span>
                  </div>
                </div>

                {/* Passo 2 */}
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-400 text-[#071913] font-bold flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                    2
                  </div>
                  <div className="flex-1 text-sm text-stone-200 leading-snug">
                    <span>Role um pouco e selecione </span>
                    <strong className="text-white font-semibold">Adicionar à Tela de Início</strong>
                    <span className="inline-flex items-center align-middle mx-1.5 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-inner">
                      <PlusSquare className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Passo 3 */}
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-400 text-[#071913] font-bold flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                    3
                  </div>
                  <div className="flex-1 text-sm text-stone-200 leading-snug">
                    <span>Toque em </span>
                    <strong className="text-emerald-300 font-semibold">Adicionar</strong>
                    <span> no canto superior direito.</span>
                  </div>
                </div>

                {/* Dica Visual */}
                <div className="pt-3 mt-1 border-t border-emerald-500/15 flex items-center gap-2.5 text-xs text-emerald-200/60">
                  <ArrowDown className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
                  <span>Depois abra o ícone verde Voron na sua tela inicial!</span>
                </div>
              </div>
            ) : (
              /* Caso o usuário esteja no Chrome / Firefox / rede social no iOS */
              <div className="text-center py-2 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-white text-base">Abra pelo Safari</h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  No iPhone, a instalação na tela inicial funciona exclusivamente pelo navegador <strong>Safari</strong>. Copie o endereço e cole no Safari para instalar.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Caso 2: Dispositivo Android / Chrome / Computador */
          <div className="bg-[#0b241c]/90 backdrop-blur-2xl border border-emerald-500/20 rounded-[28px] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-1 border-b border-emerald-500/15">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <h2 className="font-bold text-white text-sm">Instalação Oficial Voron</h2>
                <p className="text-xs text-emerald-200/60 mt-0.5">Sem precisar de lojas de aplicativo</p>
              </div>
            </div>

            {/* Botão de Instalação Ergonômico (Apple HIG & M3 touch target >= 48px) */}
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="w-full min-h-[52px] py-3.5 px-5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 active:scale-95 text-[#071913] font-extrabold text-base rounded-2xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-70"
            >
              <Download className="w-5 h-5 text-[#071913] stroke-[2.5]" />
              <span>{isInstalling ? 'Instalando aplicativo...' : 'Instalar Aplicativo Voron'}</span>
            </button>

            {!canInstall && (
              <p className="text-center text-xs text-emerald-100/60 pt-0.5 leading-relaxed">
                Dica: Você também pode tocar nos <strong>três pontinhos ⋮</strong> do navegador e selecionar <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
              </p>
            )}

            {/* Vantagens Claras */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/15 text-xs text-stone-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Acesso instantâneo</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Uso em tela cheia</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé: Acesso de Contingência e Identificação */}
      <footer className="relative z-10 pb-4 text-center space-y-2">
        <button
          onClick={handleTemporaryWebAccess}
          className="inline-flex items-center gap-1.5 text-xs text-emerald-200/50 hover:text-emerald-100 active:scale-95 min-h-[44px] py-2 px-3 rounded-xl transition-colors cursor-pointer"
        >
          <span>Continuar temporariamente pelo navegador</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <div className="text-[11px] text-emerald-100/30 font-mono">
          Voron ERP • Instalação PWA
        </div>
      </footer>
    </div>
  );
};
