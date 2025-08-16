import { BaseSystem } from '@/systems/core/BaseSystem';
import type { World } from '@/core/ecs/World';
import type { EntityId } from '@/types';
import type { ScoreComponent } from '@/components/score/ScoreComponent';
import type { ComboComponent } from '@/components/score/ComboComponent';
import type { PowerupComponent } from '@/components/score/PowerupComponent';
import type { ProgressionComponent } from '@/components/score/ProgressionComponent';
import type { HighScoreComponent } from '@/components/score/HighScoreComponent';
import { ScoreCalculator, ScoreEventUtils } from '@/components/score/ScoreComponent';
import { ComboManager } from '@/components/score/ComboComponent';
import { PowerupManager } from '@/components/score/PowerupComponent';
import { ProgressionUtils } from '@/components/score/ProgressionComponent';
import { HighScoreManager } from '@/components/score/HighScoreComponent';

/**
 * ScoreSystem - Manages all scoring mechanics and integration
 * 
 * Faithfully recreates original Open Runner scoring:
 * - Base coin value: 10 points
 * - Doubler powerup: 2x multiplier for 15 seconds
 * - Level progression: 300 points unlocks Level 2
 * - Persistent high scores via localStorage
 * 
 * Modern additions:
 * - Combo system for skilled play
 * - Achievement system
 * - Visual feedback and animations
 * - Performance analytics
 */
export class ScoreSystem extends BaseSystem {
  private static readonly COIN_COLLECT_EVENT = 'coin_collected';
  private static readonly DISTANCE_EVENT = 'distance_traveled';
  private static readonly POWERUP_EVENT = 'powerup_collected';
  private static readonly DAMAGE_EVENT = 'player_damaged';
  private static readonly LEVEL_COMPLETE_EVENT = 'level_completed';
  
  // Event listeners
  private eventListeners: Map<string, (data: any) => void> = new Map();
  
  // Performance tracking
  private frameScoreCalculations = 0;
  private lastPerformanceReset = 0;
  
  constructor() {
    super('ScoreSystem');
    this.setupEventListeners();
  }
  
  initialize(world: World): void {
    super.initialize(world);
    
    // Subscribe to scoring events
    this.subscribeToEvents();
    
    console.debug('ScoreSystem initialized with original game mechanics');
  }
  
  update(deltaTime: number): void {
    if (!this.world) return;
    
    const startTime = performance.now();
    
    // Get all entities with score components
    const scoreEntities = this.world.getEntitiesWithComponents(['score']);
    
    for (const entity of scoreEntities) {
      this.updateScoreEntity(entity.id, deltaTime);
    }
    
    // Update performance metrics
    this.frameScoreCalculations++;
    const updateTime = performance.now() - startTime;
    this.updatePerformanceMetrics(updateTime);
  }
  
  /**
   * Update a single score entity
   */
  private updateScoreEntity(entityId: EntityId, deltaTime: number): void {
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    if (!scoreComponent) return;
    
    // Process pending score events
    const processedEvents = ScoreEventUtils.processPendingEvents(scoreComponent);
    
    // Update score animations
    ScoreEventUtils.updateAnimations(scoreComponent, deltaTime);
    
    // Update combo system if present
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    if (comboComponent) {
      const comboWasBroken = ComboManager.updateCombo(comboComponent, deltaTime);
      
      if (comboWasBroken) {
        this.handleComboBreak(scoreComponent, comboComponent);
      }
    }
    
    // Update powerup system if present
    const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
    if (powerupComponent) {
      PowerupManager.updatePowerups(powerupComponent, deltaTime);
      
      // Sync powerup effects to score component
      this.syncPowerupEffects(scoreComponent, powerupComponent);
    }
    
    // Update progression system if present
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    if (progressionComponent) {
      this.updateProgression(scoreComponent, progressionComponent, comboComponent);
    }
    
    // Update high score tracking if present
    const highScoreComponent = this.world!.getComponent(entityId, 'highScore') as HighScoreComponent;
    if (highScoreComponent) {
      this.updateHighScores(scoreComponent, highScoreComponent, progressionComponent);
    }
    
    // Emit score updates if changed
    if (scoreComponent.scoreDisplayDirty) {
      this.emitScoreUpdate(entityId, scoreComponent);
      scoreComponent.scoreDisplayDirty = false;
    }
  }
  
