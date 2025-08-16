import type { RenderCapabilities, RenderSettings } from '@/types';

export class PerformanceAdapter {
  private capabilities: RenderCapabilities;
  private currentSettings: RenderSettings;
  private targetFPS = 60;
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private lastAdjustmentTime = 0;
  private adjustmentCooldown = 5000; // 5 seconds
  private qualityLevel: 'low' | 'medium' | 'high' | 'ultra' = 'medium';
  private adaptiveQualityEnabled = true;
  
  // Performance thresholds
  private readonly PERFORMANCE_THRESHOLDS = {
    LOW_FPS: 45,
    HIGH_FPS: 58,
    FRAME_TIME_BUDGET: 16.67, // 60fps = 16.67ms per frame
    MEMORY_PRESSURE_THRESHOLD: 80, // Percentage
    GPU_UTILIZATION_THRESHOLD: 90 // Percentage
  };
  
  // Quality presets
  private readonly QUALITY_PRESETS = {
    low: {
      shadowMapSize: 512,
      enableShadows: false,
      enableSSAO: false,
      enableAntialiasing: false,
      enableTextureLOD: true,
      enableInstancing: true,
      cullingDistance: 100,
      lodLevels: 2,
      textureQuality: 'low' as const,
      shaderPrecision: 'mediump' as const
    },
    medium: {
      shadowMapSize: 1024,
      enableShadows: true,
      enableSSAO: false,
      enableAntialiasing: false,
      enableTextureLOD: true,
      enableInstancing: true,
      cullingDistance: 150,
      lodLevels: 3,
      textureQuality: 'medium' as const,
      shaderPrecision: 'mediump' as const
    },
    high: {
      shadowMapSize: 2048,
      enableShadows: true,
      enableSSAO: true,
      enableAntialiasing: true,
      enableTextureLOD: true,
      enableInstancing: true,
      cullingDistance: 200,
      lodLevels: 4,
      textureQuality: 'high' as const,
      shaderPrecision: 'highp' as const
    },
    ultra: {
      shadowMapSize: 4096,
      enableShadows: true,
      enableSSAO: true,
      enableAntialiasing: true,
      enableTextureLOD: true,
      enableInstancing: true,
      cullingDistance: 300,
      lodLevels: 5,
      textureQuality: 'high' as const,
      shaderPrecision: 'highp' as const
    }
  };

  constructor(capabilities: RenderCapabilities) {
    this.capabilities = capabilities;
    this.qualityLevel = this.determineInitialQuality();
    this.currentSettings = this.getQualitySettings(this.qualityLevel);
    
    console.log('PerformanceAdapter initialized:', {
      initialQuality: this.qualityLevel,
      capabilities: this.capabilities
    });
  }

