/**
 * PowerupSystem
 * Manages powerup activation, duration tracking, and expiration
 */

import { BaseSystem } from '@/systems/core/BaseSystem';
import { Entity } from '@/types';
import { PowerupComponent } from '../components/PowerupComponent';
import { MagnetComponent } from '../components/MagnetComponent';
import { DoublerComponent } from '../components/DoublerComponent';
import { InvisibilityComponent } from '../components/InvisibilityComponent';
import { PowerupState, PowerupType } from '../types/PowerupTypes';

export class PowerupSystem extends BaseSystem {
  private activePowerups = new Map<number, PowerupComponent>();
  private powerupTimers = new Map<number, number>();

  constructor() {
    super('PowerupSystem', ['PowerupComponent'], 10);
  }

  protected onInit(): void {
    this.debug('PowerupSystem initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    const powerupEntities = this.filterEntities(entities);
    
    for (const entity of powerupEntities) {
      const powerup = this.getComponent<PowerupComponent>(entity, 'PowerupComponent');
      if (!powerup) continue;

      this.updatePowerup(entity, powerup, deltaTime);
    }

    // Clean up expired powerups
    this.cleanupExpiredPowerups();
  }

  private updatePowerup(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    switch (powerup.state) {
      case PowerupState.SPAWNED:
        this.handleSpawnedPowerup(entity, powerup);
        break;
        
      case PowerupState.COLLECTED:
        this.handleCollectedPowerup(entity, powerup, deltaTime);
        break;
        
      case PowerupState.ACTIVE:
        this.handleActivePowerup(entity, powerup, deltaTime);
        break;
        
      case PowerupState.EXPIRED:
        this.handleExpiredPowerup(entity, powerup);
        break;
    }
  }

  private handleSpawnedPowerup(entity: Entity, powerup: PowerupComponent): void {
    // Powerup is spawned and waiting to be collected
    // Visual effects and physics are handled by other systems
    this.debug(`Powerup ${powerup.type} spawned on entity ${entity.id}`);
  }

  private handleCollectedPowerup(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    // Activate the powerup immediately when collected
    this.activatePowerup(entity, powerup);
  }

  private handleActivePowerup(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    // Update remaining duration
    powerup.remainingDuration -= deltaTime;
    
    // Check if powerup should expire
    if (powerup.remainingDuration <= 0) {
      this.expirePowerup(entity, powerup);
      return;
    }

    // Update specific powerup effects
    this.updatePowerupEffects(entity, powerup, deltaTime);
    
    // Update timer display
    this.powerupTimers.set(entity.id, powerup.remainingDuration);
  }

  private handleExpiredPowerup(entity: Entity, powerup: PowerupComponent): void {
    // Clean up expired powerup
    this.deactivatePowerup(entity, powerup);
    this.removePowerup(entity);
  }

  private activatePowerup(entity: Entity, powerup: PowerupComponent): void {
    const currentTime = performance.now();
    
    powerup.state = PowerupState.ACTIVE;
    powerup.isActive = true;
    powerup.activationTime = currentTime;
    powerup.expirationTime = currentTime + powerup.config.duration;
    powerup.remainingDuration = powerup.config.duration;
    
    // Apply specific powerup effects
    this.applyPowerupEffects(entity, powerup);
    
    // Track active powerup
    this.activePowerups.set(entity.id, powerup);
    
    this.debug(`Activated ${powerup.type} powerup on entity ${entity.id}`);
    
    // Emit activation event
    this.emitPowerupEvent('activated', {
      entityId: entity.id,
      type: powerup.type,
      duration: powerup.config.duration
    });
  }

  private expirePowerup(entity: Entity, powerup: PowerupComponent): void {
    powerup.state = PowerupState.EXPIRED;
    powerup.isActive = false;
    powerup.remainingDuration = 0;
    
    // Deactivate powerup effects immediately
    this.deactivatePowerup(entity, powerup);
    
    this.debug(`Expired ${powerup.type} powerup on entity ${entity.id}`);
    
    // Emit expiration event
    this.emitPowerupEvent('expired', {
      entityId: entity.id,
      type: powerup.type,
      duration: powerup.config.duration
    });
  }

  private applyPowerupEffects(entity: Entity, powerup: PowerupComponent): void {
    switch (powerup.type) {
      case PowerupType.MAGNET:
        this.applyMagnetEffect(entity, powerup);
        break;
        
      case PowerupType.DOUBLER:
        this.applyDoublerEffect(entity, powerup);
        break;
        
      case PowerupType.INVISIBILITY:
        this.applyInvisibilityEffect(entity, powerup);
        break;
    }
    
    powerup.effectsApplied = true;
  }

  private applyMagnetEffect(entity: Entity, powerup: PowerupComponent): void {
    const magnetComponent = this.getComponent<MagnetComponent>(entity, 'MagnetComponent');
    if (magnetComponent) {
      magnetComponent.isActive = true;
      const radiusEffect = powerup.config.effects.find(e => e.type === 'magnetRadius');
      const forceEffect = powerup.config.effects.find(e => e.type === 'magnetForce');
      
      if (radiusEffect) magnetComponent.attractionRadius = radiusEffect.value;
      if (forceEffect) magnetComponent.attractionForce = forceEffect.value;
      
      this.debug(`Applied magnet effect: radius=${magnetComponent.attractionRadius}, force=${magnetComponent.attractionForce}`);
    }
  }

  private applyDoublerEffect(entity: Entity, powerup: PowerupComponent): void {
    const doublerComponent = this.getComponent<DoublerComponent>(entity, 'DoublerComponent');
    if (doublerComponent) {
      doublerComponent.isActive = true;
      const multiplierEffect = powerup.config.effects.find(e => e.type === 'scoreMultiplier');
      
      if (multiplierEffect) {
        doublerComponent.multiplier = multiplierEffect.value;
      }
      
      this.debug(`Applied doubler effect: multiplier=${doublerComponent.multiplier}`);
    }
  }

  private applyInvisibilityEffect(entity: Entity, powerup: PowerupComponent): void {
    const invisibilityComponent = this.getComponent<InvisibilityComponent>(entity, 'InvisibilityComponent');
    if (invisibilityComponent) {
      invisibilityComponent.isActive = true;
      invisibilityComponent.immunityActive = true;
      
      const transparencyEffect = powerup.config.effects.find(e => e.type === 'transparency');
      if (transparencyEffect) {
        invisibilityComponent.transparencyLevel = transparencyEffect.value;
      }
      
      this.debug(`Applied invisibility effect: transparency=${invisibilityComponent.transparencyLevel}`);
    }
  }

  private updatePowerupEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    // Update ongoing effects based on powerup type
    switch (powerup.type) {
      case PowerupType.MAGNET:
        this.updateMagnetEffect(entity, powerup, deltaTime);
        break;
        
      case PowerupType.DOUBLER:
        this.updateDoublerEffect(entity, powerup, deltaTime);
        break;
        
      case PowerupType.INVISIBILITY:
        this.updateInvisibilityEffect(entity, powerup, deltaTime);
        break;
    }
  }

