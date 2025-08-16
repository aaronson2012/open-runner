import { BaseSystem } from '@/systems/core/BaseSystem';
import type { World } from '@/core/ecs/World';
import type { EntityId } from '@/types';
import type { ScoreComponent } from '@/components/score/ScoreComponent';
import type { ComboComponent } from '@/components/score/ComboComponent';
import type { PowerupComponent } from '@/components/score/PowerupComponent';
import type { ProgressionComponent } from '@/components/score/ProgressionComponent';

/**
 * PerformanceAnalyticsSystem - Tracks and analyzes scoring system performance
 * 
 * Provides:
 * - Real-time performance metrics
 * - Scoring analytics and trends
 * - Player behavior analysis
 * - System optimization insights
 * - Mobile performance monitoring
 */
export class PerformanceAnalyticsSystem extends BaseSystem {
  // Analytics configuration
  private analyticsEnabled = true;
  private metricsInterval = 1000; // 1 second
  private lastMetricsUpdate = 0;
  
  // Performance tracking
  private frameMetrics: FrameMetrics[] = [];
  private sessionMetrics: SessionMetrics = this.createEmptySessionMetrics();
  private historicalMetrics: HistoricalMetrics[] = [];
  
  // Scoring analytics
  private scoringAnalytics: ScoringAnalytics = this.createEmptyScoringAnalytics();
  private playerBehavior: PlayerBehaviorMetrics = this.createEmptyPlayerBehavior();
  
  // Mobile performance
  private mobileMetrics: MobilePerformanceMetrics = this.createEmptyMobileMetrics();
  
  // Data retention
  private maxFrameMetrics = 300; // 5 minutes at 60 FPS
  private maxHistoricalMetrics = 100; // 100 sessions
  
  constructor() {
    super('PerformanceAnalyticsSystem');
  }
  
  initialize(world: World): void {
    super.initialize(world);
    
    // Load historical metrics
    this.loadHistoricalMetrics();
    
    // Subscribe to relevant events
    this.subscribeToEvents();
    
    // Start session
    this.sessionMetrics.sessionStart = performance.now();
    
    console.debug('PerformanceAnalyticsSystem initialized');
  }
  
  update(deltaTime: number): void {
    if (!this.world || !this.analyticsEnabled) return;
    
    const startTime = performance.now();
    
    // Collect frame metrics
    this.collectFrameMetrics(deltaTime);
    
    // Update session metrics
    this.updateSessionMetrics(deltaTime);
    
    // Periodic metrics collection
    this.handlePeriodicMetrics();
    
    // Update mobile performance tracking
    this.updateMobileMetrics(deltaTime);
    
    // Update performance metrics
    const updateTime = performance.now() - startTime;
    this.updatePerformanceMetrics(updateTime);
  }
  
  /**
   * Collect frame-level performance metrics
   */
  private collectFrameMetrics(deltaTime: number): void {
    const frameMetric: FrameMetrics = {
      timestamp: performance.now(),
      deltaTime,
      fps: 1 / deltaTime,
      memoryUsage: this.getMemoryUsage(),
      entityCount: this.getEntityCounts(),
      systemTimes: this.getSystemTimes(),
      scoreEvents: this.getScoreEvents(),
      renderTime: this.getRenderTime()
    };
    
    this.frameMetrics.push(frameMetric);
    
    // Trim old metrics
    if (this.frameMetrics.length > this.maxFrameMetrics) {
      this.frameMetrics = this.frameMetrics.slice(-this.maxFrameMetrics);
    }
  }
  
  /**
   * Update session-level metrics
   */
  private updateSessionMetrics(deltaTime: number): void {
    this.sessionMetrics.totalFrames++;
    this.sessionMetrics.totalTime += deltaTime * 1000; // Convert to ms
    
    // Update FPS statistics
    const currentFPS = 1 / deltaTime;
    this.sessionMetrics.averageFPS = (this.sessionMetrics.averageFPS * (this.sessionMetrics.totalFrames - 1) + currentFPS) / this.sessionMetrics.totalFrames;
    this.sessionMetrics.minFPS = Math.min(this.sessionMetrics.minFPS, currentFPS);
    this.sessionMetrics.maxFPS = Math.max(this.sessionMetrics.maxFPS, currentFPS);
    
    // Update memory statistics
    const memoryUsage = this.getMemoryUsage();
    this.sessionMetrics.peakMemoryUsage = Math.max(this.sessionMetrics.peakMemoryUsage, memoryUsage);
  }
  
