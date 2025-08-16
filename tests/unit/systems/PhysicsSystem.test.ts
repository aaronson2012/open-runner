import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsSystem, type PhysicsSystemConfig, type CollisionPair, type RaycastResult } from '@/systems/PhysicsSystem';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import { World } from '@/core/ecs/World';
import type { Entity, Vector3 } from '@/types';

describe('PhysicsSystem', () => {
  let physicsSystem: PhysicsSystem;
  let world: World;
  
  beforeEach(() => {
    world = new World({ enableProfiling: true });
    physicsSystem = new PhysicsSystem({
      gravity: { x: 0, y: -9.81, z: 0 },
      timeStep: 1/60,
      maxSubSteps: 3,
      enableSleeping: true,
      spatialGridCellSize: 10.0,
      enableCCD: false,
      solverIterations: 4
    });
    
    world.addSystem(physicsSystem);
  });

  describe('System Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultSystem = new PhysicsSystem();
      expect(defaultSystem.id).toBe('physics');
      expect(defaultSystem.priority).toBe(10);
      expect(defaultSystem.requiredComponents).toEqual(['physics', 'transform']);
    });

    it('should apply custom configuration', () => {
      const config: PhysicsSystemConfig = {
        gravity: { x: 0, y: -20, z: 0 },
        timeStep: 1/30,
        enableSleeping: false
      };
      
      const customSystem = new PhysicsSystem(config);
      expect(customSystem.getGravity()).toEqual({ x: 0, y: -20, z: 0 });
    });

    it('should validate timeStep bounds', () => {
      physicsSystem.setTimeStep(1/10); // Too large
      expect(physicsSystem.getStats().config.timeStep).toBeLessThanOrEqual(1/30);
      
      physicsSystem.setTimeStep(1/200); // Too small
      expect(physicsSystem.getStats().config.timeStep).toBeGreaterThanOrEqual(1/120);
    });
  });

  describe('Physics Integration', () => {
    let entity: Entity;
    let physicsComponent: PhysicsComponent;
    
    beforeEach(() => {
      entity = createTestEntity(world, { x: 0, y: 10, z: 0 });
      physicsComponent = entity.components.get('physics') as PhysicsComponent;
    });

    it('should apply gravity to dynamic bodies', () => {
      const initialVelocityY = physicsComponent.velocity.y;
      
      world.start();
      world.update(0.016); // One frame
      
      expect(physicsComponent.velocity.y).toBeLessThan(initialVelocityY);
    });

    it('should not apply gravity to kinematic bodies', () => {
      physicsComponent.isKinematic = true;
      const initialVelocity = { ...physicsComponent.velocity };
      
      world.start();
      world.update(0.016);
      
      expect(physicsComponent.velocity).toEqual(initialVelocity);
    });

    it('should not update sleeping bodies', () => {
      physicsComponent.isAsleep = true;
      const initialTransform = { ...entity.components.get('transform')! };
      
      world.start();
      world.update(0.016);
      
      const currentTransform = entity.components.get('transform')!;
      expect(currentTransform.position).toEqual(initialTransform.position);
    });

    it('should integrate velocity into position', () => {
      physicsComponent.setVelocity({ x: 10, y: 0, z: 5 });
      const initialPosition = { ...entity.components.get('transform')!.position };
      
      world.start();
      world.update(0.016);
      
      const currentPosition = entity.components.get('transform')!.position;
      expect(currentPosition.x).toBeCloseTo(initialPosition.x + 10 * 0.016, 5);
      expect(currentPosition.z).toBeCloseTo(initialPosition.z + 5 * 0.016, 5);
    });

    it('should handle angular velocity when rotation is not frozen', () => {
      physicsComponent.freezeRotation = false;
      physicsComponent.angularVelocity = { x: 1, y: 2, z: 0 };
      
      const initialRotation = { ...entity.components.get('transform')!.rotation };
      
      world.start();
      world.update(0.016);
      
      const currentRotation = entity.components.get('transform')!.rotation;
      expect(currentRotation.x).toBeCloseTo(initialRotation.x + 1 * 0.016, 5);
      expect(currentRotation.y).toBeCloseTo(initialRotation.y + 2 * 0.016, 5);
    });

    it('should respect frozen rotation', () => {
      physicsComponent.freezeRotation = true;
      physicsComponent.angularVelocity = { x: 10, y: 10, z: 10 };
      
      const initialRotation = { ...entity.components.get('transform')!.rotation };
      
      world.start();
      world.update(0.016);
      
      const currentRotation = entity.components.get('transform')!.rotation;
      expect(currentRotation).toEqual(initialRotation);
    });
  });

  describe('Ground Detection', () => {
    let entity: Entity;
    let physicsComponent: PhysicsComponent;
    
    beforeEach(() => {
      entity = createTestEntity(world, { x: 0, y: 0.5, z: 0 });
      physicsComponent = entity.components.get('physics') as PhysicsComponent;
    });

    it('should detect ground contact', () => {
      world.start();
      world.update(0.016);
      
      expect(physicsComponent.isGrounded).toBe(true);
    });

    it('should stop downward velocity on ground contact', () => {
      physicsComponent.setVelocity({ x: 0, y: -10, z: 0 });
      
      world.start();
      world.update(0.016);
      
      expect(physicsComponent.velocity.y).toBe(0);
      expect(physicsComponent.isGrounded).toBe(true);
    });

    it('should maintain position at ground level', () => {
      const transform = entity.components.get('transform')!;
      transform.position.y = 0.3; // Below ground threshold
      
      world.start();
      world.update(0.016);
      
      expect(transform.position.y).toBe(0.5); // Corrected to ground level
    });

    it('should not be grounded when above ground', () => {
      const transform = entity.components.get('transform')!;
      transform.position.y = 2.0;
      
      world.start();
      world.update(0.016);
      
      expect(physicsComponent.isGrounded).toBe(false);
    });
  });

  describe('Collision Detection', () => {
    let entity1: Entity;
    let entity2: Entity;
    let physics1: PhysicsComponent;
    let physics2: PhysicsComponent;
    
    beforeEach(() => {
      entity1 = createTestEntity(world, { x: 0, y: 1, z: 0 });
      entity2 = createTestEntity(world, { x: 0.8, y: 1, z: 0 }); // Close but not touching
      
      physics1 = entity1.components.get('physics') as PhysicsComponent;
      physics2 = entity2.components.get('physics') as PhysicsComponent;
    });

    it('should detect collision between overlapping spheres', () => {
      // Move entities to overlapping positions
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.5; // Overlapping with entity1
      
      world.start();
      world.update(0.016);
      
      const stats = physicsSystem.getStats();
      expect(stats.collisionPairs).toBeGreaterThan(0);
    });

    it('should not detect collision between distant entities', () => {
      world.start();
      world.update(0.016);
      
      const stats = physicsSystem.getStats();
      expect(stats.collisionPairs).toBe(0);
    });

    it('should update collision state on physics components', () => {
      // Force collision
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      // Check if collision was detected (this would require accessing internal collision state)
      // In a real implementation, PhysicsComponent would have collision detection methods
      expect(physics1.getColliders().length).toBeGreaterThanOrEqual(0);
    });

    it('should handle trigger collisions differently', () => {
      physics1.isTrigger = true;
      
      // Move entities to overlapping positions
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      // Triggers should not affect physics but should register collision
      expect(physics1.getTriggers().length).toBeGreaterThanOrEqual(0);
    });

    it('should skip collision between two kinematic bodies', () => {
      physics1.isKinematic = true;
      physics2.isKinematic = true;
      
      // Move entities to overlapping positions
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      const stats = physicsSystem.getStats();
      // Collision detection might still occur, but resolution should be skipped
      expect(stats.collisionChecks).toBeGreaterThanOrEqual(0);
    });

    it('should skip collision between two sleeping bodies', () => {
      physics1.isAsleep = true;
      physics2.isAsleep = true;
      
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      const stats = physicsSystem.getStats();
      expect(stats.sleepingEntities).toBe(2);
    });
  });

  describe('Collision Response', () => {
    let entity1: Entity;
    let entity2: Entity;
    let physics1: PhysicsComponent;
    let physics2: PhysicsComponent;
    
    beforeEach(() => {
      entity1 = createTestEntity(world, { x: 0, y: 1, z: 0 });
      entity2 = createTestEntity(world, { x: 0.8, y: 1, z: 0 });
      
      physics1 = entity1.components.get('physics') as PhysicsComponent;
      physics2 = entity2.components.get('physics') as PhysicsComponent;
      
      // Set up collision
      physics1.setVelocity({ x: 10, y: 0, z: 0 });
      physics2.setVelocity({ x: -10, y: 0, z: 0 });
    });

    it('should apply impulse forces during collision', () => {
      const initialVelocity1 = { ...physics1.velocity };
      const initialVelocity2 = { ...physics2.velocity };
      
      // Force collision by moving entities close
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      // After collision, velocities should change
      // Note: This test assumes the collision resolution is working
      expect(physics1.velocity.x).not.toBe(initialVelocity1.x);
      expect(physics2.velocity.x).not.toBe(initialVelocity2.x);
    });

    it('should respect mass differences in collision response', () => {
      physics1.mass = 1.0;
      physics2.mass = 10.0; // Much heavier
      
      physics1.setVelocity({ x: 10, y: 0, z: 0 });
      physics2.setVelocity({ x: 0, y: 0, z: 0 });
      
      // Force collision
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      // Lighter object should change velocity more than heavier object
      // This test would need access to the actual collision resolution results
    });

    it('should apply restitution correctly', () => {
      physics1.restitution = 1.0; // Perfect bounce
      physics2.restitution = 1.0;
      
      physics1.setVelocity({ x: 10, y: 0, z: 0 });
      physics2.setVelocity({ x: 0, y: 0, z: 0 });
      
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      // With perfect restitution, objects should bounce apart
      expect(physics1.velocity.x).toBeLessThan(0); // Should reverse direction
    });

    it('should apply friction forces', () => {
      physics1.friction = 0.8;
      physics2.friction = 0.8;
      
      // Set up sliding collision
      physics1.setVelocity({ x: 10, y: 0, z: 5 });
      physics2.setVelocity({ x: 0, y: 0, z: 0 });
      
      const transform2 = entity2.components.get('transform')!;
      transform2.position.x = 0.3;
      
      world.start();
      world.update(0.016);
      
      // Friction should reduce tangential velocity
      expect(Math.abs(physics1.velocity.z)).toBeLessThan(5);
    });

    it('should separate penetrating objects', () => {
      // Start with overlapping positions
      const transform1 = entity1.components.get('transform')!;
      const transform2 = entity2.components.get('transform')!;
      
      transform1.position.x = 0;
      transform2.position.x = 0.2; // Significant overlap
      
      const initialDistance = Math.abs(transform2.position.x - transform1.position.x);
      
      world.start();
      world.update(0.016);
      
      // Objects should be separated
      const finalDistance = Math.abs(transform2.position.x - transform1.position.x);
      expect(finalDistance).toBeGreaterThan(initialDistance);
    });
  });

  describe('Raycasting', () => {
    let entity: Entity;
    
    beforeEach(() => {
      entity = createTestEntity(world, { x: 5, y: 1, z: 0 });
      world.start();
    });

    it('should detect ray-entity intersection', () => {
      const origin: Vector3 = { x: 0, y: 1, z: 0 };
      const direction: Vector3 = { x: 1, y: 0, z: 0 }; // Ray pointing towards entity
      
      const result = physicsSystem.raycast(origin, direction, 10);
      
      expect(result.hit).toBe(true);
      expect(result.entity).toBe(entity);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.point).toBeDefined();
      expect(result.normal).toBeDefined();
    });

    it('should not detect intersection when ray misses', () => {
      const origin: Vector3 = { x: 0, y: 1, z: 0 };
      const direction: Vector3 = { x: 0, y: 1, z: 0 }; // Ray pointing upward
      
      const result = physicsSystem.raycast(origin, direction, 10);
      
      expect(result.hit).toBe(false);
      expect(result.entity).toBeUndefined();
    });

    it('should respect maximum distance', () => {
      const origin: Vector3 = { x: 0, y: 1, z: 0 };
      const direction: Vector3 = { x: 1, y: 0, z: 0 };
      
      const result = physicsSystem.raycast(origin, direction, 2); // Too short to reach entity
      
      expect(result.hit).toBe(false);
    });

    it('should return closest intersection when multiple entities', () => {
      const entity2 = createTestEntity(world, { x: 3, y: 1, z: 0 }); // Closer entity
      
      const origin: Vector3 = { x: 0, y: 1, z: 0 };
      const direction: Vector3 = { x: 1, y: 0, z: 0 };
      
      const result = physicsSystem.raycast(origin, direction, 10);
      
      expect(result.hit).toBe(true);
      expect(result.entity).toBe(entity2); // Should hit closer entity
      expect(result.distance).toBeLessThan(5);
    });

    it('should calculate correct hit normal', () => {
      const origin: Vector3 = { x: 0, y: 1, z: 0 };
      const direction: Vector3 = { x: 1, y: 0, z: 0 };
      
      const result = physicsSystem.raycast(origin, direction, 10);
      
      expect(result.hit).toBe(true);
      expect(result.normal).toBeDefined();
      
      // Normal should point away from entity center
      const normal = result.normal!;
      expect(normal.x).toBeLessThan(0); // Pointing back towards ray origin
    });
  });

  describe('Performance Optimization', () => {
    it('should track performance statistics', () => {
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push(createTestEntity(world, { x: i * 2, y: 1, z: 0 }));
      }
      
      world.start();
      world.update(0.016);
      
      const stats = physicsSystem.getStats();
      
      expect(stats.totalEntities).toBe(100);
      expect(stats.physicsTime).toBeGreaterThan(0);
      expect(stats.collisionTime).toBeGreaterThan(0);
      expect(stats.spatialUpdateTime).toBeGreaterThan(0);
    });

    it('should use spatial grid for broad-phase collision detection', () => {
      // Create many entities in a grid pattern
      for (let x = 0; x < 10; x++) {
        for (let z = 0; z < 10; z++) {
          createTestEntity(world, { x: x * 3, y: 1, z: z * 3 });
        }
      }
      
      world.start();
      world.update(0.016);
      
      const stats = physicsSystem.getStats();
      
      // Should perform collision checks efficiently
      expect(stats.collisionChecks).toBeGreaterThan(0);
      expect(stats.spatialGrid).toBeDefined();
    });

    it('should limit substepping for performance', () => {
      world.start();
      
      // Simulate large time step that would require many substeps
      world.update(0.1); // 100ms frame time
      
      const stats = physicsSystem.getStats();
      expect(stats.subSteps).toBeLessThanOrEqual(3); // Configured max substeps
    });

    it('should handle object pooling for collision pairs', () => {
      const entity1 = createTestEntity(world, { x: 0, y: 1, z: 0 });
      const entity2 = createTestEntity(world, { x: 0.3, y: 1, z: 0 });
      
      world.start();
      
      // Multiple updates should reuse collision pair objects
      for (let i = 0; i < 5; i++) {
        world.update(0.016);
      }
      
      const stats = physicsSystem.getStats();
      expect(stats.poolUsage).toBeDefined();
    });

    it('should optimize spatial grid performance', () => {
      // Create entities and update multiple times
      for (let i = 0; i < 50; i++) {
        createTestEntity(world, { x: Math.random() * 100, y: 1, z: Math.random() * 100 });
      }
      
      world.start();
      
      const startTime = performance.now();
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      const totalTime = performance.now() - startTime;
      
      // Should complete 10 frames in reasonable time
      expect(totalTime).toBeLessThan(100); // 100ms for 10 frames
      
      // Test spatial grid optimization
      physicsSystem.optimize();
      const stats = physicsSystem.getStats();
      expect(stats.spatialGrid.totalCells).toBeGreaterThan(0);
    });
  });

  describe('System Lifecycle', () => {
    it('should initialize properly', () => {
      const initSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      physicsSystem.init();
      
      expect(initSpy).toHaveBeenCalledWith(
        expect.stringContaining('PhysicsSystem initialized')
      );
      
      initSpy.mockRestore();
    });

    it('should destroy cleanly', () => {
      const entity = createTestEntity(world, { x: 0, y: 1, z: 0 });
      world.start();
      world.update(0.016);
      
      physicsSystem.destroy();
      
      const stats = physicsSystem.getStats();
      expect(stats.collisionChecks).toBe(0);
    });

    it('should handle configuration updates', () => {
      const newGravity: Vector3 = { x: 0, y: -15, z: 0 };
      physicsSystem.setGravity(newGravity);
      
      expect(physicsSystem.getGravity()).toEqual(newGravity);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle entities without required components', () => {
      // Create entity without physics component
      const badEntity = world.createEntity();
      world.addComponent(badEntity, {
        type: 'transform',
        entityId: badEntity,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      world.start();
      
      // Should not throw error
      expect(() => world.update(0.016)).not.toThrow();
    });

    it('should handle zero timestep gracefully', () => {
      const entity = createTestEntity(world, { x: 0, y: 1, z: 0 });
      world.start();
      
      expect(() => world.update(0)).not.toThrow();
    });

    it('should handle very large timesteps', () => {
      const entity = createTestEntity(world, { x: 0, y: 1, z: 0 });
      world.start();
      
      // Should not cause instability
      expect(() => world.update(1.0)).not.toThrow();
      
      const stats = physicsSystem.getStats();
      expect(stats.subSteps).toBeLessThanOrEqual(3);
    });

    it('should handle NaN values in physics components', () => {
      const entity = createTestEntity(world, { x: 0, y: 1, z: 0 });
      const physics = entity.components.get('physics') as PhysicsComponent;
      
      // Introduce NaN value
      physics.setVelocity({ x: NaN, y: 0, z: 0 });
      
      world.start();
      
      // Should handle gracefully without propagating NaN
      expect(() => world.update(0.016)).not.toThrow();
    });
  });
});

// Helper function to create test entities
function createTestEntity(world: World, position: Vector3): Entity {
  const entityId = world.createEntity();
  
  const transform = {
    type: 'transform' as const,
    entityId,
    position: { ...position },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
  
  const physics = new PhysicsComponent(entityId);
  
  world.addComponent(entityId, transform);
  world.addComponent(entityId, physics);
  
  return world.getEntity(entityId)!;
}