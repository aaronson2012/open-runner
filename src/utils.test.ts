import { degreesToRadians, calculateDistance } from '../src/utils';

describe('Utils', () => {
  describe('degreesToRadians', () => {
    it('should convert 0 degrees to 0 radians', () => {
      expect(degreesToRadians(0)).toBe(0);
    });

    it('should convert 90 degrees to π/2 radians', () => {
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
    });

    it('should convert 180 degrees to π radians', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    });

    it('should convert 360 degrees to 2π radians', () => {
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two identical points as 0', () => {
      expect(calculateDistance(0, 0, 0, 0, 0, 0)).toBe(0);
    });

    it('should calculate distance between points on same axis', () => {
      expect(calculateDistance(0, 0, 0, 3, 0, 0)).toBe(3);
    });

    it('should calculate distance between arbitrary points', () => {
      // Distance between (0,0,0) and (1,1,1) should be √3
      expect(calculateDistance(0, 0, 0, 1, 1, 1)).toBeCloseTo(Math.sqrt(3));
    });
  });
});