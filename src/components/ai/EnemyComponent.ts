import type { Component, Vector3, EntityId } from '@/types';

export interface EnemyComponent extends Component {
  type: 'enemy';
  
  // Enemy type and identification
  enemyType: 'bear' | 'squirrel' | 'deer' | 'coyote' | 'rattlesnake' | 'scorpion';
  id: string;
  
  // Core stats
  health: number;
  maxHealth: number;
  damage: number;
  
  // Movement properties
  moveSpeed: number;
  originalMoveSpeed: number; // For speed modifiers
  rotationSpeed: number;
  
  // Detection and aggression
  aggroRadius: number;
  deaggroRadius: number;
  viewAngle: number; // FOV in radians
  
  // Roaming behavior
  roamingRadius: number;
  roamingSpeedFactor: number;
  roamingMinWaitTime: number;
  roamingMaxWaitTime: number;
  
  // Original spawn position
  spawnPosition: Vector3;
  
  // State tracking
  isActive: boolean;
  isVisible: boolean;
  isDead: boolean;
  
  // AI difficulty/intelligence level
  difficultyLevel: number; // 0-1, affects reaction time, pathfinding quality
  
  // Animation and model data
  modelType: string;
  animationState: 'idle' | 'walk' | 'run' | 'attack' | 'death' | 'patrol';
  animationSpeed: number;
  
  // Sound effects
  soundEffects: {
    idle?: string;
    move?: string;
    attack?: string;
    death?: string;
    alert?: string;
  };
  
  // Combat properties
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  
  // Level/biome specific modifiers
  biomeModifiers: {
    speedMultiplier: number;
    aggroMultiplier: number;
    damageMultiplier: number;
  };
  
  // Performance optimization
  lastUpdateTime: number;
  updateFrequency: number; // Updates per second (LOD)
  
  // Debug information
  debugInfo?: {
    lastDecision: string;
    decisionTime: number;
    pathfindingAttempts: number;
  };
}

