/**
 * Mobile Optimizer - Advanced mobile performance optimization system
 * Handles device capability detection, thermal management, and adaptive quality
 */

import { PerformanceAdapter } from '@/rendering/PerformanceAdapter';
import { PerformanceDashboard } from '../PerformanceDashboard';

interface DeviceCapabilities {
  // Hardware information
  deviceType: 'smartphone' | 'tablet' | 'desktop' | 'unknown';
  tier: 'low' | 'mid' | 'high' | 'flagship';
  
  // CPU information
  cpuCores: number;
  estimatedCPUSpeed: number; // Rough estimation
  
  // Memory information
  totalMemory: number; // GB
  availableMemory: number; // GB
  
  // GPU information
  gpu: string;
  maxTextureSize: number;
  supportsFloat: boolean;
  supportsHalfFloat: boolean;
  
  // Display information
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  supportsHDR: boolean;
  
  // Network information
  connectionType: string;
  effectiveType: string;
  downlink: number; // Mbps
  
  // Battery information
  batteryLevel?: number;
  isCharging?: boolean;
  
  // Thermal information
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  
  // Feature support
  supportsWebGL2: boolean;
  supportsWebGPU: boolean;
  supportsOffscreenCanvas: boolean;
  supportsSharedArrayBuffer: boolean;
  supportsWebAssembly: boolean;
  
  // Touch capabilities
  maxTouchPoints: number;
  touchLatency: number; // ms
}

interface OptimizationSettings {
  // Rendering settings
  targetFPS: number;
  maxRenderDistance: number;
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  textureQuality: 'low' | 'medium' | 'high';
  antialiasing: boolean;
  postProcessing: boolean;
  
  // Entity management
  maxEntities: number;
  cullingDistance: number;
  lodLevels: number;
  
  // Physics settings
  physicsSteps: number;
  collisionPrecision: 'low' | 'medium' | 'high';
  
  // Audio settings
  audioQuality: 'low' | 'medium' | 'high';
  maxAudioSources: number;
  
  // Memory management
  textureMemoryLimit: number; // MB
  geometryMemoryLimit: number; // MB
  
  // Battery optimization
  batteryOptimizationMode: boolean;
  thermalThrottling: boolean;
}

interface PerformanceProfile {
  name: string;
  description: string;
  settings: OptimizationSettings;
  minRequirements: Partial<DeviceCapabilities>;
}

export class MobileOptimizer {
  private capabilities: DeviceCapabilities;
  private currentSettings: OptimizationSettings;
  private currentProfile: PerformanceProfile;
  private performanceAdapter: PerformanceAdapter;
  private dashboard: PerformanceDashboard;
  
  // Monitoring state
  private monitoring = false;
  private thermalMonitorInterval?: number;
  private batteryMonitorInterval?: number;
  private performanceMonitorInterval?: number;
  
  // Performance tracking
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private thermalHistory: string[] = [];
  private lastOptimizationTime = 0;
  private optimizationCooldown = 10000; // 10 seconds
  
