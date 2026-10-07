// Utilitários de detecção e registro de PWA para o Voron

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredInstallPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== 'undefined') {
  // Captura o evento nativo de instalação do Chrome / Edge / Android
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as InstallPromptEvent;
    installListeners.forEach((listener) => listener(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installListeners.forEach((listener) => listener(false));
    console.log('[Voron PWA] Aplicativo instalado com sucesso pelo usuário');
  });
}

/**
 * Inscreve um callback para ser notificado quando o prompt de instalação estiver pronto
 */
export function onInstallPromptChange(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(deferredInstallPrompt !== null);
  return () => {
    installListeners.delete(callback);
  };
}

/**
 * Dispara o prompt nativo de instalação no Android/Chrome
 */
export async function triggerPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return false;
  }
  try {
    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installListeners.forEach((listener) => listener(false));
    return outcome === 'accepted';
  } catch (err) {
    console.error('[Voron PWA] Erro ao disparar instalação:', err);
    return false;
  }
}

/**
 * Detecta se a aplicação está rodando em modo Standalone (PWA instalado na Home Screen)
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Padrão W3C
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isDisplayStandalone) return true;

  // 2. iOS Safari Home Screen
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIosStandalone) return true;

  // 3. Android TWA / app wrapper
  if (document.referrer.startsWith('android-app://')) return true;

  // 4. Parâmetro query explícito de PWA
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('source') === 'pwa') return true;

  return false;
}

/**
 * Detecta se o dispositivo é iOS (iPhone, iPad, iPod)
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detecta se é o navegador Safari no iOS (onde a adição à Home Screen é suportada nativamente)
 */
export function isIosSafari(): boolean {
  if (!isIosDevice()) return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  // No iOS, Chrome tem 'crios', Firefox tem 'fxios', Edge tem 'edgios'
  const isOtherBrowser = /crios|fxios|edgios|opt|brave/.test(userAgent);
  return !isOtherBrowser;
}

/**
 * Registra o Service Worker com proteção e tratamento de erros
 */
export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[Voron PWA] Service Worker registrado com sucesso:', reg.scope);
      })
      .catch((err) => {
        console.warn('[Voron PWA] Falha ao registrar Service Worker:', err);
      });
  });
}
