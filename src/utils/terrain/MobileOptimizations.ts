/**
 * Mobile-Specific Terrain Optimizations
 * Handles device detection, adaptive quality, and performance scaling
 */

import { TerrainConfig } from '../../types/terrain';

export interface MobileDetection {
  isMobile: boolean;
  isLowEnd: boolean;
  hasTouchScreen: boolean;
  maxMemory: number;
  gpuTier: 'low' | 'medium' | 'high';
  supportedFeatures: {
    webgl2: boolean;
    webgpu: boolean;
    instancedArrays: boolean;
    vertexArrayObjects: boolean;
  };
}

export interface AdaptiveSettings {
  chunkSize: number;
  renderDistance: number;
  lodLevels: number;
  enableGPUGeneration: boolean;
  maxConcurrentChunks: number;
  useCompressedTextures: boolean;
  enableFrustumCulling: boolean;
  enableOcclusionCulling: boolean;
  progressiveLoading: boolean;
  targetFPS: number;
}

export class MobileOptimizer {
  private detection: MobileDetection;
  private adaptiveSettings: AdaptiveSettings;
  private performanceHistory: number[] = [];
  private lastAdaptation = 0;
  private adaptationCooldown = 5000; // 5 seconds

  constructor() {
    this.detection = this.detectMobileCapabilities();
    this.adaptiveSettings = this.generateInitialSettings();
  }

  private detectMobileCapabilities(): MobileDetection {
    const userAgent = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
                    'ontouchstart' in window ||
                    navigator.maxTouchPoints > 0;

    // Detect if it's a low-end device
    const isLowEnd = this.detectLowEndDevice();
    
    // Memory detection (approximate)
    const maxMemory = this.estimateDeviceMemory();
    
    // GPU tier detection
    const gpuTier = this.detectGPUTier();
    
    // Feature detection
    const supportedFeatures = this.detectSupportedFeatures();

    return {
      isMobile,
      isLowEnd,
      hasTouchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      maxMemory,
      gpuTier,
      supportedFeatures
    };
  }

  private detectLowEndDevice(): boolean {
    // CPU core detection
    const cores = navigator.hardwareConcurrency || 4;
    
    // Memory hints
    const memory = (navigator as any).deviceMemory || 4;
    
    // Connection speed
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType || '4g';
    
    // Low-end device characteristics
    return cores <= 2 || 
           memory <= 2 || 
           effectiveType === 'slow-2g' || 
           effectiveType === '2g' ||
           /Android.*Chrome\/[0-6][0-9]/i.test(navigator.userAgent); // Old Android Chrome
  }

  private estimateDeviceMemory(): number {
    // Try to get device memory if available
    if ((navigator as any).deviceMemory) {
      return (navigator as any).deviceMemory * 1024; // Convert GB to MB
    }
    
    // Fallback estimation based on user agent
    const userAgent = navigator.userAgent;
    
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      // iOS devices - estimate based on model year
      const modelMatch = userAgent.match(/iPhone(\d+)/);
      if (modelMatch) {
        const modelNumber = parseInt(modelMatch[1]);
        return modelNumber >= 12 ? 6144 : modelNumber >= 8 ? 3072 : 2048;
      }
      return 4096; // Default for iOS
    }
    
    if (/Android/i.test(userAgent)) {
      // Android estimation based on various factors
      const versionMatch = userAgent.match(/Android (\d+)/);
      const version = versionMatch ? parseInt(versionMatch[1]) : 7;
      
      return version >= 10 ? 4096 : version >= 8 ? 3072 : 2048;
    }
    