  /**
   * Handle periodic metrics collection
   */
  private handlePeriodicMetrics(): void {
    const currentTime = performance.now();
    
    if (currentTime - this.lastMetricsUpdate > this.metricsInterval) {
      this.collectScoringAnalytics();
      this.collectPlayerBehaviorMetrics();
      this.analyzePerformanceTrends();
      
      this.lastMetricsUpdate = currentTime;
    }
  }
  
  /**
   * Collect scoring system analytics
   */
  private collectScoringAnalytics(): void {
    const scoreEntities = this.world!.getEntitiesWithComponents(['score']);
    
    let totalScore = 0;
    let totalCoins = 0;
    let totalCombos = 0;
    let activePowerups = 0;
    
    for (const entity of scoreEntities) {
      const scoreComponent = this.world!.getComponent(entity.id, 'score') as ScoreComponent;
      const comboComponent = this.world!.getComponent(entity.id, 'combo') as ComboComponent;
      const powerupComponent = this.world!.getComponent(entity.id, 'powerup') as PowerupComponent;
      
      if (scoreComponent) {
        totalScore += scoreComponent.currentScore;
        totalCoins += scoreComponent.totalCoinsCollected;
      }
      
      if (comboComponent) {
        totalCombos += comboComponent.totalCombos;
        if (comboComponent.isComboActive) {
          this.scoringAnalytics.activeCombos++;
        }
      }
      
      if (powerupComponent && powerupComponent.hasActivePowerups) {
        activePowerups++;
      }
    }
    
    // Update analytics
    this.scoringAnalytics.totalScore = totalScore;
    this.scoringAnalytics.totalCoinsCollected = totalCoins;
    this.scoringAnalytics.totalCombos = totalCombos;
    this.scoringAnalytics.activePowerups = activePowerups;
    
    // Calculate rates
    const timeInSeconds = this.sessionMetrics.totalTime / 1000;
    if (timeInSeconds > 0) {
      this.scoringAnalytics.scorePerSecond = totalScore / timeInSeconds;
      this.scoringAnalytics.coinsPerSecond = totalCoins / timeInSeconds;
    }
  }
  
