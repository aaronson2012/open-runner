import { BaseSystem } from '@/systems/core/BaseSystem';
import type { World } from '@/core/ecs/World';
import type { EntityId } from '@/types';
import type { ScoreComponent } from '@/components/score/ScoreComponent';
import type { ProgressionComponent } from '@/components/score/ProgressionComponent';
import type { HighScoreComponent } from '@/components/score/HighScoreComponent';
import type { ComboComponent } from '@/components/score/ComboComponent';
import type { PowerupComponent } from '@/components/score/PowerupComponent';
import { HighScoreManager } from '@/components/score/HighScoreComponent';

/**
 * PersistenceSystem - Manages saving and loading game progress
 * 
 * Handles:
 * - Score and progression persistence (faithful to original)
 * - Cloud save integration (modern addition)
 * - Cross-session state restoration
 * - Data integrity and validation
 * - Backup and recovery
 */
export class PersistenceSystem extends BaseSystem {
  // Save configuration
  private autoSaveInterval = 30000; // 30 seconds
  private lastAutoSave = 0;
  private saveDirty = false;
  
  // Cloud save configuration
  private cloudSaveEnabled = false;
  private cloudSaveInterval = 300000; // 5 minutes
  private lastCloudSave = 0;
  
  // Data integrity
  private saveVersion = '1.0.0';
  private compressionEnabled = true;
  
  // Statistics
  private saveCount = 0;
  private loadCount = 0;
  private lastSaveTime = 0;
  private lastLoadTime = 0;
  
  constructor() {
    super('PersistenceSystem');
  }
  
  initialize(world: World): void {
    super.initialize(world);
    
    // Load existing data on startup
    this.loadAllData();
    
    // Subscribe to save events
    this.subscribeToEvents();
    
    console.debug('PersistenceSystem initialized');
  }
  
  update(deltaTime: number): void {
    if (!this.world) return;
    
    const startTime = performance.now();
    
    // Handle auto-save
    this.handleAutoSave();
    
    // Handle cloud sync
    this.handleCloudSync();
    
    // Update performance metrics
    const updateTime = performance.now() - startTime;
    this.updatePerformanceMetrics(updateTime);
  }
  
  /**
   * Save all persistence data (faithful to original localStorage approach)
   */
  async saveAllData(force: boolean = false): Promise<boolean> {
    if (!this.world) return false;
    
    const currentTime = performance.now();
    
    try {
      const entities = this.world.getEntitiesWithComponents([
        'score', 'progression', 'highScore', 'combo', 'powerup'
      ]);
      
      let saveData: any = {
        version: this.saveVersion,
        timestamp: Date.now(),
        entities: []
      };
      
      // Collect data from all entities
      for (const entity of entities) {
        const entityData = this.serializeEntity(entity.id);
        if (entityData) {
          saveData.entities.push(entityData);
        }
      }
      
      // Save to localStorage (faithful to original)
      await this.saveToLocalStorage(saveData);
      
      // Save to cloud if enabled
      if (this.cloudSaveEnabled) {
        await this.saveToCloud(saveData);
      }
      
      // Update statistics
      this.saveCount++;
      this.lastSaveTime = currentTime;
      this.saveDirty = false;
      
      console.debug('All persistence data saved successfully');
      
      // Emit save complete event
      this.world.emit('data_saved', {
        timestamp: currentTime,
        saveCount: this.saveCount,
        cloudSaved: this.cloudSaveEnabled
      });
      
      return true;
      
    } catch (error) {
      console.error('Error saving persistence data:', error);
      
      // Emit save error event
      this.world.emit('save_error', {
        error: error.message,
        timestamp: currentTime
      });
      
      return false;
    }
  }
  