  private updateMagnetEffect(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    const magnetComponent = this.getComponent<MagnetComponent>(entity, 'MagnetComponent');
    if (magnetComponent && magnetComponent.isActive) {
      // Update visual effects (handled by VisualEffectsSystem)
      // Magnet effect radius might change over time
      const timeRatio = powerup.remainingDuration / powerup.config.duration;
      magnetComponent.visualEffect.fieldOpacity = 0.3 * timeRatio;
    }
  }

  private updateDoublerEffect(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    const doublerComponent = this.getComponent<DoublerComponent>(entity, 'DoublerComponent');
    if (doublerComponent && doublerComponent.isActive) {
      // Update visual indicator intensity based on remaining time
      const timeRatio = powerup.remainingDuration / powerup.config.duration;
      doublerComponent.visualIndicator.textScale = 1.5 + (0.3 * Math.sin(performance.now() * 0.01));
    }
  }

  private updateInvisibilityEffect(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    const invisibilityComponent = this.getComponent<InvisibilityComponent>(entity, 'InvisibilityComponent');
    if (invisibilityComponent && invisibilityComponent.isActive) {
      // Update shimmer effect
      const timeRatio = powerup.remainingDuration / powerup.config.duration;
      invisibilityComponent.visualEffect.outlineIntensity = 0.8 * timeRatio;
    }
  }

