import { BaseSystem } from '@/systems/core/BaseSystem';
import type { World } from '@/core/ecs/World';
import type { EntityId } from '@/types';
import type { ProgressionComponent, Achievement, Milestone, ProgressionReward } from '@/components/score/ProgressionComponent';
import type { ScoreComponent } from '@/components/score/ScoreComponent';
import type { HighScoreComponent } from '@/components/score/HighScoreComponent';
import { ProgressionUtils } from '@/components/score/ProgressionComponent';
import { HighScoreManager } from '@/components/score/HighScoreComponent';

/**
 * ProgressionSystem - Manages level unlocks, achievements, and player progression
 * 
 * Faithfully recreates original progression:
 * - Level 1 always unlocked
 * - Level 2 unlocks at 300 points
 * - Persistent progression via localStorage
 * 
 * Modern additions:
 * - Rich achievement system
 * - Experience and leveling
 * - Milestone tracking
 * - Visual progression feedback
 */
export class ProgressionSystem extends BaseSystem {
  // Achievement notification queue
  private achievementQueue: Achievement[] = [];
  private milestoneQueue: Milestone[] = [];
  private rewardQueue: ProgressionReward[] = [];
  
  // Notification timing
  private lastNotificationTime = 0;
  private notificationCooldown = 2000; // 2 seconds between notifications
  
  // Persistence settings
  private autoSaveInterval = 10000; // 10 seconds
  private lastAutoSave = 0;
  
  constructor() {
    super('ProgressionSystem');
  }
  
  initialize(world: World): void {
    super.initialize(world);
    
    // Load existing progression data for all entities
    this.loadProgressionData();
    
    console.debug('ProgressionSystem initialized with original unlock thresholds');
  }
  
  update(deltaTime: number): void {
    if (!this.world) return;
    
    const startTime = performance.now();
    
    // Get all entities with progression components
    const progressionEntities = this.world.getEntitiesWithComponents(['progression']);
    
    for (const entity of progressionEntities) {
      this.updateProgressionEntity(entity.id, deltaTime);
    }
    
    // Process notification queues
    this.processNotificationQueues();
    
    // Auto-save progression data
    this.handleAutoSave();
    
    // Update performance metrics
    const updateTime = performance.now() - startTime;
    this.updatePerformanceMetrics(updateTime);
  }
  
  /**
   * Update a single progression entity
   */
  private updateProgressionEntity(entityId: EntityId, deltaTime: number): void {
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    
    if (!progressionComponent) return;
    
    // Check for level unlocks based on score (faithful to original)
    if (scoreComponent) {
      const newUnlocks = ProgressionUtils.checkLevelUnlocks(
        progressionComponent,
        scoreComponent.currentScore
      );
      
      // Queue level unlock notifications
      newUnlocks.forEach(level => {
        this.queueLevelUnlockNotification(level, scoreComponent.currentScore);
      });
      
      // Update achievement progress
      this.updateAchievementProgress(
        progressionComponent,
        scoreComponent,
        entityId
      );
      
      // Check milestones
      const completedMilestones = ProgressionUtils.checkMilestones(
        progressionComponent,
        scoreComponent.currentScore
      );
      
      // Queue milestone notifications
      completedMilestones.forEach(milestone => {
        this.milestoneQueue.push(milestone);
      });
      
      // Update experience level
      const leveledUp = ProgressionUtils.updateExperienceLevel(progressionComponent);
      if (leveledUp) {
        this.queueLevelUpNotification(progressionComponent.experienceLevel);
      }
    }
    
    // Process pending rewards
    if (progressionComponent.pendingRewards.length > 0) {
      const rewards = ProgressionUtils.claimPendingRewards(progressionComponent);
      this.rewardQueue.push(...rewards);
    }
    
    // Clear progression dirty flag
    progressionComponent.progressionDirty = false;
    progressionComponent.hasNewUnlocks = false;
  }
  
