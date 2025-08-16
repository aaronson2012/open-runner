import type { Component, EntityId } from '@/types';

/**
 * AchievementNotificationComponent - UI component for achievement notifications
 */
export interface AchievementNotificationComponent extends Component {
  type: 'achievementNotification';
  
  // Notification queue
  notificationQueue: AchievementNotification[];
  currentNotification: AchievementNotification | null;
  
  // Display configuration
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  
  // Animation settings
  slideInDuration: number;
  displayDuration: number;
  slideOutDuration: number;
  
  // Current animation state
  animationState: 'hidden' | 'sliding_in' | 'displaying' | 'sliding_out';
  animationStartTime: number;
  animationProgress: number;
  
  // Visual styling
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  iconSize: number;
  
  // Mobile optimization
  isMobileOptimized: boolean;
  touchDismissEnabled: boolean;
  
  // Sound effects
  playSound: boolean;
  soundEffect: string;
  
  // Performance
  maxQueueSize: number;
  updateFrequency: number;
  lastUpdateTime: number;
}

export interface AchievementNotification {
  id: string;
  type: 'achievement' | 'milestone' | 'level_unlock' | 'reward';
  
  // Display content
  title: string;
  subtitle?: string;
  description: string;
  icon: string;
  
  // Visual properties
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  color: string;
  backgroundColor?: string;
  
  // Timing
  timestamp: number;
  duration: number;
  priority: number; // Higher priority shows first
  
  // Rewards (optional)
  rewards?: {
    experience?: number;
    title?: string;
    unlock?: string;
  };
  
  // State
  shown: boolean;
  dismissed: boolean;
}

/**
 * Create an achievement notification component
 */
export function createAchievementNotificationComponent(
  options: Partial<{
    position: { x: number; y: number };
    isMobileOptimized: boolean;
    maxQueueSize: number;
  }> = {}
): AchievementNotificationComponent {
  return {
    type: 'achievementNotification',
    entityId: 0,
    
    // Notification queue
    notificationQueue: [],
    currentNotification: null,
    
    // Display configuration
    position: options.position ?? { x: 20, y: 100 },
    size: { width: 350, height: 100 },
    visible: false,
    
    // Animation settings
    slideInDuration: 500, // 0.5 seconds
    displayDuration: 4000, // 4 seconds
    slideOutDuration: 300, // 0.3 seconds
    
    // Animation state
    animationState: 'hidden',
    animationStartTime: 0,
    animationProgress: 0,
    
    // Visual styling
    backgroundColor: '#1a1a1a',
    borderColor: '#FFD700',
    textColor: '#FFFFFF',
    iconSize: 32,
    
    // Mobile optimization
    isMobileOptimized: options.isMobileOptimized ?? true,
    touchDismissEnabled: true,
    
    // Sound effects
    playSound: true,
    soundEffect: 'achievement_unlocked',
    
    // Performance
    maxQueueSize: options.maxQueueSize ?? 10,
    updateFrequency: 60,
    lastUpdateTime: 0
  };
}

/**
 * Achievement notification manager
 */
