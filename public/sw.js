const CACHE_NAME = 'shri-govind-pharmacy-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

const STATIC_ASSETS = [
  '/js/theme.js',
  '/js/utils.js',
  '/js/script.js',
  '/css/style.css',
  '/css/cart.css',
  '/css/account.css',
  '/css/doctor.css',
  '/css/contact.css',
  '/css/categories.css',
  '/css/appointment-detail.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch event - use different strategies based on request type
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // HTML pages: Network first, fallback to cache
  if (request.mode === 'navigate' || request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, clonedResponse));
          return response;
        })
        .catch(() => caches.match('/home'))
    );
    return;
  }

  // Static assets (CSS, JS, fonts): Cache first, fallback to network
  if (url.origin === location.origin && (url.pathname.endsWith('.css') || url.pathname.endsWith('.js'))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          
          return fetch(request).then(response => {
            const clonedResponse = response.clone();
            caches.open(STATIC_CACHE)
              .then(cache => cache.put(request, clonedResponse));
            return response;
          });
        })
    );
    return;
  }

  // Images: Cache first, fallback to network
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          
          return fetch(request).then(response => {
            const clonedResponse = response.clone();
            caches.open(STATIC_CACHE)
              .then(cache => cache.put(request, clonedResponse));
            return response;
          });
        })
        .catch(() => caches.match('/images/icon-192x192.png'))
    );
    return;
  }

  // API requests: Network only, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Default: Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push notification event
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'New notification from Shri Govind Pharmacy',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Shri Govind Pharmacy', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
