import type { Component, EntityId } from '@/types';

/**
 * ComboComponent - Manages combo chains and bonus multipliers
 */
export interface ComboComponent extends Component {
  type: 'combo';
  
  // Current combo state
  currentCombo: number;
  maxCombo: number;
  sessionMaxCombo: number;
  allTimeMaxCombo: number;
  
  // Combo timing
  comboTimeRemaining: number;
  comboTimeout: number; // Time before combo resets
  comboExtension: number; // Time added per successful action
  
  // Combo multipliers
  baseMultiplier: number; // 1.0 for no bonus
  currentMultiplier: number;
  maxMultiplier: number; // Cap for combo multiplier
  multiplierIncrement: number; // How much multiplier increases per combo
  
  // Combo types and requirements
  comboTypes: Map<string, ComboType>;
  activeComboType: string | null;
  
  // Combo history
  comboHistory: ComboEvent[];
  
  // Visual feedback
  comboDisplayTime: number;
  comboAnimations: ComboAnimation[];
  
  // Sound effects
  lastComboSoundTime: number;
  comboSoundCooldown: number;
  
  // Performance tracking
  totalCombos: number;
  longestComboStreak: number;
  comboBreaks: number;
  
  // State flags
  isComboActive: boolean;
  justBrokeCombo: boolean;
  comboLevelChanged: boolean;
}

export interface ComboType {
  id: string;
  name: string;
  description: string;
  
  // Requirements for this combo type
  requiredActions: string[]; // e.g., ['coin_collect', 'jump', 'slide']
  minActions: number; // Minimum actions for combo to start
  
  // Timing
  timeout: number; // How long between actions
  extension: number; // Time added per action
  
  // Multiplier configuration
  baseMultiplier: number;
  increment: number;
  maxMultiplier: number;
  
  // Rewards
  bonusPoints: number; // Points awarded per combo level
  
  // Visual/Audio
  color: string;
  soundEffect?: string;
}

export interface ComboEvent {
  id: string;
  type: 'start' | 'continue' | 'break' | 'timeout';
  comboLevel: number;
  multiplier: number;
  timestamp: number;
  position?: { x: number; y: number; z: number };
  actionType?: string; // What action triggered this event
}

export interface ComboAnimation {
  id: string;
  type: 'combo_text' | 'multiplier' | 'streak' | 'break';
  startTime: number;
  duration: number;
  text: string;
  position?: { x: number; y: number };
  color: string;
  scale: number;
  alpha: number;
}

/**
 * Create a new ComboComponent
 */
export function createComboComponent(
  options: Partial<{
    comboTimeout: number;
    maxMultiplier: number;
    multiplierIncrement: number;
  }> = {}
): ComboComponent {
  const component: ComboComponent = {
    type: 'combo',
    entityId: 0,
    
    // Combo state
    currentCombo: 0,
    maxCombo: 0,
    sessionMaxCombo: 0,
    allTimeMaxCombo: 0,
    
    // Timing
    comboTimeRemaining: 0,
    comboTimeout: options.comboTimeout ?? 3000, // 3 seconds default
    comboExtension: 1500, // 1.5 seconds added per action
    
    // Multipliers
    baseMultiplier: 1.0,
    currentMultiplier: 1.0,
    maxMultiplier: options.maxMultiplier ?? 10.0, // Cap at 10x
    multiplierIncrement: options.multiplierIncrement ?? 0.1, // +0.1x per combo
    
    // Combo types
    comboTypes: new Map(),
    activeComboType: null,
    
    // History
    comboHistory: [],
    
    // Visual
    comboDisplayTime: 2000, // 2 seconds
    comboAnimations: [],
    
    // Audio
    lastComboSoundTime: 0,
    comboSoundCooldown: 100, // 100ms between combo sounds
    
    // Statistics
    totalCombos: 0,
    longestComboStreak: 0,
    comboBreaks: 0,
    
    // State
    isComboActive: false,
    justBrokeCombo: false,
    comboLevelChanged: false
  };
  
  // Initialize default combo types
  initializeDefaultComboTypes(component);
  
  return component;
}

/**
 * Initialize default combo types
 */
function initializeDefaultComboTypes(component: ComboComponent): void {
  const comboTypes: ComboType[] = [
    {
      id: 'coin_combo',
      name: 'Coin Collector',
      description: 'Collect coins rapidly',
      requiredActions: ['coin_collect'],
      minActions: 3,
      timeout: 3000,
      extension: 1500,
      baseMultiplier: 1.1,
      increment: 0.1,
      maxMultiplier: 5.0,
      bonusPoints: 5,
      color: '#FFD700' // Gold
    },
    {
      id: 'movement_combo',
      name: 'Parkour Master',
      description: 'Chain jumps, slides, and movements',
      requiredActions: ['jump', 'slide', 'wall_run'],
      minActions: 2,
      timeout: 4000,
      extension: 2000,
      baseMultiplier: 1.2,
      increment: 0.15,
      maxMultiplier: 8.0,
      bonusPoints: 10,
      color: '#00FF00' // Green
    },
    {
      id: 'mixed_combo',
      name: 'Style Points',
      description: 'Mix coins and movement for maximum points',
      requiredActions: ['coin_collect', 'jump', 'slide'],
      minActions: 4,
      timeout: 2500,
      extension: 1000,
      baseMultiplier: 1.5,
      increment: 0.2,
      maxMultiplier: 10.0,
      bonusPoints: 20,
      color: '#FF6600' // Orange
    },
    {
      id: 'perfect_combo',
      name: 'Perfect Execution',
      description: 'Flawless sequence without breaks',
      requiredActions: ['coin_collect', 'jump', 'slide', 'wall_run'],
      minActions: 5,
      timeout: 2000,
      extension: 800,
      baseMultiplier: 2.0,
      increment: 0.25,
      maxMultiplier: 15.0,
      bonusPoints: 50,
      color: '#FF0080' // Pink
    }
  ];
  
  comboTypes.forEach(comboType => {
    component.comboTypes.set(comboType.id, comboType);
  });
}

