import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

// Web Share Target (POST multipart). Must be registered before Workbox routes.
// POST /share is intercepted here; the payload is parked in Cache Storage and the browser is
// redirected to GET /share (the React route), which picks it up.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share') return;

  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const cache = await caches.open('kip-share');
      const file = form.getAll('media').find((f) => f instanceof File && f.size > 0);
      const meta = {
        title: form.get('title') || '',
        text: form.get('text') || '',
        url: form.get('url') || '',
        hasFile: Boolean(file),
        fileName: file?.name || null,
      };
      if (file) {
        await cache.put('/__shared/file', new Response(file, { headers: { 'content-type': file.type } }));
      }
      await cache.put('/__shared/meta', new Response(JSON.stringify(meta)));
      return Response.redirect('/share?source=pwa', 303);
    })(),
  );
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));
