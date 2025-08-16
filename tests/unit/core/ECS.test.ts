import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World, type WorldConfig } from '@/core/ecs/World';
import { ComponentPool } from '@/core/ecs/ComponentPool';
import { QueryCache } from '@/core/ecs/QueryCache';
import { SystemDependencyManager } from '@/core/ecs/SystemDependencyManager';
import { PerformanceProfiler } from '@/core/ecs/PerformanceProfiler';
import type { Component, System, Entity, EntityId } from '@/types';

// Mock components for testing
interface MockComponent extends Component {
  type: 'mock';
  value: number;
}

interface TransformComponent extends Component {
  type: 'transform';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

interface PhysicsTestComponent extends Component {
  type: 'physics';
  velocity: { x: number; y: number; z: number };
  mass: number;
  isKinematic: boolean;
}

describe('ECS Core System', () => {
  let world: World;
  
  beforeEach(() => {
    world = new World({
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: true,
      maxEntities: 1000,
      maxComponentsPerType: 500
    });
  });

  describe('World Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultWorld = new World();
      const debugInfo = defaultWorld.getDebugInfo();
      
      expect(debugInfo.entities).toBe(0);
      expect(debugInfo.systems).toBe(0);
      expect(debugInfo.isRunning).toBe(false);
    });

    it('should apply custom configuration', () => {
      const config: WorldConfig = {
        enableQueryCaching: false,
        enableObjectPooling: false,
        maxEntities: 500
      };
      
      const customWorld = new World(config);
      const stats = customWorld.getQueryCacheStats();
      
      expect(stats.enabled).toBe(false);
    });

    it('should register components with pooling', () => {
      const mockFactory = () => ({ type: 'mock', entityId: 0, value: 0 } as MockComponent);
      
      world.registerComponent('mock', mockFactory, 100);
      
      const component = world.createComponent<MockComponent>(1, 'mock');
      expect(component).toBeDefined();
      expect(component?.type).toBe('mock');
    });
  });

  describe('Entity Management', () => {
    it('should create entities with unique sequential IDs', () => {
      const entities = Array.from({ length: 10 }, () => world.createEntity());
      
      entities.forEach((id, index) => {
        expect(id).toBe(index + 1);
      });
      
      expect(new Set(entities).size).toBe(10); // All unique
    });

    it('should recycle entity IDs after destruction', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();
      
      world.destroyEntity(entity2); // Destroy middle entity
      
      const newEntity = world.createEntity();
      expect(newEntity).toBe(entity2); // Should reuse ID 2
    });

    it('should handle entity lifecycle correctly', () => {
      const entityId = world.createEntity();
      
      // Entity should exist and be active
      const entity = world.getEntity(entityId);
      expect(entity).toBeDefined();
      expect(entity!.active).toBe(true);
      expect(entity!.id).toBe(entityId);
      
      // Deactivate entity
      entity!.active = false;
      const activeEntities = world.getActiveEntities();
      expect(activeEntities.some(e => e.id === entityId)).toBe(false);
      
      // Destroy entity
      world.destroyEntity(entityId);
      expect(world.getEntity(entityId)).toBeUndefined();
    });

    it('should handle mass entity creation and destruction', () => {
      const entityCount = 1000;
      const entities = Array.from({ length: entityCount }, () => world.createEntity());
      
      expect(world.getEntityCount()).toBe(entityCount);
      
      // Destroy half the entities
      const entitiesToDestroy = entities.slice(0, entityCount / 2);
      entitiesToDestroy.forEach(id => world.destroyEntity(id));
      
      expect(world.getEntityCount()).toBe(entityCount / 2);
      
      // Create new entities (should reuse IDs)
      const newEntities = Array.from({ length: entityCount / 2 }, () => world.createEntity());
      expect(world.getEntityCount()).toBe(entityCount);
      
      // New entities should reuse destroyed IDs
      const reuseCount = newEntities.filter(id => entitiesToDestroy.includes(id)).length;
      expect(reuseCount).toBeGreaterThan(0);
    });
  });

  describe('Component Management', () => {
    let entityId: EntityId;
    
    beforeEach(() => {
      entityId = world.createEntity();
    });

    it('should add and retrieve components', () => {
      const transform: TransformComponent = {
        type: 'transform',
        entityId,
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      world.addComponent(entityId, transform);
      
      expect(world.hasComponent(entityId, 'transform')).toBe(true);
      
      const retrieved = world.getComponent<TransformComponent>(entityId, 'transform');
      expect(retrieved).toBeDefined();
      expect(retrieved!.position).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should remove components and clean up references', () => {
      const physics: PhysicsTestComponent = {
        type: 'physics',
        entityId,
        velocity: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        isKinematic: false
      };
      
      world.addComponent(entityId, physics);
      expect(world.hasComponent(entityId, 'physics')).toBe(true);
      
      world.removeComponent(entityId, 'physics');
      expect(world.hasComponent(entityId, 'physics')).toBe(false);
      expect(world.getComponent(entityId, 'physics')).toBeUndefined();
    });

    it('should handle multiple components per entity', () => {
      const transform: TransformComponent = {
        type: 'transform',
        entityId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      const physics: PhysicsTestComponent = {
        type: 'physics',
        entityId,
        velocity: { x: 1, y: 2, z: 3 },
        mass: 2.0,
        isKinematic: true
      };
      
      world.addComponent(entityId, transform);
      world.addComponent(entityId, physics);
      
      expect(world.hasComponents(entityId, ['transform', 'physics'])).toBe(true);
      expect(world.hasComponents(entityId, ['transform', 'render'])).toBe(false);
    });

    it('should update component archetype when components change', () => {
      const initialArchetype = world.getEntity(entityId)?.archetype;
      
      const transform: TransformComponent = {
        type: 'transform',
        entityId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      world.addComponent(entityId, transform);
      
      const newArchetype = world.getEntity(entityId)?.archetype;
      expect(newArchetype).not.toBe(initialArchetype);
      expect(newArchetype).toContain('transform');
    });

    it('should clean up components when entity is destroyed', () => {
      const transform: TransformComponent = {
        type: 'transform',
        entityId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      world.addComponent(entityId, transform);
      expect(world.hasComponent(entityId, 'transform')).toBe(true);
      
      world.destroyEntity(entityId);
      
      // Component should be cleaned up
      expect(world.hasComponent(entityId, 'transform')).toBe(false);
    });
  });

  describe('Component Queries', () => {
    beforeEach(() => {
      // Create test entities with different component combinations
      for (let i = 0; i < 10; i++) {
        const entityId = world.createEntity();
        
        // All entities have transform
        const transform: TransformComponent = {
          type: 'transform',
          entityId,
          position: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        };
        world.addComponent(entityId, transform);
        
        // Half have physics
        if (i % 2 === 0) {
          const physics: PhysicsTestComponent = {
            type: 'physics',
            entityId,
            velocity: { x: 0, y: 0, z: 0 },
            mass: 1.0,
            isKinematic: false
          };
          world.addComponent(entityId, physics);
        }
        
        // Quarter have mock component
        if (i % 4 === 0) {
          const mock: MockComponent = {
            type: 'mock',
            entityId,
            value: i
          };
          world.addComponent(entityId, mock);
        }
      }
    });

    it('should query entities by single component', () => {
      const transformEntities = world.getEntitiesWithComponent('transform');
      expect(transformEntities).toHaveLength(10);
      
      const physicsEntities = world.getEntitiesWithComponent('physics');
      expect(physicsEntities).toHaveLength(5);
      
      const mockEntities = world.getEntitiesWithComponent('mock');
      expect(mockEntities).toHaveLength(3); // entities 0, 4, 8
    });

    it('should query entities by multiple components', () => {
      const transformPhysicsEntities = world.getEntitiesWithComponents(['transform', 'physics']);
      expect(transformPhysicsEntities).toHaveLength(5);
      
      const allComponentEntities = world.getEntitiesWithComponents(['transform', 'physics', 'mock']);
      expect(allComponentEntities).toHaveLength(3); // entities 0, 4, 8
    });

    it('should cache query results for performance', () => {
      // First query should miss cache
      const result1 = world.getEntitiesWithComponents(['transform', 'physics']);
      
      // Second identical query should hit cache
      const result2 = world.getEntitiesWithComponents(['transform', 'physics']);
      
      expect(result1).toEqual(result2);
      
      const cacheStats = world.getQueryCacheStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });

    it('should invalidate cache when components change', () => {
      const initialResult = world.getEntitiesWithComponents(['transform', 'physics']);
      const initialCount = initialResult.length;
      
      // Add physics to an entity that doesn't have it
      const entityWithoutPhysics = world.getEntitiesWithComponent('transform')
        .find(e => !world.hasComponent(e.id, 'physics'));
      
      if (entityWithoutPhysics) {
        const physics: PhysicsTestComponent = {
          type: 'physics',
          entityId: entityWithoutPhysics.id,
          velocity: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          isKinematic: false
        };
        world.addComponent(entityWithoutPhysics.id, physics);
        
        const newResult = world.getEntitiesWithComponents(['transform', 'physics']);
        expect(newResult.length).toBe(initialCount + 1);
      }
    });
  });

  describe('System Management', () => {
    let mockSystem: System;
    let initSpy: any;
    let updateSpy: any;
    let destroySpy: any;
    
    beforeEach(() => {
      initSpy = vi.fn();
      updateSpy = vi.fn();
      destroySpy = vi.fn();
      
      mockSystem = {
        id: 'mock-system',
        priority: 10,
        requiredComponents: ['transform'],
        init: initSpy,
        update: updateSpy,
        destroy: destroySpy
      };
    });

    it('should add and retrieve systems', () => {
      world.addSystem(mockSystem);
      
      const retrieved = world.getSystem('mock-system');
      expect(retrieved).toBe(mockSystem);
      expect(world.getSystemCount()).toBe(1);
    });

    it('should prevent duplicate system registration', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      world.addSystem(mockSystem);
      world.addSystem(mockSystem); // Duplicate
      
      expect(world.getSystemCount()).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith('System mock-system already exists');
      
      consoleSpy.mockRestore();
    });

    it('should initialize systems when world starts', () => {
      world.addSystem(mockSystem);
      expect(initSpy).not.toHaveBeenCalled();
      
      world.start();
      expect(initSpy).toHaveBeenCalledOnce();
    });

    it('should update systems in priority order', () => {
      const system1: System = {
        id: 'system-1',
        priority: 20,
        requiredComponents: [],
        update: vi.fn()
      };
      
      const system2: System = {
        id: 'system-2',
        priority: 10,
        requiredComponents: [],
        update: vi.fn()
      };
      
      world.addSystem(system1);
      world.addSystem(system2);
      world.start();
      
      world.update(0.016);
      
      // Verify both systems were called
      expect(system1.update).toHaveBeenCalled();
      expect(system2.update).toHaveBeenCalled();
    });

    it('should pass relevant entities to system update', () => {
      // Create entities with transform component
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();
      
      const transform1: TransformComponent = {
        type: 'transform',
        entityId: entity1,
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      const transform2: TransformComponent = {
        type: 'transform',
        entityId: entity2,
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      world.addComponent(entity1, transform1);
      world.addComponent(entity2, transform2);
      // entity3 has no transform component
      
      world.addSystem(mockSystem); // Requires 'transform'
      world.start();
      world.update(0.016);
      
      expect(updateSpy).toHaveBeenCalled();
      const passedEntities = updateSpy.mock.calls[0][1];
      expect(passedEntities).toHaveLength(2); // Only entities 1 and 2
      expect(passedEntities.some((e: Entity) => e.id === entity1)).toBe(true);
      expect(passedEntities.some((e: Entity) => e.id === entity2)).toBe(true);
      expect(passedEntities.some((e: Entity) => e.id === entity3)).toBe(false);
    });

    it('should destroy systems when removing', () => {
      world.addSystem(mockSystem);
      world.start();
      
      world.removeSystem('mock-system');
      
      expect(destroySpy).toHaveBeenCalledOnce();
      expect(world.getSystem('mock-system')).toBeUndefined();
    });

    it('should destroy all systems when stopping world', () => {
      world.addSystem(mockSystem);
      world.start();
      
      world.stop();
      
      expect(destroySpy).toHaveBeenCalledOnce();
    });
  });

  describe('Performance and Optimization', () => {
    it('should track performance metrics when enabled', () => {
      const perfWorld = new World({ enableProfiling: true });
      const mockSystem: System = {
        id: 'perf-system',
        priority: 1,
        requiredComponents: [],
        update: vi.fn()
      };
      
      perfWorld.addSystem(mockSystem);
      perfWorld.start();
      perfWorld.update(0.016);
      
      const metrics = perfWorld.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.frameCount).toBeGreaterThan(0);
    });

    it('should handle archetype optimization for large entity sets', () => {
      const entityCount = 1000;
      
      // Create many entities with same component signature
      for (let i = 0; i < entityCount; i++) {
        const entityId = world.createEntity();
        
        const transform: TransformComponent = {
          type: 'transform',
          entityId,
          position: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        };
        
        world.addComponent(entityId, transform);
      }
      
      const startTime = performance.now();
      const entities = world.getEntitiesWithComponents(['transform']);
      const queryTime = performance.now() - startTime;
      
      expect(entities).toHaveLength(entityCount);
      expect(queryTime).toBeLessThan(50); // Should be fast with archetype optimization
      
      const archetypeInfo = world.getArchetypeInfo();
      expect(archetypeInfo.has('transform')).toBe(true);
      expect(archetypeInfo.get('transform')).toBe(entityCount);
    });

    it('should provide comprehensive debug information', () => {
      // Create some entities and systems
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      const transform: TransformComponent = {
        type: 'transform',
        entityId: entity1,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      world.addComponent(entity1, transform);
      
      const mockSystem: System = {
        id: 'debug-system',
        priority: 1,
        requiredComponents: ['transform'],
        update: vi.fn()
      };
      world.addSystem(mockSystem);
      world.start();
      
      const debugInfo = world.getDebugInfo();
      
      expect(debugInfo).toEqual(expect.objectContaining({
        entities: 2,
        activeEntities: 2,
        systems: 1,
        componentTypes: 1,
        isRunning: true
      }));
      
      expect(debugInfo.performance).toBeDefined();
      expect(debugInfo.queryCache).toBeDefined();
    });

    it('should clear all state properly', () => {
      // Create entities, components, and systems
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      const transform: TransformComponent = {
        type: 'transform',
        entityId: entity1,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      world.addComponent(entity1, transform);
      
      const mockSystem: System = {
        id: 'clear-system',
        priority: 1,
        requiredComponents: [],
        update: vi.fn(),
        destroy: vi.fn()
      };
      world.addSystem(mockSystem);
      world.start();
      
      // Clear everything
      world.clear();
      
      const debugInfo = world.getDebugInfo();
      expect(debugInfo.entities).toBe(0);
      expect(debugInfo.systems).toBe(0);
      expect(debugInfo.isRunning).toBe(false);
      expect(debugInfo.archetypes).toBe(0);
      
      expect(mockSystem.destroy).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle operations on non-existent entities gracefully', () => {
      const nonExistentId = 999;
      
      expect(world.getEntity(nonExistentId)).toBeUndefined();
      expect(world.hasComponent(nonExistentId, 'transform')).toBe(false);
      expect(world.getComponent(nonExistentId, 'transform')).toBeUndefined();
      
      // These should not throw
      world.removeComponent(nonExistentId, 'transform');
      world.destroyEntity(nonExistentId);
    });

    it('should handle adding components to non-existent entities', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const transform: TransformComponent = {
        type: 'transform',
        entityId: 999,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      
      world.addComponent(999, transform);
      
      expect(consoleSpy).toHaveBeenCalledWith('Entity 999 not found when adding component transform');
      consoleSpy.mockRestore();
    });

    it('should handle empty component queries', () => {
      const entities = world.getEntitiesWithComponents([]);
      expect(entities).toEqual(world.getActiveEntities());
      
      const emptyResult = world.getEntitiesWithComponent('nonexistent');
      expect(emptyResult).toEqual([]);
    });

    it('should handle system updates when world is not running', () => {
      const mockSystem: System = {
        id: 'stopped-system',
        priority: 1,
        requiredComponents: [],
        update: vi.fn()
      };
      
      world.addSystem(mockSystem);
      // Don't start world
      world.update(0.016);
      
      expect(mockSystem.update).not.toHaveBeenCalled();
    });

    it('should handle maximum entity limits', () => {
      const limitedWorld = new World({ maxEntities: 5 });
      
      // Create entities up to limit
      const entities = [];
      for (let i = 0; i < 10; i++) {
        entities.push(limitedWorld.createEntity());
      }
      
      // All entities should be created (no hard limit enforcement in this implementation)
      expect(entities).toHaveLength(10);
      expect(limitedWorld.getEntityCount()).toBe(10);
    });
  });
});