/**
 * Combo system utilities
 */
export class ComboManager {
  /**
   * Register a combo action (coin collect, jump, etc.)
   */
  static registerAction(
    component: ComboComponent,
    actionType: string,
    position?: { x: number; y: number; z: number }
  ): {
    comboLevel: number;
    multiplier: number;
    bonusPoints: number;
    comboType: string | null;
  } {
    const currentTime = performance.now();
    
    // Find matching combo types for this action
    const matchingComboTypes = Array.from(component.comboTypes.values())
      .filter(comboType => comboType.requiredActions.includes(actionType));
    
    if (matchingComboTypes.length === 0) {
      // No combo type matches this action
      return {
        comboLevel: 0,
        multiplier: 1,
        bonusPoints: 0,
        comboType: null
      };
    }
    
    // Check if we're extending an existing combo or starting a new one
    const wasComboActive = component.isComboActive;
    
    if (component.isComboActive && component.comboTimeRemaining > 0) {
      // Extend existing combo
      component.currentCombo++;
      
      // Find the best matching active combo type
      let activeComboType = component.activeComboType ? 
        component.comboTypes.get(component.activeComboType) : null;
      
      if (!activeComboType || !activeComboType.requiredActions.includes(actionType)) {
        // Switch to a better combo type
        activeComboType = matchingComboTypes[0]; // Use first matching type
        component.activeComboType = activeComboType.id;
      }
      
      // Reset timer with extension
      component.comboTimeRemaining = activeComboType.timeout + activeComboType.extension;
      
    } else {
      // Start new combo
      component.currentCombo = 1;
      component.isComboActive = true;
      component.justBrokeCombo = false;
      
      // Select best combo type
      const bestComboType = matchingComboTypes.reduce((best, current) => 
        current.maxMultiplier > best.maxMultiplier ? current : best
      );
      
      component.activeComboType = bestComboType.id;
      component.comboTimeRemaining = bestComboType.timeout;
    }
    
    const activeComboType = component.comboTypes.get(component.activeComboType!)!;
    
    // Calculate multiplier
    const newMultiplier = Math.min(
      activeComboType.baseMultiplier + (component.currentCombo - 1) * activeComboType.increment,
      activeComboType.maxMultiplier
    );
    
    component.currentMultiplier = newMultiplier;
    
    // Calculate bonus points
    const bonusPoints = component.currentCombo >= activeComboType.minActions ? 
      activeComboType.bonusPoints * component.currentCombo : 0;
    
    // Update statistics
    component.totalCombos = Math.max(component.totalCombos, component.currentCombo);
    component.sessionMaxCombo = Math.max(component.sessionMaxCombo, component.currentCombo);
    component.maxCombo = Math.max(component.maxCombo, component.currentCombo);
    
    // Create combo event
    const comboEvent: ComboEvent = {
      id: `combo_${currentTime}_${Math.random()}`,
      type: wasComboActive ? 'continue' : 'start',
      comboLevel: component.currentCombo,
      multiplier: newMultiplier,
      timestamp: currentTime,
      position,
      actionType
    };
    
    component.comboHistory.push(comboEvent);
    
    // Create visual animation
    this.createComboAnimation(component, comboEvent, activeComboType);
    
    // Mark combo level as changed for UI updates
    component.comboLevelChanged = true;
    
    // Trim history (keep last 50 events)
    if (component.comboHistory.length > 50) {
      component.comboHistory = component.comboHistory.slice(-50);
    }
    
    return {
      comboLevel: component.currentCombo,
      multiplier: newMultiplier,
      bonusPoints,
      comboType: activeComboType.id
    };
  }
  
  /**
   * Update combo timer and check for timeouts
   */
  static updateCombo(component: ComboComponent, deltaTime: number): boolean {
    if (!component.isComboActive) {
      return false;
    }
    
    // Update timer
    component.comboTimeRemaining -= deltaTime * 1000; // Convert to milliseconds
    
    // Check for timeout
    if (component.comboTimeRemaining <= 0) {
      this.breakCombo(component, 'timeout');
      return true; // Combo was broken
    }
    
    // Update animations
    this.updateAnimations(component, deltaTime);
    
    return false;
  }
  
