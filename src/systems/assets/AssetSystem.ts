// Main Asset System Integration - Complete Asset Management for Open Runner
import { AssetLoader } from './AssetLoader';
import { AudioSystem } from './AudioSystem';
import { VisualAssetGenerator } from './VisualAssetGenerator';
import { StreamingLoader } from './StreamingLoader';
import { MobileOptimizer } from './MobileOptimizer';
import { AssetManifestBuilder } from './AssetManifest';
import { MemoryManager } from './MemoryManager';
import {
  AssetConfig,
  AssetManifest,
  LoadedAsset,
  LoadingProgress,
  DeviceCapabilities,
  AssetType,
  AssetCollection,
  AssetLoaderConfig
} from '../../types/assets/AssetTypes';

export class AssetSystem {
  private assetLoader: AssetLoader;
  private audioSystem: AudioSystem;
  private visualGenerator: VisualAssetGenerator;
  private streamingLoader: StreamingLoader;
  private mobileOptimizer: MobileOptimizer;
  private memoryManager: MemoryManager;
  private manifest: AssetManifest;
  private deviceCapabilities: DeviceCapabilities;
  
  private loadedCollections = new Set<string>();
  private loadingCollections = new Map<string, Promise<void>>();
  private generatedAssets = new Map<string, LoadedAsset>();
  
  private onProgressCallbacks: ((progress: LoadingProgress) => void)[] = [];
  private onCollectionLoadedCallbacks: ((collectionId: string) => void)[] = [];
  private onAssetLoadedCallbacks: ((asset: LoadedAsset) => void)[] = [];

  constructor(config?: Partial<AssetLoaderConfig>) {
    // Initialize device capabilities first
    this.deviceCapabilities = this.detectDeviceCapabilities();
    
    // Initialize mobile optimizer
    this.mobileOptimizer = new MobileOptimizer(this.deviceCapabilities);
    
    // Optimize config based on device
    const optimizedConfig = this.mobileOptimizer.optimizeLoaderConfig(
      config || this.getDefaultConfig()
    );
    
    // Initialize core systems
    this.assetLoader = new AssetLoader(optimizedConfig);
    this.audioSystem = new AudioSystem(this.deviceCapabilities);
    this.visualGenerator = new VisualAssetGenerator();
    this.streamingLoader = new StreamingLoader(this.assetLoader, this.deviceCapabilities);
    this.memoryManager = new MemoryManager(optimizedConfig.memoryLimit);
    
    // Build asset manifest
    const manifestBuilder = new AssetManifestBuilder();
    if (this.deviceCapabilities.isMobile) {
      manifestBuilder.optimizeForMobile();
    } else {
      manifestBuilder.optimizeForDesktop();
    }
    this.manifest = manifestBuilder.buildOpenRunnerManifest();
    
    // Set up event forwarding
    this.setupEventForwarding();
    
    // Generate placeholder assets
    this.generatePlaceholderAssets();
  }

  private detectDeviceCapabilities(): DeviceCapabilities {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    return {
      webgl2: !!document.createElement('canvas').getContext('webgl2'),
      astcSupport: !!gl?.getExtension('WEBGL_compressed_texture_astc'),
      etc2Support: !!gl?.getExtension('WEBGL_compressed_texture_etc'),
      s3tcSupport: !!gl?.getExtension('WEBGL_compressed_texture_s3tc'),
      webAudioAPI: !!(window.AudioContext || (window as any).webkitAudioContext),
      maxTextureSize: gl?.getParameter(gl.MAX_TEXTURE_SIZE) || 2048,
      maxConcurrentAudioSources: 32,
      totalMemory: (performance as any).memory?.usedJSHeapSize || 0,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      connectionType: (navigator as any).connection?.effectiveType || 'unknown'
    };
  }

  private getDefaultConfig(): AssetLoaderConfig {
    return {
      maxConcurrentLoads: 6,
      enableStreaming: true,
      enableCompression: true,
      memoryLimit: 512 * 1024 * 1024,
      cacheSize: 100,
      retryAttempts: 3,
      timeoutMs: 30000,
      adaptiveQuality: true,
      mobileOptimizations: true
    };
  }

