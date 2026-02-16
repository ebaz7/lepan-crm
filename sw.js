
const CACHE_NAME = 'payment-sys-v9-share';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// *** SHARE TARGET HANDLER ***
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept the Share Target POST request
  if (url.pathname === '/share-target/' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const mediaFiles = formData.getAll('media'); // Files
        const text = formData.get('text'); // Shared text
        const title = formData.get('title');

        // Store in a specific cache for the frontend to retrieve
        const shareCache = await caches.open('share-data');
        
        // We store data as a JSON blob response mapped to specific keys
        const shareData = {
            text: text || title || '',
            files: mediaFiles.map(f => ({ name: f.name, type: f.type, lastModified: f.lastModified }))
        };
        
        await shareCache.put('/shared-meta', new Response(JSON.stringify(shareData)));

        // Store files individually if any
        if (mediaFiles && mediaFiles.length > 0) {
            for (let i = 0; i < mediaFiles.length; i++) {
                await shareCache.put(`/shared-file-${i}`, new Response(mediaFiles[i]));
            }
        }

        // Redirect to the app with a query param indicating a share happened
        return Response.redirect('/#chat?action=share_received', 303);
      })()
    );
    return;
  }
  
  // Standard Cache Logic for other requests (Network First for API, Cache First for assets)
  if (url.pathname.startsWith('/api')) {
      return; // Let browser handle API network
  }

  // For PWA assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// *** CORE PUSH NOTIFICATION LOGIC ***
self.addEventListener('push', (event) => {
  console.log('[SW] Push Received:', event.data ? event.data.text() : 'No Data');
  
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'پیام سیستم';
    const body = data.body || 'شما یک پیام جدید دارید';
    
    const options = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        timestamp: Date.now()
      },
      tag: 'payment-sys-notification', // Groups notifications
      renotify: true, // Play sound even if tag is same
      requireInteraction: true // Keep notification until user interacts
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[SW] Push Error:', err);
    // Fallback if JSON parse fails
    event.waitUntil(
        self.registration.showNotification('پیام جدید', { body: 'پیام دریافت شد', icon: '/pwa-192x192.png' })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification Clicked');
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Check if app is already open
      for (const client of clientList) {
        // If url matches base, just focus it
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          if (targetUrl !== '/') client.navigate(targetUrl);
          return client.focus();
        }
      }
      // 2. If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
