// Core Asset Loading System with Compression and Mobile Optimization
import {
  AssetConfig,
  AssetType,
  LoadedAsset,
  LoadingProgress,
  LoadingStage,
  AssetLoaderConfig,
  AssetPriority,
  CompressionFormat,
  DeviceCapabilities,
  AssetPerformanceMetrics
} from '../../types/assets/AssetTypes';
import { CompressionDetector } from '../../utils/compression/CompressionDetector';
import { MemoryManager } from './MemoryManager';

export class AssetLoader {
  private assets = new Map<string, LoadedAsset>();
  private loadingQueue: AssetConfig[] = [];
  private activeLoads = new Map<string, Promise<LoadedAsset>>();
  private loadingProgress: LoadingProgress;
  private config: AssetLoaderConfig;
  private memoryManager: MemoryManager;
  private compressionDetector: CompressionDetector;
  private deviceCapabilities: DeviceCapabilities;
  private performanceMetrics: AssetPerformanceMetrics;
  
  private onProgressCallbacks: ((progress: LoadingProgress) => void)[] = [];
  private onAssetLoadedCallbacks: ((asset: LoadedAsset) => void)[] = [];

  constructor(config: Partial<AssetLoaderConfig> = {}) {
    this.config = {
      maxConcurrentLoads: 6,
      enableStreaming: true,
      enableCompression: true,
      memoryLimit: 512 * 1024 * 1024, // 512MB
      cacheSize: 100,
      retryAttempts: 3,
      timeoutMs: 30000,
      adaptiveQuality: true,
      mobileOptimizations: true,
      ...config
    };

    this.loadingProgress = {
      total: 0,
      loaded: 0,
      failed: 0,
      percentage: 0,
      stage: LoadingStage.DETECTING
    };

    this.memoryManager = new MemoryManager(this.config.memoryLimit);
    this.compressionDetector = new CompressionDetector();
    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.performanceMetrics = this.initializeMetrics();

    // Apply mobile optimizations
    if (this.config.mobileOptimizations && this.deviceCapabilities.isMobile) {
      this.optimizeForMobile();
    }
  }

  private detectDeviceCapabilities(): DeviceCapabilities {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    const capabilities: DeviceCapabilities = {
      webgl2: !!document.createElement('canvas').getContext('webgl2'),
      astcSupport: false,
      etc2Support: false,
      s3tcSupport: false,
      webAudioAPI: !!(window.AudioContext || (window as any).webkitAudioContext),
      maxTextureSize: 2048,
      maxConcurrentAudioSources: 32,
      totalMemory: (performance as any).memory?.usedJSHeapSize || 0,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      connectionType: (navigator as any).connection?.effectiveType || 'unknown'
    };

    if (gl) {
      // Check texture compression support
      const astc = gl.getExtension('WEBGL_compressed_texture_astc');
      const etc2 = gl.getExtension('WEBGL_compressed_texture_etc');
      const s3tc = gl.getExtension('WEBGL_compressed_texture_s3tc');

      capabilities.astcSupport = !!astc;
      capabilities.etc2Support = !!etc2;
      capabilities.s3tcSupport = !!s3tc;
      capabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }

    return capabilities;
  }

  private initializeMetrics(): AssetPerformanceMetrics {
    return {
      totalLoadTime: 0,
      totalSize: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      memoryUsage: 0,
      failedAssets: [],
      deviceCapabilities: this.deviceCapabilities
    };
  }

  private optimizeForMobile(): void {
    // Reduce concurrent loads for mobile
    this.config.maxConcurrentLoads = Math.min(this.config.maxConcurrentLoads, 3);
    
    // Reduce memory limit for mobile
    this.config.memoryLimit = Math.min(this.config.memoryLimit, 256 * 1024 * 1024);
    
    // Adjust timeout for slower connections
    if (this.deviceCapabilities.connectionType === 'slow-2g' || 
        this.deviceCapabilities.connectionType === '2g') {
      this.config.timeoutMs *= 2;
    }
  }

  async loadAsset(config: AssetConfig): Promise<LoadedAsset> {
    const startTime = performance.now();
    
    // Check if already loaded
    if (this.assets.has(config.id)) {
      return this.assets.get(config.id)!;
    }

    // Check if currently loading
    if (this.activeLoads.has(config.id)) {
      return this.activeLoads.get(config.id)!;
    }

    const loadPromise = this.performAssetLoad(config, startTime);
    this.activeLoads.set(config.id, loadPromise);

    try {
      const asset = await loadPromise;
      this.assets.set(config.id, asset);
      this.activeLoads.delete(config.id);
      
      // Update performance metrics
      this.updateMetrics(asset, startTime);
      
      // Notify callbacks
      this.onAssetLoadedCallbacks.forEach(callback => callback(asset));
      
      return asset;
    } catch (error) {
      this.activeLoads.delete(config.id);
      this.performanceMetrics.failedAssets.push(config.id);
      throw error;
    }
  }

