/**
 * VisualEffectsSystem
 * Handles visual feedback and effects for powerups
 */

import { BaseSystem } from '@/systems/core/BaseSystem';
import { Entity } from '@/types';
import { PowerupComponent } from '../components/PowerupComponent';
import { MagnetComponent } from '../components/MagnetComponent';
import { DoublerComponent } from '../components/DoublerComponent';
import { InvisibilityComponent } from '../components/InvisibilityComponent';
import { PowerupType, PowerupState } from '../types/PowerupTypes';

interface VisualEffect {
  id: string;
  type: string;
  entityId: number;
  startTime: number;
  duration: number;
  data: any;
}

interface ParticleSystem {
  position: { x: number; y: number; z: number };
  count: number;
  color: string;
  spread: number;
  speed: number;
  lifetime: number;
  type: string;
}

export class VisualEffectsSystem extends BaseSystem {
  private activeEffects = new Map<string, VisualEffect>();
  private particleSystems = new Map<number, ParticleSystem[]>();
  private uiElements = new Map<number, any>();
  private effectIdCounter = 0;

  constructor() {
    super('VisualEffectsSystem', [], 5); // Low priority, runs after other systems
  }

  protected onInit(): void {
    this.debug('VisualEffectsSystem initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Update powerup visual effects
    this.updatePowerupEffects(entities, deltaTime);
    
    // Update active visual effects
    this.updateActiveEffects(deltaTime);
    
    // Update particle systems
    this.updateParticleSystems(deltaTime);
    
    // Update UI overlays
    this.updateUIOverlays(entities, deltaTime);
    
    // Cleanup expired effects
    this.cleanupExpiredEffects();
  }

  private updatePowerupEffects(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const powerup = this.getComponent<PowerupComponent>(entity, 'PowerupComponent');
      if (!powerup) continue;

      switch (powerup.state) {
        case PowerupState.SPAWNED:
          this.updateSpawnedEffects(entity, powerup, deltaTime);
          break;
          
        case PowerupState.ACTIVE:
          this.updateActiveEffects(entity, powerup, deltaTime);
          break;
          
        case PowerupState.COLLECTED:
          this.updateCollectionEffects(entity, powerup, deltaTime);
          break;
      }
    }
  }

  private updateSpawnedEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    // Floating animation and glow effects for spawned powerups
    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return;

    const time = performance.now() * 0.001;
    const config = powerup.config.visualConfig;
    
    // Floating animation
    const floatOffset = Math.sin(time * 2) * 0.5;
    transform.position.y += floatOffset * deltaTime * 0.1;
    
    // Rotation animation
    transform.rotation.y += deltaTime * 0.001;
    
    // Pulsing glow effect
    const glowIntensity = config.glowIntensity * (0.7 + 0.3 * Math.sin(time * 3));
    
