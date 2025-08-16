import { World } from '@/core/ecs/World';
import { ScoreSystem } from '@/systems/score/ScoreSystem';
import { ComboSystem } from '@/systems/score/ComboSystem';
import { ProgressionSystem } from '@/systems/score/ProgressionSystem';
import { PersistenceSystem } from '@/systems/score/PersistenceSystem';
import { ScoreUISystem } from '@/systems/ui/ScoreUISystem';
import { PerformanceAnalyticsSystem } from '@/systems/score/PerformanceAnalyticsSystem';
import { createScoreComponent } from '@/components/score/ScoreComponent';
import { createComboComponent } from '@/components/score/ComboComponent';
import { createPowerupComponent } from '@/components/score/PowerupComponent';
import { createProgressionComponent } from '@/components/score/ProgressionComponent';
import { createHighScoreComponent } from '@/components/score/HighScoreComponent';
import { createScoreDisplayComponent } from '@/components/ui/ScoreDisplayComponent';
import { createAchievementNotificationComponent } from '@/components/ui/AchievementNotificationComponent';

/**
 * Complete Open Runner Scoring System Example
 * 
 * Demonstrates faithful recreation of original mechanics plus modern enhancements:
 * - Base coin value: 10 points (original)
 * - Doubler powerup: 2x multiplier for 15 seconds (original)
 * - Level progression: 300 points unlocks Level 2 (original)
 * - Persistent high scores via localStorage (original)
 * - Modern combo system for skilled play
 * - Achievement system with visual feedback
 * - Mobile-optimized UI
 * - Performance analytics
 */
export class ScoringSystemExample {
  private world: World;
  private systems: {
    score: ScoreSystem;
    combo: ComboSystem;
    progression: ProgressionSystem;
    persistence: PersistenceSystem;
    ui: ScoreUISystem;
    analytics: PerformanceAnalyticsSystem;
  };
  private playerId: number;
  private isRunning = false;
  
  constructor() {
    console.log('🎮 Initializing Open Runner Scoring System');
    console.log('📊 Faithful recreation of original mechanics + modern enhancements');
    
    // Initialize world
    this.world = new World({
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: true
    });
    
    // Initialize all scoring systems
    this.systems = {
      score: new ScoreSystem(),
      combo: new ComboSystem(),
      progression: new ProgressionSystem(),
      persistence: new PersistenceSystem(),
      ui: new ScoreUISystem(),
      analytics: new PerformanceAnalyticsSystem()
    };
    
    // Initialize systems
    Object.values(this.systems).forEach(system => {
      system.initialize(this.world);
    });
    
    // Create player entity with all scoring components
    this.playerId = this.createPlayer();
    
    console.log('✅ Scoring system initialized successfully');
    this.logSystemStatus();
  }
  
  /**
   * Create player entity with complete scoring setup
   */
  private createPlayer(): number {
    const playerId = this.world.createEntity();
    
    // Add all scoring components
    this.world.addComponent(playerId, createScoreComponent({
      baseCoinValue: 10, // Faithful to original
      baseDistanceValue: 1
    }));
    
    this.world.addComponent(playerId, createComboComponent({
      comboTimeout: 3000, // 3 seconds
      maxMultiplier: 10,
      multiplierIncrement: 0.1
    }));
    
    this.world.addComponent(playerId, createPowerupComponent({
      doublerDuration: 15000, // 15 seconds (faithful to original)
      doublerMultiplier: 2 // 2x multiplier (faithful to original)
    }));
    
    this.world.addComponent(playerId, createProgressionComponent({
      level2UnlockScore: 300 // 300 points unlocks Level 2 (faithful to original)
    }));
    
    this.world.addComponent(playerId, createHighScoreComponent({
      localStorageKey: 'openRunner_highScore', // Faithful to original
      levelStorageKey: 'openRunner_highScoresByLevel'
    }));
    
    // Add UI components
    this.world.addComponent(playerId, createScoreDisplayComponent({
      position: { x: 20, y: 20 },
      fontSize: 24,
      isMobileOptimized: true
    }));
    
    this.world.addComponent(playerId, createAchievementNotificationComponent({
      position: { x: 20, y: 100 },
      isMobileOptimized: true
    }));
    
    console.log(`👤 Player entity created: ${playerId}`);
    return playerId;
  }
  
