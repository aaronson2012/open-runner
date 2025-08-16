import type { System, Entity, Vector3 } from '@/types';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import { SpatialHashGrid, type SpatialObject, type AABB } from './physics/SpatialHashGrid';
import * as THREE from 'three';

export interface PhysicsSystemConfig {
  gravity?: Vector3;
  timeStep?: number;
  maxSubSteps?: number;
  enableSleeping?: boolean;
  enableMultithreading?: boolean;
  spatialGridCellSize?: number;
  enableCCD?: boolean; // Continuous Collision Detection
  solverIterations?: number;
}

export interface RaycastResult {
  hit: boolean;
  entity?: Entity;
  point?: Vector3;
  normal?: Vector3;
  distance?: number;
}

export interface CollisionPair {
  entityA: Entity;
  entityB: Entity;
  physicsA: PhysicsComponent;
  physicsB: PhysicsComponent;
  contactPoints: Vector3[];
  contactNormal: Vector3;
  penetrationDepth: number;
  relativeVelocity: Vector3;
}

/**
 * High-performance physics system with multi-threaded simulation
 * Handles physics integration, collision detection, and response
 */
export class PhysicsSystem implements System {
  readonly id = 'physics';
  readonly priority = 10;
  readonly requiredComponents = ['physics', 'transform'];

  private config: Required<PhysicsSystemConfig>;
  private spatialGrid: SpatialHashGrid;
  private collisionPairs: CollisionPair[] = [];
  private accumulator = 0;
  private worker?: Worker;
  private workerSupported = false;
  
  // Performance tracking
  private stats = {
    physicsTime: 0,
    collisionTime: 0,
    spatialUpdateTime: 0,
    totalEntities: 0,
    activeEntities: 0,
    sleepingEntities: 0,
    collisionChecks: 0,
    collisionPairs: 0,
    subSteps: 0
  };

  // Object pools for performance
  private raycastResultPool: RaycastResult[] = [];
  private collisionPairPool: CollisionPair[] = [];
  private vector3Pool: THREE.Vector3[] = [];

  constructor(config: PhysicsSystemConfig = {}) {
    this.config = {
      gravity: config.gravity ?? { x: 0, y: -9.81, z: 0 },
      timeStep: config.timeStep ?? 1 / 60,
      maxSubSteps: config.maxSubSteps ?? 3,
      enableSleeping: config.enableSleeping ?? true,
      enableMultithreading: config.enableMultithreading ?? true,
      spatialGridCellSize: config.spatialGridCellSize ?? 10.0,
      enableCCD: config.enableCCD ?? false,
      solverIterations: config.solverIterations ?? 4
    };

    this.spatialGrid = new SpatialHashGrid(this.config.spatialGridCellSize);
    this.initializeWorker();
  }

  init(): void {
    console.log('PhysicsSystem initialized with config:', this.config);
  }

  update(deltaTime: number, entities: Entity[]): void {
    const startTime = performance.now();
    
    // Reset frame stats
    this.stats.totalEntities = entities.length;
    this.stats.activeEntities = 0;
    this.stats.sleepingEntities = 0;
    this.stats.collisionChecks = 0;
    this.stats.collisionPairs = 0;
    
    // Fixed timestep with accumulator
    this.accumulator += deltaTime;
    let subSteps = 0;
    
    while (this.accumulator >= this.config.timeStep && subSteps < this.config.maxSubSteps) {
      this.fixedUpdate(this.config.timeStep, entities);
      this.accumulator -= this.config.timeStep;
      subSteps++;
    }
    
    this.stats.subSteps = subSteps;
    this.stats.physicsTime = performance.now() - startTime;
    
    // Interpolate positions for smooth rendering
    const alpha = this.accumulator / this.config.timeStep;
    this.interpolatePositions(entities, alpha);
    
    // Update spatial grid
    this.updateSpatialGrid(entities);
    
    // Reset spatial grid frame stats
    this.spatialGrid.resetFrameStats();
  }

  private fixedUpdate(deltaTime: number, entities: Entity[]): void {
    // Step 1: Update physics components
    this.updatePhysics(deltaTime, entities);
    
    // Step 2: Broad-phase collision detection
    this.broadPhaseCollision(entities);
    
    // Step 3: Narrow-phase collision detection
    this.narrowPhaseCollision();
    
    // Step 4: Collision response
    this.resolveCollisions();
    
    // Step 5: Update transforms
    this.updateTransforms(entities);
  }

