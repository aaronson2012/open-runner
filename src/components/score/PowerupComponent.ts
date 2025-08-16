import type { Component, EntityId } from '@/types';

/**
 * PowerupComponent - Manages powerup effects and coin doublers
 */
export interface PowerupComponent extends Component {
  type: 'powerup';
  
  // Active powerups
  activePowerups: Map<string, ActivePowerup>;
  
  // Doubler powerup (faithful to original)
  doublerActive: boolean;
  doublerTimeRemaining: number;
  doublerMultiplier: number; // 2x in original
  doublerDuration: number;
  
  // Powerup effects
  scoreMultiplier: number; // Combined multiplier from all powerups
  speedBoost: number; // Movement speed modifier
  jumpBoost: number; // Jump height modifier
  magnetRange: number; // Coin magnet range
  invulnerabilityTime: number; // Time remaining for invincibility
  
  // Powerup history
  powerupHistory: PowerupEvent[];
  
  // Collection statistics
  totalPowerupsCollected: number;
  doublersCollected: number;
  
  // Visual effects
  powerupAnimations: PowerupAnimation[];
  
  // State flags
  powerupStateChanged: boolean;
  hasActivePowerups: boolean;
}

export interface PowerupType {
  id: string;
  name: string;
  description: string;
  icon: string;
  
  // Duration and effects
  duration: number; // milliseconds
  stackable: boolean;
  maxStacks: number;
  
  // Effects
  scoreMultiplier?: number;
  speedMultiplier?: number;
  jumpMultiplier?: number;
  magnetRange?: number;
  invulnerability?: boolean;
  
  // Visual
  color: string;
  glowColor?: string;
  particleEffect?: string;
  
  // Audio
  collectSound?: string;
  activeSound?: string;
  expireSound?: string;
  
  // Rarity
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  spawnChance: number; // 0-1 probability
}

export interface ActivePowerup {
  type: PowerupType;
  startTime: number;
  duration: number;
  timeRemaining: number;
  stacks: number;
  
  // Effect values (calculated based on stacks)
  effectiveScoreMultiplier: number;
  effectiveSpeedMultiplier: number;
  effectiveJumpMultiplier: number;
  
  // State
  isExpiring: boolean; // True when less than 3 seconds remaining
  justActivated: boolean;
}

export interface PowerupEvent {
  id: string;
  type: 'collected' | 'activated' | 'expired' | 'stacked';
  powerupId: string;
  timestamp: number;
  position?: { x: number; y: number; z: number };
  stacks?: number;
}

export interface PowerupAnimation {
  id: string;
  type: 'collect' | 'activate' | 'expire' | 'warning';
  powerupId: string;
  startTime: number;
  duration: number;
  position?: { x: number; y: number };
  color: string;
  text?: string;
  scale: number;
  alpha: number;
}

/**
 * Create a new PowerupComponent
 */
export function createPowerupComponent(
  options: Partial<{
    doublerDuration: number;
    doublerMultiplier: number;
  }> = {}
): PowerupComponent {
  return {
    type: 'powerup',
    entityId: 0,
    
    // Active powerups
    activePowerups: new Map(),
    
    // Doubler (faithful to original)
    doublerActive: false,
    doublerTimeRemaining: 0,
    doublerMultiplier: options.doublerMultiplier ?? 2, // 2x multiplier
    doublerDuration: options.doublerDuration ?? 15000, // 15 seconds
    
    // Effects
    scoreMultiplier: 1,
    speedBoost: 1,
    jumpBoost: 1,
    magnetRange: 0,
    invulnerabilityTime: 0,
    
    // History
    powerupHistory: [],
    
    // Statistics
    totalPowerupsCollected: 0,
    doublersCollected: 0,
    
    // Visual
    powerupAnimations: [],
    
    // State
    powerupStateChanged: false,
    hasActivePowerups: false
  };
}

/**
 * Default powerup types (faithful to original + modern additions)
 */