  /**
   * Handle coin collection (faithful to original mechanics)
   */
  handleCoinCollection(
    entityId: EntityId,
    coinValue: number = 10, // Original base value
    position?: { x: number; y: number; z: number }
  ): number {
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
    
    if (!scoreComponent) return 0;
    
    // Register combo action
    let comboMultiplier = 1;
    if (comboComponent) {
      const comboResult = ComboManager.registerAction(comboComponent, 'coin_collect', position);
      comboMultiplier = comboResult.multiplier;
      
      // Add combo bonus points
      if (comboResult.bonusPoints > 0) {
        ScoreCalculator.applyScore(
          scoreComponent,
          comboResult.bonusPoints,
          'combo',
          position
        );
      }
    }
    
    // Calculate coin score with all modifiers
    const finalScore = ScoreCalculator.calculateCoinScore(scoreComponent, comboMultiplier);
    
    // Apply the score
    ScoreCalculator.applyScore(scoreComponent, finalScore, 'coin', position);
    
    // Update statistics
    scoreComponent.totalCoinsCollected++;
    
    // Update progression achievements
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    if (progressionComponent) {
      ProgressionUtils.updateAchievementProgress(
        progressionComponent,
        'coins',
        scoreComponent.totalCoinsCollected
      );
    }
    
    console.debug(`Coin collected: +${finalScore} points (base: ${coinValue}, combo: ${comboMultiplier}x)`);
    
    return finalScore;
  }
  
  /**
   * Handle distance scoring
   */
  handleDistanceScore(
    entityId: EntityId,
    distance: number,
    position?: { x: number; y: number; z: number }
  ): number {
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    if (!scoreComponent) return 0;
    
    const points = ScoreCalculator.calculateDistanceScore(scoreComponent, distance);
    
    if (points > 0) {
      ScoreCalculator.applyScore(scoreComponent, points, 'distance', position);
      scoreComponent.totalDistanceTraveled += distance;
      
      // Update progression
      const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
      if (progressionComponent) {
        ProgressionUtils.updateAchievementProgress(
          progressionComponent,
          'distance',
          scoreComponent.totalDistanceTraveled
        );
      }
    }
    
    return points;
  }
  
  /**
   * Handle powerup collection
   */
  handlePowerupCollection(
    entityId: EntityId,
    powerupType: string,
    position?: { x: number; y: number; z: number }
  ): boolean {
    const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    
    if (!powerupComponent) return false;
    
    // Activate the powerup
    const success = PowerupManager.activatePowerup(powerupComponent, powerupType, position);
    
    if (success) {
      // Register combo action for powerup collection
      if (comboComponent) {
        ComboManager.registerAction(comboComponent, 'powerup_collect', position);
      }
      
      // Award bonus points for powerup collection
      const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
      if (scoreComponent) {
        const bonusPoints = this.getPowerupBonusPoints(powerupType);
        if (bonusPoints > 0) {
          ScoreCalculator.applyScore(scoreComponent, bonusPoints, 'bonus', position);
        }
      }
      
      console.debug(`Powerup collected: ${powerupType}`);
    }
    
    return success;
  }
  
  /**
   * Handle player damage (breaks combos)
   */
  handlePlayerDamage(entityId: EntityId): void {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
    
    // Check invulnerability
    if (powerupComponent && PowerupManager.isInvulnerable(powerupComponent)) {
      console.debug('Player is invulnerable, damage ignored');
      return;
    }
    
    // Break combo on damage
    if (comboComponent && comboComponent.isComboActive) {
      ComboManager.breakCombo(comboComponent, 'damage');
      console.debug('Combo broken due to damage');
    }
  }
  
