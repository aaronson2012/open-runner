import { BaseSystem } from '@/systems/core/BaseSystem';
import type { Entity, ComponentType } from '@/types';
import type { AIComponent, AIState, AIDecision } from '@/components/ai/AIComponent';
import type { EnemyComponent } from '@/components/ai/EnemyComponent';
import type { AggroComponent } from '@/components/ai/AggroComponent';
import type { PatrolComponent } from '@/components/ai/PatrolComponent';
import type { TransformComponent } from '@/components/core/CoreComponents';
import { 
  canTransitionTo, 
  makeDecision, 
  addMemoryPosition, 
  shouldThink,
  addDebugLog 
} from '@/components/ai/AIComponent';

/**
 * Core AI System that manages enemy decision making and state transitions
 */
export class AISystem extends BaseSystem {
  private playerEntity?: Entity;
  private playerPosition = { x: 0, y: 0, z: 0 };

  constructor() {
    super('ai-system', ['ai', 'enemy', 'transform'], 10); // High priority
  }

  protected onInit(): void {
    this.debug('AI System initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Find player entity first
    this.updatePlayerReference();
    
    // Process each AI entity
    for (const entity of entities) {
      const ai = this.getComponent<AIComponent>(entity, 'ai');
      const enemy = this.getComponent<EnemyComponent>(entity, 'enemy');
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      
      if (!ai || !enemy || !transform || !enemy.isActive) continue;
      
      // Check if this AI should think this frame
      const currentTime = Date.now() / 1000;
      if (!shouldThink(ai, currentTime)) continue;
      
      ai.lastThinkTime = currentTime;
      
      // Update AI state machine
      this.updateStateMachine(ai, enemy, transform, deltaTime);
      
      // Make decisions based on current state
      this.processDecisionMaking(ai, enemy, transform, deltaTime);
      
      // Update memory and learning
      this.updateMemoryAndLearning(ai, enemy, transform);
      
      // Handle group coordination for pack hunters
      if (enemy.enemyType === 'coyote') {
        this.processGroupCoordination(ai, enemy, transform, entities);
      }
      
      // Performance optimization - adjust update frequency based on distance to player
      this.optimizePerformance(ai, enemy, transform);
    }
  }

  private updatePlayerReference(): void {
    if (!this.world) return;
    
    // Find player entity with player controller
    const playerEntities = this.world.getEntitiesWithComponent('playerController');
    if (playerEntities.length > 0) {
      this.playerEntity = playerEntities[0];
      const playerTransform = this.getComponent<TransformComponent>(this.playerEntity, 'transform');
      if (playerTransform) {
        this.playerPosition = { ...playerTransform.position };
      }
    }
  }

  private updateStateMachine(
    ai: AIComponent, 
    enemy: EnemyComponent, 
    transform: TransformComponent,
    deltaTime: number
  ): void {
    const currentTime = Date.now() / 1000;
    ai.stateDuration = currentTime - ai.stateEnterTime;
    
    // Prevent rapid state switching
    if (ai.stateDuration < ai.minStateDuration) return;
    
    const newState = this.determineNewState(ai, enemy, transform);
    
    if (newState !== ai.currentState && canTransitionTo(ai, newState)) {
      this.transitionToState(ai, enemy, newState);
    }
    
    // Update state-specific behaviors
    this.processCurrentState(ai, enemy, transform, deltaTime);
  }

  private determineNewState(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): AIState {
    const distanceToPlayer = this.calculateDistance(transform.position, this.playerPosition);
    const hasPlayerTarget = this.hasValidPlayerTarget(ai);
    const isPlayerVisible = this.isPlayerVisible(ai, enemy, transform);
    
    // Death state check
    if (enemy.health <= 0) return 'dead';
    
    // Stunned state recovery
    if (ai.currentState === 'stunned' && ai.stateDuration > 2.0) {
      return hasPlayerTarget ? 'chase' : 'patrol';
    }
    
    // High-priority state transitions based on enemy type and distance
    switch (enemy.enemyType) {
      case 'bear':
        return this.determineBearState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
      case 'squirrel':
        return this.determineSquirrelState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
      case 'deer':
        return this.determineDeerState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
      case 'coyote':
        return this.determineCoyoteState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
      case 'rattlesnake':
        return this.determineRattlesnakeState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
      case 'scorpion':
        return this.determineScorpionState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
      default:
        return this.determineGenericState(ai, enemy, distanceToPlayer, hasPlayerTarget, isPlayerVisible);
    }
  }

  private determineBearState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    // Bears are territorial and aggressive
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget) return 'attack';
    if (distanceToPlayer <= enemy.aggroRadius && isPlayerVisible) return 'chase';
    if (hasPlayerTarget && ai.suspicionLevel > 0.3) return 'investigate';
    
