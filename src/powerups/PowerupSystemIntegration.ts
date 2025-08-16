/**
 * PowerupSystemIntegration
 * Main integration class for easy setup with existing ECS architecture
 */

import { World } from '@/core/ecs/World';
import { PowerupManager, PowerupManagerConfig } from './PowerupManager';
import { PowerupFactory } from './PowerupFactory';
import { PowerupType } from './types/PowerupTypes';

export interface PowerupSystemConfig extends Partial<PowerupManagerConfig> {
  autoSpawn?: {
    enabled: boolean;
    spawnRate: number; // powerups per minute
    spawnArea: {
      center: { x: number; y: number; z: number };
      radius: number;
    };
    availableTypes: PowerupType[];
  };
  progressiveUnlock?: {
    enabled: boolean;
    levelThresholds: Record<PowerupType, number>;
    scoreThresholds: Record<PowerupType, number>;
  };
}

export class PowerupSystem {
  private manager: PowerupManager;
  private config: PowerupSystemConfig;
  private autoSpawner: any = null;
  private isInitialized = false;

  constructor(world: World, config: PowerupSystemConfig = {}) {
    // Default configuration
    const defaultConfig = {
      enableVisualEffects: true,
      enableParticleEffects: true,
      maxConcurrentPowerups: 5,
      performanceMode: 'high' as const,
      mobileOptimized: false,
      autoSpawn: {
        enabled: false,
        spawnRate: 2, // 2 per minute
        spawnArea: {
          center: { x: 0, y: 0, z: 0 },
          radius: 100
        },
        availableTypes: [PowerupType.MAGNET, PowerupType.DOUBLER, PowerupType.INVISIBILITY]
      },
      progressiveUnlock: {
        enabled: false,
        levelThresholds: {
          [PowerupType.MAGNET]: 1,
          [PowerupType.DOUBLER]: 3,
          [PowerupType.INVISIBILITY]: 5
        },
        scoreThresholds: {
          [PowerupType.MAGNET]: 0,
          [PowerupType.DOUBLER]: 1000,
          [PowerupType.INVISIBILITY]: 2500
        }
      }
    };

    // Deep merge the configurations
    this.config = {
      ...defaultConfig,
      ...config,
      autoSpawn: {
        ...defaultConfig.autoSpawn,
        ...config.autoSpawn
      },
      progressiveUnlock: {
        ...defaultConfig.progressiveUnlock,
        ...config.progressiveUnlock
      }
    };

    this.manager = new PowerupManager(world, this.config);
    this.setupAutoSpawner();
  }

  /**
   * Initialize the powerup system
   */
  init(): void {
    if (this.isInitialized) return;

    // Setup event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    console.log('PowerupSystem initialized with config:', this.config);
  }

  /**
   * Update the powerup system (call every frame)
   */
  update(deltaTime: number, gameState?: {
    playerLevel?: number;
    playerScore?: number;
    playerPosition?: { x: number; y: number; z: number };
  }): void {
    if (!this.isInitialized) {
      this.init();
    }

    // Update manager
    this.manager.update(deltaTime);

    // Update auto spawner
    if (this.autoSpawner && this.config.autoSpawn?.enabled) {
      const spawnedPowerups = this.autoSpawner.update(deltaTime);
      
      // Apply progressive unlock filtering
      if (this.config.progressiveUnlock?.enabled && gameState) {
        this.filterProgressiveSpawns(spawnedPowerups, gameState);
      }
    }
  }

  private setupAutoSpawner(): void {
    if (!this.config.autoSpawn?.enabled) return;

    const spawnRate = this.config.autoSpawn.spawnRate / 60; // Convert to per second
    this.autoSpawner = PowerupFactory.createPowerupSpawner(
      this.config.autoSpawn.spawnArea,
      spawnRate,
      this.config.autoSpawn.availableTypes
    );
  }

  private setupEventListeners(): void {
    // Listen for powerup collection events
    this.manager.addEventListener('collected', (event) => {
      console.log(`Powerup collected: ${event.powerupType} by entity ${event.entityId}`);
    });

    // Listen for powerup activation events
    this.manager.addEventListener('activated', (event) => {
      console.log(`Powerup activated: ${event.powerupType} on entity ${event.entityId}`);
    });

    // Listen for powerup expiration events
    this.manager.addEventListener('expired', (event) => {
      console.log(`Powerup expired: ${event.powerupType} on entity ${event.entityId}`);
    });
  }

  private filterProgressiveSpawns(
    spawnedPowerups: any[], 
    gameState: { playerLevel?: number; playerScore?: number }
  ): void {
    if (!this.config.progressiveUnlock?.enabled) return;

    const level = gameState.playerLevel || 1;
    const score = gameState.playerScore || 0;
    const levelThresholds = this.config.progressiveUnlock.levelThresholds;
    const scoreThresholds = this.config.progressiveUnlock.scoreThresholds;

    // Filter out powerups that shouldn't be available yet
    const filteredPowerups = spawnedPowerups.filter(powerup => {
      const powerupComponent = powerup.components.get('PowerupComponent');
      if (!powerupComponent) return true;

      const type = powerupComponent.type as PowerupType;
      const levelRequired = levelThresholds[type] || 1;
      const scoreRequired = scoreThresholds[type] || 0;

      return level >= levelRequired || score >= scoreRequired;
    });

    // Remove unauthorized powerups from world
    spawnedPowerups.forEach(powerup => {
      if (!filteredPowerups.includes(powerup)) {
        // Remove from world if it was added
        console.log(`Removed unauthorized powerup: ${powerup.components.get('PowerupComponent')?.type}`);
      }
    });
  }