  /**
   * Handle level completion
   */
  handleLevelComplete(
    entityId: EntityId,
    levelId: string | number,
    completionBonus: number = 100
  ): void {
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    const progressionComponent = this.world!.getComponent(entityId, 'progression') as ProgressionComponent;
    const highScoreComponent = this.world!.getComponent(entityId, 'highScore') as HighScoreComponent;
    
    if (!scoreComponent) return;
    
    // Award completion bonus
    ScoreCalculator.applyScore(scoreComponent, completionBonus, 'bonus');
    
    // Update session statistics
    scoreComponent.sessionsPlayed++;
    
    // Update progression
    if (progressionComponent) {
      progressionComponent.sessionsCompleted++;
      progressionComponent.bestSessionScore = Math.max(
        progressionComponent.bestSessionScore,
        scoreComponent.sessionScore
      );
      
      // Check for level unlocks and achievements
      ProgressionUtils.checkLevelUnlocks(progressionComponent, scoreComponent.currentScore);
      ProgressionUtils.checkMilestones(progressionComponent, scoreComponent.currentScore);
      ProgressionUtils.updateAchievementProgress(progressionComponent, 'sessions', progressionComponent.sessionsCompleted);
    }
    
    // Update high scores
    if (highScoreComponent) {
      const metadata = {
        coins: scoreComponent.totalCoinsCollected,
        distance: scoreComponent.totalDistanceTraveled,
        duration: performance.now() // Simple duration tracking
      };
      
      HighScoreManager.updateHighScore(
        highScoreComponent,
        scoreComponent.currentScore,
        levelId,
        metadata
      );
    }
    
    console.debug(`Level ${levelId} completed with ${scoreComponent.currentScore} points`);
  }
  
  /**
   * Sync powerup effects to score component
   */
  private syncPowerupEffects(scoreComponent: ScoreComponent, powerupComponent: PowerupComponent): void {
    // Update doubler state (faithful to original)
    scoreComponent.doublerActive = powerupComponent.doublerActive;
    scoreComponent.doublerTimeRemaining = powerupComponent.doublerTimeRemaining;
    
    // Update global score multiplier
    scoreComponent.scoreMultiplier = powerupComponent.scoreMultiplier;
  }
  
  /**
   * Update progression system
   */
  private updateProgression(
    scoreComponent: ScoreComponent,
    progressionComponent: ProgressionComponent,
    comboComponent?: ComboComponent
  ): void {
    // Update score-based achievements
    ProgressionUtils.updateAchievementProgress(
      progressionComponent,
      'score',
      scoreComponent.currentScore
    );
    
    // Update combo achievements
    if (comboComponent) {
      ProgressionUtils.updateAchievementProgress(
        progressionComponent,
        'combo',
        comboComponent.maxCombo
      );
    }
    
    // Check level unlocks (faithful to original 300-point threshold)
    ProgressionUtils.checkLevelUnlocks(progressionComponent, scoreComponent.currentScore);
    
    // Check milestones
    ProgressionUtils.checkMilestones(progressionComponent, scoreComponent.currentScore);
    
    // Update experience level
    ProgressionUtils.updateExperienceLevel(progressionComponent);
  }
  
  /**
   * Update high score tracking
   */
  private updateHighScores(
    scoreComponent: ScoreComponent,
    highScoreComponent: HighScoreComponent,
    progressionComponent?: ProgressionComponent
  ): void {
    // Auto-save high scores periodically
    const currentTime = performance.now();
    const shouldSave = highScoreComponent.needsSave && 
      (currentTime - highScoreComponent.lastSaveTime) > 5000; // Save every 5 seconds
    
    if (shouldSave) {
      HighScoreManager.saveHighScores(highScoreComponent);
    }
  }
  
  /**
   * Handle combo break event
   */
  private handleComboBreak(scoreComponent: ScoreComponent, comboComponent: ComboComponent): void {
    // Could award consolation points for long combos
    if (comboComponent.maxCombo >= 10) {
      const consolationPoints = comboComponent.maxCombo * 2;
      ScoreCalculator.applyScore(scoreComponent, consolationPoints, 'bonus');
      
      console.debug(`Combo consolation bonus: +${consolationPoints} points`);
    }
  }
  