export const DefaultPowerupTypes: Record<string, PowerupType> = {
  doubler: {
    id: 'doubler',
    name: 'Coin Doubler',
    description: 'Double coin value for 15 seconds',
    icon: '💰',
    duration: 15000, // 15 seconds (faithful to original)
    stackable: false,
    maxStacks: 1,
    scoreMultiplier: 2, // 2x multiplier (faithful to original)
    color: '#FFD700',
    glowColor: '#FFF700',
    rarity: 'common',
    spawnChance: 0.1, // 10% chance
    collectSound: 'powerup_collect',
    activeSound: 'doubler_active'
  },
  
  speed_boost: {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: 'Increased movement speed for 10 seconds',
    icon: '⚡',
    duration: 10000,
    stackable: true,
    maxStacks: 3,
    speedMultiplier: 1.5,
    color: '#00FFFF',
    glowColor: '#FFFFFF',
    rarity: 'common',
    spawnChance: 0.08,
    collectSound: 'powerup_collect',
    activeSound: 'speed_active'
  },
  
  jump_boost: {
    id: 'jump_boost',
    name: 'Super Jump',
    description: 'Higher jumps for 12 seconds',
    icon: '🚀',
    duration: 12000,
    stackable: true,
    maxStacks: 2,
    jumpMultiplier: 1.8,
    color: '#FF6600',
    glowColor: '#FFAA00',
    rarity: 'common',
    spawnChance: 0.07,
    collectSound: 'powerup_collect'
  },
  
  coin_magnet: {
    id: 'coin_magnet',
    name: 'Coin Magnet',
    description: 'Attracts nearby coins automatically',
    icon: '🧲',
    duration: 20000,
    stackable: true,
    maxStacks: 2,
    magnetRange: 50, // Units
    color: '#FF00FF',
    glowColor: '#FF88FF',
    rarity: 'rare',
    spawnChance: 0.05,
    collectSound: 'powerup_collect',
    activeSound: 'magnet_active'
  },
  
  invincibility: {
    id: 'invincibility',
    name: 'Invincibility',
    description: 'Immune to damage for 8 seconds',
    icon: '🛡️',
    duration: 8000,
    stackable: false,
    maxStacks: 1,
    invulnerability: true,
    color: '#FFFF00',
    glowColor: '#FFFFFF',
    rarity: 'epic',
    spawnChance: 0.03,
    collectSound: 'powerup_collect',
    activeSound: 'invincibility_active',
    expireSound: 'invincibility_expire'
  },
  
  mega_multiplier: {
    id: 'mega_multiplier',
    name: 'Mega Multiplier',
    description: '5x score multiplier for 6 seconds',
    icon: '✨',
    duration: 6000,
    stackable: false,
    maxStacks: 1,
    scoreMultiplier: 5,
    color: '#FF0080',
    glowColor: '#FF80C0',
    rarity: 'legendary',
    spawnChance: 0.01,
    collectSound: 'powerup_collect',
    activeSound: 'mega_active',
    expireSound: 'mega_expire'
  }
};

/**
 * Powerup management utilities
 */
export class PowerupManager {
  /**
   * Activate a powerup (faithful to original doubler mechanics)
   */
  static activatePowerup(
    component: PowerupComponent,
    powerupTypeId: string,
    position?: { x: number; y: number; z: number }
  ): boolean {
    const powerupType = DefaultPowerupTypes[powerupTypeId];
    if (!powerupType) {
      console.warn(`Unknown powerup type: ${powerupTypeId}`);
      return false;
    }
    
    const currentTime = performance.now();
    
    // Handle doubler powerup (faithful to original)
    if (powerupTypeId === 'doubler') {
      component.doublerActive = true;
      component.doublerTimeRemaining = component.doublerDuration;
      component.doublersCollected++;
      
      console.debug('Doubler powerup activated for 15 seconds');
    }
    
    // Check if powerup is already active
    const existingPowerup = component.activePowerups.get(powerupTypeId);
    
    if (existingPowerup) {
      if (powerupType.stackable && existingPowerup.stacks < powerupType.maxStacks) {
        // Stack the powerup
        existingPowerup.stacks++;
        existingPowerup.timeRemaining = Math.max(
          existingPowerup.timeRemaining,
          powerupType.duration
        );
        
        // Recalculate effective values
        this.calculateEffectiveValues(existingPowerup);
        
        // Create stack event
        const stackEvent: PowerupEvent = {
          id: `stack_${currentTime}_${Math.random()}`,
          type: 'stacked',
          powerupId: powerupTypeId,
          timestamp: currentTime,
          position,
          stacks: existingPowerup.stacks
        };
        
        component.powerupHistory.push(stackEvent);
        
        console.debug(`Powerup ${powerupTypeId} stacked to ${existingPowerup.stacks}`);
        
      } else {
        // Refresh duration for non-stackable or max stacked powerups
        existingPowerup.timeRemaining = powerupType.duration;
        existingPowerup.isExpiring = false;
        
        console.debug(`Powerup ${powerupTypeId} duration refreshed`);
      }
    } else {
      // Create new active powerup
      const activePowerup: ActivePowerup = {
        type: powerupType,
        startTime: currentTime,
        duration: powerupType.duration,
        timeRemaining: powerupType.duration,
        stacks: 1,
        effectiveScoreMultiplier: 1,
        effectiveSpeedMultiplier: 1,
        effectiveJumpMultiplier: 1,
        isExpiring: false,
        justActivated: true
      };
      
      // Calculate initial effective values
      this.calculateEffectiveValues(activePowerup);
      
      component.activePowerups.set(powerupTypeId, activePowerup);
      
      // Create activation event
      const activationEvent: PowerupEvent = {
        id: `activate_${currentTime}_${Math.random()}`,
        type: 'activated',
        powerupId: powerupTypeId,
        timestamp: currentTime,
        position
      };
      
      component.powerupHistory.push(activationEvent);
      
      console.debug(`Powerup ${powerupTypeId} activated`);
    }
    
    // Update statistics
    component.totalPowerupsCollected++;
    
    // Create collection animation
    this.createPowerupAnimation(component, powerupTypeId, 'collect', position);
    
    // Update combined effects
    this.updateCombinedEffects(component);
    
    component.powerupStateChanged = true;
    component.hasActivePowerups = component.activePowerups.size > 0;
    
    return true;
  }
  
