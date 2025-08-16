import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@/core/ecs/World';
import { ScoreSystem } from '@/systems/score/ScoreSystem';
import { createScoreComponent } from '@/components/score/ScoreComponent';
import { createComboComponent } from '@/components/score/ComboComponent';
import { createPowerupComponent } from '@/components/score/PowerupComponent';
import { createProgressionComponent } from '@/components/score/ProgressionComponent';
import { createHighScoreComponent } from '@/components/score/HighScoreComponent';

describe('ScoreSystem', () => {
  let world: World;
  let scoreSystem: ScoreSystem;
  let entityId: number;

  beforeEach(() => {
    world = new World();
    scoreSystem = new ScoreSystem();
    scoreSystem.initialize(world);
    
    // Create test entity with all scoring components
    entityId = world.createEntity();
    world.addComponent(entityId, createScoreComponent());
    world.addComponent(entityId, createComboComponent());
    world.addComponent(entityId, createPowerupComponent());
    world.addComponent(entityId, createProgressionComponent());
    world.addComponent(entityId, createHighScoreComponent());
  });

  describe('Coin Collection (Original Mechanics)', () => {
    it('should award 10 points for coin collection (faithful to original)', () => {
      const points = scoreSystem.handleCoinCollection(entityId, 10, { x: 0, y: 0, z: 0 });
      
      expect(points).toBe(10);
      
      const scoreComponent = world.getComponent(entityId, 'score');
      expect(scoreComponent.currentScore).toBe(10);
      expect(scoreComponent.totalCoinsCollected).toBe(1);
    });

    it('should apply doubler powerup correctly (2x multiplier)', () => {
      const powerupComponent = world.getComponent(entityId, 'powerup');
      powerupComponent.doublerActive = true;
      powerupComponent.doublerMultiplier = 2;
      
      const points = scoreSystem.handleCoinCollection(entityId, 10);
      
      expect(points).toBe(20); // 10 * 2x doubler
    });

    it('should apply combo multipliers correctly', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Simulate active combo with 2x multiplier
      comboComponent.isComboActive = true;
      comboComponent.currentCombo = 5;
      comboComponent.currentMultiplier = 2;
      comboComponent.comboTimeRemaining = 2000;
      
      const points = scoreSystem.handleCoinCollection(entityId, 10);
      
      expect(points).toBeGreaterThan(10); // Should include combo bonus
    });

    it('should combine doubler and combo multipliers', () => {
      const powerupComponent = world.getComponent(entityId, 'powerup');
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Enable doubler
      powerupComponent.doublerActive = true;
      powerupComponent.doublerMultiplier = 2;
      
      // Set combo multiplier
      comboComponent.isComboActive = true;
      comboComponent.currentMultiplier = 1.5;
      
      const points = scoreSystem.handleCoinCollection(entityId, 10);
      
      expect(points).toBe(30); // 10 * 2 (doubler) * 1.5 (combo)
    });
  });

  describe('Distance Scoring', () => {
    it('should award points for distance traveled', () => {
      const points = scoreSystem.handleDistanceScore(entityId, 100);
      
      expect(points).toBeGreaterThan(0);
      
      const scoreComponent = world.getComponent(entityId, 'score');
      expect(scoreComponent.totalDistanceTraveled).toBe(100);
    });

    it('should apply distance multipliers', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      scoreComponent.distanceMultiplier = 2;
      
      const points = scoreSystem.handleDistanceScore(entityId, 100);
      
      expect(points).toBe(200); // 100 * 1 (base) * 2 (multiplier)
    });
  });

  describe('Powerup Collection', () => {
    it('should activate doubler powerup (faithful to original)', () => {
      const success = scoreSystem.handlePowerupCollection(entityId, 'doubler');
      
      expect(success).toBe(true);
      
      const powerupComponent = world.getComponent(entityId, 'powerup');
      expect(powerupComponent.doublerActive).toBe(true);
      expect(powerupComponent.doublerTimeRemaining).toBeGreaterThan(0);
      expect(powerupComponent.doublersCollected).toBe(1);
    });

    it('should activate other powerup types', () => {
      const success = scoreSystem.handlePowerupCollection(entityId, 'speed_boost');
      
      expect(success).toBe(true);
      
      const powerupComponent = world.getComponent(entityId, 'powerup');
      expect(powerupComponent.activePowerups.has('speed_boost')).toBe(true);
    });

    it('should award bonus points for powerup collection', () => {
      const initialScore = world.getComponent(entityId, 'score').currentScore;
      
      scoreSystem.handlePowerupCollection(entityId, 'doubler');
      
      const finalScore = world.getComponent(entityId, 'score').currentScore;
      expect(finalScore).toBeGreaterThan(initialScore);
    });
  });

  describe('Player Damage', () => {
    it('should break combos on damage', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      
      // Set up active combo
      comboComponent.isComboActive = true;
      comboComponent.currentCombo = 10;
      
      scoreSystem.handlePlayerDamage(entityId);
      
      expect(comboComponent.isComboActive).toBe(false);
      expect(comboComponent.currentCombo).toBe(0);
    });

    it('should not break combos when invulnerable', () => {
      const comboComponent = world.getComponent(entityId, 'combo');
      const powerupComponent = world.getComponent(entityId, 'powerup');
      
      // Set up active combo and invulnerability
      comboComponent.isComboActive = true;
      comboComponent.currentCombo = 10;
      powerupComponent.invulnerabilityTime = 5000;
      
      scoreSystem.handlePlayerDamage(entityId);
      
      expect(comboComponent.isComboActive).toBe(true);
      expect(comboComponent.currentCombo).toBe(10);
    });
  });

  describe('Level Completion', () => {
    it('should award completion bonus', () => {
      const initialScore = world.getComponent(entityId, 'score').currentScore;
      
      scoreSystem.handleLevelComplete(entityId, 'level1', 100);
      
      const finalScore = world.getComponent(entityId, 'score').currentScore;
      expect(finalScore - initialScore).toBe(100);
    });

    it('should update session statistics', () => {
      scoreSystem.handleLevelComplete(entityId, 'level1', 100);
      
      const scoreComponent = world.getComponent(entityId, 'score');
      expect(scoreComponent.sessionsPlayed).toBe(1);
    });

    it('should check for level unlocks (300 point threshold)', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      const progressionComponent = world.getComponent(entityId, 'progression');
      
      // Set score to 300 (Level 2 unlock threshold)
      scoreComponent.currentScore = 300;
      
      scoreSystem.handleLevelComplete(entityId, 'level1', 0);
      
      expect(progressionComponent.levelsUnlocked.has(2)).toBe(true);
    });

    it('should update high scores', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      const highScoreComponent = world.getComponent(entityId, 'highScore');
      
      scoreComponent.currentScore = 500;
      
      scoreSystem.handleLevelComplete(entityId, 'level1', 0);
      
      expect(highScoreComponent.globalHighScore).toBe(500);
      expect(highScoreComponent.levelHighScores.get('level1')).toBe(500);
    });
  });

  describe('System Updates', () => {
    it('should update all score entities', () => {
      const spy = vi.spyOn(scoreSystem as any, 'updateScoreEntity');
      
      scoreSystem.update(0.016); // 60 FPS
      
      expect(spy).toHaveBeenCalledWith(entityId, 0.016);
    });

    it('should process pending score events', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      
      // Add a pending score event
      scoreComponent.pendingScoreEvents.push({
        type: 'coin',
        points: 10,
        timestamp: performance.now(),
        processed: false
      });
      
      scoreSystem.update(0.016);
      
      expect(scoreComponent.pendingScoreEvents[0].processed).toBe(true);
    });

    it('should update powerup timers', () => {
      const powerupComponent = world.getComponent(entityId, 'powerup');
      
      // Activate doubler
      powerupComponent.doublerActive = true;
      powerupComponent.doublerTimeRemaining = 1000;
      
      scoreSystem.update(0.5); // 500ms
      
      expect(powerupComponent.doublerTimeRemaining).toBeLessThan(1000);
    });
  });

  describe('Event Handling', () => {
    it('should handle coin_collected events', () => {
      const spy = vi.spyOn(scoreSystem, 'handleCoinCollection');
      
      world.emit('coin_collected', {
        entityId,
        value: 10,
        position: { x: 0, y: 0, z: 0 }
      });
      
      expect(spy).toHaveBeenCalledWith(entityId, 10, { x: 0, y: 0, z: 0 });
    });

    it('should handle powerup_collected events', () => {
      const spy = vi.spyOn(scoreSystem, 'handlePowerupCollection');
      
      world.emit('powerup_collected', {
        entityId,
        powerupType: 'doubler',
        position: { x: 0, y: 0, z: 0 }
      });
      
      expect(spy).toHaveBeenCalledWith(entityId, 'doubler', { x: 0, y: 0, z: 0 });
    });

    it('should handle player_damaged events', () => {
      const spy = vi.spyOn(scoreSystem, 'handlePlayerDamage');
      
      world.emit('player_damaged', { entityId });
      
      expect(spy).toHaveBeenCalledWith(entityId);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      scoreComponent.currentScore = 100;
      scoreComponent.totalCoinsCollected = 5;
      scoreComponent.totalDistanceTraveled = 200;
      
      const stats = scoreSystem.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalEntities).toBe(1);
      expect(stats.totalScore).toBe(100);
      expect(stats.totalCoins).toBe(5);
      expect(stats.totalDistance).toBe(200);
    });
  });

  describe('Performance', () => {
    it('should handle multiple entities efficiently', () => {
      // Create multiple entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        const id = world.createEntity();
        world.addComponent(id, createScoreComponent());
        entities.push(id);
      }
      
      const startTime = performance.now();
      scoreSystem.update(0.016);
      const endTime = performance.now();
      
      // Should complete within reasonable time (< 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should throttle score calculations appropriately', () => {
      const spy = vi.spyOn(scoreSystem as any, 'updateScoreEntity');
      
      // Multiple rapid updates
      for (let i = 0; i < 10; i++) {
        scoreSystem.update(0.001); // 1ms updates
      }
      
      // Should not call update for every frame
      expect(spy.mock.calls.length).toBeLessThan(10);
    });
  });

  describe('Integration with Other Systems', () => {
    it('should sync powerup effects to score component', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      const powerupComponent = world.getComponent(entityId, 'powerup');
      
      // Activate doubler powerup
      powerupComponent.doublerActive = true;
      powerupComponent.doublerTimeRemaining = 10000;
      powerupComponent.scoreMultiplier = 2;
      
      scoreSystem.update(0.016);
      
      expect(scoreComponent.doublerActive).toBe(true);
      expect(scoreComponent.scoreMultiplier).toBe(2);
    });

    it('should update progression based on score', () => {
      const scoreComponent = world.getComponent(entityId, 'score');
      const progressionComponent = world.getComponent(entityId, 'progression');
      
      scoreComponent.currentScore = 1000;
      
      scoreSystem.update(0.016);
      
      // Should trigger achievement progress updates
      const achievement = progressionComponent.achievements.get('high_scorer');
      expect(achievement?.progress).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing components gracefully', () => {
      const emptyEntityId = world.createEntity();
      
      expect(() => {
        scoreSystem.handleCoinCollection(emptyEntityId, 10);
      }).not.toThrow();
      
      const result = scoreSystem.handleCoinCollection(emptyEntityId, 10);
      expect(result).toBe(0);
    });

    it('should validate score increments', () => {
      expect(() => {
        scoreSystem.handleCoinCollection(entityId, NaN);
      }).not.toThrow();
      
      expect(() => {
        scoreSystem.handleCoinCollection(entityId, -10);
      }).not.toThrow();
    });
  });
});
