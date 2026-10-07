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
 * Obtém a inscrição push atual no Service Worker
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[PushNotifications] Erro ao obter subscription atual:', err);
    return null;
  }
}

/**
 * Solicita permissão e cadastra o dispositivo para Web Push
 */
export async function subscribeToPushNotifications(): Promise<{
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

    // 2. Aguarda Service Worker pronto
    const registration = await navigator.serviceWorker.ready;

    // 3. Obtém a chave pública VAPID do backend
    const vapidPublicKey = await fetchVapidPublicKey();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // 4. Cria ou reutiliza inscrição no PushManager do navegador
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    // 5. Envia os dados da inscrição para salvar no Supabase via backend
    await registerPushSubscription(subscription);

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
    const registration = await navigator.serviceWorker.ready;
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