  // Predefined performance profiles
  private readonly PERFORMANCE_PROFILES: PerformanceProfile[] = [
    {
      name: 'Ultra Low',
      description: 'Maximum battery life and thermal management',
      settings: {
        targetFPS: 20,
        maxRenderDistance: 50,
        shadowQuality: 'off',
        textureQuality: 'low',
        antialiasing: false,
        postProcessing: false,
        maxEntities: 50,
        cullingDistance: 30,
        lodLevels: 2,
        physicsSteps: 30,
        collisionPrecision: 'low',
        audioQuality: 'low',
        maxAudioSources: 4,
        textureMemoryLimit: 32,
        geometryMemoryLimit: 16,
        batteryOptimizationMode: true,
        thermalThrottling: true
      },
      minRequirements: {
        tier: 'low',
        totalMemory: 1
      }
    },
    {
      name: 'Low',
      description: 'Optimized for older devices',
      settings: {
        targetFPS: 30,
        maxRenderDistance: 100,
        shadowQuality: 'low',
        textureQuality: 'low',
        antialiasing: false,
        postProcessing: false,
        maxEntities: 100,
        cullingDistance: 75,
        lodLevels: 3,
        physicsSteps: 45,
        collisionPrecision: 'low',
        audioQuality: 'medium',
        maxAudioSources: 8,
        textureMemoryLimit: 64,
        geometryMemoryLimit: 32,
        batteryOptimizationMode: true,
        thermalThrottling: true
      },
      minRequirements: {
        tier: 'low',
        totalMemory: 2
      }
    },
    {
      name: 'Medium',
      description: 'Balanced performance and quality',
      settings: {
        targetFPS: 45,
        maxRenderDistance: 150,
        shadowQuality: 'medium',
        textureQuality: 'medium',
        antialiasing: false,
        postProcessing: true,
        maxEntities: 200,
        cullingDistance: 100,
        lodLevels: 3,
        physicsSteps: 60,
        collisionPrecision: 'medium',
        audioQuality: 'medium',
        maxAudioSources: 12,
        textureMemoryLimit: 128,
        geometryMemoryLimit: 64,
        batteryOptimizationMode: false,
        thermalThrottling: true
      },
      minRequirements: {
        tier: 'mid',
        totalMemory: 3
      }
    },
    {
      name: 'High',
      description: 'High-end mobile devices',
      settings: {
        targetFPS: 60,
        maxRenderDistance: 200,
        shadowQuality: 'high',
        textureQuality: 'high',
        antialiasing: true,
        postProcessing: true,
        maxEntities: 400,
        cullingDistance: 150,
        lodLevels: 4,
        physicsSteps: 60,
        collisionPrecision: 'high',
        audioQuality: 'high',
        maxAudioSources: 16,
        textureMemoryLimit: 256,
        geometryMemoryLimit: 128,
        batteryOptimizationMode: false,
        thermalThrottling: true
      },
      minRequirements: {
        tier: 'high',
        totalMemory: 6
      }
    },
    {
      name: 'Flagship',
      description: 'Latest flagship devices',
      settings: {
        targetFPS: 90,
        maxRenderDistance: 300,
        shadowQuality: 'high',
        textureQuality: 'high',
        antialiasing: true,
        postProcessing: true,
        maxEntities: 800,
        cullingDistance: 200,
        lodLevels: 5,
        physicsSteps: 90,
        collisionPrecision: 'high',
        audioQuality: 'high',
        maxAudioSources: 24,
        textureMemoryLimit: 512,
        geometryMemoryLimit: 256,
        batteryOptimizationMode: false,
        thermalThrottling: false
      },
      minRequirements: {
        tier: 'flagship',
        totalMemory: 8
      }
    }
  ];

  constructor(performanceAdapter: PerformanceAdapter, dashboard: PerformanceDashboard) {
    this.performanceAdapter = performanceAdapter;
    this.dashboard = dashboard;
    
    this.capabilities = this.detectDeviceCapabilities();
    this.currentProfile = this.selectOptimalProfile();
    this.currentSettings = { ...this.currentProfile.settings };
    
    console.log('Mobile Optimizer initialized', {
      capabilities: this.capabilities,
      profile: this.currentProfile.name
    });
  }

