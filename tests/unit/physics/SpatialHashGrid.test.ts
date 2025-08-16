import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHashGrid, type SpatialObject, type AABB } from '@/systems/physics/SpatialHashGrid';

describe('SpatialHashGrid', () => {
  let grid: SpatialHashGrid;
  const cellSize = 10;

  beforeEach(() => {
    grid = new SpatialHashGrid(cellSize);
  });

  describe('initialization', () => {
    it('should initialize with correct cell size', () => {
      expect(grid.getStats().totalObjects).toBe(0);
      expect(grid.getStats().totalCells).toBe(0);
    });

    it('should throw error for invalid cell size', () => {
      expect(() => new SpatialHashGrid(0)).toThrow();
      expect(() => new SpatialHashGrid(-1)).toThrow();
    });
  });

  describe('object management', () => {
    const createTestObject = (id: number, x: number, y: number, z: number): SpatialObject => ({
      entityId: id,
      position: { x, y, z },
      bounds: {
        min: { x: x - 0.5, y: y - 0.5, z: z - 0.5 },
        max: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
      }
    });

    it('should add objects correctly', () => {
      const obj = createTestObject(1, 5, 5, 5);
      grid.add(obj);

      const stats = grid.getStats();
      expect(stats.totalObjects).toBe(1);
      expect(stats.totalCells).toBe(1);
    });

    it('should remove objects correctly', () => {
      const obj = createTestObject(1, 5, 5, 5);
      grid.add(obj);
      
      const removed = grid.remove(1);
      expect(removed).toBe(true);
      
      const stats = grid.getStats();
      expect(stats.totalObjects).toBe(0);
    });

    it('should update object positions', () => {
      const obj = createTestObject(1, 5, 5, 5);
      grid.add(obj);

      // Move object to different cell
      const newBounds: AABB = {
        min: { x: 14.5, y: 4.5, z: 4.5 },
        max: { x: 15.5, y: 5.5, z: 5.5 }
      };

      const updated = grid.update(1, newBounds);
      expect(updated).toBe(true);
    });

    it('should handle objects spanning multiple cells', () => {
      const largeObj: SpatialObject = {
        entityId: 1,
        position: { x: 10, y: 10, z: 10 },
        bounds: {
          min: { x: 5, y: 5, z: 5 },
          max: { x: 15, y: 15, z: 15 }
        }
      };

      grid.add(largeObj);
      
      // Object should be in multiple cells
      const stats = grid.getStats();
      expect(stats.totalCells).toBeGreaterThan(1);
    });
  });

  describe('spatial queries', () => {
    beforeEach(() => {
      // Add test objects in a grid pattern
      for (let x = 0; x < 50; x += 10) {
        for (let z = 0; z < 50; z += 10) {
          const obj: SpatialObject = {
            entityId: x * 10 + z,
            position: { x, y: 0, z },
            bounds: {
              min: { x: x - 0.5, y: -0.5, z: z - 0.5 },
              max: { x: x + 0.5, y: 0.5, z: z + 0.5 }
            }
          };
          grid.add(obj);
        }
      }
    });

    it('should query radius correctly', () => {
      const center = { x: 25, y: 0, z: 25 };
      const result = grid.queryRadius(center, 15);
      
      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.cellsChecked).toBeGreaterThan(0);
      
      // All returned objects should be within radius
      for (const obj of result.objects) {
        const dx = obj.position.x - center.x;
        const dy = obj.position.y - center.y;
        const dz = obj.position.z - center.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        expect(distance).toBeLessThanOrEqual(15);
      }
    });

    it('should query AABB correctly', () => {
      const queryAABB: AABB = {
        min: { x: 15, y: -1, z: 15 },
        max: { x: 35, y: 1, z: 35 }
      };
      
      const result = grid.queryAABB(queryAABB);
      expect(result.objects.length).toBeGreaterThan(0);
      
      // All returned objects should intersect with query AABB
      for (const obj of result.objects) {
        const intersects = (
          obj.bounds.min.x <= queryAABB.max.x && obj.bounds.max.x >= queryAABB.min.x &&
          obj.bounds.min.y <= queryAABB.max.y && obj.bounds.max.y >= queryAABB.min.y &&
          obj.bounds.min.z <= queryAABB.max.z && obj.bounds.max.z >= queryAABB.min.z
        );
        expect(intersects).toBe(true);
      }
    });

    it('should query ray correctly', () => {
      const origin = { x: 0, y: 0, z: 0 };
      const direction = { x: 1, y: 0, z: 1 }; // Diagonal ray
      const maxDistance = 50;
      
      const result = grid.queryRay(origin, direction, maxDistance);
      expect(result.objects.length).toBeGreaterThan(0);
    });

    it('should return empty results for queries in empty areas', () => {
      const center = { x: 100, y: 0, z: 100 }; // Far from any objects
      const result = grid.queryRadius(center, 5);
      
      expect(result.objects.length).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle large numbers of objects efficiently', () => {
      const startTime = performance.now();
      
      // Add 1000 objects
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const z = Math.random() * 100;
        
        const obj: SpatialObject = {
          entityId: i,
          position: { x, y, z },
          bounds: {
            min: { x: x - 0.5, y: y - 0.5, z: z - 0.5 },
            max: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
          }
        };
        
        grid.add(obj);
      }
      
      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(100); // Should be fast
      
      // Test query performance
      const queryStart = performance.now();
      grid.queryRadius({ x: 50, y: 50, z: 50 }, 10);
      const queryTime = performance.now() - queryStart;
      
      expect(queryTime).toBeLessThan(10); // Should be very fast
    });

    it('should optimize automatically', () => {
      // Add objects with varying sizes
      for (let i = 0; i < 100; i++) {
        const size = Math.random() * 5 + 0.5;
        const obj: SpatialObject = {
          entityId: i,
          position: { x: i, y: 0, z: 0 },
          bounds: {
            min: { x: i - size, y: -size, z: -size },
            max: { x: i + size, y: size, z: size }
          }
        };
        grid.add(obj);
      }
      
      const statsBefore = grid.getStats();
      grid.optimize();
      const statsAfter = grid.getStats();
      
      // Optimization should maintain object count
      expect(statsAfter.totalObjects).toBe(statsBefore.totalObjects);
    });
  });

  describe('statistics and debugging', () => {
    it('should provide accurate statistics', () => {
      // Add some objects
      for (let i = 0; i < 10; i++) {
        const obj: SpatialObject = {
          entityId: i,
          position: { x: i * 5, y: 0, z: 0 },
          bounds: {
            min: { x: i * 5 - 0.5, y: -0.5, z: -0.5 },
            max: { x: i * 5 + 0.5, y: 0.5, z: 0.5 }
          }
        };
        grid.add(obj);
      }
      
      const stats = grid.getStats();
      expect(stats.totalObjects).toBe(10);
      expect(stats.totalCells).toBeGreaterThan(0);
      expect(stats.avgObjectsPerCell).toBeGreaterThan(0);
    });

    it('should provide debug information', () => {
      const obj: SpatialObject = {
        entityId: 1,
        position: { x: 5, y: 5, z: 5 },
        bounds: {
          min: { x: 4.5, y: 4.5, z: 4.5 },
          max: { x: 5.5, y: 5.5, z: 5.5 }
        }
      };
      grid.add(obj);
      
      const debug = grid.getDebugInfo();
      expect(debug.cellSize).toBe(cellSize);
      expect(debug.totalObjects).toBe(1);
      expect(debug.memoryUsage.gridSize).toBeGreaterThan(0);
    });

    it('should reset frame statistics', () => {
      // Perform some operations
      const obj: SpatialObject = {
        entityId: 1,
        position: { x: 5, y: 5, z: 5 },
        bounds: {
          min: { x: 4.5, y: 4.5, z: 4.5 },
          max: { x: 5.5, y: 5.5, z: 5.5 }
        }
      };
      grid.add(obj);
      grid.queryRadius({ x: 5, y: 5, z: 5 }, 10);
      
      let stats = grid.getStats();
      expect(stats.queriesThisFrame).toBeGreaterThan(0);
      expect(stats.updatesThisFrame).toBeGreaterThan(0);
      
      grid.resetFrameStats();
      stats = grid.getStats();
      expect(stats.queriesThisFrame).toBe(0);
      expect(stats.updatesThisFrame).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle objects at origin', () => {
      const obj: SpatialObject = {
        entityId: 1,
        position: { x: 0, y: 0, z: 0 },
        bounds: {
          min: { x: -0.5, y: -0.5, z: -0.5 },
          max: { x: 0.5, y: 0.5, z: 0.5 }
        }
      };
      
      grid.add(obj);
      const result = grid.queryRadius({ x: 0, y: 0, z: 0 }, 1);
      expect(result.objects).toContain(obj);
    });

    it('should handle negative coordinates', () => {
      const obj: SpatialObject = {
        entityId: 1,
        position: { x: -15, y: -15, z: -15 },
        bounds: {
          min: { x: -15.5, y: -15.5, z: -15.5 },
          max: { x: -14.5, y: -14.5, z: -14.5 }
        }
      };
      
      grid.add(obj);
      const result = grid.queryRadius({ x: -15, y: -15, z: -15 }, 1);
      expect(result.objects).toContain(obj);
    });

    it('should clear all objects', () => {
      // Add multiple objects
      for (let i = 0; i < 5; i++) {
        const obj: SpatialObject = {
          entityId: i,
          position: { x: i, y: 0, z: 0 },
          bounds: {
            min: { x: i - 0.5, y: -0.5, z: -0.5 },
            max: { x: i + 0.5, y: 0.5, z: 0.5 }
          }
        };
        grid.add(obj);
      }
      
      grid.clear();
      
      const stats = grid.getStats();
      expect(stats.totalObjects).toBe(0);
      expect(stats.totalCells).toBe(0);
    });
  });
});