  /**
   * Update all active powerups
   */
  static updatePowerups(component: PowerupComponent, deltaTime: number): void {
    const currentTime = performance.now();
    const deltaMs = deltaTime * 1000; // Convert to milliseconds
    
    // Update doubler (faithful to original)
    if (component.doublerActive) {
      component.doublerTimeRemaining -= deltaMs;
      
      if (component.doublerTimeRemaining <= 0) {
        component.doublerActive = false;
        component.doublerTimeRemaining = 0;
        component.powerupStateChanged = true;
        
        console.debug('Doubler powerup expired');
      }
    }
    
    // Update other powerups
    const expiredPowerups: string[] = [];
    
    for (const [powerupId, activePowerup] of component.activePowerups) {
      // Update time remaining
      activePowerup.timeRemaining -= deltaMs;
      activePowerup.justActivated = false;
      
      // Check for expiring warning (3 seconds remaining)
      if (activePowerup.timeRemaining <= 3000 && !activePowerup.isExpiring) {
        activePowerup.isExpiring = true;
        this.createPowerupAnimation(component, powerupId, 'warning');
      }
      
      // Check for expiration
      if (activePowerup.timeRemaining <= 0) {
        expiredPowerups.push(powerupId);
        
        // Create expiration event
        const expireEvent: PowerupEvent = {
          id: `expire_${currentTime}_${Math.random()}`,
          type: 'expired',
          powerupId,
          timestamp: currentTime
        };
        
        component.powerupHistory.push(expireEvent);
        
        // Create expiration animation
        this.createPowerupAnimation(component, powerupId, 'expire');
        
        console.debug(`Powerup ${powerupId} expired`);
      }
    }
    
    // Remove expired powerups
    expiredPowerups.forEach(powerupId => {
      component.activePowerups.delete(powerupId);
    });
    
    // Update combined effects if anything changed
    if (expiredPowerups.length > 0) {
      this.updateCombinedEffects(component);
      component.powerupStateChanged = true;
    }
    
    // Update animations
    this.updateAnimations(component, deltaTime);
    
    component.hasActivePowerups = component.activePowerups.size > 0 || component.doublerActive;
    
    // Trim history (keep last 100 events)
    if (component.powerupHistory.length > 100) {
      component.powerupHistory = component.powerupHistory.slice(-100);
    }
  }
  
  /**
   * Calculate effective values for a powerup based on stacks
   */
  private static calculateEffectiveValues(activePowerup: ActivePowerup): void {
    const type = activePowerup.type;
    const stacks = activePowerup.stacks;
    
    // Calculate effective multipliers (stacks additively)
    activePowerup.effectiveScoreMultiplier = type.scoreMultiplier ? 
      1 + (type.scoreMultiplier - 1) * stacks : 1;
    
    activePowerup.effectiveSpeedMultiplier = type.speedMultiplier ? 
      1 + (type.speedMultiplier - 1) * stacks : 1;
    
    activePowerup.effectiveJumpMultiplier = type.jumpMultiplier ? 
      1 + (type.jumpMultiplier - 1) * stacks : 1;
  }
  