  /**
   * Collect player behavior metrics
   */
  private collectPlayerBehaviorMetrics(): void {
    const progressionEntities = this.world!.getEntitiesWithComponents(['progression']);
    
    for (const entity of progressionEntities) {
      const progressionComponent = this.world!.getComponent(entity.id, 'progression') as ProgressionComponent;
      
      if (progressionComponent) {
        this.playerBehavior.achievementsUnlocked = progressionComponent.unlockedAchievements.size;
        this.playerBehavior.milestonesCompleted = progressionComponent.completedMilestones.size;
        this.playerBehavior.experienceLevel = progressionComponent.experienceLevel;
        this.playerBehavior.sessionsCompleted = progressionComponent.sessionsCompleted;
      }
    }
  }
  
  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(): void {
    if (this.frameMetrics.length < 60) return; // Need at least 1 second of data
    
    const recentMetrics = this.frameMetrics.slice(-60); // Last 60 frames
    
    // Calculate trends
    const avgFPS = recentMetrics.reduce((sum, m) => sum + m.fps, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    
    // Detect performance issues
    if (avgFPS < 30) {
      this.sessionMetrics.performanceIssues.lowFPS++;
      this.emitPerformanceAlert('low_fps', { averageFPS: avgFPS });
    }
    
    if (avgMemory > 100 * 1024 * 1024) { // 100MB
      this.sessionMetrics.performanceIssues.highMemory++;
      this.emitPerformanceAlert('high_memory', { memoryUsage: avgMemory });
    }
    
    // Calculate frame time variance (jitter)
    const frameTimes = recentMetrics.map(m => m.deltaTime);
    const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const variance = frameTimes.reduce((sum, time) => sum + Math.pow(time - avgFrameTime, 2), 0) / frameTimes.length;
    const jitter = Math.sqrt(variance);
    
    if (jitter > 0.005) { // 5ms jitter
      this.sessionMetrics.performanceIssues.frameJitter++;
      this.emitPerformanceAlert('frame_jitter', { jitter });
    }
  }
  
  /**
   * Update mobile-specific performance metrics
   */
  private updateMobileMetrics(deltaTime: number): void {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                    window.innerWidth < 768;
    
    if (!isMobile) return;
    
    this.mobileMetrics.isMobile = true;
    this.mobileMetrics.screenSize = { width: window.innerWidth, height: window.innerHeight };
    this.mobileMetrics.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Track touch events
    this.mobileMetrics.touchEventsPerSecond = this.getTouchEventRate();
    
    // Track battery usage (if available)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.mobileMetrics.batteryLevel = battery.level;
        this.mobileMetrics.isCharging = battery.charging;
      });
    }
    
    // Track thermal throttling indicators
    const currentFPS = 1 / deltaTime;
    if (currentFPS < this.sessionMetrics.averageFPS * 0.8) {
      this.mobileMetrics.thermalThrottling++;
    }
  }
  
  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }
  
  /**
   * Get entity counts by type
   */
  private getEntityCounts(): EntityCounts {
    const counts: EntityCounts = {
      total: 0,
      withScore: 0,
      withCombo: 0,
      withPowerup: 0,
      withProgression: 0
    };
    
    if (!this.world) return counts;
    
    counts.total = this.world.getEntityCount();
    counts.withScore = this.world.getEntitiesWithComponents(['score']).length;
    counts.withCombo = this.world.getEntitiesWithComponents(['combo']).length;
    counts.withPowerup = this.world.getEntitiesWithComponents(['powerup']).length;
    counts.withProgression = this.world.getEntitiesWithComponents(['progression']).length;
    
    return counts;
  }
  
  /**
   * Get system execution times
   */
  private getSystemTimes(): SystemTimes {
    // This would integrate with the actual system performance metrics
    return {
      scoreSystem: 0,
      comboSystem: 0,
      progressionSystem: 0,
      persistenceSystem: 0,
      uiSystem: 0
    };
  }
  
  /**
   * Get score events for this frame
   */
  private getScoreEvents(): ScoreEvents {
    return {
      coinCollections: 0,
      powerupActivations: 0,
      comboBreaks: 0,
      achievementUnlocks: 0,
      levelUnlocks: 0
    };
  }
  
  /**
   * Get render time
   */
  private getRenderTime(): number {
    // This would be provided by the rendering system
    return 0;
  }
  
  /**
   * Get touch event rate
   */
  private getTouchEventRate(): number {
    // This would track touch events over time
    return 0;
  }
  
  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    if (!this.world) return;
    
    // Score events
    this.world.on('score_updated', () => {
      this.scoringAnalytics.scoreUpdates++;
    });
    
    this.world.on('coin_collected', () => {
      this.scoringAnalytics.coinCollections++;
    });
    
    // Combo events
    this.world.on('combo_action', () => {
      this.playerBehavior.comboActions++;
    });
    
    this.world.on('combo_broken', () => {
      this.playerBehavior.comboBroken++;
    });
    
    // Achievement events
    this.world.on('achievement_unlocked', () => {
      this.playerBehavior.achievementsEarned++;
    });
    
    // Performance events
    this.world.on('performance_warning', (data) => {
      this.sessionMetrics.performanceWarnings++;
    });
  }
  
  /**
   * Emit performance alert
   */
  private emitPerformanceAlert(type: string, data: any): void {
    this.world?.emit('performance_alert', {
      type,
      timestamp: performance.now(),
      data
    });
  }
  
  /**
   * Get current performance report
   */
  getPerformanceReport(): PerformanceReport {
    return {
      session: { ...this.sessionMetrics },
      scoring: { ...this.scoringAnalytics },
      playerBehavior: { ...this.playerBehavior },
      mobile: { ...this.mobileMetrics },
      frameMetrics: this.frameMetrics.slice(-60), // Last 60 frames
      recommendations: this.generateRecommendations()
    };
  }
  
  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];
    
    // FPS recommendations
    if (this.sessionMetrics.averageFPS < 45) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Low Frame Rate',
        description: 'Consider reducing visual effects or entity count',
        impact: 'User experience may be affected by choppy gameplay'
      });
    }
    
    // Memory recommendations
    if (this.sessionMetrics.peakMemoryUsage > 150 * 1024 * 1024) { // 150MB
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        title: 'High Memory Usage',
        description: 'Consider implementing object pooling or reducing entity lifecycle',
        impact: 'Device may experience slowdowns or crashes'
      });
    }
    
    // Mobile-specific recommendations
    if (this.mobileMetrics.isMobile && this.mobileMetrics.thermalThrottling > 10) {
      recommendations.push({
        type: 'mobile',
        priority: 'high',
        title: 'Thermal Throttling Detected',
        description: 'Reduce update frequency or visual complexity on mobile',
        impact: 'Performance will degrade significantly on mobile devices'
      });
    }
    
    // Scoring system recommendations
    if (this.scoringAnalytics.scoreUpdates > 1000) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        title: 'High Score Update Frequency',
        description: 'Consider batching score updates or reducing update frequency',
        impact: 'Minor performance improvement possible'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Save session metrics to historical data
   */
  saveSessionMetrics(): void {
    const sessionEnd = performance.now();
    const sessionDuration = sessionEnd - this.sessionMetrics.sessionStart;
    
    const historicalMetric: HistoricalMetrics = {
      timestamp: Date.now(),
      sessionDuration,
      averageFPS: this.sessionMetrics.averageFPS,
      minFPS: this.sessionMetrics.minFPS,
      maxFPS: this.sessionMetrics.maxFPS,
      peakMemoryUsage: this.sessionMetrics.peakMemoryUsage,
      totalScore: this.scoringAnalytics.totalScore,
      achievementsUnlocked: this.playerBehavior.achievementsUnlocked,
      performanceIssues: { ...this.sessionMetrics.performanceIssues },
      deviceInfo: {
        userAgent: navigator.userAgent,
        screenSize: { width: window.innerWidth, height: window.innerHeight },
        pixelRatio: window.devicePixelRatio || 1
      }
    };
    
    this.historicalMetrics.push(historicalMetric);
    
    // Trim old metrics
    if (this.historicalMetrics.length > this.maxHistoricalMetrics) {
      this.historicalMetrics = this.historicalMetrics.slice(-this.maxHistoricalMetrics);
    }
    
    // Save to localStorage
    this.saveHistoricalMetrics();
  }
  
  /**
   * Load historical metrics from localStorage
   */
  private loadHistoricalMetrics(): void {
    try {
      const stored = localStorage.getItem('openRunner_performanceMetrics');
      if (stored) {
        this.historicalMetrics = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load historical metrics:', error);
    }
  }
  
  /**
   * Save historical metrics to localStorage
   */
  private saveHistoricalMetrics(): void {
    try {
      localStorage.setItem('openRunner_performanceMetrics', JSON.stringify(this.historicalMetrics));
    } catch (error) {
      console.warn('Failed to save historical metrics:', error);
    }
  }
  
  /**
   * Create empty session metrics
   */
  private createEmptySessionMetrics(): SessionMetrics {
    return {
      sessionStart: 0,
      totalFrames: 0,
      totalTime: 0,
      averageFPS: 0,
      minFPS: Infinity,
      maxFPS: 0,
      peakMemoryUsage: 0,
      performanceWarnings: 0,
      performanceIssues: {
        lowFPS: 0,
        highMemory: 0,
        frameJitter: 0
      }
    };
  }
  
  /**
   * Create empty scoring analytics
   */
  private createEmptyScoringAnalytics(): ScoringAnalytics {
    return {
      totalScore: 0,
      totalCoinsCollected: 0,
      totalCombos: 0,
      activeCombos: 0,
      activePowerups: 0,
      scoreUpdates: 0,
      coinCollections: 0,
      scorePerSecond: 0,
      coinsPerSecond: 0
    };
  }
  
  /**
   * Create empty player behavior metrics
   */
  private createEmptyPlayerBehavior(): PlayerBehaviorMetrics {
    return {
      comboActions: 0,
      comboBroken: 0,
      achievementsUnlocked: 0,
      achievementsEarned: 0,
      milestonesCompleted: 0,
      experienceLevel: 1,
      sessionsCompleted: 0
    };
  }
  
  /**
   * Create empty mobile metrics
   */
  private createEmptyMobileMetrics(): MobilePerformanceMetrics {
    return {
      isMobile: false,
      screenSize: { width: 0, height: 0 },
      devicePixelRatio: 1,
      touchEventsPerSecond: 0,
      batteryLevel: 1,
      isCharging: false,
      thermalThrottling: 0
    };
  }
  
  /**
   * Export analytics data
   */
  exportAnalytics(): string {
    const exportData = {
      session: this.sessionMetrics,
      scoring: this.scoringAnalytics,
      playerBehavior: this.playerBehavior,
      mobile: this.mobileMetrics,
      historical: this.historicalMetrics,
      exportTimestamp: Date.now()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Reset analytics data
   */
  resetAnalytics(): void {
    this.frameMetrics = [];
    this.sessionMetrics = this.createEmptySessionMetrics();
    this.scoringAnalytics = this.createEmptyScoringAnalytics();
    this.playerBehavior = this.createEmptyPlayerBehavior();
    this.mobileMetrics = this.createEmptyMobileMetrics();
    
    this.sessionMetrics.sessionStart = performance.now();
    
    console.debug('Analytics data reset');
  }
}

// Type definitions for analytics
export interface FrameMetrics {
  timestamp: number;
  deltaTime: number;
  fps: number;
  memoryUsage: number;
  entityCount: EntityCounts;
  systemTimes: SystemTimes;
  scoreEvents: ScoreEvents;
  renderTime: number;
}

export interface SessionMetrics {
  sessionStart: number;
  totalFrames: number;
  totalTime: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  peakMemoryUsage: number;
  performanceWarnings: number;
  performanceIssues: {
    lowFPS: number;
    highMemory: number;
    frameJitter: number;
  };
}

export interface ScoringAnalytics {
  totalScore: number;
  totalCoinsCollected: number;
  totalCombos: number;
  activeCombos: number;
  activePowerups: number;
  scoreUpdates: number;
  coinCollections: number;
  scorePerSecond: number;
  coinsPerSecond: number;
}

export interface PlayerBehaviorMetrics {
  comboActions: number;
  comboBroken: number;
  achievementsUnlocked: number;
  achievementsEarned: number;
  milestonesCompleted: number;
  experienceLevel: number;
  sessionsCompleted: number;
}

export interface MobilePerformanceMetrics {
  isMobile: boolean;
  screenSize: { width: number; height: number };
  devicePixelRatio: number;
  touchEventsPerSecond: number;
  batteryLevel: number;
  isCharging: boolean;
  thermalThrottling: number;
}

export interface EntityCounts {
  total: number;
  withScore: number;
  withCombo: number;
  withPowerup: number;
  withProgression: number;
}

export interface SystemTimes {
  scoreSystem: number;
  comboSystem: number;
  progressionSystem: number;
  persistenceSystem: number;
  uiSystem: number;
}

export interface ScoreEvents {
  coinCollections: number;
  powerupActivations: number;
  comboBreaks: number;
  achievementUnlocks: number;
  levelUnlocks: number;
}

export interface HistoricalMetrics {
  timestamp: number;
  sessionDuration: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  peakMemoryUsage: number;
  totalScore: number;
  achievementsUnlocked: number;
  performanceIssues: {
    lowFPS: number;
    highMemory: number;
    frameJitter: number;
  };
  deviceInfo: {
    userAgent: string;
    screenSize: { width: number; height: number };
    pixelRatio: number;
  };
}

export interface PerformanceReport {
  session: SessionMetrics;
  scoring: ScoringAnalytics;
  playerBehavior: PlayerBehaviorMetrics;
  mobile: MobilePerformanceMetrics;
  frameMetrics: FrameMetrics[];
  recommendations: PerformanceRecommendation[];
}

export interface PerformanceRecommendation {
  type: 'performance' | 'memory' | 'mobile' | 'optimization';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
}
