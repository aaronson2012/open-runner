# PWA & Offline Capabilities Design for Open Runner

## 🚀 Progressive Web App Architecture

### Core PWA Implementation Strategy

#### 1. Web App Manifest
**Modern App Installation Experience:**
```json
{
  "name": "Open Runner",
  "short_name": "OpenRunner",
  "description": "Immersive 3D endless runner game - play anywhere, anytime",
  "start_url": "/",
  "scope": "/",
  "display": "fullscreen",
  "orientation": "any",
  "theme_color": "#4CAF50",
  "background_color": "#000000",
  "categories": ["games", "entertainment"],
  "lang": "en",
  "dir": "ltr",
  
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  
  "screenshots": [
    {
      "src": "/screenshots/mobile-gameplay.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Mobile gameplay experience"
    },
    {
      "src": "/screenshots/tablet-landscape.png",
      "sizes": "1024x768",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Tablet landscape mode"
    }
  ],
  
  "share_target": {
    "action": "/share-score",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  },
  
  "shortcuts": [
    {
      "name": "Quick Play",
      "short_name": "Play",
      "description": "Start a new game immediately",
      "url": "/quick-play",
      "icons": [
        {
          "src": "/icons/play-shortcut.png",
          "sizes": "96x96"
        }
      ]
    },
    {
      "name": "High Scores",
      "short_name": "Scores",
      "description": "View your best scores",
      "url": "/scores",
      "icons": [
        {
          "src": "/icons/scores-shortcut.png",
          "sizes": "96x96"
        }
      ]
    }
  ],
  
  "file_handlers": [
    {
      "action": "/save-game",
      "accept": {
        "application/open-runner-save": [".orsave"]
      }
    }
  ],
  
  "protocol_handlers": [
    {
      "protocol": "openrunner",
      "url": "/play?challenge=%s"
    }
  ]
}
```

