import type { Component, Vector3 } from '@/types';

export type NavigationState = 'idle' | 'moving' | 'calculating' | 'stuck' | 'avoiding';

export interface PathNode {
  position: Vector3;
  gCost: number; // Distance from start
  hCost: number; // Distance to target (heuristic)
  fCost: number; // Total cost (g + h)
  parent?: PathNode;
  isWalkable: boolean;
}

export interface Obstacle {
  id: string;
  position: Vector3;
  radius: number;
  height: number;
  type: 'static' | 'dynamic' | 'temporary';
  avoidanceRadius: number;
}

export interface NavigationComponent extends Component {
  type: 'navigation';
  
  // Current navigation state
  state: NavigationState;
  
  // Target and path
  targetPosition?: Vector3;
  currentPath: Vector3[];
  currentPathIndex: number;
  pathGenerated: boolean;
  pathLength: number;
  
  // Movement settings
  moveSpeed: number;
  rotationSpeed: number;
  acceleration: number;
  deceleration: number;
  
  // Pathfinding configuration
  pathfinding: {
    enabled: boolean;
    algorithm: 'astar' | 'simple' | 'flow_field' | 'steering';
    gridSize: number; // Size of pathfinding grid cells
    maxSearchNodes: number; // Maximum nodes to search
    heuristicWeight: number; // A* heuristic weight
    smoothingEnabled: boolean; // Smooth jagged paths
    simplificationEnabled: boolean; // Remove unnecessary waypoints
  };
  
  // Arrival and stopping
  arrivalRadius: number; // How close to get to target
  slowdownRadius: number; // Start slowing down at this distance
  stopRadius: number; // Completely stop at this distance
  
  // Obstacle avoidance
  obstacleAvoidance: {
    enabled: boolean;
    lookAheadDistance: number;
    avoidanceRadius: number;
    maxAvoidanceForce: number;
    raycastCount: number; // Number of rays for detection
    avoidanceWeight: number; // How strongly to avoid obstacles
    dynamicObstacles: boolean; // Avoid moving obstacles
  };
  
  // Steering behaviors
  steering: {
    seekWeight: number; // Weight for seeking target
    separationWeight: number; // Avoid other entities
    alignmentWeight: number; // Align with neighbors
    cohesionWeight: number; // Move toward group center
    wanderWeight: number; // Random wandering
    maxForce: number; // Maximum steering force
    maxSpeed: number; // Maximum movement speed
  };
  
  // Stuck detection and recovery
  stuckDetection: {
    enabled: boolean;
    positionThreshold: number; // Minimum movement to not be stuck
    timeThreshold: number; // Time before considering stuck
    lastPosition: Vector3;
    stuckTimer: number;
    recoveryAttempts: number;
    maxRecoveryAttempts: number;
  };
  
  // Terrain awareness
  terrainAwareness: {
    enabled: boolean;
    groundCheckDistance: number;
    maxSlopeAngle: number; // Maximum climbable slope in degrees
    jumpHeight: number; // Maximum jump height
    canJump: boolean;
    preferredTerrainTypes: string[];
    avoidedTerrainTypes: string[];
  };
  
  // Group navigation (flocking, formations)
  groupNavigation: {
    enabled: boolean;
    groupId?: string;
    separationRadius: number;
    alignmentRadius: number;
    cohesionRadius: number;
    leaderFollowing: boolean;
    formationPosition?: Vector3; // Relative position in formation
  };
  
  // Performance optimization
  performance: {
    updateFrequency: number; // Hz
    lastUpdateTime: number;
    lodLevel: number; // Level of detail
    pathRecalculationInterval: number; // How often to recalculate path
    lastPathCalculation: number;
    simplifyPath: boolean; // Remove redundant waypoints
  };
  
  // Adaptive navigation
  adaptive: {
    enabled: boolean;
    learningRate: number;
    preferredPaths: Map<string, Vector3[]>; // Remember successful paths
    pathSuccessRate: Map<string, number>; // Track path success
    adaptToPlayerBehavior: boolean;
  };
  
  // Current movement state
  velocity: Vector3;
  desiredVelocity: Vector3;
  steeringForce: Vector3;
  lastValidPosition: Vector3;
  
  // Obstacle tracking
  detectedObstacles: Obstacle[];
  avoidanceVector: Vector3;
  
  // Statistics and debugging
  statistics: {
    totalDistanceTraveled: number;
    pathCalculations: number;
    successfulPaths: number;
    failedPaths: number;
    averagePathLength: number;
    stuckCount: number;
  };
  
  // Debug visualization
  debugVisualization: {
    enabled: boolean;
    showPath: boolean;
    showWaypoints: boolean;
    showObstacles: boolean;
    showSteeringForces: boolean;
    showVelocity: boolean;
    pathColor: string;
    waypointColor: string;
  };
}

