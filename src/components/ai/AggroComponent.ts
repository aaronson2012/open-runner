import type { Component, Vector3, EntityId } from '@/types';

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface DetectedTarget {
  entityId: EntityId;
  position: Vector3;
  lastSeenTime: number;
  threatLevel: ThreatLevel;
  distance: number;
  isVisible: boolean;
  suspicionLevel: number; // 0-1
  confidence: number; // How sure we are about this target
}

export interface AggroComponent extends Component {
  type: 'aggro';
  
  // Detection configuration
  detectionRadius: number;
  maxDetectionRadius: number; // Absolute maximum, for performance culling
  deaggroRadius: number; // When to stop chasing
  viewAngle: number; // Field of view in radians
  viewDistance: number; // How far the enemy can see
  
  // Detection modifiers
  detectionModifiers: {
    lightLevel: number; // 0-1, affects detection in darkness
    noiseLevel: number; // 0-1, affects audio-based detection
    weather: number; // 0-1, weather effects on detection
    coverModifier: number; // 0-1, how much cover affects detection
  };
  
  // Current targets and threats
  detectedTargets: Map<EntityId, DetectedTarget>;
  primaryTarget?: EntityId;
  lastPrimaryTargetTime: number;
  
  // Aggro state
  aggroLevel: number; // 0-1, current aggression level
  maxAggroLevel: number;
  aggroDecayRate: number; // How fast aggro decreases over time
  aggroGainRate: number; // How fast aggro increases when detecting threats
  
  // Chase behavior
  isChasing: boolean;
  chaseStartTime: number;
  maxChaseTime: number; // Maximum time to chase before giving up
  chaseSpeed: number; // Speed multiplier when chasing
  lastKnownTargetPosition?: Vector3;
  
  // Sight-based detection
  sightDetection: {
    enabled: boolean;
    accuracy: number; // 0-1, how accurately the enemy can track by sight
    reactionTime: number; // Time to react to visual stimulus
    peripheralVision: number; // 0-1, detection ability outside main view cone
    nightVision: number; // 0-1, ability to see in low light
  };
  
  // Sound-based detection
  soundDetection: {
    enabled: boolean;
    sensitivity: number; // 0-1, how sensitive to sounds
    maxSoundDistance: number;
    soundMemoryDuration: number; // How long to remember sound locations
    lastSoundSource?: Vector3;
    lastSoundTime: number;
  };
  
  // Movement-based detection
  movementDetection: {
    enabled: boolean;
    sensitivity: number; // How sensitive to movement
    stillnessBonus: number; // Detection reduction when target is still
    speedPenalty: number; // Detection increase for fast movement
  };
  
  // Group coordination
  groupCoordination: {
    enabled: boolean;
    communicationRadius: number;
    shareTargets: boolean;
    alarmRadius: number; // Range to alert other enemies
    lastAlarmTime: number;
    alarmCooldown: number;
  };
  
  // Special behaviors
  specialBehaviors: {
    ambushPredator: boolean; // Waits for targets to come close
    territorialDefense: boolean; // More aggressive when near spawn
    fleeWhenOutnumbered: boolean; // Retreat when facing multiple threats
    packHunter: boolean; // Coordinate with other pack members
  };
  
  // Performance optimization
  lastDetectionCheck: number;
  detectionFrequency: number; // Hz, how often to check for targets
  lodDetectionRadius: number; // Current effective detection radius (LOD)
  
  // State tracking
  alertnessLevel: number; // 0-1, current alertness
  suspicionTimeout: number; // Time to remain suspicious after losing target
  investigationTarget?: Vector3; // Position to investigate
  investigationRadius: number;
  
  // Ignore list (for performance and gameplay)
  ignoredTargets: Set<EntityId>;
  ignoreTimeout: number; // How long to ignore a target
  
  // Debug information
  debugVisualization: {
    enabled: boolean;
    showDetectionRadius: boolean;
    showViewCone: boolean;
    showTargetLines: boolean;
    showSoundSources: boolean;
  };
}