#### 2. Service Worker Architecture
**Advanced Caching & Offline Strategy:**
```javascript
// service-worker.js
class OpenRunnerServiceWorker {
  constructor() {
    this.CACHE_VERSION = 'v2.1.0';
    this.CACHE_NAMES = {
      static: `or-static-${this.CACHE_VERSION}`,
      dynamic: `or-dynamic-${this.CACHE_VERSION}`,
      runtime: `or-runtime-${this.CACHE_VERSION}`,
      images: `or-images-${this.CACHE_VERSION}`,
      audio: `or-audio-${this.CACHE_VERSION}`,
      models: `or-models-${this.CACHE_VERSION}`
    };
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    self.addEventListener('install', this.handleInstall.bind(this));
    self.addEventListener('activate', this.handleActivate.bind(this));
    self.addEventListener('fetch', this.handleFetch.bind(this));
    self.addEventListener('sync', this.handleBackgroundSync.bind(this));
    self.addEventListener('push', this.handlePushNotification.bind(this));
    self.addEventListener('message', this.handleMessage.bind(this));
  }
  
  async handleInstall(event) {
    console.log('Service Worker installing...');
    
    event.waitUntil(
      this.precacheStaticAssets()
        .then(() => {
          return self.skipWaiting(); // Immediately activate new SW
        })
    );
  }
  
  async precacheStaticAssets() {
    const staticAssets = [
      '/',
      '/index.html',
      '/manifest.json',
      '/css/main.css',
      '/js/main.js',
      '/js/game-core.js',
      '/js/mobile-optimized.js',
      '/icons/icon-192x192.png',
      '/icons/icon-512x512.png',
      '/audio/essential-sounds.webm',
      '/models/player-model-low.gltf',
      '/textures/terrain-base-compressed.webp',
      '/offline.html'
    ];
    
    const cache = await caches.open(this.CACHE_NAMES.static);
    return cache.addAll(staticAssets);
  }
  
  async handleActivate(event) {
    console.log('Service Worker activating...');
    
    event.waitUntil(
      Promise.all([
        this.cleanupOldCaches(),
        this.enableNavigationPreload(),
        self.clients.claim() // Take control of all clients immediately
      ])
    );
  }
  
  async cleanupOldCaches() {
    const cacheNames = await caches.keys();
    const currentCaches = Object.values(this.CACHE_NAMES);
    
    return Promise.all(
      cacheNames.map(cacheName => {
        if (!currentCaches.includes(cacheName)) {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    );
  }
  
  async enableNavigationPreload() {
    if ('navigationPreload' in self.registration) {
      await self.registration.navigationPreload.enable();
    }
  }
  
  async handleFetch(event) {
    const request = event.request;
    const url = new URL(request.url);
    
    // Different strategies for different resource types
    if (this.isStaticAsset(url)) {
      event.respondWith(this.cacheFirstStrategy(request));
    } else if (this.isGameAsset(url)) {
      event.respondWith(this.staleWhileRevalidateStrategy(request));
    } else if (this.isAPIRequest(url)) {
      event.respondWith(this.networkFirstStrategy(request));
    } else if (request.mode === 'navigate') {
      event.respondWith(this.navigationStrategy(request));
    } else {
      event.respondWith(this.runtimeCacheStrategy(request));
    }
  }
  
  // Cache-first strategy for static assets
  async cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Update cache in background if needed
      this.updateCacheInBackground(request);
      return cachedResponse;
    }
    
    return this.fetchAndCache(request, this.CACHE_NAMES.static);
  }
  
  // Stale-while-revalidate for game assets
  async staleWhileRevalidateStrategy(request) {
    const cachedResponse = await caches.match(request);
    const networkPromise = this.fetchAndCache(request, this.CACHE_NAMES.dynamic);
    
    if (cachedResponse) {
      // Return cached version immediately, update in background
      return cachedResponse;
    }
    
    // If not cached, wait for network
    return networkPromise;
  }
  
  // Network-first for API requests
  async networkFirstStrategy(request) {
    try {
      const response = await fetch(request);
      
      // Cache successful API responses briefly
      if (response.ok) {
        const cache = await caches.open(this.CACHE_NAMES.runtime);
        cache.put(request, response.clone());
      }
      
      return response;
    } catch (error) {
      // Fallback to cache for API requests
      const cachedResponse = await caches.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline fallback for critical API endpoints
      return this.getOfflineAPIFallback(request);
    }
  }
  
  // Navigation strategy with offline fallback
  async navigationStrategy(request) {
    try {
      // Try navigation preload first
      const preloadResponse = await event.preloadResponse;
      if (preloadResponse) {
        return preloadResponse;
      }
      
      // Then try network
      const response = await fetch(request);
      
      if (response.ok) {
        // Cache successful page loads
        const cache = await caches.open(this.CACHE_NAMES.dynamic);
        cache.put(request, response.clone());
      }
      
      return response;
    } catch (error) {
      // Fallback to cached page or offline page
      const cachedResponse = await caches.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline game page
      return caches.match('/offline.html');
    }
  }
  
  async fetchAndCache(request, cacheName) {
    try {
      const response = await fetch(request);
      
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      
      return response;
    } catch (error) {
      // Return cached version if network fails
      return caches.match(request);
    }
  }
  
  // Background sync for score uploads and progress saves
  async handleBackgroundSync(event) {
    console.log('Background sync triggered:', event.tag);
    
    switch (event.tag) {
      case 'sync-scores':
        event.waitUntil(this.syncOfflineScores());
        break;
      case 'sync-progress':
        event.waitUntil(this.syncGameProgress());
        break;
      case 'sync-settings':
        event.waitUntil(this.syncUserSettings());
        break;
    }
  }
  
  async syncOfflineScores() {
    try {
      const offlineScores = await this.getStoredOfflineData('scores');
      
      for (const scoreData of offlineScores) {
        await this.uploadScore(scoreData);
      }
      
      // Clear synced scores
      await this.clearStoredOfflineData('scores');
      
      // Notify client of successful sync
      this.notifyClients({ type: 'scores-synced' });
    } catch (error) {
      console.error('Failed to sync scores:', error);
    }
  }
  
  async syncGameProgress() {
    try {
      const progressData = await this.getStoredOfflineData('progress');
      
      if (progressData.length > 0) {
        await this.uploadGameProgress(progressData[progressData.length - 1]);
        await this.clearStoredOfflineData('progress');
        
        this.notifyClients({ type: 'progress-synced' });
      }
    } catch (error) {
      console.error('Failed to sync progress:', error);
    }
  }
  
  // Push notifications for game events
  async handlePushNotification(event) {
    const data = event.data ? event.data.json() : {};
    
    const options = {
      body: data.body || 'New challenge available!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-96x96.png',
      vibrate: [200, 100, 200],
      data: data,
      actions: [
        {
          action: 'play',
          title: 'Play Now',
          icon: '/icons/play-action.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss-action.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Open Runner', options)
    );
  }
  
  // Helper methods
  isStaticAsset(url) {
    return url.pathname.match(/\.(css|js|png|jpg|webp|svg|woff2?)$/);
  }
  
  isGameAsset(url) {
    return url.pathname.match(/\.(gltf|glb|bin|webm|ogg|mp3)$/) ||
           url.pathname.includes('/models/') ||
           url.pathname.includes('/audio/') ||
           url.pathname.includes('/textures/');
  }
  
  isAPIRequest(url) {
    return url.pathname.startsWith('/api/');
  }
  
  async notifyClients(message) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage(message);
    });
  }
}

// Initialize service worker
new OpenRunnerServiceWorker();
```