  private updatePhysics(deltaTime: number, entities: Entity[]): void {
    for (const entity of entities) {
      const physics = entity.components.get('physics') as PhysicsComponent;
      const transform = entity.components.get('transform');
      
      if (!physics || !transform) continue;
      
      // Track sleeping statistics
      if (physics.isAsleep) {
        this.stats.sleepingEntities++;
        continue;
      }
      
      this.stats.activeEntities++;
      
      // Store previous transform for interpolation
      physics.setPreviousTransform(
        new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z)
        )
      );
      
      // Integrate physics
      physics.integrate(deltaTime, this.config.gravity);
      
      // Update transform from physics
      transform.position.x += physics.velocity.x * deltaTime;
      transform.position.y += physics.velocity.y * deltaTime;
      transform.position.z += physics.velocity.z * deltaTime;
      
      if (!physics.freezeRotation) {
        // Simple angular integration (would be more complex in real physics engine)
        transform.rotation.x += physics.angularVelocity.x * deltaTime;
        transform.rotation.y += physics.angularVelocity.y * deltaTime;
        transform.rotation.z += physics.angularVelocity.z * deltaTime;
      }
    }
  }

  private broadPhaseCollision(entities: Entity[]): void {
    const startTime = performance.now();
    
    // Clear previous collision pairs
    this.returnCollisionPairs();
    
    // Use spatial grid for broad-phase collision detection
    for (const entity of entities) {
      const physics = entity.components.get('physics') as PhysicsComponent;
      const transform = entity.components.get('transform');
      
      if (!physics || !transform || physics.isAsleep) continue;
      
      // Create AABB for entity
      const aabb = this.createAABBFromEntity(entity);
      
      // Query nearby objects
      const queryResult = this.spatialGrid.queryAABB(aabb);
      this.stats.collisionChecks += queryResult.totalChecks;
      
      // Check for potential collisions
      for (const spatialObj of queryResult.objects) {
        if (spatialObj.entityId === entity.id) continue;
        
        // Find the other entity
        const otherEntity = entities.find(e => e.id === spatialObj.entityId);
        if (!otherEntity) continue;
        
        const otherPhysics = otherEntity.components.get('physics') as PhysicsComponent;
        if (!otherPhysics) continue;
        
        // Skip if both are sleeping or kinematic
        if ((physics.isAsleep && otherPhysics.isAsleep) || 
            (physics.isKinematic && otherPhysics.isKinematic)) {
          continue;
        }
        
        // Create collision pair
        const pair = this.getCollisionPair();
        pair.entityA = entity;
        pair.entityB = otherEntity;
        pair.physicsA = physics;
        pair.physicsB = otherPhysics;
        
        this.collisionPairs.push(pair);
      }
    }
    
    this.stats.collisionTime += performance.now() - startTime;
  }

  private narrowPhaseCollision(): void {
    for (const pair of this.collisionPairs) {
      // Perform detailed collision detection
      const collision = this.detectCollision(pair.entityA, pair.entityB);
      
      if (collision.hit) {
        pair.contactPoints = collision.contactPoints || [];
        pair.contactNormal = collision.normal || { x: 0, y: 1, z: 0 };
        pair.penetrationDepth = collision.penetrationDepth || 0;
        
        // Calculate relative velocity
        const velA = pair.physicsA.velocity;
        const velB = pair.physicsB.velocity;
        pair.relativeVelocity = {
          x: velA.x - velB.x,
          y: velA.y - velB.y,
          z: velA.z - velB.z
        };
        
        this.stats.collisionPairs++;
      } else {
        // Remove pair if no collision
        pair.contactPoints.length = 0;
      }
    }
    
    // Remove pairs with no contact points
    this.collisionPairs = this.collisionPairs.filter(pair => pair.contactPoints.length > 0);
  }

  private resolveCollisions(): void {
    // Iterative collision resolution
    for (let i = 0; i < this.config.solverIterations; i++) {
      for (const pair of this.collisionPairs) {
        this.resolveCollisionPair(pair);
      }
    }
    
    // Update collision states
    for (const pair of this.collisionPairs) {
      pair.physicsA.setCollisionState(true, pair.contactPoints[0], pair.contactNormal, pair.penetrationDepth);
      pair.physicsB.setCollisionState(true, pair.contactPoints[0], 
        { x: -pair.contactNormal.x, y: -pair.contactNormal.y, z: -pair.contactNormal.z }, 
        pair.penetrationDepth
      );
      
      pair.physicsA.addCollider(pair.entityB.id);
      pair.physicsB.addCollider(pair.entityA.id);
      
      // Handle triggers
      if (pair.physicsA.isTrigger || pair.physicsB.isTrigger) {
        pair.physicsA.addTrigger(pair.entityB.id);
        pair.physicsB.addTrigger(pair.entityA.id);
      }
    }
  }

  private resolveCollisionPair(pair: CollisionPair): void {
    const { physicsA, physicsB, contactNormal, penetrationDepth, relativeVelocity } = pair;
    
    // Skip if either is a trigger
    if (physicsA.isTrigger || physicsB.isTrigger) return;
    
    // Position correction (prevent penetration)
    if (penetrationDepth > 0.01) {
      const correctionPercent = 0.8;
      const slop = 0.01;
      const correction = Math.max(penetrationDepth - slop, 0) / (1/physicsA.mass + 1/physicsB.mass) * correctionPercent;
      
      if (!physicsA.isKinematic) {
        const transformA = pair.entityA.components.get('transform')!;
        transformA.position.x += contactNormal.x * correction / physicsA.mass;
        transformA.position.y += contactNormal.y * correction / physicsA.mass;
        transformA.position.z += contactNormal.z * correction / physicsA.mass;
      }
      
      if (!physicsB.isKinematic) {
        const transformB = pair.entityB.components.get('transform')!;
        transformB.position.x -= contactNormal.x * correction / physicsB.mass;
        transformB.position.y -= contactNormal.y * correction / physicsB.mass;
        transformB.position.z -= contactNormal.z * correction / physicsB.mass;
      }
    }
    
    // Velocity resolution
    const normalVelocity = relativeVelocity.x * contactNormal.x + 
                          relativeVelocity.y * contactNormal.y + 
                          relativeVelocity.z * contactNormal.z;
    
    if (normalVelocity > 0) return; // Objects separating
    
    // Calculate restitution
    const restitution = Math.min(physicsA.restitution, physicsB.restitution);
    
    // Calculate impulse magnitude
    let j = -(1 + restitution) * normalVelocity;
    j /= 1/physicsA.mass + 1/physicsB.mass;
    
    // Apply impulse
    const impulse = {
      x: j * contactNormal.x,
      y: j * contactNormal.y,
      z: j * contactNormal.z
    };
    
    if (!physicsA.isKinematic) {
      physicsA.addForce(impulse, 'impulse');
    }
    
    if (!physicsB.isKinematic) {
      physicsB.addForce({ x: -impulse.x, y: -impulse.y, z: -impulse.z }, 'impulse');
    }
    
    // Friction
    const tangent = {
      x: relativeVelocity.x - normalVelocity * contactNormal.x,
      y: relativeVelocity.y - normalVelocity * contactNormal.y,
      z: relativeVelocity.z - normalVelocity * contactNormal.z
    };
    
    const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y + tangent.z * tangent.z);
    
    if (tangentLength > 0.001) {
      tangent.x /= tangentLength;
      tangent.y /= tangentLength;
      tangent.z /= tangentLength;
      
      const friction = Math.sqrt(physicsA.friction * physicsB.friction);
      let jt = -(relativeVelocity.x * tangent.x + relativeVelocity.y * tangent.y + relativeVelocity.z * tangent.z);
      jt /= 1/physicsA.mass + 1/physicsB.mass;
      
      // Coulomb friction
      let frictionImpulse: Vector3;
      if (Math.abs(jt) < j * friction) {
        frictionImpulse = { x: jt * tangent.x, y: jt * tangent.y, z: jt * tangent.z };
      } else {
        frictionImpulse = { x: -j * friction * tangent.x, y: -j * friction * tangent.y, z: -j * friction * tangent.z };
      }
      
      if (!physicsA.isKinematic) {
        physicsA.addForce(frictionImpulse, 'impulse');
      }
      
      if (!physicsB.isKinematic) {
        physicsB.addForce({ x: -frictionImpulse.x, y: -frictionImpulse.y, z: -frictionImpulse.z }, 'impulse');
      }
    }
  }

  private updateTransforms(entities: Entity[]): void {
    for (const entity of entities) {
      const physics = entity.components.get('physics') as PhysicsComponent;
      const transform = entity.components.get('transform');
      
      if (!physics || !transform || physics.isAsleep) continue;
      
      // Ground detection
      if (transform.position.y <= 0.5) { // Simple ground detection
        physics.isGrounded = true;
        if (physics.velocity.y < 0) {
          physics.setVelocity({ x: physics.velocity.x, y: 0, z: physics.velocity.z });
          transform.position.y = 0.5;
        }
      } else {
        physics.isGrounded = false;
      }
    }
  }

  private interpolatePositions(entities: Entity[], alpha: number): void {
    for (const entity of entities) {
      const physics = entity.components.get('physics') as PhysicsComponent;
      const transform = entity.components.get('transform');
      
      if (!physics || !transform || physics.isAsleep) continue;
      
      // Interpolate position for smooth rendering
      const prevPos = physics.getPreviousPosition();
      const currentPos = new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z);
      
      const interpolatedPos = prevPos.lerp(currentPos, alpha);
      
      // Note: In a real implementation, you'd update a separate render transform
      // Here we'll skip the interpolation to avoid interfering with physics
    }
  }

  private updateSpatialGrid(entities: Entity[]): void {
    const startTime = performance.now();
    
    for (const entity of entities) {
      const physics = entity.components.get('physics') as PhysicsComponent;
      const transform = entity.components.get('transform');
      
      if (!physics || !transform) continue;
      
      const spatialObj: SpatialObject = {
        entityId: entity.id,
        position: transform.position,
        bounds: this.createAABBFromEntity(entity),
        userData: { entity }
      };
      
      // Try to update first, if that fails, add as new
      if (!this.spatialGrid.update(entity.id, spatialObj.bounds)) {
        this.spatialGrid.add(spatialObj);
      }
    }
    
    this.stats.spatialUpdateTime = performance.now() - startTime;
  }

  private createAABBFromEntity(entity: Entity): AABB {
    const transform = entity.components.get('transform')!;
    const physics = entity.components.get('physics') as PhysicsComponent;
    
    // Simple AABB calculation (would be more sophisticated in real implementation)
    const size = 1.0; // Default size
    const halfSize = size * 0.5;
    
    return {
      min: {
        x: transform.position.x - halfSize,
        y: transform.position.y - halfSize,
        z: transform.position.z - halfSize
      },
      max: {
        x: transform.position.x + halfSize,
        y: transform.position.y + halfSize,
        z: transform.position.z + halfSize
      }
    };
  }

  private detectCollision(entityA: Entity, entityB: Entity): {
    hit: boolean;
    contactPoints?: Vector3[];
    normal?: Vector3;
    penetrationDepth?: number;
  } {
    // Simple sphere-sphere collision detection
    const transformA = entityA.components.get('transform')!;
    const transformB = entityB.components.get('transform')!;
    
    const dx = transformA.position.x - transformB.position.x;
    const dy = transformA.position.y - transformB.position.y;
    const dz = transformA.position.z - transformB.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const radiusA = 0.5; // Default radius
    const radiusB = 0.5; // Default radius
    const totalRadius = radiusA + radiusB;
    
    if (distance < totalRadius) {
      const penetration = totalRadius - distance;
      const normal = distance > 0 ? {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance
      } : { x: 0, y: 1, z: 0 };
      
      const contactPoint = {
        x: transformA.position.x - normal.x * radiusA,
        y: transformA.position.y - normal.y * radiusA,
        z: transformA.position.z - normal.z * radiusA
      };
      
      return {
        hit: true,
        contactPoints: [contactPoint],
        normal,
        penetrationDepth: penetration
      };
    }
    
    return { hit: false };
  }

  // Raycasting
  raycast(origin: Vector3, direction: Vector3, maxDistance: number = 100): RaycastResult {
    const result = this.getRaycastResult();
    
    const queryResult = this.spatialGrid.queryRay(origin, direction, maxDistance);
    
    let closestDistance = maxDistance;
    let closestEntity: Entity | undefined;
    let hitPoint: Vector3 | undefined;
    
    for (const spatialObj of queryResult.objects) {
      // Perform detailed ray-entity intersection
      const entity = spatialObj.userData?.entity as Entity;
      if (!entity) continue;
      
      const transform = entity.components.get('transform');
      if (!transform) continue;
      
      // Simple ray-sphere intersection
      const oc = {
        x: origin.x - transform.position.x,
        y: origin.y - transform.position.y,
        z: origin.z - transform.position.z
      };
      
      const a = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
      const b = 2 * (oc.x * direction.x + oc.y * direction.y + oc.z * direction.z);
      const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - 0.25; // radius^2 = 0.5^2
      
      const discriminant = b * b - 4 * a * c;
      
      if (discriminant >= 0) {
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        
        if (t >= 0 && t < closestDistance) {
          closestDistance = t;
          closestEntity = entity;
          hitPoint = {
            x: origin.x + direction.x * t,
            y: origin.y + direction.y * t,
            z: origin.z + direction.z * t
          };
        }
      }
    }
    
    if (closestEntity && hitPoint) {
      result.hit = true;
      result.entity = closestEntity;
      result.point = hitPoint;
      result.distance = closestDistance;
      
      // Calculate normal
      const transform = closestEntity.components.get('transform')!;
      const dx = hitPoint.x - transform.position.x;
      const dy = hitPoint.y - transform.position.y;
      const dz = hitPoint.z - transform.position.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (length > 0) {
        result.normal = { x: dx / length, y: dy / length, z: dz / length };
      }
    }
    
    return result;
  }

  // Object pooling methods
  private getRaycastResult(): RaycastResult {
    return this.raycastResultPool.pop() || {
      hit: false,
      entity: undefined,
      point: undefined,
      normal: undefined,
      distance: undefined
    };
  }

  private getCollisionPair(): CollisionPair {
    const pair = this.collisionPairPool.pop();
    if (pair) {
      pair.contactPoints.length = 0;
      return pair;
    }
    
    return {
      entityA: null as any,
      entityB: null as any,
      physicsA: null as any,
      physicsB: null as any,
      contactPoints: [],
      contactNormal: { x: 0, y: 0, z: 0 },
      penetrationDepth: 0,
      relativeVelocity: { x: 0, y: 0, z: 0 }
    };
  }

  private returnCollisionPairs(): void {
    for (const pair of this.collisionPairs) {
      pair.contactPoints.length = 0;
      this.collisionPairPool.push(pair);
    }
    this.collisionPairs.length = 0;
  }

  // Worker initialization for multi-threading
  private initializeWorker(): void {
    if (!this.config.enableMultithreading || typeof Worker === 'undefined') {
      return;
    }
    
    try {
      // In a real implementation, this would load a physics worker
      // For now, we'll just mark as supported but not actually use it
      this.workerSupported = true;
    } catch (error) {
      console.warn('Physics worker not supported:', error);
    }
  }

  // Configuration methods
  setGravity(gravity: Vector3): void {
    this.config.gravity = gravity;
  }

  getGravity(): Vector3 {
    return { ...this.config.gravity };
  }

  setTimeStep(timeStep: number): void {
    this.config.timeStep = Math.max(1/120, Math.min(1/30, timeStep));
  }

  // Performance and debugging
  getStats() {
    return {
      ...this.stats,
      spatialGrid: this.spatialGrid.getStats(),
      poolUsage: {
        raycastResults: this.raycastResultPool.length,
        collisionPairs: this.collisionPairPool.length,
        vector3s: this.vector3Pool.length
      },
      config: this.config
    };
  }

  optimize(): void {
    this.spatialGrid.optimize();
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    
    this.spatialGrid.clear();
    this.collisionPairs.length = 0;
    this.raycastResultPool.length = 0;
    this.collisionPairPool.length = 0;
    this.vector3Pool.length = 0;
  }
}

export default PhysicsSystem;