import { BaseSystem } from '@/systems/core/BaseSystem';
import type { World } from '@/core/ecs/World';
import type { EntityId } from '@/types';
import type { ScoreDisplayComponent } from '@/components/ui/ScoreDisplayComponent';
import type { AchievementNotificationComponent } from '@/components/ui/AchievementNotificationComponent';
import type { ScoreComponent } from '@/components/score/ScoreComponent';
import type { ComboComponent } from '@/components/score/ComboComponent';
import type { PowerupComponent } from '@/components/score/PowerupComponent';
import type { ProgressionComponent } from '@/components/score/ProgressionComponent';
import { ScoreDisplayManager } from '@/components/ui/ScoreDisplayComponent';
import { AchievementNotificationManager } from '@/components/ui/AchievementNotificationComponent';

/**
 * ScoreUISystem - Manages all score-related UI components and visual feedback
 * 
 * Handles:
 * - Real-time score display with smooth animations
 * - Achievement and milestone notifications
 * - Combo and multiplier indicators
 * - Powerup status display
 * - Mobile-optimized UI updates
 */
export class ScoreUISystem extends BaseSystem {
  // UI update configuration
  private uiUpdateFrequency = 60; // 60 FPS for smooth UI
  private lastUIUpdate = 0;
  
  // Mobile detection
  private isMobile = false;
  private devicePixelRatio = 1;
  
  // Canvas rendering context (if using canvas for UI)
  private canvasContext: CanvasRenderingContext2D | null = null;
  
  constructor() {
    super('ScoreUISystem');
    this.detectMobileDevice();
  }
  
  initialize(world: World): void {
    super.initialize(world);
    
    // Subscribe to score-related events
    this.subscribeToEvents();
    
    // Initialize mobile optimizations
    this.initializeMobileOptimizations();
    
    console.debug('ScoreUISystem initialized with mobile optimization:', this.isMobile);
  }
  
  update(deltaTime: number): void {
    if (!this.world) return;
    
    const startTime = performance.now();
    
    // Update UI components
    this.updateScoreDisplays(deltaTime);
    this.updateAchievementNotifications(deltaTime);
    
    // Update performance metrics
    const updateTime = performance.now() - startTime;
    this.updatePerformanceMetrics(updateTime);
  }
  
  /**
   * Update all score display components
   */
  private updateScoreDisplays(deltaTime: number): void {
    const scoreDisplayEntities = this.world!.getEntitiesWithComponents(['scoreDisplay']);
    
    for (const entity of scoreDisplayEntities) {
      const scoreDisplay = this.world!.getComponent(entity.id, 'scoreDisplay') as ScoreDisplayComponent;
      if (!scoreDisplay) continue;
      
      // Update display animations
      ScoreDisplayManager.update(scoreDisplay, deltaTime);
      
      // Sync with score component data
      this.syncScoreDisplayData(entity.id, scoreDisplay);
      
      // Apply mobile optimizations
      if (this.isMobile) {
        ScoreDisplayManager.optimizeForMobile(scoreDisplay);
      }
    }
  }
  
  /**
   * Update achievement notification components
   */
  private updateAchievementNotifications(deltaTime: number): void {
    const notificationEntities = this.world!.getEntitiesWithComponents(['achievementNotification']);
    
    for (const entity of notificationEntities) {
      const notification = this.world!.getComponent(entity.id, 'achievementNotification') as AchievementNotificationComponent;
      if (!notification) continue;
      
      // Update notification animations
      AchievementNotificationManager.update(notification, deltaTime);
    }
  }
  
