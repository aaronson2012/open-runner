import type { Component, EntityId } from '@/types';

/**
 * HighScoreComponent - Manages persistent high score records
 */
export interface HighScoreComponent extends Component {
  type: 'highScore';
  
  // Global high scores (faithful to original)
  globalHighScore: number;
  personalBest: number;
  
  // Level-specific high scores
  levelHighScores: Map<string | number, number>;
  
  // Session tracking
  sessionHighScore: number;
  
  // Leaderboard data (for future cloud integration)
  localLeaderboard: LeaderboardEntry[];
  cloudLeaderboard?: LeaderboardEntry[];
  
  // Persistence settings
  localStorageKey: string;
  levelStorageKey: string;
  autoSave: boolean;
  
  // New record tracking
  isNewGlobalRecord: boolean;
  isNewLevelRecord: Map<string | number, boolean>;
  isNewSessionRecord: boolean;
  
  // Statistics
  totalScoreEarned: number;
  highScoreDate: number;
  
  // Comparison data
  previousSessionScore: number;
  scoreImprovement: number;
  
  // State flags
  needsSave: boolean;
  lastSaveTime: number;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  level?: string | number;
  timestamp: number;
  
  // Additional context
  coinsCollected?: number;
  distanceTraveled?: number;
  sessionDuration?: number;
  
  // Verification (for cloud sync)
  checksum?: string;
}

export interface HighScoreRecord {
  score: number;
  timestamp: number;
  level?: string | number;
  metadata?: {
    coins: number;
    distance: number;
    duration: number;
    achievements?: string[];
  };
}

/**
 * Create a new HighScoreComponent with original game persistence
 */
export function createHighScoreComponent(
  options: Partial<{
    localStorageKey: string;
    levelStorageKey: string;
    autoSave: boolean;
  }> = {}
): HighScoreComponent {
  return {
    type: 'highScore',
    entityId: 0,
    
    // Score records
    globalHighScore: 0,
    personalBest: 0,
    levelHighScores: new Map(),
    sessionHighScore: 0,
    
    // Leaderboards
    localLeaderboard: [],
    
    // Persistence (faithful to original)
    localStorageKey: options.localStorageKey ?? 'openRunner_highScore',
    levelStorageKey: options.levelStorageKey ?? 'openRunner_highScoresByLevel',
    autoSave: options.autoSave ?? true,
    
    // New record flags
    isNewGlobalRecord: false,
    isNewLevelRecord: new Map(),
    isNewSessionRecord: false,
    
    // Statistics
    totalScoreEarned: 0,
    highScoreDate: 0,
    
    // Comparison
    previousSessionScore: 0,
    scoreImprovement: 0,
    
    // State
    needsSave: false,
    lastSaveTime: 0
  };
}

/**
 * High score management utilities
 */
export class HighScoreManager {
  /**
   * Load high scores from localStorage (faithful to original)
   */
  static loadHighScores(component: HighScoreComponent): void {
    try {
      // Load global high score
      const storedHighScore = localStorage.getItem(component.localStorageKey);
      if (storedHighScore !== null) {
        component.globalHighScore = parseInt(storedHighScore, 10) || 0;
        component.personalBest = component.globalHighScore;
        console.debug(`Loaded global high score: ${component.globalHighScore}`);
      }
      
      // Load level-specific high scores
      const storedLevelScores = localStorage.getItem(component.levelStorageKey);
      if (storedLevelScores !== null) {
        const levelScores = JSON.parse(storedLevelScores);
        component.levelHighScores.clear();
        
        for (const [level, score] of Object.entries(levelScores)) {
          component.levelHighScores.set(level, score as number);
        }
        
        console.debug('Loaded level-specific high scores', levelScores);
      }
      
      // Load leaderboard data
      const leaderboardKey = `${component.localStorageKey}_leaderboard`;
      const storedLeaderboard = localStorage.getItem(leaderboardKey);
      if (storedLeaderboard !== null) {
        component.localLeaderboard = JSON.parse(storedLeaderboard);
      }
      
      // Load total score statistics
      const statsKey = `${component.localStorageKey}_stats`;
      const storedStats = localStorage.getItem(statsKey);
      if (storedStats !== null) {
        const stats = JSON.parse(storedStats);
        component.totalScoreEarned = stats.totalScoreEarned || 0;
        component.highScoreDate = stats.highScoreDate || 0;
      }
      
    } catch (error) {
      console.error('Error loading high scores from localStorage:', error);
      // Reset to defaults if corrupted
      this.resetHighScores(component);
    }
  }
  