  /**
   * Get bonus points for powerup collection
   */
  private getPowerupBonusPoints(powerupType: string): number {
    const bonusMap: Record<string, number> = {
      'doubler': 25,
      'speed_boost': 15,
      'jump_boost': 15,
      'coin_magnet': 30,
      'invincibility': 50,
      'mega_multiplier': 100
    };
    
    return bonusMap[powerupType] || 10;
  }
  
  /**
   * Emit score update event
   */
  private emitScoreUpdate(entityId: EntityId, scoreComponent: ScoreComponent): void {
    const event = {
      entityId,
      currentScore: scoreComponent.currentScore,
      sessionScore: scoreComponent.sessionScore,
      scoreGain: scoreComponent.lastScoreGain,
      multiplier: scoreComponent.scoreMultiplier,
      doublerActive: scoreComponent.doublerActive,
      doublerTimeRemaining: scoreComponent.doublerTimeRemaining
    };
    
    // Emit to UI system for display updates
    this.world!.emit('score_updated', event);
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.eventListeners.set('coin_collected', (data) => {
      this.handleCoinCollection(data.entityId, data.value, data.position);
    });
    
    this.eventListeners.set('distance_traveled', (data) => {
      this.handleDistanceScore(data.entityId, data.distance, data.position);
    });
    
    this.eventListeners.set('powerup_collected', (data) => {
      this.handlePowerupCollection(data.entityId, data.powerupType, data.position);
    });
    
    this.eventListeners.set('player_damaged', (data) => {
      this.handlePlayerDamage(data.entityId);
    });
    
    this.eventListeners.set('level_completed', (data) => {
      this.handleLevelComplete(data.entityId, data.levelId, data.bonus);
    });
  }
  
  /**
   * Subscribe to world events
   */
  private subscribeToEvents(): void {
    if (!this.world) return;
    
    for (const [eventName, handler] of this.eventListeners) {
      this.world.on(eventName, handler);
    }
  }
  
  /**
   * Reset session scores
   */
  resetSessionScores(): void {
    if (!this.world) return;
    
    const scoreEntities = this.world.getEntitiesWithComponents(['score']);
    
    for (const entity of scoreEntities) {
      const scoreComponent = this.world.getComponent(entity.id, 'score') as ScoreComponent;
      if (scoreComponent) {
        scoreComponent.sessionScore = 0;
        scoreComponent.lastFrameScore = scoreComponent.currentScore;
        scoreComponent.scoreDisplayDirty = true;
      }
    }
    
    console.debug('Session scores reset');
  }
  
  /**
   * Get scoring statistics
   */
  getStatistics() {
    if (!this.world) return null;
    
    const scoreEntities = this.world.getEntitiesWithComponents(['score']);
    const stats = {
      totalEntities: scoreEntities.length,
      totalScore: 0,
      totalCoins: 0,
      totalDistance: 0,
      activeCombos: 0,
      activePowerups: 0
    };
    
    for (const entity of scoreEntities) {
      const scoreComponent = this.world.getComponent(entity.id, 'score') as ScoreComponent;
      const comboComponent = this.world.getComponent(entity.id, 'combo') as ComboComponent;
      const powerupComponent = this.world.getComponent(entity.id, 'powerup') as PowerupComponent;
      
      if (scoreComponent) {
        stats.totalScore += scoreComponent.currentScore;
        stats.totalCoins += scoreComponent.totalCoinsCollected;
        stats.totalDistance += scoreComponent.totalDistanceTraveled;
      }
      
      if (comboComponent && comboComponent.isComboActive) {
        stats.activeCombos++;
      }
      
      if (powerupComponent && powerupComponent.hasActivePowerups) {
        stats.activePowerups++;
      }
    }
    
    return stats;
  }
  
  /**
   * Clean up event listeners
   */
  cleanup(): void {
    if (this.world) {
      for (const [eventName, handler] of this.eventListeners) {
        this.world.off(eventName, handler);
      }
    }
    
    super.cleanup();
  }
}
