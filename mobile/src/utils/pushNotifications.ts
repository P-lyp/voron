// Utilitário de Gerenciamento de Web Push Notifications para o PWA Voron
import {
  fetchVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
} from '../services/api.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica se o dispositivo e navegador atual suportam Web Push Notifications
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Retorna o status de permissão atual ('default', 'granted', 'denied')
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Garante que o Service Worker está registrado e pronto, com fallback de tempo hábil
 */
async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service Worker não suportado neste navegador.');
  }

  // 1. Tenta obter o registro existente
  let registration = await navigator.serviceWorker.getRegistration();

  // 2. Se não estiver registrado, registra /sw.js imediatamente
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PushNotifications] /sw.js registrado sob demanda com sucesso.');
    } catch (regErr: any) {
      console.error('[PushNotifications] Falha ao registrar /sw.js:', regErr);
      throw new Error(`Falha ao registrar Service Worker: ${regErr.message}`);
    }
  }

  // 3. Aguarda o worker estar pronto com timeout defensivo de 5s para nunca travar a UI
  const readyReg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((resolve) => {
      // Se a registration já tem um worker ativo, resolve imediatamente
      if (registration?.active) {
        return resolve(registration);
      }
      setTimeout(() => {
        if (registration) resolve(registration);
      }, 2500);
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tempo limite ao aguardar Service Worker ficar pronto.')), 5000)
    ),
  ]);

  return readyReg;
}

/**
 * Obtém a inscrição push atual no Service Worker
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await ensureServiceWorkerReady();
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[PushNotifications] Erro ao obter subscription atual:', err);
    return null;
  }
}

/**
 * Solicita permissão e cadastra o dispositivo para Web Push
 */
export async function subscribeToPushNotifications(
  companyId?: string,
  options?: { forceRenew?: boolean }
): Promise<{
  success: boolean;
  permission: NotificationPermission;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      permission: 'denied',
      error: 'Notificações Push não suportadas neste navegador.',
    };
  }

  try {
    // 1. Solicita permissão ao usuário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        error: permission === 'denied' ? 'Permissão bloqueada no navegador' : 'Permissão não concedida',
      };
    }

    // 2. Garante Service Worker pronto com timeout seguro
    const registration = await ensureServiceWorkerReady();

    // 3. Obtém a chave pública VAPID oficial do backend
    const vapidPublicKey = await fetchVapidPublicKey();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // 4. Cria ou reutiliza inscrição no PushManager do navegador
    let subscription = await registration.pushManager.getSubscription();

    // Se já houver inscrição prévia, valida se a chave pública coincide com a atual do servidor
    if (subscription) {
      let keyMatches = false;
      const rawAppKey = subscription.options?.applicationServerKey;
      if (rawAppKey && !options?.forceRenew) {
        const subKeyArray = new Uint8Array(rawAppKey);
        if (subKeyArray.length === convertedVapidKey.length) {
          keyMatches = subKeyArray.every((byte, idx) => byte === convertedVapidKey[idx]);
        }
      }

      if (!keyMatches || options?.forceRenew) {
        console.warn('[PushNotifications] Inscrição desatualizada ou com chave antiga. Renovando...');
        try {
          const oldEndpoint = subscription.endpoint;
          await subscription.unsubscribe();
          if (oldEndpoint) {
            unregisterPushSubscription(oldEndpoint).catch(() => {});
          }
        } catch (unsubErr) {
          console.warn('[PushNotifications] Aviso ao desinscrever assinatura anterior:', unsubErr);
        }
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
      console.log('[PushNotifications] Nova assinatura Push gerada com sucesso via PushManager.');
    }

    // 5. Envia os dados da inscrição para salvar no Supabase via backend
    await registerPushSubscription(subscription, companyId);

    return { success: true, permission: 'granted' };
  } catch (err: any) {
    console.error('[PushNotifications] Falha ao inscrever para notificações push:', err);
    return {
      success: false,
      permission: getNotificationPermission(),
      error: err.message || 'Falha ao inscrever dispositivo',
    };
  }
}

/**
 * Desinscreve o dispositivo das notificações push
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;
  try {
    const registration = await ensureServiceWorkerReady();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await unregisterPushSubscription(endpoint);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[PushNotifications] Erro ao desinscrever dispositivo:', err);
    return false;
  }
}
