/**
 * PowerupManager
 * Main orchestrator for the powerup system with mobile optimization
 */

import { World } from '@/core/ecs/World';
import { Entity } from '@/types';
import { PowerupSystem } from './systems/PowerupSystem';
import { CollectionSystem } from './systems/CollectionSystem';
import { MagnetSystem } from './systems/MagnetSystem';
import { VisualEffectsSystem } from './systems/VisualEffectsSystem';
import { ParticleEffects } from './effects/ParticleEffects';
import { PowerupFactory } from './PowerupFactory';
import { PowerupType, PowerupStats, POWERUP_CONFIGS } from './types/PowerupTypes';

export interface PowerupManagerConfig {
  enableVisualEffects: boolean;
  enableParticleEffects: boolean;
  maxConcurrentPowerups: number;
  performanceMode: 'high' | 'medium' | 'low';
  mobileOptimized: boolean;
}

export interface PowerupEvent {
  type: 'collected' | 'activated' | 'expired' | 'spawned';
  entityId: number;
  powerupType: PowerupType;
  timestamp: number;
  data?: any;
}

export class PowerupManager {
  private world: World;
  private systems: {
    powerup: PowerupSystem;
    collection: CollectionSystem;
    magnet: MagnetSystem;
    visualEffects: VisualEffectsSystem;
  };
  
  private particleEffects: ParticleEffects;
  private config: PowerupManagerConfig;
  private stats: PowerupStats;
  private eventListeners = new Map<string, ((event: PowerupEvent) => void)[]>();
  
  // Performance monitoring
  private frameTime = 0;
  private lastFrameTime = 0;
  private performanceThreshold = 16.67; // 60fps target
  private adaptiveQuality = 1.0;
  
  // Mobile optimizations
  private isMobile: boolean;
  private deviceCapabilities: {
    maxParticles: number;
    reducedEffects: boolean;
    lowDetailMode: boolean;
  };

  constructor(world: World, config: Partial<PowerupManagerConfig> = {}) {
    this.world = world;
    this.isMobile = this.detectMobileDevice();
    
    // Default configuration with mobile optimizations
    this.config = {
      enableVisualEffects: true,
      enableParticleEffects: true,
      maxConcurrentPowerups: this.isMobile ? 3 : 5,
      performanceMode: this.isMobile ? 'medium' : 'high',
      mobileOptimized: this.isMobile,
      ...config
    };

    this.deviceCapabilities = this.calculateDeviceCapabilities();
    this.initializeSystems();
    this.initializeStats();
    
    this.particleEffects = new ParticleEffects();
    this.configureParticleSystem();
  }

