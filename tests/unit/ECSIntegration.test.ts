import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ECSManager } from '@/core/ecs/ECSManager';
import { World } from '@/core/ecs/World';
import { ComponentFactories } from '@/components/core/CoreComponents';

// Mock canvas for testing
const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = {
    width: 800,
    height: 600,
    getContext: vi.fn().mockReturnValue({
      enable: vi.fn(),
      getExtension: vi.fn(),
      cullFace: vi.fn(),
      depthFunc: vi.fn(),
      viewport: vi.fn()
    }),
    getBoundingClientRect: vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as HTMLCanvasElement;
  
  return canvas;
};

// Mock requestAnimationFrame for testing
global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  setTimeout(() => callback(performance.now()), 16);
  return 1;
});

global.cancelAnimationFrame = vi.fn();

// Mock performance.now
global.performance = {
  now: vi.fn(() => Date.now())
} as any;

// Mock navigator.gpu for WebGPU
Object.defineProperty(navigator, 'gpu', {
  value: undefined,
  writable: true
});

describe('ECS Integration Tests', () => {
  let canvas: HTMLCanvasElement;
  let ecs: ECSManager;

  beforeEach(() => {
    canvas = createMockCanvas();
    ecs = new ECSManager(canvas, {
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: true,
      maxEntities: 1000,
      maxComponentsPerType: 500
    });
  });

  afterEach(() => {
    ecs.stop();
    ecs.clear();
    vi.clearAllMocks();
  });

  describe('ECS Manager Initialization', () => {
    it('should initialize with all core systems', () => {
      const debugInfo = ecs.getDebugInfo();
      
      expect(debugInfo.world.systems).toBe(4); // transform, physics, input, render
      expect(debugInfo.isRunning).toBe(false);
      expect(debugInfo.world.entities).toBe(0);
    });

    it('should register all component factories', () => {
      const debugInfo = ecs.getDebugInfo();
      
      // Should have registered all component types
      expect(debugInfo.world.componentTypes).toBeGreaterThan(0);
    });
  });

  describe('Entity Creation', () => {
    it('should create basic game objects', () => {
      const entityId = ecs.createGameObject(
        { x: 1, y: 2, z: 3 },
        { x: 0, y: Math.PI / 2, z: 0 },
        { x: 2, y: 2, z: 2 }
      );

      expect(entityId).toBe(1);
      expect(ecs.entityExists(entityId)).toBe(true);

      const transform = ecs.getTransform(entityId);
      expect(transform).toBeDefined();
      expect(transform!.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(transform!.scale).toEqual({ x: 2, y: 2, z: 2 });
    });

    it('should create renderable objects', () => {
      const entityId = ecs.createRenderableObject(
        'test-geometry',
        'test-material',
        { x: 0, y: 0, z: 0 }
      );

      const transform = ecs.getTransform(entityId);
      const mesh = ecs.getMesh(entityId);

      expect(transform).toBeDefined();
      expect(mesh).toBeDefined();
      expect(mesh!.geometry).toBe('test-geometry');
      expect(mesh!.material).toBe('test-material');
      expect(mesh!.visible).toBe(true);
    });

    it('should create physics objects', () => {
      const entityId = ecs.createPhysicsObject(
        'box-geometry',
        'box-material',
        'box',
        { x: 2, y: 2, z: 2 },
        10,
        { x: 0, y: 5, z: 0 }
      );

      const transform = ecs.getTransform(entityId);
      const mesh = ecs.getMesh(entityId);
      const rigidBody = ecs.getRigidBody(entityId);
      const collider = ecs.getCollider(entityId);

      expect(transform).toBeDefined();
      expect(mesh).toBeDefined();
      expect(rigidBody).toBeDefined();
      expect(collider).toBeDefined();

      expect(rigidBody!.mass).toBe(10);
      expect(collider!.shape).toBe('box');
      expect(collider!.size).toEqual({ x: 2, y: 2, z: 2 });
    });

    it('should create player characters', () => {
      const playerId = ecs.createPlayer(
        'player-geometry',
        'player-material',
        { x: 0, y: 1, z: 0 }
      );

      const transform = ecs.getTransform(playerId);
      const playerController = ecs.getPlayerController(playerId);
      const rigidBody = ecs.getRigidBody(playerId);
      const collider = ecs.getCollider(playerId);

      expect(transform).toBeDefined();
      expect(playerController).toBeDefined();
      expect(rigidBody).toBeDefined();
      expect(collider).toBeDefined();

      expect(playerController!.moveSpeed).toBeGreaterThan(0);
      expect(playerController!.jumpForce).toBeGreaterThan(0);
      expect(collider!.shape).toBe('capsule');
    });

    it('should create terrain chunks', () => {
      const terrainId = ecs.createTerrain(0, 0, 64);

      const transform = ecs.getTransform(terrainId);
      expect(transform).toBeDefined();

      // Check that terrain component was added through world
      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.world.entities).toBe(1);
    });
  });

  describe('Entity Queries', () => {
    beforeEach(() => {
      // Create test entities
      ecs.createGameObject();
      ecs.createRenderableObject('geo1', 'mat1');
      ecs.createPhysicsObject('geo2', 'mat2', 'box', { x: 1, y: 1, z: 1 }, 5);
      ecs.createPlayer('player-geo', 'player-mat');
      ecs.createTerrain(0, 0);
    });

    it('should query all game objects', () => {
      const gameObjects = ecs.getAllGameObjects();
      expect(gameObjects).toHaveLength(5); // All entities have transform
    });

    it('should query renderable entities', () => {
      const renderables = ecs.getAllRenderables();
      expect(renderables).toHaveLength(3); // renderable, physics, player
    });

    it('should query physics entities', () => {
      const physicsObjects = ecs.getAllPhysicsObjects();
      expect(physicsObjects).toHaveLength(2); // physics object and player
    });

    it('should query player entities', () => {
      const players = ecs.getAllPlayers();
      expect(players).toHaveLength(1); // Only the player
    });

    it('should query terrain entities', () => {
      const terrain = ecs.getAllTerrain();
      expect(terrain).toHaveLength(1); // Only the terrain
    });
  });

  describe('Transform Operations', () => {
    let entityId: number;

    beforeEach(() => {
      entityId = ecs.createGameObject();
    });

    it('should set and get position', () => {
      const newPosition = { x: 10, y: 20, z: 30 };
      ecs.setPosition(entityId, newPosition);

      const position = ecs.getPosition(entityId);
      expect(position).toEqual(newPosition);
    });

    it('should set rotation', () => {
      const newRotation = { x: 0, y: Math.PI, z: 0 };
      ecs.setRotation(entityId, newRotation);

      const transform = ecs.getTransform(entityId);
      expect(transform!.rotation).toEqual(newRotation);
      expect(transform!.isDirty).toBe(true);
    });

    it('should set scale', () => {
      const newScale = { x: 2, y: 3, z: 4 };
      ecs.setScale(entityId, newScale);

      const transform = ecs.getTransform(entityId);
      expect(transform!.scale).toEqual(newScale);
      expect(transform!.isDirty).toBe(true);
    });

    it('should set visibility', () => {
      const renderableId = ecs.createRenderableObject('geo', 'mat');
      
      ecs.setVisible(renderableId, false);
      const mesh = ecs.getMesh(renderableId);
      expect(mesh!.visible).toBe(false);

      ecs.setVisible(renderableId, true);
      expect(mesh!.visible).toBe(true);
    });
  });

  describe('Physics Operations', () => {
    let physicsEntityId: number;

    beforeEach(() => {
      physicsEntityId = ecs.createPhysicsObject(
        'box-geo',
        'box-mat',
        'box',
        { x: 1, y: 1, z: 1 },
        5
      );
    });

    it('should apply forces', () => {
      const force = { x: 100, y: 0, z: 0 };
      ecs.applyForce(physicsEntityId, force);

      const rigidBody = ecs.getRigidBody(physicsEntityId);
      expect(rigidBody!.force.x).toBe(100);
      expect(rigidBody!.isSleeping).toBe(false);
    });

    it('should apply impulses', () => {
      const impulse = { x: 10, y: 0, z: 0 };
      ecs.applyImpulse(physicsEntityId, impulse);

      const rigidBody = ecs.getRigidBody(physicsEntityId);
      expect(rigidBody!.velocity.x).toBeGreaterThan(0);
      expect(rigidBody!.isSleeping).toBe(false);
    });

    it('should set gravity', () => {
      const newGravity = { x: 0, y: -20, z: 0 };
      ecs.setGravity(newGravity);

      // Gravity change should be reflected in physics system
      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.systems.physics.gravity).toEqual(newGravity);
    });
  });

  describe('Camera Operations', () => {
    it('should set camera position', () => {
      const position = { x: 10, y: 20, z: 30 };
      ecs.setCameraPosition(position);

      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.systems.render.camera.position).toEqual(position);
    });

    it('should set camera target', () => {
      const target = { x: 0, y: 0, z: 0 };
      ecs.setCameraTarget(target);

      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.systems.render.camera.target).toEqual(target);
    });

    it('should set camera FOV', () => {
      ecs.setCameraFOV(90);

      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.systems.render.camera.fov).toBe(90);
    });
  });

  describe('Performance and Metrics', () => {
    beforeEach(() => {
      // Create multiple entities for testing
      for (let i = 0; i < 10; i++) {
        ecs.createPhysicsObject(`geo${i}`, `mat${i}`, 'box', { x: 1, y: 1, z: 1 }, 1);
      }
    });

    it('should provide performance metrics', () => {
      const metrics = ecs.getPerformanceMetrics();

      expect(metrics.world).toBeDefined();
      expect(metrics.systems).toBeDefined();
      expect(metrics.memory).toBeDefined();
      
      expect(metrics.world.entities).toBe(10);
      expect(metrics.systems.transform).toBeDefined();
      expect(metrics.systems.physics).toBeDefined();
      expect(metrics.systems.input).toBeDefined();
      expect(metrics.systems.render).toBeDefined();
    });

    it('should provide debug information', () => {
      const debugInfo = ecs.getDebugInfo();

      expect(debugInfo.world.entities).toBe(10);
      expect(debugInfo.world.activeEntities).toBe(10);
      expect(debugInfo.world.systems).toBe(4);
      expect(debugInfo.isRunning).toBe(false);
    });

    it('should track query cache performance', () => {
      // Trigger some queries
      ecs.getAllPhysicsObjects();
      ecs.getAllRenderables();
      ecs.getAllPhysicsObjects(); // Should hit cache

      const metrics = ecs.getPerformanceMetrics();
      expect(metrics.memory.queryCache).toBeDefined();
    });

    it('should track archetype information', () => {
      const metrics = ecs.getPerformanceMetrics();
      expect(metrics.memory.archetypes).toBeDefined();
      expect(metrics.memory.archetypes.size).toBeGreaterThan(0);
    });
  });

  describe('System Lifecycle', () => {
    it('should start and update systems', () => {
      ecs.start();
      
      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.isRunning).toBe(true);
      expect(debugInfo.frameId).toBeGreaterThan(0);
    });

    it('should stop systems', () => {
      ecs.start();
      expect(ecs.getDebugInfo().isRunning).toBe(true);
      
      ecs.stop();
      expect(ecs.getDebugInfo().isRunning).toBe(false);
    });

    it('should enable/disable debug mode', () => {
      ecs.setDebugMode(true);
      
      const debugInfo = ecs.getDebugInfo();
      expect(debugInfo.systems.transform.debugEnabled).toBe(true);
      expect(debugInfo.systems.physics.debugEnabled).toBe(true);
      expect(debugInfo.systems.input.debugEnabled).toBe(true);
      expect(debugInfo.systems.render.debugEnabled).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up destroyed entities', () => {
      const entityId = ecs.createPhysicsObject('geo', 'mat', 'box', { x: 1, y: 1, z: 1 }, 1);
      
      expect(ecs.entityExists(entityId)).toBe(true);
      expect(ecs.getDebugInfo().world.entities).toBe(1);
      
      ecs.destroyEntity(entityId);
      
      expect(ecs.entityExists(entityId)).toBe(false);
      expect(ecs.getDebugInfo().world.entities).toBe(0);
    });

    it('should clear all entities and reset state', () => {
      // Create multiple entities
      for (let i = 0; i < 5; i++) {
        ecs.createGameObject();
      }
      
      expect(ecs.getDebugInfo().world.entities).toBe(5);
      
      ecs.clear();
      
      expect(ecs.getDebugInfo().world.entities).toBe(0);
      expect(ecs.getDebugInfo().world.activeEntities).toBe(0);
    });

    it('should handle object pooling correctly', () => {
      const initialMetrics = ecs.getPerformanceMetrics();
      
      // Create and destroy many entities to test pooling
      const entities: number[] = [];
      for (let i = 0; i < 50; i++) {
        entities.push(ecs.createGameObject());
      }
      
      for (const entityId of entities) {
        ecs.destroyEntity(entityId);
      }
      
      // Create new entities - should reuse pooled IDs
      for (let i = 0; i < 50; i++) {
        ecs.createGameObject();
      }
      
      const finalMetrics = ecs.getPerformanceMetrics();
      expect(finalMetrics.world.entities).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid entity operations gracefully', () => {
      const invalidEntityId = 99999;
      
      expect(() => ecs.setPosition(invalidEntityId, { x: 0, y: 0, z: 0 })).not.toThrow();
      expect(() => ecs.applyForce(invalidEntityId, { x: 0, y: 0, z: 0 })).not.toThrow();
      expect(ecs.getPosition(invalidEntityId)).toBeNull();
      expect(ecs.getTransform(invalidEntityId)).toBeUndefined();
    });

    it('should handle missing components gracefully', () => {
      const entityId = ecs.createGameObject(); // Only has transform
      
      expect(ecs.getMesh(entityId)).toBeUndefined();
      expect(ecs.getRigidBody(entityId)).toBeUndefined();
      expect(ecs.getCollider(entityId)).toBeUndefined();
      expect(ecs.getPlayerController(entityId)).toBeUndefined();
    });
  });
});

