/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST)

// Supabase e Cloudinary: sempre da rede (dados ao vivo)
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') || url.hostname.includes('cloudinary.com'),
  new NetworkOnly()
)

// Google Fonts: cache de longa duração
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31_536_000 })],
  })
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31_536_000 })],
  })
)

// SPA fallback — todas as navegações servem /index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Clique na notificação → traz o PWA para o foreground
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data?.url as string | undefined) ?? '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            ;(client as WindowClient).navigate?.(targetUrl)
            return client.focus()
          }
        }
        return self.clients.openWindow(targetUrl)
      })
  )
})
