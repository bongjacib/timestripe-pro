// TimeStripe Pro - Service Worker v2.1.0
const CACHE_NAME = 'timestripe-pro-cascade-v2.1.0';
const STATIC_CACHE = 'timestripe-static-v2';
const DYNAMIC_CACHE = 'timestripe-dynamic-v2';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE);
        console.log('📦 Caching static assets...');
        await staticCache.addAll(STATIC_ASSETS);
        console.log('✅ Static assets cached successfully');
        await self.skipWaiting();
        console.log('🚀 Service Worker activated immediately');
      } catch (error) {
        console.error('❌ Cache installation failed:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              await caches.delete(cacheName);
            }
          })
        );
        
        await self.clients.claim();
        console.log('✅ Service Worker activated and claiming clients');
      } catch (error) {
        console.error('❌ Service Worker activation failed:', error);
      }
    })()
  );
});

// Fetch event - caching strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    (async () => {
      try {
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok) {
          if (event.request.url.startsWith(self.location.origin)) {
            const dynamicCache = await caches.open(DYNAMIC_CACHE);
            dynamicCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
      } catch (networkError) {
        console.log('🌐 Network failed, serving fallback');
        
        if (event.request.destination === 'document' || 
            event.request.headers.get('accept')?.includes('text/html')) {
          return new Response(
            `<!DOCTYPE html>
            <html>
            <head><title>Offline - TimeStripe Pro</title></head>
            <body>
              <h1>You're Offline</h1>
              <p>TimeStripe Pro needs an internet connection. Your data is safe locally.</p>
              <button onclick="window.location.reload()">Try Again</button>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
        
        return new Response('Resource not available offline', { status: 408 });
      }
    })()
  );
});

// Message handling
self.addEventListener('message', (event) => {
  const { type } = event.data;
  
  if (type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ 
      version: '2.1.0',
      features: ['caching', 'offline', 'time-management', 'cloud-sync']
    });
  }
});

console.log('✅ TimeStripe Pro Service Worker loaded');