export function createNavigationComponent(
  options: Partial<NavigationComponent> = {}
): NavigationComponent {
  return {
    type: 'navigation',
    entityId: 0,
    
    // State
    state: 'idle',
    
    // Target and path
    targetPosition: undefined,
    currentPath: [],
    currentPathIndex: 0,
    pathGenerated: false,
    pathLength: 0,
    
    // Movement settings
    moveSpeed: options.moveSpeed ?? 5.0,
    rotationSpeed: options.rotationSpeed ?? 3.0,
    acceleration: options.acceleration ?? 10.0,
    deceleration: options.deceleration ?? 8.0,
    
    // Pathfinding
    pathfinding: {
      enabled: true,
      algorithm: 'astar',
      gridSize: 1.0,
      maxSearchNodes: 1000,
      heuristicWeight: 1.0,
      smoothingEnabled: true,
      simplificationEnabled: true,
      ...options.pathfinding
    },
    
    // Arrival
    arrivalRadius: options.arrivalRadius ?? 1.0,
    slowdownRadius: options.slowdownRadius ?? 3.0,
    stopRadius: options.stopRadius ?? 0.5,
    
    // Obstacle avoidance
    obstacleAvoidance: {
      enabled: true,
      lookAheadDistance: 5.0,
      avoidanceRadius: 2.0,
      maxAvoidanceForce: 10.0,
      raycastCount: 5,
      avoidanceWeight: 2.0,
      dynamicObstacles: true,
      ...options.obstacleAvoidance
    },
    
    // Steering
    steering: {
      seekWeight: 1.0,
      separationWeight: 2.0,
      alignmentWeight: 1.0,
      cohesionWeight: 1.0,
      wanderWeight: 0.5,
      maxForce: 15.0,
      maxSpeed: 10.0,
      ...options.steering
    },
    
    // Stuck detection
    stuckDetection: {
      enabled: true,
      positionThreshold: 0.1,
      timeThreshold: 2.0,
      lastPosition: { x: 0, y: 0, z: 0 },
      stuckTimer: 0,
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3
    },
    
    // Terrain awareness
    terrainAwareness: {
      enabled: true,
      groundCheckDistance: 2.0,
      maxSlopeAngle: 45,
      jumpHeight: 1.0,
      canJump: false,
      preferredTerrainTypes: [],
      avoidedTerrainTypes: []
    },
    
    // Group navigation
    groupNavigation: {
      enabled: false,
      separationRadius: 3.0,
      alignmentRadius: 5.0,
      cohesionRadius: 8.0,
      leaderFollowing: false,
      ...options.groupNavigation
    },
    
    // Performance
    performance: {
      updateFrequency: 10,
      lastUpdateTime: 0,
      lodLevel: 1,
      pathRecalculationInterval: 2.0,
      lastPathCalculation: 0,
      simplifyPath: true
    },
    
    // Adaptive
    adaptive: {
      enabled: false,
      learningRate: 0.1,
      preferredPaths: new Map(),
      pathSuccessRate: new Map(),
      adaptToPlayerBehavior: false
    },
    
    // Movement state
    velocity: { x: 0, y: 0, z: 0 },
    desiredVelocity: { x: 0, y: 0, z: 0 },
    steeringForce: { x: 0, y: 0, z: 0 },
    lastValidPosition: { x: 0, y: 0, z: 0 },
    
    // Obstacles
    detectedObstacles: [],
    avoidanceVector: { x: 0, y: 0, z: 0 },
    
    // Statistics
    statistics: {
      totalDistanceTraveled: 0,
      pathCalculations: 0,
      successfulPaths: 0,
      failedPaths: 0,
      averagePathLength: 0,
      stuckCount: 0
    },
    
    // Debug
    debugVisualization: {
      enabled: false,
      showPath: false,
      showWaypoints: false,
      showObstacles: false,
      showSteeringForces: false,
      showVelocity: false,
      pathColor: '#00ff00',
      waypointColor: '#ffff00'
    }
  };
}

// Specialized navigation components for different enemy types
export function createBearNavigation(): NavigationComponent {
  return createNavigationComponent({
    moveSpeed: 8.0,
    rotationSpeed: 2.0,
    arrivalRadius: 2.0,
    pathfinding: {
      enabled: true,
      algorithm: 'simple',
      gridSize: 2.0,
      maxSearchNodes: 500,
      heuristicWeight: 1.2,
      smoothingEnabled: false,
      simplificationEnabled: true
    },
    obstacleAvoidance: {
      enabled: true,
      lookAheadDistance: 6.0,
      avoidanceRadius: 3.0,
      maxAvoidanceForce: 12.0,
      raycastCount: 3,
      avoidanceWeight: 1.5,
      dynamicObstacles: false
    },
    terrainAwareness: {
      enabled: true,
      groundCheckDistance: 2.5,
      maxSlopeAngle: 60,
      jumpHeight: 0.5,
      canJump: false,
      preferredTerrainTypes: [],
      avoidedTerrainTypes: []
    },
    performance: {
      updateFrequency: 8,
      lastUpdateTime: 0,
      lodLevel: 1,
      pathRecalculationInterval: 3.0,
      lastPathCalculation: 0,
      simplifyPath: true
    }
  });
}