  /**
   * Load all persistence data
   */
  async loadAllData(): Promise<boolean> {
    if (!this.world) return false;
    
    const currentTime = performance.now();
    
    try {
      // Try to load from cloud first, then fallback to localStorage
      let saveData: any = null;
      
      if (this.cloudSaveEnabled) {
        saveData = await this.loadFromCloud();
      }
      
      if (!saveData) {
        saveData = await this.loadFromLocalStorage();
      }
      
      if (!saveData) {
        console.debug('No save data found');
        return false;
      }
      
      // Validate save data
      if (!this.validateSaveData(saveData)) {
        console.error('Save data validation failed');
        return false;
      }
      
      // Restore data to entities
      await this.restoreEntities(saveData.entities || []);
      
      // Update statistics
      this.loadCount++;
      this.lastLoadTime = currentTime;
      
      console.debug('All persistence data loaded successfully');
      
      // Emit load complete event
      this.world.emit('data_loaded', {
        timestamp: currentTime,
        loadCount: this.loadCount,
        dataVersion: saveData.version
      });
      
      return true;
      
    } catch (error) {
      console.error('Error loading persistence data:', error);
      
      // Emit load error event
      this.world.emit('load_error', {
        error: error.message,
        timestamp: currentTime
      });
      
      return false;
    }
  }
  
  /**
   * Serialize entity data
   */
  private serializeEntity(entityId: EntityId): any {
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    const highScoreComponent = this.world!.getComponent(entityId, 'highScore') as HighScoreComponent;
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
    
    const entityData: any = {
      entityId,
      components: {}
    };
    
    // Serialize score data
    if (scoreComponent) {
      entityData.components.score = {
        currentScore: scoreComponent.currentScore,
        totalCoinsCollected: scoreComponent.totalCoinsCollected,
        totalDistanceTraveled: scoreComponent.totalDistanceTraveled,
        sessionsPlayed: scoreComponent.sessionsPlayed
      };
    }
    
    // Serialize progression data
    if (progressionComponent) {
      const achievements: any = {};
      for (const [id, achievement] of progressionComponent.achievements) {
        achievements[id] = {
          progress: achievement.progress,
          isUnlocked: achievement.isUnlocked,
          unlockedAt: achievement.unlockedAt
        };
      }
      
      const milestones = progressionComponent.milestones.map(milestone => ({
        id: milestone.id,
        isCompleted: milestone.isCompleted,
        completedAt: milestone.completedAt
      }));
      
      entityData.components.progression = {
        currentLevel: progressionComponent.currentLevel,
        levelsUnlocked: Array.from(progressionComponent.levelsUnlocked),
        achievements,
        milestones,
        experience: progressionComponent.experience,
        experienceLevel: progressionComponent.experienceLevel,
        sessionsCompleted: progressionComponent.sessionsCompleted,
        bestSessionScore: progressionComponent.bestSessionScore
      };
    }
    
    // Serialize high score data
    if (highScoreComponent) {
      const levelHighScores: any = {};
      for (const [level, score] of highScoreComponent.levelHighScores) {
        levelHighScores[level.toString()] = score;
      }
      
      entityData.components.highScore = {
        globalHighScore: highScoreComponent.globalHighScore,
        personalBest: highScoreComponent.personalBest,
        levelHighScores,
        totalScoreEarned: highScoreComponent.totalScoreEarned,
        highScoreDate: highScoreComponent.highScoreDate,
        localLeaderboard: highScoreComponent.localLeaderboard
      };
    }
    
    // Serialize combo statistics (not active state)
    if (comboComponent) {
      entityData.components.combo = {
        allTimeMaxCombo: comboComponent.allTimeMaxCombo,
        longestComboStreak: comboComponent.longestComboStreak,
        totalCombos: comboComponent.totalCombos,
        comboBreaks: comboComponent.comboBreaks
      };
    }
    
    // Serialize powerup statistics
    if (powerupComponent) {
      entityData.components.powerup = {
        totalPowerupsCollected: powerupComponent.totalPowerupsCollected,
        doublersCollected: powerupComponent.doublersCollected
      };
    }
    
    return Object.keys(entityData.components).length > 0 ? entityData : null;
  }
  
  /**
   * Restore entity data
   */
  private async restoreEntities(entitiesData: any[]): Promise<void> {
    for (const entityData of entitiesData) {
      await this.restoreEntity(entityData);
    }
  }
  
