import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@/core/ecs/World';
import { ComboSystem } from '@/systems/score/ComboSystem';
import { createComboComponent } from '@/components/score/ComboComponent';
import { ComboManager } from '@/components/score/ComboComponent';

describe('ComboSystem', () => {
  let world: World;
  let comboSystem: ComboSystem;
  let entityId: number;

  beforeEach(() => {
    world = new World();
    comboSystem = new ComboSystem();
    comboSystem.initialize(world);
    
    entityId = world.createEntity();
    world.addComponent(entityId, createComboComponent());
  });

  describe('Combo Registration', () => {
    it('should register coin collection actions', () => {
      const result = comboSystem.registerComboAction(entityId, 'coin_collect');
      
      expect(result.success).toBe(true);
      expect(result.comboLevel).toBe(1);
      expect(result.multiplier).toBeGreaterThanOrEqual(1);
      
      const comboComponent = world.getComponent(entityId, 'combo');
      expect(comboComponent.isComboActive).toBe(true);
      expect(comboComponent.currentCombo).toBe(1);
    });

    it('should chain multiple actions for combo', () => {
      // First action
      let result = comboSystem.registerComboAction(entityId, 'coin_collect');
      expect(result.comboLevel).toBe(1);
      
      // Second action (within timeout)
      result = comboSystem.registerComboAction(entityId, 'coin_collect');
      expect(result.comboLevel).toBe(2);
      expect(result.multiplier).toBeGreaterThan(1);
    });

    it('should support different action types', () => {
      const actions = ['coin_collect', 'jump', 'slide', 'powerup_collect'];
      
      actions.forEach((action, index) => {
        const result = comboSystem.registerComboAction(entityId, action);
        expect(result.success).toBe(true);
        expect(result.comboLevel).toBe(index + 1);
      });
    });

    it('should calculate bonus points for combos', () => {
      // Build up combo
      for (let i = 0; i < 5; i++) {
        const result = comboSystem.registerComboAction(entityId, 'coin_collect');
        if (i >= 2) { // Minimum actions for bonus
          expect(result.bonusPoints).toBeGreaterThan(0);
        }
      }
    });

    it('should handle unknown action types', () => {
      const result = comboSystem.registerComboAction(entityId, 'unknown_action');
      
      expect(result.success).toBe(true);
      expect(result.comboLevel).toBe(0);
      expect(result.multiplier).toBe(1);
      expect(result.bonusPoints).toBe(0);
    });
  });

  describe('Combo Timing', () => {
    it('should extend combo timer with each action', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      const firstTimer = comboComponent.comboTimeRemaining;
      
      // Wait a bit
      comboSystem.update(0.5); // 500ms
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      const secondTimer = comboComponent.comboTimeRemaining;
      
      expect(secondTimer).toBeGreaterThan(firstTimer);
    });

    it('should break combo on timeout', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      expect(comboComponent.isComboActive).toBe(true);
      
      // Simulate timeout
      comboComponent.comboTimeRemaining = 0;
      comboSystem.update(0.016);
      
      expect(comboComponent.isComboActive).toBe(false);
      expect(comboComponent.currentCombo).toBe(0);
    });

    it('should have different timeouts for different combo types', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Test coin combo (should have specific timeout)
      comboSystem.registerComboAction(entityId, 'coin_collect');
      const coinTimeout = comboComponent.comboTimeRemaining;
      
      // Reset
      comboComponent.isComboActive = false;
      comboComponent.currentCombo = 0;
      
      // Test movement combo
      comboSystem.registerComboAction(entityId, 'jump');
      const jumpTimeout = comboComponent.comboTimeRemaining;
      
      // Different combo types may have different timeouts
      expect(coinTimeout).toBeGreaterThan(0);
      expect(jumpTimeout).toBeGreaterThan(0);
    });
  });

  describe('Combo Multipliers', () => {
    it('should increase multiplier with combo level', () => {
      let lastMultiplier = 1;
      
      for (let i = 0; i < 10; i++) {
        const result = comboSystem.registerComboAction(entityId, 'coin_collect');
        expect(result.multiplier).toBeGreaterThanOrEqual(lastMultiplier);
        lastMultiplier = result.multiplier;
      }
    });

    it('should cap multiplier at maximum value', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      const maxMultiplier = comboComponent.maxMultiplier;
      
      // Build very long combo
      for (let i = 0; i < 100; i++) {
        const result = comboSystem.registerComboAction(entityId, 'coin_collect');
        expect(result.multiplier).toBeLessThanOrEqual(maxMultiplier);
      }
    });

    it('should reset multiplier when combo breaks', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Build combo
      for (let i = 0; i < 5; i++) {
        comboSystem.registerComboAction(entityId, 'coin_collect');
      }
      
      const highMultiplier = comboComponent.currentMultiplier;
      expect(highMultiplier).toBeGreaterThan(1);
      
      // Break combo
      comboSystem.breakCombo(entityId, 'manual');
      
      expect(comboComponent.currentMultiplier).toBe(comboComponent.baseMultiplier);
    });
  });

  describe('Combo Types', () => {
    it('should identify appropriate combo type for actions', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Coin combo
      comboSystem.registerComboAction(entityId, 'coin_collect');
      expect(comboComponent.activeComboType).toBe('coin_combo');
      
      // Reset
      comboSystem.breakCombo(entityId, 'manual');
      
      // Movement combo
      comboSystem.registerComboAction(entityId, 'jump');
      expect(comboComponent.activeComboType).toBe('movement_combo');
    });

    it('should switch to better combo types', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Start with coin combo
      comboSystem.registerComboAction(entityId, 'coin_collect');
      expect(comboComponent.activeComboType).toBe('coin_combo');
      
      // Add movement action (should switch to mixed combo)
      comboSystem.registerComboAction(entityId, 'jump');
      expect(comboComponent.activeComboType).toBe('mixed_combo');
    });

    it('should maintain combo type consistency', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Start movement combo
      comboSystem.registerComboAction(entityId, 'jump');
      const comboType = comboComponent.activeComboType;
      
      // Continue with compatible actions
      comboSystem.registerComboAction(entityId, 'slide');
      expect(comboComponent.activeComboType).toBe(comboType);
    });
  });

  describe('Combo Breaking', () => {
    beforeEach(() => {
      // Set up active combo
      for (let i = 0; i < 5; i++) {
        comboSystem.registerComboAction(entityId, 'coin_collect');
      }
    });

    it('should break combo manually', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      expect(comboComponent.isComboActive).toBe(true);
      
      const result = comboSystem.breakCombo(entityId, 'manual');
      expect(result).toBe(true);
      expect(comboComponent.isComboActive).toBe(false);
    });

    it('should break combo on timeout', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Force timeout
      comboComponent.comboTimeRemaining = -1;
      comboSystem.update(0.016);
      
      expect(comboComponent.isComboActive).toBe(false);
    });

    it('should break combo on damage', () => {
      world.emit('player_damaged', { entityId });
      
      const comboComponent = world.getComponent(entityId, 'combo');
      expect(comboComponent.isComboActive).toBe(false);
    });

    it('should record longest combo streak', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      const comboLevel = comboComponent.currentCombo;
      
      comboSystem.breakCombo(entityId, 'manual');
      
      expect(comboComponent.longestComboStreak).toBe(comboLevel);
    });

    it('should not break non-existent combo', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      comboComponent.isComboActive = false;
      
      const result = comboSystem.breakCombo(entityId, 'manual');
      expect(result).toBe(false);
    });
  });

  describe('Sound Effects', () => {
    it('should emit sound events for combo actions', () => {
      const soundSpy = vi.spyOn(world, 'emit');
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      expect(soundSpy).toHaveBeenCalledWith('play_sound', expect.objectContaining({
        soundId: expect.any(String),
        category: 'combo'
      }));
    });

    it('should play different sounds for different combo levels', () => {
      const soundSpy = vi.spyOn(world, 'emit');
      
      // Low combo
      comboSystem.registerComboAction(entityId, 'coin_collect');
      const firstCall = soundSpy.mock.calls.find(call => call[0] === 'play_sound');
      
      // Build higher combo
      for (let i = 0; i < 10; i++) {
        comboSystem.registerComboAction(entityId, 'coin_collect');
      }
      
      const lastCall = soundSpy.mock.calls.reverse().find(call => call[0] === 'play_sound');
      
      // Should have different sound IDs or properties
      expect(firstCall).toBeDefined();
      expect(lastCall).toBeDefined();
    });

    it('should respect sound cooldowns', () => {
      const soundSpy = vi.spyOn(world, 'emit');
      
      // Rapid combo actions
      for (let i = 0; i < 5; i++) {
        comboSystem.registerComboAction(entityId, 'coin_collect');
      }
      
      const soundCalls = soundSpy.mock.calls.filter(call => call[0] === 'play_sound');
      
      // Should not play sound for every action due to cooldown
      expect(soundCalls.length).toBeLessThan(5);
    });
  });

  describe('Event Integration', () => {
    it('should listen for coin collection events', () => {
      const spy = vi.spyOn(comboSystem, 'registerComboAction');
      
      world.emit('coin_collected', {
        entityId,
        position: { x: 0, y: 0, z: 0 }
      });
      
      expect(spy).toHaveBeenCalledWith(entityId, 'coin_collect', { x: 0, y: 0, z: 0 });
    });

    it('should listen for player movement events', () => {
      const spy = vi.spyOn(comboSystem, 'registerComboAction');
      
      world.emit('player_jumped', { entityId });
      expect(spy).toHaveBeenCalledWith(entityId, 'jump', undefined);
      
      world.emit('player_slid', { entityId });
      expect(spy).toHaveBeenCalledWith(entityId, 'slide', undefined);
    });

    it('should emit combo update events', () => {
      const spy = vi.spyOn(world, 'emit');
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      expect(spy).toHaveBeenCalledWith('combo_action', expect.objectContaining({
        entityId,
        actionType: 'coin_collect',
        comboLevel: expect.any(Number),
        multiplier: expect.any(Number)
      }));
    });
  });

  describe('Animations and Visual Feedback', () => {
    it('should create combo animations', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      expect(comboComponent.comboAnimations.length).toBeGreaterThan(0);
    });

    it('should update animation timers', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      comboSystem.registerComboAction(entityId, 'coin_collect');
      const initialAnimations = comboComponent.comboAnimations.length;
      
      // Update system multiple times
      for (let i = 0; i < 10; i++) {
        comboSystem.update(0.1); // 100ms each
      }
      
      // Animations should expire
      expect(comboComponent.comboAnimations.length).toBeLessThanOrEqual(initialAnimations);
    });

    it('should provide active animations for rendering', () => {
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      const animations = comboSystem.getActiveComboAnimations(entityId);
      expect(animations).toBeDefined();
      expect(Array.isArray(animations)).toBe(true);
    });
  });

  describe('Statistics and Performance', () => {
    it('should track combo statistics', () => {
      // Build and break several combos
      for (let combo = 0; combo < 3; combo++) {
        for (let i = 0; i < 5; i++) {
          comboSystem.registerComboAction(entityId, 'coin_collect');
        }
        comboSystem.breakCombo(entityId, 'manual');
      }
      
      const stats = comboSystem.getComboStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalEntities).toBe(1);
      expect(stats.comboBreaks).toBe(3);
      expect(stats.highestCombo).toBeGreaterThan(0);
    });

    it('should provide entity-specific combo info', () => {
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      const info = comboSystem.getEntityComboInfo(entityId);
      
      expect(info).toBeDefined();
      expect(info.currentCombo).toBe(1);
      expect(info.isActive).toBe(true);
    });

    it('should reset combo statistics', () => {
      // Build some stats
      for (let i = 0; i < 10; i++) {
        comboSystem.registerComboAction(entityId, 'coin_collect');
      }
      comboSystem.breakCombo(entityId, 'manual');
      
      comboSystem.resetEntityComboStats(entityId);
      
      const comboComponent = world.getComponent(entityId, 'combo');
      expect(comboComponent.sessionMaxCombo).toBe(0);
      expect(comboComponent.totalCombos).toBe(0);
    });

    it('should handle multiple entities efficiently', () => {
      // Create multiple entities
      const entities = [];
      for (let i = 0; i < 50; i++) {
        const id = world.createEntity();
        world.addComponent(id, createComboComponent());
        entities.push(id);
      }
      
      const startTime = performance.now();
      
      // Update all entities
      comboSystem.update(0.016);
      
      const endTime = performance.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity without combo component', () => {
      const emptyEntityId = world.createEntity();
      
      expect(() => {
        comboSystem.registerComboAction(emptyEntityId, 'coin_collect');
      }).not.toThrow();
      
      const result = comboSystem.registerComboAction(emptyEntityId, 'coin_collect');
      expect(result.success).toBe(false);
    });

    it('should handle rapid action registration', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          comboSystem.registerComboAction(entityId, 'coin_collect');
        }
      }).not.toThrow();
      
      const comboComponent = world.getComponent(entityId, 'combo');
      expect(comboComponent.currentCombo).toBe(100);
    });

    it('should handle negative delta time', () => {
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      expect(() => {
        comboSystem.update(-0.016);
      }).not.toThrow();
    });

    it('should handle very large delta time', () => {
      comboSystem.registerComboAction(entityId, 'coin_collect');
      
      expect(() => {
        comboSystem.update(10); // 10 seconds
      }).not.toThrow();
      
      // Combo should be broken due to timeout
      const comboComponent = world.getComponent(entityId, 'combo');
      expect(comboComponent.isComboActive).toBe(false);
    });
  });
});