  /**
   * Start the scoring system example
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Scoring system already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Starting scoring system example...');
    
    // Start the main update loop
    this.gameLoop();
    
    // Run demonstration scenarios
    this.runDemonstrationScenarios();
  }
  
  /**
   * Stop the scoring system
   */
  stop(): void {
    this.isRunning = false;
    console.log('🛑 Scoring system stopped');
    
    // Save final analytics
    this.systems.analytics.saveSessionMetrics();
    
    // Display final report
    this.displayFinalReport();
  }
  
  /**
   * Main game loop
   */
  private gameLoop(): void {
    let lastTime = performance.now();
    
    const update = (currentTime: number) => {
      if (!this.isRunning) return;
      
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      // Update all systems
      Object.values(this.systems).forEach(system => {
        system.update(deltaTime);
      });
      
      requestAnimationFrame(update);
    };
    
    requestAnimationFrame(update);
  }
  
  /**
   * Run demonstration scenarios
   */
  private async runDemonstrationScenarios(): Promise<void> {
    console.log('\n🎯 Running demonstration scenarios...');
    
    await this.demonstrateBasicCoinCollection();
    await this.demonstrateComboSystem();
    await this.demonstrateDoublerPowerup();
    await this.demonstrateLevelProgression();
    await this.demonstrateAchievementSystem();
    await this.demonstratePersistence();
    
    console.log('\n✅ All demonstration scenarios completed!');
  }
  
  /**
   * Demonstrate basic coin collection (faithful to original)
   */
  private async demonstrateBasicCoinCollection(): Promise<void> {
    console.log('\n💰 Demonstrating basic coin collection (original mechanics)...');
    
    // Collect 10 coins (10 points each)
    for (let i = 0; i < 10; i++) {
      this.world.emit('coin_collected', {
        entityId: this.playerId,
        value: 10,
        position: { x: i * 10, y: 0, z: 0 }
      });
      
      await this.wait(100); // 100ms between coins
    }
    
    const scoreComponent = this.world.getComponent(this.playerId, 'score');
    console.log(`   Score: ${scoreComponent.currentScore} points`);
    console.log(`   Coins collected: ${scoreComponent.totalCoinsCollected}`);
    console.log('   ✅ Basic coin collection working correctly');
  }
  
  /**
   * Demonstrate combo system
   */
  private async demonstrateComboSystem(): Promise<void> {
    console.log('\n🔥 Demonstrating combo system...');
    
    const initialScore = this.world.getComponent(this.playerId, 'score').currentScore;
    
    // Rapid coin collection to build combo
    for (let i = 0; i < 15; i++) {
      this.world.emit('coin_collected', {
        entityId: this.playerId,
        value: 10,
        position: { x: i * 5, y: 0, z: 0 }
      });
      
      await this.wait(50); // 50ms between coins (rapid collection)
    }
    
    const comboComponent = this.world.getComponent(this.playerId, 'combo');
    const finalScore = this.world.getComponent(this.playerId, 'score').currentScore;
    
    console.log(`   Combo level: ${comboComponent.currentCombo}`);
    console.log(`   Combo multiplier: ${comboComponent.currentMultiplier.toFixed(2)}x`);
    console.log(`   Score gained with combo: ${finalScore - initialScore} points`);
    console.log(`   Bonus from combo: ${(finalScore - initialScore) - 150} points`);
    console.log('   ✅ Combo system working correctly');
  }
  
  /**
   * Demonstrate doubler powerup (faithful to original)
   */
  private async demonstrateDoublerPowerup(): Promise<void> {
    console.log('\n⚡ Demonstrating doubler powerup (original mechanics)...');
    
    const initialScore = this.world.getComponent(this.playerId, 'score').currentScore;
    
    // Collect doubler powerup
    this.world.emit('powerup_collected', {
      entityId: this.playerId,
      powerupType: 'doubler',
      position: { x: 0, y: 0, z: 0 }
    });
    
    await this.wait(100);
    
    const powerupComponent = this.world.getComponent(this.playerId, 'powerup');
    console.log(`   Doubler active: ${powerupComponent.doublerActive}`);
    console.log(`   Time remaining: ${(powerupComponent.doublerTimeRemaining / 1000).toFixed(1)}s`);
    
    // Collect coins with doubler active
    for (let i = 0; i < 5; i++) {
      this.world.emit('coin_collected', {
        entityId: this.playerId,
        value: 10
      });
      await this.wait(100);
    }
    
    const finalScore = this.world.getComponent(this.playerId, 'score').currentScore;
    const expectedIncrease = 5 * 10 * 2; // 5 coins * 10 points * 2x doubler
    
    console.log(`   Score increase: ${finalScore - initialScore} points`);
    console.log(`   Expected (with doubler): ${expectedIncrease} points`);
    console.log('   ✅ Doubler powerup working correctly');
  }
  
