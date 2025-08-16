/**
 * PowerupFactory
 * Creates powerup entities with all necessary components
 */

import { Entity } from '@/types';
import { PowerupComponent, createPowerupComponent } from './components/PowerupComponent';
import { CollectibleComponent, createCollectibleComponent } from './components/CollectibleComponent';
import { MagnetComponent, createMagnetComponent } from './components/MagnetComponent';
import { DoublerComponent, createDoublerComponent } from './components/DoublerComponent';
import { InvisibilityComponent, createInvisibilityComponent } from './components/InvisibilityComponent';
import { PowerupType, POWERUP_CONFIGS } from './types/PowerupTypes';

export interface PowerupSpawnConfig {
  type: PowerupType;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: number;
  customDuration?: number;
  customScoreValue?: number;
}

export class PowerupFactory {
  private static entityIdCounter = 1000; // Start high to avoid conflicts
  
  /**
   * Create a complete powerup entity with all necessary components
   */
  static createPowerup(config: PowerupSpawnConfig): Entity {
    const entityId = ++PowerupFactory.entityIdCounter;
    const powerupConfig = POWERUP_CONFIGS[config.type];
    
    if (!powerupConfig) {
      throw new Error(`Unknown powerup type: ${config.type}`);
    }

    // Apply custom duration if provided
    const finalConfig = { ...powerupConfig };
    if (config.customDuration) {
      finalConfig.duration = config.customDuration;
    }

    // Create base entity
    const entity: Entity = {
      id: entityId,
      components: new Map()
    };

    // Add core components
    PowerupFactory.addCoreComponents(entity, config, finalConfig);
    
    // Add powerup-specific components
    PowerupFactory.addPowerupSpecificComponents(entity, config.type, finalConfig);
    
    // Add visual and physics components
    PowerupFactory.addVisualComponents(entity, config, finalConfig);
    PowerupFactory.addPhysicsComponents(entity, config);

    return entity;
  }

  /**
   * Create multiple powerups at random positions
   */
  static createPowerupBatch(
    types: PowerupType[],
    spawnArea: {
      center: { x: number; y: number; z: number };
      radius: number;
    },
    count: number
  ): Entity[] {
    const powerups: Entity[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const position = PowerupFactory.getRandomPositionInArea(spawnArea);
      
      const powerup = PowerupFactory.createPowerup({
        type,
        position
      });
      
      powerups.push(powerup);
    }
    
    return powerups;
  }

  /**
   * Create a magnet powerup with faithful recreation mechanics
   */
  static createMagnetPowerup(position: { x: number; y: number; z: number }): Entity {
    return PowerupFactory.createPowerup({
      type: PowerupType.MAGNET,
      position,
      customDuration: 10000, // 10 seconds exactly
      customScoreValue: 150
    });
  }

  /**
   * Create a doubler powerup with faithful recreation mechanics
   */
  static createDoublerPowerup(position: { x: number; y: number; z: number }): Entity {
    return PowerupFactory.createPowerup({
      type: PowerupType.DOUBLER,
      position,
      customDuration: 10000, // 10 seconds exactly
      customScoreValue: 200
    });
  }

  /**
   * Create an invisibility powerup with faithful recreation mechanics
   */
  static createInvisibilityPowerup(position: { x: number; y: number; z: number }): Entity {
    return PowerupFactory.createPowerup({
      type: PowerupType.INVISIBILITY,
      position,
      customDuration: 10000, // 10 seconds exactly
      customScoreValue: 250
    });
  }

  // Private helper methods

  private static addCoreComponents(
    entity: Entity, 
    config: PowerupSpawnConfig, 
    powerupConfig: any
  ): void {
    // PowerupComponent
    const powerupComponent = createPowerupComponent(config.type, powerupConfig);
    entity.components.set('PowerupComponent', powerupComponent);

    // CollectibleComponent
    const scoreValue = config.customScoreValue || 100;
    const collectibleComponent = createCollectibleComponent(15, scoreValue);
    entity.components.set('CollectibleComponent', collectibleComponent);

    // TypeComponent for identification
    entity.components.set('TypeComponent', {
      type: 'powerup',
      subtype: config.type
    });
  }

  private static addPowerupSpecificComponents(
    entity: Entity, 
    type: PowerupType, 
    powerupConfig: any
  ): void {
    switch (type) {
      case PowerupType.MAGNET:
        const magnetComponent = createMagnetComponent(80, 150); // 80 radius, 150 force
        entity.components.set('MagnetComponent', magnetComponent);
        break;
        
      case PowerupType.DOUBLER:
        const doublerComponent = createDoublerComponent(2); // 2x multiplier
        entity.components.set('DoublerComponent', doublerComponent);
        break;
        
      case PowerupType.INVISIBILITY:
        const invisibilityComponent = createInvisibilityComponent(0.5); // 50% transparency
        entity.components.set('InvisibilityComponent', invisibilityComponent);
        break;
    }
  }

