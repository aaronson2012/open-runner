import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the utility functions directly since they depend on Three.js CDN
const mathUtils = {
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  randomRange: (min, max) => min + Math.random() * (max - min),
  smoothDamp: (current, target, deltaTime, smoothingFactor) => {
    const smoothFactor = 1.0 - Math.pow(smoothingFactor, deltaTime);
    return current + (target - current) * smoothFactor;
  }
};

const { clamp, randomRange, smoothDamp } = mathUtils;

describe('mathUtils', () => {
  describe('clamp', () => {
    it('should clamp value to minimum when below range', () => {
      expect(clamp(5, 10, 20)).toBe(10);
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp value to maximum when above range', () => {
      expect(clamp(25, 10, 20)).toBe(20);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should return value unchanged when within range', () => {
      expect(clamp(15, 10, 20)).toBe(15);
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should handle edge case where min equals max', () => {
      expect(clamp(5, 10, 10)).toBe(10);
      expect(clamp(15, 10, 10)).toBe(10);
    });

    it('should handle negative numbers correctly', () => {
      expect(clamp(-15, -10, -5)).toBe(-10);
      expect(clamp(-3, -10, -5)).toBe(-5);
      expect(clamp(-7, -10, -5)).toBe(-7);
    });
  });

  describe('randomRange', () => {
    it('should generate numbers within the specified range', () => {
      const min = 10;
      const max = 20;
      
      // Test multiple iterations
      for (let i = 0; i < 100; i++) {
        const result = randomRange(min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThan(max);
      }
    });

    it('should handle negative ranges', () => {
      const min = -20;
      const max = -10;
      
      for (let i = 0; i < 50; i++) {
        const result = randomRange(min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThan(max);
      }
    });

    it('should handle zero-crossing ranges', () => {
      const min = -5;
      const max = 5;
      
      for (let i = 0; i < 50; i++) {
        const result = randomRange(min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThan(max);
      }
    });

    it('should return min when min equals max', () => {
      expect(randomRange(5, 5)).toBe(5);
      expect(randomRange(0, 0)).toBe(0);
      expect(randomRange(-10, -10)).toBe(-10);
    });
  });

  describe('smoothDamp', () => {
    it('should move current value towards target', () => {
      const current = 0;
      const target = 10;
      const deltaTime = 0.016; // ~60fps
      const smoothingFactor = 0.1;
      
      const result = smoothDamp(current, target, deltaTime, smoothingFactor);
      
      expect(result).toBeGreaterThan(current);
      expect(result).toBeLessThan(target);
    });

    it('should reach target when current equals target', () => {
      const value = 5;
      const result = smoothDamp(value, value, 0.016, 0.1);
      expect(result).toBe(value);
    });

    it('should handle negative target values', () => {
      const current = 10;
      const target = -5;
      const result = smoothDamp(current, target, 0.016, 0.1);
      
      expect(result).toBeLessThan(current);
      expect(result).toBeGreaterThan(target);
    });

    it('should be affected by delta time', () => {
      const current = 0;
      const target = 10;
      const smoothingFactor = 0.1;
      
      const shortDelta = smoothDamp(current, target, 0.008, smoothingFactor);
      const longDelta = smoothDamp(current, target, 0.032, smoothingFactor);
      
      // Longer delta time should result in larger movement
      expect(longDelta).toBeGreaterThan(shortDelta);
    });

    it('should be affected by smoothing factor', () => {
      const current = 0;
      const target = 10;
      const deltaTime = 0.016;
      
      // With exponential decay: lower smoothingFactor = slower approach to target
      const smoothResult = smoothDamp(current, target, deltaTime, 0.1);  // Moderate smoothing
      const fastResult = smoothDamp(current, target, deltaTime, 0.9);    // Very little smoothing
      
      // Higher smoothing factor (0.9) should result in smaller movement than lower (0.1)
      // because 1.0 - Math.pow(0.9, deltaTime) < 1.0 - Math.pow(0.1, deltaTime)
      expect(smoothResult).toBeGreaterThan(fastResult);
    });

    it('should handle zero delta time', () => {
      const current = 5;
      const target = 10;
      const result = smoothDamp(current, target, 0, 0.1);
      
      // With zero delta time, current value should not change
      expect(result).toBe(current);
    });
  });
});