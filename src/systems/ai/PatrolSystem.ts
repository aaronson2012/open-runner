import { BaseSystem } from '@/systems/core/BaseSystem';
import type { Entity, ComponentType, Vector3 } from '@/types';
import type { PatrolComponent, PatrolWaypoint, PatrolType } from '@/components/ai/PatrolComponent';
import type { TransformComponent } from '@/components/core/CoreComponents';
import type { EnemyComponent } from '@/components/ai/EnemyComponent';
import type { AIComponent } from '@/components/ai/AIComponent';
import type { NavigationComponent } from '@/components/ai/NavigationComponent';
import {
  generateRandomWaypoint,
  generateCircularWaypoints,
  generateLinearWaypoints,
  addWaypoint,
  getNextWaypoint,
  isWithinPatrolBounds
} from '@/components/ai/PatrolComponent';
import { setNavigationTarget } from '@/components/ai/NavigationComponent';

/**
 * Patrol System handles enemy roaming behavior and waypoint navigation
 */
export class PatrolSystem extends BaseSystem {
  private spatialGrid: Map<string, Entity[]> = new Map();
  private gridSize = 20; // Size of spatial grid cells
  private patrolGroups: Map<string, Entity[]> = new Map();

  constructor() {
    super('patrol-system', ['patrol', 'transform', 'enemy'], 8); // Medium priority
  }

