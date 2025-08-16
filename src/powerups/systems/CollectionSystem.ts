/**
 * CollectionSystem
 * Handles collision detection and collection effects for powerups
 */

import { BaseSystem } from '@/systems/core/BaseSystem';
import { Entity } from '@/types';
import { CollectibleComponent } from '../components/CollectibleComponent';
import { PowerupComponent } from '../components/PowerupComponent';
import { PowerupState, CollectionData } from '../types/PowerupTypes';

interface CollisionBounds {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export class CollectionSystem extends BaseSystem {
  private collectionEvents: CollectionData[] = [];
  private playerEntity: Entity | null = null;
  private lastFrameCollections = new Set<number>();

  constructor() {
    super('CollectionSystem', ['CollectibleComponent'], 15);
  }

  protected onInit(): void {
    this.debug('CollectionSystem initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    this.collectionEvents = [];
    this.lastFrameCollections.clear();
    
    // Find player entity
    this.updatePlayerReference(entities);
    
    if (!this.playerEntity) {
      this.warn('No player entity found for collection detection');
      return;
    }

    const collectibleEntities = this.filterEntities(entities);
    
    for (const entity of collectibleEntities) {
      const collectible = this.getComponent<CollectibleComponent>(entity, 'CollectibleComponent');
      if (!collectible || collectible.isCollected) continue;

      this.updateCollectibleVisuals(entity, collectible, deltaTime);
      this.checkCollision(entity, collectible);
    }

    // Process collection events
    this.processCollectionEvents();
  }

  private updatePlayerReference(entities: Entity[]): void {
    // Find player entity (assuming it has PlayerComponent)
    this.playerEntity = entities.find(entity => 
      entity.components.has('PlayerComponent')
    ) || null;
  }

  private updateCollectibleVisuals(entity: Entity, collectible: CollectibleComponent, deltaTime: number): void {
    // Update floating animation
    const time = performance.now() * 0.001;
    const bounceOffset = Math.sin(time * collectible.rotationSpeed) * collectible.bounceAmplitude;
    
    // Update entity position (assuming it has a transform component)
    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (transform) {
      transform.position.y += bounceOffset * deltaTime * 0.01;
    }

    // Update rotation
    if (transform) {
      transform.rotation.y += collectible.rotationSpeed * deltaTime * 0.001;
    }

    // Update glow effect
    collectible.glowIntensity = 0.6 + 0.3 * Math.sin(time * 2);
  }

  private checkCollision(entity: Entity, collectible: CollectibleComponent): void {
    if (!this.playerEntity) return;

    const playerBounds = this.getEntityBounds(this.playerEntity);
    const collectibleBounds = this.getEntityBounds(entity);

    if (!playerBounds || !collectibleBounds) return;

    const distance = this.calculateDistance(playerBounds, collectibleBounds);
    
    if (distance <= collectible.collectionRadius) {
      this.collectPowerup(entity, collectible);
    }
  }

  private getEntityBounds(entity: Entity): CollisionBounds | null {
    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return null;

    // Get collision radius from physics component or use default
    const physics = this.getComponent<any>(entity, 'PhysicsComponent');
    const radius = physics?.collisionRadius || 5;

    return {
      x: transform.position.x,
      y: transform.position.y,
      z: transform.position.z,
      radius
    };
  }

  private calculateDistance(bounds1: CollisionBounds, bounds2: CollisionBounds): number {
    const dx = bounds1.x - bounds2.x;
    const dy = bounds1.y - bounds2.y;
    const dz = bounds1.z - bounds2.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - bounds1.radius - bounds2.radius;
  }

  private collectPowerup(entity: Entity, collectible: CollectibleComponent): void {
    if (collectible.isCollected || this.lastFrameCollections.has(entity.id)) {
      return; // Prevent double collection
    }

    const currentTime = performance.now();
    
    // Mark as collected
    collectible.isCollected = true;
    collectible.collectionTime = currentTime;
    collectible.collectorEntityId = this.playerEntity!.id;
    this.lastFrameCollections.add(entity.id);

    // Update powerup state if it exists
    const powerup = this.getComponent<PowerupComponent>(entity, 'PowerupComponent');
    if (powerup) {
      powerup.state = PowerupState.COLLECTED;
    }

    // Create collection event
    const collectionData: CollectionData = {
      entityId: entity.id,
      powerupType: powerup?.type || 'unknown' as any,
      timestamp: currentTime,
      scoreValue: collectible.scoreValue
    };

    this.collectionEvents.push(collectionData);

    // Trigger collection effects
    this.triggerCollectionEffects(entity, collectible, collectionData);

    this.debug(`Collected powerup: ${powerup?.type || 'unknown'} (Entity: ${entity.id})`);
  }

  private triggerCollectionEffects(
    entity: Entity, 
    collectible: CollectibleComponent, 
    collectionData: CollectionData
  ): void {
    // Trigger visual effects
    this.createCollectionParticles(entity, collectible);
    
    // Play collection sound
    this.playCollectionSound(collectionData.powerupType);
    
    // Add score
    this.addScore(collectible.scoreValue);
    
    // Emit collection event for other systems
    this.emitCollectionEvent(collectionData);
  }

  private createCollectionParticles(entity: Entity, collectible: CollectibleComponent): void {
    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return;

    // Get powerup for visual config
    const powerup = this.getComponent<PowerupComponent>(entity, 'PowerupComponent');
    const color = powerup?.config.visualConfig.color || '#FFFFFF';
    const particleCount = powerup?.config.visualConfig.particleCount || 10;

    // Create particle effect data
    const particleData = {
      position: { ...transform.position },
      color,
      count: particleCount,
      spread: 15,
      speed: 50,
      lifetime: 1.0,
      type: 'collection'
    };

    // Emit particle event (to be handled by ParticleSystem)
    this.emitParticleEvent('create', particleData);
  }

  private playCollectionSound(powerupType: string): void {
    // Emit audio event (to be handled by AudioSystem)
    this.emitAudioEvent('play', {
      sound: 'powerupsound.wav',
      volume: 0.7,
      pitch: 1.0 + Math.random() * 0.2 - 0.1 // Slight pitch variation
    });
  }

  private addScore(value: number): void {
    // Check if doubler is active
    let finalScore = value;
    
    if (this.playerEntity) {
      const doubler = this.getComponent<any>(this.playerEntity, 'DoublerComponent');
      if (doubler && doubler.isActive) {
        finalScore *= doubler.multiplier;
        doubler.totalBonusScore += (finalScore - value);
      }
    }

    // Emit score event (to be handled by ScoreSystem)
    this.emitScoreEvent('add', {
      value: finalScore,
      type: 'powerup',
      source: 'collection'
    });
  }

  private processCollectionEvents(): void {
    for (const event of this.collectionEvents) {
      // Additional processing if needed
      this.debug(`Processed collection event for entity ${event.entityId}`);
    }
  }

  // Event emission methods (these would integrate with the actual event system)
  private emitCollectionEvent(data: CollectionData): void {
    if (this.world) {
      // this.world.eventSystem?.emit('powerup:collected', data);
    }
  }

  private emitParticleEvent(type: string, data: any): void {
    if (this.world) {
      // this.world.eventSystem?.emit(`particle:${type}`, data);
    }
  }

  private emitAudioEvent(type: string, data: any): void {
    if (this.world) {
      // this.world.eventSystem?.emit(`audio:${type}`, data);
    }
  }

  private emitScoreEvent(type: string, data: any): void {
    if (this.world) {
      // this.world.eventSystem?.emit(`score:${type}`, data);
    }
  }

  // Public API methods

  /**
   * Get collection events from the last frame
   */
  getLastFrameCollections(): CollectionData[] {
    return [...this.collectionEvents];
  }

  /**
   * Check if an entity was collected in the last frame
   */
  wasCollectedLastFrame(entityId: number): boolean {
    return this.lastFrameCollections.has(entityId);
  }

  /**
   * Get collection statistics
   */
  getCollectionStats() {
    return {
      totalCollections: this.collectionEvents.length,
      playerEntity: this.playerEntity?.id || null
    };
  }

  /**
   * Force collect a powerup (for testing or special events)
   */
  forceCollect(entityId: number): boolean {
    const entity = this.world?.getEntity(entityId);
    if (!entity) return false;

    const collectible = this.getComponent<CollectibleComponent>(entity, 'CollectibleComponent');
    if (!collectible || collectible.isCollected) return false;

    this.collectPowerup(entity, collectible);
    return true;
  }

  /**
   * Set collection radius for debugging/testing
   */
  setCollectionRadius(entityId: number, radius: number): void {
    const entity = this.world?.getEntity(entityId);
    if (!entity) return;

    const collectible = this.getComponent<CollectibleComponent>(entity, 'CollectibleComponent');
    if (collectible) {
      collectible.collectionRadius = radius;
      this.debug(`Set collection radius for entity ${entityId} to ${radius}`);
    }
  }
}