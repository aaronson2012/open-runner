import type { Component, Vector3 } from '@/types';

export type PatrolType = 'random' | 'waypoint' | 'circular' | 'linear' | 'guard' | 'territorial';

export interface PatrolWaypoint {
  id: string;
  position: Vector3;
  waitTime: number; // Time to wait at this waypoint
  arrivalRadius: number; // How close to get before considering "arrived"
  speed: number; // Speed modifier for this segment
  actions?: string[]; // Special actions to perform at this waypoint
}

export interface PatrolComponent extends Component {
  type: 'patrol';
  
  // Patrol configuration
  patrolType: PatrolType;
  isPatrolling: boolean;
  
  // Waypoint system
  waypoints: PatrolWaypoint[];
  currentWaypointIndex: number;
  nextWaypointIndex: number;
  
  // Random patrol settings
  centerPosition: Vector3; // Center point for random/circular patrols
  patrolRadius: number;
  minPatrolRadius: number;
  maxPatrolRadius: number;
  
  // Movement behavior
  patrolSpeed: number;
  originalSpeed: number; // Speed when not patrolling
  speedVariation: number; // 0-1, random speed variation
  
  // Wait times and delays
  waypointWaitTime: number; // Current wait time at waypoint
  waypointWaitTimer: number; // Current wait timer
  minWaitTime: number;
  maxWaitTime: number;
  
  // Movement patterns
  movementPattern: {
    useRandomWalk: boolean; // Add randomness to movement
    randomWalkIntensity: number; // How much randomness
    avoidBacktracking: boolean; // Don't immediately return to previous waypoint
    preferredDirection?: Vector3; // Bias movement in a direction
  };
  
  // Patrol state
  currentTarget?: Vector3;
  distanceToTarget: number;
  timeAtCurrentWaypoint: number;
  totalPatrolTime: number;
  
  // Interruption handling
  canBeInterrupted: boolean;
  interruptionCooldown: number; // Time before resuming patrol after interruption
  lastInterruptionTime: number;
  resumePatrolDelay: number;
  returnToPatrolSpeed: number; // Speed when returning to patrol after interruption
  
  // Route optimization
  pathOptimization: {
    enabled: boolean;
    recalculateInterval: number; // How often to recalculate optimal route
    lastRecalculation: number;
    avoidObstacles: boolean;
    obstacleAvoidanceRadius: number;
  };
  
  // Patrol bounds checking
  boundaryEnforcement: {
    enabled: boolean;
    boundary: 'circular' | 'rectangular';
    center: Vector3;
    size: Vector3; // For rectangular: width, height, depth. For circular: radius, 0, 0
    returnMethod: 'direct' | 'waypoint'; // How to return when out of bounds
  };
  
  // Groups and formations
  groupPatrol: {
    enabled: boolean;
    groupId?: string;
    formation: 'line' | 'column' | 'wedge' | 'circle' | 'loose';
    positionInFormation: number; // 0-based index
    followDistance: number; // Distance to maintain from leader/other members
    leaderEntityId?: number;
  };
  
  // Adaptive behavior
  adaptiveBehavior: {
    enabled: boolean;
    learningRate: number; // How quickly to adapt patterns
    playerAvoidance: boolean; // Modify patrol to avoid player
    threatResponse: 'pause' | 'flee' | 'investigate' | 'continue';
    memoryDuration: number; // How long to remember threats/encounters
  };
  
  // Performance optimization
  updateFrequency: number; // Hz, how often to update patrol logic
  lastUpdateTime: number;
  lodLevel: number; // Level of detail for patrol processing
  maxWaypointDistance: number; // Maximum distance for waypoint generation
  
  // Debug and visualization
  debugVisualization: {
    enabled: boolean;
    showWaypoints: boolean;
    showPath: boolean;
    showPatrolRadius: boolean;
    showCurrentTarget: boolean;
    waypointLabels: boolean;
  };
  
  // Statistics
  statistics: {
    totalDistanceTraveled: number;
    waypointsVisited: number;
    averageSpeedOverTime: number;
    timeSpentPatrolling: number;
    interruptionCount: number;
  };
}