  private static addVisualComponents(
    entity: Entity, 
    config: PowerupSpawnConfig, 
    powerupConfig: any
  ): void {
    // TransformComponent
    const transformComponent = {
      position: { ...config.position },
      rotation: config.rotation || { x: 0, y: 0, z: 0 },
      scale: config.scale || powerupConfig.visualConfig.scale || 1.0
    };
    entity.components.set('TransformComponent', transformComponent);

    // RenderComponent
    const renderComponent = {
      visible: true,
      meshType: 'powerup',
      material: {
        type: 'powerup',
        color: powerupConfig.visualConfig.color,
        emissive: true,
        emissiveIntensity: 0.5,
        opacity: 1.0
      },
      castShadows: false,
      receiveShadows: false
    };
    entity.components.set('RenderComponent', renderComponent);

    // AnimationComponent for floating and rotation
    const animationComponent = {
      animations: [
        {
          type: 'float',
          amplitude: 2.0,
          frequency: 1.5,
          axis: 'y'
        },
        {
          type: 'rotate',
          speed: 1.0,
          axis: 'y'
        },
        {
          type: 'glow',
          intensity: powerupConfig.visualConfig.glowIntensity,
          frequency: 2.0
        }
      ],
      isPlaying: true
    };
    entity.components.set('AnimationComponent', animationComponent);
  }

  private static addPhysicsComponents(entity: Entity, config: PowerupSpawnConfig): void {
    // PhysicsComponent for collision detection
    const physicsComponent = {
      mass: 0, // Static object
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      friction: 0.95,
      restitution: 0.3,
      collisionRadius: 8,
      isStatic: true,
      collisionLayer: 'powerup',
      collisionMask: ['player']
    };
    entity.components.set('PhysicsComponent', physicsComponent);

    // BoundingBoxComponent for spatial partitioning
    const boundingBoxComponent = {
      min: {
        x: config.position.x - 8,
        y: config.position.y - 8,
        z: config.position.z - 8
      },
      max: {
        x: config.position.x + 8,
        y: config.position.y + 8,
        z: config.position.z + 8
      }
    };
    entity.components.set('BoundingBoxComponent', boundingBoxComponent);
  }

  private static getRandomPositionInArea(spawnArea: {
    center: { x: number; y: number; z: number };
    radius: number;
  }): { x: number; y: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spawnArea.radius;
    
    return {
      x: spawnArea.center.x + Math.cos(angle) * distance,
      y: spawnArea.center.y,
      z: spawnArea.center.z + Math.sin(angle) * distance
    };
  }

  /**
   * Create a powerup spawner that generates powerups over time
   */
  static createPowerupSpawner(
    spawnArea: {
      center: { x: number; y: number; z: number };
      radius: number;
    },
    spawnRate: number, // powerups per second
    powerupTypes: PowerupType[] = [PowerupType.MAGNET, PowerupType.DOUBLER, PowerupType.INVISIBILITY]
  ): {
    update: (deltaTime: number) => Entity[];
    isActive: boolean;
    setActive: (active: boolean) => void;
  } {
    let lastSpawnTime = 0;
    let isActive = true;
    const spawnInterval = 1000 / spawnRate; // milliseconds between spawns

    return {
      update: (deltaTime: number): Entity[] => {
        if (!isActive) return [];
        
        const currentTime = performance.now();
        const spawnedPowerups: Entity[] = [];
        
        if (currentTime - lastSpawnTime >= spawnInterval) {
          const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
          const position = PowerupFactory.getRandomPositionInArea(spawnArea);
          
          const powerup = PowerupFactory.createPowerup({ type, position });
          spawnedPowerups.push(powerup);
          
          lastSpawnTime = currentTime;
        }
        
        return spawnedPowerups;
      },
      
      isActive,
      
      setActive: (active: boolean) => {
        isActive = active;
      }
    };
  }

  /**
   * Create powerups based on player progression
   */
  static createProgressivePowerups(
    playerLevel: number,
    score: number,
    position: { x: number; y: number; z: number }
  ): Entity[] {
    const powerups: Entity[] = [];
    
    // Basic powerup availability
    const availableTypes: PowerupType[] = [PowerupType.MAGNET];
    
    // Unlock doubler at level 3 or score 1000
    if (playerLevel >= 3 || score >= 1000) {
      availableTypes.push(PowerupType.DOUBLER);
    }
    
    // Unlock invisibility at level 5 or score 2500
    if (playerLevel >= 5 || score >= 2500) {
      availableTypes.push(PowerupType.INVISIBILITY);
    }
    
    // Increase spawn rate based on level
    const spawnCount = Math.min(3, Math.floor(playerLevel / 2) + 1);
    
    for (let i = 0; i < spawnCount; i++) {
      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      const offset = {
        x: position.x + (Math.random() - 0.5) * 50,
        y: position.y,
        z: position.z + (Math.random() - 0.5) * 50
      };
      
      const powerup = PowerupFactory.createPowerup({ type, position: offset });
      powerups.push(powerup);
    }
    
    return powerups;
  }

  /**
   * Get powerup factory statistics
   */
  static getStats() {
    return {
      entitiesCreated: PowerupFactory.entityIdCounter - 1000,
      availableTypes: Object.keys(POWERUP_CONFIGS),
      typeConfigurations: Object.keys(POWERUP_CONFIGS).map(type => ({
        type,
        duration: POWERUP_CONFIGS[type as PowerupType].duration,
        effects: POWERUP_CONFIGS[type as PowerupType].effects
      }))
    };
  }

  /**
   * Reset entity counter (for testing)
   */
  static resetCounters(): void {
    PowerupFactory.entityIdCounter = 1000;
  }
}