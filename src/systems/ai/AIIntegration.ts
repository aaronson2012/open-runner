import type { World } from '@/core/ecs/World';
import type { Entity, Vector3 } from '@/types';
import { AISystemManager } from './AISystemManager';
import { EnemyFactory, EnemyTypes, EnemyStats } from './EnemyFactory';

/**
 * AI Integration provides easy-to-use methods for integrating the AI system into the game
 */
export class AIIntegration {
  private aiManager: AISystemManager;
  private world: World;
  private isInitialized = false;

  constructor(world: World) {
    this.world = world;
    this.aiManager = new AISystemManager(world);
  }

  /**
   * Initialize the AI system
   */
  init(): void {
    if (this.isInitialized) return;
    
    console.log('🤖 Initializing AI System...');
    
    // AI system is already initialized in the manager
    this.isInitialized = true;
    
    console.log('✅ AI System initialized successfully');
    console.log(`📊 Available enemy types:`, EnemyTypes.ALL);
    console.log(`⚡ Enemy stats:`, EnemyStats);
  }

  /**
   * Update the AI system (call this every frame)
   */
  update(deltaTime: number): void {
    if (!this.isInitialized) return;
    
    this.aiManager.update(deltaTime);
  }

  /**
   * Spawn enemies for a level using the level configuration
   */
  spawnEnemiesForLevel(
    levelConfig: any,
    playerPosition: Vector3,
    options: {
      chunkSize?: number;
      difficulty?: number;
      maxEnemies?: number;
    } = {}
  ): Entity[] {
    const {
      chunkSize = 100,
      difficulty = 1.0,
      maxEnemies = 32
    } = options;

    console.log(`🐺 Spawning enemies for level at position (${playerPosition.x.toFixed(1)}, ${playerPosition.z.toFixed(1)})`);
    
    const enemies = this.aiManager.spawnEnemiesForLevel(levelConfig, playerPosition, chunkSize);
    
    // Apply difficulty scaling
    if (difficulty !== 1.0) {
      this.aiManager.setDifficulty(difficulty);
    }
    
    console.log(`✅ Spawned ${enemies.length} enemies`);
    return enemies.slice(0, maxEnemies);
  }