  private determineInitialQuality(): 'low' | 'medium' | 'high' | 'ultra' {
    // Mobile devices default to lower quality
    if (this.capabilities.isMobile) {
      return this.capabilities.isHighEndDevice ? 'medium' : 'low';
    }
    
    // Desktop quality based on capabilities
    if (this.capabilities.hasWebGPU && this.capabilities.isHighEndDevice) {
      return 'ultra';
    } else if (this.capabilities.hasWebGL2 && this.capabilities.isHighEndDevice) {
      return 'high';
    } else if (this.capabilities.hasWebGL2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private getQualitySettings(quality: 'low' | 'medium' | 'high' | 'ultra'): RenderSettings {
    const baseSettings = { ...this.QUALITY_PRESETS[quality] };
    
    // Apply device-specific adjustments
    this.applyDeviceSpecificAdjustments(baseSettings);
    
    return baseSettings;
  }

  private applyDeviceSpecificAdjustments(settings: RenderSettings): void {
    // Mobile-specific adjustments
    if (this.capabilities.isMobile) {
      // Reduce shadow quality on mobile
      settings.shadowMapSize = Math.min(settings.shadowMapSize, 1024);
      
      // Disable expensive effects on low-end mobile
      if (!this.capabilities.isHighEndDevice) {
        settings.enableSSAO = false;
        settings.enableAntialiasing = false;
        settings.cullingDistance = Math.min(settings.cullingDistance, 100);
        settings.lodLevels = Math.min(settings.lodLevels, 2);
      }
      
      // Use lower precision on mobile
      if (settings.shaderPrecision === 'highp') {
        settings.shaderPrecision = 'mediump';
      }
    }
    
    // Low texture memory adjustments
    if (this.capabilities.maxTextureSize < 4096) {
      settings.shadowMapSize = Math.min(settings.shadowMapSize, 1024);
      settings.textureQuality = 'low';
    }
    
    // WebGL1 limitations
    if (!this.capabilities.hasWebGL2) {
      settings.enableInstancing = false;
      settings.shaderPrecision = 'mediump';
      settings.enableSSAO = false;
    }
    
    // Limited texture units
    if (this.capabilities.maxTextures < 16) {
      settings.enableTextureLOD = false;
    }
  }

  update(deltaTime: number): void {
    const currentFPS = 1000 / deltaTime;
    const frameTime = deltaTime;
    
    // Track performance history
    this.fpsHistory.push(currentFPS);
    this.frameTimeHistory.push(frameTime);
    
    // Keep only recent history (last 60 frames)
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
      this.frameTimeHistory.shift();
    }
    
    // Update performance tracking
    this.updatePerformanceMetrics();
  }

  private updatePerformanceMetrics(): void {
    if (this.fpsHistory.length < 30) return; // Need enough samples
    
    const avgFPS = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length;
    
    // Detect performance issues
    const hasLowFPS = avgFPS < this.PERFORMANCE_THRESHOLDS.LOW_FPS;
    const hasHighFrameTime = avgFrameTime > this.PERFORMANCE_THRESHOLDS.FRAME_TIME_BUDGET * 1.2;
    
    // Memory pressure detection (if available)
    const memoryPressure = this.detectMemoryPressure();
    
    // Store metrics for decision making
    this.lastPerformanceMetrics = {
      avgFPS,
      avgFrameTime,
      hasLowFPS,
      hasHighFrameTime,
      memoryPressure,
      timestamp: Date.now()
    };
  }

  private lastPerformanceMetrics: {
    avgFPS: number;
    avgFrameTime: number;
    hasLowFPS: boolean;
    hasHighFrameTime: boolean;
    memoryPressure: number;
    timestamp: number;
  } | null = null;

  shouldAdjustQuality(): boolean {
    if (!this.adaptiveQualityEnabled) return false;
    if (!this.lastPerformanceMetrics) return false;
    
    const now = Date.now();
    const timeSinceLastAdjustment = now - this.lastAdjustmentTime;
    
    // Respect cooldown period
    if (timeSinceLastAdjustment < this.adjustmentCooldown) {
      return false;
    }
    
    const metrics = this.lastPerformanceMetrics;
    
    // Check if quality adjustment is needed
    const needsDowngrade = metrics.hasLowFPS || metrics.hasHighFrameTime || metrics.memoryPressure > 0.8;
    const canUpgrade = metrics.avgFPS > this.PERFORMANCE_THRESHOLDS.HIGH_FPS && 
                      metrics.avgFrameTime < this.PERFORMANCE_THRESHOLDS.FRAME_TIME_BUDGET * 0.8 &&
                      metrics.memoryPressure < 0.6;
    
    if (needsDowngrade && this.qualityLevel !== 'low') {
      console.log('Performance degradation detected, considering quality downgrade', metrics);
      return true;
    }
    
    if (canUpgrade && this.qualityLevel !== 'ultra') {
      console.log('Performance headroom detected, considering quality upgrade', metrics);
      return true;
    }
    
    return false;
  }

  getOptimalSettings(): RenderSettings {
    if (this.shouldAdjustQuality()) {
      this.adjustQuality();
    }
    
    return { ...this.currentSettings };
  }

  private adjustQuality(): void {
    const metrics = this.lastPerformanceMetrics;
    if (!metrics) return;
    
    const oldQuality = this.qualityLevel;
    
    // Determine new quality level
    if (metrics.hasLowFPS || metrics.hasHighFrameTime || metrics.memoryPressure > 0.8) {
      // Downgrade quality
      switch (this.qualityLevel) {
        case 'ultra':
          this.qualityLevel = 'high';
          break;
        case 'high':
          this.qualityLevel = 'medium';
          break;
        case 'medium':
          this.qualityLevel = 'low';
          break;
        // Already at low, can't go lower
      }
    } else if (metrics.avgFPS > this.PERFORMANCE_THRESHOLDS.HIGH_FPS && 
               metrics.avgFrameTime < this.PERFORMANCE_THRESHOLDS.FRAME_TIME_BUDGET * 0.8 &&
               metrics.memoryPressure < 0.6) {
      // Upgrade quality
      switch (this.qualityLevel) {
        case 'low':
          this.qualityLevel = 'medium';
          break;
        case 'medium':
          this.qualityLevel = 'high';
          break;
        case 'high':
          this.qualityLevel = 'ultra';
          break;
        // Already at ultra, can't go higher
      }
    }
    
    if (this.qualityLevel !== oldQuality) {
      console.log(`Quality adjusted: ${oldQuality} -> ${this.qualityLevel}`, metrics);
      this.currentSettings = this.getQualitySettings(this.qualityLevel);
      this.lastAdjustmentTime = Date.now();
      
      // Clear history to avoid oscillation
      this.fpsHistory = [];
      this.frameTimeHistory = [];
    }
  }

  private detectMemoryPressure(): number {
    try {
      // Use memory API if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize;
        const limit = memory.jsHeapSizeLimit;
        return used / limit;
      }
      
      // Fallback: estimate based on device capabilities
      if (this.capabilities.isMobile && !this.capabilities.isHighEndDevice) {
        return 0.6; // Assume higher memory pressure on low-end mobile
      }
      
      return 0.3; // Conservative estimate for other devices
      
    } catch (error) {
      console.warn('Failed to detect memory pressure:', error);
      return 0.5; // Default assumption
    }
  }