  protected onInit(): void {
    this.debug('Patrol System initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Update spatial grid for patrol coordination
    this.updateSpatialGrid(entities);
    
    // Update patrol groups
    this.updatePatrolGroups(entities);
    
    // Process each patrolling entity
    for (const entity of entities) {
      const patrol = this.getComponent<PatrolComponent>(entity, 'patrol');
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      const enemy = this.getComponent<EnemyComponent>(entity, 'enemy');
      const ai = this.getComponent<AIComponent>(entity, 'ai');
      
      if (!patrol || !transform || !enemy || !enemy.isActive) continue;
      
      // Check if patrol should update this frame
      if (!this.shouldUpdatePatrol(patrol, deltaTime)) continue;
      
      // Only patrol when AI is in patrol state
      if (ai && ai.currentState !== 'patrol' && ai.currentState !== 'idle') {
        this.pausePatrol(patrol);
        continue;
      }
      
      // Resume patrol if needed
      if (!patrol.isPatrolling && this.shouldResumePatrol(patrol, ai)) {
        this.resumePatrol(patrol, enemy, transform);
      }
      
      // Process patrol behavior
      if (patrol.isPatrolling) {
        this.processPatrolBehavior(patrol, transform, enemy, entity, deltaTime);
      }
      
      // Update patrol statistics
      this.updatePatrolStatistics(patrol, transform, deltaTime);
    }
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

  private updatePatrolGroups(entities: Entity[]): void {
    this.patrolGroups.clear();
    
    for (const entity of entities) {
      const patrol = this.getComponent<PatrolComponent>(entity, 'patrol');
      if (!patrol || !patrol.groupPatrol.enabled || !patrol.groupPatrol.groupId) continue;
      
      const groupId = patrol.groupPatrol.groupId;
      if (!this.patrolGroups.has(groupId)) {
        this.patrolGroups.set(groupId, []);
      }
      this.patrolGroups.get(groupId)!.push(entity);
    }
  }

  private shouldUpdatePatrol(patrol: PatrolComponent, deltaTime: number): boolean {
    const currentTime = Date.now() / 1000;
    const updateInterval = 1.0 / patrol.updateFrequency;
    
    if (currentTime - patrol.lastUpdateTime >= updateInterval) {
      patrol.lastUpdateTime = currentTime;
      return true;
    }
    
    return false;
  }

  private shouldResumePatrol(patrol: PatrolComponent, ai?: AIComponent): boolean {
    if (patrol.isPatrolling) return false;
    
    const currentTime = Date.now() / 1000;
    
    // Check interruption cooldown
    if (currentTime - patrol.lastInterruptionTime < patrol.interruptionCooldown) {
      return false;
    }
    
    // Check if AI allows patrol
    if (ai) {
      return ai.currentState === 'patrol' || ai.currentState === 'idle';
    }
    
    return true;
  }

  private pausePatrol(patrol: PatrolComponent): void {
    if (patrol.isPatrolling && patrol.canBeInterrupted) {
      patrol.isPatrolling = false;
      patrol.lastInterruptionTime = Date.now() / 1000;
      patrol.statistics.interruptionCount++;
    }
  }

  private resumePatrol(patrol: PatrolComponent, enemy: EnemyComponent, transform: TransformComponent): void {
    patrol.isPatrolling = true;
    
    // Initialize patrol if no waypoints exist
    if (patrol.waypoints.length === 0) {
      this.initializePatrol(patrol, enemy, transform);
    }
    
    // Resume with appropriate speed
    enemy.moveSpeed = patrol.patrolSpeed;
  }

  private initializePatrol(patrol: PatrolComponent, enemy: EnemyComponent, transform: TransformComponent): void {
    // Generate initial waypoints based on patrol type
    switch (patrol.patrolType) {
      case 'circular':
        patrol.waypoints = generateCircularWaypoints(patrol, 6);
        break;
      case 'linear':
        this.generateLinearPatrolWaypoints(patrol, transform);
        break;
      case 'waypoint':
        this.generateWaypointPatrol(patrol, transform);
        break;
      case 'random':
        this.generateRandomPatrolWaypoints(patrol, 4);
        break;
      case 'guard':
        this.generateGuardPatrol(patrol, transform);
        break;
      case 'territorial':
        this.generateTerritorialPatrol(patrol, enemy, transform);
        break;
    }
    
    // Set initial target
    if (patrol.waypoints.length > 0) {
      patrol.currentTarget = { ...patrol.waypoints[0].position };
    }
  }

  private generateLinearPatrolWaypoints(patrol: PatrolComponent, transform: TransformComponent): void {
    const startPos = { ...patrol.centerPosition };
    const endPos = {
      x: startPos.x + patrol.patrolRadius,
      y: startPos.y,
      z: startPos.z
    };
    
    patrol.waypoints = generateLinearWaypoints(patrol, startPos, endPos, 2);
  }

  private generateWaypointPatrol(patrol: PatrolComponent, transform: TransformComponent): void {
    // Generate waypoints in a pattern
    const numWaypoints = 4;
    for (let i = 0; i < numWaypoints; i++) {
      const waypoint = generateRandomWaypoint(patrol);
      addWaypoint(patrol, waypoint, patrol.minWaitTime + Math.random() * (patrol.maxWaitTime - patrol.minWaitTime));
    }
  }

  private generateRandomPatrolWaypoints(patrol: PatrolComponent, count: number): void {
    for (let i = 0; i < count; i++) {
      const waypoint = generateRandomWaypoint(patrol);
      addWaypoint(patrol, waypoint);
    }
  }

  private generateGuardPatrol(patrol: PatrolComponent, transform: TransformComponent): void {
    // Guards stay close to their position
    const numWaypoints = 3;
    const guardRadius = Math.min(patrol.patrolRadius, 8.0);
    
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (i / numWaypoints) * Math.PI * 2;
      const position = {
        x: patrol.centerPosition.x + Math.cos(angle) * guardRadius,
        y: patrol.centerPosition.y,
        z: patrol.centerPosition.z + Math.sin(angle) * guardRadius
      };
      
      addWaypoint(patrol, position, patrol.maxWaitTime * 2); // Longer wait times for guards
    }
  }

  private generateTerritorialPatrol(patrol: PatrolComponent, enemy: EnemyComponent, transform: TransformComponent): void {
    // Territorial patrol covers the enemy's territory
    const territoryRadius = enemy.roamingRadius;
    const numWaypoints = 6;
    
    for (let i = 0; i < numWaypoints; i++) {
      const angle = (i / numWaypoints) * Math.PI * 2;
      const radius = territoryRadius * (0.7 + Math.random() * 0.3); // Vary the radius
      
      const position = {
        x: enemy.spawnPosition.x + Math.cos(angle) * radius,
        y: enemy.spawnPosition.y,
        z: enemy.spawnPosition.z + Math.sin(angle) * radius
      };
      
      addWaypoint(patrol, position, patrol.minWaitTime + Math.random() * (patrol.maxWaitTime - patrol.minWaitTime));
    }
  }

  private processPatrolBehavior(
    patrol: PatrolComponent,
    transform: TransformComponent,
    enemy: EnemyComponent,
    entity: Entity,
    deltaTime: number
  ): void {
    // Update patrol time
    patrol.totalPatrolTime += deltaTime;
    
    // Check if we're waiting at a waypoint
    if (this.isWaitingAtWaypoint(patrol, transform, deltaTime)) {
      return;
    }
    
    // Check if we need to move to next waypoint
    if (!patrol.currentTarget || this.hasReachedTarget(patrol, transform)) {
      this.moveToNextWaypoint(patrol, enemy, transform);
    }
    
    // Apply movement toward current target
    if (patrol.currentTarget) {
      this.moveTowardTarget(patrol, transform, enemy, entity, deltaTime);
    }
    
    // Apply adaptive behavior
    if (patrol.adaptiveBehavior.enabled) {
      this.processAdaptiveBehavior(patrol, transform, enemy, deltaTime);
    }
    
    // Process group coordination
    if (patrol.groupPatrol.enabled) {
      this.processGroupPatrol(patrol, transform, entity);
    }
    
    // Enforce patrol boundaries
    if (patrol.boundaryEnforcement.enabled) {
      this.enforceBoundaries(patrol, transform, enemy);
    }
  }

  private isWaitingAtWaypoint(patrol: PatrolComponent, transform: TransformComponent, deltaTime: number): boolean {
    if (patrol.waypointWaitTimer > 0) {
      patrol.waypointWaitTimer -= deltaTime;
      patrol.timeAtCurrentWaypoint += deltaTime;
      return true;
    }
    return false;
  }

  private hasReachedTarget(patrol: PatrolComponent, transform: TransformComponent): boolean {
    if (!patrol.currentTarget) return true;
    
    const distance = this.calculateDistance(transform.position, patrol.currentTarget);
    return distance <= 2.0; // Arrival threshold
  }

  private moveToNextWaypoint(patrol: PatrolComponent, enemy: EnemyComponent, transform: TransformComponent): void {
    if (patrol.waypoints.length === 0) {
      // Generate new waypoints if needed
      this.generateRandomPatrolWaypoints(patrol, 3);
    }
    
    const nextWaypoint = getNextWaypoint(patrol);
    if (nextWaypoint) {
      patrol.currentTarget = { ...nextWaypoint.position };
      patrol.currentWaypointIndex = patrol.nextWaypointIndex;
      
      // Set wait time at waypoint
      patrol.waypointWaitTime = nextWaypoint.waitTime;
      patrol.waypointWaitTimer = nextWaypoint.waitTime;
      patrol.timeAtCurrentWaypoint = 0;
      
      // Apply speed modifier
      enemy.moveSpeed = patrol.patrolSpeed * nextWaypoint.speed;
      
      // Update statistics
      patrol.statistics.waypointsVisited++;
    } else {
      // No more waypoints, generate new ones or stop
      if (patrol.patrolType === 'random') {
        patrol.currentTarget = generateRandomWaypoint(patrol);
      }
    }
  }

  private moveTowardTarget(
    patrol: PatrolComponent,
    transform: TransformComponent,
    enemy: EnemyComponent,
    entity: Entity,
    deltaTime: number
  ): void {
    // Use navigation system if available
    const navigation = this.getComponent<NavigationComponent>(entity, 'navigation');
    if (navigation) {
      setNavigationTarget(navigation, patrol.currentTarget!);
      return;
    }
    
    // Fallback: direct movement
    const direction = this.normalizeVector(this.subtractVectors(patrol.currentTarget!, transform.position));
    
    // Apply random walk if enabled
    if (patrol.movementPattern.useRandomWalk) {
      const randomOffset = {
        x: (Math.random() - 0.5) * patrol.movementPattern.randomWalkIntensity,
        y: 0,
        z: (Math.random() - 0.5) * patrol.movementPattern.randomWalkIntensity
      };
      direction.x += randomOffset.x;
      direction.z += randomOffset.z;
    }
    
    // Apply movement
    const moveDistance = enemy.moveSpeed * deltaTime;
    const movement = this.scaleVector(this.normalizeVector(direction), moveDistance);
    
    transform.position = this.addVectors(transform.position, movement);
    
    // Update rotation to face movement direction
    if (movement.x !== 0 || movement.z !== 0) {
      transform.rotation.y = Math.atan2(movement.x, movement.z);
    }
  }

  private processAdaptiveBehavior(
    patrol: PatrolComponent,
    transform: TransformComponent,
    enemy: EnemyComponent,
    deltaTime: number
  ): void {
    const adaptive = patrol.adaptiveBehavior;
    
    // Player avoidance
    if (adaptive.playerAvoidance) {
      this.processPlayerAvoidance(patrol, transform, enemy);
    }
    
    // Threat response
    if (enemy.health < enemy.maxHealth * 0.5) {
      this.processThreatResponse(patrol, adaptive.threatResponse);
    }
  }

  private processPlayerAvoidance(patrol: PatrolComponent, transform: TransformComponent, enemy: EnemyComponent): void {
    // Find player entity
    if (!this.world) return;
    
    const playerEntities = this.world.getEntitiesWithComponent('playerController');
    if (playerEntities.length === 0) return;
    
    const playerTransform = this.getComponent<TransformComponent>(playerEntities[0], 'transform');
    if (!playerTransform) return;
    
    const distanceToPlayer = this.calculateDistance(transform.position, playerTransform.position);
    const avoidanceRadius = 30.0;
    
    if (distanceToPlayer < avoidanceRadius) {
      // Generate new waypoint away from player
      const awayDirection = this.normalizeVector(this.subtractVectors(transform.position, playerTransform.position));
      const newTarget = {
        x: transform.position.x + awayDirection.x * patrol.patrolRadius,
        y: transform.position.y,
        z: transform.position.z + awayDirection.z * patrol.patrolRadius
      };
      
      patrol.currentTarget = newTarget;
    }
  }

  private processThreatResponse(patrol: PatrolComponent, response: string): void {
    switch (response) {
      case 'pause':
        patrol.waypointWaitTimer = Math.max(patrol.waypointWaitTimer, 3.0);
        break;
      case 'flee':
        // Increase patrol speed temporarily
        patrol.patrolSpeed = patrol.originalSpeed;
        break;
      case 'investigate':
        // Move toward threat source (would need threat information)
        break;
      case 'continue':
        // Do nothing, continue normal patrol
        break;
    }
  }

  private processGroupPatrol(patrol: PatrolComponent, transform: TransformComponent, entity: Entity): void {
    const groupId = patrol.groupPatrol.groupId;
    if (!groupId) return;
    
    const groupMembers = this.patrolGroups.get(groupId) || [];
    if (groupMembers.length <= 1) return;
    
    // Find leader or become leader
    let leader: Entity | undefined;
    for (const member of groupMembers) {
      const memberPatrol = this.getComponent<PatrolComponent>(member, 'patrol');
      if (memberPatrol?.groupPatrol.leaderEntityId === member.id) {
        leader = member;
        break;
      }
    }
    
    if (!leader && patrol.groupPatrol.positionInFormation === 0) {
      // Become the leader
      patrol.groupPatrol.leaderEntityId = entity.id;
      leader = entity;
    }
    
    // Follow formation if not leader
    if (leader && leader.id !== entity.id) {
      this.followFormation(patrol, transform, leader, groupMembers);
    }
  }

  private followFormation(patrol: PatrolComponent, transform: TransformComponent, leader: Entity, groupMembers: Entity[]): void {
    const leaderTransform = this.getComponent<TransformComponent>(leader, 'transform');
    if (!leaderTransform) return;
    
    const formation = patrol.groupPatrol.formation;
    const position = patrol.groupPatrol.positionInFormation;
    const followDistance = patrol.groupPatrol.followDistance;
    
    let targetPosition: Vector3;
    
    switch (formation) {
      case 'line':
        targetPosition = {
          x: leaderTransform.position.x - (position * followDistance),
          y: leaderTransform.position.y,
          z: leaderTransform.position.z
        };
        break;
      case 'column':
        targetPosition = {
          x: leaderTransform.position.x,
          y: leaderTransform.position.y,
          z: leaderTransform.position.z - (position * followDistance)
        };
        break;
      case 'wedge':
        const angle = (position % 2 === 0 ? 1 : -1) * (Math.floor(position / 2) + 1) * 0.5;
        targetPosition = {
          x: leaderTransform.position.x + Math.sin(angle) * followDistance,
          y: leaderTransform.position.y,
          z: leaderTransform.position.z - Math.cos(angle) * followDistance
        };
        break;
      case 'circle':
        const circleAngle = (position / groupMembers.length) * Math.PI * 2;
        targetPosition = {
          x: leaderTransform.position.x + Math.cos(circleAngle) * followDistance,
          y: leaderTransform.position.y,
          z: leaderTransform.position.z + Math.sin(circleAngle) * followDistance
        };
        break;
      default: // 'loose'
        targetPosition = {
          x: leaderTransform.position.x + (Math.random() - 0.5) * followDistance * 2,
          y: leaderTransform.position.y,
          z: leaderTransform.position.z + (Math.random() - 0.5) * followDistance * 2
        };
        break;
    }
    
    patrol.currentTarget = targetPosition;
  }

  private enforceBoundaries(patrol: PatrolComponent, transform: TransformComponent, enemy: EnemyComponent): void {
    if (!isWithinPatrolBounds(patrol, transform.position)) {
      // Return to center of patrol area
      switch (patrol.boundaryEnforcement.returnMethod) {
        case 'direct':
          patrol.currentTarget = { ...patrol.centerPosition };
          break;
        case 'waypoint':
          // Find nearest waypoint within bounds
          let nearestWaypoint: PatrolWaypoint | undefined;
          let nearestDistance = Infinity;
          
          for (const waypoint of patrol.waypoints) {
            if (isWithinPatrolBounds(patrol, waypoint.position)) {
              const distance = this.calculateDistance(transform.position, waypoint.position);
              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestWaypoint = waypoint;
              }
            }
          }
          
          if (nearestWaypoint) {
            patrol.currentTarget = { ...nearestWaypoint.position };
          } else {
            patrol.currentTarget = { ...patrol.centerPosition };
          }
          break;
      }
    }
  }

