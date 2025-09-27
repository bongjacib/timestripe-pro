// TimeStripe Pro - Service Worker v2.0.0
const CACHE_NAME = 'timestripe-pro-cascade-v2.0.0';
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
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-900.woff2'
];

// Fallback page for offline mode
const FALLBACK_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TimeStripe Pro - Offline</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8f9fa;
            color: #1a1a1a;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        .offline-container {
            max-width: 400px;
        }
        .offline-icon {
            font-size: 4rem;
            color: #2563eb;
            margin-bottom: 1rem;
        }
        h1 { color: #2563eb; margin-bottom: 1rem; }
        p { margin-bottom: 2rem; line-height: 1.6; }
        button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">⏰</div>
        <h1>You're Offline</h1>
        <p>TimeStripe Pro needs an internet connection to load fully. Some features may be limited.</p>
        <p>Your existing data is safe and you can still view your tasks.</p>
        <button onclick="window.location.reload()">Try Again</button>
    </div>
</body>
</html>
`;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  
  event.waitUntil(
    (async () => {
      try {
        // Open static cache and add all static assets
        const staticCache = await caches.open(STATIC_CACHE);
        console.log('📦 Caching static assets...');
        
        // Cache the main assets
        await staticCache.addAll(STATIC_ASSETS);
        console.log('✅ Static assets cached successfully');
        
        // Skip waiting to activate immediately
        await self.skipWaiting();
        console.log('🚀 Service Worker activated immediately');
        
      } catch (error) {
        console.error('❌ Cache installation failed:', error);
        // Don't fail the installation if caching fails
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
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              await caches.delete(cacheName);
            }
          })
        );
        
        // Claim clients immediately
        await self.clients.claim();
        console.log('✅ Service Worker activated and claiming clients');
        
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
      }
    })()
  );
});

// Fetch event - sophisticated caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  // Skip analytics and external APIs (optional)
  if (event.request.url.includes('google-analytics') || 
      event.request.url.includes('api.')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Try to get from cache first (Cache First strategy for static assets)
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          console.log('📦 Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // If not in cache, try network (Network First strategy for HTML, Fallback for others)
        console.log('🌐 Fetching from network:', event.request.url);
        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok) {
          // Cache successful network responses (except external resources)
          if (event.request.url.startsWith(self.location.origin)) {
            const dynamicCache = await caches.open(DYNAMIC_CACHE);
            dynamicCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
      } catch (networkError) {
        console.log('🌐 Network failed, handling fallback:', networkError);
        
        // For HTML requests, return custom offline page
        if (event.request.destination === 'document' || 
            event.request.headers.get('accept')?.includes('text/html')) {
          return new Response(FALLBACK_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        // For CSS/JS, try to return from cache even if it's stale
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // For images, return a placeholder
        if (event.request.destination === 'image') {
          return new Response(
            '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="18" fill="#666">Image not available offline</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        
        // Generic fallback response
        return new Response('Resource not available offline', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Background Sync for offline data sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-tasks') {
    console.log('🔄 Background sync triggered for tasks');
    event.waitUntil(syncPendingTasks());
  }
});

// Sync pending tasks when back online
async function syncPendingTasks() {
  try {
    // Get pending tasks from IndexedDB or cache
    const pendingTasks = await getPendingTasks();
    
    if (pendingTasks.length > 0) {
      console.log(`🔄 Syncing ${pendingTasks.length} pending tasks`);
      
      // Here you would send tasks to your server
      // For now, we'll just mark them as synced locally
      await markTasksAsSynced(pendingTasks);
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETED',
          count: pendingTasks.length,
          timestamp: new Date().toISOString()
        });
      });
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'TimeStripe Pro Notification',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'timestripe-notification',
      requireInteraction: true,
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: './icon-192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: './icon-192.png'
        }
      ],
      data: {
        url: data.url || './',
        timestamp: new Date().toISOString()
      }
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || 'TimeStripe Pro', 
        options
      )
    );
  } catch (error) {
    console.error('❌ Push notification failed:', error);
    
    // Fallback simple notification
    event.waitUntil(
      self.registration.showNotification('TimeStripe Pro', {
        body: 'You have a new notification',
        icon: './icon-192.png'
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      try {
        if (event.action === 'open' || !event.action) {
          // Open the app
          const clients = await self.clients.matchAll({ 
            type: 'window',
            includeUncontrolled: true 
          });
          
          // Focus existing window or open new one
          for (const client of clients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              await client.focus();
              return client.navigate(event.notification.data.url || './');
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

// Message handling between SW and clients
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'GET_VERSION':
        event.ports[0]?.postMessage({ 
          version: '2.0.0',
          features: ['caching', 'offline', 'sync', 'notifications']
        });
        break;
        
      case 'CACHE_URLS':
        event.waitUntil(cacheAdditionalUrls(payload.urls));
        break;
        
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'CLEAR_CACHE':
        event.waitUntil(clearSpecificCache(payload.cacheName));
        break;
    }
  } catch (error) {
    console.error('❌ Message handling failed:', error);
    event.ports[0]?.postMessage({ error: error.message });
  }
});

// Cache additional URLs dynamically
async function cacheAdditionalUrls(urls) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.addAll(urls);
    console.log(`✅ Cached ${urls.length} additional URLs`);
  } catch (error) {
    console.error('❌ Failed to cache additional URLs:', error);
  }
}

// Clear specific cache
async function clearSpecificCache(cacheName) {
  try {
    await caches.delete(cacheName);
    console.log(`✅ Cleared cache: ${cacheName}`);
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
}

// Health check endpoint
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/sw-health')) {
    event.respondWith(
      new Response(JSON.stringify({
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        features: {
          caching: true,
          offline: true,
          backgroundSync: true,
          pushNotifications: true
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
});

// Helper functions (placeholder implementations)
async function getPendingTasks() {
  // In a real app, this would read from IndexedDB
  return [];
}

async function markTasksAsSynced(tasks) {
  // In a real app, this would update IndexedDB
  return Promise.resolve();
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('💥 Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Service Worker unhandled rejection:', event.reason);
});

// Periodic sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-update') {
      console.log('🔄 Periodic sync triggered');
      event.waitUntil(updateCachedContent());
    }
  });
}

async function updateCachedContent() {
  try {
    // Update cached content periodically
    const cache = await caches.open(STATIC_CACHE);
    const requests = STATIC_ASSETS.map(url => new Request(url));
    
    await Promise.all(
      requests.map(async (request) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            await cache.put(request, networkResponse);
          }
        } catch (error) {
          console.warn('Failed to update:', request.url);
        }
      })
    );
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

console.log('✅ TimeStripe Pro Service Worker loaded successfully');
