import { BaseSystem } from '@/systems/core/BaseSystem';
import type { World } from '@/core/ecs/World';
import type { EntityId } from '@/types';
import type { ComboComponent } from '@/components/score/ComboComponent';
import { ComboManager } from '@/components/score/ComboComponent';

/**
 * ComboSystem - Manages combo chains and bonus multipliers
 * 
 * Enhances the original game with modern combo mechanics:
 * - Chain actions for bonus multipliers
 * - Visual feedback for combo states
 * - Different combo types with unique effects
 * - Timeout-based combo breaking
 */
export class ComboSystem extends BaseSystem {
  // Combo tracking
  private comboEntities = new Set<EntityId>();
  private lastComboUpdate = 0;
  
  // Sound effect cooldowns
  private soundCooldowns = new Map<string, number>();
  
  constructor() {
    super('ComboSystem');
  }
  
  initialize(world: World): void {
    super.initialize(world);
    
    // Subscribe to combo-related events
    this.subscribeToEvents();
    
    console.debug('ComboSystem initialized');
  }
  
  update(deltaTime: number): void {
    if (!this.world) return;
    
    const startTime = performance.now();
    
    // Get all entities with combo components
    const comboEntities = this.world.getEntitiesWithComponents(['combo']);
    
    // Update combo tracking
    this.comboEntities.clear();
    comboEntities.forEach(entity => this.comboEntities.add(entity.id));
    
    for (const entity of comboEntities) {
      this.updateComboEntity(entity.id, deltaTime);
    }
    
    // Update sound cooldowns
    this.updateSoundCooldowns(deltaTime);
    
    // Update performance metrics
    const updateTime = performance.now() - startTime;
    this.updatePerformanceMetrics(updateTime);
  }
  
  /**
   * Update a single combo entity
   */
  private updateComboEntity(entityId: EntityId, deltaTime: number): void {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    if (!comboComponent) return;
    
    // Update combo timer and check for breaks
    const comboBroken = ComboManager.updateCombo(comboComponent, deltaTime);
    
    if (comboBroken) {
      this.handleComboBreak(entityId, comboComponent);
    }
    
    // Update combo level change notifications
    if (comboComponent.comboLevelChanged) {
      this.emitComboLevelChange(entityId, comboComponent);
      comboComponent.comboLevelChanged = false;
    }
    
    // Check for combo milestones
    this.checkComboMilestones(entityId, comboComponent);
    
    // Play combo sounds
    this.handleComboSounds(entityId, comboComponent);
  }
  
  /**
   * Register a combo action
   */
  registerComboAction(
    entityId: EntityId,
    actionType: string,
    position?: { x: number; y: number; z: number }
  ): {
    success: boolean;
    comboLevel: number;
    multiplier: number;
    bonusPoints: number;
  } {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    
    if (!comboComponent) {
      return {
        success: false,
        comboLevel: 0,
        multiplier: 1,
        bonusPoints: 0
      };
    }
    
    // Register the action
    const result = ComboManager.registerAction(comboComponent, actionType, position);
    
    // Emit combo action event
    this.world!.emit('combo_action', {
      entityId,
      actionType,
      comboLevel: result.comboLevel,
      multiplier: result.multiplier,
      bonusPoints: result.bonusPoints,
      position,
      timestamp: performance.now()
    });
    
    // Play combo sound
    this.playComboSound(result.comboLevel, result.comboType);
    
    console.debug(`Combo action: ${actionType} -> ${result.comboLevel}x (${result.multiplier.toFixed(1)}x multiplier)`);
    
    return {
      success: true,
      comboLevel: result.comboLevel,
      multiplier: result.multiplier,
      bonusPoints: result.bonusPoints
    };
  }
  
  /**
   * Force break a combo (e.g., on damage)
   */
  breakCombo(
    entityId: EntityId,
    reason: 'timeout' | 'damage' | 'manual' = 'manual'
  ): boolean {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    
    if (!comboComponent || !comboComponent.isComboActive) {
      return false;
    }
    
    const finalComboLevel = comboComponent.currentCombo;
    
    // Break the combo
    ComboManager.breakCombo(comboComponent, reason);
    
    // Handle the break
    this.handleComboBreak(entityId, comboComponent, reason, finalComboLevel);
    
    console.debug(`Combo broken (${reason}): final level ${finalComboLevel}`);
    
    return true;
  }
  