  /**
   * Sync score display with score component data
   */
  private syncScoreDisplayData(entityId: EntityId, scoreDisplay: ScoreDisplayComponent): void {
    const scoreComponent = this.world!.getComponent(entityId, 'score') as ScoreComponent;
    const comboComponent = this.world!.getComponent(entityId, 'combo') as ComboComponent;
    const powerupComponent = this.world!.getComponent(entityId, 'powerup') as PowerupComponent;
    
    if (scoreComponent) {
      // Update score (will animate smoothly)
      ScoreDisplayManager.updateScore(
        scoreDisplay,
        scoreComponent.currentScore,
        false // Don't force immediate update
      );
      
      // Update multiplier display
      ScoreDisplayManager.updateMultiplier(
        scoreDisplay,
        scoreComponent.scoreMultiplier,
        scoreComponent.doublerActive || scoreComponent.scoreMultiplier > 1
      );
    }
    
    if (comboComponent) {
      // Update combo display
      ScoreDisplayManager.updateCombo(
        scoreDisplay,
        comboComponent.currentCombo,
        comboComponent.comboTimeRemaining,
        comboComponent.activeComboType ? 
          comboComponent.comboTypes.get(comboComponent.activeComboType)?.timeout || 3000 : 3000
      );
    }
    
    if (powerupComponent) {
      // Update powerup indicators
      const activePowerups = Array.from(powerupComponent.activePowerups.values()).map(powerup => ({
        id: powerup.type.id,
        name: powerup.type.name,
        icon: powerup.type.icon,
        timeRemaining: powerup.timeRemaining,
        totalDuration: powerup.duration,
        color: powerup.type.color
      }));
      
      // Add doubler if active (faithful to original)
      if (powerupComponent.doublerActive) {
        activePowerups.unshift({
          id: 'doubler',
          name: 'Coin Doubler',
          icon: '💰',
          timeRemaining: powerupComponent.doublerTimeRemaining,
          totalDuration: 15000, // 15 seconds
          color: '#FFD700'
        });
      }
      
      ScoreDisplayManager.updatePowerups(scoreDisplay, activePowerups);
    }
  }
  
  /**
   * Handle score update events
   */
  private handleScoreUpdate(data: any): void {
    const scoreDisplayEntities = this.world!.getEntitiesWithComponents(['scoreDisplay']);
    
    for (const entity of scoreDisplayEntities) {
      if (entity.id === data.entityId) {
        const scoreDisplay = this.world!.getComponent(entity.id, 'scoreDisplay') as ScoreDisplayComponent;
        if (scoreDisplay) {
          // Trigger score gain effect for large increases
          if (data.scoreGain > 50) {
            this.triggerScoreGainEffect(scoreDisplay, data.scoreGain);
          }
          
          // Update accessibility
          this.updateAccessibility(scoreDisplay, data);
        }
        break;
      }
    }
  }
  
  /**
   * Handle achievement unlock events
   */
  private handleAchievementUnlock(data: any): void {
    const notificationEntities = this.world!.getEntitiesWithComponents(['achievementNotification']);
    
    for (const entity of notificationEntities) {
      const notification = this.world!.getComponent(entity.id, 'achievementNotification') as AchievementNotificationComponent;
      if (notification) {
        const achievementNotification = AchievementNotificationManager.createAchievementNotification(
          data.subtitle || data.title,
          data.description,
          data.rarity || 'common',
          data.rewards
        );
        
        AchievementNotificationManager.addNotification(notification, achievementNotification);
        break;
      }
    }
  }
  
  /**
   * Handle milestone completion events
   */
  private handleMilestoneCompletion(data: any): void {
    const notificationEntities = this.world!.getEntitiesWithComponents(['achievementNotification']);
    
    for (const entity of notificationEntities) {
      const notification = this.world!.getComponent(entity.id, 'achievementNotification') as AchievementNotificationComponent;
      if (notification) {
        const milestoneNotification = AchievementNotificationManager.createMilestoneNotification(
          data.subtitle || data.title,
          data.description,
          data.rewards
        );
        
        AchievementNotificationManager.addNotification(notification, milestoneNotification);
        break;
      }
    }
  }
  
  /**
   * Handle level unlock events
   */
  private handleLevelUnlock(data: any): void {
    const notificationEntities = this.world!.getEntitiesWithComponents(['achievementNotification']);
    
    for (const entity of notificationEntities) {
      const notification = this.world!.getComponent(entity.id, 'achievementNotification') as AchievementNotificationComponent;
      if (notification) {
        const levelNotification = AchievementNotificationManager.createLevelUnlockNotification(
          data.level,
          data.levelName
        );
        
        AchievementNotificationManager.addNotification(notification, levelNotification);
        break;
      }
    }
  }
  
  /**
   * Handle combo events
   */
  private handleComboEvent(data: any): void {
    const scoreDisplayEntities = this.world!.getEntitiesWithComponents(['scoreDisplay']);
    
    for (const entity of scoreDisplayEntities) {
      if (entity.id === data.entityId) {
        const scoreDisplay = this.world!.getComponent(entity.id, 'scoreDisplay') as ScoreDisplayComponent;
        if (scoreDisplay) {
          // Trigger pulse effect for combo milestones
          if (data.comboLevel && data.comboLevel % 5 === 0) {
            this.triggerComboPulseEffect(scoreDisplay, data.comboLevel);
          }
        }
        break;
      }
    }
  }
  
