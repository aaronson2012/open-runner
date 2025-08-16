import { BaseSystem } from '@/systems/core/BaseSystem';
import type { Entity, ComponentType, Vector3 } from '@/types';
import type { NavigationComponent, NavigationState, PathNode, Obstacle } from '@/components/ai/NavigationComponent';
import type { TransformComponent } from '@/components/core/CoreComponents';
import type { AIComponent } from '@/components/ai/AIComponent';
import type { EnemyComponent } from '@/components/ai/EnemyComponent';
import {
  setNavigationTarget,
  addObstacle,
  isStuck,
  getCurrentWaypoint,
  advanceToNextWaypoint,
  clearPath,
  calculateDistance,
  normalizeVector,
  addVectors,
  subtractVectors,
  scaleVector,
  limitVector
} from '@/components/ai/NavigationComponent';

/**
 * Navigation System handles pathfinding and movement for AI entities
 */
export class NavigationSystem extends BaseSystem {
  private spatialGrid: Map<string, Entity[]> = new Map();
  private gridSize = 10; // Size of spatial grid cells
  private obstacleCache: Map<string, Obstacle[]> = new Map();
  private pathfindingWorker?: Worker;

  constructor() {
    super('navigation-system', ['navigation', 'transform'], 15); // High priority for movement
  }

  protected onInit(): void {
    this.debug('Navigation System initialized');
    // Initialize spatial grid
    this.initializeSpatialGrid();
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Update spatial grid
    this.updateSpatialGrid(entities);
    
    // Process each navigation entity
    for (const entity of entities) {
      const navigation = this.getComponent<NavigationComponent>(entity, 'navigation');
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      
      if (!navigation || !transform) continue;
      
      // Check if navigation should update this frame
      if (!this.shouldUpdateNavigation(navigation, deltaTime)) continue;
      
      // Update navigation state
      this.updateNavigationState(navigation, transform, deltaTime);
      
      // Process current navigation behavior
      this.processNavigation(navigation, transform, entity, deltaTime);
      
      // Update movement
      this.updateMovement(navigation, transform, deltaTime);
      
      // Detect and handle obstacles
      this.handleObstacleAvoidance(navigation, transform, entity);
      
      // Update stuck detection
      this.updateStuckDetection(navigation, transform, deltaTime);
      
      // Update statistics
      this.updateStatistics(navigation, transform, deltaTime);
    }
  }

  private initializeSpatialGrid(): void {
    this.spatialGrid.clear();
  }

