// Asset Configuration for Open Runner Game
import { AssetLoaderConfig, DeviceCapabilities } from '../types/assets/AssetTypes';

export interface GameAssetConfig {
  development: AssetLoaderConfig;
  production: AssetLoaderConfig;
  testing: AssetLoaderConfig;
}

export class AssetConfigManager {
  private static instance: AssetConfigManager;
  private config: GameAssetConfig;
  private environment: 'development' | 'production' | 'testing';

  private constructor() {
    this.environment = this.detectEnvironment();
    this.config = this.buildConfigurations();
  }

  static getInstance(): AssetConfigManager {
    if (!AssetConfigManager.instance) {
      AssetConfigManager.instance = new AssetConfigManager();
    }
    return AssetConfigManager.instance;
  }

  private detectEnvironment(): 'development' | 'production' | 'testing' {
    if (typeof process !== 'undefined' && process.env.NODE_ENV) {
      return process.env.NODE_ENV as any;
    }
    
    // Browser environment detection
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'development';
      }
      if (window.location.hostname.includes('test') || window.location.hostname.includes('staging')) {
        return 'testing';
      }
    }
    
    return 'production';
  }

  private buildConfigurations(): GameAssetConfig {
    return {
      development: {
        maxConcurrentLoads: 8,
        enableStreaming: true,
        enableCompression: false, // Disable for faster iteration
        memoryLimit: 1024 * 1024 * 1024, // 1GB for development
        cacheSize: 200,
        retryAttempts: 3,
        timeoutMs: 60000, // Longer timeout for development
        adaptiveQuality: false, // Fixed quality for consistency
        mobileOptimizations: false // Full quality for testing
      },

      testing: {
        maxConcurrentLoads: 4,
        enableStreaming: true,
        enableCompression: true,
        memoryLimit: 512 * 1024 * 1024, // 512MB
        cacheSize: 100,
        retryAttempts: 2,
        timeoutMs: 30000,
        adaptiveQuality: true,
        mobileOptimizations: true
      },

      production: {
        maxConcurrentLoads: 6,
        enableStreaming: true,
        enableCompression: true,
        memoryLimit: 512 * 1024 * 1024, // 512MB
        cacheSize: 150,
        retryAttempts: 3,
        timeoutMs: 30000,
        adaptiveQuality: true,
        mobileOptimizations: true
      }
    };
  }

  getCurrentConfig(): AssetLoaderConfig {
    return { ...this.config[this.environment] };
  }

  getOptimizedConfig(capabilities: DeviceCapabilities): AssetLoaderConfig {
    const baseConfig = this.getCurrentConfig();
    
    // Apply device-specific optimizations
    if (capabilities.isMobile) {
      return this.optimizeForMobile(baseConfig, capabilities);
    } else {
      return this.optimizeForDesktop(baseConfig, capabilities);
    }
  }

  private optimizeForMobile(config: AssetLoaderConfig, capabilities: DeviceCapabilities): AssetLoaderConfig {
    const optimized = { ...config };
    
    // Reduce concurrent loads based on connection
    switch (capabilities.connectionType) {
      case 'slow-2g':
        optimized.maxConcurrentLoads = 1;
        optimized.timeoutMs *= 2;
        break;
      case '2g':
        optimized.maxConcurrentLoads = 2;
        optimized.timeoutMs *= 1.5;
        break;
      case '3g':
        optimized.maxConcurrentLoads = 3;
        break;
      default:
        optimized.maxConcurrentLoads = Math.min(optimized.maxConcurrentLoads, 4);
    }
    
    // Adjust memory limit based on available memory
    if (capabilities.totalMemory > 0) {
      const availableMemory = capabilities.totalMemory * 0.3; // Use 30% of total memory
      optimized.memoryLimit = Math.min(optimized.memoryLimit, availableMemory);
    } else {
      optimized.memoryLimit = Math.min(optimized.memoryLimit, 256 * 1024 * 1024); // 256MB fallback
    }
    
    // Enable aggressive optimizations
    optimized.mobileOptimizations = true;
    optimized.adaptiveQuality = true;
    
    return optimized;
  }

  private optimizeForDesktop(config: AssetLoaderConfig, capabilities: DeviceCapabilities): AssetLoaderConfig {
    const optimized = { ...config };
    
    // Increase limits for desktop
    optimized.maxConcurrentLoads = Math.max(optimized.maxConcurrentLoads, 6);
    optimized.memoryLimit = Math.max(optimized.memoryLimit, 512 * 1024 * 1024);
    optimized.cacheSize = Math.max(optimized.cacheSize, 200);
    
    // Enable high-quality features
    if (capabilities.webgl2) {
      optimized.enableCompression = true;
    }
    
    return optimized;
  }

  // Asset path configuration
  getAssetBasePath(): string {
    switch (this.environment) {
      case 'development':
        return '/src/assets/';
      case 'testing':
        return '/assets/';
      case 'production':
        return '/assets/';
      default:
        return '/assets/';
    }
  }

  getCDNBasePath(): string | null {
    if (this.environment === 'production') {
      // Configure your CDN URL here
      return 'https://cdn.openrunner.game/assets/';
    }
    return null;
  }

  // Quality presets
  getQualityPreset(preset: 'low' | 'medium' | 'high' | 'ultra'): Partial<AssetLoaderConfig> {
    const presets = {
      low: {
        enableCompression: true,
        adaptiveQuality: true,
        memoryLimit: 128 * 1024 * 1024, // 128MB
        maxConcurrentLoads: 2
      },
      medium: {
        enableCompression: true,
        adaptiveQuality: true,
        memoryLimit: 256 * 1024 * 1024, // 256MB
        maxConcurrentLoads: 4
      },
      high: {
        enableCompression: true,
        adaptiveQuality: false,
        memoryLimit: 512 * 1024 * 1024, // 512MB
        maxConcurrentLoads: 6
      },
      ultra: {
        enableCompression: false,
        adaptiveQuality: false,
        memoryLimit: 1024 * 1024 * 1024, // 1GB
        maxConcurrentLoads: 8
      }
    };

    return presets[preset];
  }

  // Runtime configuration updates
  updateConfig(updates: Partial<AssetLoaderConfig>): void {
    this.config[this.environment] = { ...this.config[this.environment], ...updates };
  }

  // Environment detection helpers
  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  isProduction(): boolean {
    return this.environment === 'production';
  }

  isTesting(): boolean {
    return this.environment === 'testing';
  }

  // Debug information
  getDebugInfo(): {
    environment: string;
    config: AssetLoaderConfig;
    basePath: string;
    cdnPath: string | null;
  } {
    return {
      environment: this.environment,
      config: this.getCurrentConfig(),
      basePath: this.getAssetBasePath(),
      cdnPath: this.getCDNBasePath()
    };
  }
}