  /**
   * Restore single entity
   */
  private async restoreEntity(entityData: any): Promise<void> {
    const { entityId, components } = entityData;
    
    // Restore score component
    if (components.score) {
      const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
      if (scoreComponent) {
        scoreComponent.currentScore = components.score.currentScore || 0;
        scoreComponent.totalCoinsCollected = components.score.totalCoinsCollected || 0;
        scoreComponent.totalDistanceTraveled = components.score.totalDistanceTraveled || 0;
        scoreComponent.sessionsPlayed = components.score.sessionsPlayed || 0;
      }
    }
    
    // Restore progression component
    if (components.progression) {
      const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
      if (progressionComponent) {
        progressionComponent.currentLevel = components.progression.currentLevel || 1;
        
        // Restore level unlocks
        progressionComponent.levelsUnlocked.clear();
        for (const level of components.progression.levelsUnlocked || [1]) {
          progressionComponent.levelsUnlocked.add(level);
        }
        
        // Restore achievements
        if (components.progression.achievements) {
          for (const [achievementId, data] of Object.entries(components.progression.achievements)) {
            const achievement = progressionComponent.achievements.get(achievementId);
            if (achievement && data) {
              const achievementData = data as any;
              achievement.progress = achievementData.progress || 0;
              achievement.isUnlocked = achievementData.isUnlocked || false;
              achievement.unlockedAt = achievementData.unlockedAt;
              
              if (achievement.isUnlocked) {
                progressionComponent.unlockedAchievements.add(achievementId);
              }
            }
          }
        }
        
        // Restore milestones
        if (components.progression.milestones) {
          for (const milestoneData of components.progression.milestones) {
            const milestone = progressionComponent.milestones.find(m => m.id === milestoneData.id);
            if (milestone) {
              milestone.isCompleted = milestoneData.isCompleted || false;
              milestone.completedAt = milestoneData.completedAt;
              
              if (milestone.isCompleted) {
                progressionComponent.completedMilestones.add(milestone.id);
              }
            }
          }
        }
        
        // Restore experience
        progressionComponent.experience = components.progression.experience || 0;
        progressionComponent.experienceLevel = components.progression.experienceLevel || 1;
        progressionComponent.sessionsCompleted = components.progression.sessionsCompleted || 0;
        progressionComponent.bestSessionScore = components.progression.bestSessionScore || 0;
      }
    }
    
    // Restore high score component
    if (components.highScore) {
      const highScoreComponent = this.world!.getComponent(entityId, 'highScore') as HighScoreComponent;
      if (highScoreComponent) {
        highScoreComponent.globalHighScore = components.highScore.globalHighScore || 0;
        highScoreComponent.personalBest = components.highScore.personalBest || 0;
        highScoreComponent.totalScoreEarned = components.highScore.totalScoreEarned || 0;
        highScoreComponent.highScoreDate = components.highScore.highScoreDate || 0;
        
        // Restore level high scores
        highScoreComponent.levelHighScores.clear();
        if (components.highScore.levelHighScores) {
          for (const [level, score] of Object.entries(components.highScore.levelHighScores)) {
            highScoreComponent.levelHighScores.set(level, score as number);
          }
        }
        
        // Restore leaderboard
        if (components.highScore.localLeaderboard) {
          highScoreComponent.localLeaderboard = components.highScore.localLeaderboard;
        }
      }
    }
    
    // Restore combo statistics
    if (components.combo) {
      const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
      if (comboComponent) {
        comboComponent.allTimeMaxCombo = components.combo.allTimeMaxCombo || 0;
        comboComponent.longestComboStreak = components.combo.longestComboStreak || 0;
        comboComponent.totalCombos = components.combo.totalCombos || 0;
        comboComponent.comboBreaks = components.combo.comboBreaks || 0;
      }
    }
    
    // Restore powerup statistics
    if (components.powerup) {
      const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
      if (powerupComponent) {
        powerupComponent.totalPowerupsCollected = components.powerup.totalPowerupsCollected || 0;
        powerupComponent.doublersCollected = components.powerup.doublersCollected || 0;
      }
    }
  }
  
  /**
   * Save to localStorage (faithful to original)
   */
  private async saveToLocalStorage(saveData: any): Promise<void> {
    const key = 'openRunner_gameData';
    const dataString = JSON.stringify(saveData);
    
    try {
      // Compress data if enabled
      const finalData = this.compressionEnabled ? 
        this.compressData(dataString) : dataString;
      
      localStorage.setItem(key, finalData);
      
      // Also save individual components for backwards compatibility
      await this.saveLegacyFormat(saveData);
      
      console.debug('Data saved to localStorage');
      
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw error;
    }
  }
  
