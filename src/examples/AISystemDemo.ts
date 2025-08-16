import type { World } from '@/core/ecs/World';
import { createAIIntegration, EnemyTypes, EnemyStats } from '@/systems/ai';

/**
 * Complete AI System Demo
 * 
 * This demonstrates how to use the complete enemy AI system in Open Runner
 */
export class AISystemDemo {
  private ai: any;
  private world: World;
  private demoEntities: any[] = [];

  constructor(world: World) {
    this.world = world;
    this.ai = createAIIntegration(world);
  }

  /**
   * Initialize and run the AI demo
   */
  async runDemo(): Promise<void> {
    console.log('🎮 Starting AI System Demo');
    console.log('==============================');

    // Initialize the AI system
    this.ai.init();

    // Demo 1: Create individual enemies
    console.log('\n📊 Demo 1: Creating Individual Enemies');
    this.demoIndividualEnemies();

    // Demo 2: Create enemy packs
    console.log('\n📊 Demo 2: Creating Enemy Packs');
    this.demoEnemyPacks();

    // Demo 3: Level-based spawning
    console.log('\n📊 Demo 3: Level-based Enemy Spawning');
    this.demoLevelSpawning();

    // Demo 4: AI behavior testing
    console.log('\n📊 Demo 4: AI Behavior Testing');
    this.demoBehaviorTesting();

    // Demo 5: Performance monitoring
    console.log('\n📊 Demo 5: Performance Monitoring');
    this.demoPerformanceMonitoring();

    // Demo 6: Player interaction
    console.log('\n📊 Demo 6: Player Interaction Events');
    this.demoPlayerInteraction();

    // Run the demo loop
    this.startDemoLoop();
  }

  /**
   * Demo creating individual enemies
   */
  private demoIndividualEnemies(): void {
    console.log('Creating forest enemies...');
    
    // Create a bear
    const bear = this.ai.createEnemies.bear({ x: 50, y: 0, z: 50 });
    this.demoEntities.push(bear);

    // Create a squirrel
    const squirrel = this.ai.createEnemies.squirrel({ x: 70, y: 0, z: 30 });
    this.demoEntities.push(squirrel);

    // Create a deer
    const deer = this.ai.createEnemies.deer({ x: 80, y: 0, z: 60 });
    this.demoEntities.push(deer);

    console.log('Creating desert enemies...');

    // Create a coyote
    const coyote = this.ai.createEnemies.coyote({ x: 150, y: 0, z: 50 });
    this.demoEntities.push(coyote);

    // Create a rattlesnake
    const rattlesnake = this.ai.createEnemies.rattlesnake({ x: 170, y: 0, z: 30 });
    this.demoEntities.push(rattlesnake);

    // Create a scorpion
    const scorpion = this.ai.createEnemies.scorpion({ x: 180, y: 0, z: 70 });
    this.demoEntities.push(scorpion);

    console.log(`✅ Created ${this.demoEntities.length} individual enemies`);
  }

  /**
   * Demo creating enemy packs
   */
  private demoEnemyPacks(): void {
    // Create a coyote pack
    const coyotePack = this.ai.createEnemies.coyotePack({ x: 200, y: 0, z: 100 }, 4);
    this.demoEntities.push(...coyotePack);

    console.log(`✅ Created coyote pack with ${coyotePack.length} members`);
  }

  /**
   * Demo level-based enemy spawning
   */
  private demoLevelSpawning(): void {
    // Simulate forest level config
    const forestLevel = {
      ENEMY_TYPES: ['bear', 'squirrel', 'deer'],
      ENEMY_SPAWN_DENSITY: 0.0002,
      ENEMY_PROPERTIES: {
        'bear': { speed: 8.0, aggroRadius: 40.0, health: 100 },
        'squirrel': { speed: 12.0, aggroRadius: 20.0, health: 30 },
        'deer': { speed: 10.0, aggroRadius: 36.0, health: 60 }
      }
    };

    // Simulate desert level config
    const desertLevel = {
      ENEMY_TYPES: ['coyote', 'rattlesnake', 'scorpion'],
      ENEMY_SPAWN_DENSITY: 0.0003,
      ENEMY_PROPERTIES: {
        'coyote': { speed: 11.0, aggroRadius: 35.0, health: 70 },
        'rattlesnake': { speed: 2.0, aggroRadius: 10.0, health: 40 },
        'scorpion': { speed: 4.0, aggroRadius: 8.0, health: 45 }
      }
    };

    // Spawn enemies for forest level
    const forestEnemies = this.ai.spawnEnemiesForLevel(
      forestLevel,
      { x: 300, y: 0, z: 100 },
      { difficulty: 1.0, maxEnemies: 10 }
    );

    // Spawn enemies for desert level
    const desertEnemies = this.ai.spawnEnemiesForLevel(
      desertLevel,
      { x: 500, y: 0, z: 100 },
      { difficulty: 1.2, maxEnemies: 10 }
    );

    this.demoEntities.push(...forestEnemies, ...desertEnemies);

    console.log(`✅ Spawned ${forestEnemies.length} forest enemies and ${desertEnemies.length} desert enemies`);
  }

