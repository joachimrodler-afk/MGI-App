/// <reference lib="webworker" />
/**
 * Service Worker: Offline-Fähigkeit und Push-Nachrichten.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// App-Shell auch offline öffnen (wichtig für den Notfall-Bereich)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Wetter: Netz zuerst, sonst letzter Stand
registerRoute(({ url }) => url.hostname === 'api.open-meteo.com', new NetworkFirst({ cacheName: 'wetter', networkTimeoutSeconds: 6 }));
// Bilder vom Schwarzen Brett
registerRoute(({ url }) => url.hostname === 'drive.google.com' && url.pathname.startsWith('/thumbnail'), new CacheFirst({ cacheName: 'brett-bilder' }));

// ---------------------------------------------------------------- Push
self.addEventListener('push', (event) => {
  let d: { titel?: string; text?: string; url?: string } = {};
  try {
    const j = event.data?.json() ?? {};
    // FCM liefert die Daten unter "data" (unsere Nachrichten) oder "notification"
    d = j.data ?? { titel: j.notification?.title, text: j.notification?.body };
  } catch {
    d = { titel: 'MGI', text: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(d.titel || 'MGI', {
      body: d.text || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: d.url || './' },
      lang: 'de',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ('focus' in c) {
          void (c as WindowClient).navigate(url).catch(() => undefined);
          return (c as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