  /**
   * Break the current combo
   */
  static breakCombo(
    component: ComboComponent,
    reason: 'timeout' | 'damage' | 'manual' = 'manual'
  ): void {
    if (!component.isComboActive) {
      return;
    }
    
    // Record longest streak
    component.longestComboStreak = Math.max(
      component.longestComboStreak,
      component.currentCombo
    );
    
    // Create break event
    const breakEvent: ComboEvent = {
      id: `break_${performance.now()}_${Math.random()}`,
      type: reason === 'timeout' ? 'timeout' : 'break',
      comboLevel: component.currentCombo,
      multiplier: component.currentMultiplier,
      timestamp: performance.now()
    };
    
    component.comboHistory.push(breakEvent);
    
    // Create break animation
    this.createBreakAnimation(component, reason);
    
    // Reset combo state
    component.currentCombo = 0;
    component.currentMultiplier = component.baseMultiplier;
    component.comboTimeRemaining = 0;
    component.isComboActive = false;
    component.justBrokeCombo = true;
    component.activeComboType = null;
    component.comboLevelChanged = true;
    
    // Update statistics
    component.comboBreaks++;
    
    console.debug(`Combo broken (${reason}). Final combo: ${breakEvent.comboLevel}`);
  }
  
  /**
   * Get current combo multiplier
   */
  static getCurrentMultiplier(component: ComboComponent): number {
    return component.isComboActive ? component.currentMultiplier : component.baseMultiplier;
  }
  
  /**
   * Get combo progress (0-1) for UI display
   */
  static getComboProgress(component: ComboComponent): number {
    if (!component.isComboActive || !component.activeComboType) {
      return 0;
    }
    
    const comboType = component.comboTypes.get(component.activeComboType);
    if (!comboType) {
      return 0;
    }
    
    return Math.max(0, component.comboTimeRemaining / comboType.timeout);
  }
  
  /**
   * Create combo animation
   */
  private static createComboAnimation(
    component: ComboComponent,
    event: ComboEvent,
    comboType: ComboType
  ): void {
    const animation: ComboAnimation = {
      id: `combo_anim_${event.id}`,
      type: event.type === 'start' ? 'combo_text' : 'multiplier',
      startTime: performance.now(),
      duration: 1500, // 1.5 seconds
      text: event.type === 'start' ? 
        `${comboType.name} Combo!` : 
        `${event.comboLevel}x Combo!`,
      position: event.position ? 
        { x: event.position.x, y: event.position.y } : 
        undefined,
      color: comboType.color,
      scale: event.type === 'start' ? 1.2 : 1.0,
      alpha: 1.0
    };
    
    component.comboAnimations.push(animation);
  }
  
  /**
   * Create break animation
   */
  private static createBreakAnimation(
    component: ComboComponent,
    reason: string
  ): void {
    const animation: ComboAnimation = {
      id: `break_anim_${performance.now()}`,
      type: 'break',
      startTime: performance.now(),
      duration: 1000, // 1 second
      text: reason === 'timeout' ? 'Combo Timeout' : 'Combo Broken',
      color: '#FF4444', // Red
      scale: 0.8,
      alpha: 1.0
    };
    
    component.comboAnimations.push(animation);
  }
  
  /**
   * Update combo animations
   */
  private static updateAnimations(component: ComboComponent, deltaTime: number): void {
    const currentTime = performance.now();
    
    // Remove expired animations
    component.comboAnimations = component.comboAnimations.filter(animation => {
      const elapsed = currentTime - animation.startTime;
      return elapsed < animation.duration;
    });
    
    // Update animation properties (alpha, scale, etc.)
    component.comboAnimations.forEach(animation => {
      const elapsed = currentTime - animation.startTime;
      const progress = elapsed / animation.duration;
      
      // Fade out over time
      animation.alpha = Math.max(0, 1.0 - progress);
      
      // Scale animation for combo text
      if (animation.type === 'combo_text') {
        animation.scale = 1.2 + Math.sin(progress * Math.PI * 2) * 0.1;
      }
    });
  }
  
  /**
   * Get active animations for rendering
   */
  static getActiveAnimations(component: ComboComponent): ComboAnimation[] {
    return component.comboAnimations.filter(animation => animation.alpha > 0);
  }
  
  /**
   * Reset combo statistics
   */
  static resetStatistics(component: ComboComponent): void {
    component.sessionMaxCombo = 0;
    component.totalCombos = 0;
    component.longestComboStreak = 0;
    component.comboBreaks = 0;
    component.comboHistory = [];
  }
  
  /**
   * Get combo statistics for display
   */
  static getStatistics(component: ComboComponent) {
    return {
      currentCombo: component.currentCombo,
      sessionMax: component.sessionMaxCombo,
      allTimeMax: component.allTimeMaxCombo,
      totalCombos: component.totalCombos,
      longestStreak: component.longestComboStreak,
      comboBreaks: component.comboBreaks,
      currentMultiplier: component.currentMultiplier,
      isActive: component.isComboActive,
      timeRemaining: component.comboTimeRemaining,
      activeType: component.activeComboType
    };
  }
}