  // Manual quality control
  setQualityLevel(level: 'low' | 'medium' | 'high' | 'ultra'): void {
    if (level === this.qualityLevel) return;
    
    console.log(`Manual quality change: ${this.qualityLevel} -> ${level}`);
    this.qualityLevel = level;
    this.currentSettings = this.getQualitySettings(level);
    this.lastAdjustmentTime = Date.now();
    
    // Clear history
    this.fpsHistory = [];
    this.frameTimeHistory = [];
  }

  enableAdaptiveQuality(enabled: boolean): void {
    this.adaptiveQualityEnabled = enabled;
    console.log(`Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Getters
  getCurrentQuality(): 'low' | 'medium' | 'high' | 'ultra' {
    return this.qualityLevel;
  }

  getPerformanceMetrics(): any {
    return this.lastPerformanceMetrics;
  }

  isAdaptiveQualityEnabled(): boolean {
    return this.adaptiveQualityEnabled;
  }

  // Advanced optimization features
  enableTemporalUpsampling(): boolean {
    // Temporal upsampling for mobile devices
    return this.capabilities.isMobile && this.capabilities.isHighEndDevice;
  }

  enableVariableRateShading(): boolean {
    // VRS support detection (WebGPU feature)
    return this.capabilities.hasWebGPU;
  }

  enableAsyncCompute(): boolean {
    // Async compute for compute shaders
    return this.capabilities.hasComputeShaders;
  }

  getRecommendedWorkerCount(): number {
    // Recommend worker count based on CPU cores
    const cores = navigator.hardwareConcurrency || 4;
    
    if (this.capabilities.isMobile) {
      return Math.min(2, Math.max(1, cores - 2)); // Leave cores for main thread
    }
    
    return Math.min(4, Math.max(1, cores - 1)); // Leave one core for main thread
  }

  getTextureCompressionFormat(): string | null {
    // Return best supported texture compression format
    const formats = this.capabilities.supportedTextureFormats;
    
    if (formats.includes('ASTC')) return 'ASTC';
    if (formats.includes('ETC2')) return 'ETC2';
    if (formats.includes('DXT5')) return 'DXT5';
    if (formats.includes('DXT1')) return 'DXT1';
    
    return null; // No compression support
  }

  // Thermal throttling detection (mobile)
  detectThermalThrottling(): boolean {
    if (!this.capabilities.isMobile) return false;
    
    // Heuristic: significant FPS drop over time
    if (this.fpsHistory.length < 60) return false;
    
    const recent = this.fpsHistory.slice(-10);
    const older = this.fpsHistory.slice(-60, -50);
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b) / older.length;
    
    // If recent performance is significantly worse, might be thermal throttling
    return recentAvg < olderAvg * 0.8;
  }

  // Battery optimization
  enableBatteryOptimizations(): void {
    if (this.capabilities.isMobile) {
      // Reduce quality when not charging
      navigator.getBattery?.().then(battery => {
        battery.addEventListener('chargingchange', () => {
          if (!battery.charging && this.qualityLevel !== 'low') {
            console.log('Switching to battery optimization mode');
            this.setQualityLevel('low');
          }
        });
      }).catch(() => {
        // Battery API not supported
      });
    }
  }

  // Cleanup
  destroy(): void {
    console.log('PerformanceAdapter destroyed');
    this.fpsHistory = [];
    this.frameTimeHistory = [];
    this.lastPerformanceMetrics = null;
  }
}