/**
 * Complete physics integration example for Open Runner
 * Demonstrates how to use the physics system with the ECS architecture
 */

import { World } from '@/core/ecs/World';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/collision/CollisionSystem';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import { SpatialHashGrid } from '@/systems/physics/SpatialHashGrid';
import { MobileOptimizations } from '@/utils/physics/MobileOptimizations';
import { PhysicsWorkerManager } from '@/utils/physics/PhysicsWorker';
import type { Entity, Vector3, CollisionEvent } from '@/types';

/**
 * Physics integration example for Open Runner
 */
export class PhysicsIntegrationExample {
  private world: World;
  private physicsSystem: PhysicsSystem;
  private collisionSystem: CollisionSystem;
  private spatialGrid: SpatialHashGrid;
  private mobileOptimizations: MobileOptimizations;
  private physicsWorker: PhysicsWorkerManager;
  private entities: Entity[] = [];

  constructor() {
    this.world = new World();
    
    // Initialize spatial grid for collision detection
    this.spatialGrid = new SpatialHashGrid(10.0);
    
    // Initialize physics system with mobile-optimized settings
    this.physicsSystem = new PhysicsSystem({
      gravity: { x: 0, y: -9.81, z: 0 },
      timeStep: 1/60,
      maxSubSteps: 2,
      enableSleeping: true,
      enableMultithreading: true,
      spatialGridCellSize: 10.0,
      enableCCD: false, // Disable for mobile performance
      solverIterations: 2 // Reduced for mobile
    });
    
    // Initialize collision system
    this.collisionSystem = new CollisionSystem(this.spatialGrid);
    
    // Initialize mobile optimizations
    this.mobileOptimizations = new MobileOptimizations({
      targetFPS: 60,
      maxPhysicsTime: 6, // 6ms target for mobile
      adaptiveQuality: true,
      aggressiveCulling: true,
      reducedPrecision: true
    });
    
    // Initialize physics worker for heavy calculations
    this.physicsWorker = new PhysicsWorkerManager();
    
    this.setupSystems();
    this.setupEventHandlers();
  }

  private setupSystems(): void {
    // Add systems to world in order of priority
    this.world.addSystem(this.physicsSystem);
    this.world.addSystem(this.collisionSystem);
  }

  private setupEventHandlers(): void {
    // Handle collision events
    this.collisionSystem.addEventListener('collision', (event: CollisionEvent) => {
      this.handleCollision(event);
    });
  }