  /**
   * Update achievement progress for all relevant metrics
   */
  private updateAchievementProgress(
    progressionComponent: ProgressionComponent,
    scoreComponent: ScoreComponent,
    entityId: EntityId
  ): void {
    // Score-based achievements
    const scoreAchievements = ProgressionUtils.updateAchievementProgress(
      progressionComponent,
      'score',
      scoreComponent.currentScore
    );
    
    // Coin-based achievements
    const coinAchievements = ProgressionUtils.updateAchievementProgress(
      progressionComponent,
      'coins',
      scoreComponent.totalCoinsCollected
    );
    
    // Distance-based achievements
    const distanceAchievements = ProgressionUtils.updateAchievementProgress(
      progressionComponent,
      'distance',
      scoreComponent.totalDistanceTraveled
    );
    
    // Session-based achievements
    const sessionAchievements = ProgressionUtils.updateAchievementProgress(
      progressionComponent,
      'sessions',
      progressionComponent.sessionsCompleted
    );
    
    // Check combo achievements
    const comboComponent = this.world!.getComponent(entityId, 'combo');
    if (comboComponent) {
      const comboAchievements = ProgressionUtils.updateAchievementProgress(
        progressionComponent,
        'combo',
        comboComponent.maxCombo
      );
      this.achievementQueue.push(...comboAchievements);
    }
    
    // Queue all new achievements for notification
    this.achievementQueue.push(
      ...scoreAchievements,
      ...coinAchievements,
      ...distanceAchievements,
      ...sessionAchievements
    );
    
    // Check custom achievements (like perfect run)
    this.checkCustomAchievements(progressionComponent, entityId);
  }
  
  /**
   * Check custom achievement conditions
   */
  private checkCustomAchievements(
    progressionComponent: ProgressionComponent,
    entityId: EntityId
  ): void {
    // Perfect run achievement (no damage in level 1)
    const perfectRunAchievement = progressionComponent.achievements.get('perfect_run');
    if (perfectRunAchievement && !perfectRunAchievement.isUnlocked) {
      // This would be triggered by level completion without damage
      // Implementation depends on damage tracking system
    }
    
    // Add more custom achievements here
  }
  
  /**
   * Queue level unlock notification
   */
  private queueLevelUnlockNotification(level: number, score: number): void {
    const reward: ProgressionReward = {
      id: `level_unlock_${level}`,
      type: 'level_unlock',
      title: `Level ${level} Unlocked!`,
      description: `Achieved with ${score} points. A new adventure awaits!`,
      icon: '🎆',
      timestamp: performance.now(),
      claimed: false
    };
    
    this.rewardQueue.push(reward);
    
    // Emit level unlock event
    this.world!.emit('level_unlocked', {
      level,
      score,
      timestamp: performance.now()
    });
    
    console.debug(`Level ${level} unlocked with ${score} points`);
  }
  
  /**
   * Queue level up notification
   */
  private queueLevelUpNotification(newLevel: number): void {
    const reward: ProgressionReward = {
      id: `level_up_${newLevel}`,
      type: 'milestone',
      title: `Level Up!`,
      description: `Reached experience level ${newLevel}`,
      icon: '⬆️',
      timestamp: performance.now(),
      claimed: false
    };
    
    this.rewardQueue.push(reward);
    
    // Emit level up event
    this.world!.emit('experience_level_up', {
      newLevel,
      timestamp: performance.now()
    });
    
    console.debug(`Experience level up: ${newLevel}`);
  }
  
  /**
   * Process notification queues with proper timing
   */
  private processNotificationQueues(): void {
    const currentTime = performance.now();
    
    // Check if we can show a notification
    if (currentTime - this.lastNotificationTime < this.notificationCooldown) {
      return;
    }
    
    // Process achievements first (highest priority)
    if (this.achievementQueue.length > 0) {
      const achievement = this.achievementQueue.shift()!;
      this.showAchievementNotification(achievement);
      this.lastNotificationTime = currentTime;
      return;
    }
    
    // Process milestones
    if (this.milestoneQueue.length > 0) {
      const milestone = this.milestoneQueue.shift()!;
      this.showMilestoneNotification(milestone);
      this.lastNotificationTime = currentTime;
      return;
    }
    
    // Process other rewards
    if (this.rewardQueue.length > 0) {
      const reward = this.rewardQueue.shift()!;
      this.showRewardNotification(reward);
      this.lastNotificationTime = currentTime;
      return;
    }
  }
  
  /**
   * Show achievement notification
   */
  private showAchievementNotification(achievement: Achievement): void {
    const notification = {
      type: 'achievement',
      title: `Achievement Unlocked!`,
      subtitle: achievement.name,
      description: achievement.description,
      icon: achievement.icon || '🏆',
      rarity: achievement.rarity,
      rewards: achievement.rewards,
      timestamp: performance.now(),
      duration: 5000 // 5 seconds
    };
    
    // Emit to UI system
    this.world!.emit('achievement_unlocked', notification);
    
    console.debug(`Achievement unlocked: ${achievement.name}`);
  }
  
