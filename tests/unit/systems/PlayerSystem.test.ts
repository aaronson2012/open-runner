import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerSystem } from '@/systems/PlayerSystem';
import { PlayerComponent } from '@/components/PlayerComponent';
import { World } from '@/core/ecs/World';
import type { Entity } from '@/types';

describe('PlayerSystem', () => {
  let playerSystem: PlayerSystem;
  let world: World;
  let playerEntity: Entity;
  let playerComponent: PlayerComponent;

  beforeEach(() => {
    world = new World({ enableProfiling: true });
    playerSystem = new PlayerSystem();
    world.addSystem(playerSystem);

    // Create player entity
    const entityId = world.createEntity();
    playerComponent = new PlayerComponent(entityId);
    
    const transform = {
      type: 'transform' as const,
      entityId,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };

    world.addComponent(entityId, playerComponent);
    world.addComponent(entityId, transform);
    
    playerEntity = world.getEntity(entityId)!;
  });

  describe('Movement Physics', () => {
    beforeEach(() => {
      world.start();
    });

    it('should accelerate player speed over time', () => {
      const initialSpeed = playerComponent.currentSpeed;
      
      // Simulate acceleration over multiple frames
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      expect(playerComponent.currentSpeed).toBeGreaterThan(initialSpeed);
    });

    it('should cap speed at maximum value', () => {
      playerComponent.currentSpeed = playerComponent.maxSpeed - 1;
      
      // Accelerate beyond max speed
      for (let i = 0; i < 20; i++) {
        world.update(0.016);
      }
      
      expect(playerComponent.currentSpeed).toBeLessThanOrEqual(playerComponent.maxSpeed);
    });

    it('should decelerate when above base speed', () => {
      playerComponent.currentSpeed = playerComponent.maxSpeed;
      
      // Stop accelerating and let deceleration take effect
      playerComponent.decelerate(0.016);
      
      expect(playerComponent.currentSpeed).toBeLessThan(playerComponent.maxSpeed);
    });

    it('should not decelerate below base speed', () => {
      playerComponent.currentSpeed = playerComponent.speed + 1;
      
      // Decelerate to base speed
      for (let i = 0; i < 20; i++) {
        playerComponent.decelerate(0.016);
      }
      
      expect(playerComponent.currentSpeed).toBeGreaterThanOrEqual(playerComponent.speed);
    });

    it('should apply steering input correctly', () => {
      const steeringInput = 0.5;
      playerComponent.applySteering(steeringInput, 0.016);
      
      expect(playerComponent.steering).toBeGreaterThan(0);
      expect(playerComponent.steering).toBeLessThanOrEqual(1);
    });

    it('should smooth steering transitions', () => {
      // Apply gradual steering
      playerComponent.applySteering(1.0, 0.016);
      const firstFrame = playerComponent.steering;
      
      playerComponent.applySteering(1.0, 0.016);
      const secondFrame = playerComponent.steering;
      
      expect(secondFrame).toBeGreaterThan(firstFrame);
    });

    it('should calculate banking angle based on steering', () => {
      playerComponent.applySteering(1.0, 0.016);
      
      expect(playerComponent.bankAngle).toBeGreaterThan(0);
      expect(Math.abs(playerComponent.bankAngle)).toBeLessThanOrEqual(0.3);
    });
  });

  describe('Jump and Gravity System', () => {
    beforeEach(() => {
      world.start();
    });

    it('should allow jumping when grounded', () => {
      playerComponent.isGrounded = true;
      const jumpResult = playerComponent.jump();
      
      expect(jumpResult).toBe(true);
      expect(playerComponent.verticalVelocity).toBeGreaterThan(0);
      expect(playerComponent.isGrounded).toBe(false);
    });

    it('should prevent jumping when not grounded', () => {
      playerComponent.isGrounded = false;
      const jumpResult = playerComponent.jump();
      
      expect(jumpResult).toBe(false);
    });

    it('should apply gravity when airborne', () => {
      playerComponent.isGrounded = false;
      playerComponent.verticalVelocity = 5;
      
      playerComponent.applyGravity(0.016);
      
      expect(playerComponent.verticalVelocity).toBeLessThan(5);
    });

    it('should not apply gravity when grounded', () => {
      playerComponent.isGrounded = true;
      playerComponent.verticalVelocity = 0;
      
      playerComponent.applyGravity(0.016);
      
      expect(playerComponent.verticalVelocity).toBe(0);
    });

    it('should cap fall speed at maximum', () => {
      playerComponent.isGrounded = false;
      playerComponent.verticalVelocity = -100; // Very high fall speed
      
      playerComponent.applyGravity(0.016);
      
      expect(playerComponent.verticalVelocity).toBeGreaterThanOrEqual(playerComponent.maxFallSpeed);
    });

    it('should handle landing correctly', () => {
      playerComponent.isGrounded = false;
      playerComponent.verticalVelocity = -10;
      
      playerComponent.land(0);
      
      expect(playerComponent.isGrounded).toBe(true);
      expect(playerComponent.verticalVelocity).toBe(0);
      expect(playerComponent.groundDistance).toBe(0);
    });
  });

  describe('Animation System', () => {
    beforeEach(() => {
      world.start();
    });

    it('should update animation speed based on movement', () => {
      playerComponent.currentSpeed = playerComponent.maxSpeed * 0.5;
      
      playerComponent.updateAnimation(0.016);
      
      expect(playerComponent.animationSpeed).toBeGreaterThan(0.5);
      expect(playerComponent.animationSpeed).toBeLessThan(2.0);
    });

    it('should cycle limb offset for running animation', () => {
      const initialOffset = playerComponent.limbOffset;
      
      playerComponent.updateAnimation(0.016);
      
      expect(playerComponent.limbOffset).toBeGreaterThan(initialOffset);
    });

    it('should wrap limb offset at 2π', () => {
      playerComponent.limbOffset = Math.PI * 2 - 0.1;
      
      playerComponent.updateAnimation(0.5); // Large delta to force wrap
      
      expect(playerComponent.limbOffset).toBeLessThan(Math.PI * 2);
    });

    it('should scale animation speed with movement speed', () => {
      playerComponent.currentSpeed = playerComponent.maxSpeed;
      playerComponent.updateAnimation(0.016);
      const fastAnimSpeed = playerComponent.animationSpeed;
      
      playerComponent.currentSpeed = playerComponent.speed;
      playerComponent.updateAnimation(0.016);
      const slowAnimSpeed = playerComponent.animationSpeed;
      
      expect(fastAnimSpeed).toBeGreaterThan(slowAnimSpeed);
    });
  });

  describe('Slope Detection and Handling', () => {
    it('should detect climbable slopes', () => {
      const climbableAngle = 30; // degrees
      
      playerComponent.updateSlopeDetection(climbableAngle);
      
      expect(playerComponent.canClimbSlope).toBe(true);
      expect(playerComponent.isSliding).toBe(false);
    });

    it('should detect unclimbable slopes', () => {
      const steepAngle = 60; // degrees
      playerComponent.isGrounded = true;
      
      playerComponent.updateSlopeDetection(steepAngle);
      
      expect(playerComponent.canClimbSlope).toBe(false);
      expect(playerComponent.isSliding).toBe(true);
    });

    it('should not slide when not grounded', () => {
      const steepAngle = 60;
      playerComponent.isGrounded = false;
      
      playerComponent.updateSlopeDetection(steepAngle);
      
      expect(playerComponent.isSliding).toBe(false);
    });

    it('should use configurable maximum climb angle', () => {
      const customMaxAngle = 30;
      const testAngle = 35;
      
      playerComponent.updateSlopeDetection(testAngle, customMaxAngle);
      
      expect(playerComponent.canClimbSlope).toBe(false);
    });
  });

  describe('Power-up System', () => {
    it('should add speed boost power-up', () => {
      const originalMaxSpeed = playerComponent.maxSpeed;
      
      playerComponent.addPowerUp('speed_boost');
      
      expect(playerComponent.powerUps).toContain('speed_boost');
      expect(playerComponent.maxSpeed).toBe(originalMaxSpeed * 1.5);
    });

    it('should add high jump power-up', () => {
      const originalJumpForce = playerComponent.jumpForce;
      
      playerComponent.addPowerUp('high_jump');
      
      expect(playerComponent.powerUps).toContain('high_jump');
      expect(playerComponent.jumpForce).toBe(originalJumpForce * 1.3);
    });

    it('should add shield power-up without affecting physics', () => {
      playerComponent.addPowerUp('shield');
      
      expect(playerComponent.powerUps).toContain('shield');
    });

    it('should remove power-ups and restore defaults', () => {
      playerComponent.addPowerUp('speed_boost');
      playerComponent.removePowerUp('speed_boost');
      
      expect(playerComponent.powerUps).not.toContain('speed_boost');
      expect(playerComponent.maxSpeed).toBe(25.0); // Default value
    });

    it('should auto-remove timed power-ups', (done) => {
      playerComponent.addPowerUp('speed_boost', 100); // 100ms duration
      
      setTimeout(() => {
        expect(playerComponent.powerUps).not.toContain('speed_boost');
        done();
      }, 150);
    });

    it('should handle multiple power-ups', () => {
      playerComponent.addPowerUp('speed_boost');
      playerComponent.addPowerUp('high_jump');
      playerComponent.addPowerUp('shield');
      
      expect(playerComponent.powerUps).toHaveLength(3);
      expect(playerComponent.hasActivePowerUps()).toBe(true);
    });
  });

  describe('Health and Damage System', () => {
    it('should take damage correctly', () => {
      const initialHealth = playerComponent.health;
      const damage = 25;
      
      const died = playerComponent.takeDamage(damage);
      
      expect(playerComponent.health).toBe(initialHealth - damage);
      expect(died).toBe(false);
    });

    it('should return true when health reaches zero', () => {
      const died = playerComponent.takeDamage(100);
      
      expect(playerComponent.health).toBe(0);
      expect(died).toBe(true);
    });

    it('should not allow negative health', () => {
      playerComponent.takeDamage(150); // More than max health
      
      expect(playerComponent.health).toBe(0);
    });

    it('should heal correctly', () => {
      playerComponent.takeDamage(50);
      playerComponent.heal(25);
      
      expect(playerComponent.health).toBe(75);
    });

    it('should cap healing at maximum health', () => {
      playerComponent.heal(50); // More than needed to reach 100
      
      expect(playerComponent.health).toBe(100);
    });
  });

  describe('Score System', () => {
    it('should add score points', () => {
      const initialScore = playerComponent.score;
      const points = 100;
      
      playerComponent.addScore(points);
      
      expect(playerComponent.score).toBe(initialScore + points);
    });

    it('should accumulate score over multiple additions', () => {
      playerComponent.addScore(50);
      playerComponent.addScore(75);
      playerComponent.addScore(25);
      
      expect(playerComponent.score).toBe(150);
    });
  });

  describe('Mobile Optimization', () => {
    it('should detect mobile devices and set appropriate sensitivity', () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      
      const mobilePlayer = new PlayerComponent(999);
      
      expect(mobilePlayer.inputSensitivity).toBe(1.2); // Higher for mobile
    });

    it('should detect tablet devices and set standard sensitivity', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        writable: true
      });
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      
      const tabletPlayer = new PlayerComponent(999);
      
      expect(tabletPlayer.inputSensitivity).toBe(1.0); // Standard for tablet
    });

    it('should enable battery optimization on mobile', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Android 10; Mobile; rv:81.0)',
        writable: true
      });
      
      const mobilePlayer = new PlayerComponent(999);
      
      expect(mobilePlayer.batteryOptimized).toBe(true);
    });

    it('should adjust input sensitivity', () => {
      const newSensitivity = 1.5;
      
      playerComponent.adjustInputSensitivity(newSensitivity);
      
      expect(playerComponent.inputSensitivity).toBe(newSensitivity);
    });

    it('should clamp input sensitivity to valid range', () => {
      playerComponent.adjustInputSensitivity(3.0); // Too high
      expect(playerComponent.inputSensitivity).toBe(2.0);
      
      playerComponent.adjustInputSensitivity(0.05); // Too low
      expect(playerComponent.inputSensitivity).toBe(0.1);
    });

    it('should enable battery optimization mode', () => {
      playerComponent.enableBatteryOptimization();
      
      expect(playerComponent.batteryOptimized).toBe(true);
      
      const metrics = playerComponent.getPerformanceMetrics();
      expect(metrics.updateFrequency).toBe(30); // Reduced from 60fps
    });

    it('should disable battery optimization mode', () => {
      playerComponent.enableBatteryOptimization();
      playerComponent.disableBatteryOptimization();
      
      expect(playerComponent.batteryOptimized).toBe(false);
      
      const metrics = playerComponent.getPerformanceMetrics();
      expect(metrics.updateFrequency).toBe(60);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      const frameTime = 20; // ms
      
      playerComponent.updatePerformanceMetrics(frameTime);
      
      const metrics = playerComponent.getPerformanceMetrics();
      expect(metrics.averageFrameTime).toBeGreaterThan(0);
    });

    it('should adapt quality based on performance', () => {
      playerComponent.adaptiveQuality = true;
      
      // Simulate poor performance
      for (let i = 0; i < 100; i++) {
        playerComponent.updatePerformanceMetrics(30); // 30ms frames (poor)
      }
      
      const metrics = playerComponent.getPerformanceMetrics();
      expect(metrics.adaptiveQualityLevel).toBeLessThan(1.0);
    });

    it('should increase quality when performance is good', () => {
      playerComponent.adaptiveQuality = true;
      
      // Start with reduced quality
      const metrics = playerComponent.getPerformanceMetrics();
      metrics.adaptiveQualityLevel = 0.8;
      
      // Simulate good performance
      for (let i = 0; i < 100; i++) {
        playerComponent.updatePerformanceMetrics(12); // 12ms frames (good)
      }
      
      const newMetrics = playerComponent.getPerformanceMetrics();
      expect(newMetrics.adaptiveQualityLevel).toBeGreaterThan(0.8);
    });
  });

  describe('State Queries', () => {
    it('should detect movement state', () => {
      playerComponent.currentSpeed = 0;
      expect(playerComponent.isMoving()).toBe(false);
      
      playerComponent.currentSpeed = 5;
      expect(playerComponent.isMoving()).toBe(true);
    });

    it('should detect turning state', () => {
      playerComponent.steering = 0;
      expect(playerComponent.isTurning()).toBe(false);
      
      playerComponent.steering = 0.5;
      expect(playerComponent.isTurning()).toBe(true);
    });

    it('should detect active power-ups', () => {
      expect(playerComponent.hasActivePowerUps()).toBe(false);
      
      playerComponent.addPowerUp('speed_boost');
      expect(playerComponent.hasActivePowerUps()).toBe(true);
    });

    it('should calculate speed ratio', () => {
      playerComponent.currentSpeed = playerComponent.maxSpeed * 0.6;
      
      expect(playerComponent.getSpeedRatio()).toBeCloseTo(0.6, 2);
    });
  });

  describe('Serialization', () => {
    it('should serialize player state', () => {
      playerComponent.currentSpeed = 15;
      playerComponent.health = 80;
      playerComponent.score = 5000;
      playerComponent.addPowerUp('speed_boost');
      
      const serialized = playerComponent.serialize();
      
      expect(serialized).toEqual(expect.objectContaining({
        currentSpeed: 15,
        health: 80,
        score: 5000,
        powerUps: ['speed_boost']
      }));
    });

    it('should deserialize player state', () => {
      const data = {
        currentSpeed: 20,
        health: 60,
        score: 8000,
        powerUps: ['high_jump', 'shield'],
        inputSensitivity: 1.3
      };
      
      playerComponent.deserialize(data);
      
      expect(playerComponent.currentSpeed).toBe(20);
      expect(playerComponent.health).toBe(60);
      expect(playerComponent.score).toBe(8000);
      expect(playerComponent.powerUps).toEqual(['high_jump', 'shield']);
      expect(playerComponent.inputSensitivity).toBe(1.3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero delta time gracefully', () => {
      expect(() => {
        playerComponent.accelerate(0);
        playerComponent.applySteering(0.5, 0);
        playerComponent.applyGravity(0);
        playerComponent.updateAnimation(0);
      }).not.toThrow();
    });

    it('should handle negative delta time', () => {
      expect(() => {
        playerComponent.accelerate(-0.016);
        playerComponent.applyGravity(-0.016);
      }).not.toThrow();
    });

    it('should handle invalid power-up types', () => {
      playerComponent.addPowerUp('invalid_powerup');
      
      expect(playerComponent.powerUps).toContain('invalid_powerup');
      // Should not affect player stats
    });

    it('should handle removing non-existent power-ups', () => {
      expect(() => {
        playerComponent.removePowerUp('non_existent');
      }).not.toThrow();
    });

    it('should handle extreme input values', () => {
      expect(() => {
        playerComponent.applySteering(1000, 0.016); // Extreme steering
        playerComponent.takeDamage(1000000); // Extreme damage
        playerComponent.addScore(-1000); // Negative score
      }).not.toThrow();
      
      expect(playerComponent.steering).toBeLessThanOrEqual(1);
      expect(playerComponent.health).toBeGreaterThanOrEqual(0);
    });
  });
});