export class AchievementNotificationManager {
  /**
   * Add a new notification to the queue
   */
  static addNotification(
    component: AchievementNotificationComponent,
    notification: Omit<AchievementNotification, 'id' | 'shown' | 'dismissed'>
  ): void {
    const fullNotification: AchievementNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random()}`,
      shown: false,
      dismissed: false
    };
    
    // Add to queue with priority sorting
    component.notificationQueue.push(fullNotification);
    component.notificationQueue.sort((a, b) => {
      // Sort by priority (higher first), then by timestamp (older first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
    
    // Limit queue size
    if (component.notificationQueue.length > component.maxQueueSize) {
      component.notificationQueue = component.notificationQueue.slice(0, component.maxQueueSize);
    }
    
    // Start showing notifications if none currently displayed
    if (component.animationState === 'hidden' && !component.currentNotification) {
      this.showNextNotification(component);
    }
    
    console.debug(`Added ${notification.type} notification: ${notification.title}`);
  }
  
  /**
   * Show the next notification in queue
   */
  static showNextNotification(component: AchievementNotificationComponent): void {
    if (component.notificationQueue.length === 0 || component.animationState !== 'hidden') {
      return;
    }
    
    // Get next notification
    const notification = component.notificationQueue.shift()!;
    component.currentNotification = notification;
    notification.shown = true;
    
    // Start slide-in animation
    component.animationState = 'sliding_in';
    component.animationStartTime = performance.now();
    component.animationProgress = 0;
    component.visible = true;
    
    // Update styling based on notification type and rarity
    this.updateStylingForNotification(component, notification);
    
    // Play sound effect
    if (component.playSound) {
      this.playNotificationSound(component, notification);
    }
    
    console.debug(`Showing notification: ${notification.title}`);
  }
  
  /**
   * Update component animations
   */
  static update(component: AchievementNotificationComponent, deltaTime: number): void {
    const currentTime = performance.now();
    
    // Check update frequency throttling
    const timeSinceLastUpdate = currentTime - component.lastUpdateTime;
    const updateInterval = 1000 / component.updateFrequency;
    
    if (timeSinceLastUpdate < updateInterval) {
      return;
    }
    
    component.lastUpdateTime = currentTime;
    
    // Update current animation
    if (component.animationState !== 'hidden') {
      this.updateAnimation(component, currentTime);
    }
    
    // Check for next notification
    if (component.animationState === 'hidden' && component.notificationQueue.length > 0) {
      this.showNextNotification(component);
    }
  }
  
  /**
   * Update animation state
   */
  private static updateAnimation(
    component: AchievementNotificationComponent,
    currentTime: number
  ): void {
    const elapsed = currentTime - component.animationStartTime;
    
    switch (component.animationState) {
      case 'sliding_in':
        component.animationProgress = Math.min(elapsed / component.slideInDuration, 1);
        
        if (component.animationProgress >= 1) {
          component.animationState = 'displaying';
          component.animationStartTime = currentTime;
          component.animationProgress = 0;
        }
        break;
        
      case 'displaying':
        component.animationProgress = Math.min(elapsed / component.displayDuration, 1);
        
        if (component.animationProgress >= 1) {
          component.animationState = 'sliding_out';
          component.animationStartTime = currentTime;
          component.animationProgress = 0;
        }
        break;
        
      case 'sliding_out':
        component.animationProgress = Math.min(elapsed / component.slideOutDuration, 1);
        
        if (component.animationProgress >= 1) {
          this.hideNotification(component);
        }
        break;
    }
  }
  
  /**
   * Hide current notification
   */
  static hideNotification(component: AchievementNotificationComponent): void {
    component.animationState = 'hidden';
    component.visible = false;
    component.animationProgress = 0;
    
    if (component.currentNotification) {
      component.currentNotification.dismissed = true;
      component.currentNotification = null;
    }
    
    // Show next notification after a brief delay
    setTimeout(() => {
      if (component.notificationQueue.length > 0) {
        this.showNextNotification(component);
      }
    }, 200); // 200ms delay between notifications
  }
  
  /**
   * Dismiss current notification (user action)
   */
  static dismissNotification(component: AchievementNotificationComponent): void {
    if (component.animationState === 'displaying') {
      component.animationState = 'sliding_out';
      component.animationStartTime = performance.now();
      component.animationProgress = 0;
    }
  }
  
  /**
   * Update styling based on notification
   */
  private static updateStylingForNotification(
    component: AchievementNotificationComponent,
    notification: AchievementNotification
  ): void {
    // Set colors based on rarity
    switch (notification.rarity) {
      case 'legendary':
        component.borderColor = '#FF0080';
        component.backgroundColor = '#2a0a1a';
        break;
      case 'epic':
        component.borderColor = '#8A2BE2';
        component.backgroundColor = '#1a0a2a';
        break;
      case 'rare':
        component.borderColor = '#0080FF';
        component.backgroundColor = '#0a1a2a';
        break;
      case 'common':
      default:
        component.borderColor = '#FFD700';
        component.backgroundColor = '#2a2a0a';
        break;
    }
    
    // Override with notification-specific colors
    if (notification.backgroundColor) {
      component.backgroundColor = notification.backgroundColor;
    }
    
    if (notification.color) {
      component.borderColor = notification.color;
    }
    
    // Adjust size based on content
    if (component.isMobileOptimized) {
      this.optimizeForMobile(component, notification);
    }
  }
  
  /**
   * Optimize for mobile display
   */
  private static optimizeForMobile(
    component: AchievementNotificationComponent,
    notification: AchievementNotification
  ): void {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (screenWidth < 768) { // Mobile breakpoint
      // Adjust size for mobile
      component.size.width = Math.min(screenWidth - 40, 320);
      component.size.height = 80;
      
      // Center horizontally
      component.position.x = (screenWidth - component.size.width) / 2;
      
      // Position near top but below score
      component.position.y = 80;
      
      // Smaller icon for mobile
      component.iconSize = 24;
      
      // Longer display duration on mobile for touch interaction
      component.displayDuration = 5000; // 5 seconds
    }
  }
  
  /**
   * Play notification sound
   */
  private static playNotificationSound(
    component: AchievementNotificationComponent,
    notification: AchievementNotification
  ): void {
    let soundId = component.soundEffect;
    let volume = 0.6;
    
    // Different sounds for different types and rarities
    switch (notification.type) {
      case 'achievement':
        soundId = notification.rarity === 'legendary' ? 'achievement_legendary' :
                 notification.rarity === 'epic' ? 'achievement_epic' :
                 'achievement_unlocked';
        break;
      case 'milestone':
        soundId = 'milestone_completed';
        break;
      case 'level_unlock':
        soundId = 'level_unlocked';
        volume = 0.8;
        break;
      case 'reward':
        soundId = 'reward_received';
        break;
    }
    
    // Emit sound event (will be handled by audio system)
    // This is a placeholder - actual implementation would integrate with audio system
    console.debug(`Playing notification sound: ${soundId}`);
  }
  
  /**
   * Create notification for achievement unlock
   */
  static createAchievementNotification(
    name: string,
    description: string,
    rarity: AchievementNotification['rarity'] = 'common',
    rewards?: AchievementNotification['rewards']
  ): Omit<AchievementNotification, 'id' | 'shown' | 'dismissed'> {
    return {
      type: 'achievement',
      title: 'Achievement Unlocked!',
      subtitle: name,
      description,
      icon: this.getIconForRarity(rarity),
      rarity,
      color: this.getColorForRarity(rarity),
      timestamp: Date.now(),
      duration: 4000,
      priority: this.getPriorityForRarity(rarity),
      rewards
    };
  }
  
  /**
   * Create notification for milestone completion
   */
  static createMilestoneNotification(
    name: string,
    description: string,
    rewards?: AchievementNotification['rewards']
  ): Omit<AchievementNotification, 'id' | 'shown' | 'dismissed'> {
    return {
      type: 'milestone',
      title: 'Milestone Reached!',
      subtitle: name,
      description,
      icon: '🎯',
      rarity: 'rare',
      color: '#00FF00',
      timestamp: Date.now(),
      duration: 3000,
      priority: 3,
      rewards
    };
  }
  
  /**
   * Create notification for level unlock
   */
  static createLevelUnlockNotification(
    levelNumber: number,
    levelName?: string
  ): Omit<AchievementNotification, 'id' | 'shown' | 'dismissed'> {
    return {
      type: 'level_unlock',
      title: `Level ${levelNumber} Unlocked!`,
      subtitle: levelName || `New Level Available`,
      description: `You've unlocked a new level to explore!`,
      icon: '🎆',
      rarity: 'epic',
      color: '#FF6600',
      timestamp: Date.now(),
      duration: 5000,
      priority: 5
    };
  }
  
  /**
   * Get icon for rarity level
   */
  private static getIconForRarity(rarity: AchievementNotification['rarity']): string {
    switch (rarity) {
      case 'legendary': return '🏆';
      case 'epic': return '✨';
      case 'rare': return '🔥';
      case 'common': default: return '🎖️';
    }
  }
  
  /**
   * Get color for rarity level
   */
  private static getColorForRarity(rarity: AchievementNotification['rarity']): string {
    switch (rarity) {
      case 'legendary': return '#FF0080';
      case 'epic': return '#8A2BE2';
      case 'rare': return '#0080FF';
      case 'common': default: return '#FFD700';
    }
  }
  
  /**
   * Get priority for rarity level
   */
  private static getPriorityForRarity(rarity: AchievementNotification['rarity']): number {
    switch (rarity) {
      case 'legendary': return 10;
      case 'epic': return 7;
      case 'rare': return 5;
      case 'common': default: return 3;
    }
  }
  
  /**
   * Get animation values for rendering
   */
  static getAnimationValues(component: AchievementNotificationComponent) {
    let translateX = 0;
    let opacity = 1;
    let scale = 1;
    
    const progress = component.animationProgress;
    
    switch (component.animationState) {
      case 'hidden':
        translateX = -component.size.width;
        opacity = 0;
        scale = 0.8;
        break;
        
      case 'sliding_in':
        const easedIn = this.easeOutBack(progress);
        translateX = -component.size.width * (1 - easedIn);
        opacity = progress;
        scale = 0.8 + 0.2 * easedIn;
        break;
        
      case 'displaying':
        // Subtle breathing effect
        scale = 1 + Math.sin(progress * Math.PI * 8) * 0.02;
        break;
        
      case 'sliding_out':
        const easedOut = this.easeInBack(progress);
        translateX = -component.size.width * easedOut;
        opacity = 1 - progress;
        scale = 1 - 0.2 * easedOut;
        break;
    }
    
    return {
      translateX,
      opacity,
      scale,
      visible: component.visible
    };
  }
  
  /**
   * Easing functions
   */
  private static easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  
  private static easeInBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  }
  
  /**
   * Clear all notifications
   */
  static clearAllNotifications(component: AchievementNotificationComponent): void {
    component.notificationQueue = [];
    component.currentNotification = null;
    component.animationState = 'hidden';
    component.visible = false;
    
    console.debug('All notifications cleared');
  }
  
  /**
   * Get statistics
   */
  static getStatistics(component: AchievementNotificationComponent) {
    return {
      queueLength: component.notificationQueue.length,
      currentNotification: component.currentNotification?.title || null,
      animationState: component.animationState,
      isVisible: component.visible,
      totalShown: component.notificationQueue.filter(n => n.shown).length,
      totalDismissed: component.notificationQueue.filter(n => n.dismissed).length
    };
  }
}