    // Desktop default
    return 8192;
  }

  private detectGPUTier(): 'low' | 'medium' | 'high' {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'low';
      
      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      
      canvas.remove();
      
      // High-end GPUs
      if (/NVIDIA|AMD|Intel Iris|Mali-G|Adreno 6/i.test(renderer)) {
        return 'high';
      }
      
      // Medium-tier GPUs
      if (/Adreno [45]|Mali-G|PowerVR|Intel HD/i.test(renderer)) {
        return 'medium';
      }
      
      // Low-end or integrated
      return 'low';
      
    } catch (error) {
      return 'low';
    }
  }

  private detectSupportedFeatures(): MobileDetection['supportedFeatures'] {
    const features = {
      webgl2: false,
      webgpu: false,
      instancedArrays: false,
      vertexArrayObjects: false
    };

    try {
      // WebGL2 detection
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      features.webgl2 = !!gl2;
      
      if (gl2) {
        features.instancedArrays = true;
        features.vertexArrayObjects = true;
      } else {
        // WebGL1 extension detection
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          features.instancedArrays = !!gl.getExtension('ANGLE_instanced_arrays');
          features.vertexArrayObjects = !!gl.getExtension('OES_vertex_array_object');
        }
      }
      
      canvas.remove();
      
      // WebGPU detection
      features.webgpu = 'gpu' in navigator;
      
    } catch (error) {
      console.warn('Error detecting GPU features:', error);
    }

    return features;
  }

  private generateInitialSettings(): AdaptiveSettings {
    const { isMobile, isLowEnd, gpuTier, maxMemory } = this.detection;
    
    // Base settings for desktop/high-end
    let settings: AdaptiveSettings = {
      chunkSize: 64,
      renderDistance: 512,
      lodLevels: 4,
      enableGPUGeneration: true,
      maxConcurrentChunks: 8,
      useCompressedTextures: true,
      enableFrustumCulling: true,
      enableOcclusionCulling: true,
      progressiveLoading: false,
      targetFPS: 60
    };

    // Mobile adjustments
    if (isMobile) {
      settings.chunkSize = 32;
      settings.renderDistance = 256;
      settings.lodLevels = 3;
      settings.maxConcurrentChunks = 4;
      settings.progressiveLoading = true;
      settings.targetFPS = 30;
      
      // Disable GPU generation on mobile for compatibility
      if (isLowEnd || gpuTier === 'low') {
        settings.enableGPUGeneration = false;
      }
    }

    // Low-end device adjustments
    if (isLowEnd) {
      settings.chunkSize = Math.min(settings.chunkSize, 32);
      settings.renderDistance = Math.min(settings.renderDistance, 128);
      settings.lodLevels = 2;
      settings.maxConcurrentChunks = 2;
      settings.enableGPUGeneration = false;
      settings.enableOcclusionCulling = false;
      settings.targetFPS = 30;
    }

    // Memory-based adjustments
    if (maxMemory < 2048) {
      settings.renderDistance = Math.min(settings.renderDistance, 128);
      settings.maxConcurrentChunks = Math.min(settings.maxConcurrentChunks, 2);
    } else if (maxMemory < 4096) {
      settings.renderDistance = Math.min(settings.renderDistance, 256);
      settings.maxConcurrentChunks = Math.min(settings.maxConcurrentChunks, 4);
    }

    return settings;
  }

  adaptSettings(currentFPS: number, frameTime: number): AdaptiveSettings {
    const now = Date.now();
    
    // Don't adapt too frequently
    if (now - this.lastAdaptation < this.adaptationCooldown) {
      return this.adaptiveSettings;
    }

    this.performanceHistory.push(currentFPS);
    if (this.performanceHistory.length > 60) {
      this.performanceHistory.shift();
    }

    const avgFPS = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;
    const targetFPS = this.adaptiveSettings.targetFPS;
    
    // Performance is significantly below target
    if (avgFPS < targetFPS * 0.8) {
      this.reduceQuality();
      this.lastAdaptation = now;
      console.log(`Reduced terrain quality due to low FPS: ${avgFPS.toFixed(1)}`);
    }
    // Performance is well above target and we can increase quality
    else if (avgFPS > targetFPS * 1.1 && frameTime < 12) {
      this.increaseQuality();
      this.lastAdaptation = now;
      console.log(`Increased terrain quality due to good performance: ${avgFPS.toFixed(1)}`);
    }

    return this.adaptiveSettings;
  }

  private reduceQuality(): void {
    const settings = this.adaptiveSettings;
    
    // Reduce render distance first
    if (settings.renderDistance > 128) {
      settings.renderDistance = Math.max(128, settings.renderDistance * 0.8);
      return;
    }
    
    // Reduce chunk size
    if (settings.chunkSize > 16) {
      settings.chunkSize = Math.max(16, settings.chunkSize * 0.75);
      return;
    }
    
    // Reduce LOD levels
    if (settings.lodLevels > 2) {
      settings.lodLevels--;
      return;
    }
    
    // Reduce concurrent chunks
    if (settings.maxConcurrentChunks > 1) {
      settings.maxConcurrentChunks = Math.max(1, settings.maxConcurrentChunks - 1);
      return;
    }
    
    // Disable GPU generation as last resort
    if (settings.enableGPUGeneration) {
      settings.enableGPUGeneration = false;
      return;
    }
  }

  private increaseQuality(): void {
    const settings = this.adaptiveSettings;
    const maxSettings = this.getMaxRecommendedSettings();
    
    // Increase concurrent chunks first
    if (settings.maxConcurrentChunks < maxSettings.maxConcurrentChunks) {
      settings.maxConcurrentChunks++;
      return;
    }
    
    // Increase LOD levels
    if (settings.lodLevels < maxSettings.lodLevels) {
      settings.lodLevels++;
      return;
    }
    
    // Increase chunk size
    if (settings.chunkSize < maxSettings.chunkSize) {
      settings.chunkSize = Math.min(maxSettings.chunkSize, settings.chunkSize * 1.25);
      return;
    }
    
    // Increase render distance
    if (settings.renderDistance < maxSettings.renderDistance) {
      settings.renderDistance = Math.min(maxSettings.renderDistance, settings.renderDistance * 1.2);
      return;
    }
    
    // Enable GPU generation if supported
    if (!settings.enableGPUGeneration && this.detection.supportedFeatures.webgpu) {
      settings.enableGPUGeneration = true;
      return;
    }
  }

  private getMaxRecommendedSettings(): AdaptiveSettings {
    if (this.detection.isMobile) {
      return {
        chunkSize: 64,
        renderDistance: 512,
        lodLevels: 3,
        enableGPUGeneration: !this.detection.isLowEnd,
        maxConcurrentChunks: 6,
        useCompressedTextures: true,
        enableFrustumCulling: true,
        enableOcclusionCulling: false,
        progressiveLoading: true,
        targetFPS: 30
      };
    } else {
      return {
        chunkSize: 128,
        renderDistance: 1024,
        lodLevels: 4,
        enableGPUGeneration: true,
        maxConcurrentChunks: 12,
        useCompressedTextures: true,
        enableFrustumCulling: true,
        enableOcclusionCulling: true,
        progressiveLoading: false,
        targetFPS: 60
      };
    }
  }

  getTerrainConfig(): TerrainConfig {
    return {
      chunkSize: this.adaptiveSettings.chunkSize,
      renderDistance: this.adaptiveSettings.renderDistance,
      lodLevels: this.adaptiveSettings.lodLevels,
      noiseFrequency: 0.01,
      noiseAmplitude: 8.0,
      heightScale: 1.0,
      enableGPUGeneration: this.adaptiveSettings.enableGPUGeneration,
      maxConcurrentChunks: this.adaptiveSettings.maxConcurrentChunks
    };
  }

  getMobileDetection(): MobileDetection {
    return { ...this.detection };
  }

  getAdaptiveSettings(): AdaptiveSettings {
    return { ...this.adaptiveSettings };
  }

  // Progressive loading utilities
  
  shouldUseProgressiveLoading(): boolean {
    return this.adaptiveSettings.progressiveLoading || 
           this.detection.isMobile || 
           this.detection.isLowEnd;
  }

  getProgressiveLoadingSteps(): Array<{ quality: number; description: string }> {
    if (!this.shouldUseProgressiveLoading()) {
      return [{ quality: 1.0, description: 'Full quality' }];
    }

    return [
      { quality: 0.25, description: 'Low detail placeholder' },
      { quality: 0.5, description: 'Medium detail' },
      { quality: 1.0, description: 'Full detail' }
    ];
  }

  // Texture compression utilities
  
  getSupportedTextureFormats(): string[] {
    const formats: string[] = [];
    
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        // Check for compressed texture support
        if (gl.getExtension('WEBGL_compressed_texture_s3tc')) {
          formats.push('s3tc');
        }
        if (gl.getExtension('WEBGL_compressed_texture_etc1')) {
          formats.push('etc1');
        }
        if (gl.getExtension('WEBGL_compressed_texture_astc')) {
          formats.push('astc');
        }
        if (gl.getExtension('WEBGL_compressed_texture_pvrtc')) {
          formats.push('pvrtc');
        }
      }
      
      canvas.remove();
    } catch (error) {
      console.warn('Error detecting texture formats:', error);
    }
    
    return formats;
  }

  // Battery and thermal management
  
  shouldReduceQualityForBattery(): boolean {
    try {
      const battery = (navigator as any).battery || (navigator as any).getBattery?.();
      if (battery) {
        return battery.level < 0.2 || !battery.charging;
      }
    } catch (error) {
      // Battery API not available
    }
    
    return false;
  }

  // Network-aware optimizations
  
  getNetworkAwareSettings(): { preloadRadius: number; quality: number } {
    try {
      const connection = (navigator as any).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        const downlink = connection.downlink || 10;
        
        if (effectiveType === '4g' && downlink > 5) {
          return { preloadRadius: 3, quality: 1.0 };
        } else if (effectiveType === '3g' || downlink > 1) {
          return { preloadRadius: 2, quality: 0.75 };
        } else {
          return { preloadRadius: 1, quality: 0.5 };
        }
      }
    } catch (error) {
      // Network API not available
    }
    
    return { preloadRadius: 2, quality: 0.8 };
  }

  // Debug information
  
  getDebugInfo(): Record<string, any> {
    return {
      detection: this.detection,
      adaptiveSettings: this.adaptiveSettings,
      performanceHistory: this.performanceHistory.slice(-10),
      supportedTextureFormats: this.getSupportedTextureFormats(),
      networkSettings: this.getNetworkAwareSettings(),
      shouldReduceForBattery: this.shouldReduceQualityForBattery()
    };
  }
}