  /**
   * Show milestone notification
   */
  private showMilestoneNotification(milestone: Milestone): void {
    const notification = {
      type: 'milestone',
      title: 'Milestone Reached!',
      subtitle: milestone.name,
      description: milestone.description,
      icon: '🎯',
      rewards: milestone.rewards,
      timestamp: performance.now(),
      duration: 4000 // 4 seconds
    };
    
    // Emit to UI system
    this.world!.emit('milestone_completed', notification);
    
    console.debug(`Milestone completed: ${milestone.name}`);
  }
  
  /**
   * Show general reward notification
   */
  private showRewardNotification(reward: ProgressionReward): void {
    const notification = {
      type: reward.type,
      title: reward.title,
      description: reward.description,
      icon: reward.icon || '🎁',
      timestamp: reward.timestamp,
      duration: 3000 // 3 seconds
    };
    
    // Emit to UI system
    this.world!.emit('progression_reward', notification);
    
    console.debug(`Progression reward: ${reward.title}`);
  }
  
  /**
   * Load progression data from localStorage
   */
  private loadProgressionData(): void {
    if (!this.world) return;
    
    const progressionEntities = this.world.getEntitiesWithComponents(['progression']);
    
    for (const entity of progressionEntities) {
      const progressionComponent = this.world.getComponent(entity.id, 'progression') as ProgressionComponent;
      if (!progressionComponent) continue;
      
      try {
        // Load achievement progress
        const achievementData = localStorage.getItem('openRunner_achievements');
        if (achievementData) {
          const achievements = JSON.parse(achievementData);
          this.loadAchievementData(progressionComponent, achievements);
        }
        
        // Load milestone progress
        const milestoneData = localStorage.getItem('openRunner_milestones');
        if (milestoneData) {
          const milestones = JSON.parse(milestoneData);
          this.loadMilestoneData(progressionComponent, milestones);
        }
        
        // Load experience data
        const experienceData = localStorage.getItem('openRunner_experience');
        if (experienceData) {
          const experience = JSON.parse(experienceData);
          progressionComponent.experience = experience.total || 0;
          progressionComponent.experienceLevel = experience.level || 1;
          ProgressionUtils.updateExperienceLevel(progressionComponent);
        }
        
        // Load level unlocks from high score component
        const highScoreComponent = this.world.getComponent(entity.id, 'highScore') as HighScoreComponent;
        if (highScoreComponent) {
          HighScoreManager.loadHighScores(highScoreComponent);
          
          // Sync level unlocks based on high scores (faithful to original)
          if (HighScoreManager.isLevelUnlocked(highScoreComponent, 2)) {
            progressionComponent.levelsUnlocked.add(2);
          }
        }
        
        console.debug('Progression data loaded from localStorage');
        
      } catch (error) {
        console.error('Error loading progression data:', error);
      }
    }
  }
  
  /**
   * Load achievement data
   */
  private loadAchievementData(
    progressionComponent: ProgressionComponent,
    achievementData: any
  ): void {
    for (const [achievementId, data] of Object.entries(achievementData)) {
      const achievement = progressionComponent.achievements.get(achievementId);
      if (achievement && data) {
        const savedData = data as any;
        achievement.progress = savedData.progress || 0;
        achievement.isUnlocked = savedData.isUnlocked || false;
        achievement.unlockedAt = savedData.unlockedAt;
        
        if (achievement.isUnlocked) {
          progressionComponent.unlockedAchievements.add(achievementId);
        }
      }
    }
  }
  
  /**
   * Load milestone data
   */
  private loadMilestoneData(
    progressionComponent: ProgressionComponent,
    milestoneData: any
  ): void {
    for (const milestone of progressionComponent.milestones) {
      const savedData = milestoneData[milestone.id];
      if (savedData) {
        milestone.isCompleted = savedData.isCompleted || false;
        milestone.completedAt = savedData.completedAt;
        
        if (milestone.isCompleted) {
          progressionComponent.completedMilestones.add(milestone.id);
        }
      }
    }
  }
  