export function createSquirrelNavigation(): NavigationComponent {
  return createNavigationComponent({
    moveSpeed: 12.0,
    rotationSpeed: 6.0,
    arrivalRadius: 0.8,
    pathfinding: {
      enabled: true,
      algorithm: 'astar',
      gridSize: 0.5,
      maxSearchNodes: 800,
      heuristicWeight: 1.0,
      smoothingEnabled: true,
      simplificationEnabled: true
    },
    obstacleAvoidance: {
      enabled: true,
      lookAheadDistance: 3.0,
      avoidanceRadius: 1.5,
      maxAvoidanceForce: 20.0,
      raycastCount: 7,
      avoidanceWeight: 3.0,
      dynamicObstacles: true
    },
    terrainAwareness: {
      enabled: true,
      groundCheckDistance: 1.0,
      maxSlopeAngle: 80,
      jumpHeight: 2.0,
      canJump: true,
      preferredTerrainTypes: [],
      avoidedTerrainTypes: []
    },
    performance: {
      updateFrequency: 15,
      lastUpdateTime: 0,
      lodLevel: 1,
      pathRecalculationInterval: 1.0,
      lastPathCalculation: 0,
      simplifyPath: false
    }
  });
}

export function createDeerNavigation(): NavigationComponent {
  return createNavigationComponent({
    moveSpeed: 10.0,
    rotationSpeed: 4.0,
    arrivalRadius: 1.5,
    pathfinding: {
      enabled: true,
      algorithm: 'astar',
      gridSize: 1.5,
      maxSearchNodes: 600,
      heuristicWeight: 1.1,
      smoothingEnabled: true,
      simplificationEnabled: true
    },
    obstacleAvoidance: {
      enabled: true,
      lookAheadDistance: 5.0,
      avoidanceRadius: 2.5,
      maxAvoidanceForce: 15.0,
      raycastCount: 5,
      avoidanceWeight: 2.5,
      dynamicObstacles: true
    },
    terrainAwareness: {
      enabled: true,
      groundCheckDistance: 2.0,
      maxSlopeAngle: 50,
      jumpHeight: 1.5,
      canJump: true,
      preferredTerrainTypes: [],
      avoidedTerrainTypes: []
    }
  });
}

export function createCoyoteNavigation(): NavigationComponent {
  return createNavigationComponent({
    moveSpeed: 11.0,
    rotationSpeed: 3.5,
    arrivalRadius: 1.2,
    pathfinding: {
      enabled: true,
      algorithm: 'astar',
      gridSize: 1.0,
      maxSearchNodes: 1000,
      heuristicWeight: 1.0,
      smoothingEnabled: true,
      simplificationEnabled: true
    },
    obstacleAvoidance: {
      enabled: true,
      lookAheadDistance: 4.0,
      avoidanceRadius: 2.0,
      maxAvoidanceForce: 18.0,
      raycastCount: 5,
      avoidanceWeight: 2.0,
      dynamicObstacles: true
    },
    groupNavigation: {
      enabled: true,
      separationRadius: 4.0,
      alignmentRadius: 8.0,
      cohesionRadius: 12.0,
      leaderFollowing: false
    },
    adaptive: {
      enabled: true,
      learningRate: 0.2,
      preferredPaths: new Map(),
      pathSuccessRate: new Map(),
      adaptToPlayerBehavior: true
    }
  });
}

export function createRattlesnakeNavigation(): NavigationComponent {
  return createNavigationComponent({
    moveSpeed: 2.0,
    rotationSpeed: 1.5,
    arrivalRadius: 0.5,
    pathfinding: {
      enabled: false, // Mostly stationary
      algorithm: 'simple',
      gridSize: 0.5,
      maxSearchNodes: 100,
      heuristicWeight: 1.5,
      smoothingEnabled: false,
      simplificationEnabled: true
    },
    obstacleAvoidance: {
      enabled: false,
      lookAheadDistance: 1.0,
      avoidanceRadius: 0.5,
      maxAvoidanceForce: 5.0,
      raycastCount: 3,
      avoidanceWeight: 1.0,
      dynamicObstacles: false
    },
    terrainAwareness: {
      enabled: true,
      groundCheckDistance: 0.5,
      maxSlopeAngle: 30,
      jumpHeight: 0,
      canJump: false,
      preferredTerrainTypes: [],
      avoidedTerrainTypes: []
    },
    performance: {
      updateFrequency: 3,
      lastUpdateTime: 0,
      lodLevel: 1,
      pathRecalculationInterval: 10.0,
      lastPathCalculation: 0,
      simplifyPath: true
    }
  });
}