  private detectMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    
    return mobileRegex.test(userAgent.toLowerCase()) || 
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
  }

  private calculateDeviceCapabilities() {
    let maxParticles = 1000;
    let reducedEffects = false;
    let lowDetailMode = false;

    if (this.isMobile) {
      // Mobile device capabilities
      const memory = (navigator as any).deviceMemory || 4; // GB, defaults to 4
      const cores = navigator.hardwareConcurrency || 4;
      
      if (memory <= 2 || cores <= 2) {
        maxParticles = 250;
        reducedEffects = true;
        lowDetailMode = true;
      } else if (memory <= 4 || cores <= 4) {
        maxParticles = 500;
        reducedEffects = true;
      } else {
        maxParticles = 750;
      }
    } else {
      // Desktop capabilities
      const cores = navigator.hardwareConcurrency || 8;
      if (cores >= 8) {
        maxParticles = 1500;
      }
    }

    return { maxParticles, reducedEffects, lowDetailMode };
  }

  private initializeSystems(): void {
    this.systems = {
      powerup: new PowerupSystem(),
      collection: new CollectionSystem(),
      magnet: new MagnetSystem(),
      visualEffects: new VisualEffectsSystem()
    };

    // Configure systems for the world
    Object.values(this.systems).forEach(system => {
      system.setWorld(this.world);
      system.init?.();
      this.world.addSystem(system);
    });

    // Apply mobile optimizations
    if (this.config.mobileOptimized) {
      this.applyMobileOptimizations();
    }
  }

  private applyMobileOptimizations(): void {
    // Reduce magnet attraction calculations
    this.systems.magnet.setMagnetParameters({
      maxSpeed: this.deviceCapabilities.lowDetailMode ? 200 : 300,
      attractionCurve: this.deviceCapabilities.lowDetailMode ? 1.5 : 2.0
    });

    // Reduce visual effects quality
    if (this.deviceCapabilities.reducedEffects) {
      this.systems.visualEffects.setDebugEnabled(false);
    }

    // Limit attractable types for performance
    this.systems.magnet.setAttractableTypes(['coin', 'collectible']);
  }

  private configureParticleSystem(): void {
    this.particleEffects.setPerformanceLimits(this.deviceCapabilities.maxParticles);
  }

  private initializeStats(): void {
    this.stats = {
      totalCollected: 0,
      typeCollected: {
        [PowerupType.MAGNET]: 0,
        [PowerupType.DOUBLER]: 0,
        [PowerupType.INVISIBILITY]: 0
      },
      averageDuration: 0,
      effectivenessScore: 0
    };
  }

  /**
   * Main update method - call every frame
   */
  update(deltaTime: number): void {
    const startTime = performance.now();
    
    // Update particle effects
    if (this.config.enableParticleEffects) {
      this.particleEffects.update(deltaTime);
    }
    
    // Monitor performance and adapt
    this.updatePerformanceMonitoring(deltaTime);
    
    // Apply adaptive quality if needed
    if (this.frameTime > this.performanceThreshold * 1.5) {
      this.adaptQualityForPerformance();
    }
    
    this.lastFrameTime = performance.now() - startTime;
  }

  private updatePerformanceMonitoring(deltaTime: number): void {
    this.frameTime = deltaTime;
    
    // Track system performance
    const systemMetrics = Object.entries(this.systems).map(([name, system]) => ({
      name,
      metrics: system.getPerformanceMetrics()
    }));
    
    // Log performance warnings
    systemMetrics.forEach(({ name, metrics }) => {
      if (metrics.lastUpdateTime > 8) { // More than 8ms
        console.warn(`PowerupSystem: ${name} took ${metrics.lastUpdateTime.toFixed(2)}ms`);
      }
    });
  }

  private adaptQualityForPerformance(): void {
    if (this.adaptiveQuality > 0.5) {
      this.adaptiveQuality *= 0.9;
      
      // Reduce particle limits
      const newLimit = Math.floor(this.deviceCapabilities.maxParticles * this.adaptiveQuality);
      this.particleEffects.setPerformanceLimits(newLimit);
      
      console.log(`PowerupManager: Adapted quality to ${(this.adaptiveQuality * 100).toFixed(1)}%`);
    }
  }

  /**
   * Spawn a powerup at the specified position
   */
  spawnPowerup(type: PowerupType, position: { x: number; y: number; z: number }): Entity {
    const powerup = PowerupFactory.createPowerup({ type, position });
    this.world.addEntity(powerup);
    
    // Create spawn effects
    if (this.config.enableParticleEffects) {
      const config = POWERUP_CONFIGS[type];
      this.particleEffects.createPowerupGlow(position, config.visualConfig.color);
    }
    
    this.emitEvent({
      type: 'spawned',
      entityId: powerup.id,
      powerupType: type,
      timestamp: performance.now()
    });
    
    return powerup;
  }

  /**
   * Spawn multiple powerups at random positions
   */
  spawnPowerupBatch(
    types: PowerupType[],
    spawnArea: { center: { x: number; y: number; z: number }; radius: number },
    count: number
  ): Entity[] {
    const powerups = PowerupFactory.createPowerupBatch(types, spawnArea, count);
    
    powerups.forEach(powerup => {
      this.world.addEntity(powerup);
      
      // Create spawn effects
      if (this.config.enableParticleEffects) {
        const powerupComponent = powerup.components.get('PowerupComponent') as any;
        if (powerupComponent) {
          const transform = powerup.components.get('TransformComponent') as any;
          if (transform) {
            const config = POWERUP_CONFIGS[powerupComponent.type];
            this.particleEffects.createPowerupGlow(transform.position, config.visualConfig.color);
          }
        }
      }
    });
    
    return powerups;
  }

  /**
   * Create specific powerup types with faithful mechanics
   */
  spawnMagnetPowerup(position: { x: number; y: number; z: number }): Entity {
    return this.spawnPowerup(PowerupType.MAGNET, position);
  }

  spawnDoublerPowerup(position: { x: number; y: number; z: number }): Entity {
    return this.spawnPowerup(PowerupType.DOUBLER, position);
  }

  spawnInvisibilityPowerup(position: { x: number; y: number; z: number }): Entity {
    return this.spawnPowerup(PowerupType.INVISIBILITY, position);
  }

  /**
   * Force collect a powerup (for testing or special events)
   */
  forceCollectPowerup(entityId: number): boolean {
    return this.systems.collection.forceCollect(entityId);
  }

  /**
   * Get currently active powerups
   */
  getActivePowerups(): Map<number, any> {
    return this.systems.powerup.getActivePowerups();
  }

  /**
   * Check if a specific powerup type is active
   */
  hasPowerupActive(entityId: number, type: PowerupType): boolean {
    return this.systems.powerup.hasPowerupActive(entityId, type);
  }

  /**
   * Get remaining time for a powerup
   */
  getPowerupRemainingTime(entityId: number): number {
    return this.systems.powerup.getRemainingTime(entityId);
  }

  /**
   * Get all particles for rendering
   */
  getAllParticles() {
    return this.config.enableParticleEffects ? this.particleEffects.getAllParticles() : [];
  }

  /**
   * Get visual effects for rendering
   */
  getVisualEffects() {
    return this.config.enableVisualEffects ? this.systems.visualEffects.getActiveEffects() : new Map();
  }

  /**
   * Get UI elements for HUD rendering
   */
  getUIElements() {
    return this.systems.visualEffects.getUIElements();
  }

  // Event system

  /**
   * Add event listener for powerup events
   */
  addEventListener(eventType: string, callback: (event: PowerupEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: (event: PowerupEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: PowerupEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
    
    // Update statistics
    this.updateStats(event);
  }

  private updateStats(event: PowerupEvent): void {
    switch (event.type) {
      case 'collected':
        this.stats.totalCollected++;
        this.stats.typeCollected[event.powerupType]++;
        break;
        
      case 'expired':
        // Update effectiveness score based on usage
        const duration = POWERUP_CONFIGS[event.powerupType].duration;
        this.stats.averageDuration = (this.stats.averageDuration + duration) / 2;
        break;
    }
  }

  // Configuration and debugging

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PowerupManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.mobileOptimized !== undefined) {
      if (newConfig.mobileOptimized) {
        this.applyMobileOptimizations();
      }
    }
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      ...this.stats,
      performance: {
        frameTime: this.frameTime,
        lastFrameTime: this.lastFrameTime,
        adaptiveQuality: this.adaptiveQuality,
        particleCount: this.particleEffects.getStats().totalParticles
      },
      systems: Object.entries(this.systems).map(([name, system]) => ({
        name,
        ...system.getPerformanceMetrics()
      })),
      particles: this.particleEffects.getStats(),
      config: this.config,
      deviceCapabilities: this.deviceCapabilities
    };
  }

  /**
   * Enable or disable debug mode for all systems
   */
  setDebugMode(enabled: boolean): void {
    Object.values(this.systems).forEach(system => {
      system.setDebugEnabled(enabled);
    });
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.initializeStats();
    Object.values(this.systems).forEach(system => {
      system.resetMetrics();
    });
  }

  /**
   * Cleanup when destroying the manager
   */
  destroy(): void {
    // Cleanup systems
    Object.values(this.systems).forEach(system => {
      system.destroy?.();
    });
    
    // Clear particles
    this.particleEffects.clearAll();
    
    // Clear event listeners
    this.eventListeners.clear();
  }
}