  private async performAssetLoad(config: AssetConfig, startTime: number): Promise<LoadedAsset> {
    this.updateProgress(LoadingStage.DETECTING, config.id);
    
    // Determine best format for this device
    const optimalFormat = await this.compressionDetector.getOptimalFormat(
      config,
      this.deviceCapabilities
    );

    this.updateProgress(LoadingStage.DOWNLOADING, config.id);
    
    // Download asset with fallbacks
    const response = await this.downloadWithFallbacks(config, optimalFormat);
    
    this.updateProgress(LoadingStage.DECOMPRESSING, config.id);
    
    // Process based on asset type
    const processedData = await this.processAssetData(
      response,
      config.type,
      optimalFormat
    );

    this.updateProgress(LoadingStage.PROCESSING, config.id);
    
    // Create asset metadata
    const metadata = {
      loadTime: performance.now() - startTime,
      fileSize: response.headers.get('content-length') ? 
        parseInt(response.headers.get('content-length')!) : 0,
      compressionRatio: this.calculateCompressionRatio(processedData, metadata.fileSize)
    };

    const asset: LoadedAsset = {
      id: config.id,
      type: config.type,
      data: processedData,
      size: this.calculateAssetSize(processedData),
      format: optimalFormat,
      metadata,
      cleanup: () => this.cleanupAsset(config.id)
    };

    this.updateProgress(LoadingStage.COMPLETE, config.id);
    
    return asset;
  }

  private async downloadWithFallbacks(
    config: AssetConfig,
    preferredFormat: CompressionFormat
  ): Promise<Response> {
    const urls = this.buildUrlList(config, preferredFormat);
    let lastError: Error;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      for (const url of urls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

          const response = await fetch(url, {
            signal: controller.signal,
            cache: 'force-cache'
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            return response;
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`Failed to load ${url}, attempt ${attempt + 1}:`, error);
        }
      }
    }