  /**
   * Save high scores to localStorage (faithful to original)
   */
  static saveHighScores(component: HighScoreComponent): void {
    try {
      // Save global high score
      localStorage.setItem(component.localStorageKey, component.globalHighScore.toString());
      
      // Save level-specific high scores
      const levelScoresObj: Record<string, number> = {};
      for (const [level, score] of component.levelHighScores) {
        levelScoresObj[level.toString()] = score;
      }
      localStorage.setItem(component.levelStorageKey, JSON.stringify(levelScoresObj));
      
      // Save leaderboard data
      const leaderboardKey = `${component.localStorageKey}_leaderboard`;
      localStorage.setItem(leaderboardKey, JSON.stringify(component.localLeaderboard));
      
      // Save statistics
      const statsKey = `${component.localStorageKey}_stats`;
      const stats = {
        totalScoreEarned: component.totalScoreEarned,
        highScoreDate: component.highScoreDate
      };
      localStorage.setItem(statsKey, JSON.stringify(stats));
      
      component.needsSave = false;
      component.lastSaveTime = performance.now();
      
      console.debug('High scores saved to localStorage');
      
    } catch (error) {
      console.error('Error saving high scores to localStorage:', error);
    }
  }
  
  /**
   * Update high score with new score (faithful to original logic)
   */
  static updateHighScore(
    component: HighScoreComponent,
    newScore: number,
    level?: string | number,
    metadata?: HighScoreRecord['metadata']
  ): {
    isNewGlobal: boolean;
    isNewLevel: boolean;
    isNewSession: boolean;
  } {
    const result = {
      isNewGlobal: false,
      isNewLevel: false,
      isNewSession: false
    };
    
    // Update session high score
    if (newScore > component.sessionHighScore) {
      component.sessionHighScore = newScore;
      result.isNewSession = true;
      component.isNewSessionRecord = true;
    }
    
    // Update global high score
    if (newScore > component.globalHighScore) {
      component.globalHighScore = newScore;
      component.personalBest = newScore;
      component.highScoreDate = Date.now();
      result.isNewGlobal = true;
      component.isNewGlobalRecord = true;
      
      console.debug(`New global high score: ${newScore}`);
    }
    
    // Update level-specific high score
    if (level !== undefined) {
      const currentLevelScore = component.levelHighScores.get(level) || 0;
      if (newScore > currentLevelScore) {
        component.levelHighScores.set(level, newScore);
        result.isNewLevel = true;
        component.isNewLevelRecord.set(level, true);
        
        console.debug(`New high score for level ${level}: ${newScore}`);
      }
    }
    
    // Update statistics
    component.totalScoreEarned += newScore;
    
    // Add to leaderboard
    if (result.isNewGlobal || result.isNewLevel) {
      this.addLeaderboardEntry(component, {
        id: `entry_${Date.now()}_${Math.random()}`,
        playerName: 'Player', // Can be customized later
        score: newScore,
        level,
        timestamp: Date.now(),
        coinsCollected: metadata?.coins,
        distanceTraveled: metadata?.distance,
        sessionDuration: metadata?.duration
      });
    }
    
    // Mark for saving
    component.needsSave = true;
    
    // Auto-save if enabled
    if (component.autoSave) {
      this.saveHighScores(component);
    }
    
    return result;
  }
  
  /**
   * Check if score would be a new record
   */
  static wouldBeNewRecord(
    component: HighScoreComponent,
    score: number,
    level?: string | number
  ): {
    global: boolean;
    level: boolean;
    session: boolean;
  } {
    return {
      global: score > component.globalHighScore,
      level: level !== undefined ? score > (component.levelHighScores.get(level) || 0) : false,
      session: score > component.sessionHighScore
    };
  }
  