  private setupEventForwarding(): void {
    // Forward asset loader events
    this.assetLoader.onProgress((progress) => {
      this.onProgressCallbacks.forEach(callback => callback(progress));
    });

    this.assetLoader.onAssetLoaded((asset) => {
      this.onAssetLoadedCallbacks.forEach(callback => callback(asset));
    });

    // Forward streaming events
    this.streamingLoader.onStreamProgress((assetId, progress) => {
      console.log(`Streaming progress for ${assetId}: ${(progress * 100).toFixed(1)}%`);
    });

    this.streamingLoader.onQualityUpgrade((assetId, quality) => {
      console.log(`Quality upgraded for ${assetId}: ${(quality * 100).toFixed(1)}%`);
    });
  }

  private async generatePlaceholderAssets(): Promise<void> {
    console.log('Generating placeholder assets...');
    
    try {
      // Generate character models
      const playerModel = this.visualGenerator.generatePlayerModel();
      this.addGeneratedAsset('player_model', AssetType.MODEL, playerModel);

      const enemies = ['bear', 'squirrel', 'deer', 'coyote', 'snake', 'scorpion'];
      enemies.forEach(enemy => {
        const model = this.visualGenerator.generateEnemyModel(enemy);
        this.addGeneratedAsset(`${enemy}_model`, AssetType.MODEL, model);
      });

      // Generate textures
      const forestTexture = this.visualGenerator.generateForestTexture();
      this.addGeneratedTexture('forest_ground_texture', forestTexture);

      const desertTexture = this.visualGenerator.generateDesertTexture();
      this.addGeneratedTexture('desert_sand_texture', desertTexture);

      // Generate character textures
      const characterTypes = ['player', ...enemies];
      characterTypes.forEach(type => {
        const texture = this.visualGenerator.generateCharacterTexture(type);
        this.addGeneratedTexture(`${type}_texture`, texture);
      });

      // Generate UI textures
      const uiTypes = ['coin', 'powerup', 'health'];
      uiTypes.forEach(type => {
        const texture = this.visualGenerator.generateUITexture(type);
        this.addGeneratedTexture(`ui_${type}`, texture);
      });

      // Generate particle texture
      const particleTexture = this.visualGenerator.generateParticleTexture();
      this.addGeneratedTexture('particle_basic', particleTexture);

      console.log('Placeholder assets generated successfully');
    } catch (error) {
      console.error('Failed to generate placeholder assets:', error);
    }
  }

  private addGeneratedAsset(id: string, type: AssetType, data: any): void {
    const asset: LoadedAsset = {
      id,
      type,
      data,
      size: this.calculateGeneratedAssetSize(data),
      format: 'generated' as any,
      metadata: {
        loadTime: 0,
        fileSize: 0,
        compressionRatio: 1.0
      },
      cleanup: () => this.cleanupGeneratedAsset(id)
    };

    this.generatedAssets.set(id, asset);
  }

  private addGeneratedTexture(id: string, textureData: any): void {
    // Convert canvas to WebGL texture
    const texture = this.canvasToWebGLTexture(textureData.canvas);
    if (texture) {
      this.addGeneratedAsset(id, AssetType.TEXTURE, texture);
    }
  }

