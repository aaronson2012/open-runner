import { BaseSystem } from '@/systems/core/BaseSystem';
import type { Entity, ComponentType, Vector3 } from '@/types';
import type { AggroComponent, DetectedTarget, ThreatLevel } from '@/components/ai/AggroComponent';
import type { TransformComponent } from '@/components/core/CoreComponents';
import type { EnemyComponent } from '@/components/ai/EnemyComponent';
import type { AIComponent } from '@/components/ai/AIComponent';
import {
  addDetectedTarget,
  removeDetectedTarget,
  updateAggroLevel,
  isInViewCone
} from '@/components/ai/AggroComponent';

/**
 * Aggro System handles enemy detection, target acquisition, and threat assessment
 */
export class AggroSystem extends BaseSystem {
  private playerEntity?: Entity;
  private playerPosition = { x: 0, y: 0, z: 0 };
  private playerVelocity = { x: 0, y: 0, z: 0 };
  private lastPlayerPosition = { x: 0, y: 0, z: 0 };
  private spatialGrid: Map<string, Entity[]> = new Map();
  private gridSize = 15; // Size of spatial grid cells for optimization

  constructor() {
    super('aggro-system', ['aggro', 'enemy', 'transform'], 12); // High priority
  }

  protected onInit(): void {
    this.debug('Aggro System initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Find and track player
    this.updatePlayerTracking();
    
    // Update spatial grid for optimization
    this.updateSpatialGrid(entities);
    
    // Process each aggro entity
    for (const entity of entities) {
      const aggro = this.getComponent<AggroComponent>(entity, 'aggro');
      const enemy = this.getComponent<EnemyComponent>(entity, 'enemy');
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      const ai = this.getComponent<AIComponent>(entity, 'ai');
      
      if (!aggro || !enemy || !transform || !enemy.isActive) continue;
      
      // Check if this aggro system should update this frame
      if (!this.shouldUpdateAggro(aggro, deltaTime)) continue;
      
      // Update detection radius based on LOD
      this.updateLODDetection(aggro, transform);
      
      // Detect and track targets
      this.updateTargetDetection(aggro, enemy, transform, ai);
      
      // Update aggro levels
      this.updateAggroLevels(aggro, enemy, deltaTime);
      
      // Process group coordination
      this.processGroupCoordination(aggro, enemy, transform, entities);
      
      // Clean up old targets
      this.cleanupTargets(aggro, deltaTime);
      
      // Update alertness levels
      this.updateAlertnessLevels(aggro, enemy, ai, deltaTime);
    }
  }

  private updatePlayerTracking(): void {
    if (!this.world) return;
    
    // Find player entity
    const playerEntities = this.world.getEntitiesWithComponent('playerController');
    if (playerEntities.length > 0) {
      this.playerEntity = playerEntities[0];
      const playerTransform = this.getComponent<TransformComponent>(this.playerEntity, 'transform');
      
      if (playerTransform) {
        // Update player velocity
        this.playerVelocity = {
          x: playerTransform.position.x - this.lastPlayerPosition.x,
          y: playerTransform.position.y - this.lastPlayerPosition.y,
          z: playerTransform.position.z - this.lastPlayerPosition.z
        };
        
        this.lastPlayerPosition = { ...this.playerPosition };
        this.playerPosition = { ...playerTransform.position };
      }
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

  private shouldUpdateAggro(aggro: AggroComponent, deltaTime: number): boolean {
    const currentTime = Date.now() / 1000;
    const updateInterval = 1.0 / aggro.detectionFrequency;
    
    if (currentTime - aggro.lastDetectionCheck >= updateInterval) {
      aggro.lastDetectionCheck = currentTime;
      return true;
    }
    
    return false;
  }

  private updateLODDetection(aggro: AggroComponent, transform: TransformComponent): void {
    const distanceToPlayer = this.calculateDistance(transform.position, this.playerPosition);
    
    // Adjust detection radius based on distance and performance requirements
    if (distanceToPlayer > 100) {
      aggro.lodDetectionRadius = aggro.detectionRadius * 0.5;
      aggro.detectionFrequency = Math.max(1, aggro.detectionFrequency * 0.5);
    } else if (distanceToPlayer > 50) {
      aggro.lodDetectionRadius = aggro.detectionRadius * 0.75;
      aggro.detectionFrequency = Math.max(2, aggro.detectionFrequency * 0.75);
    } else {
      aggro.lodDetectionRadius = aggro.detectionRadius;
      // Keep original frequency for close enemies
    }
  }

  private updateTargetDetection(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    ai?: AIComponent
  ): void {
    // Detect player
    this.detectPlayer(aggro, enemy, transform);
    
    // Detect other potential targets (other players in multiplayer, etc.)
    this.detectOtherTargets(aggro, enemy, transform);
    
    // Process sound-based detection
    this.processSoundDetection(aggro, enemy, transform);
    
    // Update target priorities
    this.updateTargetPriorities(aggro, enemy, ai);
  }

  private detectPlayer(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): void {
    if (!this.playerEntity) return;
    
    const distanceToPlayer = this.calculateDistance(transform.position, this.playerPosition);
    
    // Check if player is within maximum detection range
    if (distanceToPlayer > aggro.maxDetectionRadius) {
      this.removePlayerFromTargets(aggro);
      return;
    }
    
    // Check invisibility powerup
    // TODO: Integrate with powerup system
    const isPlayerInvisible = false; // This would come from powerup system
    if (isPlayerInvisible && enemy.enemyType !== 'rattlesnake') {
      // Rattlesnakes can detect by vibration even when player is invisible
      this.removePlayerFromTargets(aggro);
      return;
    }
    
    // Sight-based detection
    const isVisibleBySight = this.isPlayerVisibleBySight(aggro, enemy, transform, distanceToPlayer);
    
    // Movement-based detection
    const isDetectedByMovement = this.isPlayerDetectedByMovement(aggro, enemy, distanceToPlayer);
    
    // Sound-based detection
    const isDetectedBySound = this.isPlayerDetectedBySound(aggro, enemy, distanceToPlayer);
    
    // Determine if player is detected
    const isDetected = isVisibleBySight || isDetectedByMovement || isDetectedBySound;
    
    if (isDetected) {
      const threatLevel = this.calculateThreatLevel(aggro, enemy, distanceToPlayer);
      addDetectedTarget(aggro, this.playerEntity.id, this.playerPosition, threatLevel);
      
      // Update AI memory if available
      const ai = this.getComponent<AIComponent>(this.playerEntity, 'ai');
      if (ai) {
        ai.lastKnownPlayerPosition = { ...this.playerPosition };
        ai.lastPlayerSightTime = Date.now() / 1000;
      }
    } else {
      // Check if we should lose the target
      const existingTarget = aggro.detectedTargets.get(this.playerEntity.id);
      if (existingTarget) {
        const timeSinceLastSeen = Date.now() / 1000 - existingTarget.lastSeenTime;
        if (timeSinceLastSeen > 5.0 || distanceToPlayer > aggro.deaggroRadius) {
          removeDetectedTarget(aggro, this.playerEntity.id);
        }
      }
    }
  }

  private isPlayerVisibleBySight(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    distance: number
  ): boolean {
    if (!aggro.sightDetection.enabled) return false;
    if (distance > aggro.viewDistance) return false;
    
    // Check if player is in view cone
    const isInViewCone = this.isInViewCone(
      transform.position,
      transform.rotation.y,
      this.playerPosition,
      aggro.viewAngle,
      aggro.viewDistance
    );
    
    if (!isInViewCone) {
      // Check peripheral vision
      const peripheralChance = aggro.sightDetection.peripheralVision;
      if (Math.random() > peripheralChance) return false;
    }
    
    // Line of sight check (simplified - would need proper raycasting)
    const hasLineOfSight = this.checkLineOfSight(transform.position, this.playerPosition);
    if (!hasLineOfSight) return false;
    
    // Apply detection modifiers
    let detectionChance = aggro.sightDetection.accuracy;
    
    // Light level effects
    detectionChance *= aggro.detectionModifiers.lightLevel;
    
    // Weather effects
    detectionChance *= aggro.detectionModifiers.weather;
    
    // Cover effects
    detectionChance *= aggro.detectionModifiers.coverModifier;
    
    // Night vision bonus
    if (aggro.detectionModifiers.lightLevel < 0.5) {
      detectionChance += aggro.sightDetection.nightVision * (1 - aggro.detectionModifiers.lightLevel);
    }
    
    return Math.random() < detectionChance;
  }

  private isPlayerDetectedByMovement(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    distance: number
  ): boolean {
    if (!aggro.movementDetection.enabled) return false;
    if (distance > aggro.lodDetectionRadius) return false;
    
    const playerSpeed = Math.sqrt(
      this.playerVelocity.x * this.playerVelocity.x +
      this.playerVelocity.z * this.playerVelocity.z
    );
    
    let detectionChance = aggro.movementDetection.sensitivity;
    
    // Stillness bonus - harder to detect when not moving
    if (playerSpeed < 0.1) {
      detectionChance *= (1 - aggro.movementDetection.stillnessBonus);
    } else {
      // Speed penalty - easier to detect when moving fast
      const speedMultiplier = 1 + (playerSpeed * aggro.movementDetection.speedPenalty);
      detectionChance *= speedMultiplier;
    }
    
    // Distance falloff
    const distanceFactor = 1 - (distance / aggro.lodDetectionRadius);
    detectionChance *= distanceFactor;
    
    return Math.random() < detectionChance;
  }

  private isPlayerDetectedBySound(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    distance: number
  ): boolean {
    if (!aggro.soundDetection.enabled) return false;
    if (distance > aggro.soundDetection.maxSoundDistance) return false;
    
    const playerSpeed = Math.sqrt(
      this.playerVelocity.x * this.playerVelocity.x +
      this.playerVelocity.z * this.playerVelocity.z
    );
    
    // Calculate sound level based on player movement
    let soundLevel = playerSpeed * 0.1; // Base sound from movement
    
    // Add environmental sound modifiers
    soundLevel *= aggro.detectionModifiers.noiseLevel;
    
    // Distance attenuation
    const distanceFactor = 1 - (distance / aggro.soundDetection.maxSoundDistance);
    soundLevel *= distanceFactor;
    
    // Detection chance based on sensitivity and sound level
    const detectionChance = aggro.soundDetection.sensitivity * soundLevel;
    
    if (Math.random() < detectionChance) {
      // Remember sound source
      aggro.soundDetection.lastSoundSource = { ...this.playerPosition };
      aggro.soundDetection.lastSoundTime = Date.now() / 1000;
      return true;
    }
    
    return false;
  }

  private detectOtherTargets(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): void {
    // In a multiplayer game, this would detect other players
    // For now, this is a placeholder for extensibility
  }

  private processSoundDetection(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent
  ): void {
    // Check for remembered sound sources
    if (aggro.soundDetection.lastSoundSource) {
      const currentTime = Date.now() / 1000;
      const timeSinceSound = currentTime - aggro.soundDetection.lastSoundTime;
      
      if (timeSinceSound < aggro.soundDetection.soundMemoryDuration) {
        // Investigate sound source
        aggro.investigationTarget = { ...aggro.soundDetection.lastSoundSource };
        aggro.alertnessLevel = Math.min(1.0, aggro.alertnessLevel + 0.3);
      } else {
        // Forget old sound
        aggro.soundDetection.lastSoundSource = undefined;
      }
    }
  }

  private updateTargetPriorities(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    ai?: AIComponent
  ): void {
    let highestPriority = 0;
    let primaryTarget: number | undefined;
    
    for (const [entityId, target] of aggro.detectedTargets) {
      const priority = this.calculateTargetPriority(aggro, enemy, target, ai);
      target.confidence = this.calculateTargetConfidence(aggro, target);
      
      if (priority > highestPriority) {
        highestPriority = priority;
        primaryTarget = entityId;
      }
    }
    
    if (primaryTarget !== aggro.primaryTarget) {
      aggro.primaryTarget = primaryTarget;
      aggro.lastPrimaryTargetTime = Date.now() / 1000;
    }
  }

  private calculateTargetPriority(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    target: DetectedTarget,
    ai?: AIComponent
  ): number {
    let priority = 0;
    
    // Base priority by threat level
    switch (target.threatLevel) {
      case 'critical': priority += 5; break;
      case 'high': priority += 4; break;
      case 'medium': priority += 3; break;
      case 'low': priority += 2; break;
      case 'none': priority += 1; break;
    }
    
    // Distance factor - closer targets are higher priority
    const maxDistance = aggro.detectionRadius;
    const distanceFactor = 1 - (target.distance / maxDistance);
    priority += distanceFactor * 2;
    
    // Visibility factor
    if (target.isVisible) {
      priority += 1;
    }
    
    // Confidence factor
    priority += target.confidence;
    
    // AI aggressiveness factor
    if (ai) {
      priority += ai.aggressiveness;
    }
    
    // Enemy type specific priorities
    priority += this.getEnemyTypeTargetingBonus(enemy, target);
    
    return priority;
  }

  private getEnemyTypeTargetingBonus(enemy: EnemyComponent, target: DetectedTarget): number {
    switch (enemy.enemyType) {
      case 'bear':
        // Bears prioritize threats in their territory
        return target.threatLevel === 'high' || target.threatLevel === 'critical' ? 1 : 0;
      case 'squirrel':
        // Squirrels are easily startled, prioritize close threats
        return target.distance < 10 ? 1 : 0;
      case 'deer':
        // Deer flee from any threat
        return target.threatLevel !== 'none' ? 1 : 0;
      case 'coyote':
        // Coyotes are persistent hunters
        return target.threatLevel === 'medium' || target.threatLevel === 'high' ? 1.5 : 0;
      case 'rattlesnake':
        // Rattlesnakes only care about very close threats
        return target.distance < 5 ? 2 : 0;
      case 'scorpion':
        // Scorpions are territorial but cautious
        return target.distance < 8 ? 1 : 0;
      default:
        return 0;
    }
  }

  private calculateTargetConfidence(aggro: AggroComponent, target: DetectedTarget): number {
    let confidence = target.confidence;
    
    // Increase confidence over time if target is visible
    if (target.isVisible) {
      confidence = Math.min(1.0, confidence + 0.1);
    } else {
      // Decrease confidence if target is not visible
      confidence = Math.max(0.1, confidence - 0.05);
    }
    
    return confidence;
  }

  private calculateThreatLevel(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    distance: number
  ): ThreatLevel {
    // Base threat level on distance
    if (distance < enemy.attackRange) return 'critical';
    if (distance < aggro.detectionRadius * 0.3) return 'high';
    if (distance < aggro.detectionRadius * 0.6) return 'medium';
    if (distance < aggro.detectionRadius) return 'low';
    return 'none';
  }

  private updateAggroLevels(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    deltaTime: number
  ): void {
    const hasValidTarget = aggro.primaryTarget !== undefined;
    updateAggroLevel(aggro, deltaTime, hasValidTarget);
    
    // Update chase state
    if (hasValidTarget && aggro.aggroLevel > 0.5) {
      if (!aggro.isChasing) {
        aggro.isChasing = true;
        aggro.chaseStartTime = Date.now() / 1000;
      }
    } else {
      aggro.isChasing = false;
    }
    
    // Check chase timeout
    if (aggro.isChasing) {
      const chaseTime = Date.now() / 1000 - aggro.chaseStartTime;
      if (chaseTime > aggro.maxChaseTime) {
        aggro.isChasing = false;
        aggro.aggroLevel = Math.max(0, aggro.aggroLevel - 0.5);
        
        // Remove primary target if chase timed out
        if (aggro.primaryTarget) {
          removeDetectedTarget(aggro, aggro.primaryTarget);
        }
      }
    }
  }

  private processGroupCoordination(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    allEntities: Entity[]
  ): void {
    if (!aggro.groupCoordination.enabled) return;
    
    // Find nearby group members
    const nearbyAllies = this.findNearbyAllies(aggro, enemy, transform, allEntities);
    
    // Share target information
    if (aggro.groupCoordination.shareTargets && aggro.primaryTarget) {
      this.shareTargetWithAllies(aggro, enemy, nearbyAllies);
    }
    
    // Trigger alarm if high threat detected
    if (aggro.aggroLevel > 0.8) {
      this.triggerAlarm(aggro, enemy, transform, nearbyAllies);
    }
  }

  private findNearbyAllies(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    allEntities: Entity[]
  ): Entity[] {
    const allies: Entity[] = [];
    const coordinationRadius = aggro.groupCoordination.communicationRadius;
    
    for (const entity of allEntities) {
      if (entity.id === enemy.entityId) continue;
      
      const otherEnemy = this.getComponent<EnemyComponent>(entity, 'enemy');
      const otherTransform = this.getComponent<TransformComponent>(entity, 'transform');
      const otherAggro = this.getComponent<AggroComponent>(entity, 'aggro');
      
      if (!otherEnemy || !otherTransform || !otherAggro) continue;
      if (otherEnemy.enemyType !== enemy.enemyType) continue;
      
      const distance = this.calculateDistance(transform.position, otherTransform.position);
      if (distance <= coordinationRadius) {
        allies.push(entity);
      }
    }
    
    return allies;
  }

  private shareTargetWithAllies(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    allies: Entity[]
  ): void {
    if (!aggro.primaryTarget) return;
    
    const targetInfo = aggro.detectedTargets.get(aggro.primaryTarget);
    if (!targetInfo) return;
    
    for (const ally of allies) {
      const allyAggro = this.getComponent<AggroComponent>(ally, 'aggro');
      if (!allyAggro) continue;
      
      // Share target information
      addDetectedTarget(
        allyAggro,
        aggro.primaryTarget,
        targetInfo.position,
        targetInfo.threatLevel
      );
      
      // Increase ally alertness
      allyAggro.alertnessLevel = Math.min(1.0, allyAggro.alertnessLevel + 0.2);
    }
  }

  private triggerAlarm(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    transform: TransformComponent,
    allies: Entity[]
  ): void {
    const currentTime = Date.now() / 1000;
    if (currentTime - aggro.groupCoordination.lastAlarmTime < aggro.groupCoordination.alarmCooldown) {
      return;
    }
    
    aggro.groupCoordination.lastAlarmTime = currentTime;
    
    // Alert all allies within alarm radius
    for (const ally of allies) {
      const allyTransform = this.getComponent<TransformComponent>(ally, 'transform');
      const allyAggro = this.getComponent<AggroComponent>(ally, 'aggro');
      
      if (!allyTransform || !allyAggro) continue;
      
      const distance = this.calculateDistance(transform.position, allyTransform.position);
      if (distance <= aggro.groupCoordination.alarmRadius) {
        allyAggro.alertnessLevel = 1.0;
        allyAggro.aggroLevel = Math.min(allyAggro.maxAggroLevel, allyAggro.aggroLevel + 0.5);
        
        // Set investigation target to alarm source
        allyAggro.investigationTarget = { ...transform.position };
      }
    }
  }

  private cleanupTargets(aggro: AggroComponent, deltaTime: number): void {
    const currentTime = Date.now() / 1000;
    const targetsToRemove: number[] = [];
    
    for (const [entityId, target] of aggro.detectedTargets) {
      const timeSinceLastSeen = currentTime - target.lastSeenTime;
      
      // Remove targets that haven't been seen for too long
      if (timeSinceLastSeen > 10.0) {
        targetsToRemove.push(entityId);
      }
      
      // Update target data
      target.suspicionLevel = Math.max(0, target.suspicionLevel - deltaTime * 0.1);
    }
    
    // Remove old targets
    for (const entityId of targetsToRemove) {
      removeDetectedTarget(aggro, entityId);
    }
  }

  private updateAlertnessLevels(
    aggro: AggroComponent,
    enemy: EnemyComponent,
    ai?: AIComponent,
    deltaTime: number
  ): void {
    // Increase alertness when targets are detected
    if (aggro.detectedTargets.size > 0) {
      aggro.alertnessLevel = Math.min(1.0, aggro.alertnessLevel + deltaTime * 0.5);
    } else {
      // Decrease alertness over time when no targets
      aggro.alertnessLevel = Math.max(0, aggro.alertnessLevel - deltaTime * 0.2);
    }
    
    // Update suspicion timeout
    if (aggro.alertnessLevel > 0.3 && aggro.detectedTargets.size === 0) {
      aggro.suspicionTimeout = Math.max(0, aggro.suspicionTimeout - deltaTime);
      
      if (aggro.suspicionTimeout <= 0) {
        aggro.alertnessLevel = Math.max(0, aggro.alertnessLevel - deltaTime * 0.5);
      }
    } else if (aggro.detectedTargets.size > 0) {
      aggro.suspicionTimeout = 3.0; // Reset suspicion timeout
    }
    
    // Sync with AI component
    if (ai) {
      ai.alertness = aggro.alertnessLevel;
      ai.suspicionLevel = Math.max(ai.suspicionLevel, aggro.alertnessLevel * 0.5);
    }
  }

  private removePlayerFromTargets(aggro: AggroComponent): void {
    if (this.playerEntity && aggro.detectedTargets.has(this.playerEntity.id)) {
      removeDetectedTarget(aggro, this.playerEntity.id);
    }
  }

  private isInViewCone(
    position: Vector3,
    rotation: number,
    targetPosition: Vector3,
    viewAngle: number,
    viewDistance: number
  ): boolean {
    return isInViewCone(position, rotation, targetPosition, viewAngle, viewDistance);
  }

  private checkLineOfSight(from: Vector3, to: Vector3): boolean {
    // Simplified line of sight check
    // In a real implementation, this would use raycasting against the terrain and obstacles
    
    // For now, assume clear line of sight unless there's a large height difference
    const heightDiff = Math.abs(to.y - from.y);
    return heightDiff < 10; // Arbitrary height threshold
  }

  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}