export function createPatrolComponent(
  patrolType: PatrolType = 'random',
  centerPosition: Vector3,
  patrolRadius: number = 15.0,
  options: Partial<PatrolComponent> = {}
): PatrolComponent {
  return {
    type: 'patrol',
    entityId: 0,
    
    // Configuration
    patrolType,
    isPatrolling: false,
    
    // Waypoints
    waypoints: options.waypoints || [],
    currentWaypointIndex: 0,
    nextWaypointIndex: 0,
    
    // Random patrol
    centerPosition: { ...centerPosition },
    patrolRadius,
    minPatrolRadius: options.minPatrolRadius ?? patrolRadius * 0.3,
    maxPatrolRadius: options.maxPatrolRadius ?? patrolRadius * 1.2,
    
    // Movement
    patrolSpeed: options.patrolSpeed ?? 3.0,
    originalSpeed: options.originalSpeed ?? 5.0,
    speedVariation: options.speedVariation ?? 0.2,
    
    // Wait times
    waypointWaitTime: 0,
    waypointWaitTimer: 0,
    minWaitTime: options.minWaitTime ?? 2.0,
    maxWaitTime: options.maxWaitTime ?? 5.0,
    
    // Movement patterns
    movementPattern: {
      useRandomWalk: true,
      randomWalkIntensity: 0.3,
      avoidBacktracking: true,
      preferredDirection: undefined,
      ...options.movementPattern
    },
    
    // State
    currentTarget: undefined,
    distanceToTarget: 0,
    timeAtCurrentWaypoint: 0,
    totalPatrolTime: 0,
    
    // Interruption handling
    canBeInterrupted: true,
    interruptionCooldown: 2.0,
    lastInterruptionTime: 0,
    resumePatrolDelay: 1.0,
    returnToPatrolSpeed: 8.0,
    
    // Path optimization
    pathOptimization: {
      enabled: false,
      recalculateInterval: 30.0,
      lastRecalculation: 0,
      avoidObstacles: true,
      obstacleAvoidanceRadius: 2.0,
      ...options.pathOptimization
    },
    
    // Boundary enforcement
    boundaryEnforcement: {
      enabled: true,
      boundary: 'circular',
      center: { ...centerPosition },
      size: { x: patrolRadius, y: 0, z: 0 },
      returnMethod: 'direct',
      ...options.boundaryEnforcement
    },
    
    // Group patrol
    groupPatrol: {
      enabled: false,
      groupId: undefined,
      formation: 'loose',
      positionInFormation: 0,
      followDistance: 5.0,
      leaderEntityId: undefined,
      ...options.groupPatrol
    },
    
    // Adaptive behavior
    adaptiveBehavior: {
      enabled: false,
      learningRate: 0.1,
      playerAvoidance: false,
      threatResponse: 'pause',
      memoryDuration: 60.0,
      ...options.adaptiveBehavior
    },
    
    // Performance
    updateFrequency: options.updateFrequency ?? 5, // 5 Hz default
    lastUpdateTime: 0,
    lodLevel: 1,
    maxWaypointDistance: patrolRadius * 2,
    
    // Debug
    debugVisualization: {
      enabled: false,
      showWaypoints: false,
      showPath: false,
      showPatrolRadius: false,
      showCurrentTarget: false,
      waypointLabels: false,
      ...options.debugVisualization
    },
    
    // Statistics
    statistics: {
      totalDistanceTraveled: 0,
      waypointsVisited: 0,
      averageSpeedOverTime: 0,
      timeSpentPatrolling: 0,
      interruptionCount: 0
    }
  };
}

// Specialized patrol components for different enemy types
export function createBearPatrol(centerPosition: Vector3): PatrolComponent {
  return createPatrolComponent('territorial', centerPosition, 15.0, {
    patrolSpeed: 4.0,
    originalSpeed: 8.0,
    minWaitTime: 3.0,
    maxWaitTime: 8.0,
    movementPattern: {
      useRandomWalk: true,
      randomWalkIntensity: 0.2,
      avoidBacktracking: true
    },
    adaptiveBehavior: {
      enabled: true,
      playerAvoidance: false,
      threatResponse: 'investigate'
    },
    updateFrequency: 3 // Slower updates for performance
  });
}

export function createSquirrelPatrol(centerPosition: Vector3): PatrolComponent {
  return createPatrolComponent('random', centerPosition, 10.0, {
    patrolSpeed: 6.0,
    originalSpeed: 12.0,
    minWaitTime: 0.5,
    maxWaitTime: 2.0,
    speedVariation: 0.4,
    movementPattern: {
      useRandomWalk: true,
      randomWalkIntensity: 0.6,
      avoidBacktracking: false
    },
    adaptiveBehavior: {
      enabled: true,
      playerAvoidance: true,
      threatResponse: 'flee'
    },
    updateFrequency: 8 // Higher frequency for agile movement
  });
}