  private deactivatePowerup(entity: Entity, powerup: PowerupComponent): void {
    // Remove specific powerup effects
    switch (powerup.type) {
      case PowerupType.MAGNET:
        this.deactivateMagnetEffect(entity);
        break;
        
      case PowerupType.DOUBLER:
        this.deactivateDoublerEffect(entity);
        break;
        
      case PowerupType.INVISIBILITY:
        this.deactivateInvisibilityEffect(entity);
        break;
    }
  }

  private deactivateMagnetEffect(entity: Entity): void {
    const magnetComponent = this.getComponent<MagnetComponent>(entity, 'MagnetComponent');
    if (magnetComponent) {
      magnetComponent.isActive = false;
      magnetComponent.affectedEntities.clear();
      this.debug('Deactivated magnet effect');
    }
  }

  private deactivateDoublerEffect(entity: Entity): void {
    const doublerComponent = this.getComponent<DoublerComponent>(entity, 'DoublerComponent');
    if (doublerComponent) {
      doublerComponent.isActive = false;
      doublerComponent.multiplier = doublerComponent.originalMultiplier;
      this.debug(`Deactivated doubler effect, total bonus: ${doublerComponent.totalBonusScore}`);
    }
  }

  private deactivateInvisibilityEffect(entity: Entity): void {
    const invisibilityComponent = this.getComponent<InvisibilityComponent>(entity, 'InvisibilityComponent');
    if (invisibilityComponent) {
      invisibilityComponent.isActive = false;
      invisibilityComponent.immunityActive = false;
      invisibilityComponent.transparencyLevel = invisibilityComponent.originalOpacity;
      this.debug(`Deactivated invisibility effect, collisions bypassed: ${invisibilityComponent.collisionBypassCount}`);
    }
  }

  private removePowerup(entity: Entity): void {
    this.activePowerups.delete(entity.id);
    this.powerupTimers.delete(entity.id);
    
    // Remove powerup component from entity
    entity.components.delete('PowerupComponent');
    
    this.debug(`Removed powerup from entity ${entity.id}`);
  }

  private cleanupExpiredPowerups(): void {
    // Clean up any lingering expired powerups
    const expiredIds: number[] = [];
    
    for (const [entityId, powerup] of this.activePowerups) {
      if (powerup.state === PowerupState.EXPIRED || powerup.remainingDuration <= 0) {
        expiredIds.push(entityId);
      }
    }
    
    for (const entityId of expiredIds) {
      this.activePowerups.delete(entityId);
      this.powerupTimers.delete(entityId);
    }
  }

  private emitPowerupEvent(eventType: string, data: any): void {
    // Emit events for other systems to listen to
    if (this.world) {
      // Assuming the world has an event system
      // this.world.eventSystem?.emit(`powerup:${eventType}`, data);
    }
  }

  // Public API methods

  /**
   * Get all currently active powerups
   */
  getActivePowerups(): Map<number, PowerupComponent> {
    return new Map(this.activePowerups);
  }

  /**
   * Get remaining time for a specific powerup
   */
  getRemainingTime(entityId: number): number {
    return this.powerupTimers.get(entityId) || 0;
  }

  /**
   * Check if a specific powerup type is active
   */
  hasPowerupActive(entityId: number, type: PowerupType): boolean {
    const powerup = this.activePowerups.get(entityId);
    return powerup?.type === type && powerup.isActive;
  }

  /**
   * Force expire a powerup
   */
  expirePowerupByEntity(entityId: number): void {
    const powerup = this.activePowerups.get(entityId);
    if (powerup && powerup.isActive) {
      powerup.remainingDuration = 0;
      this.debug(`Force expired powerup on entity ${entityId}`);
    }
  }

  /**
   * Get powerup system statistics
   */
  getStats() {
    return {
      activePowerups: this.activePowerups.size,
      powerupTypes: Array.from(this.activePowerups.values()).reduce((acc, powerup) => {
        acc[powerup.type] = (acc[powerup.type] || 0) + 1;
        return acc;
      }, {} as Record<PowerupType, number>)
    };
  }
}