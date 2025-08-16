/**
 * PowerupSystem Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PowerupSystem } from '@/powerups/systems/PowerupSystem';
import { createPowerupComponent } from '@/powerups/components/PowerupComponent';
import { createMagnetComponent } from '@/powerups/components/MagnetComponent';
import { createDoublerComponent } from '@/powerups/components/DoublerComponent';
import { createInvisibilityComponent } from '@/powerups/components/InvisibilityComponent';
import { PowerupType, PowerupState, POWERUP_CONFIGS } from '@/powerups/types/PowerupTypes';
import { Entity } from '@/types';

// Mock performance.now
vi.stubGlobal('performance', {
  now: vi.fn(() => 1000)
});

describe('PowerupSystem', () => {
  let system: PowerupSystem;
  let mockEntity: Entity;

  beforeEach(() => {
    system = new PowerupSystem();
    system.init?.();
    
    mockEntity = {
      id: 1,
      components: new Map()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct system configuration', () => {
      expect(system.id).toBe('PowerupSystem');
      expect(system.requiredComponents).toEqual(['PowerupComponent']);
      expect(system.priority).toBe(10);
    });

    it('should be enabled after initialization', () => {
      expect(system.isEnabled()).toBe(true);
    });
  });

  describe('powerup lifecycle', () => {
    it('should handle spawned powerup state', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(16.67, [mockEntity]);

      expect(powerup.state).toBe(PowerupState.SPAWNED);
      expect(powerup.isActive).toBe(false);
    });

    it('should activate powerup when collected', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      const magnet = createMagnetComponent();
      
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('MagnetComponent', magnet);

      system.update(16.67, [mockEntity]);

      expect(powerup.state).toBe(PowerupState.ACTIVE);
      expect(powerup.isActive).toBe(true);
      expect(powerup.activationTime).toBe(1000);
      expect(powerup.expirationTime).toBe(1000 + powerup.config.duration);
      expect(magnet.isActive).toBe(true);
    });

    it('should update remaining duration for active powerups', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 5000;
      
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(1000, [mockEntity]); // 1 second

      expect(powerup.remainingDuration).toBe(4000);
    });

    it('should expire powerup when duration reaches zero', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      const magnet = createMagnetComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 500;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('MagnetComponent', magnet);

      system.update(1000, [mockEntity]); // 1 second

      expect(powerup.state).toBe(PowerupState.EXPIRED);
      expect(powerup.isActive).toBe(false);
      expect(powerup.remainingDuration).toBe(0);
      expect(magnet.isActive).toBe(false);
    });
  });

  describe('magnet powerup effects', () => {
    it('should apply magnet effects when activated', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      const magnet = createMagnetComponent();
      
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('MagnetComponent', magnet);

      system.update(16.67, [mockEntity]);

      expect(magnet.isActive).toBe(true);
      expect(magnet.attractionRadius).toBe(80);
      expect(magnet.attractionForce).toBe(150);
    });

    it('should deactivate magnet effects when expired', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      const magnet = createMagnetComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 0;
      magnet.isActive = true;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('MagnetComponent', magnet);

      system.update(16.67, [mockEntity]);

      expect(magnet.isActive).toBe(false);
      expect(magnet.affectedEntities.size).toBe(0);
    });

    it('should update magnet visual effects based on remaining time', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      const magnet = createMagnetComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 5000; // Half duration
      magnet.isActive = true;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('MagnetComponent', magnet);

      system.update(16.67, [mockEntity]);

      const timeRatio = powerup.remainingDuration / powerup.config.duration; // 0.5
      expect(magnet.visualEffect.fieldOpacity).toBe(0.3 * timeRatio);
    });
  });

  describe('doubler powerup effects', () => {
    it('should apply doubler effects when activated', () => {
      const powerup = createPowerupComponent(PowerupType.DOUBLER, POWERUP_CONFIGS[PowerupType.DOUBLER]);
      const doubler = createDoublerComponent();
      
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('DoublerComponent', doubler);

      system.update(16.67, [mockEntity]);

      expect(doubler.isActive).toBe(true);
      expect(doubler.multiplier).toBe(2);
    });

    it('should deactivate doubler effects when expired', () => {
      const powerup = createPowerupComponent(PowerupType.DOUBLER, POWERUP_CONFIGS[PowerupType.DOUBLER]);
      const doubler = createDoublerComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 0;
      doubler.isActive = true;
      doubler.multiplier = 2;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('DoublerComponent', doubler);

      system.update(16.67, [mockEntity]);

      expect(doubler.isActive).toBe(false);
      expect(doubler.multiplier).toBe(doubler.originalMultiplier);
    });

    it('should update doubler visual indicator', () => {
      const powerup = createPowerupComponent(PowerupType.DOUBLER, POWERUP_CONFIGS[PowerupType.DOUBLER]);
      const doubler = createDoublerComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 5000;
      doubler.isActive = true;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('DoublerComponent', doubler);

      system.update(16.67, [mockEntity]);

      // Visual indicator should be animated
      expect(doubler.visualIndicator.textScale).toBeCloseTo(1.5, 1);
    });
  });

  describe('invisibility powerup effects', () => {
    it('should apply invisibility effects when activated', () => {
      const powerup = createPowerupComponent(PowerupType.INVISIBILITY, POWERUP_CONFIGS[PowerupType.INVISIBILITY]);
      const invisibility = createInvisibilityComponent();
      
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('InvisibilityComponent', invisibility);

      system.update(16.67, [mockEntity]);

      expect(invisibility.isActive).toBe(true);
      expect(invisibility.immunityActive).toBe(true);
      expect(invisibility.transparencyLevel).toBe(0.5);
    });

    it('should deactivate invisibility effects when expired', () => {
      const powerup = createPowerupComponent(PowerupType.INVISIBILITY, POWERUP_CONFIGS[PowerupType.INVISIBILITY]);
      const invisibility = createInvisibilityComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 0;
      invisibility.isActive = true;
      invisibility.immunityActive = true;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('InvisibilityComponent', invisibility);

      system.update(16.67, [mockEntity]);

      expect(invisibility.isActive).toBe(false);
      expect(invisibility.immunityActive).toBe(false);
      expect(invisibility.transparencyLevel).toBe(invisibility.originalOpacity);
    });

    it('should update invisibility visual effects', () => {
      const powerup = createPowerupComponent(PowerupType.INVISIBILITY, POWERUP_CONFIGS[PowerupType.INVISIBILITY]);
      const invisibility = createInvisibilityComponent();
      
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 2500; // Quarter duration
      invisibility.isActive = true;
      
      mockEntity.components.set('PowerupComponent', powerup);
      mockEntity.components.set('InvisibilityComponent', invisibility);

      system.update(16.67, [mockEntity]);

      const timeRatio = powerup.remainingDuration / powerup.config.duration; // 0.25
      expect(invisibility.visualEffect.outlineIntensity).toBe(0.8 * timeRatio);
    });
  });

  describe('public API methods', () => {
    it('should track active powerups', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(16.67, [mockEntity]);

      const activePowerups = system.getActivePowerups();
      expect(activePowerups.has(mockEntity.id)).toBe(true);
      expect(activePowerups.get(mockEntity.id)?.type).toBe(PowerupType.MAGNET);
    });

    it('should return remaining time for powerups', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 7500;
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(16.67, [mockEntity]);

      const remainingTime = system.getRemainingTime(mockEntity.id);
      expect(remainingTime).toBeCloseTo(7500, 0);
    });

    it('should check if specific powerup type is active', () => {
      const powerup = createPowerupComponent(PowerupType.DOUBLER, POWERUP_CONFIGS[PowerupType.DOUBLER]);
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(16.67, [mockEntity]);

      expect(system.hasPowerupActive(mockEntity.id, PowerupType.DOUBLER)).toBe(true);
      expect(system.hasPowerupActive(mockEntity.id, PowerupType.MAGNET)).toBe(false);
    });

    it('should force expire powerups', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      powerup.state = PowerupState.COLLECTED;
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(16.67, [mockEntity]); // Activate
      
      system.expirePowerupByEntity(mockEntity.id);
      
      expect(powerup.remainingDuration).toBe(0);
    });

    it('should provide system statistics', () => {
      const powerup1 = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      const powerup2 = createPowerupComponent(PowerupType.DOUBLER, POWERUP_CONFIGS[PowerupType.DOUBLER]);
      
      powerup1.state = PowerupState.COLLECTED;
      powerup2.state = PowerupState.COLLECTED;
      
      const entity1 = { id: 1, components: new Map([['PowerupComponent', powerup1]]) };
      const entity2 = { id: 2, components: new Map([['PowerupComponent', powerup2]]) };

      system.update(16.67, [entity1, entity2]);

      const stats = system.getStats();
      expect(stats.activePowerups).toBe(2);
      expect(stats.powerupTypes[PowerupType.MAGNET]).toBe(1);
      expect(stats.powerupTypes[PowerupType.DOUBLER]).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle entities without required components gracefully', () => {
      const entityWithoutPowerup = { id: 999, components: new Map() };
      
      expect(() => {
        system.update(16.67, [entityWithoutPowerup]);
      }).not.toThrow();
    });

    it('should handle powerups with zero duration', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      powerup.state = PowerupState.ACTIVE;
      powerup.isActive = true;
      powerup.remainingDuration = 0;
      
      mockEntity.components.set('PowerupComponent', powerup);

      expect(() => {
        system.update(16.67, [mockEntity]);
      }).not.toThrow();
      
      expect(powerup.state).toBe(PowerupState.EXPIRED);
    });

    it('should cleanup expired powerups properly', () => {
      const powerup = createPowerupComponent(PowerupType.MAGNET, POWERUP_CONFIGS[PowerupType.MAGNET]);
      powerup.state = PowerupState.EXPIRED;
      powerup.remainingDuration = -1000;
      
      mockEntity.components.set('PowerupComponent', powerup);

      system.update(16.67, [mockEntity]);

      const activePowerups = system.getActivePowerups();
      expect(activePowerups.has(mockEntity.id)).toBe(false);
    });
  });
});