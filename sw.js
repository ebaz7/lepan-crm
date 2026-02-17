
const CACHE_NAME = 'payment-sys-v7-robust';
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