  /**
   * Get high score for specific level
   */
  static getLevelHighScore(
    component: HighScoreComponent,
    level: string | number
  ): number {
    return component.levelHighScores.get(level) || 0;
  }
  
  /**
   * Check if level is unlocked based on score thresholds
   */
  static isLevelUnlocked(
    component: HighScoreComponent,
    level: string | number,
    unlockThreshold: number = 300
  ): boolean {
    // Level 1 always unlocked
    if (level === 1 || level === 'level1') {
      return true;
    }
    
    // Level 2 unlocked with 300+ points (faithful to original)
    if (level === 2 || level === 'level2') {
      return component.globalHighScore >= unlockThreshold || 
             component.levelHighScores.get(1) >= unlockThreshold ||
             component.levelHighScores.get('level1') >= unlockThreshold;
    }
    
    // Future levels can have custom logic
    return false;
  }
  
  /**
   * Add entry to local leaderboard
   */
  static addLeaderboardEntry(
    component: HighScoreComponent,
    entry: LeaderboardEntry
  ): void {
    component.localLeaderboard.push(entry);
    
    // Sort by score (descending)
    component.localLeaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top 100 entries
    if (component.localLeaderboard.length > 100) {
      component.localLeaderboard = component.localLeaderboard.slice(0, 100);
    }
  }
  
  /**
   * Get leaderboard for specific level
   */
  static getLeaderboard(
    component: HighScoreComponent,
    level?: string | number,
    limit: number = 10
  ): LeaderboardEntry[] {
    let leaderboard = component.localLeaderboard;
    
    // Filter by level if specified
    if (level !== undefined) {
      leaderboard = leaderboard.filter(entry => entry.level === level);
    }
    
    return leaderboard.slice(0, limit);
  }
  
  /**
   * Reset all high scores
   */
  static resetHighScores(component: HighScoreComponent): void {
    component.globalHighScore = 0;
    component.personalBest = 0;
    component.levelHighScores.clear();
    component.sessionHighScore = 0;
    component.localLeaderboard = [];
    component.totalScoreEarned = 0;
    component.highScoreDate = 0;
    
    // Clear new record flags
    component.isNewGlobalRecord = false;
    component.isNewLevelRecord.clear();
    component.isNewSessionRecord = false;
    
    component.needsSave = true;
    
    console.debug('High scores reset');
  }
  
  /**
   * Export high scores for backup
   */
  static exportHighScores(component: HighScoreComponent): string {
    const exportData = {
      globalHighScore: component.globalHighScore,
      levelHighScores: Object.fromEntries(component.levelHighScores),
      leaderboard: component.localLeaderboard,
      totalScoreEarned: component.totalScoreEarned,
      highScoreDate: component.highScoreDate,
      exportedAt: Date.now()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Import high scores from backup
   */
  static importHighScores(component: HighScoreComponent, data: string): boolean {
    try {
      const importData = JSON.parse(data);
      
      // Validate data structure
      if (typeof importData.globalHighScore !== 'number') {
        throw new Error('Invalid global high score');
      }
      
      // Import data
      component.globalHighScore = importData.globalHighScore;
      component.personalBest = importData.globalHighScore;
      
      if (importData.levelHighScores) {
        component.levelHighScores.clear();
        for (const [level, score] of Object.entries(importData.levelHighScores)) {
          component.levelHighScores.set(level, score as number);
        }
      }
      
      if (importData.leaderboard) {
        component.localLeaderboard = importData.leaderboard;
      }
      
      if (importData.totalScoreEarned) {
        component.totalScoreEarned = importData.totalScoreEarned;
      }
      
      if (importData.highScoreDate) {
        component.highScoreDate = importData.highScoreDate;
      }
      
      component.needsSave = true;
      
      console.debug('High scores imported successfully');
      return true;
      
    } catch (error) {
      console.error('Error importing high scores:', error);
      return false;
    }
  }
  
  /**
   * Clear new record flags (call after displaying notifications)
   */
  static clearNewRecordFlags(component: HighScoreComponent): void {
    component.isNewGlobalRecord = false;
    component.isNewLevelRecord.clear();
    component.isNewSessionRecord = false;
  }
}
