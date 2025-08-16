import type { Component, EntityId } from '@/types';

/**
 * ScoreDisplayComponent - UI component for score display with smooth animations
 */
export interface ScoreDisplayComponent extends Component {
  type: 'scoreDisplay';
  
  // Display configuration
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  
  // Score display
  displayedScore: number; // Currently displayed score (for smooth animation)
  targetScore: number; // Target score to animate to
  animationSpeed: number; // Speed of score counting animation
  
  // Visual styling
  fontSize: number;
  fontFamily: string;
  textColor: string;
  shadowColor: string;
  shadowOffset: { x: number; y: number };
  
  // Mobile-optimized settings
  isMobileOptimized: boolean;
  touchFriendly: boolean;
  responsiveScaling: boolean;
  
  // Animation state
  isAnimating: boolean;
  animationStartTime: number;
  animationDuration: number;
  
  // Effect modifiers
  glowEffect: boolean;
  pulseEffect: boolean;
  shakeEffect: boolean;
  shakeIntensity: number;
  shakeDecay: number;
  
  // Multiplier display
  showMultiplier: boolean;
  multiplierValue: number;
  multiplierColor: string;
  multiplierPulse: boolean;
  
  // Combo display integration
  showComboIndicator: boolean;
  comboLevel: number;
  comboTimeRemaining: number;
  comboProgress: number;
  
  // Powerup indicators
  showPowerupIndicators: boolean;
  activePowerups: PowerupIndicator[];
  
  // Performance settings
  updateFrequency: number; // Updates per second
  lastUpdateTime: number;
  
  // Accessibility
  screenReaderText: string;
  highContrastMode: boolean;
  largeTextMode: boolean;
}

export interface PowerupIndicator {
  id: string;
  name: string;
  icon: string;
  timeRemaining: number;
  totalDuration: number;
  color: string;
  position: { x: number; y: number };
  visible: boolean;
}

/**
 * Create a mobile-optimized score display component
 */
export function createScoreDisplayComponent(
  options: Partial<{
    position: { x: number; y: number };
    size: { width: number; height: number };
    fontSize: number;
    isMobileOptimized: boolean;
  }> = {}
): ScoreDisplayComponent {
  return {
    type: 'scoreDisplay',
    entityId: 0,
    
    // Display configuration
    position: options.position ?? { x: 20, y: 20 },
    size: options.size ?? { width: 200, height: 60 },
    visible: true,
    
    // Score display
    displayedScore: 0,
    targetScore: 0,
    animationSpeed: 500, // Points per second animation speed
    
    // Visual styling
    fontSize: options.fontSize ?? 24,
    fontFamily: 'Arial, sans-serif',
    textColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { x: 2, y: 2 },
    
    // Mobile optimization
    isMobileOptimized: options.isMobileOptimized ?? true,
    touchFriendly: true,
    responsiveScaling: true,
    
    // Animation state
    isAnimating: false,
    animationStartTime: 0,
    animationDuration: 1000, // 1 second default
    
    // Effects
    glowEffect: false,
    pulseEffect: false,
    shakeEffect: false,
    shakeIntensity: 0,
    shakeDecay: 0.95,
    
    // Multiplier display
    showMultiplier: true,
    multiplierValue: 1,
    multiplierColor: '#FFD700',
    multiplierPulse: false,
    
    // Combo integration
    showComboIndicator: true,
    comboLevel: 0,
    comboTimeRemaining: 0,
    comboProgress: 0,
    
    // Powerup indicators
    showPowerupIndicators: true,
    activePowerups: [],
    
    // Performance
    updateFrequency: 60, // 60 FPS
    lastUpdateTime: 0,
    
    // Accessibility
    screenReaderText: 'Score: 0',
    highContrastMode: false,
    largeTextMode: false
  };
}

/**
 * Score display utilities for smooth animations and mobile optimization
 */