  /**
   * Create player entity with physics
   */
  createPlayer(position: Vector3): Entity {
    const entityId = this.world.createEntity();
    const entity = this.world.getEntity(entityId)!;
    
    // Add transform component
    this.world.addComponent(entityId, {
      type: 'transform',
      entityId,
      position: { ...position },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    
    // Add physics component with player-specific settings
    const physics = new PhysicsComponent(entityId, {
      mass: 70, // 70kg player
      friction: 0.8,
      restitution: 0.1,
      drag: 0.02,
      useGravity: true,
      isKinematic: false,
      material: PhysicsComponent.getMaterial('default')
    });
    this.world.addComponent(entityId, physics);
    
    // Add collider component
    this.world.addComponent(entityId, {
      type: 'collider',
      entityId,
      shape: 'capsule',
      size: { x: 0.6, y: 1.8, z: 0.6 }, // Player capsule
      offset: { x: 0, y: 0.9, z: 0 },
      isTrigger: false,
      layer: 1, // Player layer
      material: 'default'
    });
    
    this.entities.push(entity);
    return entity;
  }

  /**
   * Create obstacle with physics
   */
  createObstacle(position: Vector3, size: Vector3): Entity {
    const entityId = this.world.createEntity();
    const entity = this.world.getEntity(entityId)!;
    
    // Add transform component
    this.world.addComponent(entityId, {
      type: 'transform',
      entityId,
      position: { ...position },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    
    // Add physics component (static obstacle)
    const physics = new PhysicsComponent(entityId, {
      mass: 1000, // Very heavy
      friction: 0.9,
      restitution: 0.2,
      isKinematic: true, // Static obstacle
      useGravity: false,
      material: PhysicsComponent.getMaterial('stone')
    });
    this.world.addComponent(entityId, physics);
    
    // Add collider component
    this.world.addComponent(entityId, {
      type: 'collider',
      entityId,
      shape: 'box',
      size: { ...size },
      offset: { x: 0, y: 0, z: 0 },
      isTrigger: false,
      layer: 4, // Obstacle layer
      material: 'stone'
    });
    
    this.entities.push(entity);
    return entity;
  }

  /**
   * Create collectible with trigger physics
   */
  createCollectible(position: Vector3): Entity {
    const entityId = this.world.createEntity();
    const entity = this.world.getEntity(entityId)!;
    
    // Add transform component
    this.world.addComponent(entityId, {
      type: 'transform',
      entityId,
      position: { ...position },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    
    // Add physics component (floating collectible)
    const physics = new PhysicsComponent(entityId, {
      mass: 0.1,
      friction: 0.0,
      restitution: 0.0,
      useGravity: false,
      isKinematic: true, // Controlled movement
      isTrigger: true
    });
    this.world.addComponent(entityId, physics);
    
    // Add collider component (trigger)
    this.world.addComponent(entityId, {
      type: 'collider',
      entityId,
      shape: 'sphere',
      size: { x: 0.8, y: 0.8, z: 0.8 },
      offset: { x: 0, y: 0, z: 0 },
      isTrigger: true,
      layer: 3, // Collectible layer
    });
    
    this.entities.push(entity);
    return entity;
  }

  /**
   * Apply jump force to player
   */
  jumpPlayer(playerEntity: Entity, force: number = 8.0): void {
    const physics = playerEntity.components.get('physics') as PhysicsComponent;
    if (physics && physics.isGrounded) {
      physics.addForce({ x: 0, y: force, z: 0 }, 'impulse');
    }
  }

  /**
   * Apply steering force to player
   */
  steerPlayer(playerEntity: Entity, direction: number): void {
    const physics = playerEntity.components.get('physics') as PhysicsComponent;
    if (physics) {
      const steerForce = direction * 5.0; // Steering strength
      physics.addForce({ x: steerForce, y: 0, z: 0 });
    }
  }

  /**
   * Raycast for ground detection
   */
  checkGroundHeight(position: Vector3): number {
    const raycastResult = this.physicsSystem.raycast(
      { x: position.x, y: position.y + 1, z: position.z },
      { x: 0, y: -1, z: 0 },
      10.0
    );
    
    if (raycastResult.hit && raycastResult.point) {
      return raycastResult.point.y;
    }
    
    return 0; // Default ground level
  }

  /**
   * Handle collision events
   */
  private handleCollision(event: CollisionEvent): void {
    const { entityA, entityB, point, normal } = event.data;
    
    // Get entities
    const entityAObj = this.world.getEntity(entityA);
    const entityBObj = this.world.getEntity(entityB);
    
    if (!entityAObj || !entityBObj) return;
    
    // Check for player collision
    const playerEntity = this.getPlayerEntity(entityAObj, entityBObj);
    const otherEntity = playerEntity === entityAObj ? entityBObj : entityAObj;
    
    if (playerEntity) {
      this.handlePlayerCollision(playerEntity, otherEntity, point, normal);
    }
  }

  private getPlayerEntity(entityA: Entity, entityB: Entity): Entity | null {
    const colliderA = entityA.components.get('collider') as any;
    const colliderB = entityB.components.get('collider') as any;
    
    if (colliderA?.layer === 1) return entityA; // Player layer
    if (colliderB?.layer === 1) return entityB; // Player layer
    
    return null;
  }

  private handlePlayerCollision(player: Entity, other: Entity, point: Vector3, normal: Vector3): void {
    const otherCollider = other.components.get('collider') as any;
    
    switch (otherCollider?.layer) {
      case 3: // Collectible
        this.collectItem(player, other);
        break;
      case 4: // Obstacle
        this.handleObstacleCollision(player, normal);
        break;
    }
  }

  private collectItem(player: Entity, collectible: Entity): void {
    // Remove collectible from world
    this.world.destroyEntity(collectible.id);
    
    // Award points or power-up
    console.log('Item collected!');
  }

  private handleObstacleCollision(player: Entity, normal: Vector3): void {
    // Handle obstacle collision (damage, bounce, etc.)
    console.log('Player hit obstacle!');
  }

  /**
   * Update physics simulation with mobile optimizations
   */
  update(deltaTime: number, cameraPosition: Vector3): void {
    const startTime = performance.now();
    
    // Check if we should use adaptive quality
    if (this.mobileOptimizations.getPerformanceSettings().adaptiveQuality) {
      deltaTime = this.mobileOptimizations.getOptimalTimestep(deltaTime);
    }
    
    // Filter entities based on LOD and frustum culling
    const activeEntities = this.entities.filter(entity => {
      const transform = entity.components.get('transform');
      if (!transform) return false;
      
      // Check if entity should be updated this frame
      return this.mobileOptimizations.shouldUpdatePhysics(entity, cameraPosition, performance.now());
    });
    
    // Update world with filtered entities
    this.world.update(deltaTime);
    
    // Track performance
    const physicsTime = performance.now() - startTime;
    this.mobileOptimizations.updatePerformanceMetrics(deltaTime * 1000, physicsTime);
  }

  /**
   * Create a simple test scene
   */
  createTestScene(): void {
    // Create player
    const player = this.createPlayer({ x: 0, y: 2, z: 0 });
    
    // Create obstacles
    this.createObstacle({ x: 5, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 });
    this.createObstacle({ x: -5, y: 0.5, z: 5 }, { x: 2, y: 1, z: 1 });
    this.createObstacle({ x: 0, y: 0.5, z: 10 }, { x: 1, y: 2, z: 1 });
    
    // Create collectibles
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 20 - 10;
      const z = Math.random() * 20;
      this.createCollectible({ x, y: 2, z });
    }
    
    console.log(`Created test scene with ${this.entities.length} entities`);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      physics: this.physicsSystem.getStats(),
      collision: this.collisionSystem.getStats(),
      spatial: this.spatialGrid.getStats(),
      mobile: this.mobileOptimizations.getDebugInfo(),
      worker: this.physicsWorker.getDebugInfo(),
      entities: {
        total: this.entities.length,
        active: this.entities.filter(e => e.active).length
      }
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.world.clear();
    this.physicsSystem.destroy();
    this.collisionSystem.destroy();
    this.spatialGrid.clear();
    this.physicsWorker.destroy();
    this.entities.length = 0;
  }
}

// Example usage:
// const physicsDemo = new PhysicsIntegrationExample();
// physicsDemo.createTestScene();
// 
// // In game loop:
// physicsDemo.update(deltaTime, cameraPosition);
// 
// // Handle input:
// physicsDemo.jumpPlayer(playerEntity);
// physicsDemo.steerPlayer(playerEntity, -0.5); // Steer left

export default PhysicsIntegrationExample;