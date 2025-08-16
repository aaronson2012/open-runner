import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@/core/ecs/World';
import type { Component, System } from '@/types';

interface MockComponent extends Component {
  type: 'mock';
  value: number;
}

interface AnotherMockComponent extends Component {
  type: 'another';
  name: string;
}

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('Entity Management', () => {
    it('should create entities with unique IDs', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      expect(entity1).toBe(1);
      expect(entity2).toBe(2);
      expect(entity1).not.toBe(entity2);
    });

    it('should retrieve created entities', () => {
      const entityId = world.createEntity();
      const entity = world.getEntity(entityId);
      
      expect(entity).toBeDefined();
      expect(entity!.id).toBe(entityId);
      expect(entity!.active).toBe(true);
    });

    it('should destroy entities and clean up components', () => {
      const entityId = world.createEntity();
      const component: MockComponent = { type: 'mock', entityId, value: 42 };
      
      world.addComponent(entityId, component);
      expect(world.hasComponent(entityId, 'mock')).toBe(true);
      
      world.destroyEntity(entityId);
      
      expect(world.getEntity(entityId)).toBeUndefined();
      expect(world.hasComponent(entityId, 'mock')).toBe(false);
    });

    it('should get all entities', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      const entities = world.getAllEntities();
      expect(entities).toHaveLength(2);
      expect(entities.some(e => e.id === entity1)).toBe(true);
      expect(entities.some(e => e.id === entity2)).toBe(true);
    });

    it('should get only active entities', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      // Deactivate one entity
      const entityObj = world.getEntity(entity2)!;
      entityObj.active = false;
      
      const activeEntities = world.getActiveEntities();
      expect(activeEntities).toHaveLength(1);
      expect(activeEntities[0].id).toBe(entity1);
    });
  });

  describe('Component Management', () => {
    it('should add components to entities', () => {
      const entityId = world.createEntity();
      const component: MockComponent = { type: 'mock', entityId, value: 42 };
      
      world.addComponent(entityId, component);
      
      expect(world.hasComponent(entityId, 'mock')).toBe(true);
      const retrieved = world.getComponent<MockComponent>(entityId, 'mock');
      expect(retrieved).toBeDefined();
      expect(retrieved!.value).toBe(42);
    });

    it('should remove components from entities', () => {
      const entityId = world.createEntity();
      const component: MockComponent = { type: 'mock', entityId, value: 42 };
      
      world.addComponent(entityId, component);
      expect(world.hasComponent(entityId, 'mock')).toBe(true);
      
      world.removeComponent(entityId, 'mock');
      expect(world.hasComponent(entityId, 'mock')).toBe(false);
    });

    it('should check for multiple components', () => {
      const entityId = world.createEntity();
      const component1: MockComponent = { type: 'mock', entityId, value: 42 };
      const component2: AnotherMockComponent = { type: 'another', entityId, name: 'test' };
      
      world.addComponent(entityId, component1);
      world.addComponent(entityId, component2);
      
      expect(world.hasComponents(entityId, ['mock', 'another'])).toBe(true);
      expect(world.hasComponents(entityId, ['mock', 'nonexistent'])).toBe(false);
    });

    it('should get entities with specific component', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();
      
      const component1: MockComponent = { type: 'mock', entityId: entity1, value: 1 };
      const component2: MockComponent = { type: 'mock', entityId: entity2, value: 2 };
      
      world.addComponent(entity1, component1);
      world.addComponent(entity2, component2);
      // entity3 has no mock component
      
      const entitiesWithMock = world.getEntitiesWithComponent('mock');
      expect(entitiesWithMock).toHaveLength(2);
      expect(entitiesWithMock.some(e => e.id === entity1)).toBe(true);
      expect(entitiesWithMock.some(e => e.id === entity2)).toBe(true);
      expect(entitiesWithMock.some(e => e.id === entity3)).toBe(false);
    });

    it('should get entities with multiple components', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      const mockComponent1: MockComponent = { type: 'mock', entityId: entity1, value: 1 };
      const anotherComponent1: AnotherMockComponent = { type: 'another', entityId: entity1, name: 'test1' };
      const mockComponent2: MockComponent = { type: 'mock', entityId: entity2, value: 2 };
      
      world.addComponent(entity1, mockComponent1);
      world.addComponent(entity1, anotherComponent1);
      world.addComponent(entity2, mockComponent2);
      
      const entitiesWithBoth = world.getEntitiesWithComponents(['mock', 'another']);
      expect(entitiesWithBoth).toHaveLength(1);
      expect(entitiesWithBoth[0].id).toBe(entity1);
    });
  });

  describe('System Management', () => {
    it('should add and retrieve systems', () => {
      const mockSystem: System = {
        id: 'mock-system',
        priority: 1,
        requiredComponents: ['mock'],
        update: () => {}
      };
      
      world.addSystem(mockSystem);
      
      const retrieved = world.getSystem('mock-system');
      expect(retrieved).toBe(mockSystem);
    });

    it('should remove systems', () => {
      const mockSystem: System = {
        id: 'mock-system',
        priority: 1,
        requiredComponents: ['mock'],
        update: () => {}
      };
      
      world.addSystem(mockSystem);
      expect(world.getSystem('mock-system')).toBeDefined();
      
      world.removeSystem('mock-system');
      expect(world.getSystem('mock-system')).toBeUndefined();
    });

    it('should not add duplicate systems', () => {
      const mockSystem: System = {
        id: 'mock-system',
        priority: 1,
        requiredComponents: ['mock'],
        update: () => {}
      };
      
      world.addSystem(mockSystem);
      world.addSystem(mockSystem); // Should warn and not add
      
      expect(world.getSystemCount()).toBe(1);
    });
  });

  describe('World Lifecycle', () => {
    it('should start and stop correctly', () => {
      let initCalled = false;
      let destroyCalled = false;
      
      const mockSystem: System = {
        id: 'mock-system',
        priority: 1,
        requiredComponents: [],
        init: () => { initCalled = true; },
        update: () => {},
        destroy: () => { destroyCalled = true; }
      };
      
      world.addSystem(mockSystem);
      
      world.start();
      expect(initCalled).toBe(true);
      
      world.stop();
      expect(destroyCalled).toBe(true);
    });

    it('should update systems in priority order', () => {
      const updateOrder: number[] = [];
      
      const system1: System = {
        id: 'system-1',
        priority: 2,
        requiredComponents: [],
        update: () => updateOrder.push(1)
      };
      
      const system2: System = {
        id: 'system-2',
        priority: 1,
        requiredComponents: [],
        update: () => updateOrder.push(2)
      };
      
      world.addSystem(system1);
      world.addSystem(system2);
      world.start();
      
      world.update(0.016);
      
      expect(updateOrder).toEqual([2, 1]); // system2 has lower priority, runs first
    });

    it('should clear all entities and systems', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      const mockSystem: System = {
        id: 'mock-system',
        priority: 1,
        requiredComponents: [],
        update: () => {}
      };
      
      world.addSystem(mockSystem);
      
      expect(world.getEntityCount()).toBe(2);
      expect(world.getSystemCount()).toBe(1);
      
      world.clear();
      
      expect(world.getEntityCount()).toBe(0);
      expect(world.getSystemCount()).toBe(0);
    });
  });

  describe('Debug Information', () => {
    it('should provide debug information', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      
      const mockSystem: System = {
        id: 'mock-system',
        priority: 1,
        requiredComponents: [],
        update: () => {}
      };
      
      world.addSystem(mockSystem);
      world.start();
      
      const debugInfo = world.getDebugInfo();
      
      expect(debugInfo.entities).toBe(2);
      expect(debugInfo.activeEntities).toBe(2);
      expect(debugInfo.systems).toBe(1);
      expect(debugInfo.isRunning).toBe(true);
    });
  });
});