### 3. Offline Game State Management
**Comprehensive Offline Data Handling:**
```javascript
class OfflineDataManager {
  constructor() {
    this.dbName = 'OpenRunnerOfflineDB';
    this.dbVersion = 3;
    this.db = null;
    this.syncQueue = new Map();
    
    this.initializeDatabase();
    this.setupOnlineDetection();
  }
  
  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Game saves store
        if (!db.objectStoreNames.contains('gameSaves')) {
          const savesStore = db.createObjectStore('gameSaves', {
            keyPath: 'id',
            autoIncrement: true
          });
          savesStore.createIndex('timestamp', 'timestamp');
          savesStore.createIndex('level', 'level');
        }
        
        // Scores store
        if (!db.objectStoreNames.contains('scores')) {
          const scoresStore = db.createObjectStore('scores', {
            keyPath: 'id',
            autoIncrement: true
          });
          scoresStore.createIndex('score', 'score');
          scoresStore.createIndex('level', 'level');
          scoresStore.createIndex('timestamp', 'timestamp');
          scoresStore.createIndex('synced', 'synced');
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', {
            keyPath: 'key'
          });
        }
        
        // Assets cache metadata
        if (!db.objectStoreNames.contains('assetsCache')) {
          const assetsStore = db.createObjectStore('assetsCache', {
            keyPath: 'url'
          });
          assetsStore.createIndex('lastAccessed', 'lastAccessed');
          assetsStore.createIndex('priority', 'priority');
        }
        
        // Offline actions queue
        if (!db.objectStoreNames.contains('offlineActions')) {
          const actionsStore = db.createObjectStore('offlineActions', {
            keyPath: 'id',
            autoIncrement: true
          });
          actionsStore.createIndex('type', 'type');
          actionsStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }
  
  // Save game state for offline play
  async saveGameState(gameState) {
    const saveData = {
      level: gameState.currentLevel,
      score: gameState.score,
      playerPosition: gameState.player.position,
      gameSettings: gameState.settings,
      inventory: gameState.inventory,
      achievements: gameState.achievements,
      timestamp: Date.now(),
      synced: false
    };
    
    const transaction = this.db.transaction(['gameSaves'], 'readwrite');
    const store = transaction.objectStore('gameSaves');
    
    return new Promise((resolve, reject) => {
      const request = store.add(saveData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // Load most recent game state
  async loadGameState() {
    const transaction = this.db.transaction(['gameSaves'], 'readonly');
    const store = transaction.objectStore('gameSaves');
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Most recent first
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          resolve(cursor.value);
        } else {
          resolve(null); // No saves found
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // Store score for later sync
  async storeScore(scoreData) {
    const scoreEntry = {
      ...scoreData,
      timestamp: Date.now(),
      synced: false
    };
    
    const transaction = this.db.transaction(['scores'], 'readwrite');
    const store = transaction.objectStore('scores');
    
    return new Promise((resolve, reject) => {
      const request = store.add(scoreEntry);
      request.onsuccess = () => {
        resolve(request.result);
        
        // Attempt sync if online
        if (navigator.onLine) {
          this.requestBackgroundSync('sync-scores');
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  // Get offline scores for display
  async getOfflineScores(limit = 10) {
    const transaction = this.db.transaction(['scores'], 'readonly');
    const store = transaction.objectStore('scores');
    const index = store.index('score');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // Highest scores first
      const scores = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor && scores.length < limit) {
          scores.push(cursor.value);
          cursor.continue();
        } else {
          resolve(scores);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // Store settings locally
  async storeSetting(key, value) {
    const transaction = this.db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  // Retrieve setting
  async getSetting(key, defaultValue = null) {
    const transaction = this.db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // Queue offline actions for later sync
  async queueOfflineAction(actionType, actionData) {
    const action = {
      type: actionType,
      data: actionData,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3
    };
    
    const transaction = this.db.transaction(['offlineActions'], 'readwrite');
    const store = transaction.objectStore('offlineActions');
    
    return new Promise((resolve, reject) => {
      const request = store.add(action);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // Setup online/offline detection
  setupOnlineDetection() {
    window.addEventListener('online', () => {
      console.log('Connection restored - syncing offline data');
      this.syncOfflineData();
    });
    
    window.addEventListener('offline', () => {
      console.log('Connection lost - enabling offline mode');
      this.enableOfflineMode();
    });
    
    // Check initial connection state
    if (navigator.onLine) {
      this.syncOfflineData();
    } else {
      this.enableOfflineMode();
    }
  }
  
  async syncOfflineData() {
    try {
      // Sync scores
      await this.requestBackgroundSync('sync-scores');
      
      // Sync game progress
      await this.requestBackgroundSync('sync-progress');
      
      // Sync settings
      await this.requestBackgroundSync('sync-settings');
      
      // Process queued actions
      await this.processOfflineActions();
      
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }
  
  async processOfflineActions() {
    const transaction = this.db.transaction(['offlineActions'], 'readwrite');
    const store = transaction.objectStore('offlineActions');
    
    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          const action = cursor.value;
          
          try {
            await this.executeOfflineAction(action);
            cursor.delete(); // Remove successful action
          } catch (error) {
            // Increment retry count
            action.retries++;
            
            if (action.retries >= action.maxRetries) {
              cursor.delete(); // Remove failed action after max retries
            } else {
              cursor.update(action); // Update retry count
            }
          }
          
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async requestBackgroundSync(tag) {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(tag);
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }
  
  enableOfflineMode() {
    // Notify game of offline state
    window.dispatchEvent(new CustomEvent('gameOfflineMode', {
      detail: { offline: true }
    }));
    
    // Reduce background processing
    this.reduceBackgroundActivity();
    
    // Show offline indicator
    this.showOfflineIndicator();
  }
  
  reduceBackgroundActivity() {
    // Pause non-essential features
    // Reduce animation frame rate if on battery
    // Stop unnecessary network requests
    
    window.dispatchEvent(new CustomEvent('reduceActivity', {
      detail: { reason: 'offline' }
    }));
  }
  
  showOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.textContent = 'Playing Offline';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #f44336;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(indicator);
    
    // Remove when back online
    window.addEventListener('online', () => {
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, { once: true });
  }
}
```

