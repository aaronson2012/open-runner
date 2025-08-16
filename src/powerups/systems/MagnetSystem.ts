/**
 * MagnetSystem
 * Handles magnetic attraction physics for coins and collectibles
 */

import { BaseSystem } from '@/systems/core/BaseSystem';
import { Entity } from '@/types';
import { MagnetComponent } from '../components/MagnetComponent';

interface AttractableTarget {
  entity: Entity;
  distance: number;
  direction: { x: number; y: number; z: number };
}

export class MagnetSystem extends BaseSystem {
  private attractableTypes = new Set(['coin', 'collectible', 'pickup']);
  private activeTargets = new Map<number, AttractableTarget[]>();
  private maxAttractionSpeed = 300; // units per second
  private minAttractionSpeed = 50;
  private attractionCurve = 2.0; // Exponential curve for attraction force

  constructor() {
    super('MagnetSystem', ['MagnetComponent'], 12);
  }

  protected onInit(): void {
    this.debug('MagnetSystem initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    const magnetEntities = this.filterEntities(entities);
    const attractableEntities = this.findAttractableEntities(entities);
    
    this.activeTargets.clear();

    for (const magnetEntity of magnetEntities) {
      const magnet = this.getComponent<MagnetComponent>(magnetEntity, 'MagnetComponent');
      if (!magnet || !magnet.isActive) continue;

      this.processMagnetAttraction(magnetEntity, magnet, attractableEntities, deltaTime);
    }
  }

  private findAttractableEntities(entities: Entity[]): Entity[] {
    return entities.filter(entity => {
      // Check if entity has a type component that matches attractable types
      const typeComponent = this.getComponent<any>(entity, 'TypeComponent');
      if (typeComponent && this.attractableTypes.has(typeComponent.type)) {
        return true;
      }

      // Also check for collectible component
      return entity.components.has('CollectibleComponent');
    });
  }

  private processMagnetAttraction(
    magnetEntity: Entity, 
    magnet: MagnetComponent, 
    attractableEntities: Entity[],
    deltaTime: number
  ): void {
    const magnetTransform = this.getComponent<any>(magnetEntity, 'TransformComponent');
    if (!magnetTransform) return;

    const targets: AttractableTarget[] = [];
    magnet.affectedEntities.clear();

    for (const targetEntity of attractableEntities) {
      // Skip if target is already collected
      const collectible = this.getComponent<any>(targetEntity, 'CollectibleComponent');
      if (collectible && collectible.isCollected) continue;

      const targetTransform = this.getComponent<any>(targetEntity, 'TransformComponent');
      if (!targetTransform) continue;

      const distance = this.calculateDistance(magnetTransform.position, targetTransform.position);
      
      if (distance <= magnet.attractionRadius) {
        const direction = this.calculateDirection(targetTransform.position, magnetTransform.position);
        const target: AttractableTarget = {
          entity: targetEntity,
          distance,
          direction
        };

        targets.push(target);
        magnet.affectedEntities.add(targetEntity.id);
        
        this.applyMagneticForce(targetEntity, target, magnet, deltaTime);
      }
    }

    this.activeTargets.set(magnetEntity.id, targets);
    
    // Update visual effects
    this.updateMagnetVisuals(magnetEntity, magnet, targets, deltaTime);
    
    if (targets.length > 0) {
      this.debug(`Magnet affecting ${targets.length} entities`);
    }
  }

  private calculateDistance(pos1: any, pos2: any): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateDirection(from: any, to: any): { x: number; y: number; z: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (length === 0) return { x: 0, y: 0, z: 0 };
    
    return {
      x: dx / length,
      y: dy / length,
      z: dz / length
    };
  }

  private applyMagneticForce(
    targetEntity: Entity, 
    target: AttractableTarget, 
    magnet: MagnetComponent, 
    deltaTime: number
  ): void {
    const targetTransform = this.getComponent<any>(targetEntity, 'TransformComponent');
    const targetPhysics = this.getComponent<any>(targetEntity, 'PhysicsComponent');
    
    if (!targetTransform) return;

    // Calculate attraction strength based on distance (inverse square law with modifications)
    const normalizedDistance = Math.max(0.1, target.distance / magnet.attractionRadius);
    const attractionStrength = Math.pow(1 / normalizedDistance, this.attractionCurve);
    
    // Calculate final speed with limits
    const baseSpeed = magnet.attractionForce * attractionStrength;
    const attractionSpeed = Math.max(
      this.minAttractionSpeed,
      Math.min(this.maxAttractionSpeed, baseSpeed)
    );

    // Apply movement
    const movement = {
      x: target.direction.x * attractionSpeed * deltaTime * 0.001,
      y: target.direction.y * attractionSpeed * deltaTime * 0.001,
      z: target.direction.z * attractionSpeed * deltaTime * 0.001
    };

    // Update position
    targetTransform.position.x += movement.x;
    targetTransform.position.y += movement.y;
    targetTransform.position.z += movement.z;

    // Update physics velocity if available
    if (targetPhysics && targetPhysics.velocity) {
      const damping = 0.8; // Reduce existing velocity
      targetPhysics.velocity.x = targetPhysics.velocity.x * damping + movement.x * 100;
      targetPhysics.velocity.y = targetPhysics.velocity.y * damping + movement.y * 100;
      targetPhysics.velocity.z = targetPhysics.velocity.z * damping + movement.z * 100;
    }

    // Mark collectible as magnetically attracted
    const collectible = this.getComponent<any>(targetEntity, 'CollectibleComponent');
    if (collectible) {
      collectible.magneticAttraction = true;
    }

    // Create attraction particle trail
    this.createAttractionTrail(targetEntity, target, magnet);
  }

  private updateMagnetVisuals(
    magnetEntity: Entity, 
    magnet: MagnetComponent, 
    targets: AttractableTarget[],
    deltaTime: number
  ): void {
    // Update magnetic field visual effect
    if (magnet.visualEffect.showField) {
      const time = performance.now() * 0.001;
      const pulseIntensity = 0.5 + 0.3 * Math.sin(time * magnet.visualEffect.pulseSpeed);
      
      // Increase field intensity based on number of affected targets
      const targetInfluence = Math.min(1.0, targets.length / 5);
      magnet.visualEffect.fieldOpacity = (0.3 + 0.2 * targetInfluence) * pulseIntensity;
    }

    // Create magnetic field particles
    if (targets.length > 0) {
      this.createMagneticFieldEffect(magnetEntity, magnet, targets);
    }
  }

  private createAttractionTrail(
    targetEntity: Entity, 
    target: AttractableTarget, 
    magnet: MagnetComponent
  ): void {
    const targetTransform = this.getComponent<any>(targetEntity, 'TransformComponent');
    if (!targetTransform) return;

    // Create trail particle data
    const trailData = {
      position: { ...targetTransform.position },
      direction: { ...target.direction },
      color: magnet.visualEffect.fieldColor,
      intensity: 1.0 - (target.distance / magnet.attractionRadius),
      type: 'attraction_trail'
    };

    this.emitParticleEvent('trail', trailData);
  }

  private createMagneticFieldEffect(
    magnetEntity: Entity, 
    magnet: MagnetComponent, 
    targets: AttractableTarget[]
  ): void {
    const magnetTransform = this.getComponent<any>(magnetEntity, 'TransformComponent');
    if (!magnetTransform) return;

    // Create magnetic field visualization
    const fieldData = {
      position: { ...magnetTransform.position },
      radius: magnet.attractionRadius,
      color: magnet.visualEffect.fieldColor,
      opacity: magnet.visualEffect.fieldOpacity,
      targetCount: targets.length,
      type: 'magnetic_field'
    };

    this.emitParticleEvent('field', fieldData);
  }

  private emitParticleEvent(type: string, data: any): void {
    if (this.world) {
      // this.world.eventSystem?.emit(`particle:${type}`, data);
    }
  }

  // Public API methods

  /**
   * Get all entities currently being attracted by magnets
   */
  getAttractedEntities(): Map<number, AttractableTarget[]> {
    return new Map(this.activeTargets);
  }

  /**
   * Check if an entity is currently being attracted
   */
  isEntityAttracted(entityId: number): boolean {
    for (const targets of this.activeTargets.values()) {
      if (targets.some(target => target.entity.id === entityId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the nearest magnet affecting an entity
   */
  getNearestMagnet(entityId: number): { magnetId: number; distance: number } | null {
    let nearestMagnet = null;
    let shortestDistance = Infinity;

    for (const [magnetId, targets] of this.activeTargets) {
      const target = targets.find(t => t.entity.id === entityId);
      if (target && target.distance < shortestDistance) {
        shortestDistance = target.distance;
        nearestMagnet = { magnetId, distance: target.distance };
      }
    }

    return nearestMagnet;
  }

  /**
   * Add or remove attractable types
   */
  setAttractableTypes(types: string[]): void {
    this.attractableTypes = new Set(types);
    this.debug(`Updated attractable types: ${Array.from(this.attractableTypes).join(', ')}`);
  }

  /**
   * Set magnet parameters for tuning
   */
  setMagnetParameters(params: {
    maxSpeed?: number;
    minSpeed?: number;
    attractionCurve?: number;
  }): void {
    if (params.maxSpeed !== undefined) this.maxAttractionSpeed = params.maxSpeed;
    if (params.minSpeed !== undefined) this.minAttractionSpeed = params.minSpeed;
    if (params.attractionCurve !== undefined) this.attractionCurve = params.attractionCurve;
    
    this.debug(`Updated magnet parameters:`, params);
  }

  /**
   * Get magnet system statistics
   */
  getStats() {
    const totalTargets = Array.from(this.activeTargets.values())
      .reduce((sum, targets) => sum + targets.length, 0);
    
    return {
      activeMagnets: this.activeTargets.size,
      totalAttractedEntities: totalTargets,
      attractableTypes: Array.from(this.attractableTypes),
      maxAttractionSpeed: this.maxAttractionSpeed,
      minAttractionSpeed: this.minAttractionSpeed
    };
  }

  /**
   * Force update magnet attraction for debugging
   */
  forceUpdateMagnet(magnetEntityId: number): void {
    const magnetEntity = this.world?.getEntity(magnetEntityId);
    if (!magnetEntity) return;

    const magnet = this.getComponent<MagnetComponent>(magnetEntity, 'MagnetComponent');
    if (!magnet) return;

    // Temporarily enable magnet if disabled
    const wasActive = magnet.isActive;
    magnet.isActive = true;
    
    // Force update
    if (this.world) {
      const entities = this.world.getAllEntities();
      const attractableEntities = this.findAttractableEntities(entities);
      this.processMagnetAttraction(magnetEntity, magnet, attractableEntities, 16.67); // Assume 60fps
    }
    
    magnet.isActive = wasActive;
    this.debug(`Force updated magnet on entity ${magnetEntityId}`);
  }
}