  /**
   * Handle combo break
   */
  private handleComboBreak(
    entityId: EntityId,
    comboComponent: ComboComponent,
    reason: string = 'timeout',
    finalLevel?: number
  ): void {
    const comboLevel = finalLevel ?? comboComponent.longestComboStreak;
    
    // Emit combo break event
    this.world!.emit('combo_broken', {
      entityId,
      reason,
      finalLevel: comboLevel,
      timestamp: performance.now()
    });
    
    // Play break sound
    this.playComboBreakSound(reason, comboLevel);
    
    // Award consolation points for long combos
    if (comboLevel >= 5) {
      const consolationPoints = Math.floor(comboLevel * 1.5);
      
      this.world!.emit('combo_consolation', {
        entityId,
        points: consolationPoints,
        comboLevel,
        timestamp: performance.now()
      });
      
      console.debug(`Combo consolation: +${consolationPoints} points for ${comboLevel}x combo`);
    }
  }
  
  /**
   * Emit combo level change event
   */
  private emitComboLevelChange(entityId: EntityId, comboComponent: ComboComponent): void {
    const event = {
      entityId,
      comboLevel: comboComponent.currentCombo,
      multiplier: comboComponent.currentMultiplier,
      timeRemaining: comboComponent.comboTimeRemaining,
      progress: ComboManager.getComboProgress(comboComponent),
      activeType: comboComponent.activeComboType,
      isActive: comboComponent.isComboActive,
      justBrokeCombo: comboComponent.justBrokeCombo,
      timestamp: performance.now()
    };
    
    // Emit to UI system
    this.world!.emit('combo_updated', event);
    
    // Reset just broke flag
    comboComponent.justBrokeCombo = false;
  }
  
  /**
   * Check for combo milestones
   */
  private checkComboMilestones(entityId: EntityId, comboComponent: ComboComponent): void {
    const currentCombo = comboComponent.currentCombo;
    
    // Define milestone thresholds
    const milestones = [5, 10, 15, 20, 25, 30, 50, 100];
    
    for (const milestone of milestones) {
      if (currentCombo === milestone) {
        this.world!.emit('combo_milestone', {
          entityId,
          milestone,
          multiplier: comboComponent.currentMultiplier,
          comboType: comboComponent.activeComboType,
          timestamp: performance.now()
        });
        
        console.debug(`Combo milestone reached: ${milestone}x`);
        break; // Only emit one milestone per frame
      }
    }
  }
  
  /**
   * Handle combo sounds
   */
  private handleComboSounds(entityId: EntityId, comboComponent: ComboComponent): void {
    // Don't play sounds too frequently
    const currentTime = performance.now();
    if (currentTime - comboComponent.lastComboSoundTime < comboComponent.comboSoundCooldown) {
      return;
    }
    
    // Play combo level sounds
    if (comboComponent.isComboActive && comboComponent.comboLevelChanged) {
      this.playComboSound(comboComponent.currentCombo, comboComponent.activeComboType);
      comboComponent.lastComboSoundTime = currentTime;
    }
  }
  
  /**
   * Play combo sound effect
   */
  private playComboSound(comboLevel: number, comboType: string | null): void {
    if (!this.canPlaySound('combo')) return;
    
    let soundId = 'combo_hit';
    let pitch = 1.0;
    
    // Different sounds for different combo levels
    if (comboLevel >= 50) {
      soundId = 'combo_epic';
      pitch = 1.3;
    } else if (comboLevel >= 25) {
      soundId = 'combo_legendary';
      pitch = 1.2;
    } else if (comboLevel >= 10) {
      soundId = 'combo_high';
      pitch = 1.1;
    } else if (comboLevel >= 5) {
      soundId = 'combo_medium';
      pitch = 1.05;
    }
    
    // Adjust pitch based on combo level
    pitch += Math.min(comboLevel * 0.01, 0.5); // Max 0.5 pitch increase
    
    // Emit sound event
    this.world!.emit('play_sound', {
      soundId,
      pitch,
      volume: Math.min(0.3 + comboLevel * 0.01, 1.0),
      category: 'combo'
    });
    
    this.setSoundCooldown('combo', 50); // 50ms cooldown
  }
  