export function createAggroComponent(
  detectionRadius: number = 30.0,
  options: Partial<AggroComponent> = {}
): AggroComponent {
  return {
    type: 'aggro',
    entityId: 0,
    
    // Detection configuration
    detectionRadius,
    maxDetectionRadius: options.maxDetectionRadius ?? detectionRadius * 1.5,
    deaggroRadius: options.deaggroRadius ?? detectionRadius * 1.3,
    viewAngle: options.viewAngle ?? Math.PI * 0.75, // 135 degrees default
    viewDistance: options.viewDistance ?? detectionRadius,
    
    // Detection modifiers
    detectionModifiers: {
      lightLevel: 1.0,
      noiseLevel: 1.0,
      weather: 1.0,
      coverModifier: 1.0,
      ...options.detectionModifiers
    },
    
    // Targets and threats
    detectedTargets: new Map(),
    primaryTarget: undefined,
    lastPrimaryTargetTime: 0,
    
    // Aggro state
    aggroLevel: 0,
    maxAggroLevel: 1.0,
    aggroDecayRate: options.aggroDecayRate ?? 0.5, // Decay 50% per second
    aggroGainRate: options.aggroGainRate ?? 2.0, // Gain 200% per second when detecting
    
    // Chase behavior
    isChasing: false,
    chaseStartTime: 0,
    maxChaseTime: options.maxChaseTime ?? 15.0, // 15 seconds max chase
    chaseSpeed: options.chaseSpeed ?? 1.2, // 20% speed boost when chasing
    lastKnownTargetPosition: undefined,
    
    // Sight detection
    sightDetection: {
      enabled: true,
      accuracy: 0.8,
      reactionTime: 0.5,
      peripheralVision: 0.3,
      nightVision: 0.2,
      ...options.sightDetection
    },
    
    // Sound detection
    soundDetection: {
      enabled: true,
      sensitivity: 0.7,
      maxSoundDistance: detectionRadius * 2,
      soundMemoryDuration: 5.0,
      lastSoundSource: undefined,
      lastSoundTime: 0,
      ...options.soundDetection
    },
    
    // Movement detection
    movementDetection: {
      enabled: true,
      sensitivity: 0.6,
      stillnessBonus: 0.5, // 50% harder to detect when still
      speedPenalty: 0.3, // 30% easier to detect when moving fast
      ...options.movementDetection
    },
    
    // Group coordination
    groupCoordination: {
      enabled: false,
      communicationRadius: 50.0,
      shareTargets: true,
      alarmRadius: 30.0,
      lastAlarmTime: 0,
      alarmCooldown: 5.0,
      ...options.groupCoordination
    },
    
    // Special behaviors
    specialBehaviors: {
      ambushPredator: false,
      territorialDefense: false,
      fleeWhenOutnumbered: false,
      packHunter: false,
      ...options.specialBehaviors
    },
    
    // Performance
    lastDetectionCheck: 0,
    detectionFrequency: options.detectionFrequency ?? 10, // 10 Hz
    lodDetectionRadius: detectionRadius,
    
    // State
    alertnessLevel: 0,
    suspicionTimeout: 3.0,
    investigationTarget: undefined,
    investigationRadius: 5.0,
    
    // Ignore list
    ignoredTargets: new Set(),
    ignoreTimeout: 2.0,
    
    // Debug
    debugVisualization: {
      enabled: false,
      showDetectionRadius: false,
      showViewCone: false,
      showTargetLines: false,
      showSoundSources: false,
      ...options.debugVisualization
    }
  };
}

// Specialized aggro components for different enemy types
export function createBearAggro(): AggroComponent {
  return createAggroComponent(40.0, {
    viewAngle: Math.PI * 0.6, // 108 degrees - focused vision
    chaseSpeed: 1.1, // Slower chase speed
    maxChaseTime: 20.0, // Persistent chaser
    sightDetection: {
      enabled: true,
      accuracy: 0.6,
      reactionTime: 0.8,
      peripheralVision: 0.2,
      nightVision: 0.4
    },
    soundDetection: {
      enabled: true,
      sensitivity: 0.8,
      maxSoundDistance: 60.0,
      soundMemoryDuration: 8.0,
      lastSoundSource: undefined,
      lastSoundTime: 0
    },
    specialBehaviors: {
      ambushPredator: false,
      territorialDefense: true,
      fleeWhenOutnumbered: false,
      packHunter: false
    }
  });
}