  /**
   * Demo AI behavior testing
   */
  private demoBehaviorTesting(): void {
    // Enable debug mode to see AI decisions
    this.ai.debug.setDebugMode(true);

    // Test different difficulty levels
    console.log('Testing difficulty level 0.5 (Easy)');
    this.ai.setDifficulty(0.5);

    setTimeout(() => {
      console.log('Testing difficulty level 1.5 (Hard)');
      this.ai.setDifficulty(1.5);
    }, 5000);

    setTimeout(() => {
      console.log('Returning to normal difficulty');
      this.ai.setDifficulty(1.0);
    }, 10000);

    console.log('✅ Behavior testing initialized');
  }

  /**
   * Demo performance monitoring
   */
  private demoPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = this.ai.debug.getPerformanceMetrics();
      const enemyStats = this.ai.debug.getEnemyStats();

      console.log('📊 Performance Metrics:');
      console.log(`  Update time: ${metrics.averageUpdateTime.toFixed(2)}ms`);
      console.log(`  Total entities: ${metrics.totalEntities}`);
      console.log(`  Active entities: ${metrics.activeEntities}`);
      console.log('  Enemy counts:', enemyStats);
    }, 10000); // Log every 10 seconds

    console.log('✅ Performance monitoring started');
  }

  /**
   * Demo player interaction events
   */
  private demoPlayerInteraction(): void {
    // Test invisibility powerup
    setTimeout(() => {
      console.log('🔮 Testing invisibility powerup');
      this.ai.handlePlayerEvents.invisibility(true, 5);
    }, 3000);

    // Test game pause
    setTimeout(() => {
      console.log('⏸️ Testing game pause');
      this.ai.handlePlayerEvents.pause(true);
      
      setTimeout(() => {
        console.log('▶️ Resuming game');
        this.ai.handlePlayerEvents.pause(false);
      }, 2000);
    }, 15000);

    console.log('✅ Player interaction demo scheduled');
  }

  /**
   * Start the main demo loop
   */
  private startDemoLoop(): void {
    let lastTime = performance.now();
    
    const loop = () => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update the AI system
      this.ai.update(deltaTime);

      // Continue the loop
      requestAnimationFrame(loop);
    };

    console.log('🔄 Starting AI demo loop');
    loop();
  }

  /**
   * Get demo statistics
   */
  getDemoStats(): any {
    return {
      totalEnemiesCreated: this.demoEntities.length,
      systemStatus: this.ai.getSystemStatus(),
      aiStates: this.ai.debug.getAIStates(),
      enemyStats: this.ai.debug.getEnemyStats()
    };
  }

  /**
   * Clean up the demo
   */
  cleanup(): void {
    console.log('🧹 Cleaning up AI demo');
    this.ai.debug.clearAllEnemies();
    this.ai.destroy();
    this.demoEntities = [];
  }
}

/**
 * Usage examples for the AI system
 */
export const AIExamples = {
  // Basic usage
  basic: `
    const world = new World();
    const ai = createAIIntegration(world);
    ai.init();
    
    // Create enemies
    const bear = ai.createEnemies.bear({ x: 100, y: 0, z: 50 });
    const pack = ai.createEnemies.coyotePack({ x: 200, y: 0, z: 100 }, 3);
    
    // Game loop
    function update(deltaTime) {
      ai.update(deltaTime);
    }
  `,

  // Level integration
  levelIntegration: `
    // In your level loading code
    const enemies = ai.spawnEnemiesForLevel(
      levelConfig,
      playerPosition,
      { 
        difficulty: gameState.difficulty,
        maxEnemies: 25 
      }
    );
  `,

  // Powerup integration
  powerupIntegration: `
    // When player collects invisibility powerup
    onInvisibilityCollected(duration) {
      ai.handlePlayerEvents.invisibility(true, duration);
    }
    
    // When game is paused
    onGamePause(paused) {
      ai.handlePlayerEvents.pause(paused);
    }
  `,

  // Performance monitoring
  performanceMonitoring: `
    // Monitor AI performance
    const metrics = ai.debug.getPerformanceMetrics();
    if (metrics.averageUpdateTime > 16.67) {
      console.warn('AI performance issues detected');
    }
    
    // Log AI states for debugging
    ai.debug.logStatus();
  `
};

// Export the demo class
export { AISystemDemo };