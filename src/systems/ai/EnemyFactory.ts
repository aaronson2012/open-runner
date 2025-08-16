import type { Entity, Vector3, EntityId } from '@/types';
import type { World } from '@/core/ecs/World';
import { createEnemyComponent, createEnemyFromLevelConfig } from '@/components/ai/EnemyComponent';
import { createAIForEnemyType } from '@/components/ai/AIComponent';
import { createAggroForEnemyType } from '@/components/ai/AggroComponent';
import { createNavigationForEnemyType } from '@/components/ai/NavigationComponent';
import { createPatrolForEnemyType } from '@/components/ai/PatrolComponent';
import { createTransformComponent } from '@/components/core/CoreComponents';

/**
 * Factory for creating complete enemy entities with all AI components
 */
export class EnemyFactory {
  private world: World;
  private entityIdCounter = 1000; // Start enemy IDs at 1000
  
  constructor(world: World) {
    this.world = world;
  }

  /**
   * Create a complete enemy entity with all AI components
   */
  createEnemy(
    enemyType: string,
    position: Vector3,
    options: {
      level?: string;
      biome?: string;
      difficultyMultiplier?: number;
      groupId?: string;
      isLeader?: boolean;
      customProperties?: any;
    } = {}
  ): Entity {
    const entityId = this.generateEntityId();
    
    // Create base enemy component
    const enemy = this.createEnemyComponentForType(enemyType, position, options);
    enemy.entityId = entityId;
    
    // Create transform component
    const transform = createTransformComponent({
      position: { ...position },
      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }, // Random initial rotation
      scale: { x: 1, y: 1, z: 1 }
    });
    transform.entityId = entityId;
    
    // Create AI component
    const ai = createAIForEnemyType(enemyType);
    ai.entityId = entityId;
    
    // Adjust AI based on difficulty
    if (options.difficultyMultiplier) {
      this.adjustAIForDifficulty(ai, options.difficultyMultiplier);
    }
    
    // Create aggro component
    const aggro = createAggroForEnemyType(enemyType);
    aggro.entityId = entityId;
    
    // Create navigation component
    const navigation = createNavigationForEnemyType(enemyType);
    navigation.entityId = entityId;
    
    // Create patrol component
    const patrol = createPatrolForEnemyType(enemyType, position);
    patrol.entityId = entityId;
    
    // Configure group behavior
    if (options.groupId) {
      this.configureGroupBehavior(ai, aggro, patrol, options.groupId, options.isLeader || false);
    }
    
    // Apply biome modifiers
    if (options.biome) {
      this.applyBiomeModifiers(enemy, ai, aggro, options.biome);
    }
    
    // Create the entity
    const entity: Entity = {
      id: entityId,
      components: new Map([
        ['enemy', enemy],
        ['transform', transform],
        ['ai', ai],
        ['aggro', aggro],
        ['navigation', navigation],
        ['patrol', patrol]
      ])
    };
    
    // Add to world
    this.world.addEntity(entity);
    