export function createSquirrelAggro(): AggroComponent {
  return createAggroComponent(20.0, {
    viewAngle: Math.PI, // 180 degrees - wide field of view
    chaseSpeed: 1.5, // Very fast chase
    maxChaseTime: 8.0, // Short attention span
    sightDetection: {
      enabled: true,
      accuracy: 0.9,
      reactionTime: 0.2,
      peripheralVision: 0.6,
      nightVision: 0.1
    },
    soundDetection: {
      enabled: true,
      sensitivity: 0.9,
      maxSoundDistance: 30.0,
      soundMemoryDuration: 3.0,
      lastSoundSource: undefined,
      lastSoundTime: 0
    },
    specialBehaviors: {
      ambushPredator: false,
      territorialDefense: true,
      fleeWhenOutnumbered: true,
      packHunter: false
    }
  });
}

export function createDeerAggro(): AggroComponent {
  return createAggroComponent(36.0, {
    viewAngle: Math.PI * 1.2, // 216 degrees - prey animal wide vision
    chaseSpeed: 0.8, // Slower "chase" (more like fleeing toward player)
    maxChaseTime: 5.0, // Very short engagement
    sightDetection: {
      enabled: true,
      accuracy: 0.7,
      reactionTime: 0.4,
      peripheralVision: 0.8,
      nightVision: 0.3
    },
    soundDetection: {
      enabled: true,
      sensitivity: 0.8,
      maxSoundDistance: 50.0,
      soundMemoryDuration: 4.0,
      lastSoundSource: undefined,
      lastSoundTime: 0
    },
    specialBehaviors: {
      ambushPredator: false,
      territorialDefense: false,
      fleeWhenOutnumbered: true,
      packHunter: false
    }
  });
}

export function createCoyoteAggro(): AggroComponent {
  return createAggroComponent(35.0, {
    viewAngle: Math.PI * 0.8, // 144 degrees
    chaseSpeed: 1.3,
    maxChaseTime: 25.0, // Very persistent
    groupCoordination: {
      enabled: true,
      communicationRadius: 75.0,
      shareTargets: true,
      alarmRadius: 50.0,
      lastAlarmTime: 0,
      alarmCooldown: 3.0
    },
    sightDetection: {
      enabled: true,
      accuracy: 0.8,
      reactionTime: 0.5,
      peripheralVision: 0.4,
      nightVision: 0.6
    },
    soundDetection: {
      enabled: true,
      sensitivity: 0.9,
      maxSoundDistance: 70.0,
      soundMemoryDuration: 10.0,
      lastSoundSource: undefined,
      lastSoundTime: 0
    },
    specialBehaviors: {
      ambushPredator: false,
      territorialDefense: false,
      fleeWhenOutnumbered: false,
      packHunter: true
    }
  });
}

export function createRattlesnakeAggro(): AggroComponent {
  return createAggroComponent(10.0, {
    viewAngle: Math.PI * 0.4, // 72 degrees - limited vision
    chaseSpeed: 0.6, // Very slow chase
    maxChaseTime: 3.0, // Very short chase
    sightDetection: {
      enabled: true,
      accuracy: 0.4,
      reactionTime: 0.3,
      peripheralVision: 0.1,
      nightVision: 0.1
    },
    soundDetection: {
      enabled: true,
      sensitivity: 0.6,
      maxSoundDistance: 15.0,
      soundMemoryDuration: 2.0,
      lastSoundSource: undefined,
      lastSoundTime: 0
    },
    movementDetection: {
      enabled: true,
      sensitivity: 0.9, // Very sensitive to movement
      stillnessBonus: 0.8,
      speedPenalty: 0.5
    },
    specialBehaviors: {
      ambushPredator: true,
      territorialDefense: true,
      fleeWhenOutnumbered: false,
      packHunter: false
    }
  });
}