export function createScorpionNavigation(): NavigationComponent {
  return createNavigationComponent({
    moveSpeed: 4.0,
    rotationSpeed: 2.5,
    arrivalRadius: 1.0,
    pathfinding: {
      enabled: true,
      algorithm: 'simple',
      gridSize: 1.0,
      maxSearchNodes: 400,
      heuristicWeight: 1.3,
      smoothingEnabled: false,
      simplificationEnabled: true
    },
    obstacleAvoidance: {
      enabled: true,
      lookAheadDistance: 2.0,
      avoidanceRadius: 1.5,
      maxAvoidanceForce: 8.0,
      raycastCount: 3,
      avoidanceWeight: 1.5,
      dynamicObstacles: true
    },
    terrainAwareness: {
      enabled: true,
      groundCheckDistance: 1.0,
      maxSlopeAngle: 40,
      jumpHeight: 0.2,
      canJump: false,
      preferredTerrainTypes: [],
      avoidedTerrainTypes: []
    },
    performance: {
      updateFrequency: 6,
      lastUpdateTime: 0,
      lodLevel: 1,
      pathRecalculationInterval: 4.0,
      lastPathCalculation: 0,
      simplifyPath: true
    }
  });
}

// Factory function for creating navigation components by enemy type
export function createNavigationForEnemyType(enemyType: string): NavigationComponent {
  switch (enemyType) {
    case 'bear': return createBearNavigation();
    case 'squirrel': return createSquirrelNavigation();
    case 'deer': return createDeerNavigation();
    case 'coyote': return createCoyoteNavigation();
    case 'rattlesnake': return createRattlesnakeNavigation();
    case 'scorpion': return createScorpionNavigation();
    default: return createNavigationComponent();
  }
}

// Utility functions for navigation
export function setNavigationTarget(
  navigation: NavigationComponent,
  target: Vector3
): void {
  navigation.targetPosition = { ...target };
  navigation.state = 'calculating';
  navigation.currentPath = [];
  navigation.currentPathIndex = 0;
  navigation.pathGenerated = false;
}

export function addObstacle(
  navigation: NavigationComponent,
  obstacle: Obstacle
): void {
  // Remove existing obstacle with same ID
  navigation.detectedObstacles = navigation.detectedObstacles.filter(
    obs => obs.id !== obstacle.id
  );
  
  navigation.detectedObstacles.push(obstacle);
  
  // Limit obstacle count for performance
  if (navigation.detectedObstacles.length > 20) {
    navigation.detectedObstacles.shift();
  }
}

export function removeObstacle(
  navigation: NavigationComponent,
  obstacleId: string
): void {
  navigation.detectedObstacles = navigation.detectedObstacles.filter(
    obs => obs.id !== obstacleId
  );
}

export function isStuck(navigation: NavigationComponent): boolean {
  return navigation.state === 'stuck' || 
         navigation.stuckDetection.stuckTimer > navigation.stuckDetection.timeThreshold;
}

export function getCurrentWaypoint(navigation: NavigationComponent): Vector3 | null {
  if (navigation.currentPath.length === 0 || 
      navigation.currentPathIndex >= navigation.currentPath.length) {
    return null;
  }
  
  return navigation.currentPath[navigation.currentPathIndex];
}

export function advanceToNextWaypoint(navigation: NavigationComponent): boolean {
  if (navigation.currentPathIndex < navigation.currentPath.length - 1) {
    navigation.currentPathIndex++;
    return true;
  }
  return false;
}

export function clearPath(navigation: NavigationComponent): void {
  navigation.currentPath = [];
  navigation.currentPathIndex = 0;
  navigation.pathGenerated = false;
  navigation.targetPosition = undefined;
  navigation.state = 'idle';
}

export function calculateDistance(pos1: Vector3, pos2: Vector3): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

export function addVectors(v1: Vector3, v2: Vector3): Vector3 {
  return {
    x: v1.x + v2.x,
    y: v1.y + v2.y,
    z: v1.z + v2.z
  };
}

export function subtractVectors(v1: Vector3, v2: Vector3): Vector3 {
  return {
    x: v1.x - v2.x,
    y: v1.y - v2.y,
    z: v1.z - v2.z
  };
}

export function scaleVector(vector: Vector3, scale: number): Vector3 {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale
  };
}

export function limitVector(vector: Vector3, maxLength: number): Vector3 {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (length > maxLength) {
    const scale = maxLength / length;
    return scaleVector(vector, scale);
  }
  return vector;
}