  /**
   * Create specific enemy types manually
   */
  createEnemies = {
    // Forest enemies
    bear: (position: Vector3, options?: any) => {
      console.log(`🐻 Creating bear at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.aiManager.createEnemy('bear', position, {
        biome: 'forest',
        customProperties: {
          territorialRadius: 25.0,
          aggressionLevel: 0.8
        },
        ...options
      });
    },

    squirrel: (position: Vector3, options?: any) => {
      console.log(`🐿️ Creating squirrel at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.aiManager.createEnemy('squirrel', position, {
        biome: 'forest',
        customProperties: {
          flightDistance: 30.0,
          alertnessLevel: 0.9
        },
        ...options
      });
    },

    deer: (position: Vector3, options?: any) => {
      console.log(`🦌 Creating deer at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.aiManager.createEnemy('deer', position, {
        biome: 'forest',
        customProperties: {
          flockBehavior: true,
          flightThreshold: 20.0
        },
        ...options
      });
    },

    // Desert enemies
    coyote: (position: Vector3, options?: any) => {
      console.log(`🐺 Creating coyote at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.aiManager.createEnemy('coyote', position, {
        biome: 'desert',
        customProperties: {
          packHunter: true,
          coordinationRange: 50.0
        },
        ...options
      });
    },

    rattlesnake: (position: Vector3, options?: any) => {
      console.log(`🐍 Creating rattlesnake at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.aiManager.createEnemy('rattlesnake', position, {
        biome: 'desert',
        customProperties: {
          ambushPredator: true,
          strikeRange: 2.5
        },
        ...options
      });
    },

    scorpion: (position: Vector3, options?: any) => {
      console.log(`🦂 Creating scorpion at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.aiManager.createEnemy('scorpion', position, {
        biome: 'desert',
        customProperties: {
          burrowBehavior: true,
          territorialRange: 12.0
        },
        ...options
      });
    },

    // Pack creation
    coyotePack: (centerPosition: Vector3, packSize: number = 3, options?: any) => {
      console.log(`🐺🐺 Creating coyote pack of ${packSize} at (${centerPosition.x.toFixed(1)}, ${centerPosition.z.toFixed(1)})`);
      return this.aiManager.createEnemyPack('coyote', centerPosition, packSize, {
        biome: 'desert',
        packFormation: 'wedge',
        ...options
      });
    }
  };

  /**
   * Game event handlers for powerups and player actions
   */
  handlePlayerEvents = {
    // Handle invisibility powerup
    invisibility: (active: boolean, duration?: number) => {
      console.log(active ? '👻 Player became invisible' : '👁️ Player visibility restored');
      this.aiManager.setPlayerInvisible(active, duration);
    },

    // Handle player death
    death: () => {
      console.log('💀 Player died - pausing AI');
      this.aiManager.setAIPaused(true);
    },

    // Handle game pause
    pause: (paused: boolean) => {
      console.log(paused ? '⏸️ Game paused - pausing AI' : '▶️ Game resumed - resuming AI');
      this.aiManager.setAIPaused(paused);
    },

    // Handle level completion
    levelComplete: () => {
      console.log('🏁 Level completed - clearing enemies');
      this.aiManager.clearAllEnemies();
    }
  };

  /**
   * Difficulty and game balance
   */
  setDifficulty(level: number): void {
    console.log(`⚖️ Setting AI difficulty to ${level}`);
    this.aiManager.setDifficulty(level);
  }

  /**
   * Debug and development tools
   */
  debug = {
    // Enable/disable AI debugging
    setDebugMode: (enabled: boolean) => {
      console.log(enabled ? '🔍 AI debugging enabled' : '🔍 AI debugging disabled');
      this.aiManager.setDebugMode(enabled);
    },

    // Get AI performance metrics
    getPerformanceMetrics: () => {
      return this.aiManager.getPerformanceMetrics();
    },

    // Get AI state information
    getAIStates: () => {
      return this.aiManager.getAIStateInfo();
    },

    // Get enemy count by type
    getEnemyStats: () => {
      const stats: Record<string, number> = {};
      for (const enemyType of EnemyTypes.ALL) {
        stats[enemyType] = this.aiManager.getEnemiesByType(enemyType).length;
      }
      return stats;
    },

    // Clear all enemies
    clearAllEnemies: () => {
      console.log('🧹 Clearing all enemies');
      this.aiManager.clearAllEnemies();
    },

    // Log system status
    logStatus: () => {
      const metrics = this.aiManager.getPerformanceMetrics();
      const states = this.aiManager.getAIStateInfo();
      
      console.log('📊 AI System Status:');
      console.log(`  Total entities: ${metrics.totalAIEntities}`);
      console.log(`  Active entities: ${metrics.activeAIEntities}`);
      console.log(`  Average update time: ${metrics.averageUpdateTime.toFixed(2)}ms`);
      console.log(`  Enemy count: ${metrics.enemyCount}`);
      
      const stateCount: Record<string, number> = {};
      states.forEach(state => {
        stateCount[state.aiState] = (stateCount[state.aiState] || 0) + 1;
      });
      
      console.log('  AI States:', stateCount);
    }
  };

  /**
   * Integration with legacy Open Runner enemy system
   */
  migrateLegacyEnemies(legacyEnemies: any[]): Entity[] {
    console.log(`🔄 Migrating ${legacyEnemies.length} legacy enemies to new AI system`);
    
    const newEnemies: Entity[] = [];
    
    for (const legacyEnemy of legacyEnemies) {
      try {
        const position = {
          x: legacyEnemy.position?.x || 0,
          y: legacyEnemy.position?.y || 0,
          z: legacyEnemy.position?.z || 0
        };
        
        const enemyType = this.mapLegacyEnemyType(legacyEnemy.type || legacyEnemy.enemyType);
        
        const newEnemy = this.aiManager.createEnemy(enemyType, position, {
          customProperties: {
            health: legacyEnemy.health,
            moveSpeed: legacyEnemy.speed || legacyEnemy.moveSpeed,
            aggroRadius: legacyEnemy.aggroRadius,
            roamingRadius: legacyEnemy.roamingRadius
          }
        });
        
        newEnemies.push(newEnemy);
      } catch (error) {
        console.warn('Failed to migrate legacy enemy:', error);
      }
    }
    
    console.log(`✅ Successfully migrated ${newEnemies.length} enemies`);
    return newEnemies;
  }

  /**
   * Get system status for UI display
   */
  getSystemStatus(): {
    isActive: boolean;
    enemyCount: number;
    performance: any;
    debugMode: boolean;
  } {
    const metrics = this.aiManager.getPerformanceMetrics();
    
    return {
      isActive: this.isInitialized,
      enemyCount: metrics.enemyCount,
      performance: {
        totalEntities: metrics.totalAIEntities,
        activeEntities: metrics.activeAIEntities,
        averageUpdateTime: metrics.averageUpdateTime,
        systemTimes: metrics.systemUpdateTimes
      },
      debugMode: false // Would need to track this separately
    };
  }

  /**
   * Clean up the AI system
   */
  destroy(): void {
    if (!this.isInitialized) return;
    
    console.log('🗑️ Destroying AI system');
    this.aiManager.clearAllEnemies();
    this.isInitialized = false;
  }

  // Private helper methods
  private mapLegacyEnemyType(legacyType: string): string {
    const mapping: Record<string, string> = {
      'bear': 'bear',
      'squirrel': 'squirrel',
      'deer': 'deer',
      'coyote': 'coyote',
      'rattlesnake': 'rattlesnake',
      'snake': 'rattlesnake',
      'scorpion': 'scorpion'
    };
    
    return mapping[legacyType.toLowerCase()] || 'bear';
  }
}

// Export convenience function
export function createAIIntegration(world: World): AIIntegration {
  return new AIIntegration(world);
}

// Export usage example for documentation
export const AIUsageExample = {
  // Basic setup
  setup: `
    const world = new World();
    const ai = createAIIntegration(world);
    ai.init();
  `,

  // Update loop
  gameLoop: `
    function gameLoop(deltaTime: number) {
      ai.update(deltaTime);
    }
  `,

  // Spawn enemies for level
  spawnForLevel: `
    const enemies = ai.spawnEnemiesForLevel(
      levelConfig,
      playerPosition,
      { difficulty: 1.2, maxEnemies: 20 }
    );
  `,

  // Create specific enemies
  createSpecific: `
    const bear = ai.createEnemies.bear({ x: 100, y: 0, z: 50 });
    const coyotePack = ai.createEnemies.coyotePack({ x: 200, y: 0, z: 100 }, 4);
  `,

  // Handle powerups
  powerups: `
    // Invisibility powerup
    ai.handlePlayerEvents.invisibility(true, 10); // 10 seconds
    
    // Game pause
    ai.handlePlayerEvents.pause(true);
  `,

  // Debug tools
  debugging: `
    ai.debug.setDebugMode(true);
    const metrics = ai.debug.getPerformanceMetrics();
    const states = ai.debug.getAIStates();
    ai.debug.logStatus();
  `
};

// Export system constants
export const AIConstants = {
  DEFAULT_CHUNK_SIZE: 100,
  MAX_ENEMIES_PER_CHUNK: 8,
  SPAWN_DISTANCE: 150,
  DESPAWN_DISTANCE: 300,
  PERFORMANCE_TARGET_MS: 16.67, // 60 FPS
  
  // Enemy behavior constants
  ENEMY_BEHAVIOR: {
    BEAR: { territorial: true, aggressive: true, packHunter: false },
    SQUIRREL: { territorial: false, aggressive: false, packHunter: false },
    DEER: { territorial: false, aggressive: false, packHunter: true },
    COYOTE: { territorial: false, aggressive: true, packHunter: true },
    RATTLESNAKE: { territorial: true, aggressive: true, packHunter: false },
    SCORPION: { territorial: true, aggressive: true, packHunter: false }
  }
} as const;