export function createScorpionAggro(): AggroComponent {
  return createAggroComponent(8.0, {
    viewAngle: Math.PI * 0.5, // 90 degrees
    chaseSpeed: 0.9,
    maxChaseTime: 6.0,
    sightDetection: {
      enabled: true,
      accuracy: 0.5,
      reactionTime: 0.6,
      peripheralVision: 0.2,
      nightVision: 0.4
    },
    soundDetection: {
      enabled: true,
      sensitivity: 0.5,
      maxSoundDistance: 12.0,
      soundMemoryDuration: 3.0,
      lastSoundSource: undefined,
      lastSoundTime: 0
    },
    specialBehaviors: {
      ambushPredator: true,
      territorialDefense: true,
      fleeWhenOutnumbered: true,
      packHunter: false
    }
  });
}

// Factory function for creating aggro components by enemy type
export function createAggroForEnemyType(enemyType: string): AggroComponent {
  switch (enemyType) {
    case 'bear': return createBearAggro();
    case 'squirrel': return createSquirrelAggro();
    case 'deer': return createDeerAggro();
    case 'coyote': return createCoyoteAggro();
    case 'rattlesnake': return createRattlesnakeAggro();
    case 'scorpion': return createScorpionAggro();
    default: return createAggroComponent();
  }
}

// Utility functions for aggro management
export function addDetectedTarget(
  aggro: AggroComponent,
  entityId: EntityId,
  position: Vector3,
  threatLevel: ThreatLevel = 'medium'
): void {
  const existing = aggro.detectedTargets.get(entityId);
  const now = Date.now() / 1000;
  
  if (existing) {
    // Update existing target
    existing.position = { ...position };
    existing.lastSeenTime = now;
    existing.threatLevel = threatLevel;
    existing.isVisible = true;
    existing.suspicionLevel = Math.min(1.0, existing.suspicionLevel + 0.1);
  } else {
    // Add new target
    aggro.detectedTargets.set(entityId, {
      entityId,
      position: { ...position },
      lastSeenTime: now,
      threatLevel,
      distance: 0, // Will be calculated by systems
      isVisible: true,
      suspicionLevel: 0.3,
      confidence: 0.8
    });
  }
  
  // Set as primary target if this is the highest threat
  if (!aggro.primaryTarget || threatLevel === 'critical' || threatLevel === 'high') {
    aggro.primaryTarget = entityId;
    aggro.lastPrimaryTargetTime = now;
  }
}

export function removeDetectedTarget(aggro: AggroComponent, entityId: EntityId): void {
  aggro.detectedTargets.delete(entityId);
  
  // Find new primary target if this was it
  if (aggro.primaryTarget === entityId) {
    aggro.primaryTarget = undefined;
    
    // Find highest threat level target to replace it
    let highestThreat: EntityId | undefined;
    let highestThreatLevel = 'none';
    
    for (const [id, target] of aggro.detectedTargets) {
      if (getThreatValue(target.threatLevel) > getThreatValue(highestThreatLevel)) {
        highestThreat = id;
        highestThreatLevel = target.threatLevel;
      }
    }
    
    aggro.primaryTarget = highestThreat;
    aggro.lastPrimaryTargetTime = Date.now() / 1000;
  }
}

function getThreatValue(threatLevel: ThreatLevel): number {
  const values = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return values[threatLevel] || 0;
}

export function updateAggroLevel(
  aggro: AggroComponent,
  deltaTime: number,
  hasValidTarget: boolean
): void {
  if (hasValidTarget) {
    // Increase aggro when we have a target
    aggro.aggroLevel = Math.min(
      aggro.maxAggroLevel,
      aggro.aggroLevel + aggro.aggroGainRate * deltaTime
    );
  } else {
    // Decrease aggro when we don't have a target
    aggro.aggroLevel = Math.max(
      0,
      aggro.aggroLevel - aggro.aggroDecayRate * deltaTime
    );
  }
}

export function isInViewCone(
  aggroPos: Vector3,
  aggroRotation: number,
  targetPos: Vector3,
  viewAngle: number,
  viewDistance: number
): boolean {
  const dx = targetPos.x - aggroPos.x;
  const dz = targetPos.z - aggroPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  
  if (distance > viewDistance) return false;
  
  const targetAngle = Math.atan2(dz, dx);
  const angleDiff = Math.abs(targetAngle - aggroRotation);
  const normalizedAngleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
  
  return normalizedAngleDiff <= viewAngle / 2;
}