    return entity;
  }

  /**
   * Create multiple enemies of the same type (useful for packs)
   */
  createEnemyPack(
    enemyType: string,
    centerPosition: Vector3,
    count: number,
    packRadius: number = 15.0,
    options: {
      level?: string;
      biome?: string;
      difficultyMultiplier?: number;
      packFormation?: 'random' | 'circle' | 'line';
    } = {}
  ): Entity[] {
    const enemies: Entity[] = [];
    const groupId = `pack_${enemyType}_${Date.now()}`;
    
    for (let i = 0; i < count; i++) {
      let position: Vector3;
      
      // Generate position based on formation
      switch (options.packFormation) {
        case 'circle':
          const angle = (i / count) * Math.PI * 2;
          position = {
            x: centerPosition.x + Math.cos(angle) * packRadius,
            y: centerPosition.y,
            z: centerPosition.z + Math.sin(angle) * packRadius
          };
          break;
        case 'line':
          position = {
            x: centerPosition.x + (i - count / 2) * (packRadius / count),
            y: centerPosition.y,
            z: centerPosition.z
          };
          break;
        default: // 'random'
          const randomAngle = Math.random() * Math.PI * 2;
          const randomRadius = Math.random() * packRadius;
          position = {
            x: centerPosition.x + Math.cos(randomAngle) * randomRadius,
            y: centerPosition.y,
            z: centerPosition.z + Math.sin(randomAngle) * randomRadius
          };
          break;
      }
      
      const enemy = this.createEnemy(enemyType, position, {
        ...options,
        groupId,
        isLeader: i === 0 // First enemy is the leader
      });
      
      enemies.push(enemy);
    }
    
    return enemies;\n  }

  /**
   * Create enemies from level configuration
   */
  createEnemiesFromLevelConfig(
    levelConfig: any,
    chunkPosition: Vector3,
    chunkSize: number = 100
  ): Entity[] {\n    const enemies: Entity[] = [];
    \n    if (!levelConfig.ENEMY_TYPES || !levelConfig.ENEMY_PROPERTIES) {\n      return enemies;\n    }
    \n    for (const enemyType of levelConfig.ENEMY_TYPES) {\n      const properties = levelConfig.ENEMY_PROPERTIES[enemyType];\n      if (!properties) continue;\n      \n      // Calculate number of enemies to spawn in this chunk\n      const density = levelConfig.ENEMY_SPAWN_DENSITY || 0.0001;\n      const chunkArea = chunkSize * chunkSize;\n      const baseCount = Math.floor(chunkArea * density);\n      const enemyCount = Math.max(0, baseCount + Math.floor(Math.random() * 3) - 1); // Randomize ±1\n      \n      for (let i = 0; i < enemyCount; i++) {\n        // Generate random position within chunk\n        const position = {\n          x: chunkPosition.x + (Math.random() - 0.5) * chunkSize,\n          y: chunkPosition.y,\n          z: chunkPosition.z + (Math.random() - 0.5) * chunkSize\n        };\n        \n        try {\n          const enemy = this.createEnemyFromLevelData(enemyType, position, properties);\n          enemies.push(enemy);\n        } catch (error) {\n          console.warn(`Failed to create enemy ${enemyType}:`, error);\n        }\n      }\n    }\n    \n    return enemies;\n  }

  /**\n   * Create enemy specifically from legacy level data\n   */\n  private createEnemyFromLevelData(\n    enemyType: string,\n    position: Vector3,\n    properties: any\n  ): Entity {\n    const entityId = this.generateEntityId();\n    \n    // Create enemy component from level data\n    const enemy = createEnemyFromLevelConfig(enemyType, position, { [enemyType]: properties });\n    enemy.entityId = entityId;\n    \n    // Create other components\n    const transform = createTransformComponent({\n      position: { ...position },\n      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },\n      scale: { x: 1, y: 1, z: 1 }\n    });\n    transform.entityId = entityId;\n    \n    const ai = createAIForEnemyType(enemyType);\n    ai.entityId = entityId;\n    \n    const aggro = createAggroForEnemyType(enemyType);\n    aggro.entityId = entityId;\n    \n    const navigation = createNavigationForEnemyType(enemyType);\n    navigation.entityId = entityId;\n    \n    const patrol = createPatrolForEnemyType(enemyType, position);\n    patrol.entityId = entityId;\n    \n    // Create the entity\n    const entity: Entity = {\n      id: entityId,\n      components: new Map([\n        ['enemy', enemy],\n        ['transform', transform],\n        ['ai', ai],\n        ['aggro', aggro],\n        ['navigation', navigation],\n        ['patrol', patrol]\n      ])\n    };\n    \n    // Add to world\n    this.world.addEntity(entity);\n    \n    return entity;\n  }

  /**\n   * Create specific enemy types with optimized settings\n   */\n  createBear(position: Vector3, options: any = {}): Entity {\n    return this.createEnemy('bear', position, {\n      ...options,\n      customProperties: {\n        territorialRadius: 25.0,\n        aggressionLevel: 0.8\n      }\n    });\n  }\n  \n  createSquirrel(position: Vector3, options: any = {}): Entity {\n    return this.createEnemy('squirrel', position, {\n      ...options,\n      customProperties: {\n        flightDistance: 30.0,\n        alertnessLevel: 0.9\n      }\n    });\n  }\n  \n  createDeer(position: Vector3, options: any = {}): Entity {\n    return this.createEnemy('deer', position, {\n      ...options,\n      customProperties: {\n        flockBehavior: true,\n        flightThreshold: 20.0\n      }\n    });\n  }\n  \n  createCoyote(position: Vector3, options: any = {}): Entity {\n    return this.createEnemy('coyote', position, {\n      ...options,\n      customProperties: {\n        packHunter: true,\n        coordinationRange: 50.0\n      }\n    });\n  }\n  \n  createRattlesnake(position: Vector3, options: any = {}): Entity {\n    return this.createEnemy('rattlesnake', position, {\n      ...options,\n      customProperties: {\n        ambushPredator: true,\n        strikeRange: 2.5\n      }\n    });\n  }\n  \n  createScorpion(position: Vector3, options: any = {}): Entity {\n    return this.createEnemy('scorpion', position, {\n      ...options,\n      customProperties: {\n        burrowBehavior: true,\n        territorialRange: 12.0\n      }\n    });\n  }

  /**\n   * Create a coyote pack (2-4 coyotes)\n   */\n  createCoyotePack(centerPosition: Vector3, options: any = {}): Entity[] {\n    const packSize = 2 + Math.floor(Math.random() * 3); // 2-4 coyotes\n    return this.createEnemyPack('coyote', centerPosition, packSize, 20.0, {\n      ...options,\n      packFormation: 'random'\n    });\n  }

  // Private helper methods\n  private generateEntityId(): EntityId {\n    return this.entityIdCounter++;\n  }

  private createEnemyComponentForType(enemyType: string, position: Vector3, options: any) {\n    const mappedType = this.mapEnemyType(enemyType);\n    return createEnemyComponent(mappedType, position, options.customProperties || {});\n  }

  private mapEnemyType(enemyType: string): any {\n    const mapping: Record<string, any> = {\n      'bear': 'bear',\n      'squirrel': 'squirrel',\n      'deer': 'deer',\n      'coyote': 'coyote',\n      'rattlesnake': 'rattlesnake',\n      'scorpion': 'scorpion'\n    };\n    \n    return mapping[enemyType] || 'bear';\n  }

  private adjustAIForDifficulty(ai: any, multiplier: number): void {\n    // Increase AI capabilities based on difficulty\n    ai.aggressiveness = Math.min(1.0, ai.aggressiveness * multiplier);\n    ai.alertness = Math.min(1.0, ai.alertness * multiplier);\n    ai.intelligence = Math.min(1.0, ai.intelligence * multiplier);\n    ai.persistence = Math.min(1.0, ai.persistence * multiplier);\n    \n    // Reduce reaction time (faster reactions at higher difficulty)\n    ai.reactionTime = Math.max(0.1, ai.reactionTime / multiplier);\n    \n    // Increase thinking frequency\n    ai.thinkingFrequency = Math.min(20, ai.thinkingFrequency * multiplier);\n  }

  private configureGroupBehavior(\n    ai: any,\n    aggro: any,\n    patrol: any,\n    groupId: string,\n    isLeader: boolean\n  ): void {\n    // Configure AI group behavior\n    ai.groupBehavior.shouldCoordinate = true;\n    ai.groupBehavior.isLeader = isLeader;\n    ai.groupBehavior.coordinationRadius = 50.0;\n    \n    // Configure aggro group coordination\n    aggro.groupCoordination.enabled = true;\n    aggro.groupCoordination.shareTargets = true;\n    aggro.groupCoordination.communicationRadius = 60.0;\n    \n    // Configure patrol group behavior\n    patrol.groupPatrol.enabled = true;\n    patrol.groupPatrol.groupId = groupId;\n    patrol.groupPatrol.leaderEntityId = isLeader ? undefined : undefined; // Will be set by system\n  }

  private applyBiomeModifiers(\n    enemy: any,\n    ai: any,\n    aggro: any,\n    biome: string\n  ): void {\n    switch (biome) {\n      case 'forest':\n        // Forest enemies have better cover and stealth\n        enemy.biomeModifiers.speedMultiplier = 0.9;\n        aggro.detectionModifiers.coverModifier = 0.8;\n        ai.intelligence *= 1.1;\n        break;\n        \n      case 'desert':\n        // Desert enemies are more territorial and aggressive\n        enemy.biomeModifiers.aggroMultiplier = 1.2;\n        enemy.biomeModifiers.damageMultiplier = 1.1;\n        ai.aggressiveness *= 1.2;\n        ai.persistence *= 1.1;\n        break;\n        \n      case 'mountain':\n        // Mountain enemies have better sight and endurance\n        aggro.viewDistance *= 1.3;\n        enemy.biomeModifiers.speedMultiplier = 1.1;\n        ai.alertness *= 1.2;\n        break;\n        \n      default:\n        // Default biome - no modifiers\n        break;\n    }\n  }

  /**\n   * Utility method to get all enemies in the world\n   */\n  getAllEnemies(): Entity[] {\n    return this.world.getEntitiesWithComponent('enemy');\n  }

  /**\n   * Utility method to get enemies by type\n   */\n  getEnemiesByType(enemyType: string): Entity[] {\n    const enemies = this.world.getEntitiesWithComponent('enemy');\n    return enemies.filter(entity => {\n      const enemy = entity.components.get('enemy') as any;\n      return enemy && enemy.enemyType === enemyType;\n    });\n  }

  /**\n   * Utility method to remove an enemy from the world\n   */\n  removeEnemy(entity: Entity): void {\n    this.world.removeEntity(entity.id);\n  }

  /**\n   * Utility method to remove all enemies\n   */\n  removeAllEnemies(): void {\n    const enemies = this.getAllEnemies();\n    for (const enemy of enemies) {\n      this.removeEnemy(enemy);\n    }\n  }
}\n\n// Export convenience functions\nexport function createEnemyFactory(world: World): EnemyFactory {\n  return new EnemyFactory(world);\n}

// Export enemy type constants\nexport const EnemyTypes = {\n  FOREST: ['bear', 'squirrel', 'deer'],\n  DESERT: ['coyote', 'rattlesnake', 'scorpion'],\n  ALL: ['bear', 'squirrel', 'deer', 'coyote', 'rattlesnake', 'scorpion']\n} as const;

// Export enemy statistics for balancing\nexport const EnemyStats = {\n  bear: { speed: 8.0, aggro: 40.0, health: 100, damage: 25 },\n  squirrel: { speed: 12.0, aggro: 20.0, health: 30, damage: 8 },\n  deer: { speed: 10.0, aggro: 36.0, health: 60, damage: 15 },\n  coyote: { speed: 11.0, aggro: 35.0, health: 70, damage: 18 },\n  rattlesnake: { speed: 2.0, aggro: 10.0, health: 40, damage: 30 },\n  scorpion: { speed: 4.0, aggro: 8.0, health: 45, damage: 20 }\n} as const;