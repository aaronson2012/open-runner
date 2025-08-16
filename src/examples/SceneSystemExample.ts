/**
 * Scene System Integration Example
 * Demonstrates complete setup and usage of the modern scene and UI system
 */

import { setupGameScenesWithPreset, getDevicePreset } from '@/core/scene';
import { ServiceWorkerManager, InstallManager, OfflineManager } from '@/core/pwa/ServiceWorkerManager';
import { themeManager, ResponsiveUtils } from '@/components/ui';
import { useGameStore } from '@/utils/gameStore';

/**
 * Complete Scene System Setup Example
 * Shows how to initialize and use the full scene and UI system
 */
export class SceneSystemExample {
  private sceneManager: any;
  private serviceWorkerManager: ServiceWorkerManager;
  private installManager: InstallManager;
  private offlineManager: OfflineManager;
  private canvas: HTMLCanvasElement;
  private uiContainer: HTMLDivElement;

  constructor() {
    this.setupDOM();
    this.initialize();
  }

  private setupDOM(): void {
    // Create game canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'game-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '1';

    // Create UI container
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'ui-container';
    this.uiContainer.style.position = 'absolute';
    this.uiContainer.style.top = '0';
    this.uiContainer.style.left = '0';
    this.uiContainer.style.width = '100%';
    this.uiContainer.style.height = '100%';
    this.uiContainer.style.zIndex = '2';
    this.uiContainer.style.pointerEvents = 'none';

    // Allow pointer events on UI children
    this.uiContainer.style.setProperty('--ui-pointer-events', 'auto');

    // Add to document
    const gameContainer = document.getElementById('root') || document.body;
    gameContainer.appendChild(this.canvas);
    gameContainer.appendChild(this.uiContainer);
  }

  private async initialize(): Promise<void> {
    console.log('🎮 Initializing Open Runner Scene System...');

    try {
      // 1. Initialize PWA features
      await this.initializePWA();

      // 2. Setup theme system
      this.initializeTheme();

      // 3. Setup responsive handling
      this.initializeResponsive();

      // 4. Initialize scene system
      this.initializeScenes();

      // 5. Setup event handlers
      this.setupEventHandlers();

      // 6. Start the game
      await this.startGame();

      console.log('✅ Scene System initialized successfully!');

    } catch (error) {
      console.error('❌ Failed to initialize Scene System:', error);
      this.handleInitializationError(error);
    }
  }

  private async initializePWA(): Promise<void> {
    console.log('📱 Setting up PWA features...');

    // Initialize Service Worker
    this.serviceWorkerManager = ServiceWorkerManager.getInstance({
      enableNotifications: true,
      enableBackgroundSync: true,
      cacheStrategy: 'staleWhileRevalidate',
      onUpdate: (registration) => {
        console.log('🔄 App update available');
        this.showUpdateNotification();
      },
      onOffline: () => {
        console.log('📴 App went offline');
        this.showOfflineIndicator();
      },
      onOnline: () => {
        console.log('🌐 App back online');
        this.hideOfflineIndicator();
      }
    });

    // Initialize Install Manager
    this.installManager = InstallManager.getInstance();

    // Initialize Offline Manager
    this.offlineManager = OfflineManager.getInstance();

    console.log('✅ PWA features initialized');
  }

  private initializeTheme(): void {
    console.log('🎨 Setting up theme system...');

    // Load user preferences or detect system preference
    const savedTheme = localStorage.getItem('open-runner-theme-mode');
    if (savedTheme) {
      themeManager.setThemeMode(savedTheme as any);
    } else {
      themeManager.setThemeMode('auto');
    }

    // Setup theme toggle functionality
    this.setupThemeToggle();

    console.log('✅ Theme system initialized');
  }

  private initializeResponsive(): void {
    console.log('📱 Setting up responsive design...');

    // Watch for breakpoint changes
    ResponsiveUtils.watchBreakpoint('md', (matches) => {
      document.body.setAttribute('data-screen-size', matches ? 'desktop' : 'mobile');
    });

    // Setup orientation handling
    this.setupOrientationHandling();

    // Initial responsive setup
    this.updateResponsiveLayout();

    console.log('✅ Responsive design initialized');
  }

  private initializeScenes(): void {
    console.log('🎬 Setting up scene system...');

    // Get device-appropriate preset
    const preset = getDevicePreset();
    console.log(`📋 Using preset: ${preset}`);

    // Setup scene manager with preset
    this.sceneManager = setupGameScenesWithPreset(
      this.canvas,
      this.uiContainer,
      preset
    );

    // Setup scene event listeners
    this.setupSceneEventListeners();

    console.log('✅ Scene system initialized');
  }

