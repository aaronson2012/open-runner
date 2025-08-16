/**
 * Progressive Web App Service Worker Manager
 * Handles offline capabilities, caching, and app updates
 */

export interface ServiceWorkerConfig {
  swPath?: string;
  scope?: string;
  updateCheckInterval?: number;
  enableNotifications?: boolean;
  enableBackgroundSync?: boolean;
  cacheStrategy?: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate';
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager | null = null;
  private config: ServiceWorkerConfig;
  private registration: ServiceWorkerRegistration | null = null;
  private updateCheckTimer: number | null = null;
  private isOnline: boolean = navigator.onLine;

  private constructor(config: ServiceWorkerConfig = {}) {
    this.config = {
      swPath: '/sw.js',
      scope: '/',
      updateCheckInterval: 60000, // 1 minute
      enableNotifications: true,
      enableBackgroundSync: true,
      cacheStrategy: 'staleWhileRevalidate',
      ...config
    };

    this.initialize();
  }

  static getInstance(config?: ServiceWorkerConfig): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager(config);
    }
    return ServiceWorkerManager.instance;
  }

  private async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return;
    }

    try {
      await this.registerServiceWorker();
      this.setupEventListeners();
      this.startUpdateChecks();
    } catch (error) {
      console.error('Failed to initialize Service Worker:', error);
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      this.registration = await navigator.serviceWorker.register(
        this.config.swPath!,
        { scope: this.config.scope }
      );

      console.log('Service Worker registered:', this.registration);

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdateFound();
      });

      // Check for existing updates
      if (this.registration.waiting) {
        this.handleUpdateReady();
      }

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      if (this.config.onOnline) {
        this.config.onOnline();
      }
      this.notifyOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      if (this.config.onOffline) {
        this.config.onOffline();
      }
      this.notifyOnlineStatus(false);
    });

    // Service Worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });

    // Visibility change for update checks
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.registration) {
        this.checkForUpdates();
      }
    });
  }

  private handleUpdateFound(): void {
    if (!this.registration) return;

    const newWorker = this.registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        this.handleUpdateReady();
      }
    });
  }

  private handleUpdateReady(): void {
    console.log('New app version available');
    
    if (this.config.onUpdate && this.registration) {
      this.config.onUpdate(this.registration);
    } else {
      // Default update handling
      this.showUpdateNotification();
    }
  }

  private showUpdateNotification(): void {
    if (!this.config.enableNotifications) return;

    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'sw-update-notification';
    notification.innerHTML = `
      <div class="sw-notification-content">
        <div class="sw-notification-icon">🔄</div>
        <div class="sw-notification-text">
          <strong>Update Available</strong>
          <p>A new version of Open Runner is ready to install.</p>
        </div>
        <div class="sw-notification-actions">
          <button class="sw-btn sw-btn-primary" id="sw-update-btn">Update Now</button>
          <button class="sw-btn sw-btn-secondary" id="sw-dismiss-btn">Later</button>
        </div>
      </div>
    `;

    // Apply styles
    this.applyNotificationStyles(notification);

    // Add event listeners
    const updateBtn = notification.querySelector('#sw-update-btn');
    const dismissBtn = notification.querySelector('#sw-dismiss-btn');

    updateBtn?.addEventListener('click', () => {
      this.applyUpdate();
      document.body.removeChild(notification);
    });

    dismissBtn?.addEventListener('click', () => {
      document.body.removeChild(notification);
    });

    document.body.appendChild(notification);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    }, 10000);
  }

  private applyNotificationStyles(notification: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      .sw-update-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 350px;
        background: var(--bg-primary, #1a1a1a);
        border: 1px solid var(--border-primary, #333);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(8px);
        animation: swSlideIn 0.3s ease-out;
      }

      .sw-notification-content {
        padding: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .sw-notification-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .sw-notification-text {
        flex: 1;
        color: var(--text-primary, #fff);
      }

      .sw-notification-text strong {
        display: block;
        margin-bottom: 4px;
        font-size: 16px;
      }

      .sw-notification-text p {
        margin: 0;
        font-size: 14px;
        color: var(--text-secondary, #ccc);
        line-height: 1.4;
      }

      .sw-notification-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .sw-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .sw-btn-primary {
        background: var(--accent-primary, #007bff);
        color: white;
      }

      .sw-btn-primary:hover {
        background: var(--accent-secondary, #0056b3);
      }

      .sw-btn-secondary {
        background: transparent;
        color: var(--text-secondary, #ccc);
        border: 1px solid var(--border-primary, #333);
      }

      .sw-btn-secondary:hover {
        background: var(--bg-secondary, #2a2a2a);
      }

      @keyframes swSlideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @media (max-width: 640px) {
        .sw-update-notification {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'CACHE_UPDATED':
        console.log('Cache updated:', payload);
        break;
      case 'BACKGROUND_SYNC':
        console.log('Background sync:', payload);
        break;
      case 'PUSH_NOTIFICATION':
        this.handlePushNotification(payload);
        break;
    }
  }

  private handlePushNotification(payload: any): void {
    if (!this.config.enableNotifications) return;

    // Handle push notifications
    console.log('Push notification received:', payload);
  }

  private startUpdateChecks(): void {
    if (!this.config.updateCheckInterval) return;

    this.updateCheckTimer = window.setInterval(() => {
      this.checkForUpdates();
    }, this.config.updateCheckInterval);
  }

  private async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  private notifyOnlineStatus(isOnline: boolean): void {
    // Dispatch custom event for online/offline status
    window.dispatchEvent(new CustomEvent('sw-network-status', {
      detail: { isOnline }
    }));
  }

  /**
   * Apply pending update
   */
  public async applyUpdate(): Promise<void> {
    if (!this.registration || !this.registration.waiting) return;

    // Tell the waiting SW to skip waiting and become active
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page to load the new version
    window.location.reload();
  }

  /**
   * Check if app is offline
   */
  public isAppOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get registration info
   */
  public getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Manually check for updates
   */
  public async manualUpdateCheck(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const registration = await this.registration.update();
      return !!registration.waiting;
    } catch (error) {
      console.error('Manual update check failed:', error);
      return false;
    }
  }

  /**
   * Enable/disable notifications
   */
  public setNotificationsEnabled(enabled: boolean): void {
    this.config.enableNotifications = enabled;
  }

  /**
   * Cache specific resources
   */
  public async cacheResources(resources: string[]): Promise<void> {
    if (!this.registration || !this.registration.active) return;

    this.registration.active.postMessage({
      type: 'CACHE_RESOURCES',
      payload: { resources }
    });
  }

  /**
   * Clear all caches
   */
  public async clearCaches(): Promise<void> {
    if (!this.registration || !this.registration.active) return;

    this.registration.active.postMessage({
      type: 'CLEAR_CACHES'
    });
  }

  /**
   * Get cache size
   */
  public async getCacheSize(): Promise<number> {
    if (!this.registration || !this.registration.active) return 0;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data.size || 0);
      };

      this.registration!.active!.postMessage({
        type: 'GET_CACHE_SIZE'
      }, [channel.port2]);
    });
  }

  /**
   * Destroy service worker manager
   */
  public destroy(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
    }

    // Remove event listeners
    window.removeEventListener('online', this.notifyOnlineStatus);
    window.removeEventListener('offline', this.notifyOnlineStatus);

    ServiceWorkerManager.instance = null;
  }
}

/**
 * Offline Status Manager
 * Provides offline status and queue management
 */
export class OfflineManager {
  private static instance: OfflineManager | null = null;
  private actionQueue: Array<{ action: string; data: any; timestamp: number }> = [];
  private isOnline: boolean = navigator.onLine;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Queue action for when online
   */
  public queueAction(action: string, data: any): void {
    this.actionQueue.push({
      action,
      data,
      timestamp: Date.now()
    });

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  /**
   * Process queued actions
   */
  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.actionQueue.length === 0) return;

    const actionsToProcess = [...this.actionQueue];
    this.actionQueue = [];

    for (const queuedAction of actionsToProcess) {
      try {
        await this.processAction(queuedAction);
      } catch (error) {
        console.error('Failed to process queued action:', error);
        // Re-queue failed actions
        this.actionQueue.push(queuedAction);
      }
    }
  }

  private async processAction(queuedAction: { action: string; data: any; timestamp: number }): Promise<void> {
    switch (queuedAction.action) {
      case 'saveScore':
        await this.saveScoreOnline(queuedAction.data);
        break;
      case 'saveSettings':
        await this.saveSettingsOnline(queuedAction.data);
        break;
      case 'sendAnalytics':
        await this.sendAnalyticsOnline(queuedAction.data);
        break;
      default:
        console.warn('Unknown queued action:', queuedAction.action);
    }
  }

  private async saveScoreOnline(data: any): Promise<void> {
    // Implementation would save score to server
    console.log('Saving score online:', data);
  }

  private async saveSettingsOnline(data: any): Promise<void> {
    // Implementation would save settings to server
    console.log('Saving settings online:', data);
  }

  private async sendAnalyticsOnline(data: any): Promise<void> {
    // Implementation would send analytics to server
    console.log('Sending analytics online:', data);
  }

  /**
   * Check if online
   */
  public isAppOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get queue length
   */
  public getQueueLength(): number {
    return this.actionQueue.length;
  }

  /**
   * Clear queue
   */
  public clearQueue(): void {
    this.actionQueue = [];
  }
}

/**
 * PWA Installation Manager
 * Handles app installation prompts and status
 */
export class InstallManager {
  private static instance: InstallManager | null = null;
  private deferredPrompt: any = null;
  private isInstalled: boolean = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): InstallManager {
    if (!InstallManager.instance) {
      InstallManager.instance = new InstallManager();
    }
    return InstallManager.instance;
  }

  private initialize(): void {
    // Check if already installed
    this.checkInstallStatus();

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallOption();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      console.log('PWA was installed');
    });
  }

  private checkInstallStatus(): void {
    // Check if running as PWA
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
  }

  private showInstallOption(): void {
    // Create install prompt
    const installPrompt = document.createElement('div');
    installPrompt.className = 'pwa-install-prompt';
    installPrompt.innerHTML = `
      <div class="install-prompt-content">
        <div class="install-prompt-icon">📱</div>
        <div class="install-prompt-text">
          <strong>Install Open Runner</strong>
          <p>Add to your home screen for the best experience!</p>
        </div>
        <div class="install-prompt-actions">
          <button class="install-btn install-btn-primary" id="install-accept">Install</button>
          <button class="install-btn install-btn-secondary" id="install-dismiss">Not Now</button>
        </div>
      </div>
    `;

    // Apply styles
    this.applyInstallPromptStyles(installPrompt);

    // Add event listeners
    const acceptBtn = installPrompt.querySelector('#install-accept');
    const dismissBtn = installPrompt.querySelector('#install-dismiss');

    acceptBtn?.addEventListener('click', () => {
      this.triggerInstall();
      document.body.removeChild(installPrompt);
    });

    dismissBtn?.addEventListener('click', () => {
      document.body.removeChild(installPrompt);
    });

    document.body.appendChild(installPrompt);
  }

  private applyInstallPromptStyles(prompt: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      .pwa-install-prompt {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        z-index: 10000;
        background: var(--bg-primary, #1a1a1a);
        border: 1px solid var(--border-primary, #333);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(8px);
        animation: installSlideUp 0.3s ease-out;
      }

      .install-prompt-content {
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .install-prompt-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .install-prompt-text {
        flex: 1;
        color: var(--text-primary, #fff);
      }

      .install-prompt-text strong {
        display: block;
        margin-bottom: 4px;
        font-size: 16px;
      }

      .install-prompt-text p {
        margin: 0;
        font-size: 14px;
        color: var(--text-secondary, #ccc);
      }

      .install-prompt-actions {
        display: flex;
        gap: 8px;
        flex-direction: column;
      }

      .install-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .install-btn-primary {
        background: var(--accent-primary, #007bff);
        color: white;
      }

      .install-btn-primary:hover {
        background: var(--accent-secondary, #0056b3);
      }

      .install-btn-secondary {
        background: transparent;
        color: var(--text-secondary, #ccc);
        border: 1px solid var(--border-primary, #333);
      }

      .install-btn-secondary:hover {
        background: var(--bg-secondary, #2a2a2a);
      }

      @keyframes installSlideUp {
        from {
          opacity: 0;
          transform: translateY(100%);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (min-width: 640px) {
        .pwa-install-prompt {
          max-width: 400px;
          left: auto;
          right: 20px;
        }

        .install-prompt-actions {
          flex-direction: row;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Trigger install prompt
   */
  public async triggerInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  /**
   * Check if app can be installed
   */
  public canInstall(): boolean {
    return !!this.deferredPrompt;
  }

  /**
   * Check if app is installed
   */
  public isAppInstalled(): boolean {
    return this.isInstalled;
  }
}