  private updateSpatialGrid(entities: Entity[]): void {
    this.spatialGrid.clear();
    
    for (const entity of entities) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      if (!transform) continue;
      
      const gridKey = this.getGridKey(transform.position);
      if (!this.spatialGrid.has(gridKey)) {
        this.spatialGrid.set(gridKey, []);
      }
      this.spatialGrid.get(gridKey)!.push(entity);
    }
  }

  private getGridKey(position: Vector3): string {
    const x = Math.floor(position.x / this.gridSize);
    const z = Math.floor(position.z / this.gridSize);
    return `${x},${z}`;
  }

  private shouldUpdateNavigation(navigation: NavigationComponent, deltaTime: number): boolean {
    const currentTime = Date.now() / 1000;
    const updateInterval = 1.0 / navigation.performance.updateFrequency;
    
    if (currentTime - navigation.performance.lastUpdateTime >= updateInterval) {
      navigation.performance.lastUpdateTime = currentTime;
      return true;
    }
    
    return false;
  }

  private updateNavigationState(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    switch (navigation.state) {
      case 'idle':
        // Do nothing, waiting for target
        break;
        
      case 'calculating':
        this.processPathCalculation(navigation, transform);
        break;
        
      case 'moving':
        this.processMovement(navigation, transform, deltaTime);
        break;
        
      case 'stuck':
        this.processStuckRecovery(navigation, transform, deltaTime);
        break;
        
      case 'avoiding':
        this.processObstacleAvoidance(navigation, transform, deltaTime);
        break;
    }
  }

  private processPathCalculation(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): void {
    if (!navigation.targetPosition) {
      navigation.state = 'idle';
      return;
    }
    
    // Calculate path based on algorithm
    switch (navigation.pathfinding.algorithm) {
      case 'simple':
        this.calculateSimplePath(navigation, transform);
        break;
      case 'astar':
        this.calculateAStarPath(navigation, transform);
        break;
      case 'flow_field':
        this.calculateFlowFieldPath(navigation, transform);
        break;
      case 'steering':
        this.calculateSteeringPath(navigation, transform);
        break;
    }
    
    navigation.state = navigation.pathGenerated ? 'moving' : 'idle';
    navigation.performance.lastPathCalculation = Date.now() / 1000;
    navigation.statistics.pathCalculations++;
  }

  private calculateSimplePath(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): void {
    if (!navigation.targetPosition) return;
    
    // Simple direct path with basic obstacle avoidance
    const start = transform.position;
    const end = navigation.targetPosition;
    
    navigation.currentPath = [start, end];
    navigation.currentPathIndex = 0;
    navigation.pathGenerated = true;
    navigation.pathLength = calculateDistance(start, end);
  }

  private calculateAStarPath(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): void {
    if (!navigation.targetPosition) return;
    
    const start = transform.position;
    const end = navigation.targetPosition;
    const gridSize = navigation.pathfinding.gridSize;
    
    // A* pathfinding implementation
    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();
    const nodeMap: Map<string, PathNode> = new Map();
    
    // Create start node
    const startNode: PathNode = {
      position: { ...start },
      gCost: 0,
      hCost: this.heuristic(start, end),
      fCost: 0,
      isWalkable: true
    };
    startNode.fCost = startNode.gCost + startNode.hCost;
    
    openSet.push(startNode);
    nodeMap.set(this.getNodeKey(start, gridSize), startNode);
    
    let iterations = 0;
    const maxIterations = navigation.pathfinding.maxSearchNodes;
    
    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;
      
      // Get node with lowest fCost
      openSet.sort((a, b) => a.fCost - b.fCost);
      const currentNode = openSet.shift()!;
      const currentKey = this.getNodeKey(currentNode.position, gridSize);
      
      closedSet.add(currentKey);
      
      // Check if we reached the target
      if (calculateDistance(currentNode.position, end) < gridSize) {
        navigation.currentPath = this.reconstructPath(currentNode);
        navigation.currentPathIndex = 0;
        navigation.pathGenerated = true;
        navigation.pathLength = this.calculatePathLength(navigation.currentPath);
        return;
      }
      
      // Check neighbors
      const neighbors = this.getNeighbors(currentNode.position, gridSize);
      
      for (const neighborPos of neighbors) {
        const neighborKey = this.getNodeKey(neighborPos, gridSize);
        
        if (closedSet.has(neighborKey)) continue;
        if (!this.isWalkable(neighborPos, navigation)) continue;
        
        const gCost = currentNode.gCost + calculateDistance(currentNode.position, neighborPos);
        const hCost = this.heuristic(neighborPos, end) * navigation.pathfinding.heuristicWeight;
        const fCost = gCost + hCost;
        
        let neighborNode = nodeMap.get(neighborKey);
        
        if (!neighborNode) {
          neighborNode = {
            position: neighborPos,
            gCost,
            hCost,
            fCost,
            parent: currentNode,
            isWalkable: true
          };
          nodeMap.set(neighborKey, neighborNode);
          openSet.push(neighborNode);
        } else if (gCost < neighborNode.gCost) {
          neighborNode.gCost = gCost;
          neighborNode.fCost = fCost;
          neighborNode.parent = currentNode;
        }
      }
    }
    
    // No path found
    navigation.pathGenerated = false;
    navigation.statistics.failedPaths++;
  }

  private calculateFlowFieldPath(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): void {
    // Simplified flow field - would need proper implementation for complex scenarios
    this.calculateSimplePath(navigation, transform);
  }

  private calculateSteeringPath(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): void {
    if (!navigation.targetPosition) return;
    
    // Use steering behaviors instead of discrete path
    navigation.currentPath = [];
    navigation.pathGenerated = true;
    navigation.state = 'moving';
  }

  private heuristic(pos1: Vector3, pos2: Vector3): number {
    // Manhattan distance heuristic
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z);
  }

  private getNodeKey(position: Vector3, gridSize: number): string {
    const x = Math.floor(position.x / gridSize);
    const z = Math.floor(position.z / gridSize);
    return `${x},${z}`;
  }

  private getNeighbors(position: Vector3, gridSize: number): Vector3[] {
    const neighbors: Vector3[] = [];
    const offsets = [
      { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 },
      { x: -1, z: -1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: 1, z: 1 }
    ];
    
    for (const offset of offsets) {
      neighbors.push({
        x: position.x + offset.x * gridSize,
        y: position.y,
        z: position.z + offset.z * gridSize
      });
    }
    
    return neighbors;
  }

  private isWalkable(position: Vector3, navigation: NavigationComponent): boolean {
    // Check obstacles
    for (const obstacle of navigation.detectedObstacles) {
      const distance = calculateDistance(position, obstacle.position);
      if (distance < obstacle.avoidanceRadius) {
        return false;
      }
    }
    
    // Check terrain (would need terrain system integration)
    // For now, assume all positions are walkable
    return true;
  }

  private reconstructPath(endNode: PathNode): Vector3[] {
    const path: Vector3[] = [];
    let currentNode: PathNode | undefined = endNode;
    
    while (currentNode) {
      path.unshift({ ...currentNode.position });
      currentNode = currentNode.parent;
    }
    
    return path;
  }

  private calculatePathLength(path: Vector3[]): number {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += calculateDistance(path[i - 1], path[i]);
    }
    return length;
  }

  private processMovement(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    if (navigation.pathfinding.algorithm === 'steering') {
      this.processSteeringMovement(navigation, transform, deltaTime);
    } else {
      this.processWaypointMovement(navigation, transform, deltaTime);
    }
  }

  private processWaypointMovement(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    const currentWaypoint = getCurrentWaypoint(navigation);
    if (!currentWaypoint) {
      navigation.state = 'idle';
      return;
    }
    
    const distance = calculateDistance(transform.position, currentWaypoint);
    
    if (distance <= navigation.arrivalRadius) {
      // Reached waypoint
      if (!advanceToNextWaypoint(navigation)) {
        // Reached final destination
        navigation.state = 'idle';
        navigation.targetPosition = undefined;
        navigation.statistics.successfulPaths++;
      }
    } else {
      // Move toward waypoint
      const direction = normalizeVector(subtractVectors(currentWaypoint, transform.position));
      const moveDistance = navigation.moveSpeed * deltaTime;
      
      // Apply movement
      const movement = scaleVector(direction, moveDistance);
      transform.position = addVectors(transform.position, movement);
      
      // Update velocity for physics
      navigation.velocity = scaleVector(direction, navigation.moveSpeed);
    }
  }

  private processSteeringMovement(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    if (!navigation.targetPosition) return;
    
    // Calculate steering forces
    const steeringForce = this.calculateSteeringForce(navigation, transform);
    
    // Apply forces
    navigation.steeringForce = limitVector(steeringForce, navigation.steering.maxForce);
    navigation.velocity = limitVector(
      addVectors(navigation.velocity, scaleVector(navigation.steeringForce, deltaTime)),
      navigation.steering.maxSpeed
    );
    
    // Apply movement
    const movement = scaleVector(navigation.velocity, deltaTime);
    transform.position = addVectors(transform.position, movement);
  }

  private calculateSteeringForce(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): Vector3 {
    let totalForce = { x: 0, y: 0, z: 0 };
    
    // Seek force (toward target)
    if (navigation.targetPosition) {
      const seekForce = this.calculateSeekForce(navigation, transform, navigation.targetPosition);
      totalForce = addVectors(totalForce, scaleVector(seekForce, navigation.steering.seekWeight));
    }
    
    // Separation force (avoid other entities)
    const separationForce = this.calculateSeparationForce(navigation, transform);
    totalForce = addVectors(totalForce, scaleVector(separationForce, navigation.steering.separationWeight));
    
    // Obstacle avoidance force
    const avoidanceForce = this.calculateObstacleAvoidanceForce(navigation, transform);
    totalForce = addVectors(totalForce, scaleVector(avoidanceForce, navigation.obstacleAvoidance.avoidanceWeight));
    
    return totalForce;
  }

  private calculateSeekForce(
    navigation: NavigationComponent,
    transform: TransformComponent,
    target: Vector3
  ): Vector3 {
    const desired = subtractVectors(target, transform.position);
    const distance = Math.sqrt(desired.x * desired.x + desired.y * desired.y + desired.z * desired.z);
    
    if (distance === 0) return { x: 0, y: 0, z: 0 };
    
    const normalizedDesired = scaleVector(desired, 1 / distance);
    let desiredVelocity: Vector3;
    
    if (distance < navigation.slowdownRadius) {
      // Slow down as we approach target
      const slowdownFactor = distance / navigation.slowdownRadius;
      desiredVelocity = scaleVector(normalizedDesired, navigation.moveSpeed * slowdownFactor);
    } else {
      desiredVelocity = scaleVector(normalizedDesired, navigation.moveSpeed);
    }
    
    return subtractVectors(desiredVelocity, navigation.velocity);
  }

  private calculateSeparationForce(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): Vector3 {
    if (!navigation.groupNavigation.enabled) {
      return { x: 0, y: 0, z: 0 };
    }
    
    const separationRadius = navigation.groupNavigation.separationRadius;
    const gridKey = this.getGridKey(transform.position);
    const nearbyEntities = this.spatialGrid.get(gridKey) || [];
    
    let separationForce = { x: 0, y: 0, z: 0 };
    let count = 0;
    
    for (const entity of nearbyEntities) {
      const otherTransform = this.getComponent<TransformComponent>(entity, 'transform');
      if (!otherTransform || entity.id === navigation.entityId) continue;
      
      const distance = calculateDistance(transform.position, otherTransform.position);
      if (distance > 0 && distance < separationRadius) {
        const diff = normalizeVector(subtractVectors(transform.position, otherTransform.position));
        const weight = 1.0 / distance; // Closer = stronger force
        separationForce = addVectors(separationForce, scaleVector(diff, weight));
        count++;
      }
    }
    
    if (count > 0) {
      separationForce = scaleVector(separationForce, 1.0 / count);
      return normalizeVector(separationForce);
    }
    
    return { x: 0, y: 0, z: 0 };
  }

  private calculateObstacleAvoidanceForce(
    navigation: NavigationComponent,
    transform: TransformComponent
  ): Vector3 {
    if (!navigation.obstacleAvoidance.enabled) {
      return { x: 0, y: 0, z: 0 };
    }
    
    let avoidanceForce = { x: 0, y: 0, z: 0 };
    const lookAheadDistance = navigation.obstacleAvoidance.lookAheadDistance;
    
    for (const obstacle of navigation.detectedObstacles) {
      const distanceToObstacle = calculateDistance(transform.position, obstacle.position);
      
      if (distanceToObstacle < obstacle.avoidanceRadius + lookAheadDistance) {
        const direction = normalizeVector(subtractVectors(transform.position, obstacle.position));
        const strength = 1.0 - (distanceToObstacle / (obstacle.avoidanceRadius + lookAheadDistance));
        avoidanceForce = addVectors(avoidanceForce, scaleVector(direction, strength));
      }
    }
    
    return avoidanceForce;
  }

  private processStuckRecovery(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    navigation.stuckDetection.recoveryAttempts++;
    
    if (navigation.stuckDetection.recoveryAttempts >= navigation.stuckDetection.maxRecoveryAttempts) {
      // Give up and clear path
      clearPath(navigation);
      navigation.state = 'idle';
      navigation.statistics.failedPaths++;
      return;
    }
    
    // Try random movement to get unstuck
    const randomDirection = {
      x: (Math.random() - 0.5) * 2,
      y: 0,
      z: (Math.random() - 0.5) * 2
    };
    
    const normalizedDirection = normalizeVector(randomDirection);
    const movement = scaleVector(normalizedDirection, navigation.moveSpeed * 0.5 * deltaTime);
    transform.position = addVectors(transform.position, movement);
    
    // Reset stuck timer
    navigation.stuckDetection.stuckTimer = 0;
    navigation.stuckDetection.lastPosition = { ...transform.position };
    
    // Try to resume normal navigation after a delay
    setTimeout(() => {
      if (navigation.state === 'stuck') {
        navigation.state = navigation.targetPosition ? 'calculating' : 'idle';
      }
    }, 1000);
  }

  private processObstacleAvoidance(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    // Apply avoidance behavior
    const avoidanceForce = this.calculateObstacleAvoidanceForce(navigation, transform);
    const movement = scaleVector(avoidanceForce, navigation.moveSpeed * deltaTime);
    transform.position = addVectors(transform.position, movement);
    
    // Check if we can resume normal navigation
    let hasNearObstacles = false;
    for (const obstacle of navigation.detectedObstacles) {
      const distance = calculateDistance(transform.position, obstacle.position);
      if (distance < obstacle.avoidanceRadius * 1.5) {
        hasNearObstacles = true;
        break;
      }
    }
    
    if (!hasNearObstacles) {
      navigation.state = navigation.targetPosition ? 'moving' : 'idle';
    }
  }

  private processNavigation(
    navigation: NavigationComponent,
    transform: TransformComponent,
    entity: Entity,
    deltaTime: number
  ): void {
    // Get AI component to understand current intent
    const ai = this.getComponent<AIComponent>(entity, 'ai');
    if (!ai || !ai.currentDecision) return;
    
    // Handle different AI decisions
    switch (ai.currentDecision.action) {
      case 'chase_player':
        if (typeof ai.currentDecision.target === 'object' && 'x' in ai.currentDecision.target) {
          setNavigationTarget(navigation, ai.currentDecision.target as Vector3);
        }
        break;
        
      case 'return_to_spawn':
        const enemy = this.getComponent<EnemyComponent>(entity, 'enemy');
        if (enemy) {
          setNavigationTarget(navigation, enemy.spawnPosition);
        }
        break;
        
      case 'start_patrol':
        // Patrol navigation is handled by PatrolSystem
        break;
    }
  }

  private updateMovement(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    // Update rotation to face movement direction
    if (navigation.velocity.x !== 0 || navigation.velocity.z !== 0) {
      const targetRotation = Math.atan2(navigation.velocity.x, navigation.velocity.z);
      const rotationDiff = targetRotation - transform.rotation.y;
      
      // Normalize rotation difference
      let normalizedDiff = rotationDiff;
      while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
      while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
      
      // Apply rotation
      const rotationSpeed = navigation.rotationSpeed * deltaTime;
      if (Math.abs(normalizedDiff) < rotationSpeed) {
        transform.rotation.y = targetRotation;
      } else {
        transform.rotation.y += Math.sign(normalizedDiff) * rotationSpeed;
      }
    }
  }

  private handleObstacleAvoidance(
    navigation: NavigationComponent,
    transform: TransformComponent,
    entity: Entity
  ): void {
    if (!navigation.obstacleAvoidance.enabled) return;
    
    // Detect obstacles using raycasting (simplified)
    this.detectObstacles(navigation, transform, entity);
    
    // Check if we need to avoid obstacles
    let hasNearObstacles = false;
    for (const obstacle of navigation.detectedObstacles) {
      const distance = calculateDistance(transform.position, obstacle.position);
      if (distance < obstacle.avoidanceRadius) {
        hasNearObstacles = true;
        break;
      }
    }
    
    if (hasNearObstacles && navigation.state === 'moving') {
      navigation.state = 'avoiding';
    }
  }

  private detectObstacles(
    navigation: NavigationComponent,
    transform: TransformComponent,
    entity: Entity
  ): void {
    // Clear old obstacles
    navigation.detectedObstacles = [];
    
    // Get nearby entities that could be obstacles
    const gridKey = this.getGridKey(transform.position);
    const nearbyEntities = this.spatialGrid.get(gridKey) || [];
    
    for (const nearbyEntity of nearbyEntities) {
      if (nearbyEntity.id === entity.id) continue;
      
      const otherTransform = this.getComponent<TransformComponent>(nearbyEntity, 'transform');
      if (!otherTransform) continue;
      
      const distance = calculateDistance(transform.position, otherTransform.position);
      if (distance < navigation.obstacleAvoidance.lookAheadDistance) {
        const obstacle: Obstacle = {
          id: `entity_${nearbyEntity.id}`,
          position: { ...otherTransform.position },
          radius: 1.0, // Default radius
          height: 2.0, // Default height
          type: 'dynamic',
          avoidanceRadius: navigation.obstacleAvoidance.avoidanceRadius
        };
        
        addObstacle(navigation, obstacle);
      }
    }
  }

  private updateStuckDetection(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    if (!navigation.stuckDetection.enabled) return;
    
    const currentPosition = transform.position;
    const lastPosition = navigation.stuckDetection.lastPosition;
    
    const movementDistance = calculateDistance(currentPosition, lastPosition);
    
    if (movementDistance < navigation.stuckDetection.positionThreshold) {
      navigation.stuckDetection.stuckTimer += deltaTime;
      
      if (navigation.stuckDetection.stuckTimer >= navigation.stuckDetection.timeThreshold) {
        navigation.state = 'stuck';
        navigation.statistics.stuckCount++;
      }
    } else {
      navigation.stuckDetection.stuckTimer = 0;
      navigation.stuckDetection.lastPosition = { ...currentPosition };
    }
  }

  private updateStatistics(
    navigation: NavigationComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    // Update distance traveled
    const currentPosition = transform.position;
    const lastValidPosition = navigation.lastValidPosition;
    
    if (lastValidPosition.x !== 0 || lastValidPosition.y !== 0 || lastValidPosition.z !== 0) {
      const distance = calculateDistance(currentPosition, lastValidPosition);
      navigation.statistics.totalDistanceTraveled += distance;
    }
    
    navigation.lastValidPosition = { ...currentPosition };
    
    // Update average path length
    if (navigation.statistics.successfulPaths > 0) {
      navigation.statistics.averagePathLength = 
        navigation.statistics.totalDistanceTraveled / navigation.statistics.successfulPaths;
    }
  }
}