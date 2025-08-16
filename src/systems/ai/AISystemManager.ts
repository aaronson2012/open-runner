import type { World } from '@/core/ecs/World';
import type { Entity, Vector3 } from '@/types';
import { AISystem } from './AISystem';
import { AggroSystem } from './AggroSystem';
import { NavigationSystem } from './NavigationSystem';
import { PatrolSystem } from './PatrolSystem';
import { EnemyFactory, EnemyTypes, EnemyStats } from './EnemyFactory';

/**
 * AI System Manager coordinates all AI-related systems and provides a unified interface
 */
export class AISystemManager {
  private world: World;
  private aiSystem: AISystem;
  private aggroSystem: AggroSystem;
  private navigationSystem: NavigationSystem;
  private patrolSystem: PatrolSystem;
  private enemyFactory: EnemyFactory;
  
  // Performance tracking
  private performanceMetrics = {
    totalAIEntities: 0,
    activeAIEntities: 0,
    systemUpdateTimes: new Map<string, number>(),
    lastOptimizationTime: 0,
    optimizationInterval: 5.0 // Optimize every 5 seconds
  };
  
  // AI spawning parameters
  private spawnConfig = {
    maxEnemiesPerChunk: 8,
    spawnDistance: 150, // Spawn enemies within this distance
    despawnDistance: 300, // Remove enemies beyond this distance
    spawnCooldown: 2.0, // Seconds between spawn checks
    lastSpawnTime: 0
  };

  constructor(world: World) {
    this.world = world;
    
    // Initialize all AI systems
    this.aiSystem = new AISystem();
    this.aggroSystem = new AggroSystem();
    this.navigationSystem = new NavigationSystem();
    this.patrolSystem = new PatrolSystem();
    this.enemyFactory = new EnemyFactory(world);
    
    // Initialize systems with world
    this.aiSystem.init(world);
    this.aggroSystem.init(world);
    this.navigationSystem.init(world);
    this.patrolSystem.init(world);
  }

  /**
   * Update all AI systems
   */
  update(deltaTime: number): void {
    const startTime = performance.now();
    
    // Get all entities that need AI processing
    const entities = this.getAIEntities();
    this.performanceMetrics.totalAIEntities = entities.length;
    this.performanceMetrics.activeAIEntities = entities.filter(this.isEntityActive).length;
    
    // Update systems in priority order
    this.updateSystemWithMetrics('aggro', () => this.aggroSystem.update(deltaTime, entities));
    this.updateSystemWithMetrics('ai', () => this.aiSystem.update(deltaTime, entities));
    this.updateSystemWithMetrics('navigation', () => this.navigationSystem.update(deltaTime, entities));
    this.updateSystemWithMetrics('patrol', () => this.patrolSystem.update(deltaTime, entities));
    
    // Handle AI spawning and cleanup
    this.handleAISpawning(deltaTime);
    
    // Performance optimization
    this.optimizePerformance(deltaTime);
    
    const totalTime = performance.now() - startTime;
    this.performanceMetrics.systemUpdateTimes.set('total', totalTime);
  }

  /**
   * Spawn enemies based on level configuration and player position
   */
  spawnEnemiesForLevel(
    levelConfig: any,
    playerPosition: Vector3,
    chunkSize: number = 100
  ): Entity[] {
    const enemies: Entity[] = [];
    
    // Calculate chunk positions around player
    const chunksToProcess = this.getChunksAroundPlayer(playerPosition, chunkSize);
    
    for (const chunkPos of chunksToProcess) {
      // Check if this chunk already has enemies
      if (this.hasEnemiesInChunk(chunkPos, chunkSize)) continue;
      
      // Create enemies for this chunk
      const chunkEnemies = this.enemyFactory.createEnemiesFromLevelConfig(
        levelConfig,
        chunkPos,
        chunkSize
      );
      
      enemies.push(...chunkEnemies);
      
      // Limit total enemies to prevent performance issues
      if (enemies.length > this.spawnConfig.maxEnemiesPerChunk * 4) break;
    }
    
    return enemies;
  }