  /**
   * Load from localStorage
   */
  private async loadFromLocalStorage(): Promise<any> {
    const key = 'openRunner_gameData';
    
    try {
      const dataString = localStorage.getItem(key);
      if (!dataString) {
        // Try loading legacy format
        return this.loadLegacyFormat();
      }
      
      // Decompress if needed
      const finalData = this.compressionEnabled ? 
        this.decompressData(dataString) : dataString;
      
      return JSON.parse(finalData);
      
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      
      // Try legacy format as fallback
      try {
        return this.loadLegacyFormat();
      } catch (legacyError) {
        console.error('Legacy format also failed:', legacyError);
        return null;
      }
    }
  }
  
  /**
   * Save in legacy format for backwards compatibility
   */
  private async saveLegacyFormat(saveData: any): Promise<void> {
    for (const entityData of saveData.entities) {
      const { components } = entityData;
      
      // Save high scores in original format
      if (components.highScore) {
        localStorage.setItem('openRunner_highScore', components.highScore.globalHighScore.toString());
        localStorage.setItem('openRunner_highScoresByLevel', JSON.stringify(components.highScore.levelHighScores));
      }
      
      // Save achievements
      if (components.progression && components.progression.achievements) {
        localStorage.setItem('openRunner_achievements', JSON.stringify(components.progression.achievements));
      }
      
      // Save milestones
      if (components.progression && components.progression.milestones) {
        const milestoneData: any = {};
        for (const milestone of components.progression.milestones) {
          milestoneData[milestone.id] = {
            isCompleted: milestone.isCompleted,
            completedAt: milestone.completedAt
          };
        }
        localStorage.setItem('openRunner_milestones', JSON.stringify(milestoneData));
      }
      
      // Save experience
      if (components.progression) {
        const experienceData = {
          total: components.progression.experience,
          level: components.progression.experienceLevel
        };
        localStorage.setItem('openRunner_experience', JSON.stringify(experienceData));
      }
    }
  }
  
  /**
   * Load legacy format
   */
  private loadLegacyFormat(): any {
    const saveData: any = {
      version: '0.9.0', // Legacy version
      timestamp: Date.now(),
      entities: [{
        entityId: 1, // Default entity ID
        components: {}
      }]
    };
    
    const entityData = saveData.entities[0];
    
    // Load high scores
    const globalHighScore = localStorage.getItem('openRunner_highScore');
    const levelHighScores = localStorage.getItem('openRunner_highScoresByLevel');
    
    if (globalHighScore || levelHighScores) {
      entityData.components.highScore = {
        globalHighScore: parseInt(globalHighScore || '0', 10),
        personalBest: parseInt(globalHighScore || '0', 10),
        levelHighScores: levelHighScores ? JSON.parse(levelHighScores) : {},
        totalScoreEarned: 0,
        highScoreDate: 0,
        localLeaderboard: []
      };
    }
    
    // Load achievements
    const achievements = localStorage.getItem('openRunner_achievements');
    if (achievements) {
      if (!entityData.components.progression) {
        entityData.components.progression = {};
      }
      entityData.components.progression.achievements = JSON.parse(achievements);
    }
    
    // Load milestones
    const milestones = localStorage.getItem('openRunner_milestones');
    if (milestones) {
      if (!entityData.components.progression) {
        entityData.components.progression = {};
      }
      const milestoneData = JSON.parse(milestones);
      entityData.components.progression.milestones = Object.entries(milestoneData).map(([id, data]: any) => ({
        id,
        isCompleted: data.isCompleted,
        completedAt: data.completedAt
      }));
    }
    
    // Load experience
    const experience = localStorage.getItem('openRunner_experience');
    if (experience) {
      const expData = JSON.parse(experience);
      if (!entityData.components.progression) {
        entityData.components.progression = {};
      }
      entityData.components.progression.experience = expData.total;
      entityData.components.progression.experienceLevel = expData.level;
    }
    
    return Object.keys(entityData.components).length > 0 ? saveData : null;
  }
  
  /**
   * Save to cloud (placeholder for future implementation)
   */
  private async saveToCloud(saveData: any): Promise<void> {
    // TODO: Implement cloud save functionality
    // This could integrate with services like:
    // - Firebase
    // - AWS S3
    // - Custom backend API
    console.debug('Cloud save not implemented yet');
  }
  
  /**
   * Load from cloud (placeholder for future implementation)
   */
  private async loadFromCloud(): Promise<any> {
    // TODO: Implement cloud load functionality
    console.debug('Cloud load not implemented yet');
    return null;
  }
  