  /**
   * Trigger score gain visual effect
   */
  private triggerScoreGainEffect(scoreDisplay: ScoreDisplayComponent, scoreGain: number): void {
    // Scale effects based on score gain
    if (scoreGain >= 100) {
      scoreDisplay.shakeEffect = true;
      scoreDisplay.shakeIntensity = Math.min(scoreGain / 100, 10);
      scoreDisplay.glowEffect = true;
    }
    
    if (scoreGain >= 50) {
      scoreDisplay.pulseEffect = true;
    }
    
    // Auto-disable effects after animation
    setTimeout(() => {
      scoreDisplay.glowEffect = false;
    }, 1000);
  }
  
  /**
   * Trigger combo pulse effect
   */
  private triggerComboPulseEffect(scoreDisplay: ScoreDisplayComponent, comboLevel: number): void {
    scoreDisplay.pulseEffect = true;
    
    // Stronger effect for higher combos
    if (comboLevel >= 20) {
      scoreDisplay.glowEffect = true;
      setTimeout(() => {
        scoreDisplay.glowEffect = false;
      }, 800);
    }
  }
  
  /**
   * Update accessibility features
   */
  private updateAccessibility(scoreDisplay: ScoreDisplayComponent, data: any): void {
    // Update screen reader text
    const formattedScore = data.currentScore.toLocaleString();
    scoreDisplay.screenReaderText = `Score: ${formattedScore}`;
    
    if (data.multiplier > 1) {
      scoreDisplay.screenReaderText += `, ${data.multiplier}x multiplier`;
    }
    
    if (data.doublerActive) {
      scoreDisplay.screenReaderText += `, Coin doubler active`;
    }
    
    // Announce significant score increases
    if (data.scoreGain > 100) {
      this.announceScoreGain(data.scoreGain);
    }
  }
  
  /**
   * Announce score gain for screen readers
   */
  private announceScoreGain(scoreGain: number): void {
    const announcement = `Gained ${scoreGain} points!`;
    
    // Create temporary element for screen reader announcement
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.overflow = 'hidden';
    announcer.textContent = announcement;
    
    document.body.appendChild(announcer);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  }
  
  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    if (!this.world) return;
    
    // Score events
    this.world.on('score_updated', (data) => {
      this.handleScoreUpdate(data);
    });
    
    // Achievement events
    this.world.on('achievement_unlocked', (data) => {
      this.handleAchievementUnlock(data);
    });
    
    // Milestone events
    this.world.on('milestone_completed', (data) => {
      this.handleMilestoneCompletion(data);
    });
    
    // Level unlock events
    this.world.on('level_unlocked', (data) => {
      this.handleLevelUnlock(data);
    });
    
    // Combo events
    this.world.on('combo_updated', (data) => {
      this.handleComboEvent(data);
    });
    
    this.world.on('combo_milestone', (data) => {
      this.handleComboEvent(data);
    });
    