export function createDeerPatrol(centerPosition: Vector3): PatrolComponent {
  return createPatrolComponent('circular', centerPosition, 20.0, {
    patrolSpeed: 5.0,
    originalSpeed: 10.0,
    minWaitTime: 2.0,
    maxWaitTime: 6.0,
    movementPattern: {
      useRandomWalk: true,
      randomWalkIntensity: 0.3,
      avoidBacktracking: true
    },
    adaptiveBehavior: {
      enabled: true,
      playerAvoidance: true,
      threatResponse: 'flee'
    }
  });
}

export function createCoyotePatrol(centerPosition: Vector3): PatrolComponent {
  return createPatrolComponent('waypoint', centerPosition, 25.0, {
    patrolSpeed: 6.0,
    originalSpeed: 11.0,
    minWaitTime: 1.5,
    maxWaitTime: 4.0,
    groupPatrol: {
      enabled: true,
      formation: 'wedge',
      positionInFormation: 0,
      followDistance: 8.0
    },
    adaptiveBehavior: {
      enabled: true,
      playerAvoidance: false,
      threatResponse: 'investigate'
    },
    pathOptimization: {
      enabled: true,
      avoidObstacles: true,
      obstacleAvoidanceRadius: 3.0,
      recalculateInterval: 15.0,
      lastRecalculation: 0
    }
  });
}

export function createRattlesnakePatrol(centerPosition: Vector3): PatrolComponent {
  return createPatrolComponent('guard', centerPosition, 5.0, {
    patrolSpeed: 1.0,
    originalSpeed: 2.0,
    minWaitTime: 5.0,
    maxWaitTime: 15.0,
    movementPattern: {
      useRandomWalk: false,
      randomWalkIntensity: 0.1,
      avoidBacktracking: true
    },
    adaptiveBehavior: {
      enabled: false,
      playerAvoidance: false,
      threatResponse: 'pause'
    },
    updateFrequency: 2 // Very low frequency (mostly stationary)
  });
}

export function createScorpionPatrol(centerPosition: Vector3): PatrolComponent {
  return createPatrolComponent('random', centerPosition, 10.0, {
    patrolSpeed: 2.0,
    originalSpeed: 4.0,
    minWaitTime: 3.0,
    maxWaitTime: 8.0,
    movementPattern: {
      useRandomWalk: true,
      randomWalkIntensity: 0.4,
      avoidBacktracking: true
    },
    adaptiveBehavior: {
      enabled: true,
      playerAvoidance: false,
      threatResponse: 'investigate'
    }
  });
}

// Factory function for creating patrol components by enemy type
export function createPatrolForEnemyType(
  enemyType: string,
  centerPosition: Vector3
): PatrolComponent {
  switch (enemyType) {
    case 'bear': return createBearPatrol(centerPosition);
    case 'squirrel': return createSquirrelPatrol(centerPosition);
    case 'deer': return createDeerPatrol(centerPosition);
    case 'coyote': return createCoyotePatrol(centerPosition);
    case 'rattlesnake': return createRattlesnakePatrol(centerPosition);
    case 'scorpion': return createScorpionPatrol(centerPosition);
    default: return createPatrolComponent('random', centerPosition);
  }
}

// Utility functions for patrol management
export function generateRandomWaypoint(
  patrol: PatrolComponent,
  avoidPosition?: Vector3,
  avoidRadius: number = 5.0
): Vector3 {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const angle = Math.random() * Math.PI * 2;
    const radius = patrol.minPatrolRadius + 
      Math.random() * (patrol.maxPatrolRadius - patrol.minPatrolRadius);
    
    const position = {
      x: patrol.centerPosition.x + Math.cos(angle) * radius,
      y: patrol.centerPosition.y,
      z: patrol.centerPosition.z + Math.sin(angle) * radius
    };
    
    // Check if we should avoid a specific position
    if (avoidPosition) {
      const dx = position.x - avoidPosition.x;
      const dz = position.z - avoidPosition.z;
      const distanceToAvoid = Math.sqrt(dx * dx + dz * dz);
      
      if (distanceToAvoid > avoidRadius) {
        return position;
      }
    } else {
      return position;
    }
    
    attempts++;
  }
  
  // Fallback: return a position on the patrol radius
  const angle = Math.random() * Math.PI * 2;
  return {
    x: patrol.centerPosition.x + Math.cos(angle) * patrol.patrolRadius,
    y: patrol.centerPosition.y,
    z: patrol.centerPosition.z + Math.sin(angle) * patrol.patrolRadius
  };
}

