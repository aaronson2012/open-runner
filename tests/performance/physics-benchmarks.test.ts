import { describe, it, expect, beforeEach, bench } from 'vitest';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { SpatialHashGrid } from '@/systems/physics/SpatialHashGrid';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import type { Entity } from '@/types';

describe('Physics Performance Benchmarks', () => {
  let physicsSystem: PhysicsSystem;
  let entities: Entity[];

  const createTestEntity = (id: number, x: number, y: number, z: number): Entity => {
    const entity: Entity = {
      id,
      active: true,
      components: new Map()
    };

    // Add transform component
    entity.components.set('transform', {
      type: 'transform',
      entityId: id,
      position: { x, y, z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });

    // Add physics component
    const physics = new PhysicsComponent(id, {
      mass: 1.0,
      friction: 0.5,
      restitution: 0.3
    });
    entity.components.set('physics', physics);

    return entity;
  };

  beforeEach(() => {
    physicsSystem = new PhysicsSystem({
      gravity: { x: 0, y: -9.81, z: 0 },
      timeStep: 1/60,
      maxSubSteps: 1,
      enableSleeping: true,
      spatialGridCellSize: 10.0
    });

    physicsSystem.init();
  });

  describe('Physics System Performance', () => {
    bench('100 entities physics update', () => {
      entities = [];
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100 - 50;
        const y = Math.random() * 10 + 5;
        const z = Math.random() * 100 - 50;
        entities.push(createTestEntity(i, x, y, z));
      }

      physicsSystem.update(1/60, entities);
    }, { iterations: 100 });

    bench('500 entities physics update', () => {
      entities = [];
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * 200 - 100;
        const y = Math.random() * 10 + 5;
        const z = Math.random() * 200 - 100;
        entities.push(createTestEntity(i, x, y, z));
      }

      physicsSystem.update(1/60, entities);
    }, { iterations: 50 });

    bench('1000 entities physics update', () => {
      entities = [];
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 300 - 150;
        const y = Math.random() * 10 + 5;
        const z = Math.random() * 300 - 150;
        entities.push(createTestEntity(i, x, y, z));
      }

      physicsSystem.update(1/60, entities);
    }, { iterations: 20 });

    bench('physics integration only (1000 entities)', () => {
      entities = [];
      for (let i = 0; i < 1000; i++) {
        entities.push(createTestEntity(i, 0, 0, 0));
      }

      // Only test physics integration, skip collision detection
      for (const entity of entities) {
        const physics = entity.components.get('physics') as PhysicsComponent;
        if (physics) {
          physics.integrate(1/60, { x: 0, y: -9.81, z: 0 });
        }
      }
    }, { iterations: 100 });
  });

  describe('Spatial Hash Grid Performance', () => {
    let spatialGrid: SpatialHashGrid;

    beforeEach(() => {
      spatialGrid = new SpatialHashGrid(10);
    });

    bench('add 1000 objects to spatial grid', () => {
      spatialGrid.clear();
      
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 200 - 100;
        const y = Math.random() * 200 - 100;
        const z = Math.random() * 200 - 100;
        
        const obj = {
          entityId: i,
          position: { x, y, z },
          bounds: {
            min: { x: x - 0.5, y: y - 0.5, z: z - 0.5 },
            max: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
          }
        };
        
        spatialGrid.add(obj);
      }
    }, { iterations: 50 });

    bench('query spatial grid (1000 objects)', () => {
      // Pre-populate grid
      spatialGrid.clear();
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 200 - 100;
        const y = Math.random() * 200 - 100;
        const z = Math.random() * 200 - 100;
        
        spatialGrid.add({
          entityId: i,
          position: { x, y, z },
          bounds: {
            min: { x: x - 0.5, y: y - 0.5, z: z - 0.5 },
            max: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
          }
        });
      }

      // Benchmark queries
      spatialGrid.queryRadius({ x: 0, y: 0, z: 0 }, 20);
    }, { iterations: 1000 });

    bench('update objects in spatial grid', () => {
      // Pre-populate grid
      spatialGrid.clear();
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * 100 - 50;
        const y = Math.random() * 100 - 50;
        const z = Math.random() * 100 - 50;
        
        spatialGrid.add({
          entityId: i,
          position: { x, y, z },
          bounds: {
            min: { x: x - 0.5, y: y - 0.5, z: z - 0.5 },
            max: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
          }
        });
      }

      // Benchmark updates
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * 100 - 50;
        const y = Math.random() * 100 - 50;
        const z = Math.random() * 100 - 50;
        
        spatialGrid.update(i, {
          min: { x: x - 0.5, y: y - 0.5, z: z - 0.5 },
          max: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
        });
      }
    }, { iterations: 100 });
  });

  describe('Collision Detection Performance', () => {
    bench('broad-phase collision detection (500 entities)', () => {
      entities = [];
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * 100 - 50;
        const y = Math.random() * 10 + 5;
        const z = Math.random() * 100 - 50;
        entities.push(createTestEntity(i, x, y, z));
      }

      // Only run broad-phase (spatial queries)
      const spatialGrid = new SpatialHashGrid(10);
      
      for (const entity of entities) {
        const transform = entity.components.get('transform')!;
        const aabb = {
          min: {
            x: transform.position.x - 0.5,
            y: transform.position.y - 0.5,
            z: transform.position.z - 0.5
          },
          max: {
            x: transform.position.x + 0.5,
            y: transform.position.y + 0.5,
            z: transform.position.z + 0.5
          }
        };
        
        spatialGrid.add({
          entityId: entity.id,
          position: transform.position,
          bounds: aabb
        });
      }
      
      // Query for each entity
      for (const entity of entities) {
        const transform = entity.components.get('transform')!;
        spatialGrid.queryRadius(transform.position, 5);
      }
    }, { iterations: 50 });

    bench('raycast performance (100 rays)', () => {
      entities = [];
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 100 - 50;
        const y = Math.random() * 10 + 5;
        const z = Math.random() * 100 - 50;
        entities.push(createTestEntity(i, x, y, z));
      }

      // Perform 100 raycasts
      for (let i = 0; i < 100; i++) {
        const origin = {
          x: Math.random() * 50 - 25,
          y: 10,
          z: Math.random() * 50 - 25
        };
        
        const direction = {
          x: Math.random() * 2 - 1,
          y: -1,
          z: Math.random() * 2 - 1
        };
        
        physicsSystem.raycast(origin, direction, 50);
      }
    }, { iterations: 20 });
  });

  describe('Memory Performance', () => {
    bench('entity creation and destruction', () => {
      const tempEntities: Entity[] = [];
      
      // Create entities
      for (let i = 0; i < 100; i++) {
        tempEntities.push(createTestEntity(i, 0, 0, 0));
      }
      
      // Simulate destruction by clearing components
      for (const entity of tempEntities) {
        entity.components.clear();
      }
      
      tempEntities.length = 0;
    }, { iterations: 100 });

    bench('physics component state updates', () => {
      const physics = new PhysicsComponent(1, { mass: 1.0 });
      
      // Simulate rapid state changes
      for (let i = 0; i < 1000; i++) {
        physics.addForce({ x: Math.random(), y: Math.random(), z: Math.random() });
        physics.integrate(1/60, { x: 0, y: -9.81, z: 0 });
        physics.clearCollisionState();
      }
    }, { iterations: 10 });
  });

  describe('Mobile Optimization Benchmarks', () => {
    bench('LOD distance calculations (1000 entities)', () => {
      const cameraPosition = { x: 0, y: 5, z: 0 };
      
      for (let i = 0; i < 1000; i++) {
        const entityPosition = {
          x: Math.random() * 200 - 100,
          y: Math.random() * 10,
          z: Math.random() * 200 - 100
        };
        
        // Distance calculation
        const dx = entityPosition.x - cameraPosition.x;
        const dy = entityPosition.y - cameraPosition.y;
        const dz = entityPosition.z - cameraPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // LOD level determination
        let lodLevel = 0;
        if (distance > 100) lodLevel = 4;
        else if (distance > 50) lodLevel = 3;
        else if (distance > 25) lodLevel = 2;
        else if (distance > 10) lodLevel = 1;
      }
    }, { iterations: 100 });

    bench('frustum culling (1000 entities)', () => {
      // Simplified frustum culling test
      const frustumBounds = {
        minX: -50, maxX: 50,
        minY: -10, maxY: 20,
        minZ: -50, maxZ: 50
      };
      
      let culledCount = 0;
      
      for (let i = 0; i < 1000; i++) {
        const position = {
          x: Math.random() * 200 - 100,
          y: Math.random() * 30 - 10,
          z: Math.random() * 200 - 100
        };
        
        // Simple frustum test
        if (position.x < frustumBounds.minX || position.x > frustumBounds.maxX ||
            position.y < frustumBounds.minY || position.y > frustumBounds.maxY ||
            position.z < frustumBounds.minZ || position.z > frustumBounds.maxZ) {
          culledCount++;
        }
      }
    }, { iterations: 100 });
  });

  describe('Real-world Scenarios', () => {
    bench('Open Runner simulation (100 entities, 60 FPS)', () => {
      // Simulate typical Open Runner scenario
      entities = [];
      
      // Player
      entities.push(createTestEntity(0, 0, 1, 0));
      
      // Obstacles
      for (let i = 1; i < 20; i++) {
        entities.push(createTestEntity(i, Math.random() * 100, 0.5, Math.random() * 20));
      }
      
      // Collectibles
      for (let i = 20; i < 50; i++) {
        entities.push(createTestEntity(i, Math.random() * 100, Math.random() * 3, Math.random() * 20));
      }
      
      // Enemies
      for (let i = 50; i < 70; i++) {
        entities.push(createTestEntity(i, Math.random() * 100, 1, Math.random() * 20));
      }
      
      // Environment objects
      for (let i = 70; i < 100; i++) {
        entities.push(createTestEntity(i, Math.random() * 200, 0, Math.random() * 40));
      }
      
      // Run physics update (target: <16ms for 60 FPS)
      physicsSystem.update(1/60, entities);
    }, { iterations: 60 }); // Simulate 1 second of gameplay
  });

  // Performance assertions
  describe('Performance Requirements', () => {
    it('should update 100 entities within 8ms', () => {
      entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push(createTestEntity(i, Math.random() * 100, 5, Math.random() * 100));
      }

      const startTime = performance.now();
      physicsSystem.update(1/60, entities);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(8); // 8ms target for mobile
    });

    it('should handle spatial queries within 1ms', () => {
      const spatialGrid = new SpatialHashGrid(10);
      
      // Add 500 objects
      for (let i = 0; i < 500; i++) {
        spatialGrid.add({
          entityId: i,
          position: { x: Math.random() * 100, y: 0, z: Math.random() * 100 },
          bounds: {
            min: { x: i - 0.5, y: -0.5, z: -0.5 },
            max: { x: i + 0.5, y: 0.5, z: 0.5 }
          }
        });
      }
      
      const startTime = performance.now();
      spatialGrid.queryRadius({ x: 50, y: 0, z: 50 }, 20);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1); // 1ms target for queries
    });
  });
});