  /**
   * Update combined effects from all active powerups
   */
  private static updateCombinedEffects(component: PowerupComponent): void {
    // Reset to base values
    component.scoreMultiplier = 1;
    component.speedBoost = 1;
    component.jumpBoost = 1;
    component.magnetRange = 0;
    component.invulnerabilityTime = 0;
    
    // Apply doubler effect (faithful to original)
    if (component.doublerActive) {
      component.scoreMultiplier *= component.doublerMultiplier;
    }
    
    // Combine effects from all active powerups
    for (const activePowerup of component.activePowerups.values()) {
      // Multiply score effects
      component.scoreMultiplier *= activePowerup.effectiveScoreMultiplier;
      
      // Multiply speed effects
      component.speedBoost *= activePowerup.effectiveSpeedMultiplier;
      
      // Multiply jump effects
      component.jumpBoost *= activePowerup.effectiveJumpMultiplier;
      
      // Add magnet range
      if (activePowerup.type.magnetRange) {
        component.magnetRange = Math.max(
          component.magnetRange,
          activePowerup.type.magnetRange * activePowerup.stacks
        );
      }
      
      // Set invulnerability
      if (activePowerup.type.invulnerability) {
        component.invulnerabilityTime = Math.max(
          component.invulnerabilityTime,
          activePowerup.timeRemaining
        );
      }
    }
  }
  
  /**
   * Create powerup animation
   */
  private static createPowerupAnimation(
    component: PowerupComponent,
    powerupId: string,
    type: PowerupAnimation['type'],
    position?: { x: number; y: number; z: number }
  ): void {
    const powerupType = DefaultPowerupTypes[powerupId];
    if (!powerupType) return;
    
    const animation: PowerupAnimation = {
      id: `anim_${performance.now()}_${Math.random()}`,
      type,
      powerupId,
      startTime: performance.now(),
      duration: type === 'warning' ? 3000 : 1500,
      position: position ? { x: position.x, y: position.y } : undefined,
      color: powerupType.color,
      text: type === 'collect' ? powerupType.name : 
            type === 'warning' ? 'Expiring!' : 
            'Expired',
      scale: type === 'collect' ? 1.2 : 1.0,
      alpha: 1.0
    };
    
    component.powerupAnimations.push(animation);
  }
  
  /**
   * Update powerup animations
   */
  private static updateAnimations(component: PowerupComponent, deltaTime: number): void {
    const currentTime = performance.now();
    
    // Remove expired animations
    component.powerupAnimations = component.powerupAnimations.filter(animation => {
      const elapsed = currentTime - animation.startTime;
      return elapsed < animation.duration;
    });
    
    // Update animation properties
    component.powerupAnimations.forEach(animation => {
      const elapsed = currentTime - animation.startTime;
      const progress = elapsed / animation.duration;
      
      // Fade out over time
      animation.alpha = Math.max(0, 1.0 - progress);
      
      // Special effects for different types
      if (animation.type === 'warning') {
        // Blinking effect for warning
        animation.alpha = Math.abs(Math.sin(elapsed * 0.01)) * (1.0 - progress);
      } else if (animation.type === 'collect') {
        // Scale bounce for collection
        animation.scale = 1.2 + Math.sin(progress * Math.PI) * 0.3;
      }
    });
  }
  
  /**
   * Get active powerup animations for rendering
   */
  static getActiveAnimations(component: PowerupComponent): PowerupAnimation[] {
    return component.powerupAnimations.filter(animation => animation.alpha > 0);
  }
  
  /**
   * Check if player is invulnerable
   */
  static isInvulnerable(component: PowerupComponent): boolean {
    return component.invulnerabilityTime > 0;
  }
  
  /**
   * Get powerup statistics for display
   */
  static getStatistics(component: PowerupComponent) {
    return {
      totalCollected: component.totalPowerupsCollected,
      doublersCollected: component.doublersCollected,
      activePowerups: Array.from(component.activePowerups.values()).map(powerup => ({
        id: powerup.type.id,
        name: powerup.type.name,
        timeRemaining: powerup.timeRemaining,
        stacks: powerup.stacks,
        isExpiring: powerup.isExpiring
      })),
      doublerActive: component.doublerActive,
      doublerTimeRemaining: component.doublerTimeRemaining,
      effects: {
        scoreMultiplier: component.scoreMultiplier,
        speedBoost: component.speedBoost,
        jumpBoost: component.jumpBoost,
        magnetRange: component.magnetRange,
        invulnerable: component.invulnerabilityTime > 0
      }
    };
  }
  
  /**
   * Clear all active powerups
   */
  static clearAllPowerups(component: PowerupComponent): void {
    component.activePowerups.clear();
    component.doublerActive = false;
    component.doublerTimeRemaining = 0;
    
    this.updateCombinedEffects(component);
    component.powerupStateChanged = true;
    component.hasActivePowerups = false;
    
    console.debug('All powerups cleared');
  }
}
