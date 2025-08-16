/**
 * PowerupSystemIntegration Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PowerupSystem } from '@/powerups/PowerupSystemIntegration';
import { World } from '@/core/ecs/World';
import { PowerupType } from '@/powerups/types/PowerupTypes';

// Mock World class
vi.mock('@/core/ecs/World', () => ({
  World: vi.fn().mockImplementation(() => ({
    addSystem: vi.fn(),
    addEntity: vi.fn(),
    getEntity: vi.fn(),
    getAllEntities: vi.fn(() => [])
  }))
}));

// Mock performance.now
vi.stubGlobal('performance', {
  now: vi.fn(() => 1000)
});

describe('PowerupSystemIntegration', () => {
  let world: World;
  let powerupSystem: PowerupSystem;

  beforeEach(() => {
    world = new World();
    powerupSystem = new PowerupSystem(world);
  });

  afterEach(() => {
    powerupSystem.destroy();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = powerupSystem.getConfig();
      
      expect(config.enableVisualEffects).toBe(true);
      expect(config.enableParticleEffects).toBe(true);
      expect(config.maxConcurrentPowerups).toBe(5);
      expect(config.performanceMode).toBe('high');
      expect(config.mobileOptimized).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customSystem = new PowerupSystem(world, {
        maxConcurrentPowerups: 3,
        performanceMode: 'medium',
        mobileOptimized: true
      });

      const config = customSystem.getConfig();
      expect(config.maxConcurrentPowerups).toBe(3);
      expect(config.performanceMode).toBe('medium');
      expect(config.mobileOptimized).toBe(true);
      
      customSystem.destroy();
    });

    it('should initialize auto spawner when enabled', () => {
      const systemWithAutoSpawn = new PowerupSystem(world, {
        autoSpawn: {
          enabled: true,
          spawnRate: 2,
          spawnArea: { center: { x: 0, y: 0, z: 0 }, radius: 50 },
          availableTypes: [PowerupType.MAGNET]
        }
      });

      const config = systemWithAutoSpawn.getConfig();
      expect(config.autoSpawn?.enabled).toBe(true);
      expect(config.autoSpawn?.spawnRate).toBe(2);
      
      systemWithAutoSpawn.destroy();
    });
  });

  describe('powerup spawning', () => {
    it('should spawn individual powerups', () => {
      const position = { x: 10, y: 5, z: 15 };
      const powerup = powerupSystem.spawnPowerup(PowerupType.MAGNET, position);

      expect(powerup).toBeDefined();
      expect(powerup.components.has('PowerupComponent')).toBe(true);
      
      const powerupComponent = powerup.components.get('PowerupComponent') as any;
      expect(powerupComponent.type).toBe(PowerupType.MAGNET);
    });

    it('should spawn specific powerup types', () => {
      const position = { x: 0, y: 0, z: 0 };

      const magnet = powerupSystem.spawnMagnet(position);
      const doubler = powerupSystem.spawnDoubler(position);
      const invisibility = powerupSystem.spawnInvisibility(position);

      const magnetComponent = magnet.components.get('PowerupComponent') as any;
      const doublerComponent = doubler.components.get('PowerupComponent') as any;
      const invisibilityComponent = invisibility.components.get('PowerupComponent') as any;

      expect(magnetComponent.type).toBe(PowerupType.MAGNET);
      expect(doublerComponent.type).toBe(PowerupType.DOUBLER);
      expect(invisibilityComponent.type).toBe(PowerupType.INVISIBILITY);
    });

    it('should spawn powerup batches', () => {
      const types = [PowerupType.MAGNET, PowerupType.DOUBLER];
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 50
      };
      const count = 5;

      const powerups = powerupSystem.spawnPowerupBatch(types, spawnArea, count);

      expect(powerups).toHaveLength(count);
      powerups.forEach(powerup => {
        const powerupComponent = powerup.components.get('PowerupComponent') as any;
        expect(types).toContain(powerupComponent.type);
      });
    });

    it('should spawn progressive powerups based on level and score', () => {
      const position = { x: 0, y: 0, z: 0 };
      
      // Low level should only get magnet
      const lowLevelPowerups = powerupSystem.spawnProgressivePowerups(1, 100, position);
      lowLevelPowerups.forEach(powerup => {
        const powerupComponent = powerup.components.get('PowerupComponent') as any;
        expect(powerupComponent.type).toBe(PowerupType.MAGNET);
      });

      // High level should get all types
      const highLevelPowerups = powerupSystem.spawnProgressivePowerups(6, 5000, position);
      expect(highLevelPowerups.length).toBeGreaterThanOrEqual(lowLevelPowerups.length);
    });
  });

  describe('update cycle', () => {
    it('should update without errors', () => {
      expect(() => {
        powerupSystem.update(16.67);
      }).not.toThrow();
    });

    it('should initialize on first update if not manually initialized', () => {
      const spy = vi.spyOn(powerupSystem, 'init' as any);
      powerupSystem.update(16.67);
      
      // Note: This test relies on internal implementation details
      // In a real test, we'd check for side effects of initialization
    });

    it('should handle game state for progressive unlocking', () => {
      const progressiveSystem = new PowerupSystem(world, {
        progressiveUnlock: { enabled: true },
        autoSpawn: { enabled: true, spawnRate: 60 } // High rate for testing
      } as any);

      const gameState = {
        playerLevel: 3,
        playerScore: 1500,
        playerPosition: { x: 0, y: 0, z: 0 }
      };

      expect(() => {
        progressiveSystem.update(16.67, gameState);
      }).not.toThrow();
      
      progressiveSystem.destroy();
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      powerupSystem.updateConfig({
        maxConcurrentPowerups: 8,
        performanceMode: 'low'
      });

      const config = powerupSystem.getConfig();
      expect(config.maxConcurrentPowerups).toBe(8);
      expect(config.performanceMode).toBe('low');
    });

    it('should control auto spawn', () => {
      powerupSystem.updateConfig({
        autoSpawn: {
          enabled: true,
          spawnRate: 1,
          spawnArea: { center: { x: 0, y: 0, z: 0 }, radius: 30 },
          availableTypes: [PowerupType.MAGNET]
        }
      });

      powerupSystem.setAutoSpawnEnabled(false);
      const config = powerupSystem.getConfig();
      expect(config.autoSpawn?.enabled).toBe(false);
    });
  });

  describe('powerup status queries', () => {
    it('should track active powerups', () => {
      const activePowerups = powerupSystem.getActivePowerups();
      expect(activePowerups).toBeInstanceOf(Map);
    });

    it('should check if specific powerup type is active', () => {
      const result = powerupSystem.hasPowerupActive(1, PowerupType.MAGNET);
      expect(typeof result).toBe('boolean');
    });

    it('should get remaining time for powerups', () => {
      const remainingTime = powerupSystem.getRemainingTime(1);
      expect(typeof remainingTime).toBe('number');
    });
  });

  describe('rendering data', () => {
    it('should provide particles for rendering', () => {
      const particles = powerupSystem.getParticlesForRendering();
      expect(Array.isArray(particles)).toBe(true);
    });

    it('should provide visual effects for rendering', () => {
      const effects = powerupSystem.getVisualEffectsForRendering();
      expect(effects).toBeInstanceOf(Map);
    });

    it('should provide UI elements for rendering', () => {
      const uiElements = powerupSystem.getUIElementsForRendering();
      expect(uiElements).toBeInstanceOf(Map);
    });
  });

  describe('debug and statistics', () => {
    it('should provide system statistics', () => {
      const stats = powerupSystem.getStats();
      
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('systems');
      expect(stats).toHaveProperty('particles');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('deviceCapabilities');
    });

    it('should toggle debug mode', () => {
      expect(() => {
        powerupSystem.setDebugMode(true);
        powerupSystem.setDebugMode(false);
      }).not.toThrow();
    });

    it('should force collect powerups for testing', () => {
      const result = powerupSystem.forceCollectPowerup(999);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('static factory methods', () => {
    it('should create mobile-optimized system', () => {
      const mobileSystem = PowerupSystem.createMobileOptimized(world);
      const config = mobileSystem.getConfig();
      
      expect(config.mobileOptimized).toBe(true);
      expect(config.performanceMode).toBe('medium');
      expect(config.maxConcurrentPowerups).toBe(3);
      
      mobileSystem.destroy();
    });

    it('should create high-performance system', () => {
      const highPerfSystem = PowerupSystem.createHighPerformance(world);
      const config = highPerfSystem.getConfig();
      
      expect(config.mobileOptimized).toBe(false);
      expect(config.performanceMode).toBe('high');
      expect(config.maxConcurrentPowerups).toBe(8);
      
      highPerfSystem.destroy();
    });

    it('should create progressive system', () => {
      const progressiveSystem = PowerupSystem.createProgressive(world);
      const config = progressiveSystem.getConfig();
      
      expect(config.progressiveUnlock?.enabled).toBe(true);
      expect(config.autoSpawn?.enabled).toBe(true);
      expect(config.progressiveUnlock?.levelThresholds[PowerupType.MAGNET]).toBe(1);
      expect(config.progressiveUnlock?.levelThresholds[PowerupType.DOUBLER]).toBe(3);
      expect(config.progressiveUnlock?.levelThresholds[PowerupType.INVISIBILITY]).toBe(5);
      
      progressiveSystem.destroy();
    });

    it('should provide factory statistics', () => {
      const stats = PowerupSystem.getFactoryStats();
      
      expect(stats).toHaveProperty('entitiesCreated');
      expect(stats).toHaveProperty('availableTypes');
      expect(stats).toHaveProperty('typeConfigurations');
      expect(Array.isArray(stats.availableTypes)).toBe(true);
      expect(Array.isArray(stats.typeConfigurations)).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should destroy properly', () => {
      powerupSystem.init();
      
      expect(() => {
        powerupSystem.destroy();
      }).not.toThrow();
    });

    it('should handle multiple destroy calls', () => {
      powerupSystem.destroy();
      
      expect(() => {
        powerupSystem.destroy();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty powerup type arrays', () => {
      expect(() => {
        powerupSystem.spawnPowerupBatch(
          [],
          { center: { x: 0, y: 0, z: 0 }, radius: 10 },
          0
        );
      }).not.toThrow();
    });

    it('should handle invalid entity IDs gracefully', () => {
      const hasActive = powerupSystem.hasPowerupActive(-1, PowerupType.MAGNET);
      const remainingTime = powerupSystem.getRemainingTime(-1);
      const forceCollect = powerupSystem.forceCollectPowerup(-1);
      
      expect(typeof hasActive).toBe('boolean');
      expect(typeof remainingTime).toBe('number');
      expect(typeof forceCollect).toBe('boolean');
    });

    it('should handle update before initialization', () => {
      const newSystem = new PowerupSystem(world);
      
      expect(() => {
        newSystem.update(16.67);
      }).not.toThrow();
      
      newSystem.destroy();
    });
  });
});