  /**
   * Play combo break sound
   */
  private playComboBreakSound(reason: string, comboLevel: number): void {
    if (!this.canPlaySound('combo_break')) return;
    
    let soundId = 'combo_break';
    let volume = 0.4;
    
    if (reason === 'timeout') {
      soundId = 'combo_timeout';
      volume = 0.3;
    } else if (reason === 'damage') {
      soundId = 'combo_damage';
      volume = 0.5;
    }
    
    // Louder break for longer combos
    volume = Math.min(volume + comboLevel * 0.01, 1.0);
    
    this.world!.emit('play_sound', {
      soundId,
      volume,
      category: 'combo'
    });
    
    this.setSoundCooldown('combo_break', 200); // 200ms cooldown
  }
  
  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    if (!this.world) return;
    
    // Listen for coin collection
    this.world.on('coin_collected', (data) => {
      this.registerComboAction(data.entityId, 'coin_collect', data.position);
    });
    
    // Listen for movement actions
    this.world.on('player_jumped', (data) => {
      this.registerComboAction(data.entityId, 'jump', data.position);
    });
    
    this.world.on('player_slid', (data) => {
      this.registerComboAction(data.entityId, 'slide', data.position);
    });
    
    this.world.on('player_wall_ran', (data) => {
      this.registerComboAction(data.entityId, 'wall_run', data.position);
    });
    
    // Listen for powerup collection
    this.world.on('powerup_collected', (data) => {
      this.registerComboAction(data.entityId, 'powerup_collect', data.position);
    });
    
    // Listen for damage (breaks combos)
    this.world.on('player_damaged', (data) => {
      this.breakCombo(data.entityId, 'damage');
    });
  }
  
  /**
   * Update sound cooldowns
   */
  private updateSoundCooldowns(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;
    
    for (const [soundType, cooldown] of this.soundCooldowns) {
      if (cooldown > 0) {
        this.soundCooldowns.set(soundType, cooldown - deltaMs);
      }
    }
  }
  
  /**
   * Check if a sound can be played
   */
  private canPlaySound(soundType: string): boolean {
    const cooldown = this.soundCooldowns.get(soundType) || 0;
    return cooldown <= 0;
  }
  
  /**
   * Set sound cooldown
   */
  private setSoundCooldown(soundType: string, cooldownMs: number): void {
    this.soundCooldowns.set(soundType, cooldownMs);
  }
  
  /**
   * Get combo statistics for all entities
   */
  getComboStatistics() {
    if (!this.world) return null;
    
    const comboEntities = this.world.getEntitiesWithComponents(['combo']);
    const stats = {
      totalEntities: comboEntities.length,
      activeCombos: 0,
      highestCombo: 0,
      totalCombos: 0,
      comboBreaks: 0,
      averageComboLength: 0
    };
    
    let totalComboSum = 0;
    
    for (const entity of comboEntities) {
      const comboComponent = this.world.getComponent(entity.id, 'combo') as ComboComponent;
      if (!comboComponent) continue;
      
      if (comboComponent.isComboActive) {
        stats.activeCombos++;
      }
      
      stats.highestCombo = Math.max(stats.highestCombo, comboComponent.sessionMaxCombo);
      stats.totalCombos += comboComponent.totalCombos;
      stats.comboBreaks += comboComponent.comboBreaks;
      totalComboSum += comboComponent.longestComboStreak;
    }
    
    if (comboEntities.length > 0) {
      stats.averageComboLength = totalComboSum / comboEntities.length;
    }
    
    return stats;
  }
  
  /**
   * Get detailed combo info for a specific entity
   */
  getEntityComboInfo(entityId: EntityId) {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    if (!comboComponent) return null;
    
    return ComboManager.getStatistics(comboComponent);
  }
  
  /**
   * Reset combo statistics for an entity
   */
  resetEntityComboStats(entityId: EntityId): void {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    if (!comboComponent) return;
    
    ComboManager.resetStatistics(comboComponent);
    
    console.debug('Combo statistics reset for entity', entityId);
  }
  
  /**
   * Get active combo animations for rendering
   */
  getActiveComboAnimations(entityId: EntityId) {
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    if (!comboComponent) return [];
    
    return ComboManager.getActiveAnimations(comboComponent);
  }
}
