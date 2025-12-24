/**
 * StreamFlow Service Worker v2.1
 * Optimized caching strategy for better performance
 */

const CACHE_NAME = 'streamflow-v2-cache';
const CACHE_VERSION = '2.1.0';
const FULL_CACHE_NAME = `${CACHE_NAME}-${CACHE_VERSION}`;

// Static resources to cache on install
const STATIC_RESOURCES = [
  // CDN resources
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.30.0/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.30.0/fonts/tabler-icons.woff2',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.30.0/fonts/tabler-icons.woff',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.30.0/fonts/tabler-icons.ttf',
  
  // Local static resources
  '/css/styles.css',
  '/js/stream-modal.js',
  '/images/logo.svg',
  '/images/logo_mobile.svg'
];

// Resources that should never be cached
const NO_CACHE_PATTERNS = [
  '/api/',
  '/login',
  '/logout',
  '/signup',
  '/upload/',
  '/stream/'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(FULL_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('[SW] All resources cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache resources:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith(CACHE_NAME) && cacheName !== FULL_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = event.request.url;

  // Skip caching for dynamic routes
  if (NO_CACHE_PATTERNS.some(pattern => url.includes(pattern))) {
    return;
  }

  // Cache-first strategy for static resources
  if (isStaticResource(url)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request)
            .then((response) => {
              // Don't cache non-successful responses
              if (!response || response.status !== 200) {
                return response;
              }

              // Clone the response for caching
              const responseToCache = response.clone();

              caches.open(FULL_CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            })
            .catch((error) => {
              console.error('[SW] Fetch failed:', error);
              // Return offline fallback if available
              return caches.match('/offline.html');
            });
        })
    );
  }
});

// Check if URL is a static resource
function isStaticResource(url) {
  return STATIC_RESOURCES.some(resource => url.includes(resource.replace(/^\//, ''))) ||
         url.includes('tabler-icons') ||
         url.includes('cdn.jsdelivr.net') ||
         url.includes('fonts.googleapis.com') ||
         url.includes('fonts.gstatic.com') ||
         url.endsWith('.css') ||
         url.endsWith('.js') ||
         url.endsWith('.woff2') ||
         url.endsWith('.woff') ||
         url.endsWith('.ttf') ||
         url.endsWith('.svg') ||
         url.endsWith('.png') ||
         url.endsWith('.jpg') ||
         url.endsWith('.jpeg') ||
         url.endsWith('.ico');
}

// Message handler for cache control
self.addEventListener('message', (event) => {
  if (event.data) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'CLEAR_CACHE':
        caches.delete(FULL_CACHE_NAME).then(() => {
          console.log('[SW] Cache cleared');
        });
        break;
    }
  }
});