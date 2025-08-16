// Mobile-Specific Asset Optimization System
import {
  AssetConfig,
  AssetLoaderConfig,
  DeviceCapabilities,
  CompressionFormat,
  AssetPriority,
  AssetType
} from '../../types/assets/AssetTypes';

interface OptimizationProfile {
  name: string;
  memoryLimit: number;
  maxConcurrentLoads: number;
  qualityMultiplier: number;
  enableStreaming: boolean;
  compressionAggression: number;
  textureMaxSize: number;
  audioQuality: number;
}

interface AdaptiveQualitySettings {
  baseQuality: number;
  connectionMultiplier: number;
  memoryMultiplier: number;
  batteryMultiplier: number;
  performanceMultiplier: number;
}

export class MobileOptimizer {
  private deviceCapabilities: DeviceCapabilities;
  private currentProfile: OptimizationProfile;
  private adaptiveSettings: AdaptiveQualitySettings;
  private performanceMetrics: {
    averageLoadTime: number;
    memoryPressure: number;
    batteryLevel: number;
    connectionSpeed: number;
    frameRate: number;
  };

  private profiles: Map<string, OptimizationProfile> = new Map();

  constructor(deviceCapabilities: DeviceCapabilities) {
    this.deviceCapabilities = deviceCapabilities;
    this.initializeProfiles();
    this.currentProfile = this.selectOptimalProfile();
    this.adaptiveSettings = this.initializeAdaptiveSettings();
    this.performanceMetrics = this.initializeMetrics();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  private initializeProfiles(): void {
    // Ultra-low profile for very limited devices
    this.profiles.set('ultra-low', {
      name: 'Ultra Low',
      memoryLimit: 64 * 1024 * 1024, // 64MB
      maxConcurrentLoads: 1,
      qualityMultiplier: 0.3,
      enableStreaming: false,
      compressionAggression: 0.1,
      textureMaxSize: 256,
      audioQuality: 0.3
    });

    // Low profile for basic mobile devices
    this.profiles.set('low', {
      name: 'Low',
      memoryLimit: 128 * 1024 * 1024, // 128MB
      maxConcurrentLoads: 2,
      qualityMultiplier: 0.5,
      enableStreaming: true,
      compressionAggression: 0.2,
      textureMaxSize: 512,
      audioQuality: 0.5
    });

    // Medium profile for mid-range devices
    this.profiles.set('medium', {
      name: 'Medium',
      memoryLimit: 256 * 1024 * 1024, // 256MB
      maxConcurrentLoads: 3,
      qualityMultiplier: 0.7,
      enableStreaming: true,
      compressionAggression: 0.4,
      textureMaxSize: 1024,
      audioQuality: 0.7
    });

    // High profile for flagship mobile devices
    this.profiles.set('high', {
      name: 'High',
      memoryLimit: 512 * 1024 * 1024, // 512MB
      maxConcurrentLoads: 4,
      qualityMultiplier: 0.9,
      enableStreaming: true,
      compressionAggression: 0.6,
      textureMaxSize: 2048,
      audioQuality: 0.9
    });

    // Desktop profile for reference
    this.profiles.set('desktop', {
      name: 'Desktop',
      memoryLimit: 1024 * 1024 * 1024, // 1GB
      maxConcurrentLoads: 8,
      qualityMultiplier: 1.0,
      enableStreaming: true,
      compressionAggression: 0.8,
      textureMaxSize: 4096,
      audioQuality: 1.0
    });
  }

  private selectOptimalProfile(): OptimizationProfile {
    if (!this.deviceCapabilities.isMobile) {
      return this.profiles.get('desktop')!;
    }

    // Score device capabilities
    let score = 0;

    // Memory score (0-3)
    const totalMemory = this.deviceCapabilities.totalMemory;
    if (totalMemory > 4 * 1024 * 1024 * 1024) score += 3; // 4GB+
    else if (totalMemory > 2 * 1024 * 1024 * 1024) score += 2; // 2GB+
    else if (totalMemory > 1024 * 1024 * 1024) score += 1; // 1GB+

    // GPU score (0-2)
    if (this.deviceCapabilities.webgl2) score += 1;
    if (this.deviceCapabilities.maxTextureSize >= 2048) score += 1;

    // Connection score (0-2)
    switch (this.deviceCapabilities.connectionType) {
      case '5g':
      case '4g':
        score += 2;
        break;
      case '3g':
        score += 1;
        break;
    }

    // Compression support score (0-2)
    if (this.deviceCapabilities.astcSupport || this.deviceCapabilities.etc2Support) score += 1;
    if (this.deviceCapabilities.s3tcSupport) score += 1;

    // Select profile based on score
    if (score >= 7) return this.profiles.get('high')!;
    if (score >= 5) return this.profiles.get('medium')!;
    if (score >= 3) return this.profiles.get('low')!;
    return this.profiles.get('ultra-low')!;
  }

  private initializeAdaptiveSettings(): AdaptiveQualitySettings {
    return {
      baseQuality: this.currentProfile.qualityMultiplier,
      connectionMultiplier: this.getConnectionMultiplier(),
      memoryMultiplier: 1.0,
      batteryMultiplier: 1.0,
      performanceMultiplier: 1.0
    };
  }

  private getConnectionMultiplier(): number {
    switch (this.deviceCapabilities.connectionType) {
      case 'slow-2g': return 0.3;
      case '2g': return 0.5;
      case '3g': return 0.7;
      case '4g': return 1.0;
      case '5g': return 1.2;
      default: return 0.8;
    }
  }

  private initializeMetrics(): typeof this.performanceMetrics {
    return {
      averageLoadTime: 0,
      memoryPressure: 0,
      batteryLevel: this.getBatteryLevel(),
      connectionSpeed: 0,
      frameRate: 60
    };
  }

  private getBatteryLevel(): number {
    if ('getBattery' in navigator) {
      // Modern battery API (if available)
      (navigator as any).getBattery().then((battery: any) => {
        return battery.level * 100;
      }).catch(() => 100); // Default to 100% if unavailable
    }
    return 100; // Default assumption
  }

  private startPerformanceMonitoring(): void {
    // Monitor memory pressure
    setInterval(() => {
      if ((performance as any).memory) {
        const memInfo = (performance as any).memory;
        this.performanceMetrics.memoryPressure = 
          memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
        
        this.updateAdaptiveSettings();
      }
    }, 5000);

    // Monitor frame rate
    let lastFrameTime = performance.now();
    let frameCount = 0;
    
    const measureFrameRate = () => {
      const currentTime = performance.now();
      frameCount++;
      
      if (currentTime - lastFrameTime >= 1000) {
        this.performanceMetrics.frameRate = frameCount;
        frameCount = 0;
        lastFrameTime = currentTime;
        
        this.updateAdaptiveSettings();
      }
      
      requestAnimationFrame(measureFrameRate);
    };
    
    requestAnimationFrame(measureFrameRate);

    // Monitor battery level (if available)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        battery.addEventListener('levelchange', () => {
          this.performanceMetrics.batteryLevel = battery.level * 100;
          this.updateAdaptiveSettings();
        });
      });
    }
  }

  private updateAdaptiveSettings(): void {
    // Update multipliers based on current performance
    this.adaptiveSettings.memoryMultiplier = Math.max(0.3, 1.0 - this.performanceMetrics.memoryPressure);
    this.adaptiveSettings.batteryMultiplier = Math.max(0.5, this.performanceMetrics.batteryLevel / 100);
    this.adaptiveSettings.performanceMultiplier = Math.max(0.4, this.performanceMetrics.frameRate / 60);

    // Consider switching profiles if performance is consistently poor
    if (this.shouldDowngradeProfile()) {
      this.downgradeProfile();
    } else if (this.shouldUpgradeProfile()) {
      this.upgradeProfile();
    }
  }

  private shouldDowngradeProfile(): boolean {
    return (
      this.performanceMetrics.memoryPressure > 0.9 ||
      this.performanceMetrics.frameRate < 30 ||
      this.performanceMetrics.batteryLevel < 20
    );
  }

  private shouldUpgradeProfile(): boolean {
    return (
      this.performanceMetrics.memoryPressure < 0.6 &&
      this.performanceMetrics.frameRate > 55 &&
      this.performanceMetrics.batteryLevel > 50
    );
  }

  private downgradeProfile(): void {
    const profiles = ['high', 'medium', 'low', 'ultra-low'];
    const currentIndex = profiles.indexOf(this.getProfileKey());
    
    if (currentIndex < profiles.length - 1) {
      this.currentProfile = this.profiles.get(profiles[currentIndex + 1])!;
      console.log(`Downgraded to ${this.currentProfile.name} profile`);
    }
  }

  private upgradeProfile(): void {
    const profiles = ['ultra-low', 'low', 'medium', 'high'];
    const currentIndex = profiles.indexOf(this.getProfileKey());
    
    if (currentIndex < profiles.length - 1) {
      this.currentProfile = this.profiles.get(profiles[currentIndex + 1])!;
      console.log(`Upgraded to ${this.currentProfile.name} profile`);
    }
  }

  private getProfileKey(): string {
    for (const [key, profile] of this.profiles) {
      if (profile === this.currentProfile) {
        return key;
      }
    }
    return 'low';
  }

  // Public optimization methods
  optimizeAssetConfig(config: AssetConfig): AssetConfig {
    const optimized = { ...config };

    // Apply quality multiplier
    if (optimized.compression) {
      optimized.compression.quality *= this.getCurrentQualityMultiplier();
      optimized.compression.quality = Math.max(0.1, Math.min(1.0, optimized.compression.quality));
    }

    // Optimize compression format selection
    optimized.compression = this.optimizeCompressionConfig(optimized.compression);

    // Adjust priority based on current conditions
    optimized.priority = this.adjustPriority(optimized.priority);

    // Enable/disable streaming based on profile
    if (!this.currentProfile.enableStreaming) {
      optimized.streaming = false;
    }

    return optimized;
  }

  private getCurrentQualityMultiplier(): number {
    return this.adaptiveSettings.baseQuality *
           this.adaptiveSettings.connectionMultiplier *
           this.adaptiveSettings.memoryMultiplier *
           this.adaptiveSettings.batteryMultiplier *
           this.adaptiveSettings.performanceMultiplier;
  }

  private optimizeCompressionConfig(compression: any): any {
    if (!compression) return compression;

    const optimized = { ...compression };

    // Prefer more aggressive compression on mobile
    if (this.deviceCapabilities.isMobile) {
      optimized.quality *= this.currentProfile.compressionAggression;
      
      // Reorder formats to prefer smaller file sizes
      if (optimized.formats) {
        optimized.formats = this.reorderFormatsForMobile(optimized.formats);
      }
    }

    return optimized;
  }

  private reorderFormatsForMobile(formats: CompressionFormat[]): CompressionFormat[] {
    const mobilePreferred = [
      CompressionFormat.ASTC,
      CompressionFormat.ETC2,
      CompressionFormat.WEBP,
      CompressionFormat.OPUS,
      CompressionFormat.OGG,
      CompressionFormat.JPEG,
      CompressionFormat.MP3,
      CompressionFormat.S3TC,
      CompressionFormat.PNG,
      CompressionFormat.AAC,
      CompressionFormat.WAV
    ];

    return formats.sort((a, b) => {
      const aIndex = mobilePreferred.indexOf(a);
      const bIndex = mobilePreferred.indexOf(b);
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  }

  private adjustPriority(priority: AssetPriority): AssetPriority {
    // Under memory pressure, only load critical assets
    if (this.performanceMetrics.memoryPressure > 0.8) {
      return priority <= AssetPriority.HIGH ? AssetPriority.CRITICAL : AssetPriority.BACKGROUND;
    }

    // On low battery, defer non-essential assets
    if (this.performanceMetrics.batteryLevel < 30) {
      return priority <= AssetPriority.CRITICAL ? priority : AssetPriority.BACKGROUND;
    }

    return priority;
  }

  optimizeLoaderConfig(config: AssetLoaderConfig): AssetLoaderConfig {
    return {
      ...config,
      maxConcurrentLoads: this.currentProfile.maxConcurrentLoads,
      memoryLimit: this.currentProfile.memoryLimit,
      enableStreaming: this.currentProfile.enableStreaming,
      mobileOptimizations: this.deviceCapabilities.isMobile,
      adaptiveQuality: true
    };
  }

  // Texture-specific optimizations
  getOptimalTextureSize(originalWidth: number, originalHeight: number): { width: number; height: number } {
    const maxSize = this.currentProfile.textureMaxSize;
    const qualityMultiplier = this.getCurrentQualityMultiplier();
    
    let width = Math.floor(originalWidth * qualityMultiplier);
    let height = Math.floor(originalHeight * qualityMultiplier);
    
    // Ensure power of 2 for better GPU compatibility
    width = this.nearestPowerOfTwo(Math.min(width, maxSize));
    height = this.nearestPowerOfTwo(Math.min(height, maxSize));
    
    return { width, height };
  }

  private nearestPowerOfTwo(value: number): number {
    return Math.pow(2, Math.round(Math.log2(value)));
  }

  // Audio-specific optimizations
  getOptimalAudioQuality(): number {
    return this.currentProfile.audioQuality * this.getCurrentQualityMultiplier();
  }

  shouldUseMonoAudio(): boolean {
    return this.currentProfile.qualityMultiplier < 0.5 || this.performanceMetrics.memoryPressure > 0.7;
  }

  getOptimalSampleRate(): number {
    const baseRate = 44100;
    const qualityMultiplier = this.getCurrentQualityMultiplier();
    
    if (qualityMultiplier < 0.4) return 22050;
    if (qualityMultiplier < 0.7) return 32000;
    return baseRate;
  }

  // Memory management optimizations
  shouldPreloadAsset(config: AssetConfig): boolean {
    // Don't preload non-critical assets under memory pressure
    if (this.performanceMetrics.memoryPressure > 0.7) {
      return config.priority <= AssetPriority.CRITICAL;
    }

    // On low battery, minimize preloading
    if (this.performanceMetrics.batteryLevel < 30) {
      return config.priority === AssetPriority.CRITICAL;
    }

    return config.preload === true;
  }

  getMemoryPoolSize(poolId: string): number {
    const baseSize = this.currentProfile.memoryLimit;
    
    switch (poolId) {
      case 'critical':
        return Math.floor(baseSize * 0.3);
      case 'gameplay':
        return Math.floor(baseSize * 0.5);
      case 'background':
        return Math.floor(baseSize * 0.2);
      default:
        return Math.floor(baseSize * 0.1);
    }
  }

  // Performance monitoring getters
  getCurrentProfile(): OptimizationProfile {
    return { ...this.currentProfile };
  }

  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  getAdaptiveSettings(): AdaptiveQualitySettings {
    return { ...this.adaptiveSettings };
  }

  // Manual profile override
  setProfile(profileName: string): boolean {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      console.warn(`Profile ${profileName} not found`);
      return false;
    }

    this.currentProfile = profile;
    this.adaptiveSettings.baseQuality = profile.qualityMultiplier;
    console.log(`Manually set profile to ${profile.name}`);
    return true;
  }

  // Debugging and diagnostics
  generateOptimizationReport(): string {
    const report = {
      device: this.deviceCapabilities,
      currentProfile: this.currentProfile.name,
      performance: this.performanceMetrics,
      adaptiveSettings: this.adaptiveSettings,
      recommendations: this.generateRecommendations()
    };

    return JSON.stringify(report, null, 2);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.performanceMetrics.memoryPressure > 0.8) {
      recommendations.push('High memory pressure detected - consider reducing asset quality');
    }

    if (this.performanceMetrics.frameRate < 30) {
      recommendations.push('Low frame rate detected - consider downgrading visual quality');
    }

    if (this.performanceMetrics.batteryLevel < 20) {
      recommendations.push('Low battery detected - consider reducing background asset loading');
    }

    if (this.deviceCapabilities.connectionType === 'slow-2g' || this.deviceCapabilities.connectionType === '2g') {
      recommendations.push('Slow connection detected - consider more aggressive compression');
    }

    if (!this.deviceCapabilities.webgl2) {
      recommendations.push('WebGL2 not supported - consider fallback rendering strategies');
    }

    return recommendations;
  }
}