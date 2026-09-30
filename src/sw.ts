/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision?: string | null; url: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//],
  }),
);
registerRoute(
  ({ url }) => url.pathname.includes('/api/v1/'),
  new NetworkOnly(),
  'GET',
);

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 240;

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
  return cleaned || fallback;
}

function safeInternalUrl(value: unknown): string {
  if (typeof value !== 'string') return '/app/notifications';
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/app/notifications';
  } catch {
    return '/app/notifications';
  }
}

self.addEventListener('push', (event) => {
  let payload: Record<string, unknown> = {};
  const raw = event.data?.text() ?? '';
  try {
    const parsed = raw ? JSON.parse(raw) : undefined;
    if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
  } catch {
    payload = { body: raw };
  }
  const title = cleanText(payload.title, 'Cabales', MAX_TITLE_LENGTH);
  const body = cleanText(payload.body, 'Tienes un nuevo aviso.', MAX_BODY_LENGTH);
  const url = safeInternalUrl(payload.url);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      tag: 'cabales-notification',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeInternalUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (existing) {
        await existing.navigate(target);
        await existing.focus();
        return;
      }
      await self.clients.openWindow(new URL(target, self.location.origin).toString());
    }),
  );
});
