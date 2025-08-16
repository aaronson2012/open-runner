import type { Component, EntityId } from '@/types';

/**
 * ProgressionComponent - Manages level progression, unlocks, and achievements
 */
export interface ProgressionComponent extends Component {
  type: 'progression';
  
  // Level progression (faithful to original)
  currentLevel: number;
  levelsUnlocked: Set<number>;
  levelUnlockThresholds: Map<number, number>; // Level -> Score required
  
  // Original game progression
  level2UnlockScore: number; // 300 points to unlock Level 2
  maxLevel: number;
  
  // Achievement system
  achievements: Map<string, Achievement>;
  unlockedAchievements: Set<string>;
  
  // Milestones and progression tracking
  milestones: Milestone[];
  completedMilestones: Set<string>;
  
  // Session tracking
  sessionsCompleted: number;
  bestSessionScore: number;
  
  // Experience system (modern addition)
  experience: number;
  experienceLevel: number;
  experienceToNextLevel: number;
  
  // Progression rewards
  pendingRewards: ProgressionReward[];
  
  // State flags
  progressionDirty: boolean;
  hasNewUnlocks: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  
  // Requirements
  requirement: AchievementRequirement;
  
  // Rewards
  rewards: {
    experience?: number;
    title?: string;
    unlock?: string;
  };
  
  // Progress tracking
  progress: number;
  maxProgress: number;
  isUnlocked: boolean;
  unlockedAt?: number;
  
  // Display
  isVisible: boolean;
  isSecret: boolean;
}

export interface AchievementRequirement {
  type: 'score' | 'coins' | 'distance' | 'combo' | 'level' | 'sessions' | 'custom';
  target: number;
  levelSpecific?: number; // For level-specific achievements
  condition?: string; // For custom conditions
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  scoreThreshold: number;
  rewards: {
    experience: number;
    title?: string;
    unlock?: string;
  };
  isCompleted: boolean;
  completedAt?: number;
}

export interface ProgressionReward {
  id: string;
  type: 'achievement' | 'milestone' | 'level_unlock';
  title: string;
  description: string;
  icon?: string;
  timestamp: number;
  claimed: boolean;
}

/**
 * Create a new ProgressionComponent with original game progression
 */
export function createProgressionComponent(
  options: Partial<{
    currentLevel: number;
    level2UnlockScore: number;
    maxLevel: number;
  }> = {}
): ProgressionComponent {
  const component: ProgressionComponent = {
    type: 'progression',
    entityId: 0,
    
    // Level system (faithful to original)
    currentLevel: options.currentLevel ?? 1,
    levelsUnlocked: new Set([1]), // Level 1 always unlocked
    levelUnlockThresholds: new Map(),
    
    // Original game thresholds
    level2UnlockScore: options.level2UnlockScore ?? 300, // Faithful to original
    maxLevel: options.maxLevel ?? 2, // Original had 2 levels
    
    // Achievement system
    achievements: new Map(),
    unlockedAchievements: new Set(),
    
    // Milestones
    milestones: [],
    completedMilestones: new Set(),
    
    // Session tracking
    sessionsCompleted: 0,
    bestSessionScore: 0,
    
    // Experience system
    experience: 0,
    experienceLevel: 1,
    experienceToNextLevel: 100,
    
    // Rewards
    pendingRewards: [],
    
    // State
    progressionDirty: true,
    hasNewUnlocks: false
  };
  
  // Set up level unlock thresholds (faithful to original)
  component.levelUnlockThresholds.set(2, component.level2UnlockScore);
  
  // Initialize default achievements
  initializeDefaultAchievements(component);
  
  // Initialize default milestones
  initializeDefaultMilestones(component);
  
  return component;
}

/**
 * Initialize default achievements (faithful to original + modern additions)
 */