  /**
   * Validate save data integrity
   */
  private validateSaveData(saveData: any): boolean {
    if (!saveData || typeof saveData !== 'object') {
      return false;
    }
    
    if (!saveData.version || !saveData.timestamp) {
      return false;
    }
    
    if (!Array.isArray(saveData.entities)) {
      return false;
    }
    
    // Validate each entity
    for (const entityData of saveData.entities) {
      if (!entityData.entityId || !entityData.components) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Simple data compression (placeholder)
   */
  private compressData(data: string): string {
    // TODO: Implement actual compression (e.g., LZ-string)
    return data;
  }
  
  /**
   * Simple data decompression (placeholder)
   */
  private decompressData(data: string): string {
    // TODO: Implement actual decompression
    return data;
  }
  
  /**
   * Handle auto-save
   */
  private handleAutoSave(): void {
    const currentTime = performance.now();
    
    if (this.saveDirty && (currentTime - this.lastAutoSave) > this.autoSaveInterval) {
      this.saveAllData();
      this.lastAutoSave = currentTime;
    }
  }
  
  /**
   * Handle cloud sync
   */
  private handleCloudSync(): void {
    if (!this.cloudSaveEnabled) return;
    
    const currentTime = performance.now();
    
    if ((currentTime - this.lastCloudSave) > this.cloudSaveInterval) {
      // TODO: Implement cloud sync logic
      this.lastCloudSave = currentTime;
    }
  }
  
  /**
   * Subscribe to save events
   */
  private subscribeToEvents(): void {
    if (!this.world) return;
    
    // Mark data as dirty when score changes
    this.world.on('score_updated', () => {
      this.saveDirty = true;
    });
    
    // Mark data as dirty when progression changes
    this.world.on('achievement_unlocked', () => {
      this.saveDirty = true;
    });
    
    this.world.on('level_unlocked', () => {
      this.saveDirty = true;
    });
    
    this.world.on('milestone_completed', () => {
      this.saveDirty = true;
    });
    
    // Force save on game end
    this.world.on('game_ended', () => {
      this.saveAllData(true);
    });
    
    // Force save on level complete
    this.world.on('level_completed', () => {
      this.saveAllData(true);
    });
  }
  
  /**
   * Export save data for backup
   */
  async exportSaveData(): Promise<string | null> {
    try {
      const saveData = await this.loadFromLocalStorage();
      if (!saveData) return null;
      
      return JSON.stringify(saveData, null, 2);
      
    } catch (error) {
      console.error('Error exporting save data:', error);
      return null;
    }
  }
  
  /**
   * Import save data from backup
   */
  async importSaveData(dataString: string): Promise<boolean> {
    try {
      const saveData = JSON.parse(dataString);
      
      if (!this.validateSaveData(saveData)) {
        console.error('Invalid save data format');
        return false;
      }
      
      await this.saveToLocalStorage(saveData);
      await this.restoreEntities(saveData.entities || []);
      
      console.debug('Save data imported successfully');
      return true;
      
    } catch (error) {
      console.error('Error importing save data:', error);
      return false;
    }
  }
  
  /**
   * Clear all save data
   */
  clearAllData(): void {
    // Clear new format
    localStorage.removeItem('openRunner_gameData');
    
    // Clear legacy format
    localStorage.removeItem('openRunner_highScore');
    localStorage.removeItem('openRunner_highScoresByLevel');
    localStorage.removeItem('openRunner_achievements');
    localStorage.removeItem('openRunner_milestones');
    localStorage.removeItem('openRunner_experience');
    
    this.saveDirty = false;
    
    console.debug('All save data cleared');
    
    // Emit clear event
    this.world?.emit('data_cleared', {
      timestamp: performance.now()
    });
  }
  
  /**
   * Get persistence statistics
   */
  getStatistics() {
    return {
      saveCount: this.saveCount,
      loadCount: this.loadCount,
      lastSaveTime: this.lastSaveTime,
      lastLoadTime: this.lastLoadTime,
      saveDirty: this.saveDirty,
      cloudSaveEnabled: this.cloudSaveEnabled,
      autoSaveInterval: this.autoSaveInterval,
      compressionEnabled: this.compressionEnabled,
      saveVersion: this.saveVersion
    };
  }
}