    // Create glow particle effect
    this.createGlowEffect(entity, {
      color: config.color,
      intensity: glowIntensity,
      radius: 10,
      type: 'glow'
    });
  }

  private updateActiveEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    switch (powerup.type) {
      case PowerupType.MAGNET:
        this.updateMagnetVisualEffects(entity, powerup, deltaTime);
        break;
        
      case PowerupType.DOUBLER:
        this.updateDoublerVisualEffects(entity, powerup, deltaTime);
        break;
        
      case PowerupType.INVISIBILITY:
        this.updateInvisibilityVisualEffects(entity, powerup, deltaTime);
        break;
    }
  }

  private updateMagnetVisualEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    const magnet = this.getComponent<MagnetComponent>(entity, 'MagnetComponent');
    if (!magnet || !magnet.isActive) return;

    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return;

    // Create magnetic field visualization
    this.createMagneticFieldEffect(entity, {
      position: transform.position,
      radius: magnet.attractionRadius,
      color: magnet.visualEffect.fieldColor,
      opacity: magnet.visualEffect.fieldOpacity,
      pulseSpeed: magnet.visualEffect.pulseSpeed
    });

    // Create attraction lines to affected entities
    for (const affectedEntityId of magnet.affectedEntities) {
      this.createAttractionLine(entity.id, affectedEntityId, magnet.visualEffect.fieldColor);
    }

    // Player glow effect
    this.createPlayerGlowEffect(entity, {
      color: '#FF3333',
      intensity: 0.8,
      type: 'magnet'
    });
  }

  private updateDoublerVisualEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    const doubler = this.getComponent<DoublerComponent>(entity, 'DoublerComponent');
    if (!doubler || !doubler.isActive) return;

    // Animated multiplier indicator
    const time = performance.now() * 0.001;
    const scale = doubler.visualIndicator.textScale + 0.1 * Math.sin(time * 4);
    
    this.createMultiplierUI(entity, {
      text: `x${doubler.multiplier}`,
      color: doubler.visualIndicator.textColor,
      scale: scale,
      glow: doubler.visualIndicator.glowEffect,
      position: 'top-center'
    });

    // Player glow effect
    this.createPlayerGlowEffect(entity, {
      color: '#3333FF',
      intensity: 0.7,
      type: 'doubler'
    });

    // Score particle burst on collection
    if (doubler.totalBonusScore > 0) {
      this.createScoreBurstEffect(entity, doubler.totalBonusScore);
    }
  }

  private updateInvisibilityVisualEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    const invisibility = this.getComponent<InvisibilityComponent>(entity, 'InvisibilityComponent');
    if (!invisibility || !invisibility.isActive) return;

    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return;

    // Shimmer effect
    if (invisibility.visualEffect.shimmerEffect) {
      const time = performance.now() * 0.001;
      const shimmerIntensity = 0.5 + 0.3 * Math.sin(time * invisibility.visualEffect.shimmerSpeed);
      
      this.createShimmerEffect(entity, {
        intensity: shimmerIntensity,
        color: invisibility.visualEffect.outlineColor,
        transparency: invisibility.transparencyLevel
      });
    }

    // Outline glow effect
    this.createOutlineEffect(entity, {
      color: invisibility.visualEffect.outlineColor,
      intensity: invisibility.visualEffect.outlineIntensity,
      thickness: 2
    });

    // Phase particles
    this.createPhaseParticles(entity, {
      color: '#9933FF',
      density: 0.3,
      speed: 20
    });
  }

  private updateCollectionEffects(entity: Entity, powerup: PowerupComponent, deltaTime: number): void {
    // Collection burst effect
    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return;

    const config = powerup.config.visualConfig;
    
    this.createCollectionBurst(entity, {
      position: transform.position,
      color: config.color,
      particleCount: config.particleCount,
      spread: 30,
      speed: 100,
      lifetime: 1.5
    });

    // Flash effect
    this.createFlashEffect(entity, {
      color: config.color,
      intensity: 1.0,
      duration: 0.3
    });
  }

  // Effect creation methods

  private createGlowEffect(entity: Entity, params: any): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'glow',
      entityId: entity.id,
      startTime: performance.now(),
      duration: 100, // Continuous
      data: params
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createMagneticFieldEffect(entity: Entity, params: any): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'magnetic_field',
      entityId: entity.id,
      startTime: performance.now(),
      duration: 100, // Continuous while active
      data: params
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createAttractionLine(fromEntityId: number, toEntityId: number, color: string): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'attraction_line',
      entityId: fromEntityId,
      startTime: performance.now(),
      duration: 100, // One frame
      data: { fromEntityId, toEntityId, color, opacity: 0.6 }
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createPlayerGlowEffect(entity: Entity, params: any): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'player_glow',
      entityId: entity.id,
      startTime: performance.now(),
      duration: 100, // Continuous
      data: params
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createMultiplierUI(entity: Entity, params: any): void {
    const uiElement = {
      type: 'multiplier_text',
      text: params.text,
      color: params.color,
      scale: params.scale,
      glow: params.glow,
      position: params.position,
      timestamp: performance.now()
    };
    
    this.uiElements.set(entity.id, uiElement);
  }

  private createScoreBurstEffect(entity: Entity, bonusScore: number): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'score_burst',
      entityId: entity.id,
      startTime: performance.now(),
      duration: 2000,
      data: { score: bonusScore, color: '#FFD700' }
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createShimmerEffect(entity: Entity, params: any): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'shimmer',
      entityId: entity.id,
      startTime: performance.now(),
      duration: 100, // Continuous
      data: params
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createOutlineEffect(entity: Entity, params: any): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'outline',
      entityId: entity.id,
      startTime: performance.now(),
      duration: 100, // Continuous
      data: params
    };
    
    this.activeEffects.set(effectId, effect);
  }

  private createPhaseParticles(entity: Entity, params: any): void {
    const transform = this.getComponent<any>(entity, 'TransformComponent');
    if (!transform) return;

    const particleSystem: ParticleSystem = {
      position: { ...transform.position },
      count: 5,
      color: params.color,
      spread: 15,
      speed: params.speed,
      lifetime: 2.0,
      type: 'phase'
    };

    const systems = this.particleSystems.get(entity.id) || [];
    systems.push(particleSystem);
    this.particleSystems.set(entity.id, systems);
  }

  private createCollectionBurst(entity: Entity, params: any): void {
    const particleSystem: ParticleSystem = {
      position: params.position,
      count: params.particleCount,
      color: params.color,
      spread: params.spread,
      speed: params.speed,
      lifetime: params.lifetime,
      type: 'burst'
    };

    const systems = this.particleSystems.get(entity.id) || [];
    systems.push(particleSystem);
    this.particleSystems.set(entity.id, systems);
  }

  private createFlashEffect(entity: Entity, params: any): void {
    const effectId = this.generateEffectId();
    const effect: VisualEffect = {
      id: effectId,
      type: 'flash',
      entityId: entity.id,
      startTime: performance.now(),
      duration: params.duration * 1000,
      data: params
    };
    
    this.activeEffects.set(effectId, effect);
  }

  // Update methods

  private updateActiveEffects(deltaTime: number): void {
    const currentTime = performance.now();
    
    for (const [effectId, effect] of this.activeEffects) {
      const elapsed = currentTime - effect.startTime;
      
      if (elapsed >= effect.duration && effect.duration > 0) {
        this.activeEffects.delete(effectId);
        continue;
      }

      // Update effect based on type
      this.updateEffectByType(effect, elapsed, deltaTime);
    }
  }

  private updateEffectByType(effect: VisualEffect, elapsed: number, deltaTime: number): void {
    switch (effect.type) {
      case 'flash':
        this.updateFlashEffect(effect, elapsed);
        break;
        
      case 'magnetic_field':
        this.updateMagneticFieldVisual(effect, elapsed);
        break;
        
      case 'score_burst':
        this.updateScoreBurstEffect(effect, elapsed);
        break;
        
      // Add more effect types as needed
    }
  }

  private updateFlashEffect(effect: VisualEffect, elapsed: number): void {
    const progress = elapsed / effect.duration;
    const intensity = Math.max(0, 1 - progress);
    effect.data.currentIntensity = effect.data.intensity * intensity;
  }

  private updateMagneticFieldVisual(effect: VisualEffect, elapsed: number): void {
    const time = elapsed * 0.001;
    const pulsePhase = Math.sin(time * effect.data.pulseSpeed);
    effect.data.currentOpacity = effect.data.opacity * (0.7 + 0.3 * pulsePhase);
  }

  private updateScoreBurstEffect(effect: VisualEffect, elapsed: number): void {
    const progress = elapsed / effect.duration;
    effect.data.currentScale = 1 + progress * 0.5;
    effect.data.currentOpacity = Math.max(0, 1 - progress);
  }

  private updateParticleSystems(deltaTime: number): void {
    for (const [entityId, systems] of this.particleSystems) {
      const activeSystems = systems.filter(system => {
        system.lifetime -= deltaTime * 0.001;
        return system.lifetime > 0;
      });
      
      if (activeSystems.length > 0) {
        this.particleSystems.set(entityId, activeSystems);
      } else {
        this.particleSystems.delete(entityId);
      }
    }
  }

  private updateUIOverlays(entities: Entity[], deltaTime: number): void {
    const currentTime = performance.now();
    
    // Clean up old UI elements
    for (const [entityId, element] of this.uiElements) {
      if (currentTime - element.timestamp > 100) { // Clean up after 100ms
        this.uiElements.delete(entityId);
      }
    }
  }

  private cleanupExpiredEffects(): void {
    // Additional cleanup for any lingering effects
    const currentTime = performance.now();
    const expiredIds: string[] = [];
    
    for (const [effectId, effect] of this.activeEffects) {
      if (effect.duration > 0 && (currentTime - effect.startTime) >= effect.duration) {
        expiredIds.push(effectId);
      }
    }
    
    for (const effectId of expiredIds) {
      this.activeEffects.delete(effectId);
    }
  }

  // Utility methods

  private generateEffectId(): string {
    return `effect_${++this.effectIdCounter}`;
  }

  // Public API methods

  /**
   * Get all active visual effects
   */
  getActiveEffects(): Map<string, VisualEffect> {
    return new Map(this.activeEffects);
  }

  /**
   * Get particle systems for an entity
   */
  getParticleSystems(entityId: number): ParticleSystem[] {
    return this.particleSystems.get(entityId) || [];
  }

  /**
   * Get UI elements for rendering
   */
  getUIElements(): Map<number, any> {
    return new Map(this.uiElements);
  }

  /**
   * Manually trigger a visual effect
   */
  triggerEffect(type: string, entityId: number, params: any): void {
    const entity = this.world?.getEntity(entityId);
    if (!entity) return;

    switch (type) {
      case 'flash':
        this.createFlashEffect(entity, params);
        break;
        
      case 'burst':
        this.createCollectionBurst(entity, params);
        break;
        
      case 'glow':
        this.createGlowEffect(entity, params);
        break;
        
      default:
        this.warn(`Unknown effect type: ${type}`);
    }
  }

  /**
   * Clear all effects for an entity
   */
  clearEntityEffects(entityId: number): void {
    // Remove from active effects
    const effectsToRemove: string[] = [];
    for (const [effectId, effect] of this.activeEffects) {
      if (effect.entityId === entityId) {
        effectsToRemove.push(effectId);
      }
    }
    
    for (const effectId of effectsToRemove) {
      this.activeEffects.delete(effectId);
    }
    
    // Remove particle systems
    this.particleSystems.delete(entityId);
    
    // Remove UI elements
    this.uiElements.delete(entityId);
    
    this.debug(`Cleared all effects for entity ${entityId}`);
  }

  /**
   * Get visual effects statistics
   */
  getStats() {
    return {
      activeEffects: this.activeEffects.size,
      activeParticleSystems: this.particleSystems.size,
      activeUIElements: this.uiElements.size,
      effectTypes: Array.from(this.activeEffects.values()).reduce((acc, effect) => {
        acc[effect.type] = (acc[effect.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}