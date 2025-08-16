import { BaseScene, type SceneConfig } from '@/core/scene/Scene';
import { ProgressBar } from '@/components/ui/base/ProgressBar';
import { useGameStore } from '@/utils/gameStore';

export interface LoadingSceneConfig extends SceneConfig {
  assets?: string[];
  minimumLoadTime?: number;
  showProgress?: boolean;
  loadingMessages?: string[];
}

/**
 * Loading Scene Implementation
 * Handles asset loading with progress indication and smooth transitions
 */
export class LoadingScene extends BaseScene {
  private config: LoadingSceneConfig;
  private progressBar: ProgressBar | null = null;
  private progressText: HTMLElement | null = null;
  private loadingMessage: HTMLElement | null = null;
  private loadingSpinner: HTMLElement | null = null;
  private startTime: number = 0;
  private assetsLoaded: number = 0;
  private totalAssets: number = 0;
  private loadingMessages: string[] = [
    'Initializing game engine...',
    'Loading assets...',
    'Preparing graphics...',
    'Setting up audio...',
    'Optimizing for your device...',
    'Almost ready...'
  ];

  constructor(config: LoadingSceneConfig = {}) {
    super('loading');
    this.config = config;
    
    if (config.loadingMessages) {
      this.loadingMessages = config.loadingMessages;
    }
  }

  protected async createUI(): Promise<void> {
    this.uiElement = document.createElement('div');
    this.uiElement.className = 'loading-scene';
    this.uiElement.innerHTML = `
      <div class="loading-container">
        <div class="loading-brand">
          <h1 class="loading-title">Open Runner</h1>
          <p class="loading-subtitle">Modern Endless Runner</p>
        </div>
        
        <div class="loading-spinner-container">
          <div class="loading-spinner"></div>
        </div>
        
        <div class="loading-progress-container">
          <!-- Progress bar will be inserted here -->
        </div>
        
        <div class="loading-message">
          <p class="loading-text">Initializing...</p>
        </div>
        
        <div class="loading-footer">
          <p class="loading-version">v2.0.0</p>
        </div>
      </div>
    `;

    // Get references to elements
    this.loadingSpinner = this.uiElement.querySelector('.loading-spinner');
    this.progressText = this.uiElement.querySelector('.loading-text');
    this.loadingMessage = this.uiElement.querySelector('.loading-message');

    // Create progress bar if enabled
    if (this.config.showProgress !== false) {
      this.createProgressBar();
    }

    // Apply CSS styles
    this.applyStyles();

    if (this.uiContainer) {
      this.uiContainer.appendChild(this.uiElement);
    }
  }

  protected async destroyUI(): Promise<void> {
    if (this.progressBar) {
      this.progressBar.destroy();
      this.progressBar = null;
    }

    if (this.uiElement && this.uiElement.parentElement) {
      this.uiElement.parentElement.removeChild(this.uiElement);
    }
    this.uiElement = null;
  }

  private createProgressBar(): void {
    const container = this.uiElement?.querySelector('.loading-progress-container');
    if (!container) return;

    this.progressBar = new ProgressBar({
      value: 0,
      max: 100,
      showPercentage: true,
      animated: true,
      variant: 'info',
      className: 'loading-progress'
    });

    container.appendChild(this.progressBar.getElement());
  }

