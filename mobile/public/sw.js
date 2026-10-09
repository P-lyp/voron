// Voron — Service Worker Ultraleve para Suporte PWA
const CACHE_NAME = 'voron-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Voron SW] Aviso ao pré-carregar recursos estáticos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições com proteção de dados transacionais
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Apenas intercepta métodos GET
  if (req.method !== 'GET') {
    return;
  }

  // 2. Bypass imediato (Network Only) para ambiente de desenvolvimento Vite, HMR, APIs corporativas e Supabase
  const isDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.port === '5173';
  const isDevResource =
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('vite') ||
    url.searchParams.has('t') ||
    url.searchParams.has('token') ||
    url.searchParams.has('v');

  if (
    isDevHost ||
    isDevResource ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // 3. Estratégia Network-First para navegação HTML (garante versão mais recente do app)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(req);
          return cachedResponse || caches.match('/index.html');
        })
    );
    return;
  }

  // 4. Estratégia Stale-While-Revalidate para recursos estáticos (CSS, JS, fontes, imagens)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// ==========================================
// 5. Suporte Avançado a Web Push Notifications (PWA)
// ==========================================
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'Voron ERP';

    // Padrões de vibração personalizados por severidade/tipo
    let vibratePattern = [100, 50, 100];
    if (payload.tipo === 'offline') {
      vibratePattern = [200, 100, 200, 100, 300]; // Padrão urgente de queda
    } else if (payload.tipo === 'meta' || payload.tipo === 'pedido_expressivo') {
      vibratePattern = [80, 40, 80, 40, 120]; // Padrão vibrante de comemoração
    }

    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/favicon-32x32.png',
      image: payload.image || undefined,
      vibrate: vibratePattern,
      tag: payload.tag || (payload.tipo ? `voron-${payload.tipo}` : 'voron-alert'),
      renotify: payload.renotify !== false,
      requireInteraction: Boolean(payload.requireInteraction),
      silent: Boolean(payload.silent),
      actions: Array.isArray(payload.actions) ? payload.actions : [],
      data: {
        url: payload.url || '/?tab=dashboard',
        tipo: payload.tipo,
        actions: payload.actions,
        timestamp: payload.timestamp || Date.now(),
        ...payload.data,
      },
    };

    // Notifica simultaneamente abas ativas abertas via postMessage
    const notifyClientsPromise = self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: {
              title,
              ...options,
            },
          });
        }
      })
      .catch(() => {});

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, options),
        notifyClientsPromise,
      ])
    );
  } catch (err) {
    console.warn('[Voron SW] Erro ao processar payload da notificação push:', err);
  }
});

// Ação de clique na notificação ou em botões de ação interativos
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = event.notification.data?.url || '/';

  // Trata ações interativas específicas disparadas pelos botões do push
  if (event.action) {
    if (event.action === 'check_status' || event.action === 'status') {
      targetUrl = '/?tab=admin';
    } else if (event.action === 'open_dashboard' || event.action === 'dashboard') {
      targetUrl = '/?tab=dashboard';
    } else if (event.action === 'open_ranking' || event.action === 'ranking') {
      targetUrl = '/?tab=dashboard&view=ranking';
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Se já existe uma aba/janela aberta do Voron, foca nela e envia mensagem
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url: targetUrl,
            action: event.action,
            data: event.notification.data,
          });

          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // 2. Se o app estiver totalmente fechado, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
