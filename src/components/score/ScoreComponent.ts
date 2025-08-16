import type { Component, EntityId } from '@/types';

/**
 * ScoreComponent - Manages scoring mechanics for entities
 */
export interface ScoreComponent extends Component {
  type: 'score';
  
  // Current score state
  currentScore: number;
  sessionScore: number; // Score for current session
  lastFrameScore: number; // For calculating deltas
  
  // Scoring configuration
  baseCoinValue: number; // Default: 10 points per coin
  baseDistanceValue: number; // Points per distance unit
  
  // Multipliers
  scoreMultiplier: number; // Global score multiplier
  coinMultiplier: number; // Specific to coin collection
  distanceMultiplier: number; // Specific to distance traveled
  
  // Powerup effects
  doublerActive: boolean;
  doublerTimeRemaining: number;
  doublerMultiplier: number; // 2x by default
  
  // Performance tracking
  totalCoinsCollected: number;
  totalDistanceTraveled: number;
  sessionsPlayed: number;
  
  // Events and feedback
  pendingScoreEvents: ScoreEvent[];
  lastScoreGain: number;
  lastScoreGainTime: number;
  
  // Animation state
  scoreDisplayDirty: boolean;
  animationQueue: ScoreAnimation[];
}

export interface ScoreEvent {
  type: 'coin' | 'distance' | 'bonus' | 'combo' | 'achievement';
  points: number;
  position?: { x: number; y: number; z: number };
  timestamp: number;
  processed: boolean;
}

export interface ScoreAnimation {
  id: string;
  type: 'popup' | 'counter' | 'multiplier';
  startValue: number;
  endValue: number;
  duration: number;
  startTime: number;
  position?: { x: number; y: number };
  color?: string;
  text?: string;
}

/**
 * Create a new ScoreComponent with faithful recreation of original mechanics
 */
export function createScoreComponent(
  options: Partial<{
    baseCoinValue: number;
    baseDistanceValue: number;
    initialScore: number;
  }> = {}
): ScoreComponent {
  return {
    type: 'score',
    entityId: 0,
    
    // Score state
    currentScore: options.initialScore ?? 0,
    sessionScore: 0,
    lastFrameScore: 0,
    
    // Original game mechanics
    baseCoinValue: options.baseCoinValue ?? 10, // Faithful to original
    baseDistanceValue: options.baseDistanceValue ?? 1,
    
    // Multipliers (default to 1x)
    scoreMultiplier: 1,
    coinMultiplier: 1,
    distanceMultiplier: 1,
    
    // Doubler powerup (faithful to original)
    doublerActive: false,
    doublerTimeRemaining: 0,
    doublerMultiplier: 2, // 2x multiplier from original
    
    // Statistics
    totalCoinsCollected: 0,
    totalDistanceTraveled: 0,
    sessionsPlayed: 0,
    
    // Events
    pendingScoreEvents: [],
    lastScoreGain: 0,
    lastScoreGainTime: 0,
    
    // UI state
    scoreDisplayDirty: true,
    animationQueue: []
  };
}

/**
 * Helper functions for score calculations
 */
export class ScoreCalculator {
  /**
   * Calculate coin score with all applicable modifiers
   */
  static calculateCoinScore(
    scoreComponent: ScoreComponent,
    comboMultiplier: number = 1
  ): number {
    let points = scoreComponent.baseCoinValue;
    
    // Apply coin-specific multiplier
    points *= scoreComponent.coinMultiplier;
    
    // Apply doubler powerup (faithful to original)
    if (scoreComponent.doublerActive) {
      points *= scoreComponent.doublerMultiplier;
    }
    
    // Apply global score multiplier
    points *= scoreComponent.scoreMultiplier;
    
    // Apply combo multiplier
    points *= comboMultiplier;
    
    return Math.floor(points);
  }
  
  /**
   * Calculate distance score
   */
  static calculateDistanceScore(
    scoreComponent: ScoreComponent,
    distance: number
  ): number {
    let points = distance * scoreComponent.baseDistanceValue;
    
    // Apply distance multiplier
    points *= scoreComponent.distanceMultiplier;
    
    // Apply global multiplier
    points *= scoreComponent.scoreMultiplier;
    
    return Math.floor(points);
  }
  
  /**
   * Apply score with proper event tracking
   */
  static applyScore(
    scoreComponent: ScoreComponent,
    points: number,
    eventType: ScoreEvent['type'],
    position?: { x: number; y: number; z: number }
  ): void {
    // Update scores
    scoreComponent.currentScore += points;
    scoreComponent.sessionScore += points;
    scoreComponent.lastScoreGain = points;
    scoreComponent.lastScoreGainTime = performance.now();
    
    // Create score event
    const event: ScoreEvent = {
      type: eventType,
      points,
      position,
      timestamp: performance.now(),
      processed: false
    };
    
    scoreComponent.pendingScoreEvents.push(event);
    scoreComponent.scoreDisplayDirty = true;
    
    // Create animation for visual feedback
    if (points > 0) {
      const animation: ScoreAnimation = {
        id: `score_${Date.now()}_${Math.random()}`,
        type: 'popup',
        startValue: 0,
        endValue: points,
        duration: 800, // 0.8 seconds
        startTime: performance.now(),
        position: position ? { x: position.x, y: position.y } : undefined,
        color: eventType === 'coin' ? '#FFD700' : '#FFFFFF',
        text: `+${points}`
      };
      
      scoreComponent.animationQueue.push(animation);
    }
  }
}

/**
 * Score event utilities
 */
export class ScoreEventUtils {
  /**
   * Process pending score events
   */
  static processPendingEvents(scoreComponent: ScoreComponent): ScoreEvent[] {
    const processedEvents = scoreComponent.pendingScoreEvents.filter(e => !e.processed);
    
    // Mark all events as processed
    scoreComponent.pendingScoreEvents.forEach(event => {
      event.processed = true;
    });
    
    // Clean up old events (keep last 100)
    if (scoreComponent.pendingScoreEvents.length > 100) {
      scoreComponent.pendingScoreEvents = scoreComponent.pendingScoreEvents.slice(-100);
    }
    
    return processedEvents;
  }
  
  /**
   * Update score animations
   */
  static updateAnimations(scoreComponent: ScoreComponent, deltaTime: number): void {
    const currentTime = performance.now();
    
    // Update existing animations
    scoreComponent.animationQueue = scoreComponent.animationQueue.filter(animation => {
      const elapsed = currentTime - animation.startTime;
      return elapsed < animation.duration;
    });
  }
  
  /**
   * Get active animations for rendering
   */
  static getActiveAnimations(scoreComponent: ScoreComponent): ScoreAnimation[] {
    const currentTime = performance.now();
    
    return scoreComponent.animationQueue.filter(animation => {
      const elapsed = currentTime - animation.startTime;
      return elapsed < animation.duration;
    });
  }
}