  private setupEventHandlers(): void {
    console.log('⚡ Setting up global event handlers...');

    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this));

    // Visibility change for performance
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Network status
    window.addEventListener('sw-network-status', this.handleNetworkStatusChange.bind(this));

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

    // Performance monitoring
    this.setupPerformanceMonitoring();

    console.log('✅ Event handlers setup complete');
  }

  private setupSceneEventListeners(): void {
    // Scene transition events
    this.sceneManager.addEventListener('transition-start', (event: CustomEvent) => {
      console.log(`🎬 Scene transition: ${event.detail.from} → ${event.detail.to}`);
    });

    this.sceneManager.addEventListener('transition-complete', (event: CustomEvent) => {
      console.log(`✅ Scene transition complete: ${event.detail.to}`);
    });

    this.sceneManager.addEventListener('transition-error', (event: CustomEvent) => {
      console.error(`❌ Scene transition error:`, event.detail.error);
    });

    // Game events
    this.sceneManager.addEventListener('game-input', this.handleGameInput.bind(this));
    this.sceneManager.addEventListener('game-pause', this.handleGamePause.bind(this));
    this.sceneManager.addEventListener('game-resume', this.handleGameResume.bind(this));
    this.sceneManager.addEventListener('game-over', this.handleGameOver.bind(this));
    this.sceneManager.addEventListener('game-restart', this.handleGameRestart.bind(this));
  }

  private async startGame(): Promise<void> {
    console.log('🚀 Starting Open Runner...');

    // Start with loading scene
    await this.sceneManager.transitionTo('loading', {
      type: 'fade',
      duration: 500
    });

    // The loading scene will automatically transition to title when complete
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update canvas size
    this.canvas.width = width * window.devicePixelRatio;
    this.canvas.height = height * window.devicePixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Notify scene manager
    this.sceneManager?.handleResize(width, height);

    // Update responsive layout
    this.updateResponsiveLayout();
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Pause game and save state
      console.log('⏸️ App hidden, pausing game...');
      this.pauseGame();
    } else {
      // Resume game
      console.log('▶️ App visible, resuming game...');
      this.resumeGame();
    }
  }

  private handleNetworkStatusChange(event: CustomEvent): void {
    const { isOnline } = event.detail;
    
    if (isOnline) {
      console.log('🌐 Network restored');
      this.hideOfflineIndicator();
    } else {
      console.log('📴 Network lost');
      this.showOfflineIndicator();
    }
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Handle global keyboard shortcuts
    switch (event.code) {
      case 'KeyP':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.togglePause();
        }
        break;
      case 'KeyR':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.restartGame();
        }
        break;
      case 'KeyT':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.toggleTheme();
        }
        break;
      case 'KeyD':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.toggleDebugMode();
        }
        break;
    }
  }

  private handleGameInput(event: CustomEvent): void {
    const { input } = event.detail;
    
    // Process input for game logic
    // This would integrate with your game engine
    console.log('🕹️ Game input received:', {
      steering: input.steering,
      jump: input.jump,
      slide: input.slide
    });
  }

  private handleGamePause(event: CustomEvent): void {
    console.log('⏸️ Game paused');
    // Save game state
    this.saveGameState();
  }

  private handleGameResume(event: CustomEvent): void {
    console.log('▶️ Game resumed');
    // Continue game logic
  }

  private handleGameOver(event: CustomEvent): void {
    console.log('🎮 Game over');
    
    // Save final score
    const gameState = useGameStore.getState();
    this.offlineManager.queueAction('saveScore', {
      score: gameState.score,
      level: gameState.level,
      timestamp: Date.now()
    });

    // Transition to game over scene
    this.sceneManager.transitionTo('gameover', {
      type: 'fade',
      duration: 800
    });
  }

  private handleGameRestart(event: CustomEvent): void {
    console.log('🔄 Game restarting');
    
    // Reset game state
    useGameStore.getState().resetGame();
    
    // Transition to gameplay scene
    this.sceneManager.transitionTo('gameplay', {
      type: 'fade',
      duration: 500
    });
  }

  private setupThemeToggle(): void {
    // Add theme toggle button (if not exists)
    if (!document.getElementById('theme-toggle')) {
      const themeToggle = document.createElement('button');
      themeToggle.id = 'theme-toggle';
      themeToggle.innerHTML = '🌓';
      themeToggle.style.position = 'fixed';
      themeToggle.style.top = '20px';
      themeToggle.style.left = '20px';
      themeToggle.style.zIndex = '9999';
      themeToggle.style.background = 'var(--bg-primary)';
      themeToggle.style.border = '1px solid var(--border-primary)';
      themeToggle.style.borderRadius = '8px';
      themeToggle.style.padding = '8px';
      themeToggle.style.cursor = 'pointer';
      themeToggle.title = 'Toggle theme (Ctrl+T)';
      
      themeToggle.addEventListener('click', () => this.toggleTheme());
      document.body.appendChild(themeToggle);
    }
  }

  private setupOrientationHandling(): void {
    const handleOrientationChange = () => {
      // Wait for orientation change to complete
      setTimeout(() => {
        this.handleResize();
        
        // Show orientation prompt for mobile
        if (ResponsiveUtils.isMobile()) {
          this.checkOptimalOrientation();
        }
      }, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    screen.orientation?.addEventListener('change', handleOrientationChange);
  }

  private setupPerformanceMonitoring(): void {
    // Monitor FPS and performance
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;

    const measurePerformance = (currentTime: number) => {
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
        
        // Update performance metrics
        const performanceMetrics = {
          fps,
          frameTime: 1000 / fps,
          drawCalls: 0, // Would be provided by renderer
          triangles: 0, // Would be provided by renderer
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          gpuMemory: 0, // Would be provided by WebGL context
          renderTime: 16.67, // Would be measured
          culledObjects: 0, // Would be provided by culling system
          activeLODs: 0 // Would be provided by LOD system
        };
        
        useGameStore.getState().updatePerformanceMetrics?.(performanceMetrics);
      }
      
      requestAnimationFrame(measurePerformance);
    };
    
    requestAnimationFrame(measurePerformance);
  }

  private updateResponsiveLayout(): void {
    const isMobile = ResponsiveUtils.isMobile();
    const currentBreakpoint = ResponsiveUtils.getCurrentBreakpoint();
    
    document.body.setAttribute('data-device', isMobile ? 'mobile' : 'desktop');
    document.body.setAttribute('data-breakpoint', currentBreakpoint);
  }

  private checkOptimalOrientation(): void {
    if (!ResponsiveUtils.isMobile()) return;
    
    const isLandscape = window.innerWidth > window.innerHeight;
    
    if (!isLandscape) {
      this.showOrientationPrompt();
    } else {
      this.hideOrientationPrompt();
    }
  }

  private showOrientationPrompt(): void {
    if (document.getElementById('orientation-prompt')) return;
    
    const prompt = document.createElement('div');
    prompt.id = 'orientation-prompt';
    prompt.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        z-index: 10000;
        backdrop-filter: blur(8px);
      ">
        <div style="font-size: 24px; margin-bottom: 8px;">📱 ↻</div>
        <div style="font-weight: 600; margin-bottom: 4px;">For the best experience</div>
        <div style="font-size: 14px; color: var(--text-secondary);">Please rotate your device to landscape</div>
      </div>
    `;
    
    document.body.appendChild(prompt);
  }

  private hideOrientationPrompt(): void {
    const prompt = document.getElementById('orientation-prompt');
    if (prompt) {
      document.body.removeChild(prompt);
    }
  }

  private showUpdateNotification(): void {
    // Already handled by ServiceWorkerManager
  }

  private showOfflineIndicator(): void {
    if (document.getElementById('offline-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--warning);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        animation: slideInDown 0.3s ease-out;
      ">
        📴 You're offline
      </div>
    `;
    
    document.body.appendChild(indicator);
  }

  private hideOfflineIndicator(): void {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.style.animation = 'slideOutUp 0.3s ease-out';
      setTimeout(() => {
        if (indicator.parentElement) {
          document.body.removeChild(indicator);
        }
      }, 300);
    }
  }

  private handleInitializationError(error: any): void {
    console.error('Initialization failed:', error);
    
    // Show error message to user
    const errorElement = document.createElement('div');
    errorElement.innerHTML = `
      <div style="
        position: fixed;
        inset: 0;
        background: var(--bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        text-align: center;
        z-index: 10001;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">😵</div>
        <h2 style="margin-bottom: 16px;">Something went wrong</h2>
        <p style="margin-bottom: 24px; color: var(--text-secondary);">
          Failed to initialize the game. Please refresh the page and try again.
        </p>
        <button onclick="window.location.reload()" style="
          background: var(--accent-primary);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        ">
          Refresh Page
        </button>
      </div>
    `;
    
    document.body.appendChild(errorElement);
  }

  // Public API methods
  public toggleTheme(): void {
    themeManager.toggleTheme();
  }

  public togglePause(): void {
    const gameplayScene = this.sceneManager?.getScene('gameplay');
    if (gameplayScene?.isActive) {
      if (useGameStore.getState().isPaused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
    }
  }

  public pauseGame(): void {
    useGameStore.getState().setPaused(true);
  }

  public resumeGame(): void {
    useGameStore.getState().setPaused(false);
  }

  public restartGame(): void {
    useGameStore.getState().resetGame();
    this.sceneManager?.transitionTo('gameplay', { type: 'fade' });
  }

  public toggleDebugMode(): void {
    const gameplayScene = this.sceneManager?.getScene('gameplay');
    if (gameplayScene) {
      const touchController = gameplayScene.getInputController?.();
      touchController?.toggleDebugZones();
    }
  }

  public saveGameState(): void {
    const gameState = useGameStore.getState();
    
    this.offlineManager.queueAction('saveSettings', {
      settings: gameState.settings,
      timestamp: Date.now()
    });
  }

  public getSceneManager() {
    return this.sceneManager;
  }

  public getPWAManagers() {
    return {
      serviceWorker: this.serviceWorkerManager,
      install: this.installManager,
      offline: this.offlineManager
    };
  }
}

// Export for easy initialization
export function initializeOpenRunner(): SceneSystemExample {
  return new SceneSystemExample();
}

// Auto-initialize if this is the main entry point
if (typeof window !== 'undefined' && !window.openRunnerInitialized) {
  window.openRunnerInitialized = true;
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeOpenRunner();
    });
  } else {
    initializeOpenRunner();
  }
}