function initializeDefaultAchievements(component: ProgressionComponent): void {
  const achievements: Achievement[] = [
    // Original game achievements
    {
      id: 'first_coin',
      name: 'First Steps',
      description: 'Collect your first coin',
      rarity: 'common',
      requirement: { type: 'coins', target: 1 },
      rewards: { experience: 10 },
      progress: 0,
      maxProgress: 1,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    {
      id: 'unlock_level_2',
      name: 'Desert Explorer',
      description: 'Unlock Level 2 (Desert)',
      rarity: 'rare',
      requirement: { type: 'score', target: 300 },
      rewards: { experience: 50, title: 'Desert Runner' },
      progress: 0,
      maxProgress: 300,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    {
      id: 'coin_collector',
      name: 'Coin Collector',
      description: 'Collect 100 coins',
      rarity: 'common',
      requirement: { type: 'coins', target: 100 },
      rewards: { experience: 25 },
      progress: 0,
      maxProgress: 100,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    {
      id: 'high_scorer',
      name: 'High Scorer',
      description: 'Score 1000 points in a single run',
      rarity: 'epic',
      requirement: { type: 'score', target: 1000 },
      rewards: { experience: 100, title: 'Score Master' },
      progress: 0,
      maxProgress: 1000,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    {
      id: 'combo_master',
      name: 'Combo Master',
      description: 'Achieve a 10x combo multiplier',
      rarity: 'rare',
      requirement: { type: 'combo', target: 10 },
      rewards: { experience: 75 },
      progress: 0,
      maxProgress: 10,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    {
      id: 'distance_runner',
      name: 'Distance Runner',
      description: 'Travel 5000 units in total',
      rarity: 'common',
      requirement: { type: 'distance', target: 5000 },
      rewards: { experience: 50 },
      progress: 0,
      maxProgress: 5000,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    {
      id: 'persistent_player',
      name: 'Persistent Player',
      description: 'Complete 50 sessions',
      rarity: 'epic',
      requirement: { type: 'sessions', target: 50 },
      rewards: { experience: 200, title: 'Dedicated Runner' },
      progress: 0,
      maxProgress: 50,
      isUnlocked: false,
      isVisible: true,
      isSecret: false
    },
    // Secret achievements
    {
      id: 'perfect_run',
      name: 'Perfect Run',
      description: 'Complete Level 1 without taking damage',
      rarity: 'legendary',
      requirement: { type: 'custom', target: 1, condition: 'no_damage_level_1' },
      rewards: { experience: 500, title: 'Perfect Runner' },
      progress: 0,
      maxProgress: 1,
      isUnlocked: false,
      isVisible: false,
      isSecret: true
    }
  ];
  
  achievements.forEach(achievement => {
    component.achievements.set(achievement.id, achievement);
  });
}

/**
 * Initialize default milestones
 */
function initializeDefaultMilestones(component: ProgressionComponent): void {
  const milestones: Milestone[] = [
    {
      id: 'milestone_100',
      name: 'Getting Started',
      description: 'Score 100 points',
      scoreThreshold: 100,
      rewards: { experience: 20 },
      isCompleted: false
    },
    {
      id: 'milestone_300',
      name: 'Level 2 Unlock',
      description: 'Score 300 points to unlock Desert level',
      scoreThreshold: 300,
      rewards: { experience: 50, unlock: 'level_2' },
      isCompleted: false
    },
    {
      id: 'milestone_500',
      name: 'Score Achiever',
      description: 'Score 500 points',
      scoreThreshold: 500,
      rewards: { experience: 75 },
      isCompleted: false
    },
    {
      id: 'milestone_1000',
      name: 'High Scorer',
      description: 'Score 1000 points',
      scoreThreshold: 1000,
      rewards: { experience: 150, title: 'Score Master' },
      isCompleted: false
    },
    {
      id: 'milestone_2000',
      name: 'Expert Runner',
      description: 'Score 2000 points',
      scoreThreshold: 2000,
      rewards: { experience: 300, title: 'Expert Runner' },
      isCompleted: false
    }
  ];
  
  component.milestones = milestones;
}

/**
 * Progression utilities
 */
export class ProgressionUtils {
  /**
   * Check if a level should be unlocked based on score (faithful to original)
   */
  static checkLevelUnlocks(
    component: ProgressionComponent,
    currentScore: number
  ): number[] {
    const newUnlocks: number[] = [];
    
    for (const [level, threshold] of component.levelUnlockThresholds) {
      if (currentScore >= threshold && !component.levelsUnlocked.has(level)) {
        component.levelsUnlocked.add(level);
        newUnlocks.push(level);
        
        // Create unlock reward
        const reward: ProgressionReward = {
          id: `level_unlock_${level}`,
          type: 'level_unlock',
          title: `Level ${level} Unlocked!`,
          description: `You've unlocked a new level with ${threshold} points!`,
          timestamp: performance.now(),
          claimed: false
        };
        
        component.pendingRewards.push(reward);
        component.hasNewUnlocks = true;
      }
    }
    
    return newUnlocks;
  }
  
  /**
   * Update achievement progress
   */
  static updateAchievementProgress(
    component: ProgressionComponent,
    type: AchievementRequirement['type'],
    value: number,
    levelId?: number
  ): Achievement[] {
    const newUnlocks: Achievement[] = [];
    
    for (const achievement of component.achievements.values()) {
      if (achievement.isUnlocked || achievement.requirement.type !== type) {
        continue;
      }
      
      // Check level-specific requirements
      if (achievement.requirement.levelSpecific && achievement.requirement.levelSpecific !== levelId) {
        continue;
      }
      
      // Update progress
      achievement.progress = Math.min(value, achievement.maxProgress);
      
      // Check if unlocked
      if (achievement.progress >= achievement.requirement.target) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = performance.now();
        component.unlockedAchievements.add(achievement.id);
        
        // Add experience reward
        if (achievement.rewards.experience) {
          component.experience += achievement.rewards.experience;
        }
        
        // Create unlock reward
        const reward: ProgressionReward = {
          id: `achievement_${achievement.id}`,
          type: 'achievement',
          title: `Achievement Unlocked: ${achievement.name}`,
          description: achievement.description,
          timestamp: performance.now(),
          claimed: false
        };
        
        component.pendingRewards.push(reward);
        newUnlocks.push(achievement);
      }
    }
    
    return newUnlocks;
  }
  
  /**
   * Check milestone completion
   */
  static checkMilestones(
    component: ProgressionComponent,
    currentScore: number
  ): Milestone[] {
    const completed: Milestone[] = [];
    
    for (const milestone of component.milestones) {
      if (!milestone.isCompleted && currentScore >= milestone.scoreThreshold) {
        milestone.isCompleted = true;
        milestone.completedAt = performance.now();
        component.completedMilestones.add(milestone.id);
        
        // Add experience reward
        component.experience += milestone.rewards.experience;
        
        // Create milestone reward
        const reward: ProgressionReward = {
          id: `milestone_${milestone.id}`,
          type: 'milestone',
          title: `Milestone: ${milestone.name}`,
          description: milestone.description,
          timestamp: performance.now(),
          claimed: false
        };
        
        component.pendingRewards.push(reward);
        completed.push(milestone);
      }
    }
    
    return completed;
  }
  
  /**
   * Update experience level
   */
  static updateExperienceLevel(component: ProgressionComponent): boolean {
    const oldLevel = component.experienceLevel;
    
    // Calculate new level (100 XP per level, with 20% increase each level)
    let requiredXP = 100;
    let level = 1;
    let totalXP = 0;
    
    while (totalXP + requiredXP <= component.experience) {
      totalXP += requiredXP;
      level++;
      requiredXP = Math.floor(requiredXP * 1.2); // 20% increase per level
    }
    
    component.experienceLevel = level;
    component.experienceToNextLevel = requiredXP - (component.experience - totalXP);
    
    // Return true if level changed
    return oldLevel !== level;
  }
  
  /**
   * Get pending rewards and mark as claimed
   */
  static claimPendingRewards(component: ProgressionComponent): ProgressionReward[] {
    const rewards = component.pendingRewards.filter(r => !r.claimed);
    
    // Mark as claimed
    rewards.forEach(reward => {
      reward.claimed = true;
    });
    
    // Clean up old claimed rewards (keep last 50)
    component.pendingRewards = component.pendingRewards
      .filter(r => !r.claimed)
      .concat(component.pendingRewards.filter(r => r.claimed).slice(-50));
    
    return rewards;
  }
}
