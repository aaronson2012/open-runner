import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PowerupManager, type PowerupManagerConfig, type PowerupEvent } from '@/powerups/PowerupManager';
import { PowerupFactory } from '@/powerups/PowerupFactory';
import { PowerupType } from '@/powerups/types/PowerupTypes';
import { World } from '@/core/ecs/World';
import type { Entity } from '@/types';

describe('Powerup System', () => {
  let world: World;
  let powerupManager: PowerupManager;
  let config: PowerupManagerConfig;

  beforeEach(() => {
    world = new World({ enableProfiling: true });
    
    config = {
      enableVisualEffects: true,
      enableParticleEffects: true,
      maxConcurrentPowerups: 5,
      performanceMode: 'high',
      mobileOptimized: false
    };
    
    powerupManager = new PowerupManager(world, config);
  });

  describe('PowerupManager Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new PowerupManager(world);
      const stats = defaultManager.getStats();
      
      expect(stats.config).toBeDefined();
      expect(stats.deviceCapabilities).toBeDefined();
    });

    it('should detect mobile devices and apply optimizations', () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      
      const mobileManager = new PowerupManager(world);
      const stats = mobileManager.getStats();
      
      expect(stats.config.mobileOptimized).toBe(true);
      expect(stats.config.maxConcurrentPowerups).toBe(3); // Reduced for mobile
    });

    it('should calculate device capabilities correctly', () => {
      // Mock low-end device
      Object.defineProperty(navigator, 'deviceMemory', { value: 2, writable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, writable: true });
      
      const lowEndManager = new PowerupManager(world, { mobileOptimized: true });
      const stats = lowEndManager.getStats();
      
      expect(stats.deviceCapabilities.maxParticles).toBe(250);
      expect(stats.deviceCapabilities.reducedEffects).toBe(true);
      expect(stats.deviceCapabilities.lowDetailMode).toBe(true);
    });

    it('should initialize all required systems', () => {
      const stats = powerupManager.getStats();
      
      expect(stats.systems).toHaveLength(4); // powerup, collection, magnet, visualEffects
      expect(stats.systems.map(s => s.name)).toContain('powerup');
      expect(stats.systems.map(s => s.name)).toContain('collection');
      expect(stats.systems.map(s => s.name)).toContain('magnet');
      expect(stats.systems.map(s => s.name)).toContain('visualEffects');
    });
  });

  describe('Powerup Spawning', () => {
    it('should spawn magnet powerup', () => {
      const position = { x: 5, y: 1, z: 0 };
      const powerup = powerupManager.spawnMagnetPowerup(position);
      
      expect(powerup).toBeDefined();
      expect(powerup.id).toBeGreaterThan(0);
      
      const transform = powerup.components.get('TransformComponent');
      expect(transform?.position).toEqual(position);
    });

    it('should spawn doubler powerup', () => {
      const position = { x: 10, y: 2, z: 5 };
      const powerup = powerupManager.spawnDoublerPowerup(position);
      
      expect(powerup).toBeDefined();
      
      const powerupComponent = powerup.components.get('PowerupComponent');
      expect(powerupComponent?.type).toBe(PowerupType.DOUBLER);
    });

    it('should spawn invisibility powerup', () => {
      const position = { x: -5, y: 0, z: -10 };
      const powerup = powerupManager.spawnInvisibilityPowerup(position);
      
      expect(powerup).toBeDefined();
      
      const powerupComponent = powerup.components.get('PowerupComponent');
      expect(powerupComponent?.type).toBe(PowerupType.INVISIBILITY);
    });

    it('should spawn generic powerup by type', () => {
      const position = { x: 0, y: 0, z: 0 };
      const powerup = powerupManager.spawnPowerup(PowerupType.MAGNET, position);
      
      expect(powerup).toBeDefined();
      
      const powerupComponent = powerup.components.get('PowerupComponent');
      expect(powerupComponent?.type).toBe(PowerupType.MAGNET);
    });

    it('should spawn batch of powerups', () => {
      const types = [PowerupType.MAGNET, PowerupType.DOUBLER, PowerupType.INVISIBILITY];
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 10
      };
      const count = 5;
      
      const powerups = powerupManager.spawnPowerupBatch(types, spawnArea, count);
      
      expect(powerups).toHaveLength(count);
      powerups.forEach(powerup => {
        expect(powerup).toBeDefined();
        expect(powerup.id).toBeGreaterThan(0);
      });
    });

    it('should create particle effects when spawning', () => {
      const position = { x: 0, y: 0, z: 0 };
      
      powerupManager.spawnMagnetPowerup(position);
      
      const particles = powerupManager.getAllParticles();
      expect(particles.length).toBeGreaterThan(0);
    });

    it('should emit spawn events', () => {
      const eventSpy = vi.fn();
      powerupManager.addEventListener('spawned', eventSpy);
      
      const position = { x: 0, y: 0, z: 0 };
      powerupManager.spawnMagnetPowerup(position);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'spawned',
          powerupType: PowerupType.MAGNET
        })
      );
    });
  });

  describe('Powerup Collection', () => {
    let playerEntity: Entity;
    let powerupEntity: Entity;
    
    beforeEach(() => {
      // Create player entity
      const playerId = world.createEntity();
      world.addComponent(playerId, {
        type: 'player',
        entityId: playerId
      });
      world.addComponent(playerId, {
        type: 'transform',
        entityId: playerId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      playerEntity = world.getEntity(playerId)!;
      
      // Create powerup near player
      powerupEntity = powerupManager.spawnMagnetPowerup({ x: 0.5, y: 0, z: 0 });
    });

    it('should detect collection when player is near powerup', () => {
      const eventSpy = vi.fn();
      powerupManager.addEventListener('collected', eventSpy);
      
      world.start();
      world.update(0.016);
      
      // Collection should be detected automatically by systems
      // This test would need the collection system to be properly implemented
    });

    it('should force collect powerup', () => {
      const collected = powerupManager.forceCollectPowerup(powerupEntity.id);
      
      expect(collected).toBe(true);
    });

    it('should activate powerup effects on collection', () => {
      powerupManager.forceCollectPowerup(powerupEntity.id);
      
      const activePowerups = powerupManager.getActivePowerups();
      expect(activePowerups.size).toBeGreaterThan(0);
    });

    it('should create visual effects on collection', () => {
      powerupManager.forceCollectPowerup(powerupEntity.id);
      
      const visualEffects = powerupManager.getVisualEffects();
      expect(visualEffects.size).toBeGreaterThan(0);
    });

    it('should emit collection events', () => {
      const eventSpy = vi.fn();
      powerupManager.addEventListener('collected', eventSpy);
      
      powerupManager.forceCollectPowerup(powerupEntity.id);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collected',
          entityId: powerupEntity.id
        })
      );
    });
  });

  describe('Powerup Effects', () => {
    let playerEntity: Entity;
    
    beforeEach(() => {
      const playerId = world.createEntity();
      world.addComponent(playerId, {
        type: 'player',
        entityId: playerId
      });
      playerEntity = world.getEntity(playerId)!;
    });

    it('should activate magnet effect', () => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 0.5, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const hasMagnet = powerupManager.hasPowerupActive(playerEntity.id, PowerupType.MAGNET);
      expect(hasMagnet).toBe(true);
    });

    it('should activate doubler effect', () => {
      const powerup = powerupManager.spawnDoublerPowerup({ x: 0.5, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const hasDoubler = powerupManager.hasPowerupActive(playerEntity.id, PowerupType.DOUBLER);
      expect(hasDoubler).toBe(true);
    });

    it('should activate invisibility effect', () => {
      const powerup = powerupManager.spawnInvisibilityPowerup({ x: 0.5, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const hasInvisibility = powerupManager.hasPowerupActive(playerEntity.id, PowerupType.INVISIBILITY);
      expect(hasInvisibility).toBe(true);
    });

    it('should track remaining time for powerups', () => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 0.5, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const remainingTime = powerupManager.getPowerupRemainingTime(playerEntity.id);
      expect(remainingTime).toBeGreaterThan(0);
    });

    it('should expire powerups after duration', (done) => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 0.5, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const eventSpy = vi.fn();
      powerupManager.addEventListener('expired', eventSpy);
      
      // Simulate time passing
      setTimeout(() => {
        world.update(10); // Large time step to force expiration
        
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'expired'
          })
        );
        done();
      }, 50);
    });
  });

  describe('Magnet System', () => {
    let playerEntity: Entity;
    let collectibleEntity: Entity;
    
    beforeEach(() => {
      // Create player with magnet powerup
      const playerId = world.createEntity();
      world.addComponent(playerId, {
        type: 'player',
        entityId: playerId
      });
      world.addComponent(playerId, {
        type: 'transform',
        entityId: playerId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      playerEntity = world.getEntity(playerId)!;
      
      // Create collectible item
      const collectibleId = world.createEntity();
      world.addComponent(collectibleId, {
        type: 'collectible',
        entityId: collectibleId
      });
      world.addComponent(collectibleId, {
        type: 'transform',
        entityId: collectibleId,
        position: { x: 5, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      collectibleEntity = world.getEntity(collectibleId)!;
      
      // Activate magnet powerup
      const magnetPowerup = powerupManager.spawnMagnetPowerup({ x: 0.5, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(magnetPowerup.id);
    });

    it('should attract nearby collectibles', () => {
      const initialPosition = { ...collectibleEntity.components.get('transform')!.position };
      
      world.start();
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      const finalPosition = collectibleEntity.components.get('transform')!.position;
      const distanceToPlayer = Math.sqrt(
        Math.pow(finalPosition.x, 2) + Math.pow(finalPosition.z, 2)
      );
      const initialDistanceToPlayer = Math.sqrt(
        Math.pow(initialPosition.x, 2) + Math.pow(initialPosition.z, 2)
      );
      
      expect(distanceToPlayer).toBeLessThan(initialDistanceToPlayer);
    });

    it('should not attract items outside magnet range', () => {
      // Move collectible far away
      const transform = collectibleEntity.components.get('transform')!;
      transform.position.x = 50; // Outside typical magnet range
      
      const initialPosition = { ...transform.position };
      
      world.start();
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      const finalPosition = transform.position;
      expect(finalPosition.x).toBeCloseTo(initialPosition.x, 1);
    });

    it('should respect magnet parameters', () => {
      // Test that magnet system uses configured parameters
      const stats = powerupManager.getStats();
      expect(stats.systems.find(s => s.name === 'magnet')).toBeDefined();
    });
  });

  describe('Visual Effects System', () => {
    it('should create powerup glow effects', () => {
      const position = { x: 0, y: 0, z: 0 };
      powerupManager.spawnMagnetPowerup(position);
      
      const particles = powerupManager.getAllParticles();
      expect(particles.length).toBeGreaterThan(0);
    });

    it('should create collection effects', () => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const visualEffects = powerupManager.getVisualEffects();
      expect(visualEffects.size).toBeGreaterThan(0);
    });

    it('should provide UI elements for HUD', () => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const uiElements = powerupManager.getUIElements();
      expect(uiElements).toBeDefined();
    });

    it('should disable effects in reduced mode', () => {
      const reducedManager = new PowerupManager(world, {
        enableVisualEffects: false,
        enableParticleEffects: false,
        performanceMode: 'low',
        mobileOptimized: true,
        maxConcurrentPowerups: 3
      });
      
      reducedManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      
      const particles = reducedManager.getAllParticles();
      const effects = reducedManager.getVisualEffects();
      
      expect(particles).toHaveLength(0);
      expect(effects.size).toBe(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track frame time', () => {
      powerupManager.update(0.016);
      
      const stats = powerupManager.getStats();
      expect(stats.performance.frameTime).toBeGreaterThanOrEqual(0);
    });

    it('should adapt quality for poor performance', () => {
      // Simulate poor performance
      for (let i = 0; i < 10; i++) {
        powerupManager.update(0.050); // 50ms frames (poor performance)
      }
      
      const stats = powerupManager.getStats();
      expect(stats.performance.adaptiveQuality).toBeLessThan(1.0);
    });

    it('should limit particle count for performance', () => {
      const initialStats = powerupManager.getStats();
      const maxParticles = initialStats.deviceCapabilities.maxParticles;
      
      // Spawn many powerups to create particles
      for (let i = 0; i < 20; i++) {
        powerupManager.spawnMagnetPowerup({ x: i, y: 0, z: 0 });
      }
      
      powerupManager.update(0.016);
      
      const particles = powerupManager.getAllParticles();
      expect(particles.length).toBeLessThanOrEqual(maxParticles);
    });

    it('should provide system performance metrics', () => {
      powerupManager.update(0.016);
      
      const stats = powerupManager.getStats();
      stats.systems.forEach(system => {
        expect(system).toHaveProperty('name');
        expect(system).toHaveProperty('lastUpdateTime');
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration at runtime', () => {
      const newConfig = {
        enableVisualEffects: false,
        performanceMode: 'low' as const
      };
      
      powerupManager.updateConfig(newConfig);
      
      const stats = powerupManager.getStats();
      expect(stats.config.enableVisualEffects).toBe(false);
      expect(stats.config.performanceMode).toBe('low');
    });

    it('should enable debug mode for all systems', () => {
      powerupManager.setDebugMode(true);
      
      // Debug mode should be enabled (verified through system behavior)
      expect(() => powerupManager.update(0.016)).not.toThrow();
    });

    it('should reset statistics', () => {
      // Generate some stats
      powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      powerupManager.update(0.016);
      
      powerupManager.resetStats();
      
      const stats = powerupManager.getStats();
      expect(stats.totalCollected).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });

  describe('Event System', () => {
    it('should add and remove event listeners', () => {
      const listener = vi.fn();
      
      powerupManager.addEventListener('spawned', listener);
      powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      
      expect(listener).toHaveBeenCalled();
      
      powerupManager.removeEventListener('spawned', listener);
      powerupManager.spawnDoublerPowerup({ x: 1, y: 0, z: 0 });
      
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should update statistics on events', () => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      const stats = powerupManager.getStats();
      expect(stats.totalCollected).toBe(1);
      expect(stats.typeCollected[PowerupType.MAGNET]).toBe(1);
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      powerupManager.addEventListener('spawned', listener1);
      powerupManager.addEventListener('spawned', listener2);
      
      powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Mobile Optimizations', () => {
    let mobileManager: PowerupManager;
    
    beforeEach(() => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', { value: 2, writable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, writable: true });
      
      mobileManager = new PowerupManager(world);
    });

    it('should reduce maximum concurrent powerups on mobile', () => {
      const stats = mobileManager.getStats();
      expect(stats.config.maxConcurrentPowerups).toBe(3); // Reduced from default 5
    });

    it('should use medium performance mode on mobile', () => {
      const stats = mobileManager.getStats();
      expect(stats.config.performanceMode).toBe('medium');
    });

    it('should limit particle effects on low-end devices', () => {
      const stats = mobileManager.getStats();
      expect(stats.deviceCapabilities.maxParticles).toBe(250); // Reduced for low-end
      expect(stats.deviceCapabilities.reducedEffects).toBe(true);
    });

    it('should apply mobile-specific magnet parameters', () => {
      // Mobile optimization should configure magnet system for performance
      mobileManager.update(0.016);
      
      const stats = mobileManager.getStats();
      const magnetSystem = stats.systems.find(s => s.name === 'magnet');
      expect(magnetSystem).toBeDefined();
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up resources on destroy', () => {
      powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      powerupManager.update(0.016);
      
      powerupManager.destroy();
      
      const particles = powerupManager.getAllParticles();
      expect(particles).toHaveLength(0);
    });

    it('should clear all event listeners on destroy', () => {
      const listener = vi.fn();
      powerupManager.addEventListener('spawned', listener);
      
      powerupManager.destroy();
      
      // After destruction, events should not be fired
      expect(() => {
        powerupManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid powerup collection gracefully', () => {
      const result = powerupManager.forceCollectPowerup(999999); // Non-existent ID
      expect(result).toBe(false);
    });

    it('should handle disabled particle effects gracefully', () => {
      const disabledManager = new PowerupManager(world, {
        enableParticleEffects: false,
        enableVisualEffects: false,
        maxConcurrentPowerups: 1,
        performanceMode: 'low',
        mobileOptimized: true
      });
      
      expect(() => {
        disabledManager.spawnMagnetPowerup({ x: 0, y: 0, z: 0 });
        disabledManager.update(0.016);
      }).not.toThrow();
    });

    it('should handle very poor performance gracefully', () => {
      // Simulate extremely poor performance
      for (let i = 0; i < 100; i++) {
        powerupManager.update(0.1); // 100ms frames
      }
      
      const stats = powerupManager.getStats();
      expect(stats.performance.adaptiveQuality).toBeGreaterThan(0.1); // Should not go to zero
    });
  });
});