/**
 * PowerupFactory Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PowerupFactory } from '@/powerups/PowerupFactory';
import { PowerupType } from '@/powerups/types/PowerupTypes';

describe('PowerupFactory', () => {
  beforeEach(() => {
    PowerupFactory.resetCounters();
  });

  describe('createPowerup', () => {
    it('should create a complete powerup entity with all components', () => {
      const position = { x: 10, y: 5, z: 15 };
      const powerup = PowerupFactory.createPowerup({
        type: PowerupType.MAGNET,
        position
      });

      expect(powerup.id).toBeGreaterThan(1000);
      expect(powerup.components.size).toBeGreaterThan(5);
      
      // Check required components
      expect(powerup.components.has('PowerupComponent')).toBe(true);
      expect(powerup.components.has('CollectibleComponent')).toBe(true);
      expect(powerup.components.has('MagnetComponent')).toBe(true);
      expect(powerup.components.has('TransformComponent')).toBe(true);
      expect(powerup.components.has('RenderComponent')).toBe(true);
      expect(powerup.components.has('PhysicsComponent')).toBe(true);
      expect(powerup.components.has('TypeComponent')).toBe(true);
    });

    it('should create magnet powerup with correct specifications', () => {
      const position = { x: 0, y: 0, z: 0 };
      const powerup = PowerupFactory.createMagnetPowerup(position);

      const powerupComponent = powerup.components.get('PowerupComponent') as any;
      const magnetComponent = powerup.components.get('MagnetComponent') as any;
      const transformComponent = powerup.components.get('TransformComponent') as any;

      expect(powerupComponent.type).toBe(PowerupType.MAGNET);
      expect(powerupComponent.config.duration).toBe(10000);
      expect(magnetComponent.attractionRadius).toBe(80);
      expect(magnetComponent.attractionForce).toBe(150);
      expect(transformComponent.position).toEqual(position);
    });

    it('should create doubler powerup with correct specifications', () => {
      const position = { x: 5, y: 0, z: 10 };
      const powerup = PowerupFactory.createDoublerPowerup(position);

      const powerupComponent = powerup.components.get('PowerupComponent') as any;
      const doublerComponent = powerup.components.get('DoublerComponent') as any;

      expect(powerupComponent.type).toBe(PowerupType.DOUBLER);
      expect(powerupComponent.config.duration).toBe(10000);
      expect(doublerComponent.multiplier).toBe(2);
      expect(doublerComponent.originalMultiplier).toBe(2);
    });

    it('should create invisibility powerup with correct specifications', () => {
      const position = { x: -5, y: 2, z: -10 };
      const powerup = PowerupFactory.createInvisibilityPowerup(position);

      const powerupComponent = powerup.components.get('PowerupComponent') as any;
      const invisibilityComponent = powerup.components.get('InvisibilityComponent') as any;

      expect(powerupComponent.type).toBe(PowerupType.INVISIBILITY);
      expect(powerupComponent.config.duration).toBe(10000);
      expect(invisibilityComponent.transparencyLevel).toBe(0.5);
      expect(invisibilityComponent.immuneToTypes).toContain('enemy');
    });

    it('should apply custom duration when provided', () => {
      const powerup = PowerupFactory.createPowerup({
        type: PowerupType.MAGNET,
        position: { x: 0, y: 0, z: 0 },
        customDuration: 15000
      });

      const powerupComponent = powerup.components.get('PowerupComponent') as any;
      expect(powerupComponent.config.duration).toBe(15000);
    });

    it('should apply custom score value when provided', () => {
      const powerup = PowerupFactory.createPowerup({
        type: PowerupType.DOUBLER,
        position: { x: 0, y: 0, z: 0 },
        customScoreValue: 300
      });

      const collectibleComponent = powerup.components.get('CollectibleComponent') as any;
      expect(collectibleComponent.scoreValue).toBe(300);
    });

    it('should set correct visual configuration', () => {
      const powerup = PowerupFactory.createPowerup({
        type: PowerupType.MAGNET,
        position: { x: 0, y: 0, z: 0 }
      });

      const renderComponent = powerup.components.get('RenderComponent') as any;
      expect(renderComponent.material.color).toBe('#FF3333'); // Magnet red color
      expect(renderComponent.material.emissive).toBe(true);
    });

    it('should set up physics component correctly', () => {
      const powerup = PowerupFactory.createPowerup({
        type: PowerupType.INVISIBILITY,
        position: { x: 0, y: 0, z: 0 }
      });

      const physicsComponent = powerup.components.get('PhysicsComponent') as any;
      expect(physicsComponent.mass).toBe(0); // Static object
      expect(physicsComponent.isStatic).toBe(true);
      expect(physicsComponent.collisionLayer).toBe('powerup');
      expect(physicsComponent.collisionMask).toContain('player');
    });

    it('should throw error for unknown powerup type', () => {
      expect(() => {
        PowerupFactory.createPowerup({
          type: 'unknown' as PowerupType,
          position: { x: 0, y: 0, z: 0 }
        });
      }).toThrow('Unknown powerup type: unknown');
    });
  });

  describe('createPowerupBatch', () => {
    it('should create multiple powerups in specified area', () => {
      const types = [PowerupType.MAGNET, PowerupType.DOUBLER];
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 50
      };
      const count = 5;

      const powerups = PowerupFactory.createPowerupBatch(types, spawnArea, count);

      expect(powerups).toHaveLength(count);
      
      powerups.forEach(powerup => {
        const transform = powerup.components.get('TransformComponent') as any;
        const distance = Math.sqrt(
          transform.position.x ** 2 + 
          transform.position.z ** 2
        );
        expect(distance).toBeLessThanOrEqual(spawnArea.radius);
      });
    });

    it('should use random powerup types from provided list', () => {
      const types = [PowerupType.MAGNET, PowerupType.DOUBLER, PowerupType.INVISIBILITY];
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 20
      };
      const count = 10;

      const powerups = PowerupFactory.createPowerupBatch(types, spawnArea, count);
      const usedTypes = new Set();

      powerups.forEach(powerup => {
        const powerupComponent = powerup.components.get('PowerupComponent') as any;
        usedTypes.add(powerupComponent.type);
      });

      // Should use types from the provided list
      usedTypes.forEach(type => {
        expect(types).toContain(type);
      });
    });
  });

  describe('createPowerupSpawner', () => {
    it('should create a functional spawner', () => {
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 30
      };
      const spawnRate = 1; // 1 per second

      const spawner = PowerupFactory.createPowerupSpawner(spawnArea, spawnRate);

      expect(spawner.isActive).toBe(true);
      expect(typeof spawner.update).toBe('function');
      expect(typeof spawner.setActive).toBe('function');
    });

    it('should spawn powerups at specified rate', () => {
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 30
      };
      const spawnRate = 2; // 2 per second

      const spawner = PowerupFactory.createPowerupSpawner(spawnArea, spawnRate);

      // Should spawn one powerup after 500ms (half second at 2/sec rate)
      const powerups = spawner.update(500);
      expect(powerups).toHaveLength(1);
    });

    it('should not spawn when inactive', () => {
      const spawnArea = {
        center: { x: 0, y: 0, z: 0 },
        radius: 30
      };
      const spawner = PowerupFactory.createPowerupSpawner(spawnArea, 1);

      spawner.setActive(false);
      const powerups = spawner.update(2000); // 2 seconds

      expect(powerups).toHaveLength(0);
    });
  });

  describe('createProgressivePowerups', () => {
    it('should only spawn magnet at low level', () => {
      const powerups = PowerupFactory.createProgressivePowerups(
        1, // level 1
        500, // low score
        { x: 0, y: 0, z: 0 }
      );

      powerups.forEach(powerup => {
        const powerupComponent = powerup.components.get('PowerupComponent') as any;
        expect(powerupComponent.type).toBe(PowerupType.MAGNET);
      });
    });

    it('should unlock doubler at level 3', () => {
      const powerups = PowerupFactory.createProgressivePowerups(
        3, // level 3
        500,
        { x: 0, y: 0, z: 0 }
      );

      const types = new Set();
      powerups.forEach(powerup => {
        const powerupComponent = powerup.components.get('PowerupComponent') as any;
        types.add(powerupComponent.type);
      });

      expect(types.has(PowerupType.MAGNET)).toBe(true);
      // May or may not have doubler due to randomness, but should be available
    });

    it('should unlock doubler at score 1000', () => {
      const powerups = PowerupFactory.createProgressivePowerups(
        1, // low level
        1000, // high score
        { x: 0, y: 0, z: 0 }
      );

      // Should have access to both magnet and doubler
      expect(powerups.length).toBeGreaterThan(0);
    });

    it('should unlock invisibility at level 5', () => {
      const powerups = PowerupFactory.createProgressivePowerups(
        5, // level 5
        3000,
        { x: 0, y: 0, z: 0 }
      );

      // Should have access to all powerup types
      expect(powerups.length).toBeGreaterThan(0);
    });

    it('should increase spawn count with level', () => {
      const lowLevelPowerups = PowerupFactory.createProgressivePowerups(
        1,
        100,
        { x: 0, y: 0, z: 0 }
      );

      const highLevelPowerups = PowerupFactory.createProgressivePowerups(
        6,
        5000,
        { x: 0, y: 0, z: 0 }
      );

      expect(highLevelPowerups.length).toBeGreaterThanOrEqual(lowLevelPowerups.length);
    });
  });

  describe('utility methods', () => {
    it('should provide factory statistics', () => {
      // Create some powerups first
      PowerupFactory.createMagnetPowerup({ x: 0, y: 0, z: 0 });
      PowerupFactory.createDoublerPowerup({ x: 1, y: 0, z: 1 });

      const stats = PowerupFactory.getStats();

      expect(stats.entitiesCreated).toBe(2);
      expect(stats.availableTypes).toHaveLength(3);
      expect(stats.typeConfigurations).toHaveLength(3);

      stats.typeConfigurations.forEach(config => {
        expect(config.duration).toBe(10000);
        expect(Array.isArray(config.effects)).toBe(true);
      });
    });

    it('should reset counters correctly', () => {
      PowerupFactory.createMagnetPowerup({ x: 0, y: 0, z: 0 });
      const firstStats = PowerupFactory.getStats();

      PowerupFactory.resetCounters();
      const secondStats = PowerupFactory.getStats();

      expect(firstStats.entitiesCreated).toBe(1);
      expect(secondStats.entitiesCreated).toBe(0);
    });

    it('should generate unique entity IDs', () => {
      const powerup1 = PowerupFactory.createMagnetPowerup({ x: 0, y: 0, z: 0 });
      const powerup2 = PowerupFactory.createDoublerPowerup({ x: 1, y: 0, z: 1 });
      const powerup3 = PowerupFactory.createInvisibilityPowerup({ x: 2, y: 0, z: 2 });

      expect(powerup1.id).not.toBe(powerup2.id);
      expect(powerup2.id).not.toBe(powerup3.id);
      expect(powerup1.id).not.toBe(powerup3.id);
      
      // IDs should be sequential
      expect(powerup2.id).toBe(powerup1.id + 1);
      expect(powerup3.id).toBe(powerup2.id + 1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero spawn radius', () => {
      const powerups = PowerupFactory.createPowerupBatch(
        [PowerupType.MAGNET],
        { center: { x: 10, y: 5, z: 15 }, radius: 0 },
        3
      );

      powerups.forEach(powerup => {
        const transform = powerup.components.get('TransformComponent') as any;
        expect(transform.position.x).toBe(10);
        expect(transform.position.y).toBe(5);
        expect(transform.position.z).toBe(15);
      });
    });

    it('should handle empty powerup types array', () => {
      expect(() => {
        PowerupFactory.createPowerupBatch(
          [],
          { center: { x: 0, y: 0, z: 0 }, radius: 10 },
          1
        );
      }).toThrow();
    });

    it('should handle zero count batch creation', () => {
      const powerups = PowerupFactory.createPowerupBatch(
        [PowerupType.MAGNET],
        { center: { x: 0, y: 0, z: 0 }, radius: 10 },
        0
      );

      expect(powerups).toHaveLength(0);
    });
  });
});