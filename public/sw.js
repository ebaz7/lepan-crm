const CACHE_NAME = 'finance-app-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index.css',
  '/assets/index.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We try to cache available assets but don't fail if some are missing during dev
      return cache.addAll(ASSETS_TO_CACHE).catch(() => console.log("Some assets not found for caching yet"));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Navigation request strategy: Network First, falling back to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'اعلان جدید',
      icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      data: {
        url: data.url || '/'
      },
      vibrate: [200, 100, 200],
      dir: 'rtl',
      lang: 'fa-IR',
      tag: 'payment-msg',
      renotify: true
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'سامانه بازرگانی', options)
    );
  } catch (e) {
    console.error('Push handling error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let targetUrl = event.notification.data.url || '/';
  
  // Ensure absolute URL if it doesn't start with http
  if (!targetUrl.startsWith('http')) {
    targetUrl = new URL(targetUrl, location.origin).href;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to find an existing window and navigate it
      for (const client of windowClients) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          return client.focus().then((fClient) => {
            if ('navigate' in fClient) {
              return fClient.navigate(targetUrl);
            }
          });
        }
      }
      // If no window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