    // Return to territory if too far from spawn
    const distanceFromSpawn = this.calculateDistance(ai.memory.importantPositions[0]?.position || enemy.spawnPosition, { x: 0, y: 0, z: 0 });
    if (distanceFromSpawn > enemy.roamingRadius * 2) return 'return';
    
    return ai.currentState === 'idle' ? 'patrol' : ai.currentState;
  }

  private determineSquirrelState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    // Squirrels are quick to react and flee
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget && ai.aggressiveness > 0.7) return 'attack';
    if (distanceToPlayer <= enemy.aggroRadius && isPlayerVisible) {
      // Quick decision: chase or flee based on aggressiveness
      return ai.aggressiveness > 0.4 ? 'chase' : 'return';
    }
    if (hasPlayerTarget && ai.suspicionLevel > 0.2) return 'investigate';
    
    return 'patrol'; // Always moving
  }

  private determineDeerState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    // Deer are prey animals - mostly flee
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget) {
      // Only attack if cornered (very rare)
      return ai.aggressiveness > 0.8 ? 'attack' : 'return';
    }
    if (distanceToPlayer <= enemy.aggroRadius && isPlayerVisible) return 'return'; // Flee
    if (hasPlayerTarget && ai.suspicionLevel > 0.1) return 'investigate';
    
    return ai.currentState === 'idle' ? 'patrol' : ai.currentState;
  }

  private determineCoyoteState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    // Coyotes are pack hunters - coordinate with others
    const packSize = ai.groupBehavior.packMembers.length + 1;
    const packMultiplier = Math.min(1.5, 1 + (packSize - 1) * 0.2);
    
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget) return 'attack';
    if (distanceToPlayer <= enemy.aggroRadius * packMultiplier && isPlayerVisible) return 'chase';
    if (hasPlayerTarget && ai.suspicionLevel > 0.4) return 'investigate';
    
    return ai.currentState === 'idle' ? 'patrol' : ai.currentState;
  }

  private determineRattlesnakeState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    // Rattlesnakes are ambush predators - mostly wait
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget) return 'attack';
    if (distanceToPlayer <= enemy.aggroRadius && isPlayerVisible && ai.alertness > 0.6) {
      // Only chase very briefly
      return ai.stateDuration < 1.0 ? 'chase' : 'return';
    }
    
    // Mostly stay idle or patrol very slowly
    return ai.stateDuration > 10.0 ? 'patrol' : 'idle';
  }

  private determineScorpionState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    // Scorpions are territorial but cautious
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget) return 'attack';
    if (distanceToPlayer <= enemy.aggroRadius && isPlayerVisible) return 'chase';
    if (hasPlayerTarget && ai.suspicionLevel > 0.5) return 'investigate';
    
    return ai.currentState === 'idle' ? 'patrol' : ai.currentState;
  }

  private determineGenericState(
    ai: AIComponent,
    enemy: EnemyComponent,
    distanceToPlayer: number,
    hasPlayerTarget: boolean,
    isPlayerVisible: boolean
  ): AIState {
    if (distanceToPlayer <= enemy.attackRange && hasPlayerTarget) return 'attack';
    if (distanceToPlayer <= enemy.aggroRadius && isPlayerVisible) return 'chase';
    if (hasPlayerTarget && ai.suspicionLevel > 0.3) return 'investigate';
    return ai.currentState === 'idle' ? 'patrol' : ai.currentState;
  }

  private transitionToState(ai: AIComponent, enemy: EnemyComponent, newState: AIState): void {
    const oldState = ai.currentState;
    ai.previousState = oldState;
    ai.currentState = newState;
    ai.stateEnterTime = Date.now() / 1000;
    ai.stateDuration = 0;
    
    // Update enemy animation state
    this.updateAnimationState(enemy, newState);
    
    // Log state transition for debugging
    if (ai.debugMode) {
      addDebugLog(ai, `State: ${oldState} → ${newState}`);
    }
    
    // State-specific initialization
    this.initializeState(ai, enemy, newState);
  }

  private initializeState(ai: AIComponent, enemy: EnemyComponent, state: AIState): void {
    switch (state) {
      case 'chase':
        enemy.moveSpeed = enemy.originalMoveSpeed * 1.2; // Speed boost when chasing
        ai.alertness = Math.min(1.0, ai.alertness + 0.3);
        break;
      case 'attack':
        enemy.lastAttackTime = Date.now() / 1000;
        break;
      case 'return':
        enemy.moveSpeed = enemy.originalMoveSpeed * 0.8; // Slower return
        break;
      case 'patrol':
        enemy.moveSpeed = enemy.originalMoveSpeed * enemy.roamingSpeedFactor;
        break;
      case 'idle':
        enemy.moveSpeed = 0;
        break;
    }
  }

  private updateAnimationState(enemy: EnemyComponent, aiState: AIState): void {
    switch (aiState) {
      case 'idle':
        enemy.animationState = 'idle';
        break;
      case 'patrol':
        enemy.animationState = 'walk';
        break;
      case 'chase':
      case 'return':
        enemy.animationState = 'run';
        break;
      case 'attack':
        enemy.animationState = 'attack';
        break;
      case 'dead':
        enemy.animationState = 'death';
        break;
    }
  }

  private processCurrentState(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    switch (ai.currentState) {
      case 'idle':
        this.processIdleState(ai, enemy, deltaTime);
        break;
      case 'patrol':
        this.processPatrolState(ai, enemy, deltaTime);
        break;
      case 'investigate':
        this.processInvestigateState(ai, enemy, transform, deltaTime);
        break;
      case 'chase':
        this.processChaseState(ai, enemy, transform, deltaTime);
        break;
      case 'attack':
        this.processAttackState(ai, enemy, deltaTime);
        break;
      case 'return':
        this.processReturnState(ai, enemy, deltaTime);
        break;
      case 'stunned':
        this.processStunnedState(ai, enemy, deltaTime);
        break;
    }
  }

  private processIdleState(ai: AIComponent, enemy: EnemyComponent, deltaTime: number): void {
    // Decrease alertness and suspicion over time
    ai.alertness = Math.max(0, ai.alertness - deltaTime * 0.2);
    ai.suspicionLevel = Math.max(0, ai.suspicionLevel - deltaTime * 0.1);
    
    // Random chance to start patrolling
    if (Math.random() < 0.1 * deltaTime) {
      makeDecision(ai, 'start_patrol', 0.3);
    }
  }

  private processPatrolState(ai: AIComponent, enemy: EnemyComponent, deltaTime: number): void {
    // Patrol logic is handled by PatrolSystem
    ai.alertness = Math.max(0.2, ai.alertness - deltaTime * 0.1);
  }

  private processInvestigateState(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    ai.alertness = Math.min(1.0, ai.alertness + deltaTime * 0.3);
    
    // Move toward last known player position if we have one
    if (ai.lastKnownPlayerPosition) {
      const distance = this.calculateDistance(transform.position, ai.lastKnownPlayerPosition);
      if (distance < 2.0) {
        // Reached investigation point - look around
        ai.suspicionLevel = Math.max(0, ai.suspicionLevel - deltaTime * 0.5);
        if (ai.suspicionLevel <= 0.1) {
          makeDecision(ai, 'investigation_complete', 0.5);
        }
      }
    }
  }

  private processChaseState(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    ai.alertness = 1.0;
    ai.suspicionLevel = 1.0;
    
    // Update last known player position
    if (this.isPlayerVisible(ai, enemy, transform)) {
      ai.lastKnownPlayerPosition = { ...this.playerPosition };
      ai.lastPlayerSightTime = Date.now() / 1000;
      
      // Remember this encounter
      ai.memory.playerEncounters++;
      addMemoryPosition(ai, this.playerPosition, 'player_last_seen', 1.0);
    }
    
    // Make chase decision
    const distanceToPlayer = this.calculateDistance(transform.position, this.playerPosition);
    if (distanceToPlayer <= enemy.attackRange) {
      makeDecision(ai, 'attack_player', 1.0, this.playerEntity?.id);
    } else {
      makeDecision(ai, 'chase_player', 0.8, this.playerEntity?.id);
    }
  }

  private processAttackState(ai: AIComponent, enemy: EnemyComponent, deltaTime: number): void {
    const currentTime = Date.now() / 1000;
    const timeSinceLastAttack = currentTime - enemy.lastAttackTime;
    
    if (timeSinceLastAttack >= enemy.attackCooldown) {
      // Perform attack
      makeDecision(ai, 'execute_attack', 1.0, this.playerEntity?.id, undefined, {
        damage: enemy.damage,
        range: enemy.attackRange
      });
      
      enemy.lastAttackTime = currentTime;
      
      // Learn from attack
      this.updateLearning(ai, 'attack_attempted');
    }
  }

  private processReturnState(ai: AIComponent, enemy: EnemyComponent, deltaTime: number): void {
    // Gradually decrease alertness while returning
    ai.alertness = Math.max(0.1, ai.alertness - deltaTime * 0.3);
    ai.suspicionLevel = Math.max(0, ai.suspicionLevel - deltaTime * 0.2);
    
    makeDecision(ai, 'return_to_spawn', 0.6, enemy.spawnPosition);
  }

  private processStunnedState(ai: AIComponent, enemy: EnemyComponent, deltaTime: number): void {
    // Can't make decisions while stunned
    enemy.moveSpeed = 0;
  }

  private processDecisionMaking(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    const currentTime = Date.now() / 1000;
    
    // Check if we can make a new decision
    if (currentTime - ai.lastDecisionTime < ai.decisionCooldown) return;
    
    // Process current decision if we have one
    if (ai.currentDecision) {
      this.executeDecision(ai, enemy, transform, ai.currentDecision);
    }
    
    // Environmental awareness decisions
    this.makeEnvironmentalDecisions(ai, enemy, transform);
  }

  private executeDecision(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    decision: AIDecision
  ): void {
    switch (decision.action) {
      case 'chase_player':
        // Decision execution is handled by NavigationSystem
        break;
      case 'attack_player':
        // Trigger attack animation and damage
        this.executeAttack(enemy, decision);
        break;
      case 'return_to_spawn':
        // Set navigation target to spawn position
        break;
      case 'start_patrol':
        // Begin patrol behavior
        break;
      case 'investigation_complete':
        // Return to normal state
        break;
    }
  }

  private executeAttack(enemy: EnemyComponent, decision: AIDecision): void {
    // This would integrate with a combat system
    if (this.playerEntity && decision.data) {
      // Apply damage to player
      const damage = decision.data.damage * enemy.biomeModifiers.damageMultiplier;
      
      // Here you would call a damage system or component
      this.debug(`Enemy ${enemy.enemyType} attacks for ${damage} damage`);
    }
  }

  private makeEnvironmentalDecisions(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): void {
    // Weather and time-based decisions
    // Terrain-based decisions
    // Sound-based reactions
    // Group coordination decisions
  }

  private processGroupCoordination(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    allEntities: Entity[]
  ): void {
    if (!ai.groupBehavior.shouldCoordinate) return;
    
    // Find nearby pack members
    const nearbyPackMembers = this.findNearbyPackMembers(ai, enemy, transform, allEntities);
    ai.groupBehavior.packMembers = nearbyPackMembers.map(e => e.id);
    
    // Coordinate pack behavior
    if (nearbyPackMembers.length > 0) {
      this.coordinatePackBehavior(ai, enemy, nearbyPackMembers);
    }
  }

  private findNearbyPackMembers(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    allEntities: Entity[]
  ): Entity[] {
    const packMembers: Entity[] = [];
    const coordinationRadius = ai.groupBehavior.coordinationRadius;
    
    for (const entity of allEntities) {
      if (entity.id === enemy.entityId) continue;
      
      const otherEnemy = this.getComponent<EnemyComponent>(entity, 'enemy');
      const otherTransform = this.getComponent<TransformComponent>(entity, 'transform');
      
      if (!otherEnemy || !otherTransform) continue;
      if (otherEnemy.enemyType !== enemy.enemyType) continue;
      
      const distance = this.calculateDistance(transform.position, otherTransform.position);
      if (distance <= coordinationRadius) {
        packMembers.push(entity);
      }
    }
    
    return packMembers;
  }

  private coordinatePackBehavior(
    ai: AIComponent,
    enemy: EnemyComponent,
    packMembers: Entity[]
  ): void {
    // Determine pack leader
    if (!ai.groupBehavior.isLeader && !ai.groupBehavior.leaderId) {
      // Become leader if no leader exists
      ai.groupBehavior.isLeader = true;
      makeDecision(ai, 'become_pack_leader', 0.9);
    }
    
    // Coordinate attack patterns
    if (ai.currentState === 'chase' && ai.groupBehavior.isLeader) {
      makeDecision(ai, 'coordinate_pack_attack', 0.8, this.playerEntity?.id, undefined, {
        packMembers: packMembers.map(e => e.id)
      });
    }
  }

  private updateMemoryAndLearning(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): void {
    // Update player behavior prediction
    if (this.playerEntity) {
      this.updatePlayerPrediction(ai);
    }
    
    // Clean old memories
    this.cleanOldMemories(ai);
    
    // Update tactical learning
    this.updateTacticalLearning(ai, enemy);
  }

  private updatePlayerPrediction(ai: AIComponent): void {
    // Simple learning: track how predictable player movement is
    // This could be expanded with more sophisticated ML techniques
    const learningRate = ai.learning.playerPredictability;
    
    if (ai.memory.lastPlayerDirection) {
      // Compare current player direction with predicted
      // Update predictability score
      ai.learning.playerPredictability = Math.min(1.0, learningRate + 0.01);
    }
  }

  private cleanOldMemories(ai: AIComponent): void {
    const currentTime = Date.now();
    const maxAge = 30000; // 30 seconds
    
    ai.memory.importantPositions = ai.memory.importantPositions.filter(
      pos => currentTime - pos.timestamp < maxAge
    );
  }

  private updateTacticalLearning(ai: AIComponent, enemy: EnemyComponent): void {
    // Learn optimal attack ranges and tactics
    if (ai.currentState === 'attack') {
      const distanceToPlayer = this.calculateDistance(
        { x: 0, y: 0, z: 0 }, // This would be the actual position
        this.playerPosition
      );
      
      // Update preferred attack range based on success
      const alpha = 0.1;
      ai.learning.preferredAttackRange = 
        ai.learning.preferredAttackRange * (1 - alpha) + distanceToPlayer * alpha;
    }
  }

  private optimizePerformance(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): void {
    const distanceToPlayer = this.calculateDistance(transform.position, this.playerPosition);
    
    // Adjust LOD and update frequency based on distance
    if (distanceToPlayer > 100) {
      ai.lodLevel = 3;
      ai.thinkingFrequency = 2;
    } else if (distanceToPlayer > 50) {
      ai.lodLevel = 2;
      ai.thinkingFrequency = 5;
    } else {
      ai.lodLevel = 1;
      ai.thinkingFrequency = enemy.updateFrequency;
    }
  }

  private hasValidPlayerTarget(ai: AIComponent): boolean {
    const currentTime = Date.now() / 1000;
    return ai.lastKnownPlayerPosition !== undefined && 
           (currentTime - ai.lastPlayerSightTime) < 5.0;
  }

  private isPlayerVisible(
    ai: AIComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): boolean {
    if (!this.playerEntity) return false;
    
    const distance = this.calculateDistance(transform.position, this.playerPosition);
    if (distance > enemy.aggroRadius) return false;
    
    // This would include proper line-of-sight checking with raycasting
    // For now, simple distance and angle check
    return distance <= enemy.aggroRadius;
  }

  private updateLearning(ai: AIComponent, action: string): void {
    // Track successful and failed tactics
    if (action.includes('attack')) {
      if (Math.random() < 0.7) { // Simulate 70% attack success rate
        if (!ai.learning.successfulTactics.includes(action)) {
          ai.learning.successfulTactics.push(action);
        }
      } else {
        if (!ai.learning.failedTactics.includes(action)) {
          ai.learning.failedTactics.push(action);
        }
      }
    }
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}