  /**
   * Create specific enemy types
   */
  createEnemy(
    enemyType: string,
    position: Vector3,
    options: any = {}
  ): Entity {
    return this.enemyFactory.createEnemy(enemyType, position, options);
  }

  /**
   * Create enemy packs
   */
  createEnemyPack(
    enemyType: string,
    centerPosition: Vector3,
    count: number,
    options: any = {}
  ): Entity[] {
    return this.enemyFactory.createEnemyPack(enemyType, centerPosition, count, 15.0, options);
  }

  /**
   * Get AI performance metrics
   */
  getPerformanceMetrics(): any {
    return {
      ...this.performanceMetrics,
      systemUpdateTimes: Object.fromEntries(this.performanceMetrics.systemUpdateTimes),
      averageUpdateTime: this.calculateAverageUpdateTime(),
      enemyCount: this.enemyFactory.getAllEnemies().length
    };
  }

  /**
   * Configure AI difficulty
   */
  setDifficulty(level: number): void {
    const entities = this.getAIEntities();
    
    for (const entity of entities) {
      const ai = entity.components.get('ai') as any;
      const enemy = entity.components.get('enemy') as any;
      
      if (ai && enemy) {
        // Adjust AI parameters based on difficulty
        this.adjustAIForDifficulty(ai, enemy, level);
      }
    }
  }

  /**
   * Enable/disable AI debugging
   */
  setDebugMode(enabled: boolean): void {
    const entities = this.getAIEntities();
    
    for (const entity of entities) {
      const ai = entity.components.get('ai') as any;
      const aggro = entity.components.get('aggro') as any;
      const navigation = entity.components.get('navigation') as any;
      const patrol = entity.components.get('patrol') as any;
      
      if (ai) ai.debugMode = enabled;
      if (aggro) aggro.debugVisualization.enabled = enabled;
      if (navigation) navigation.debugVisualization.enabled = enabled;
      if (patrol) patrol.debugVisualization.enabled = enabled;
    }
  }

  /**
   * Pause/resume all AI
   */
  setAIPaused(paused: boolean): void {\n    const entities = this.getAIEntities();\n    \n    for (const entity of entities) {\n      const ai = entity.components.get('ai') as any;\n      if (ai) {\n        ai.thinkingEnabled = !paused;\n      }\n    }\n  }

  /**\n   * Get all enemies by type\n   */\n  getEnemiesByType(enemyType: string): Entity[] {\n    return this.enemyFactory.getEnemiesByType(enemyType);\n  }

  /**\n   * Remove all enemies\n   */\n  clearAllEnemies(): void {\n    this.enemyFactory.removeAllEnemies();\n  }