export class ScoreDisplayManager {
  /**
   * Update score with smooth animation
   */
  static updateScore(
    component: ScoreDisplayComponent,
    newScore: number,
    immediate: boolean = false
  ): void {
    component.targetScore = newScore;
    
    if (immediate || Math.abs(newScore - component.displayedScore) < 10) {
      // Small changes or immediate updates
      component.displayedScore = newScore;
      component.isAnimating = false;
    } else {
      // Start smooth animation
      component.isAnimating = true;
      component.animationStartTime = performance.now();
      
      // Calculate animation duration based on score difference
      const scoreDiff = Math.abs(newScore - component.displayedScore);
      component.animationDuration = Math.min(2000, Math.max(500, scoreDiff * 2));
    }
    
    // Update accessibility text
    component.screenReaderText = `Score: ${newScore.toLocaleString()}`;
    
    // Trigger effects for large score gains
    if (newScore > component.displayedScore + 50) {
      this.triggerScoreGainEffect(component, newScore - component.displayedScore);
    }
  }
  
  /**
   * Update multiplier display
   */
  static updateMultiplier(
    component: ScoreDisplayComponent,
    multiplier: number,
    pulse: boolean = false
  ): void {
    component.multiplierValue = multiplier;
    component.multiplierPulse = pulse;
    
    // Change color based on multiplier level
    if (multiplier >= 5) {
      component.multiplierColor = '#FF0080'; // Pink for high multipliers
    } else if (multiplier >= 3) {
      component.multiplierColor = '#FF6600'; // Orange for medium multipliers
    } else if (multiplier >= 2) {
      component.multiplierColor = '#FFD700'; // Gold for 2x
    } else {
      component.multiplierColor = '#FFFFFF'; // White for 1x
    }
  }
  
  /**
   * Update combo display
   */
  static updateCombo(
    component: ScoreDisplayComponent,
    comboLevel: number,
    timeRemaining: number,
    maxTime: number
  ): void {
    component.comboLevel = comboLevel;
    component.comboTimeRemaining = timeRemaining;
    component.comboProgress = maxTime > 0 ? timeRemaining / maxTime : 0;
    
    // Trigger pulse effect for combo milestones
    if (comboLevel > 0 && comboLevel % 5 === 0) {
      component.pulseEffect = true;
    }
  }
  
  /**
   * Update powerup indicators
   */
  static updatePowerups(
    component: ScoreDisplayComponent,
    powerups: Array<{
      id: string;
      name: string;
      icon: string;
      timeRemaining: number;
      totalDuration: number;
      color: string;
    }>
  ): void {
    component.activePowerups = powerups.map((powerup, index) => ({
      ...powerup,
      position: { x: index * 40, y: 0 }, // Horizontal layout
      visible: powerup.timeRemaining > 0
    }));
  }
  
  /**
   * Update component with smooth animations
   */
  static update(component: ScoreDisplayComponent, deltaTime: number): void {
    const currentTime = performance.now();
    
    // Check update frequency throttling
    const timeSinceLastUpdate = currentTime - component.lastUpdateTime;
    const updateInterval = 1000 / component.updateFrequency;
    
    if (timeSinceLastUpdate < updateInterval) {
      return;
    }
    
    component.lastUpdateTime = currentTime;
    
    // Update score animation
    if (component.isAnimating) {
      this.updateScoreAnimation(component, currentTime);
    }
    
    // Update effects
    this.updateEffects(component, deltaTime);
    
    // Update powerup timers
    this.updatePowerupTimers(component, deltaTime);
  }
  
  /**
   * Update score animation
   */
  private static updateScoreAnimation(
    component: ScoreDisplayComponent,
    currentTime: number
  ): void {
    const elapsed = currentTime - component.animationStartTime;
    const progress = Math.min(elapsed / component.animationDuration, 1);
    
    // Use easing function for smooth animation
    const easedProgress = this.easeOutQuart(progress);
    
    // Interpolate score
    const startScore = component.displayedScore;
    const targetScore = component.targetScore;
    const scoreDiff = targetScore - startScore;
    
    component.displayedScore = Math.floor(startScore + scoreDiff * easedProgress);
    
    // Complete animation
    if (progress >= 1) {
      component.displayedScore = component.targetScore;
      component.isAnimating = false;
    }
  }
  
  /**
   * Update visual effects
   */
  private static updateEffects(component: ScoreDisplayComponent, deltaTime: number): void {
    // Update shake effect
    if (component.shakeEffect) {
      component.shakeIntensity *= component.shakeDecay;
      
      if (component.shakeIntensity < 0.5) {
        component.shakeEffect = false;
        component.shakeIntensity = 0;
      }
    }
    
    // Update pulse effect
    if (component.pulseEffect) {
      // Pulse effect will be handled by rendering system
      // Auto-disable after a short time
      setTimeout(() => {
        component.pulseEffect = false;
      }, 500);
    }
    
    // Update multiplier pulse
    if (component.multiplierPulse) {
      setTimeout(() => {
        component.multiplierPulse = false;
      }, 300);
    }
  }
  