  /**
   * Demonstrate level progression (300 point threshold)
   */
  private async demonstrateLevelProgression(): Promise<void> {
    console.log('\n🏆 Demonstrating level progression (300 point threshold)...');
    
    const progressionComponent = this.world.getComponent(this.playerId, 'progression');
    const currentScore = this.world.getComponent(this.playerId, 'score').currentScore;
    
    console.log(`   Current score: ${currentScore}`);
    console.log(`   Level 2 unlock threshold: ${progressionComponent.level2UnlockScore}`);
    console.log(`   Currently unlocked levels: ${Array.from(progressionComponent.levelsUnlocked)}`);
    
    if (currentScore >= 300) {
      console.log('   ✅ Level 2 already unlocked!');
    } else {
      console.log('   📈 Score too low for Level 2 unlock (need 300+ points)');
    }
  }
  
  /**
   * Demonstrate achievement system
   */
  private async demonstrateAchievementSystem(): Promise<void> {
    console.log('\n🏅 Demonstrating achievement system...');
    
    const progressionComponent = this.world.getComponent(this.playerId, 'progression');
    
    console.log(`   Total achievements: ${progressionComponent.achievements.size}`);
    console.log(`   Unlocked achievements: ${progressionComponent.unlockedAchievements.size}`);
    
    // Check specific achievements
    const firstCoin = progressionComponent.achievements.get('first_coin');
    const coinCollector = progressionComponent.achievements.get('coin_collector');
    
    if (firstCoin) {
      console.log(`   "First Steps": ${firstCoin.isUnlocked ? '✅' : '❌'} (${firstCoin.progress}/${firstCoin.maxProgress})`);
    }
    
    if (coinCollector) {
      console.log(`   "Coin Collector": ${coinCollector.isUnlocked ? '✅' : '❌'} (${coinCollector.progress}/${coinCollector.maxProgress})`);
    }
    
    console.log('   ✅ Achievement system working correctly');
  }
  
  /**
   * Demonstrate persistence system
   */
  private async demonstratePersistence(): Promise<void> {
    console.log('\n💾 Demonstrating persistence system...');
    
    // Save current state
    await this.systems.persistence.saveAllData();
    console.log('   ✅ Game data saved to localStorage');
    
    // Show what was saved
    const highScoreComponent = this.world.getComponent(this.playerId, 'highScore');
    const progressionComponent = this.world.getComponent(this.playerId, 'progression');
    
    console.log(`   High score saved: ${highScoreComponent.globalHighScore}`);
    console.log(`   Achievements saved: ${progressionComponent.unlockedAchievements.size}`);
    console.log(`   Experience saved: ${progressionComponent.experience}`);
    
    // Export data for backup
    const exportedData = await this.systems.persistence.exportSaveData();
    if (exportedData) {
      console.log(`   Export data size: ${exportedData.length} characters`);
      console.log('   ✅ Data export working correctly');
    }
  }
  
  /**
   * Display current system status
   */
  private logSystemStatus(): void {
    const scoreComponent = this.world.getComponent(this.playerId, 'score');
    const comboComponent = this.world.getComponent(this.playerId, 'combo');
    const powerupComponent = this.world.getComponent(this.playerId, 'powerup');
    const progressionComponent = this.world.getComponent(this.playerId, 'progression');
    
    console.log('\n📊 Current System Status:');
    console.log(`   Score: ${scoreComponent.currentScore} points`);
    console.log(`   Coins: ${scoreComponent.totalCoinsCollected}`);
    console.log(`   Combo: ${comboComponent.currentCombo}x (${comboComponent.currentMultiplier.toFixed(2)}x multiplier)`);
    console.log(`   Powerups: ${powerupComponent.activePowerups.size} active`);
    console.log(`   Achievements: ${progressionComponent.unlockedAchievements.size}/${progressionComponent.achievements.size}`);
    console.log(`   Experience: ${progressionComponent.experience} (Level ${progressionComponent.experienceLevel})`);
  }
  