  private updatePatrolStatistics(patrol: PatrolComponent, transform: TransformComponent, deltaTime: number): void {
    // Update time spent patrolling
    if (patrol.isPatrolling) {
      patrol.statistics.timeSpentPatrolling += deltaTime;
    }
    
    // Update distance traveled
    const currentPosition = transform.position;
    if (patrol.currentTarget) {
      const distanceToTarget = this.calculateDistance(currentPosition, patrol.currentTarget);
      patrol.distanceToTarget = distanceToTarget;
    }
    
    // Update average speed
    if (patrol.statistics.timeSpentPatrolling > 0) {
      patrol.statistics.averageSpeedOverTime = 
        patrol.statistics.totalDistanceTraveled / patrol.statistics.timeSpentPatrolling;
    }
  }

  // Utility functions
  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private normalizeVector(vector: Vector3): Vector3 {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    
    return {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length
    };
  }

  private addVectors(v1: Vector3, v2: Vector3): Vector3 {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y,
      z: v1.z + v2.z
    };
  }

  private subtractVectors(v1: Vector3, v2: Vector3): Vector3 {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y,
      z: v1.z - v2.z
    };
  }

  private scaleVector(vector: Vector3, scale: number): Vector3 {
    return {
      x: vector.x * scale,
      y: vector.y * scale,
      z: vector.z * scale
    };
  }
}