  private detectDeviceCapabilities(): DeviceCapabilities {
    const userAgent = navigator.userAgent;
    const isMobile = /Mobi|Android/i.test(userAgent) || 'ontouchstart' in window;
    const isTablet = /iPad|Tablet/i.test(userAgent) || (isMobile && Math.min(screen.width, screen.height) > 768);
    
    // Device type detection
    let deviceType: DeviceCapabilities['deviceType'] = 'desktop';
    if (isTablet) deviceType = 'tablet';
    else if (isMobile) deviceType = 'smartphone';
    
    // Hardware detection
    const cpuCores = navigator.hardwareConcurrency || 4;
    const totalMemory = (navigator as any).deviceMemory || (isMobile ? 4 : 8);
    
    // GPU detection
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const gpu = gl ? (gl.getParameter(gl.RENDERER) || 'Unknown') : 'No WebGL';
    const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048;
    
    // Feature detection
    const supportsFloat = gl ? !!gl.getExtension('OES_texture_float') : false;
    const supportsHalfFloat = gl ? !!gl.getExtension('OES_texture_half_float') : false;
    const supportsWebGL2 = !!document.createElement('canvas').getContext('webgl2');
    const supportsWebGPU = 'gpu' in navigator;
    
    // Network detection
    const connection = (navigator as any).connection || {};
    const connectionType = connection.type || 'unknown';
    const effectiveType = connection.effectiveType || '4g';
    const downlink = connection.downlink || 10;
    
    // Display information
    const screenWidth = screen.width;
    const screenHeight = screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Touch capabilities
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    
    // Device tier estimation
    const tier = this.estimateDeviceTier(cpuCores, totalMemory, gpu, isMobile);
    
    return {
      deviceType,
      tier,
      cpuCores,
      estimatedCPUSpeed: this.estimateCPUSpeed(cpuCores, tier),
      totalMemory,
      availableMemory: totalMemory * 0.7, // Rough estimate
      gpu: gpu.toString(),
      maxTextureSize,
      supportsFloat,
      supportsHalfFloat,
      screenWidth,
      screenHeight,
      pixelRatio,
      supportsHDR: (screen as any).colorDepth > 24,
      connectionType,
      effectiveType,
      downlink,
      thermalState: 'nominal',
      supportsWebGL2,
      supportsWebGPU,
      supportsOffscreenCanvas: 'OffscreenCanvas' in window,
      supportsSharedArrayBuffer: 'SharedArrayBuffer' in window,
      supportsWebAssembly: 'WebAssembly' in window,
      maxTouchPoints,
      touchLatency: this.measureTouchLatency()
    };\n  }\n\n  private estimateDeviceTier(\n    cpuCores: number,\n    memory: number,\n    gpu: string,\n    isMobile: boolean\n  ): DeviceCapabilities['tier'] {\n    \n    if (!isMobile) {\n      // Desktop classification\n      if (cpuCores >= 8 && memory >= 16) return 'flagship';\n      if (cpuCores >= 6 && memory >= 8) return 'high';\n      if (cpuCores >= 4 && memory >= 4) return 'mid';\n      return 'low';\n    }\n    \n    // Mobile classification based on various factors\n    let score = 0;\n    \n    // CPU score\n    if (cpuCores >= 8) score += 3;\n    else if (cpuCores >= 6) score += 2;\n    else if (cpuCores >= 4) score += 1;\n    \n    // Memory score\n    if (memory >= 12) score += 3;\n    else if (memory >= 8) score += 2;\n    else if (memory >= 6) score += 1;\n    \n    // GPU score (rough heuristics)\n    const gpuLower = gpu.toLowerCase();\n    if (gpuLower.includes('adreno 7') || gpuLower.includes('apple a17') || gpuLower.includes('apple a16')) {\n      score += 3;\n    } else if (gpuLower.includes('adreno 6') || gpuLower.includes('apple a15') || gpuLower.includes('apple a14')) {\n      score += 2;\n    } else if (gpuLower.includes('adreno 5') || gpuLower.includes('apple a13') || gpuLower.includes('mali-g')) {\n      score += 1;\n    }\n    \n    if (score >= 7) return 'flagship';\n    if (score >= 5) return 'high';\n    if (score >= 3) return 'mid';\n    return 'low';\n  }\n\n  private estimateCPUSpeed(cpuCores: number, tier: string): number {\n    // Rough CPU speed estimation in GHz\n    const baseSpeed = {\n      low: 1.5,\n      mid: 2.0,\n      high: 2.5,\n      flagship: 3.0\n    }[tier] || 2.0;\n    \n    return baseSpeed + (cpuCores - 4) * 0.1;\n  }\n\n  private measureTouchLatency(): number {\n    // Simple touch latency measurement\n    if (this.capabilities?.maxTouchPoints === 0) return 0;\n    \n    // Typical touch latencies by device tier\n    switch (this.capabilities?.tier) {\n      case 'flagship': return 8; // ~8ms\n      case 'high': return 12; // ~12ms\n      case 'mid': return 16; // ~16ms\n      case 'low': return 24; // ~24ms\n      default: return 16;\n    }\n  }\n\n  private selectOptimalProfile(): PerformanceProfile {\n    // Find the highest profile that meets device requirements\n    for (let i = this.PERFORMANCE_PROFILES.length - 1; i >= 0; i--) {\n      const profile = this.PERFORMANCE_PROFILES[i];\n      if (this.meetsRequirements(profile.minRequirements)) {\n        return profile;\n      }\n    }\n    \n    // Fallback to lowest profile\n    return this.PERFORMANCE_PROFILES[0];\n  }\n\n  private meetsRequirements(requirements: Partial<DeviceCapabilities>): boolean {\n    if (requirements.tier) {\n      const tierOrder = ['low', 'mid', 'high', 'flagship'];\n      const currentTierIndex = tierOrder.indexOf(this.capabilities.tier);\n      const requiredTierIndex = tierOrder.indexOf(requirements.tier);\n      if (currentTierIndex < requiredTierIndex) return false;\n    }\n    \n    if (requirements.totalMemory && this.capabilities.totalMemory < requirements.totalMemory) {\n      return false;\n    }\n    \n    if (requirements.cpuCores && this.capabilities.cpuCores < requirements.cpuCores) {\n      return false;\n    }\n    \n    return true;\n  }\n\n  startMonitoring(): void {\n    if (this.monitoring) return;\n    \n    this.monitoring = true;\n    console.log('Starting mobile optimization monitoring');\n    \n    // Monitor thermal state\n    this.thermalMonitorInterval = window.setInterval(() => {\n      this.updateThermalState();\n    }, 5000); // Every 5 seconds\n    \n    // Monitor battery state\n    this.batteryMonitorInterval = window.setInterval(() => {\n      this.updateBatteryState();\n    }, 10000); // Every 10 seconds\n    \n    // Monitor performance and adapt\n    this.performanceMonitorInterval = window.setInterval(() => {\n      this.updatePerformanceMetrics();\n      this.adaptiveOptimization();\n    }, 1000); // Every second\n    \n    // Listen for visibility changes\n    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));\n    \n    // Listen for orientation changes\n    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));\n  }\n\n  stopMonitoring(): void {\n    if (!this.monitoring) return;\n    \n    this.monitoring = false;\n    console.log('Stopping mobile optimization monitoring');\n    \n    if (this.thermalMonitorInterval) clearInterval(this.thermalMonitorInterval);\n    if (this.batteryMonitorInterval) clearInterval(this.batteryMonitorInterval);\n    if (this.performanceMonitorInterval) clearInterval(this.performanceMonitorInterval);\n    \n    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));\n    window.removeEventListener('orientationchange', this.handleOrientationChange.bind(this));\n  }\n\n  private updateThermalState(): void {\n    // Thermal state detection (limited on web platforms)\n    let thermalState: DeviceCapabilities['thermalState'] = 'nominal';\n    \n    // Check for performance degradation as thermal indicator\n    if (this.fpsHistory.length >= 10) {\n      const recentFps = this.fpsHistory.slice(-5);\n      const olderFps = this.fpsHistory.slice(-10, -5);\n      \n      const recentAvg = recentFps.reduce((sum, fps) => sum + fps, 0) / recentFps.length;\n      const olderAvg = olderFps.reduce((sum, fps) => sum + fps, 0) / olderFps.length;\n      \n      const degradation = (olderAvg - recentAvg) / olderAvg;\n      \n      if (degradation > 0.3) thermalState = 'critical';\n      else if (degradation > 0.2) thermalState = 'serious';\n      else if (degradation > 0.1) thermalState = 'fair';\n    }\n    \n    // iOS thermal state API (if available)\n    if ('webkitTemperature' in navigator) {\n      const temp = (navigator as any).webkitTemperature;\n      if (temp > 40) thermalState = 'critical';\n      else if (temp > 35) thermalState = 'serious';\n      else if (temp > 30) thermalState = 'fair';\n    }\n    \n    if (this.capabilities.thermalState !== thermalState) {\n      console.log(`Thermal state changed: ${this.capabilities.thermalState} -> ${thermalState}`);\n      this.capabilities.thermalState = thermalState;\n      this.handleThermalStateChange(thermalState);\n    }\n    \n    this.thermalHistory.push(thermalState);\n    if (this.thermalHistory.length > 20) {\n      this.thermalHistory.shift();\n    }\n  }\n\n  private updateBatteryState(): void {\n    if ('getBattery' in navigator) {\n      (navigator as any).getBattery().then((battery: any) => {\n        this.capabilities.batteryLevel = battery.level * 100;\n        this.capabilities.isCharging = battery.charging;\n        \n        // Handle battery optimization\n        if (!battery.charging && battery.level < 0.2) {\n          this.enableBatteryOptimization();\n        } else if (battery.charging || battery.level > 0.5) {\n          this.disableBatteryOptimization();\n        }\n      }).catch(() => {\n        // Battery API not supported\n      });\n    }\n  }\n\n  private updatePerformanceMetrics(): void {\n    const metrics = this.dashboard.getCurrentMetrics();\n    \n    this.fpsHistory.push(metrics.fps.current);\n    this.frameTimeHistory.push(metrics.frameTime.current);\n    \n    // Keep only recent history\n    if (this.fpsHistory.length > 60) {\n      this.fpsHistory.shift();\n      this.frameTimeHistory.shift();\n    }\n  }\n\n  private adaptiveOptimization(): void {\n    const now = Date.now();\n    if (now - this.lastOptimizationTime < this.optimizationCooldown) {\n      return; // Too soon since last optimization\n    }\n    \n    const metrics = this.dashboard.getCurrentMetrics();\n    const avgFps = this.fpsHistory.length > 0 ? \n      this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length : 60;\n    \n    const targetFps = this.currentSettings.targetFPS;\n    const fpsRatio = avgFps / targetFps;\n    \n    // Determine if optimization is needed\n    if (fpsRatio < 0.8) {\n      // Performance is poor, reduce quality\n      this.reduceQuality();\n      this.lastOptimizationTime = now;\n    } else if (fpsRatio > 1.2 && this.canIncreaseQuality()) {\n      // Performance is good, increase quality\n      this.increaseQuality();\n      this.lastOptimizationTime = now;\n    }\n    \n    // Handle thermal throttling\n    if (this.capabilities.thermalState === 'serious' || this.capabilities.thermalState === 'critical') {\n      this.applyThermalThrottling();\n      this.lastOptimizationTime = now;\n    }\n  }\n\n  private reduceQuality(): void {\n    console.log('Reducing quality to improve performance');\n    \n    // Reduce target FPS first\n    if (this.currentSettings.targetFPS > 20) {\n      this.currentSettings.targetFPS = Math.max(20, this.currentSettings.targetFPS - 5);\n    }\n    \n    // Reduce render distance\n    if (this.currentSettings.maxRenderDistance > 50) {\n      this.currentSettings.maxRenderDistance = Math.max(50, this.currentSettings.maxRenderDistance * 0.9);\n    }\n    \n    // Reduce entity count\n    if (this.currentSettings.maxEntities > 25) {\n      this.currentSettings.maxEntities = Math.max(25, Math.floor(this.currentSettings.maxEntities * 0.8));\n    }\n    \n    // Disable expensive features\n    if (this.currentSettings.antialiasing) {\n      this.currentSettings.antialiasing = false;\n    } else if (this.currentSettings.postProcessing) {\n      this.currentSettings.postProcessing = false;\n    } else if (this.currentSettings.shadowQuality !== 'off') {\n      const qualityLevels = ['off', 'low', 'medium', 'high'];\n      const currentIndex = qualityLevels.indexOf(this.currentSettings.shadowQuality);\n      if (currentIndex > 0) {\n        this.currentSettings.shadowQuality = qualityLevels[currentIndex - 1] as any;\n      }\n    }\n    \n    this.applySettings();\n  }\n\n  private increaseQuality(): void {\n    console.log('Increasing quality due to performance headroom');\n    \n    // Increase target FPS\n    const maxFps = this.capabilities.deviceType === 'smartphone' ? 60 : 90;\n    if (this.currentSettings.targetFPS < maxFps) {\n      this.currentSettings.targetFPS = Math.min(maxFps, this.currentSettings.targetFPS + 5);\n    }\n    \n    // Increase render distance\n    if (this.currentSettings.maxRenderDistance < this.currentProfile.settings.maxRenderDistance) {\n      this.currentSettings.maxRenderDistance = Math.min(\n        this.currentProfile.settings.maxRenderDistance,\n        this.currentSettings.maxRenderDistance * 1.1\n      );\n    }\n    \n    // Increase entity count\n    if (this.currentSettings.maxEntities < this.currentProfile.settings.maxEntities) {\n      this.currentSettings.maxEntities = Math.min(\n        this.currentProfile.settings.maxEntities,\n        Math.floor(this.currentSettings.maxEntities * 1.2)\n      );\n    }\n    \n    this.applySettings();\n  }\n\n  private canIncreaseQuality(): boolean {\n    // Check if we're below the profile's maximum settings\n    return this.currentSettings.targetFPS < this.currentProfile.settings.targetFPS ||\n           this.currentSettings.maxRenderDistance < this.currentProfile.settings.maxRenderDistance ||\n           this.currentSettings.maxEntities < this.currentProfile.settings.maxEntities;\n  }\n\n  private applyThermalThrottling(): void {\n    console.log('Applying thermal throttling');\n    \n    // Aggressive quality reduction for thermal management\n    this.currentSettings.targetFPS = Math.min(20, this.currentSettings.targetFPS);\n    this.currentSettings.maxRenderDistance = Math.min(50, this.currentSettings.maxRenderDistance);\n    this.currentSettings.maxEntities = Math.min(25, this.currentSettings.maxEntities);\n    this.currentSettings.shadowQuality = 'off';\n    this.currentSettings.antialiasing = false;\n    this.currentSettings.postProcessing = false;\n    \n    this.applySettings();\n  }\n\n  private handleThermalStateChange(newState: DeviceCapabilities['thermalState']): void {\n    switch (newState) {\n      case 'serious':\n      case 'critical':\n        if (this.currentSettings.thermalThrottling) {\n          this.applyThermalThrottling();\n        }\n        break;\n      case 'nominal':\n      case 'fair':\n        // Gradually restore performance\n        if (this.canIncreaseQuality()) {\n          setTimeout(() => this.increaseQuality(), 5000); // Wait 5 seconds\n        }\n        break;\n    }\n  }\n\n  private enableBatteryOptimization(): void {\n    if (this.currentSettings.batteryOptimizationMode) return;\n    \n    console.log('Enabling battery optimization mode');\n    this.currentSettings.batteryOptimizationMode = true;\n    \n    // Reduce performance for battery life\n    this.currentSettings.targetFPS = Math.min(30, this.currentSettings.targetFPS);\n    this.currentSettings.maxRenderDistance *= 0.8;\n    this.currentSettings.maxEntities = Math.floor(this.currentSettings.maxEntities * 0.7);\n    \n    this.applySettings();\n  }\n\n  private disableBatteryOptimization(): void {\n    if (!this.currentSettings.batteryOptimizationMode) return;\n    \n    console.log('Disabling battery optimization mode');\n    this.currentSettings.batteryOptimizationMode = false;\n    \n    // Restore settings gradually\n    setTimeout(() => {\n      if (this.canIncreaseQuality()) {\n        this.increaseQuality();\n      }\n    }, 2000);\n  }\n\n  private handleVisibilityChange(): void {\n    if (document.hidden) {\n      console.log('App backgrounded - pausing optimization');\n      this.stopMonitoring();\n    } else {\n      console.log('App foregrounded - resuming optimization');\n      this.startMonitoring();\n    }\n  }\n\n  private handleOrientationChange(): void {\n    console.log('Orientation changed - recalibrating');\n    \n    // Update screen dimensions\n    setTimeout(() => {\n      this.capabilities.screenWidth = screen.width;\n      this.capabilities.screenHeight = screen.height;\n      this.capabilities.pixelRatio = window.devicePixelRatio || 1;\n      \n      // Trigger settings recalculation\n      this.applySettings();\n    }, 100); // Wait for orientation to complete\n  }\n\n  private applySettings(): void {\n    console.log('Applying mobile optimization settings:', this.currentSettings);\n    \n    // Apply to performance adapter\n    if (this.currentSettings.targetFPS <= 30) {\n      this.performanceAdapter.setQualityLevel('low');\n    } else if (this.currentSettings.targetFPS <= 45) {\n      this.performanceAdapter.setQualityLevel('medium');\n    } else {\n      this.performanceAdapter.setQualityLevel('high');\n    }\n    \n    // Notify other systems of setting changes\n    this.dispatchSettingsUpdate();\n  }\n\n  private dispatchSettingsUpdate(): void {\n    const event = new CustomEvent('mobileSettingsUpdate', {\n      detail: { settings: this.currentSettings }\n    });\n    window.dispatchEvent(event);\n  }\n\n  // Public API\n  getDeviceCapabilities(): DeviceCapabilities {\n    return { ...this.capabilities };\n  }\n\n  getCurrentSettings(): OptimizationSettings {\n    return { ...this.currentSettings };\n  }\n\n  getCurrentProfile(): PerformanceProfile {\n    return this.currentProfile;\n  }\n\n  getAvailableProfiles(): PerformanceProfile[] {\n    return this.PERFORMANCE_PROFILES.filter(profile => \n      this.meetsRequirements(profile.minRequirements)\n    );\n  }\n\n  setProfile(profileName: string): boolean {\n    const profile = this.PERFORMANCE_PROFILES.find(p => p.name === profileName);\n    \n    if (!profile || !this.meetsRequirements(profile.minRequirements)) {\n      console.warn(`Cannot set profile '${profileName}' - requirements not met`);\n      return false;\n    }\n    \n    console.log(`Switching to profile: ${profileName}`);\n    this.currentProfile = profile;\n    this.currentSettings = { ...profile.settings };\n    this.applySettings();\n    \n    return true;\n  }\n\n  forceQualityReduction(): void {\n    this.reduceQuality();\n  }\n\n  restoreOriginalSettings(): void {\n    this.currentSettings = { ...this.currentProfile.settings };\n    this.applySettings();\n  }\n\n  getOptimizationRecommendations(): string[] {\n    const recommendations: string[] = [];\n    \n    if (this.capabilities.tier === 'low') {\n      recommendations.push('Device detected as low-end - consider enabling ultra-low profile');\n      recommendations.push('Disable post-processing effects for better performance');\n    }\n    \n    if (this.capabilities.totalMemory < 4) {\n      recommendations.push('Limited memory detected - reduce texture quality');\n      recommendations.push('Enable aggressive entity culling');\n    }\n    \n    if (this.capabilities.thermalState === 'serious') {\n      recommendations.push('Thermal throttling detected - reduce graphics quality');\n    }\n    \n    if (this.capabilities.batteryLevel && this.capabilities.batteryLevel < 20) {\n      recommendations.push('Low battery detected - enable battery optimization mode');\n    }\n    \n    if (this.capabilities.connectionType === 'cellular') {\n      recommendations.push('Cellular connection detected - enable offline mode for assets');\n    }\n    \n    return recommendations;\n  }\n\n  exportDiagnostics(): any {\n    return {\n      timestamp: Date.now(),\n      capabilities: this.capabilities,\n      currentProfile: this.currentProfile.name,\n      currentSettings: this.currentSettings,\n      performance: {\n        fpsHistory: this.fpsHistory.slice(-20),\n        frameTimeHistory: this.frameTimeHistory.slice(-20),\n        thermalHistory: this.thermalHistory.slice(-10)\n      },\n      recommendations: this.getOptimizationRecommendations()\n    };\n  }\n\n  destroy(): void {\n    this.stopMonitoring();\n    console.log('Mobile Optimizer destroyed');\n  }\n}"