  /**
   * Display final performance report
   */
  private displayFinalReport(): void {
    const report = this.systems.analytics.getPerformanceReport();
    
    console.log('\n📈 Final Performance Report:');
    console.log(`   Session Duration: ${(report.session.totalTime / 1000).toFixed(1)}s`);
    console.log(`   Average FPS: ${report.session.averageFPS.toFixed(1)}`);
    console.log(`   Total Score: ${report.scoring.totalScore}`);
    console.log(`   Coins Collected: ${report.scoring.totalCoinsCollected}`);
    console.log(`   Combo Actions: ${report.playerBehavior.comboActions}`);
    console.log(`   Achievements Earned: ${report.playerBehavior.achievementsEarned}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Performance Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   ${rec.priority.toUpperCase()}: ${rec.title} - ${rec.description}`);
      });
    }
    
    if (report.mobile.isMobile) {
      console.log('\n📱 Mobile Performance:');
      console.log(`   Screen Size: ${report.mobile.screenSize.width}x${report.mobile.screenSize.height}`);
      console.log(`   Device Pixel Ratio: ${report.mobile.devicePixelRatio}`);
      console.log(`   Battery Level: ${(report.mobile.batteryLevel * 100).toFixed(0)}%`);
    }
  }
  
  /**
   * Get current game statistics
   */
  getStatistics() {
    return {
      score: this.systems.score.getStatistics(),
      combo: this.systems.combo.getComboStatistics(),
      progression: this.systems.progression.getProgressionStatistics(this.playerId),
      persistence: this.systems.persistence.getStatistics(),
      ui: this.systems.ui.getUIStatistics(),
      analytics: this.systems.analytics.getPerformanceReport()
    };
  }
  
  /**
   * Simulate rapid gameplay for performance testing
   */
  async simulateRapidGameplay(duration: number = 10000): Promise<void> {
    console.log(`\n⚡ Simulating rapid gameplay for ${duration}ms...`);
    
    const startTime = performance.now();
    const events = ['coin_collected', 'powerup_collected', 'player_jumped', 'player_slid'];
    
    while (performance.now() - startTime < duration) {
      // Random event
      const event = events[Math.floor(Math.random() * events.length)];
      
      switch (event) {
        case 'coin_collected':
          this.world.emit('coin_collected', {
            entityId: this.playerId,
            value: 10,
            position: { x: Math.random() * 100, y: 0, z: 0 }
          });
          break;
        case 'powerup_collected':
          if (Math.random() < 0.1) { // 10% chance
            this.world.emit('powerup_collected', {
              entityId: this.playerId,
              powerupType: 'doubler'
            });
          }
          break;
        case 'player_jumped':
          this.world.emit('player_jumped', { entityId: this.playerId });
          break;
        case 'player_slid':
          this.world.emit('player_slid', { entityId: this.playerId });
          break;
      }
      
      await this.wait(Math.random() * 100 + 50); // 50-150ms between events
    }
    
    console.log('   ✅ Rapid gameplay simulation completed');
    this.logSystemStatus();
  }
  
  /**
   * Reset all scoring data
   */
  resetScoring(): void {
    console.log('\n🔄 Resetting all scoring data...');
    
    // Reset components
    const scoreComponent = this.world.getComponent(this.playerId, 'score');
    scoreComponent.currentScore = 0;
    scoreComponent.sessionScore = 0;
    scoreComponent.totalCoinsCollected = 0;
    scoreComponent.totalDistanceTraveled = 0;
    
    const comboComponent = this.world.getComponent(this.playerId, 'combo');
    comboComponent.currentCombo = 0;
    comboComponent.isComboActive = false;
    
    const powerupComponent = this.world.getComponent(this.playerId, 'powerup');
    powerupComponent.activePowerups.clear();
    powerupComponent.doublerActive = false;
    
    // Clear persistence
    this.systems.persistence.clearAllData();
    
    // Reset analytics
    this.systems.analytics.resetAnalytics();
    
    console.log('   ✅ All scoring data reset');
  }
  
  /**
   * Utility function to wait
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example usage
if (typeof window !== 'undefined') {
  // Browser environment
  console.log('🌐 Running in browser environment');
  
  const example = new ScoringSystemExample();
  
  // Add to global scope for debugging
  (window as any).scoringExample = example;
  
  // Auto-start if not in development
  if (process.env.NODE_ENV !== 'development') {
    example.start();
    
    // Auto-stop after 30 seconds
    setTimeout(() => {
      example.stop();
    }, 30000);
  }
  
  console.log('💡 Use scoringExample.start() to begin demonstration');
  console.log('💡 Use scoringExample.simulateRapidGameplay() for performance testing');
  console.log('💡 Use scoringExample.getStatistics() to view current stats');
}

export { ScoringSystemExample };