    // Powerup events
    this.world.on('powerup_activated', (data) => {
      // Trigger visual feedback for powerup activation
      const scoreDisplayEntities = this.world!.getEntitiesWithComponents(['scoreDisplay']);
      for (const entity of scoreDisplayEntities) {
        if (entity.id === data.entityId) {
          const scoreDisplay = this.world!.getComponent(entity.id, 'scoreDisplay') as ScoreDisplayComponent;
          if (scoreDisplay) {
            scoreDisplay.pulseEffect = true;
          }
          break;
        }
      }
    });
  }
  
  /**
   * Detect mobile device
   */
  private detectMobileDevice(): void {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   window.innerWidth < 768;
    
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.isMobile = window.innerWidth < 768;
        this.applyMobileOptimizations();
      }, 100);
    });
    
    // Listen for resize events
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 768;
      this.applyMobileOptimizations();
    });
  }
  
  /**
   * Initialize mobile optimizations
   */
  private initializeMobileOptimizations(): void {
    if (this.isMobile) {
      // Reduce UI update frequency on mobile for better performance
      this.uiUpdateFrequency = 30; // 30 FPS on mobile
      
      // Apply mobile CSS classes
      document.body.classList.add('mobile-ui');
      
      // Set viewport meta tag for mobile optimization
      this.ensureMobileViewport();
    }
  }
  
  /**
   * Apply mobile optimizations to existing components
   */
  private applyMobileOptimizations(): void {
    if (!this.world) return;
    
    const scoreDisplayEntities = this.world.getEntitiesWithComponents(['scoreDisplay']);
    const notificationEntities = this.world.getEntitiesWithComponents(['achievementNotification']);
    
    // Optimize score displays
    for (const entity of scoreDisplayEntities) {
      const scoreDisplay = this.world.getComponent(entity.id, 'scoreDisplay') as ScoreDisplayComponent;
      if (scoreDisplay) {
        ScoreDisplayManager.optimizeForMobile(scoreDisplay);
      }
    }
    
    // Optimize notifications
    for (const entity of notificationEntities) {
      const notification = this.world.getComponent(entity.id, 'achievementNotification') as AchievementNotificationComponent;
      if (notification) {
        notification.isMobileOptimized = this.isMobile;
      }
    }
  }
  
  /**
   * Ensure mobile viewport is properly configured
   */
  private ensureMobileViewport(): void {
    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  }
  
  /**
   * Render UI components (if using canvas rendering)
   */
  renderUI(context: CanvasRenderingContext2D): void {
    this.canvasContext = context;
    
    // Render score displays
    this.renderScoreDisplays(context);
    
    // Render achievement notifications
    this.renderAchievementNotifications(context);
  }
  
  /**
   * Render score displays on canvas
   */
  private renderScoreDisplays(context: CanvasRenderingContext2D): void {
    const scoreDisplayEntities = this.world!.getEntitiesWithComponents(['scoreDisplay']);
    
    for (const entity of scoreDisplayEntities) {
      const scoreDisplay = this.world!.getComponent(entity.id, 'scoreDisplay') as ScoreDisplayComponent;
      if (!scoreDisplay || !scoreDisplay.visible) continue;
      
      const displayValues = ScoreDisplayManager.getDisplayValues(scoreDisplay);
      const cssClasses = ScoreDisplayManager.getCSSClasses(scoreDisplay);
      
      // Render score text
      this.renderScoreText(context, scoreDisplay, displayValues);
      
      // Render multiplier
      if (displayValues.showMultiplier) {
        this.renderMultiplier(context, scoreDisplay, displayValues);
      }
      
      // Render combo indicator
      if (displayValues.showCombo) {
        this.renderComboIndicator(context, scoreDisplay, displayValues);
      }
      
      // Render powerup indicators
      this.renderPowerupIndicators(context, scoreDisplay, displayValues);
    }
  }
  
  /**
   * Render score text
   */
  private renderScoreText(
    context: CanvasRenderingContext2D,
    scoreDisplay: ScoreDisplayComponent,
    displayValues: any
  ): void {
    context.save();
    
    // Apply effects
    if (displayValues.effects.shake) {
      const shakeX = (Math.random() - 0.5) * displayValues.effects.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * displayValues.effects.shakeIntensity;
      context.translate(shakeX, shakeY);
    }
    
    if (displayValues.effects.pulse) {
      const pulseScale = 1 + Math.sin(performance.now() * 0.01) * 0.1;
      context.scale(pulseScale, pulseScale);
    }
    
    // Set font and color
    context.font = `${scoreDisplay.fontSize}px ${scoreDisplay.fontFamily}`;
    context.fillStyle = scoreDisplay.textColor;
    
    // Draw shadow
    context.shadowColor = scoreDisplay.shadowColor;
    context.shadowOffsetX = scoreDisplay.shadowOffset.x;
    context.shadowOffsetY = scoreDisplay.shadowOffset.y;
    context.shadowBlur = 4;
    
    // Draw score text
    context.fillText(
      displayValues.formattedScore,
      scoreDisplay.position.x,
      scoreDisplay.position.y + scoreDisplay.fontSize
    );
    
    context.restore();
  }
  
  /**
   * Render multiplier indicator
   */
  private renderMultiplier(
    context: CanvasRenderingContext2D,
    scoreDisplay: ScoreDisplayComponent,
    displayValues: any
  ): void {
    context.save();
    
    // Apply pulse effect
    if (displayValues.effects.multiplierPulse) {
      const pulseScale = 1 + Math.sin(performance.now() * 0.02) * 0.2;
      context.scale(pulseScale, pulseScale);
    }
    
    // Set font and color
    context.font = `${scoreDisplay.fontSize * 0.7}px ${scoreDisplay.fontFamily}`;
    context.fillStyle = scoreDisplay.multiplierColor;
    
    // Draw multiplier text
    const multiplierY = scoreDisplay.position.y + scoreDisplay.fontSize * 1.8;
    context.fillText(
      displayValues.multiplierText,
      scoreDisplay.position.x,
      multiplierY
    );
    
    context.restore();
  }
  
  /**
   * Render combo indicator
   */
  private renderComboIndicator(
    context: CanvasRenderingContext2D,
    scoreDisplay: ScoreDisplayComponent,
    displayValues: any
  ): void {
    context.save();
    
    const comboY = scoreDisplay.position.y + scoreDisplay.fontSize * 2.5;
    const progressBarWidth = 100;
    const progressBarHeight = 6;
    
    // Draw combo text
    context.font = `${scoreDisplay.fontSize * 0.6}px ${scoreDisplay.fontFamily}`;
    context.fillStyle = '#FFFF00';
    context.fillText(
      displayValues.comboText,
      scoreDisplay.position.x,
      comboY
    );
    
    // Draw progress bar
    const progressY = comboY + 10;
    
    // Background
    context.fillStyle = '#333333';
    context.fillRect(
      scoreDisplay.position.x,
      progressY,
      progressBarWidth,
      progressBarHeight
    );
    
    // Progress fill
    context.fillStyle = '#FFFF00';
    context.fillRect(
      scoreDisplay.position.x,
      progressY,
      progressBarWidth * displayValues.comboProgress,
      progressBarHeight
    );
    
    context.restore();
  }
  
  /**
   * Render powerup indicators
   */
  private renderPowerupIndicators(
    context: CanvasRenderingContext2D,
    scoreDisplay: ScoreDisplayComponent,
    displayValues: any
  ): void {
    const powerupY = scoreDisplay.position.y + scoreDisplay.fontSize * 3.5;
    
    displayValues.powerups.forEach((powerup: any, index: number) => {
      const powerupX = scoreDisplay.position.x + index * 40;
      
      // Draw powerup icon background
      context.fillStyle = powerup.color + '40'; // Add transparency
      context.fillRect(powerupX, powerupY, 32, 32);
      
      // Draw powerup icon (simplified)
      context.fillStyle = powerup.color;
      context.font = '16px Arial';
      context.fillText(powerup.icon, powerupX + 8, powerupY + 20);
      
      // Draw timer bar
      const progress = powerup.timeRemaining / powerup.totalDuration;
      const timerY = powerupY + 28;
      
      context.fillStyle = '#333333';
      context.fillRect(powerupX, timerY, 32, 4);
      
      context.fillStyle = powerup.color;
      context.fillRect(powerupX, timerY, 32 * progress, 4);
    });
  }
  
  /**
   * Render achievement notifications
   */
  private renderAchievementNotifications(context: CanvasRenderingContext2D): void {
    const notificationEntities = this.world!.getEntitiesWithComponents(['achievementNotification']);
    
    for (const entity of notificationEntities) {
      const notification = this.world!.getComponent(entity.id, 'achievementNotification') as AchievementNotificationComponent;
      if (!notification || !notification.visible || !notification.currentNotification) continue;
      
      const animationValues = AchievementNotificationManager.getAnimationValues(notification);
      if (!animationValues.visible) continue;
      
      context.save();
      
      // Apply animation transforms
      context.globalAlpha = animationValues.opacity;
      context.translate(animationValues.translateX, 0);
      context.scale(animationValues.scale, animationValues.scale);
      
      // Draw notification background
      context.fillStyle = notification.backgroundColor;
      context.strokeStyle = notification.borderColor;
      context.lineWidth = 2;
      
      const rect = {
        x: notification.position.x,
        y: notification.position.y,
        width: notification.size.width,
        height: notification.size.height
      };
      
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      
      // Draw notification content
      context.fillStyle = notification.textColor;
      context.font = '16px Arial';
      
      // Title
      context.fillText(
        notification.currentNotification.title,
        rect.x + 10,
        rect.y + 25
      );
      
      // Subtitle
      if (notification.currentNotification.subtitle) {
        context.font = '14px Arial';
        context.fillText(
          notification.currentNotification.subtitle,
          rect.x + 10,
          rect.y + 45
        );
      }
      
      // Icon
      context.font = `${notification.iconSize}px Arial`;
      context.fillText(
        notification.currentNotification.icon,
        rect.x + rect.width - 40,
        rect.y + 30
      );
      
      context.restore();
    }
  }
  
  /**
   * Get UI statistics
   */
  getUIStatistics() {
    if (!this.world) return null;
    
    const scoreDisplays = this.world.getEntitiesWithComponents(['scoreDisplay']).length;
    const notifications = this.world.getEntitiesWithComponents(['achievementNotification']).length;
    
    return {
      scoreDisplays,
      notifications,
      isMobile: this.isMobile,
      devicePixelRatio: this.devicePixelRatio,
      updateFrequency: this.uiUpdateFrequency,
      canvasRendering: this.canvasContext !== null
    };
  }
}