  private applyStyles(): void {
    if (!this.uiElement) return;

    // Inject CSS styles for loading scene
    const style = document.createElement('style');
    style.textContent = `
      .loading-scene {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--gradient-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: var(--text-primary);
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        max-width: 400px;
        width: 90%;
        text-align: center;
        gap: var(--space-xl);
      }

      .loading-brand {
        animation: fadeInUp 0.8s ease-out;
      }

      .loading-title {
        font-size: var(--font-4xl);
        font-weight: 700;
        margin-bottom: var(--space-sm);
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .loading-subtitle {
        font-size: var(--font-lg);
        color: var(--text-secondary);
        margin: 0;
      }

      .loading-spinner-container {
        animation: fadeIn 0.6s ease-out 0.2s both;
      }

      .loading-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid var(--bg-tertiary);
        border-top: 3px solid var(--accent-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-progress-container {
        width: 100%;
        animation: fadeIn 0.6s ease-out 0.4s both;
      }

      .loading-progress {
        margin-bottom: var(--space-md);
      }

      .loading-message {
        animation: fadeIn 0.6s ease-out 0.6s both;
        min-height: 24px;
      }

      .loading-text {
        font-size: var(--font-base);
        color: var(--text-secondary);
        margin: 0;
        transition: all var(--transition-base);
      }

      .loading-footer {
        animation: fadeIn 0.6s ease-out 0.8s both;
      }

      .loading-version {
        font-size: var(--font-sm);
        color: var(--text-muted);
        margin: 0;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      /* Mobile optimizations */
      @media (max-width: 640px) {
        .loading-title {
          font-size: var(--font-3xl);
        }
        
        .loading-subtitle {
          font-size: var(--font-base);
        }
        
        .loading-container {
          gap: var(--space-lg);
        }
      }

      /* Reduce motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        .loading-spinner {
          animation: none;
        }
        
        .loading-brand,
        .loading-spinner-container,
        .loading-progress-container,
        .loading-message,
        .loading-footer {
          animation: none;
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private updateLoadingMessage(index: number): void {
    if (!this.progressText || index >= this.loadingMessages.length) return;

    this.progressText.textContent = this.loadingMessages[index];
    
    // Add a subtle animation
    this.progressText.style.opacity = '0';
    setTimeout(() => {
      if (this.progressText) {
        this.progressText.style.opacity = '1';
      }
    }, 100);
  }

  public update(deltaTime: number): void {
    // Update loading progress based on time or asset loading
    const elapsed = Date.now() - this.startTime;
    const minLoadTime = this.config.minimumLoadTime || 2000;
    
    if (this.totalAssets > 0) {
      // Progress based on asset loading
      const assetProgress = (this.assetsLoaded / this.totalAssets) * 100;
      const timeProgress = Math.min((elapsed / minLoadTime) * 100, 100);
      const progress = Math.min(assetProgress, timeProgress);
      
      if (this.progressBar) {
        this.progressBar.setValue(progress);
      }
    } else {
      // Progress based on time only
      const progress = Math.min((elapsed / minLoadTime) * 100, 100);
      
      if (this.progressBar) {
        this.progressBar.setValue(progress);
      }
    }

    // Update loading messages based on progress
    const messageIndex = Math.floor((elapsed / minLoadTime) * this.loadingMessages.length);
    if (messageIndex < this.loadingMessages.length) {
      this.updateLoadingMessage(messageIndex);
    }

    // Check if loading is complete
    if (elapsed >= minLoadTime && this.assetsLoaded >= this.totalAssets) {
      this.completeLoading();
    }
  }

  public render(): void {
    // Rendering is handled by CSS and DOM updates
  }

  /**
   * Start loading process
   */
  public startLoading(assets: string[] = []): void {
    this.startTime = Date.now();
    this.totalAssets = assets.length || this.config.assets?.length || 0;
    this.assetsLoaded = 0;

    if (this.progressBar) {
      this.progressBar.setValue(0);
    }

    // Start loading assets if provided
    if (assets.length > 0 || this.config.assets) {
      this.loadAssets(assets.length > 0 ? assets : this.config.assets!);
    }

    this.updateLoadingMessage(0);
  }

  /**
   * Load assets with progress tracking
   */
  private async loadAssets(assets: string[]): Promise<void> {
    for (let i = 0; i < assets.length; i++) {
      try {
        await this.loadAsset(assets[i]);
        this.assetsLoaded++;
      } catch (error) {
        console.warn(`Failed to load asset: ${assets[i]}`, error);
        this.assetsLoaded++; // Continue loading even if an asset fails
      }
    }
  }

  /**
   * Load individual asset
   */
  private async loadAsset(assetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const extension = assetPath.split('.').pop()?.toLowerCase();
      
      switch (extension) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'webp':
          this.loadImage(assetPath, resolve, reject);
          break;
        case 'mp3':
        case 'wav':
        case 'ogg':
          this.loadAudio(assetPath, resolve, reject);
          break;
        case 'json':
          this.loadJSON(assetPath, resolve, reject);
          break;
        default:
          this.loadGeneric(assetPath, resolve, reject);
          break;
      }
    });
  }

  private loadImage(src: string, resolve: () => void, reject: (error: Error) => void): void {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  }

  private loadAudio(src: string, resolve: () => void, reject: (error: Error) => void): void {
    const audio = new Audio();
    audio.oncanplaythrough = () => resolve();
    audio.onerror = () => reject(new Error(`Failed to load audio: ${src}`));
    audio.src = src;
  }

  private async loadJSON(src: string, resolve: () => void, reject: (error: Error) => void): Promise<void> {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      resolve();
    } catch (error) {
      reject(new Error(`Failed to load JSON: ${src}`));
    }
  }

  private async loadGeneric(src: string, resolve: () => void, reject: (error: Error) => void): Promise<void> {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      resolve();
    } catch (error) {
      reject(new Error(`Failed to load resource: ${src}`));
    }
  }

  /**
   * Complete loading and transition to next scene
   */
  private completeLoading(): void {
    if (this.progressBar) {
      this.progressBar.setValue(100);
    }

    if (this.progressText) {
      this.progressText.textContent = 'Ready!';
    }

    // Transition to title scene after a short delay
    setTimeout(() => {
      useGameStore.getState().setScene('menu');
      this.manager?.transitionTo('title', {
        type: 'fade',
        duration: 500
      });
    }, 500);
  }

  /**
   * Set loading progress manually
   */
  public setProgress(progress: number): void {
    if (this.progressBar) {
      this.progressBar.setValue(progress);
    }
  }

  /**
   * Set loading message manually
   */
  public setMessage(message: string): void {
    if (this.progressText) {
      this.progressText.textContent = message;
    }
  }

  /**
   * Force complete loading
   */
  public forceComplete(): void {
    this.assetsLoaded = this.totalAssets;
    this.startTime = Date.now() - (this.config.minimumLoadTime || 2000);
  }

  public async enter(): Promise<void> {
    await super.enter();
    
    // Start loading automatically
    this.startLoading();
    
    // Emit event for any external listeners
    this.manager?.dispatchEvent(new CustomEvent('loading-started', {
      detail: { scene: this.name }
    }));
  }

  public async exit(): Promise<void> {
    // Emit event for any external listeners
    this.manager?.dispatchEvent(new CustomEvent('loading-completed', {
      detail: { scene: this.name }
    }));
    
    await super.exit();
  }
}