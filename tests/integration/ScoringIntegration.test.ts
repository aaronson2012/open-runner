import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '@/core/ecs/World';
import { ScoreSystem } from '@/systems/score/ScoreSystem';
import { ComboSystem } from '@/systems/score/ComboSystem';
import { ProgressionSystem } from '@/systems/score/ProgressionSystem';
import { PersistenceSystem } from '@/systems/score/PersistenceSystem';
import { ScoreUISystem } from '@/systems/ui/ScoreUISystem';
import { createScoreComponent } from '@/components/score/ScoreComponent';
import { createComboComponent } from '@/components/score/ComboComponent';
import { createPowerupComponent } from '@/components/score/PowerupComponent';
import { createProgressionComponent } from '@/components/score/ProgressionComponent';
import { createHighScoreComponent } from '@/components/score/HighScoreComponent';
import { createScoreDisplayComponent } from '@/components/ui/ScoreDisplayComponent';
import { createAchievementNotificationComponent } from '@/components/ui/AchievementNotificationComponent';

describe('Scoring System Integration', () => {
  let world: World;
  let scoreSystem: ScoreSystem;
  let comboSystem: ComboSystem;
  let progressionSystem: ProgressionSystem;
  let persistenceSystem: PersistenceSystem;
  let uiSystem: ScoreUISystem;
  let playerId: number;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Initialize world and systems
    world = new World();
    
    scoreSystem = new ScoreSystem();
    comboSystem = new ComboSystem();
    progressionSystem = new ProgressionSystem();
    persistenceSystem = new PersistenceSystem();
    uiSystem = new ScoreUISystem();
    
    // Initialize all systems
    scoreSystem.initialize(world);
    comboSystem.initialize(world);
    progressionSystem.initialize(world);
    persistenceSystem.initialize(world);
    uiSystem.initialize(world);
    
    // Create player entity with all components
    playerId = world.createEntity();
    world.addComponent(playerId, createScoreComponent());
    world.addComponent(playerId, createComboComponent());
    world.addComponent(playerId, createPowerupComponent());
    world.addComponent(playerId, createProgressionComponent());
    world.addComponent(playerId, createHighScoreComponent());
    world.addComponent(playerId, createScoreDisplayComponent());
    world.addComponent(playerId, createAchievementNotificationComponent());
  });

  afterEach(() => {
    // Clean up localStorage
    localStorage.clear();
  });

  describe('Complete Gameplay Flow', () => {
    it('should handle complete coin collection flow with combos and progression', async () => {
      // Simulate collecting 10 coins in sequence (building combo)
      for (let i = 0; i < 10; i++) {
        world.emit('coin_collected', {
          entityId: playerId,
          value: 10,
          position: { x: i * 10, y: 0, z: 0 }
        });
        
        // Update all systems
        scoreSystem.update(0.1); // 100ms between coins
        comboSystem.update(0.1);
        progressionSystem.update(0.1);
        uiSystem.update(0.1);
      }
      
      const scoreComponent = world.getComponent(playerId, 'score');
      const comboComponent = world.getComponent(playerId, 'combo');
      const progressionComponent = world.getComponent(playerId, 'progression');
      
      // Verify score calculation with combo multipliers
      expect(scoreComponent.currentScore).toBeGreaterThan(100); // More than base 10*10 due to combos
      expect(scoreComponent.totalCoinsCollected).toBe(10);
      
      // Verify combo system
      expect(comboComponent.isComboActive).toBe(true);
      expect(comboComponent.currentCombo).toBe(10);
      expect(comboComponent.currentMultiplier).toBeGreaterThan(1);
      
      // Verify progression tracking
      const coinAchievement = progressionComponent.achievements.get('coin_collector');
      expect(coinAchievement?.progress).toBe(10);
    });

    it('should handle doubler powerup collection and effect', () => {
      // Collect doubler powerup
      world.emit('powerup_collected', {
        entityId: playerId,
        powerupType: 'doubler',
        position: { x: 0, y: 0, z: 0 }
      });
      
      scoreSystem.update(0.016);
      
      // Verify doubler activation
      const powerupComponent = world.getComponent(playerId, 'powerup');
      expect(powerupComponent.doublerActive).toBe(true);
      expect(powerupComponent.doublerTimeRemaining).toBeGreaterThan(0);
      
      // Collect coin with doubler active
      const initialScore = world.getComponent(playerId, 'score').currentScore;
      
      world.emit('coin_collected', {
        entityId: playerId,
        value: 10
      });
      
      scoreSystem.update(0.016);
      
      const finalScore = world.getComponent(playerId, 'score').currentScore;
      expect(finalScore - initialScore).toBe(20); // 10 * 2 (doubler)
    });

    it('should handle level progression and unlocks (300 point threshold)', () => {
      const progressionComponent = world.getComponent(playerId, 'progression');
      
      // Initially only level 1 should be unlocked
      expect(progressionComponent.levelsUnlocked.has(1)).toBe(true);
      expect(progressionComponent.levelsUnlocked.has(2)).toBe(false);
      
      // Simulate reaching 300 points (Level 2 unlock threshold)
      const scoreComponent = world.getComponent(playerId, 'score');
      scoreComponent.currentScore = 300;
      
      // Update progression system
      progressionSystem.update(0.016);
      
      // Level 2 should now be unlocked
      expect(progressionComponent.levelsUnlocked.has(2)).toBe(true);
      
      // Should have pending unlock notification
      expect(progressionComponent.pendingRewards.length).toBeGreaterThan(0);
      const unlockReward = progressionComponent.pendingRewards.find(r => r.type === 'level_unlock');
      expect(unlockReward).toBeDefined();
    });

    it('should handle achievement unlocking and notifications', () => {
      const progressionComponent = world.getComponent(playerId, 'progression');
      const notificationComponent = world.getComponent(playerId, 'achievementNotification');
      
      // Collect first coin to unlock "First Steps" achievement
      world.emit('coin_collected', {
        entityId: playerId,
        value: 10
      });
      
      scoreSystem.update(0.016);
      progressionSystem.update(0.016);
      uiSystem.update(0.016);
      
      // Check achievement unlock
      const firstCoinAchievement = progressionComponent.achievements.get('first_coin');
      expect(firstCoinAchievement?.isUnlocked).toBe(true);
      
      // Check notification was queued
      expect(notificationComponent.notificationQueue.length).toBeGreaterThan(0);
      const achievementNotif = notificationComponent.notificationQueue.find(n => n.type === 'achievement');
      expect(achievementNotif).toBeDefined();
    });
  });

  describe('Data Persistence Integration', () => {
    it('should save and load high scores correctly', async () => {
      const highScoreComponent = world.getComponent(playerId, 'highScore');
      const scoreComponent = world.getComponent(playerId, 'score');
      
      // Set a high score
      scoreComponent.currentScore = 1500;
      
      // Complete level to trigger high score save
      world.emit('level_completed', {
        entityId: playerId,
        levelId: 'level1',
        bonus: 100
      });
      
      scoreSystem.update(0.016);
      
      // Verify high score was updated
      expect(highScoreComponent.globalHighScore).toBe(1500);
      expect(highScoreComponent.levelHighScores.get('level1')).toBe(1500);
      
      // Force save
      await persistenceSystem.saveAllData();
      
      // Verify localStorage contains the data
      const savedHighScore = localStorage.getItem('openRunner_highScore');
      expect(savedHighScore).toBe('1500');
    });

    it('should persist and restore progression data', async () => {
      const progressionComponent = world.getComponent(playerId, 'progression');
      
      // Unlock some achievements and gain experience
      progressionComponent.experience = 250;
      progressionComponent.experienceLevel = 3;
      
      const achievement = progressionComponent.achievements.get('coin_collector');
      if (achievement) {
        achievement.isUnlocked = true;
        achievement.progress = 100;
        progressionComponent.unlockedAchievements.add('coin_collector');
      }
      
      // Save data
      await persistenceSystem.saveAllData();
      
      // Create new world and systems to simulate restart
      const newWorld = new World();
      const newPersistenceSystem = new PersistenceSystem();
      newPersistenceSystem.initialize(newWorld);
      
      const newPlayerId = newWorld.createEntity();
      newWorld.addComponent(newPlayerId, createProgressionComponent());
      
      // Load data
      await newPersistenceSystem.loadAllData();
      
      const newProgressionComponent = newWorld.getComponent(newPlayerId, 'progression');
      
      // Verify data was restored
      expect(newProgressionComponent.experience).toBe(250);
      expect(newProgressionComponent.experienceLevel).toBe(3);
      expect(newProgressionComponent.unlockedAchievements.has('coin_collector')).toBe(true);
    });

    it('should handle save data export and import', async () => {
      // Set up some game data
      const scoreComponent = world.getComponent(playerId, 'score');
      const progressionComponent = world.getComponent(playerId, 'progression');
      
      scoreComponent.currentScore = 2000;
      scoreComponent.totalCoinsCollected = 50;
      progressionComponent.experience = 500;
      
      // Save and export
      await persistenceSystem.saveAllData();
      const exportedData = await persistenceSystem.exportSaveData();
      
      expect(exportedData).toBeDefined();
      expect(typeof exportedData).toBe('string');
      
      // Clear data
      persistenceSystem.clearAllData();
      
      // Import data back
      const success = await persistenceSystem.importSaveData(exportedData!);
      expect(success).toBe(true);
      
      // Verify data was restored
      await persistenceSystem.loadAllData();
      
      const restoredScore = world.getComponent(playerId, 'score');
      expect(restoredScore.currentScore).toBe(2000);
    });
  });

  describe('UI System Integration', () => {
    it('should update score display with smooth animations', () => {
      const scoreDisplayComponent = world.getComponent(playerId, 'scoreDisplay');
      
      // Initial state
      expect(scoreDisplayComponent.displayedScore).toBe(0);
      expect(scoreDisplayComponent.targetScore).toBe(0);
      
      // Simulate score increase
      world.emit('score_updated', {
        entityId: playerId,
        currentScore: 150,
        scoreGain: 150
      });
      
      uiSystem.update(0.016);
      
      // Should start animating towards target
      expect(scoreDisplayComponent.targetScore).toBe(150);
      expect(scoreDisplayComponent.isAnimating).toBe(true);
      
      // Update several frames
      for (let i = 0; i < 10; i++) {
        uiSystem.update(0.1); // 100ms per frame
      }
      
      // Should be closer to target
      expect(scoreDisplayComponent.displayedScore).toBeGreaterThan(0);
      expect(scoreDisplayComponent.displayedScore).toBeLessThanOrEqual(150);
    });

    it('should show achievement notifications', () => {
      const notificationComponent = world.getComponent(playerId, 'achievementNotification');
      
      // Trigger achievement unlock
      world.emit('achievement_unlocked', {
        title: 'Test Achievement',
        subtitle: 'Achievement Unlocked!',
        description: 'You did something!',
        rarity: 'common',
        rewards: { experience: 50 }
      });
      
      uiSystem.update(0.016);
      
      // Should have notification in queue
      expect(notificationComponent.notificationQueue.length).toBe(1);
      expect(notificationComponent.visible).toBe(true);
      expect(notificationComponent.animationState).toBe('sliding_in');
    });

    it('should handle mobile optimization', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480 // Mobile width
      });
      
      const scoreDisplayComponent = world.getComponent(playerId, 'scoreDisplay');
      
      // Update UI system (should trigger mobile optimization)
      uiSystem.update(0.016);
      
      // Should be optimized for mobile
      expect(scoreDisplayComponent.isMobileOptimized).toBe(true);
      expect(scoreDisplayComponent.fontSize).toBeGreaterThan(20); // Larger font for mobile
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid score updates efficiently', () => {
      const startTime = performance.now();
      
      // Simulate rapid coin collection
      for (let i = 0; i < 100; i++) {
        world.emit('coin_collected', {
          entityId: playerId,
          value: 10
        });
      }
      
      // Update all systems
      scoreSystem.update(0.016);
      comboSystem.update(0.016);
      progressionSystem.update(0.016);
      uiSystem.update(0.016);
      
      const endTime = performance.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(50); // 50ms
      
      // Verify final state
      const scoreComponent = world.getComponent(playerId, 'score');
      expect(scoreComponent.totalCoinsCollected).toBe(100);
      expect(scoreComponent.currentScore).toBeGreaterThan(1000);
    });

    it('should handle system interdependencies correctly', () => {
      // Test order of operations doesn't break functionality
      
      // Update systems in different order
      uiSystem.update(0.016);
      progressionSystem.update(0.016);
      comboSystem.update(0.016);
      scoreSystem.update(0.016);
      
      // Trigger events
      world.emit('coin_collected', { entityId: playerId, value: 10 });
      
      // Update again
      scoreSystem.update(0.016);
      comboSystem.update(0.016);
      progressionSystem.update(0.016);
      uiSystem.update(0.016);
      
      // Should still work correctly
      const scoreComponent = world.getComponent(playerId, 'score');
      expect(scoreComponent.currentScore).toBeGreaterThan(0);
    });

    it('should handle missing components gracefully', () => {
      // Create entity with only some components
      const partialEntityId = world.createEntity();
      world.addComponent(partialEntityId, createScoreComponent());
      // Missing combo, powerup, progression components
      
      expect(() => {
        world.emit('coin_collected', {
          entityId: partialEntityId,
          value: 10
        });
        
        scoreSystem.update(0.016);
        comboSystem.update(0.016);
        progressionSystem.update(0.016);
      }).not.toThrow();
      
      // Should still award basic score
      const scoreComponent = world.getComponent(partialEntityId, 'score');
      expect(scoreComponent.currentScore).toBe(10);
    });

    it('should maintain data consistency across saves/loads', async () => {
      // Build up complex game state
      for (let i = 0; i < 50; i++) {
        world.emit('coin_collected', { entityId: playerId, value: 10 });
        if (i % 10 === 0) {
          world.emit('powerup_collected', {
            entityId: playerId,
            powerupType: 'doubler'
          });
        }
      }
      
      // Update systems
      scoreSystem.update(1.0); // 1 second
      comboSystem.update(1.0);
      progressionSystem.update(1.0);
      
      // Capture initial state
      const initialScore = world.getComponent(playerId, 'score').currentScore;
      const initialAchievements = Array.from(world.getComponent(playerId, 'progression').unlockedAchievements);
      
      // Save and reload
      await persistenceSystem.saveAllData();
      await persistenceSystem.loadAllData();
      
      // Verify consistency
      const restoredScore = world.getComponent(playerId, 'score').currentScore;
      const restoredAchievements = Array.from(world.getComponent(playerId, 'progression').unlockedAchievements);
      
      expect(restoredScore).toBe(initialScore);
      expect(restoredAchievements).toEqual(initialAchievements);
    });
  });

  describe('Real-world Gameplay Scenarios', () => {
    it('should handle complete level playthrough', async () => {
      // Simulate a complete level playthrough
      
      // Phase 1: Early game coin collection
      for (let i = 0; i < 15; i++) {
        world.emit('coin_collected', { entityId: playerId, value: 10 });
        scoreSystem.update(0.2);
        comboSystem.update(0.2);
      }
      
      // Phase 2: Powerup collection
      world.emit('powerup_collected', {
        entityId: playerId,
        powerupType: 'doubler'
      });
      scoreSystem.update(0.1);
      
      // Phase 3: More coins with doubler
      for (let i = 0; i < 10; i++) {
        world.emit('coin_collected', { entityId: playerId, value: 10 });
        scoreSystem.update(0.1);
        comboSystem.update(0.1);
      }
      
      // Phase 4: Player takes damage (breaks combo)
      world.emit('player_damaged', { entityId: playerId });
      comboSystem.update(0.1);
      
      // Phase 5: Recovery and final coins
      for (let i = 0; i < 5; i++) {
        world.emit('coin_collected', { entityId: playerId, value: 10 });
        scoreSystem.update(0.2);
        comboSystem.update(0.2);
      }
      
      // Phase 6: Level completion
      world.emit('level_completed', {
        entityId: playerId,
        levelId: 'level1',
        bonus: 100
      });
      
      scoreSystem.update(0.1);
      progressionSystem.update(0.1);
      
      // Verify final state
      const scoreComponent = world.getComponent(playerId, 'score');
      const progressionComponent = world.getComponent(playerId, 'progression');
      const highScoreComponent = world.getComponent(playerId, 'highScore');
      
      // Should have substantial score
      expect(scoreComponent.currentScore).toBeGreaterThan(400); // Base coins + doubler + completion bonus
      expect(scoreComponent.totalCoinsCollected).toBe(30);
      expect(scoreComponent.sessionsPlayed).toBe(1);
      
      // Should have unlocked achievements
      expect(progressionComponent.unlockedAchievements.size).toBeGreaterThan(0);
      
      // Should have high score recorded
      expect(highScoreComponent.globalHighScore).toBe(scoreComponent.currentScore);
      
      // Save the session
      await persistenceSystem.saveAllData();
    });

    it('should handle score-based level progression correctly', () => {
      const progressionComponent = world.getComponent(playerId, 'progression');
      const scoreComponent = world.getComponent(playerId, 'score');
      
      // Test progression thresholds
      const testCases = [
        { score: 100, expectedLevels: [1] },
        { score: 300, expectedLevels: [1, 2] }, // Level 2 unlock threshold
        { score: 500, expectedLevels: [1, 2] }
      ];
      
      testCases.forEach(({ score, expectedLevels }) => {
        scoreComponent.currentScore = score;
        progressionSystem.update(0.016);
        
        expectedLevels.forEach(level => {
          expect(progressionComponent.levelsUnlocked.has(level)).toBe(true);
        });
      });
    });
  });
});