  private canvasToWebGLTexture(canvas: HTMLCanvasElement): WebGLTexture | null {
    const webglCanvas = document.createElement('canvas');
    const gl = webglCanvas.getContext('webgl2') || webglCanvas.getContext('webgl');
    
    if (!gl) return null;

    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  private calculateGeneratedAssetSize(data: any): number {
    if (data.vertices && data.vertices.length) {
      return data.vertices.length * 4 + (data.indices?.length || 0) * 2;
    }
    return 1024; // Default size for generated assets
  }

  private cleanupGeneratedAsset(id: string): void {
    this.generatedAssets.delete(id);
  }

  // Public API methods
  async initializeSystem(): Promise<void> {
    console.log('Initializing Asset System...');
    
    try {
      // Load critical boot assets first
      await this.loadCollection('boot');
      console.log('Asset System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Asset System:', error);
      throw error;
    }
  }

  async loadCollection(collectionId: string): Promise<void> {
    if (this.loadedCollections.has(collectionId)) {
      return; // Already loaded
    }

    if (this.loadingCollections.has(collectionId)) {
      return this.loadingCollections.get(collectionId)!; // Already loading
    }

    const collection = this.manifest.collections.find(c => c.id === collectionId);
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found in manifest`);
    }

    const loadPromise = this.performCollectionLoad(collection);
    this.loadingCollections.set(collectionId, loadPromise);

    try {
      await loadPromise;
      this.loadedCollections.add(collectionId);
      this.loadingCollections.delete(collectionId);
      
      this.onCollectionLoadedCallbacks.forEach(callback => callback(collectionId));
      console.log(`Collection ${collectionId} loaded successfully`);
    } catch (error) {
      this.loadingCollections.delete(collectionId);
      throw error;
    }
  }

  private async performCollectionLoad(collection: AssetCollection): Promise<void> {
    // Load dependencies first
    if (collection.dependencies) {
      for (const depId of collection.dependencies) {
        await this.loadCollection(depId);
      }
    }

    // Get asset configs for this collection
    const assetConfigs = collection.assets
      .map(assetId => this.manifest.assets.find(a => a.id === assetId))
      .filter(config => config !== undefined) as AssetConfig[];

    // Optimize each asset config for current device
    const optimizedConfigs = assetConfigs.map(config => 
      this.mobileOptimizer.optimizeAssetConfig(config)
    );

    // Load assets based on strategy
    switch (collection.loadingStrategy) {
      case 'parallel':
        await this.loadAssetsParallel(optimizedConfigs);
        break;
      case 'sequential':
        await this.loadAssetsSequential(optimizedConfigs);
        break;
      case 'progressive':
        await this.loadAssetsProgressive(optimizedConfigs);
        break;
      case 'adaptive':
        await this.loadAssetsAdaptive(optimizedConfigs);
        break;
    }
  }

  private async loadAssetsParallel(configs: AssetConfig[]): Promise<void> {
    const promises = configs.map(config => this.loadSingleAsset(config));
    await Promise.allSettled(promises);
  }

  private async loadAssetsSequential(configs: AssetConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        await this.loadSingleAsset(config);
      } catch (error) {
        console.warn(`Failed to load asset ${config.id}:`, error);
      }
    }
  }

  private async loadAssetsProgressive(configs: AssetConfig[]): Promise<void> {
    // Sort by priority and load in waves
    const sorted = [...configs].sort((a, b) => a.priority - b.priority);
    const batchSize = this.mobileOptimizer.getCurrentProfile().maxConcurrentLoads;
    
    for (let i = 0; i < sorted.length; i += batchSize) {
      const batch = sorted.slice(i, i + batchSize);
      await this.loadAssetsParallel(batch);
    }
  }

  private async loadAssetsAdaptive(configs: AssetConfig[]): Promise<void> {
    // Use streaming for large assets, regular loading for small ones
    const streamingAssets: AssetConfig[] = [];
    const regularAssets: AssetConfig[] = [];
    
    configs.forEach(config => {
      if (config.streaming && this.shouldUseStreaming(config)) {
        streamingAssets.push(config);
      } else {
        regularAssets.push(config);
      }
    });

    // Load regular assets in parallel, streaming assets adaptively
    const promises = [
      this.loadAssetsParallel(regularAssets),
      ...streamingAssets.map(config => this.loadStreamingAsset(config))
    ];

    await Promise.allSettled(promises);
  }

  private shouldUseStreaming(config: AssetConfig): boolean {
    return config.type === AssetType.TEXTURE || 
           config.type === AssetType.AUDIO ||
           config.type === AssetType.MODEL;
  }

  private async loadSingleAsset(config: AssetConfig): Promise<LoadedAsset | null> {
    try {
      // Check if it's a generated asset first
      if (this.generatedAssets.has(config.id)) {
        return this.generatedAssets.get(config.id)!;
      }

      // Allocate memory for the asset
      const estimatedSize = this.estimateAssetSize(config);
      const poolId = config.memoryPool || 'gameplay';
      
      if (!this.memoryManager.allocateMemory(config.id, estimatedSize, poolId)) {
        console.warn(`Cannot allocate memory for asset ${config.id}`);
        return null;
      }

      // Load the asset
      const asset = await this.assetLoader.loadAsset(config);
      
      // Handle audio assets
      if (asset.type === AssetType.AUDIO) {
        await this.audioSystem.loadAudioAsset(asset as any);
      }

      return asset;
    } catch (error) {
      console.error(`Failed to load asset ${config.id}:`, error);
      this.memoryManager.releaseMemory(config.id);
      return null;
    }
  }

  private async loadStreamingAsset(config: AssetConfig): Promise<LoadedAsset | null> {
    try {
      return await this.streamingLoader.streamAsset(config);
    } catch (error) {
      console.error(`Failed to stream asset ${config.id}:`, error);
      // Fallback to regular loading
      return this.loadSingleAsset(config);
    }
  }

  private estimateAssetSize(config: AssetConfig): number {
    // Rough estimates based on asset type
    switch (config.type) {
      case AssetType.TEXTURE:
        return 1024 * 1024; // 1MB
      case AssetType.AUDIO:
        return 512 * 1024;  // 512KB
      case AssetType.MODEL:
        return 256 * 1024;  // 256KB
      default:
        return 64 * 1024;   // 64KB
    }
  }

  // Audio system integration
  async playAudio(assetId: string, options?: any): Promise<string | null> {
    return this.audioSystem.playAudio(assetId, options);
  }

  stopAudio(sourceId: string): void {
    this.audioSystem.stopAudio(sourceId);
  }

  setAudioVolume(sourceId: string, volume: number): void {
    this.audioSystem.setAudioVolume(sourceId, volume);
  }

  setMasterVolume(volume: number): void {
    this.audioSystem.setMasterVolume(volume);
  }

  // Asset retrieval
  getAsset<T = any>(assetId: string): LoadedAsset<T> | null {
    // Check generated assets first
    const generated = this.generatedAssets.get(assetId);
    if (generated) {
      return generated as LoadedAsset<T>;
    }

    // Check loaded assets
    return this.assetLoader.getAsset<T>(assetId);
  }

  isAssetLoaded(assetId: string): boolean {
    return this.generatedAssets.has(assetId) || this.assetLoader.isLoaded(assetId);
  }

  isCollectionLoaded(collectionId: string): boolean {
    return this.loadedCollections.has(collectionId);
  }

  // Event handlers
  onProgress(callback: (progress: LoadingProgress) => void): void {
    this.onProgressCallbacks.push(callback);
  }

  onCollectionLoaded(callback: (collectionId: string) => void): void {
    this.onCollectionLoadedCallbacks.push(callback);
  }

  onAssetLoaded(callback: (asset: LoadedAsset) => void): void {
    this.onAssetLoadedCallbacks.push(callback);
  }

  // System information
  getSystemInfo(): {
    deviceCapabilities: DeviceCapabilities;
    currentProfile: any;
    memoryUsage: any;
    loadedCollections: string[];
    loadedAssets: number;
    generatedAssets: number;
  } {
    return {
      deviceCapabilities: this.deviceCapabilities,
      currentProfile: this.mobileOptimizer.getCurrentProfile(),
      memoryUsage: this.memoryManager.getMemoryStats(),
      loadedCollections: Array.from(this.loadedCollections),
      loadedAssets: this.assetLoader.getPerformanceMetrics().totalSize,
      generatedAssets: this.generatedAssets.size
    };
  }

  getManifest(): AssetManifest {
    return this.manifest;
  }

  // Performance monitoring
  getPerformanceReport(): string {
    return this.mobileOptimizer.generateOptimizationReport();
  }

  // Cleanup
  cleanup(): void {
    this.assetLoader.cleanup();
    this.audioSystem.cleanup();
    this.streamingLoader.cleanup();
    this.visualGenerator.clearCache();
    this.memoryManager.cleanup();
    this.generatedAssets.clear();
    this.loadedCollections.clear();
    this.loadingCollections.clear();
    
    // Clear callbacks
    this.onProgressCallbacks.length = 0;
    this.onCollectionLoadedCallbacks.length = 0;
    this.onAssetLoadedCallbacks.length = 0;
  }
}