    throw new Error(`Failed to load asset ${config.id} after ${this.config.retryAttempts} attempts: ${lastError!.message}`);
  }

  private buildUrlList(config: AssetConfig, preferredFormat: CompressionFormat): string[] {
    const urls: string[] = [];
    
    // Try preferred format first
    const formatExtension = this.getFormatExtension(preferredFormat);
    if (formatExtension) {
      urls.push(this.replaceExtension(config.src, formatExtension));
    }
    
    // Add original URL
    urls.push(config.src);
    
    // Add fallbacks
    if (config.fallbacks) {
      urls.push(...config.fallbacks);
    }

    return urls;
  }

  private getFormatExtension(format: CompressionFormat): string | null {
    const extensions: Record<CompressionFormat, string> = {
      [CompressionFormat.WEBP]: 'webp',
      [CompressionFormat.JPEG]: 'jpg',
      [CompressionFormat.PNG]: 'png',
      [CompressionFormat.ASTC]: 'astc',
      [CompressionFormat.ETC2]: 'etc2',
      [CompressionFormat.S3TC]: 'dds',
      [CompressionFormat.PVRTC]: 'pvr',
      [CompressionFormat.OPUS]: 'opus',
      [CompressionFormat.OGG]: 'ogg',
      [CompressionFormat.MP3]: 'mp3',
      [CompressionFormat.AAC]: 'aac',
      [CompressionFormat.WAV]: 'wav'
    };

    return extensions[format] || null;
  }

  private replaceExtension(url: string, newExtension: string): string {
    const lastDotIndex = url.lastIndexOf('.');
    if (lastDotIndex === -1) return url;
    
    return url.substring(0, lastDotIndex + 1) + newExtension;
  }

  private async processAssetData(
    response: Response,
    type: AssetType,
    format: CompressionFormat
  ): Promise<any> {
    switch (type) {
      case AssetType.TEXTURE:
        return this.processTextureAsset(response, format);
      case AssetType.AUDIO:
        return this.processAudioAsset(response, format);
      case AssetType.MODEL:
        return this.processModelAsset(response);
      case AssetType.JSON:
        return response.json();
      case AssetType.BINARY:
        return response.arrayBuffer();
      default:
        return response.text();
    }
  }

  private async processTextureAsset(response: Response, format: CompressionFormat): Promise<WebGLTexture> {
    const arrayBuffer = await response.arrayBuffer();
    
    // For compressed formats, handle directly
    if (this.isCompressedTextureFormat(format)) {
      return this.createCompressedTexture(arrayBuffer, format);
    }
    
    // For standard formats, create image and convert to texture
    const blob = new Blob([arrayBuffer]);
    const imageUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const texture = this.createTextureFromImage(image);
        URL.revokeObjectURL(imageUrl);
        resolve(texture);
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Failed to load image'));
      };
      image.src = imageUrl;
    });
  }

  private async processAudioAsset(response: Response, format: CompressionFormat): Promise<AudioBuffer> {
    const arrayBuffer = await response.arrayBuffer();
    
    // Use Web Audio API to decode
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioContext.decodeAudioData(arrayBuffer);
  }

  private async processModelAsset(response: Response): Promise<Float32Array> {
    const arrayBuffer = await response.arrayBuffer();
    // Simple model format - extend as needed
    return new Float32Array(arrayBuffer);
  }

  private isCompressedTextureFormat(format: CompressionFormat): boolean {
    return [
      CompressionFormat.ASTC,
      CompressionFormat.ETC2,
      CompressionFormat.S3TC,
      CompressionFormat.PVRTC
    ].includes(format);
  }

  private createCompressedTexture(data: ArrayBuffer, format: CompressionFormat): WebGLTexture {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) {
      throw new Error('WebGL not supported');
    }

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set up compressed texture based on format
    const internalFormat = this.getCompressedTextureFormat(gl, format);
    
    // This is a simplified implementation - actual compressed texture loading
    // would require parsing the specific format headers
    gl.compressedTexImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      512, // width - would be parsed from header
      512, // height - would be parsed from header
      0,
      new Uint8Array(data)
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  }

  private createTextureFromImage(image: HTMLImageElement): WebGLTexture {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) {
      throw new Error('WebGL not supported');
    }

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // Generate mipmaps if power of 2
    if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    return texture;
  }

  private getCompressedTextureFormat(gl: WebGLRenderingContext, format: CompressionFormat): number {
    // This would return the appropriate GL constant based on format
    // Implementation depends on the specific compressed texture extensions
    switch (format) {
      case CompressionFormat.ASTC:
        return 0x93B0; // COMPRESSED_RGBA_ASTC_4x4_KHR
      case CompressionFormat.ETC2:
        return 0x9274; // COMPRESSED_RGBA8_ETC2_EAC
      case CompressionFormat.S3TC:
        return 0x83F3; // COMPRESSED_RGBA_S3TC_DXT5_EXT
      default:
        return gl.RGBA;
    }
  }

  private isPowerOf2(value: number): boolean {
    return (value & (value - 1)) === 0;
  }

  private calculateAssetSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof AudioBuffer) {
      return data.length * data.numberOfChannels * 4; // 32-bit float
    } else if (typeof data === 'string') {
      return new Blob([data]).size;
    }
    return 0;
  }

  private calculateCompressionRatio(processedData: any, originalSize: number): number {
    if (originalSize === 0) return 1;
    return this.calculateAssetSize(processedData) / originalSize;
  }

  private updateMetrics(asset: LoadedAsset, startTime: number): void {
    this.performanceMetrics.totalLoadTime += asset.metadata.loadTime;
    this.performanceMetrics.totalSize += asset.size;
    this.performanceMetrics.memoryUsage = this.memoryManager.getCurrentUsage();
    
    // Update cache hit rate
    const totalAttempts = this.assets.size + this.performanceMetrics.failedAssets.length;
    this.performanceMetrics.cacheHitRate = this.assets.size / totalAttempts;
  }

  private updateProgress(stage: LoadingStage, currentAsset?: string): void {
    this.loadingProgress.stage = stage;
    this.loadingProgress.current = currentAsset;
    this.loadingProgress.percentage = 
      (this.loadingProgress.loaded / this.loadingProgress.total) * 100;
    
    this.onProgressCallbacks.forEach(callback => callback(this.loadingProgress));
  }

  private cleanupAsset(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) return;

    // Cleanup WebGL textures
    if (asset.data instanceof WebGLTexture) {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        gl.deleteTexture(asset.data);
      }
    }

    this.assets.delete(id);
    this.memoryManager.releaseMemory(asset.size);
  }

  // Public API methods
  onProgress(callback: (progress: LoadingProgress) => void): void {
    this.onProgressCallbacks.push(callback);
  }

  onAssetLoaded(callback: (asset: LoadedAsset) => void): void {
    this.onAssetLoadedCallbacks.push(callback);
  }

  getAsset<T = any>(id: string): LoadedAsset<T> | null {
    return this.assets.get(id) as LoadedAsset<T> || null;
  }

  isLoaded(id: string): boolean {
    return this.assets.has(id);
  }

  getPerformanceMetrics(): AssetPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }

  async loadCollection(assetConfigs: AssetConfig[]): Promise<LoadedAsset[]> {
    this.loadingProgress.total = assetConfigs.length;
    this.loadingProgress.loaded = 0;
    this.loadingProgress.failed = 0;

    // Sort by priority
    const sortedConfigs = [...assetConfigs].sort((a, b) => a.priority - b.priority);
    
    // Load in batches based on concurrent load limit
    const results: LoadedAsset[] = [];
    
    for (let i = 0; i < sortedConfigs.length; i += this.config.maxConcurrentLoads) {
      const batch = sortedConfigs.slice(i, i + this.config.maxConcurrentLoads);
      const batchPromises = batch.map(config => this.loadAsset(config));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            this.loadingProgress.loaded++;
          } else {
            this.loadingProgress.failed++;
            console.error('Asset load failed:', result.reason);
          }
        }
      } catch (error) {
        console.error('Batch load failed:', error);
      }
    }

    return results;
  }

  cleanup(): void {
    // Cleanup all assets
    for (const [id] of this.assets) {
      this.cleanupAsset(id);
    }
    
    // Clear callbacks
    this.onProgressCallbacks.length = 0;
    this.onAssetLoadedCallbacks.length = 0;
    
    // Cleanup memory manager
    this.memoryManager.cleanup();
  }
}