export function createEnemyComponent(
  enemyType: EnemyComponent['enemyType'],
  spawnPosition: Vector3,
  options: Partial<EnemyComponent> = {}
): EnemyComponent {
  // Base stats that vary by enemy type
  const typeDefaults = getEnemyTypeDefaults(enemyType);
  
  return {
    type: 'enemy',
    entityId: 0,
    enemyType,
    id: `${enemyType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    health: options.health ?? typeDefaults.health,
    maxHealth: options.maxHealth ?? typeDefaults.health,
    damage: options.damage ?? typeDefaults.damage,
    moveSpeed: options.moveSpeed ?? typeDefaults.moveSpeed,
    originalMoveSpeed: options.moveSpeed ?? typeDefaults.moveSpeed,
    rotationSpeed: options.rotationSpeed ?? typeDefaults.rotationSpeed,
    aggroRadius: options.aggroRadius ?? typeDefaults.aggroRadius,
    deaggroRadius: options.deaggroRadius ?? typeDefaults.deaggroRadius,
    viewAngle: options.viewAngle ?? typeDefaults.viewAngle,
    roamingRadius: options.roamingRadius ?? typeDefaults.roamingRadius,
    roamingSpeedFactor: options.roamingSpeedFactor ?? typeDefaults.roamingSpeedFactor,
    roamingMinWaitTime: options.roamingMinWaitTime ?? typeDefaults.roamingMinWaitTime,
    roamingMaxWaitTime: options.roamingMaxWaitTime ?? typeDefaults.roamingMaxWaitTime,
    spawnPosition: { ...spawnPosition },
    isActive: true,
    isVisible: true,
    isDead: false,
    difficultyLevel: options.difficultyLevel ?? 0.5,
    modelType: options.modelType ?? enemyType,
    animationState: 'idle',
    animationSpeed: options.animationSpeed ?? 1.0,
    soundEffects: options.soundEffects ?? typeDefaults.soundEffects,
    attackRange: options.attackRange ?? typeDefaults.attackRange,
    attackCooldown: options.attackCooldown ?? typeDefaults.attackCooldown,
    lastAttackTime: 0,
    biomeModifiers: options.biomeModifiers ?? {
      speedMultiplier: 1.0,
      aggroMultiplier: 1.0,
      damageMultiplier: 1.0
    },
    lastUpdateTime: 0,
    updateFrequency: options.updateFrequency ?? typeDefaults.updateFrequency
  };
}

// Original enemy type configurations from the legacy system
function getEnemyTypeDefaults(enemyType: EnemyComponent['enemyType']) {
  const defaults = {
    // Forest enemies
    bear: {
      health: 100,
      damage: 25,
      moveSpeed: 8.0,
      rotationSpeed: 2.0,
      aggroRadius: 40.0,
      deaggroRadius: 40.0,
      viewAngle: Math.PI * 0.75, // 135 degrees
      roamingRadius: 15.0,
      roamingSpeedFactor: 0.5,
      roamingMinWaitTime: 2.0,
      roamingMaxWaitTime: 5.0,
      attackRange: 3.0,
      attackCooldown: 2.0,
      updateFrequency: 10, // 10 FPS for performance
      soundEffects: {
        idle: 'bear_growl',
        move: 'bear_footsteps',
        attack: 'bear_roar',
        alert: 'bear_sniff'
      }
    },
    squirrel: {
      health: 30,
      damage: 8,
      moveSpeed: 12.0,
      rotationSpeed: 4.0,
      aggroRadius: 20.0,
      deaggroRadius: 25.0,
      viewAngle: Math.PI, // 180 degrees (more alert)
      roamingRadius: 10.0,
      roamingSpeedFactor: 0.7,
      roamingMinWaitTime: 1.0,
      roamingMaxWaitTime: 3.0,
      attackRange: 1.5,
      attackCooldown: 1.0,
      updateFrequency: 15, // Higher FPS for agile movement
      soundEffects: {
        idle: 'squirrel_chatter',
        move: 'squirrel_scamper',
        attack: 'squirrel_bite',
        alert: 'squirrel_chirp'
      }
    },
    deer: {
      health: 60,
      damage: 15,
      moveSpeed: 10.0,
      rotationSpeed: 3.0,
      aggroRadius: 36.0,
      deaggroRadius: 35.0,
      viewAngle: Math.PI * 1.2, // 216 degrees (prey animal alertness)
      roamingRadius: 20.0,
      roamingSpeedFactor: 0.6,
      roamingMinWaitTime: 3.0,
      roamingMaxWaitTime: 8.0,
      attackRange: 2.0,
      attackCooldown: 1.5,
      updateFrequency: 12,
      soundEffects: {
        idle: 'deer_breath',
        move: 'deer_hoofsteps',
        attack: 'deer_snort',
        alert: 'deer_alarm'
      }
    },
    // Desert enemies
    coyote: {
      health: 70,
      damage: 18,
      moveSpeed: 11.0,
      rotationSpeed: 3.5,
      aggroRadius: 35.0,
      deaggroRadius: 40.0,
      viewAngle: Math.PI * 0.8, // 144 degrees
      roamingRadius: 20.0,
      roamingSpeedFactor: 0.6,
      roamingMinWaitTime: 1.5,
      roamingMaxWaitTime: 4.0,
      attackRange: 2.5,
      attackCooldown: 1.8,
      updateFrequency: 12,
      soundEffects: {
        idle: 'coyote_pant',
        move: 'coyote_padded_steps',
        attack: 'coyote_howl',
        alert: 'coyote_bark'
      }
    },
    rattlesnake: {
      health: 40,
      damage: 30, // High damage, low health
      moveSpeed: 2.0,
      rotationSpeed: 1.5,
      aggroRadius: 10.0,
      deaggroRadius: 30.0,
      viewAngle: Math.PI * 0.5, // 90 degrees (limited vision)
      roamingRadius: 5.0,
      roamingSpeedFactor: 0.2,
      roamingMinWaitTime: 5.0,
      roamingMaxWaitTime: 15.0,
      attackRange: 2.0,
      attackCooldown: 3.0,
      updateFrequency: 8, // Lower FPS (mostly stationary)
      soundEffects: {
        idle: 'snake_hiss_quiet',
        move: 'snake_slither',
        attack: 'snake_strike',
        alert: 'snake_rattle'
      }
    },
    scorpion: {
      health: 45,
      damage: 20,
      moveSpeed: 4.0,
      rotationSpeed: 2.5,
      aggroRadius: 8.0,
      deaggroRadius: 30.0,
      viewAngle: Math.PI * 0.6, // 108 degrees
      roamingRadius: 10.0,
      roamingSpeedFactor: 0.4,
      roamingMinWaitTime: 3.0,
      roamingMaxWaitTime: 8.0,
      attackRange: 1.8,
      attackCooldown: 2.5,
      updateFrequency: 10,
      soundEffects: {
        idle: 'scorpion_click',
        move: 'scorpion_scuttle',
        attack: 'scorpion_sting',
        alert: 'scorpion_defensive'
      }
    }
  };
  
  return defaults[enemyType];
}

// Factory for creating enemies from level configurations
export function createEnemyFromLevelConfig(
  enemyType: string,
  position: Vector3,
  levelProperties: any
): EnemyComponent {
  const mappedType = mapLegacyEnemyType(enemyType);
  const properties = levelProperties?.[enemyType] || {};
  
  return createEnemyComponent(mappedType, position, {
    moveSpeed: properties.speed,
    aggroRadius: properties.aggroRadius,
    deaggroRadius: properties.deaggroRadius,
    roamingRadius: properties.roamingRadius,
    roamingSpeedFactor: properties.roamingSpeedFactor,
    roamingMinWaitTime: properties.roamingMinWaitTime,
    roamingMaxWaitTime: properties.roamingMaxWaitTime
  });
}

function mapLegacyEnemyType(legacyType: string): EnemyComponent['enemyType'] {
  const mapping: Record<string, EnemyComponent['enemyType']> = {
    'bear': 'bear',
    'squirrel': 'squirrel', 
    'deer': 'deer',
    'coyote': 'coyote',
    'rattlesnake': 'rattlesnake',
    'scorpion': 'scorpion'
  };
  
  return mapping[legacyType] || 'bear';
}