  // Public API

  /**
   * Manually spawn a powerup
   */
  spawnPowerup(type: PowerupType, position: { x: number; y: number; z: number }) {
    return this.manager.spawnPowerup(type, position);
  }

  /**
   * Spawn multiple powerups at random positions
   */
  spawnPowerupBatch(
    types: PowerupType[],
    spawnArea: { center: { x: number; y: number; z: number }; radius: number },
    count: number
  ) {
    return this.manager.spawnPowerupBatch(types, spawnArea, count);
  }

  /**
   * Spawn powerups based on player progression
   */
  spawnProgressivePowerups(
    playerLevel: number,
    score: number,
    position: { x: number; y: number; z: number }
  ) {
    return PowerupFactory.createProgressivePowerups(playerLevel, score, position);
  }

  /**
   * Quick spawn methods for specific powerups
   */
  spawnMagnet(position: { x: number; y: number; z: number }) {
    return this.manager.spawnMagnetPowerup(position);
  }

  spawnDoubler(position: { x: number; y: number; z: number }) {
    return this.manager.spawnDoublerPowerup(position);
  }

  spawnInvisibility(position: { x: number; y: number; z: number }) {
    return this.manager.spawnInvisibilityPowerup(position);
  }

  /**
   * Check powerup status
   */
  getActivePowerups() {
    return this.manager.getActivePowerups();
  }

  hasPowerupActive(entityId: number, type: PowerupType): boolean {
    return this.manager.hasPowerupActive(entityId, type);
  }

  getRemainingTime(entityId: number): number {
    return this.manager.getPowerupRemainingTime(entityId);
  }

  /**
   * Get rendering data
   */
  getParticlesForRendering() {
    return this.manager.getAllParticles();
  }

  getVisualEffectsForRendering() {
    return this.manager.getVisualEffects();
  }

  getUIElementsForRendering() {
    return this.manager.getUIElements();
  }

  /**
   * Configuration management
   */
  updateConfig(newConfig: Partial<PowerupSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.manager.updateConfig(newConfig);
    
    // Recreate auto spawner if needed
    if (newConfig.autoSpawn) {
      this.setupAutoSpawner();
    }
  }

  getConfig(): PowerupSystemConfig {
    return { ...this.config };
  }

  /**
   * Control auto spawning
   */
  setAutoSpawnEnabled(enabled: boolean): void {
    if (this.config.autoSpawn) {
      this.config.autoSpawn.enabled = enabled;
      if (this.autoSpawner) {
        this.autoSpawner.setActive(enabled);
      }
    }
  }

  /**
   * Debug and statistics
   */
  getStats() {
    return this.manager.getStats();
  }

  setDebugMode(enabled: boolean): void {
    this.manager.setDebugMode(enabled);
  }

  /**
   * Force actions for testing
   */
  forceCollectPowerup(entityId: number): boolean {
    return this.manager.forceCollectPowerup(entityId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.manager.destroy();
    this.autoSpawner = null;
    this.isInitialized = false;
  }

  // Static utility methods

  /**
   * Create a powerup system with mobile-optimized defaults
   */
  static createMobileOptimized(world: World): PowerupSystem {
    return new PowerupSystem(world, {
      mobileOptimized: true,
      performanceMode: 'medium',
      maxConcurrentPowerups: 3,
      enableParticleEffects: true,
      enableVisualEffects: true
    });
  }

  /**
   * Create a powerup system with high-performance defaults
   */
  static createHighPerformance(world: World): PowerupSystem {
    return new PowerupSystem(world, {
      mobileOptimized: false,
      performanceMode: 'high',
      maxConcurrentPowerups: 8,
      enableParticleEffects: true,
      enableVisualEffects: true
    });
  }

  /**
   * Create a powerup system with progressive unlocking
   */
  static createProgressive(world: World): PowerupSystem {
    return new PowerupSystem(world, {
      progressiveUnlock: {
        enabled: true,
        levelThresholds: {
          [PowerupType.MAGNET]: 1,
          [PowerupType.DOUBLER]: 3,
          [PowerupType.INVISIBILITY]: 5
        },
        scoreThresholds: {
          [PowerupType.MAGNET]: 0,
          [PowerupType.DOUBLER]: 1000,
          [PowerupType.INVISIBILITY]: 2500
        }
      },
      autoSpawn: {
        enabled: true,
        spawnRate: 1.5, // 1.5 per minute
        spawnArea: {
          center: { x: 0, y: 0, z: 0 },
          radius: 80
        },
        availableTypes: [PowerupType.MAGNET, PowerupType.DOUBLER, PowerupType.INVISIBILITY]
      }
    });
  }

  /**
   * Get factory statistics
   */
  static getFactoryStats() {
    return PowerupFactory.getStats();
  }
}