  /**
   * Update powerup timers
   */
  private static updatePowerupTimers(
    component: ScoreDisplayComponent,
    deltaTime: number
  ): void {
    const deltaMs = deltaTime * 1000;
    
    component.activePowerups.forEach(powerup => {
      powerup.timeRemaining = Math.max(0, powerup.timeRemaining - deltaMs);
      powerup.visible = powerup.timeRemaining > 0;
    });
    
    // Remove expired powerups
    component.activePowerups = component.activePowerups.filter(p => p.visible);
  }
  
  /**
   * Trigger score gain effect
   */
  private static triggerScoreGainEffect(
    component: ScoreDisplayComponent,
    scoreGain: number
  ): void {
    // Scale effects based on score gain
    if (scoreGain >= 100) {
      component.shakeEffect = true;
      component.shakeIntensity = Math.min(scoreGain / 100, 10);
      component.glowEffect = true;
    }
    
    if (scoreGain >= 50) {
      component.pulseEffect = true;
    }
  }
  
  /**
   * Optimize for mobile display
   */
  static optimizeForMobile(component: ScoreDisplayComponent): void {
    if (!component.isMobileOptimized) return;
    
    // Adjust sizing for mobile screens
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (screenWidth < 768) { // Mobile breakpoint
      // Increase font size for better readability
      component.fontSize = Math.max(component.fontSize * 1.2, 20);
      
      // Adjust position for mobile layout
      component.position.x = Math.min(component.position.x, screenWidth - component.size.width - 10);
      component.position.y = Math.max(component.position.y, 10);
      
      // Enable large text mode for accessibility
      if (screenWidth < 480) {
        component.largeTextMode = true;
        component.fontSize *= 1.3;
      }
      
      // Adjust update frequency for mobile performance
      component.updateFrequency = 30; // Reduce to 30 FPS on mobile
    }
  }
  
  /**
   * Apply high contrast mode for accessibility
   */
  static applyHighContrastMode(component: ScoreDisplayComponent): void {
    if (!component.highContrastMode) return;
    
    component.textColor = '#FFFFFF';
    component.shadowColor = '#000000';
    component.shadowOffset = { x: 3, y: 3 };
    component.multiplierColor = '#FFFF00'; // Bright yellow
  }
  
  /**
   * Easing function for smooth animations
   */
  private static easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }
  
  /**
   * Get current display values for rendering
   */
  static getDisplayValues(component: ScoreDisplayComponent) {
    return {
      score: Math.floor(component.displayedScore),
      formattedScore: Math.floor(component.displayedScore).toLocaleString(),
      multiplier: component.multiplierValue,
      multiplierText: component.multiplierValue > 1 ? `${component.multiplierValue.toFixed(1)}x` : '',
      comboText: component.comboLevel > 0 ? `${component.comboLevel}x Combo` : '',
      comboProgress: component.comboProgress,
      showCombo: component.comboLevel > 0,
      showMultiplier: component.multiplierValue > 1,
      effects: {
        glow: component.glowEffect,
        pulse: component.pulseEffect,
        shake: component.shakeEffect,
        shakeIntensity: component.shakeIntensity,
        multiplierPulse: component.multiplierPulse
      },
      powerups: component.activePowerups.filter(p => p.visible),
      accessibility: {
        screenReaderText: component.screenReaderText,
        highContrast: component.highContrastMode,
        largeText: component.largeTextMode
      }
    };
  }
  
  /**
   * Get CSS classes for styling
   */
  static getCSSClasses(component: ScoreDisplayComponent): string[] {
    const classes = ['score-display'];
    
    if (component.isMobileOptimized) classes.push('mobile-optimized');
    if (component.touchFriendly) classes.push('touch-friendly');
    if (component.responsiveScaling) classes.push('responsive');
    if (component.highContrastMode) classes.push('high-contrast');
    if (component.largeTextMode) classes.push('large-text');
    if (component.glowEffect) classes.push('glow');
    if (component.pulseEffect) classes.push('pulse');
    if (component.shakeEffect) classes.push('shake');
    if (component.multiplierPulse) classes.push('multiplier-pulse');
    
    return classes;
  }
}