  /**\n   * Handle player invisibility powerup\n   */\n  setPlayerInvisible(invisible: boolean, duration?: number): void {\n    // This would integrate with the powerup system\n    // For now, we'll adjust enemy detection capabilities\n    const entities = this.getAIEntities();\n    \n    for (const entity of entities) {\n      const aggro = entity.components.get('aggro') as any;\n      const enemy = entity.components.get('enemy') as any;\n      \n      if (aggro && enemy) {\n        if (invisible) {\n          // Reduce detection capabilities (except rattlesnakes)\n          if (enemy.enemyType !== 'rattlesnake') {\n            aggro.sightDetection.accuracy *= 0.1;\n            aggro.movementDetection.sensitivity *= 0.2;\n          }\n        } else {\n          // Restore normal detection\n          this.restoreNormalDetection(aggro, enemy.enemyType);\n        }\n      }\n    }\n    \n    // Auto-restore after duration\n    if (invisible && duration) {\n      setTimeout(() => {\n        this.setPlayerInvisible(false);\n      }, duration * 1000);\n    }\n  }

  /**\n   * Get enemy AI state information (for debugging)\n   */\n  getAIStateInfo(): any[] {\n    const entities = this.getAIEntities();\n    const stateInfo: any[] = [];\n    \n    for (const entity of entities) {\n      const ai = entity.components.get('ai') as any;\n      const enemy = entity.components.get('enemy') as any;\n      const transform = entity.components.get('transform') as any;\n      const aggro = entity.components.get('aggro') as any;\n      \n      if (ai && enemy && transform) {\n        stateInfo.push({\n          id: entity.id,\n          type: enemy.enemyType,\n          position: transform.position,\n          aiState: ai.currentState,\n          aggroLevel: aggro?.aggroLevel || 0,\n          health: enemy.health,\n          isActive: enemy.isActive,\n          lastDecision: ai.currentDecision?.action || 'none'\n        });\n      }\n    }\n    \n    return stateInfo;\n  }

  // Private methods\n  private getAIEntities(): Entity[] {\n    return this.world.getEntitiesWithComponent('ai');\n  }

  private isEntityActive(entity: Entity): boolean {\n    const enemy = entity.components.get('enemy') as any;\n    return enemy ? enemy.isActive && !enemy.isDead : false;\n  }

  private updateSystemWithMetrics(systemName: string, updateFn: () => void): void {\n    const startTime = performance.now();\n    updateFn();\n    const endTime = performance.now();\n    this.performanceMetrics.systemUpdateTimes.set(systemName, endTime - startTime);\n  }

  private handleAISpawning(deltaTime: number): void {\n    const currentTime = Date.now() / 1000;\n    \n    if (currentTime - this.spawnConfig.lastSpawnTime < this.spawnConfig.spawnCooldown) {\n      return;\n    }\n    \n    this.spawnConfig.lastSpawnTime = currentTime;\n    \n    // Find player position\n    const playerEntities = this.world.getEntitiesWithComponent('playerController');\n    if (playerEntities.length === 0) return;\n    \n    const playerTransform = playerEntities[0].components.get('transform') as any;\n    if (!playerTransform) return;\n    \n    // Clean up distant enemies\n    this.cleanupDistantEnemies(playerTransform.position);\n  }

  private cleanupDistantEnemies(playerPosition: Vector3): void {\n    const enemies = this.enemyFactory.getAllEnemies();\n    \n    for (const enemy of enemies) {\n      const transform = enemy.components.get('transform') as any;\n      if (!transform) continue;\n      \n      const distance = this.calculateDistance(playerPosition, transform.position);\n      if (distance > this.spawnConfig.despawnDistance) {\n        this.enemyFactory.removeEnemy(enemy);\n      }\n    }\n  }

  private getChunksAroundPlayer(playerPosition: Vector3, chunkSize: number): Vector3[] {\n    const chunks: Vector3[] = [];\n    const chunkRadius = 2; // Load 2 chunks in each direction\n    \n    for (let x = -chunkRadius; x <= chunkRadius; x++) {\n      for (let z = -chunkRadius; z <= chunkRadius; z++) {\n        chunks.push({\n          x: Math.floor(playerPosition.x / chunkSize) * chunkSize + x * chunkSize,\n          y: playerPosition.y,\n          z: Math.floor(playerPosition.z / chunkSize) * chunkSize + z * chunkSize\n        });\n      }\n    }\n    \n    return chunks;\n  }

  private hasEnemiesInChunk(chunkPosition: Vector3, chunkSize: number): boolean {\n    const enemies = this.enemyFactory.getAllEnemies();\n    \n    for (const enemy of enemies) {\n      const transform = enemy.components.get('transform') as any;\n      if (!transform) continue;\n      \n      const dx = Math.abs(transform.position.x - chunkPosition.x);\n      const dz = Math.abs(transform.position.z - chunkPosition.z);\n      \n      if (dx < chunkSize / 2 && dz < chunkSize / 2) {\n        return true;\n      }\n    }\n    \n    return false;\n  }

  private optimizePerformance(deltaTime: number): void {\n    const currentTime = Date.now() / 1000;\n    \n    if (currentTime - this.performanceMetrics.lastOptimizationTime < this.performanceMetrics.optimizationInterval) {\n      return;\n    }\n    \n    this.performanceMetrics.lastOptimizationTime = currentTime;\n    \n    // Adjust AI update frequencies based on performance\n    const averageUpdateTime = this.calculateAverageUpdateTime();\n    const targetUpdateTime = 16.67; // 60 FPS target\n    \n    if (averageUpdateTime > targetUpdateTime) {\n      this.reduceAIComplexity();\n    } else if (averageUpdateTime < targetUpdateTime * 0.5) {\n      this.increaseAIComplexity();\n    }\n  }

  private calculateAverageUpdateTime(): number {\n    const times = Array.from(this.performanceMetrics.systemUpdateTimes.values());\n    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;\n  }

  private reduceAIComplexity(): void {\n    const entities = this.getAIEntities();\n    \n    for (const entity of entities) {\n      const ai = entity.components.get('ai') as any;\n      const aggro = entity.components.get('aggro') as any;\n      const navigation = entity.components.get('navigation') as any;\n      \n      if (ai) ai.thinkingFrequency = Math.max(2, ai.thinkingFrequency * 0.8);\n      if (aggro) aggro.detectionFrequency = Math.max(1, aggro.detectionFrequency * 0.8);\n      if (navigation) navigation.performance.updateFrequency = Math.max(2, navigation.performance.updateFrequency * 0.8);\n    }\n  }

  private increaseAIComplexity(): void {\n    const entities = this.getAIEntities();\n    \n    for (const entity of entities) {\n      const ai = entity.components.get('ai') as any;\n      const aggro = entity.components.get('aggro') as any;\n      const navigation = entity.components.get('navigation') as any;\n      \n      if (ai) ai.thinkingFrequency = Math.min(15, ai.thinkingFrequency * 1.1);\n      if (aggro) aggro.detectionFrequency = Math.min(10, aggro.detectionFrequency * 1.1);\n      if (navigation) navigation.performance.updateFrequency = Math.min(15, navigation.performance.updateFrequency * 1.1);\n    }\n  }

  private adjustAIForDifficulty(ai: any, enemy: any, difficultyLevel: number): void {\n    const multiplier = 0.5 + (difficultyLevel * 0.5); // 0.5 to 1.5 multiplier\n    \n    ai.aggressiveness = Math.min(1.0, ai.aggressiveness * multiplier);\n    ai.alertness = Math.min(1.0, ai.alertness * multiplier);\n    ai.intelligence = Math.min(1.0, ai.intelligence * multiplier);\n    ai.reactionTime = Math.max(0.1, ai.reactionTime / multiplier);\n    \n    enemy.biomeModifiers.speedMultiplier *= multiplier;\n    enemy.biomeModifiers.aggroMultiplier *= multiplier;\n    enemy.biomeModifiers.damageMultiplier *= multiplier;\n  }

  private restoreNormalDetection(aggro: any, enemyType: string): void {\n    // Restore default detection values based on enemy type\n    switch (enemyType) {\n      case 'bear':\n        aggro.sightDetection.accuracy = 0.6;\n        aggro.movementDetection.sensitivity = 0.6;\n        break;\n      case 'squirrel':\n        aggro.sightDetection.accuracy = 0.9;\n        aggro.movementDetection.sensitivity = 0.6;\n        break;\n      case 'deer':\n        aggro.sightDetection.accuracy = 0.7;\n        aggro.movementDetection.sensitivity = 0.6;\n        break;\n      case 'coyote':\n        aggro.sightDetection.accuracy = 0.8;\n        aggro.movementDetection.sensitivity = 0.6;\n        break;\n      case 'rattlesnake':\n        aggro.sightDetection.accuracy = 0.4;\n        aggro.movementDetection.sensitivity = 0.9;\n        break;\n      case 'scorpion':\n        aggro.sightDetection.accuracy = 0.5;\n        aggro.movementDetection.sensitivity = 0.6;\n        break;\n    }\n  }

  private calculateDistance(pos1: Vector3, pos2: Vector3): number {\n    const dx = pos1.x - pos2.x;\n    const dy = pos1.y - pos2.y;\n    const dz = pos1.z - pos2.z;\n    return Math.sqrt(dx * dx + dy * dy + dz * dz);\n  }\n}\n\n// Export convenience function\nexport function createAISystemManager(world: World): AISystemManager {\n  return new AISystemManager(world);\n}