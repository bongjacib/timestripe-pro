// TimeStripe Pro - Enhanced Service Worker
const CACHE_NAME = 'timestripe-pro-v2.0.0';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Enhanced Install Event
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('📦 Opened cache, adding files...');
        
        // Cache essential resources
        await cache.addAll(urlsToCache);
        console.log('✅ All resources cached successfully');
        
        // Skip waiting to activate immediately
        await self.skipWaiting();
        console.log('🚀 Service Worker activated immediately');
        
      } catch (error) {
        console.error('❌ Cache installation failed:', error);
        throw error;
      }
    })()
  );
});

// Enhanced Activate Event
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              await caches.delete(cacheName);
            }
          })
        );
        
        // Claim clients immediately
        await self.clients.claim();
        console.log('✅ Service Worker activated successfully');
        
        // Notify all clients about activation
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: '2.0.0',
            timestamp: new Date().toISOString()
          });
        });
        
      } catch (error) {
        console.error('❌ Service Worker activation failed:', error);
        throw error;
      }
    })()
  );
});

// Enhanced Fetch Event with Network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and external resources
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok) {
          // Cache the successful response
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
      } catch (networkError) {
        console.log('🌐 Network failed, trying cache:', networkError);
        
        // Try cache as fallback
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // For navigation requests, return offline page
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        
        // Return generic offline response
        return new Response('You are offline. Some features may not be available.', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Enhanced Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Implement background data sync here
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        timestamp: new Date().toISOString()
      });
    });
    console.log('✅ Background sync completed');
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Enhanced Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'TimeStripe Pro Notification',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'timestripe-notification',
      renotify: true,
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'TimeStripe Pro', options)
    );
  } catch (error) {
    console.error('❌ Push notification failed:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      try {
        if (event.action === 'open') {
          const clients = await self.clients.matchAll({ 
            type: 'window',
            includeUncontrolled: true 
          });
          
          // Focus existing window or open new one
          for (const client of clients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              await client.focus();
              return;
            }
          }
          
          if (self.clients.openWindow) {
            await self.clients.openWindow('./');
          }
        }
      } catch (error) {
        console.error('❌ Notification click handler failed:', error);
      }
    })()
  );
});

// Enhanced Message Handling
self.addEventListener('message', (event) => {
  if (!event.data) return;

  try {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_VERSION':
        event.ports[0]?.postMessage({ version: '2.0.0' });
        break;
        
      case 'CACHE_URLS':
        event.waitUntil(cacheUrls(event.data.urls));
        break;
    }
  } catch (error) {
    console.error('❌ Message handling failed:', error);
  }
});

async function cacheUrls(urls) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urls);
  } catch (error) {
    console.error('❌ URL caching failed:', error);
  }
}

// Enhanced Error Handling for Service Worker
self.addEventListener('error', (event) => {
  console.error('💥 Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Service Worker unhandled rejection:', event.reason);
});

// Health check endpoint for service worker
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/sw-health')) {
    event.respondWith(new Response(JSON.stringify({
      status: 'healthy',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  }
});