describe('Component Factory Tests', () => {
  it('should have factories for all component types', () => {
    expect(ComponentFactories.transform).toBeDefined();
    expect(ComponentFactories.mesh).toBeDefined();
    expect(ComponentFactories.rigidbody).toBeDefined();
    expect(ComponentFactories.collider).toBeDefined();
    expect(ComponentFactories.playerController).toBeDefined();
    expect(ComponentFactories.terrain).toBeDefined();
    expect(ComponentFactories.audio).toBeDefined();
    expect(ComponentFactories.animation).toBeDefined();
  });

  it('should create valid components', () => {
    const transform = ComponentFactories.transform();
    expect(transform.type).toBe('transform');
    expect(transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(transform.isDirty).toBe(true);

    const mesh = ComponentFactories.mesh();
    expect(mesh.type).toBe('mesh');
    expect(mesh.visible).toBe(true);

    const rigidBody = ComponentFactories.rigidbody();
    expect(rigidBody.type).toBe('rigidbody');
    expect(rigidBody.mass).toBe(1);
    expect(rigidBody.inverseMass).toBe(1);
  });
});

describe('World Performance Tests', () => {
  let world: World;

  beforeEach(() => {
    world = new World({
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: true
    });
  });

  afterEach(() => {
    world.clear();
  });

  it('should handle large numbers of entities efficiently', () => {
    const startTime = performance.now();
    
    // Create 1000 entities
    const entities: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const entityId = world.createEntity();
      world.addComponent(entityId, ComponentFactories.transform());
      if (i % 2 === 0) {
        world.addComponent(entityId, ComponentFactories.mesh());
      }
      entities.push(entityId);
    }
    
    const creationTime = performance.now() - startTime;
    expect(creationTime).toBeLessThan(100); // Should complete in under 100ms
    
    // Test queries
    const queryStartTime = performance.now();
    const transformEntities = world.getEntitiesWithComponents(['transform']);
    const meshEntities = world.getEntitiesWithComponents(['transform', 'mesh']);
    const queryTime = performance.now() - queryStartTime;
    
    expect(transformEntities).toHaveLength(1000);
    expect(meshEntities).toHaveLength(500);
    expect(queryTime).toBeLessThan(50); // Queries should be fast
    
    // Test cache effectiveness
    const cacheQueryTime = performance.now();
    world.getEntitiesWithComponents(['transform']); // Should hit cache
    const cacheTime = performance.now() - cacheQueryTime;
    
    expect(cacheTime).toBeLessThan(queryTime); // Cache should be faster
  });
});