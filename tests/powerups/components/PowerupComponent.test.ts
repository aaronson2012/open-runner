/**
 * PowerupComponent Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPowerupComponent } from '@/powerups/components/PowerupComponent';
import { PowerupType, PowerupState, POWERUP_CONFIGS } from '@/powerups/types/PowerupTypes';

describe('PowerupComponent', () => {
  describe('createPowerupComponent', () => {
    it('should create a powerup component with correct default values', () => {
      const config = POWERUP_CONFIGS[PowerupType.MAGNET];
      const component = createPowerupComponent(PowerupType.MAGNET, config);

      expect(component.type).toBe(PowerupType.MAGNET);
      expect(component.state).toBe(PowerupState.SPAWNED);
      expect(component.config).toBe(config);
      expect(component.activationTime).toBe(0);
      expect(component.expirationTime).toBe(0);
      expect(component.remainingDuration).toBe(config.duration);
      expect(component.isActive).toBe(false);
      expect(component.effectsApplied).toBe(false);
    });

    it('should create magnet powerup with correct configuration', () => {
      const config = POWERUP_CONFIGS[PowerupType.MAGNET];
      const component = createPowerupComponent(PowerupType.MAGNET, config);

      expect(component.config.duration).toBe(10000);
      expect(component.config.effects).toHaveLength(2);
      expect(component.config.effects[0].type).toBe('magnetRadius');
      expect(component.config.effects[0].value).toBe(80);
      expect(component.config.effects[1].type).toBe('magnetForce');
      expect(component.config.effects[1].value).toBe(150);
    });

    it('should create doubler powerup with correct configuration', () => {
      const config = POWERUP_CONFIGS[PowerupType.DOUBLER];
      const component = createPowerupComponent(PowerupType.DOUBLER, config);

      expect(component.config.duration).toBe(10000);
      expect(component.config.effects).toHaveLength(1);
      expect(component.config.effects[0].type).toBe('scoreMultiplier');
      expect(component.config.effects[0].value).toBe(2);
    });

    it('should create invisibility powerup with correct configuration', () => {
      const config = POWERUP_CONFIGS[PowerupType.INVISIBILITY];
      const component = createPowerupComponent(PowerupType.INVISIBILITY, config);

      expect(component.config.duration).toBe(10000);
      expect(component.config.effects).toHaveLength(2);
      expect(component.config.effects[0].type).toBe('enemyImmunity');
      expect(component.config.effects[0].value).toBe(1);
      expect(component.config.effects[1].type).toBe('transparency');
      expect(component.config.effects[1].value).toBe(0.5);
    });

    it('should have correct visual configurations for each powerup type', () => {
      const magnetConfig = POWERUP_CONFIGS[PowerupType.MAGNET];
      const doublerConfig = POWERUP_CONFIGS[PowerupType.DOUBLER];
      const invisibilityConfig = POWERUP_CONFIGS[PowerupType.INVISIBILITY];

      expect(magnetConfig.visualConfig.color).toBe('#FF3333');
      expect(doublerConfig.visualConfig.color).toBe('#3333FF');
      expect(invisibilityConfig.visualConfig.color).toBe('#9933FF');

      expect(magnetConfig.visualConfig.particleCount).toBe(20);
      expect(doublerConfig.visualConfig.particleCount).toBe(15);
      expect(invisibilityConfig.visualConfig.particleCount).toBe(25);
    });

    it('should have correct audio configurations', () => {
      const configs = [
        POWERUP_CONFIGS[PowerupType.MAGNET],
        POWERUP_CONFIGS[PowerupType.DOUBLER],
        POWERUP_CONFIGS[PowerupType.INVISIBILITY]
      ];

      configs.forEach(config => {
        expect(config.audioConfig.collectionSound).toBe('powerupsound.wav');
        expect(config.audioConfig.activationSound).toBe('buttonclick2.wav');
      });
    });

    it('should maintain immutability of original config', () => {
      const originalConfig = POWERUP_CONFIGS[PowerupType.MAGNET];
      const component = createPowerupComponent(PowerupType.MAGNET, originalConfig);
      
      // Modify component config
      component.config.duration = 5000;
      
      // Original should remain unchanged
      expect(originalConfig.duration).toBe(10000);
    });
  });

  describe('PowerupType enum', () => {
    it('should have all required powerup types', () => {
      expect(PowerupType.MAGNET).toBe('magnet');
      expect(PowerupType.DOUBLER).toBe('doubler');
      expect(PowerupType.INVISIBILITY).toBe('invisibility');
    });
  });

  describe('PowerupState enum', () => {
    it('should have all required powerup states', () => {
      expect(PowerupState.SPAWNED).toBe('spawned');
      expect(PowerupState.COLLECTED).toBe('collected');
      expect(PowerupState.ACTIVE).toBe('active');
      expect(PowerupState.EXPIRED).toBe('expired');
    });
  });

  describe('POWERUP_CONFIGS', () => {
    it('should have configurations for all powerup types', () => {
      expect(POWERUP_CONFIGS[PowerupType.MAGNET]).toBeDefined();
      expect(POWERUP_CONFIGS[PowerupType.DOUBLER]).toBeDefined();
      expect(POWERUP_CONFIGS[PowerupType.INVISIBILITY]).toBeDefined();
    });

    it('should have consistent structure across all configs', () => {
      Object.values(POWERUP_CONFIGS).forEach(config => {
        expect(config).toHaveProperty('type');
        expect(config).toHaveProperty('duration');
        expect(config).toHaveProperty('effects');
        expect(config).toHaveProperty('visualConfig');
        expect(config).toHaveProperty('audioConfig');
        
        expect(Array.isArray(config.effects)).toBe(true);
        expect(config.duration).toBeGreaterThan(0);
        expect(config.visualConfig.color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should have faithful recreation durations (10 seconds)', () => {
      Object.values(POWERUP_CONFIGS).forEach(config => {
        expect(config.duration).toBe(10000); // 10 seconds in milliseconds
      });
    });
  });
});