### 4. Installation & Update Management
**Smart PWA Installation Flow:**
```javascript
class PWAInstallationManager {
  constructor() {
    this.deferredPrompt = null;
    this.installationState = 'not-installed';
    this.updateAvailable = false;
    
    this.setupInstallationHandlers();
    this.setupUpdateHandlers();
  }
  
  setupInstallationHandlers() {
    // Capture the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.showInstallPrompt();
    });
    
    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.installationState = 'installed';
      this.hideInstallPrompt();
      this.trackInstallation();
    });
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      this.installationState = 'installed';
    }
  }
  
  setupUpdateHandlers() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker has taken control
        this.showUpdateNotification();
      });
      
      // Listen for update messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          this.updateAvailable = true;
          this.showUpdatePrompt();
        }
      });
    }
  }
  
  showInstallPrompt() {
    // Create custom install prompt
    const installBanner = this.createInstallBanner();
    document.body.appendChild(installBanner);
    
    // Track prompt shown
    this.trackEvent('install_prompt_shown');
  }
  
  createInstallBanner() {
    const banner = document.createElement('div');
    banner.id = 'install-prompt';
    banner.innerHTML = `
      <div class="install-prompt-content">
        <div class="install-prompt-icon">🎮</div>
        <div class="install-prompt-text">
          <h3>Install Open Runner</h3>
          <p>Play offline, get faster loading, and enjoy a native app experience!</p>
        </div>
        <div class="install-prompt-actions">
          <button id="install-button" class="install-btn-primary">Install</button>
          <button id="dismiss-install" class="install-btn-secondary">Later</button>
        </div>
      </div>
    `;
    
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      z-index: 10000;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
    `;
    
    // Animate in
    setTimeout(() => {
      banner.style.transform = 'translateY(0)';
    }, 100);
    
    // Add event listeners
    banner.querySelector('#install-button').addEventListener('click', () => {
      this.promptInstall();
    });
    
    banner.querySelector('#dismiss-install').addEventListener('click', () => {
      this.dismissInstallPrompt();
    });
    
    return banner;
  }
  
  async promptInstall() {
    if (!this.deferredPrompt) return;
    
    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for user choice
    const choiceResult = await this.deferredPrompt.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted installation');
      this.trackEvent('install_accepted');
    } else {
      console.log('User dismissed installation');
      this.trackEvent('install_dismissed');
    }
    
    this.deferredPrompt = null;
    this.hideInstallPrompt();
  }
  
  dismissInstallPrompt() {
    this.hideInstallPrompt();
    this.trackEvent('install_prompt_dismissed');
    
    // Don't show again for a while
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  }
  
  hideInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    if (prompt) {
      prompt.style.transform = 'translateY(100%)';
      setTimeout(() => prompt.remove(), 300);
    }
  }
  
  showUpdatePrompt() {
    // Create update notification
    const updateNotification = document.createElement('div');
    updateNotification.id = 'update-notification';
    updateNotification.innerHTML = `
      <div class="update-content">
        <span>🚀 New version available!</span>
        <button id="update-button">Update</button>
        <button id="dismiss-update">×</button>
      </div>
    `;
    
    updateNotification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(updateNotification);
    
    // Add event listeners
    updateNotification.querySelector('#update-button').addEventListener('click', () => {
      this.applyUpdate();
    });
    
    updateNotification.querySelector('#dismiss-update').addEventListener('click', () => {
      updateNotification.remove();
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (updateNotification.parentNode) {
        updateNotification.remove();
      }
    }, 10000);
  }
  
  async applyUpdate() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration && registration.waiting) {
        // Tell the waiting service worker to become active
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Reload the page to use the new service worker
        window.location.reload();
      }
    }
  }
  
  trackInstallation() {
    // Track installation success
    this.trackEvent('pwa_installed', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      platform: navigator.platform
    });
  }
  
  trackEvent(eventName, eventData = {}) {
    // Send analytics event (implement your analytics tracking)
    if (window.gtag) {
      window.gtag('event', eventName, eventData);
    }
    
    // Or use your preferred analytics service
    console.log('Track event:', eventName, eventData);
  }
  
  // Check if update prompt should be shown
  shouldShowInstallPrompt() {
    const lastDismissed = localStorage.getItem('installPromptDismissed');
    
    if (!lastDismissed) return true;
    
    // Show again after 7 days
    const dismissedTime = parseInt(lastDismissed);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    return (now - dismissedTime) > sevenDays;
  }
}

// Initialize PWA features
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstallationManager();
  new OfflineDataManager();
});
```

This comprehensive PWA implementation ensures Open Runner provides a native app-like experience with robust offline capabilities, smart caching strategies, and seamless installation flows across all mobile platforms.