  /**
   * Save progression data to localStorage
   */
  saveProgressionData(): void {
    if (!this.world) return;
    
    const progressionEntities = this.world.getEntitiesWithComponents(['progression']);
    
    for (const entity of progressionEntities) {
      const progressionComponent = this.world.getComponent(entity.id, 'progression') as ProgressionComponent;
      if (!progressionComponent) continue;
      
      try {
        // Save achievement data
        const achievementData: Record<string, any> = {};
        for (const [id, achievement] of progressionComponent.achievements) {
          achievementData[id] = {
            progress: achievement.progress,
            isUnlocked: achievement.isUnlocked,
            unlockedAt: achievement.unlockedAt
          };
        }
        localStorage.setItem('openRunner_achievements', JSON.stringify(achievementData));
        
        // Save milestone data
        const milestoneData: Record<string, any> = {};
        for (const milestone of progressionComponent.milestones) {
          milestoneData[milestone.id] = {
            isCompleted: milestone.isCompleted,
            completedAt: milestone.completedAt
          };
        }
        localStorage.setItem('openRunner_milestones', JSON.stringify(milestoneData));
        
        // Save experience data
        const experienceData = {
          total: progressionComponent.experience,
          level: progressionComponent.experienceLevel,
          savedAt: Date.now()
        };
        localStorage.setItem('openRunner_experience', JSON.stringify(experienceData));
        
        console.debug('Progression data saved to localStorage');
        
      } catch (error) {
        console.error('Error saving progression data:', error);
      }
    }
  }
  
  /**
   * Handle auto-save
   */
  private handleAutoSave(): void {
    const currentTime = performance.now();
    
    if (currentTime - this.lastAutoSave > this.autoSaveInterval) {
      this.saveProgressionData();
      this.lastAutoSave = currentTime;
    }
  }
  
  /**
   * Check if a level is unlocked (faithful to original logic)
   */
  isLevelUnlocked(entityId: EntityId, level: number): boolean {
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    if (!progressionComponent) return level === 1; // Default to level 1 only
    
    return progressionComponent.levelsUnlocked.has(level);
  }
  
  /**
   * Get progression statistics
   */
  getProgressionStatistics(entityId: EntityId) {
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    if (!progressionComponent) return null;
    
    const totalAchievements = progressionComponent.achievements.size;
    const unlockedAchievements = progressionComponent.unlockedAchievements.size;
    const totalMilestones = progressionComponent.milestones.length;
    const completedMilestones = progressionComponent.completedMilestones.size;
    
    return {
      level: {
        current: progressionComponent.currentLevel,
        unlocked: Array.from(progressionComponent.levelsUnlocked),
        maxUnlocked: Math.max(...progressionComponent.levelsUnlocked)
      },
      experience: {
        current: progressionComponent.experience,
        level: progressionComponent.experienceLevel,
        toNext: progressionComponent.experienceToNextLevel
      },
      achievements: {
        total: totalAchievements,
        unlocked: unlockedAchievements,
        percentage: (unlockedAchievements / totalAchievements) * 100
      },
      milestones: {
        total: totalMilestones,
        completed: completedMilestones,
        percentage: (completedMilestones / totalMilestones) * 100
      },
      sessions: {
        completed: progressionComponent.sessionsCompleted,
        bestScore: progressionComponent.bestSessionScore
      }
    };
  }
  
  /**
   * Reset progression data (for testing or new game+)
   */
  resetProgression(entityId: EntityId, keepExperience: boolean = false): void {
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    if (!progressionComponent) return;
    
    // Reset achievements
    for (const achievement of progressionComponent.achievements.values()) {
      achievement.progress = 0;
      achievement.isUnlocked = false;
      achievement.unlockedAt = undefined;
    }
    progressionComponent.unlockedAchievements.clear();
    
    // Reset milestones
    for (const milestone of progressionComponent.milestones) {
      milestone.isCompleted = false;
      milestone.completedAt = undefined;
    }
    progressionComponent.completedMilestones.clear();
    
    // Reset level unlocks (keep level 1)
    progressionComponent.levelsUnlocked.clear();
    progressionComponent.levelsUnlocked.add(1);
    progressionComponent.currentLevel = 1;
    
    // Reset sessions
    progressionComponent.sessionsCompleted = 0;
    progressionComponent.bestSessionScore = 0;
    
    // Optionally reset experience
    if (!keepExperience) {
      progressionComponent.experience = 0;
      progressionComponent.experienceLevel = 1;
      progressionComponent.experienceToNextLevel = 100;
    }
    
    // Clear notification queues
    this.achievementQueue = [];
    this.milestoneQueue = [];
    this.rewardQueue = [];
    
    // Save the reset state
    this.saveProgressionData();
    
    console.debug('Progression reset', { keepExperience });
  }
}
