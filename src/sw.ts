/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Précache des assets injectés par Vite PWA
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Activation immédiate du nouveau SW (requis pour registerType: 'autoUpdate')
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Runtime caching : API Supabase (NetworkFirst, 5 min)
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  }),
);

// ─── Push Notifications ───────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  let payload: { titre?: string; message?: string; url?: string } = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { message: event.data.text() };
    }
  }

  const titre = payload.titre ?? 'LocaBoard';
  const message = payload.message ?? '';
  const url = payload.url ?? '/LocaBoard/';

  event.waitUntil(
    self.registration.showNotification(titre, {
      body: message,
      icon: '/LocaBoard/icons/icon-192.png',
      badge: '/LocaBoard/icons/icon-192.png',
      data: { url },
      tag: 'locaboard-task',
      renotify: true,
    } as NotificationOptions & { renotify?: boolean }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url: string = (event.notification.data as { url?: string })?.url ?? '/LocaBoard/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/LocaBoard/') && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