export function generateCircularWaypoints(
  patrol: PatrolComponent,
  numWaypoints: number = 6
): PatrolWaypoint[] {
  const waypoints: PatrolWaypoint[] = [];
  const angleStep = (Math.PI * 2) / numWaypoints;
  
  for (let i = 0; i < numWaypoints; i++) {
    const angle = i * angleStep;
    const position = {
      x: patrol.centerPosition.x + Math.cos(angle) * patrol.patrolRadius,
      y: patrol.centerPosition.y,
      z: patrol.centerPosition.z + Math.sin(angle) * patrol.patrolRadius
    };
    
    waypoints.push({
      id: `circular_${i}`,
      position,
      waitTime: patrol.minWaitTime + 
        Math.random() * (patrol.maxWaitTime - patrol.minWaitTime),
      arrivalRadius: 1.0,
      speed: 1.0
    });
  }
  
  return waypoints;
}

export function generateLinearWaypoints(
  patrol: PatrolComponent,
  startPos: Vector3,
  endPos: Vector3,
  numWaypoints: number = 4
): PatrolWaypoint[] {
  const waypoints: PatrolWaypoint[] = [];
  
  for (let i = 0; i <= numWaypoints + 1; i++) {
    const t = i / (numWaypoints + 1);
    const position = {
      x: startPos.x + (endPos.x - startPos.x) * t,
      y: startPos.y + (endPos.y - startPos.y) * t,
      z: startPos.z + (endPos.z - startPos.z) * t
    };
    
    waypoints.push({
      id: `linear_${i}`,
      position,
      waitTime: patrol.minWaitTime + 
        Math.random() * (patrol.maxWaitTime - patrol.minWaitTime),
      arrivalRadius: 1.0,
      speed: 1.0
    });
  }
  
  return waypoints;
}

export function addWaypoint(
  patrol: PatrolComponent,
  position: Vector3,
  waitTime?: number,
  speed?: number
): void {
  const waypoint: PatrolWaypoint = {
    id: `waypoint_${patrol.waypoints.length}`,
    position: { ...position },
    waitTime: waitTime ?? (patrol.minWaitTime + 
      Math.random() * (patrol.maxWaitTime - patrol.minWaitTime)),
    arrivalRadius: 1.0,
    speed: speed ?? 1.0
  };
  
  patrol.waypoints.push(waypoint);
}

export function getNextWaypoint(patrol: PatrolComponent): PatrolWaypoint | null {
  if (patrol.waypoints.length === 0) return null;
  
  let nextIndex = patrol.currentWaypointIndex + 1;
  
  // Handle different patrol types
  switch (patrol.patrolType) {
    case 'linear':
      if (nextIndex >= patrol.waypoints.length) {
        // Reverse direction for linear patrol
        patrol.waypoints.reverse();
        nextIndex = 1;
      }
      break;
      
    case 'circular':
    case 'waypoint':
      if (nextIndex >= patrol.waypoints.length) {
        nextIndex = 0; // Loop back to start
      }
      break;
      
    case 'random':
      // Pick a random waypoint, avoid backtracking if enabled
      if (patrol.movementPattern.avoidBacktracking && patrol.waypoints.length > 2) {
        const availableIndices = patrol.waypoints
          .map((_, index) => index)
          .filter(index => index !== patrol.currentWaypointIndex);
        nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      } else {
        nextIndex = Math.floor(Math.random() * patrol.waypoints.length);
      }
      break;
  }
  
  patrol.nextWaypointIndex = nextIndex;
  return patrol.waypoints[nextIndex];
}

export function isWithinPatrolBounds(patrol: PatrolComponent, position: Vector3): boolean {
  if (!patrol.boundaryEnforcement.enabled) return true;
  
  const boundary = patrol.boundaryEnforcement;
  const dx = position.x - boundary.center.x;
  const dz = position.z - boundary.center.z;
  
  if (boundary.boundary === 'circular') {
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance <= boundary.size.x; // x component is radius
  } else {
    // Rectangular boundary
    return Math.abs(dx) <= boundary.size.x / 2 && 
           Math.abs(dz) <= boundary.size.z / 2;
  }
}