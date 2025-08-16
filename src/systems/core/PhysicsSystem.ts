import type { Entity, Vector3 } from '@/types';
import { BaseSystem } from './BaseSystem';
import type { TransformComponent, RigidBodyComponent, ColliderComponent } from '@/components/core/CoreComponents';
import { SpatialHashGrid } from '@/core/ecs/SpatialHashGrid';

interface CollisionInfo {
  entityA: number;
  entityB: number;
  point: Vector3;
  normal: Vector3;
  depth: number;
}

/**
 * Physics system handling rigid body dynamics and collision detection
 */
export class PhysicsSystem extends BaseSystem {
  private gravity: Vector3 = { x: 0, y: -9.81, z: 0 };
  private spatialGrid: SpatialHashGrid;
  private collisions: CollisionInfo[] = [];
  private maxVelocity = 50; // Clamp velocities to prevent instability
  private minMass = 0.001; // Minimum mass to prevent division by zero
  
  // Performance settings
  private enableSleeping = true;
  private sleepThreshold = 0.1; // Velocity below which objects go to sleep
  private sleepTime = 1.0; // Time before sleeping
  
  // Substeps for stability
  private substeps = 4;
  private fixedTimestep = 1 / 60; // 60 Hz physics

  constructor(gravity?: Vector3, cellSize: number = 10) {
    super('physics', ['transform', 'rigidbody'], 10); // Medium priority
    
    if (gravity) {
      this.gravity = { ...gravity };
    }
    
    this.spatialGrid = new SpatialHashGrid(cellSize);
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Clamp deltaTime to prevent instability
    deltaTime = Math.min(deltaTime, 0.033); // Max 33ms (30 FPS minimum)
    
    // Update spatial grid
    this.updateSpatialGrid(entities);
    
    // Physics simulation with substeps
    const substepDelta = deltaTime / this.substeps;
    
    for (let i = 0; i < this.substeps; i++) {
      this.simulatePhysics(entities, substepDelta);
      this.detectCollisions();
      this.resolveCollisions();
    }
    
    // Apply results to transforms
    this.updateTransforms(entities);
  }

  /**
   * Update the spatial partitioning grid
   */
  private updateSpatialGrid(entities: Entity[]): void {
    this.spatialGrid.clear();
    
    for (const entity of entities) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      const collider = this.getComponent<ColliderComponent>(entity, 'collider');
      
      if (transform && collider && collider.enabled) {
        const bounds = this.calculateColliderBounds(transform, collider);
        this.spatialGrid.insert(entity.id, bounds);
      }
    }
  }

  /**
   * Calculate bounding box for a collider
   */
  private calculateColliderBounds(transform: TransformComponent, collider: ColliderComponent) {
    const pos = transform.position;
    const size = collider.size;
    const center = collider.center;
    
    // Apply center offset
    const worldCenter = {
      x: pos.x + center.x,
      y: pos.y + center.y,
      z: pos.z + center.z
    };
    
    // Calculate half extents based on shape
    let halfExtents: Vector3;
    
    switch (collider.shape) {
      case 'sphere':
        const radius = Math.max(size.x, size.y, size.z) * 0.5;
        halfExtents = { x: radius, y: radius, z: radius };
        break;
      case 'capsule':
        const capRadius = Math.max(size.x, size.z) * 0.5;
        const capHeight = size.y * 0.5;
        halfExtents = { x: capRadius, y: capHeight, z: capRadius };
        break;
      default: // box and others
        halfExtents = {
          x: size.x * 0.5,
          y: size.y * 0.5,
          z: size.z * 0.5
        };
        break;
    }
    
    return {
      min: {
        x: worldCenter.x - halfExtents.x,
        y: worldCenter.y - halfExtents.y,
        z: worldCenter.z - halfExtents.z
      },
      max: {
        x: worldCenter.x + halfExtents.x,
        y: worldCenter.y + halfExtents.y,
        z: worldCenter.z + halfExtents.z
      }
    };
  }

  /**
   * Simulate physics for all entities
   */
  private simulatePhysics(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const rigidBody = this.getComponent<RigidBodyComponent>(entity, 'rigidbody')!;
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      
      if (!transform || rigidBody.isStatic) continue;
      
      // Skip if sleeping
      if (rigidBody.isSleeping && this.enableSleeping) continue;
      
      // Apply gravity
      if (rigidBody.useGravity && !rigidBody.isKinematic) {
        rigidBody.force.x += rigidBody.mass * this.gravity.x * rigidBody.gravityScale;
        rigidBody.force.y += rigidBody.mass * this.gravity.y * rigidBody.gravityScale;
        rigidBody.force.z += rigidBody.mass * this.gravity.z * rigidBody.gravityScale;
      }
      
      // Apply forces to acceleration (F = ma -> a = F/m)
      if (!rigidBody.isKinematic && rigidBody.mass > 0) {
        const invMass = rigidBody.inverseMass;
        rigidBody.acceleration.x = rigidBody.force.x * invMass;
        rigidBody.acceleration.y = rigidBody.force.y * invMass;
        rigidBody.acceleration.z = rigidBody.force.z * invMass;
      }
      
      // Integrate velocity
      rigidBody.velocity.x += rigidBody.acceleration.x * deltaTime;
      rigidBody.velocity.y += rigidBody.acceleration.y * deltaTime;
      rigidBody.velocity.z += rigidBody.acceleration.z * deltaTime;
      
      // Apply damping
      const linearDamping = Math.pow(1 - rigidBody.linearDamping, deltaTime);
      rigidBody.velocity.x *= linearDamping;
      rigidBody.velocity.y *= linearDamping;
      rigidBody.velocity.z *= linearDamping;
      
      // Clamp velocity
      const speed = Math.sqrt(
        rigidBody.velocity.x * rigidBody.velocity.x +
        rigidBody.velocity.y * rigidBody.velocity.y +
        rigidBody.velocity.z * rigidBody.velocity.z
      );
      
      if (speed > this.maxVelocity) {
        const scale = this.maxVelocity / speed;
        rigidBody.velocity.x *= scale;
        rigidBody.velocity.y *= scale;
        rigidBody.velocity.z *= scale;
      }
      
      // Apply position constraints
      if (rigidBody.lockPositionX) rigidBody.velocity.x = 0;
      if (rigidBody.lockPositionY) rigidBody.velocity.y = 0;
      if (rigidBody.lockPositionZ) rigidBody.velocity.z = 0;
      
      // Integrate position
      if (!rigidBody.lockPositionX) {
        transform.position.x += rigidBody.velocity.x * deltaTime;
      }
      if (!rigidBody.lockPositionY) {
        transform.position.y += rigidBody.velocity.y * deltaTime;
      }
      if (!rigidBody.lockPositionZ) {
        transform.position.z += rigidBody.velocity.z * deltaTime;
      }
      
      // Angular integration (simplified)
      if (!rigidBody.lockRotationX) {
        transform.rotation.x += rigidBody.angularVelocity.x * deltaTime;
      }
      if (!rigidBody.lockRotationY) {
        transform.rotation.y += rigidBody.angularVelocity.y * deltaTime;
      }
      if (!rigidBody.lockRotationZ) {
        transform.rotation.z += rigidBody.angularVelocity.z * deltaTime;
      }
      
      // Apply angular damping
      const angularDamping = Math.pow(1 - rigidBody.angularDamping, deltaTime);
      rigidBody.angularVelocity.x *= angularDamping;
      rigidBody.angularVelocity.y *= angularDamping;
      rigidBody.angularVelocity.z *= angularDamping;
      
      // Clear forces for next frame
      rigidBody.force.x = 0;
      rigidBody.force.y = 0;
      rigidBody.force.z = 0;
      
      rigidBody.torque.x = 0;
      rigidBody.torque.y = 0;
      rigidBody.torque.z = 0;
      
      // Check for sleeping
      if (this.enableSleeping && this.shouldSleep(rigidBody)) {
        rigidBody.isSleeping = true;
      }
      
      // Mark transform as dirty
      transform.isDirty = true;
    }
  }

  /**
   * Detect collisions using spatial partitioning
   */
  private detectCollisions(): void {
    this.collisions = [];
    const pairs = this.spatialGrid.getCollisionPairs();
    
    for (const [entityA, entityB] of pairs) {
      if (!this.world) continue;
      
      const entityAObj = this.world.getEntity(entityA);
      const entityBObj = this.world.getEntity(entityB);
      
      if (!entityAObj || !entityBObj) continue;
      
      const colliderA = this.getComponent<ColliderComponent>(entityAObj, 'collider');
      const colliderB = this.getComponent<ColliderComponent>(entityBObj, 'collider');
      
      if (!colliderA?.enabled || !colliderB?.enabled) continue;
      
      // Check layer collision mask
      if ((colliderA.mask & (1 << colliderB.layer)) === 0) continue;
      
      const transformA = this.getComponent<TransformComponent>(entityAObj, 'transform');
      const transformB = this.getComponent<TransformComponent>(entityBObj, 'transform');
      
      if (!transformA || !transformB) continue;
      
      const collision = this.checkCollision(transformA, colliderA, transformB, colliderB);
      if (collision) {
        this.collisions.push({
          entityA,
          entityB,
          ...collision
        });
      }
    }
  }

  /**
   * Check collision between two colliders
   */
  private checkCollision(
    transformA: TransformComponent,
    colliderA: ColliderComponent,
    transformB: TransformComponent,
    colliderB: ColliderComponent
  ): { point: Vector3; normal: Vector3; depth: number } | null {
    
    // For simplicity, implement box-box collision
    // In a full implementation, you'd have shape-specific collision functions
    if (colliderA.shape === 'box' && colliderB.shape === 'box') {
      return this.checkBoxBoxCollision(transformA, colliderA, transformB, colliderB);
    }
    
    if (colliderA.shape === 'sphere' && colliderB.shape === 'sphere') {
      return this.checkSphereSphereCollision(transformA, colliderA, transformB, colliderB);
    }
    
    if ((colliderA.shape === 'box' && colliderB.shape === 'sphere') ||
        (colliderA.shape === 'sphere' && colliderB.shape === 'box')) {
      return this.checkBoxSphereCollision(transformA, colliderA, transformB, colliderB);
    }
    
    return null;
  }

  /**
   * Box-box collision detection
   */
  private checkBoxBoxCollision(
    transformA: TransformComponent,
    colliderA: ColliderComponent,
    transformB: TransformComponent,
    colliderB: ColliderComponent
  ): { point: Vector3; normal: Vector3; depth: number } | null {
    
    const centerA = {
      x: transformA.position.x + colliderA.center.x,
      y: transformA.position.y + colliderA.center.y,
      z: transformA.position.z + colliderA.center.z
    };
    
    const centerB = {
      x: transformB.position.x + colliderB.center.x,
      y: transformB.position.y + colliderB.center.y,
      z: transformB.position.z + colliderB.center.z
    };
    
    const halfExtentsA = {
      x: colliderA.size.x * 0.5,
      y: colliderA.size.y * 0.5,
      z: colliderA.size.z * 0.5
    };
    
    const halfExtentsB = {
      x: colliderB.size.x * 0.5,
      y: colliderB.size.y * 0.5,
      z: colliderB.size.z * 0.5
    };
    
    const distance = {
      x: Math.abs(centerA.x - centerB.x),
      y: Math.abs(centerA.y - centerB.y),
      z: Math.abs(centerA.z - centerB.z)
    };
    
    const overlap = {
      x: halfExtentsA.x + halfExtentsB.x - distance.x,
      y: halfExtentsA.y + halfExtentsB.y - distance.y,
      z: halfExtentsA.z + halfExtentsB.z - distance.z
    };
    
    // Check if there's an overlap on all axes
    if (overlap.x <= 0 || overlap.y <= 0 || overlap.z <= 0) {
      return null; // No collision
    }
    
    // Find the axis with minimum overlap (collision normal)
    let minOverlap = overlap.x;
    let normal = { x: centerA.x > centerB.x ? 1 : -1, y: 0, z: 0 };
    
    if (overlap.y < minOverlap) {
      minOverlap = overlap.y;
      normal = { x: 0, y: centerA.y > centerB.y ? 1 : -1, z: 0 };
    }
    
    if (overlap.z < minOverlap) {
      minOverlap = overlap.z;
      normal = { x: 0, y: 0, z: centerA.z > centerB.z ? 1 : -1 };
    }
    
    // Calculate contact point (simplified)
    const contactPoint = {
      x: (centerA.x + centerB.x) * 0.5,
      y: (centerA.y + centerB.y) * 0.5,
      z: (centerA.z + centerB.z) * 0.5
    };
    
    return {
      point: contactPoint,
      normal,
      depth: minOverlap
    };
  }

  /**
   * Sphere-sphere collision detection
   */
  private checkSphereSphereCollision(
    transformA: TransformComponent,
    colliderA: ColliderComponent,
    transformB: TransformComponent,
    colliderB: ColliderComponent
  ): { point: Vector3; normal: Vector3; depth: number } | null {
    
    const centerA = {
      x: transformA.position.x + colliderA.center.x,
      y: transformA.position.y + colliderA.center.y,
      z: transformA.position.z + colliderA.center.z
    };
    
    const centerB = {
      x: transformB.position.x + colliderB.center.x,
      y: transformB.position.y + colliderB.center.y,
      z: transformB.position.z + colliderB.center.z
    };
    
    const radiusA = Math.max(colliderA.size.x, colliderA.size.y, colliderA.size.z) * 0.5;
    const radiusB = Math.max(colliderB.size.x, colliderB.size.y, colliderB.size.z) * 0.5;
    
    const distance = Math.sqrt(
      (centerA.x - centerB.x) * (centerA.x - centerB.x) +
      (centerA.y - centerB.y) * (centerA.y - centerB.y) +
      (centerA.z - centerB.z) * (centerA.z - centerB.z)
    );
    
    const totalRadius = radiusA + radiusB;
    
    if (distance >= totalRadius) {
      return null; // No collision
    }
    
    const depth = totalRadius - distance;
    
    // Avoid division by zero
    let normal: Vector3;
    if (distance > 0.001) {
      const invDistance = 1 / distance;
      normal = {
        x: (centerA.x - centerB.x) * invDistance,
        y: (centerA.y - centerB.y) * invDistance,
        z: (centerA.z - centerB.z) * invDistance
      };
    } else {
      normal = { x: 1, y: 0, z: 0 }; // Default normal
    }
    
    const contactPoint = {
      x: centerB.x + normal.x * radiusB,
      y: centerB.y + normal.y * radiusB,
      z: centerB.z + normal.z * radiusB
    };
    
    return {
      point: contactPoint,
      normal,
      depth
    };
  }

  /**
   * Box-sphere collision detection
   */
  private checkBoxSphereCollision(
    transformA: TransformComponent,
    colliderA: ColliderComponent,
    transformB: TransformComponent,
    colliderB: ColliderComponent
  ): { point: Vector3; normal: Vector3; depth: number } | null {
    
    // Determine which is box and which is sphere
    let boxTransform, boxCollider, sphereTransform, sphereCollider;
    
    if (colliderA.shape === 'box') {
      boxTransform = transformA;
      boxCollider = colliderA;
      sphereTransform = transformB;
      sphereCollider = colliderB;
    } else {
      boxTransform = transformB;
      boxCollider = colliderB;
      sphereTransform = transformA;
      sphereCollider = colliderA;
    }
    
    const boxCenter = {
      x: boxTransform.position.x + boxCollider.center.x,
      y: boxTransform.position.y + boxCollider.center.y,
      z: boxTransform.position.z + boxCollider.center.z
    };
    
    const sphereCenter = {
      x: sphereTransform.position.x + sphereCollider.center.x,
      y: sphereTransform.position.y + sphereCollider.center.y,
      z: sphereTransform.position.z + sphereCollider.center.z
    };
    
    const halfExtents = {
      x: boxCollider.size.x * 0.5,
      y: boxCollider.size.y * 0.5,
      z: boxCollider.size.z * 0.5
    };
    
    const radius = Math.max(sphereCollider.size.x, sphereCollider.size.y, sphereCollider.size.z) * 0.5;
    
    // Find closest point on box to sphere center
    const closestPoint = {
      x: Math.max(boxCenter.x - halfExtents.x, Math.min(sphereCenter.x, boxCenter.x + halfExtents.x)),
      y: Math.max(boxCenter.y - halfExtents.y, Math.min(sphereCenter.y, boxCenter.y + halfExtents.y)),
      z: Math.max(boxCenter.z - halfExtents.z, Math.min(sphereCenter.z, boxCenter.z + halfExtents.z))
    };
    
    const distance = Math.sqrt(
      (sphereCenter.x - closestPoint.x) * (sphereCenter.x - closestPoint.x) +
      (sphereCenter.y - closestPoint.y) * (sphereCenter.y - closestPoint.y) +
      (sphereCenter.z - closestPoint.z) * (sphereCenter.z - closestPoint.z)
    );
    
    if (distance >= radius) {
      return null; // No collision
    }
    
    const depth = radius - distance;
    
    let normal: Vector3;
    if (distance > 0.001) {
      const invDistance = 1 / distance;
      normal = {
        x: (sphereCenter.x - closestPoint.x) * invDistance,
        y: (sphereCenter.y - closestPoint.y) * invDistance,
        z: (sphereCenter.z - closestPoint.z) * invDistance
      };
    } else {
      // Sphere center is inside box, find closest face
      const distances = [
        Math.abs(sphereCenter.x - (boxCenter.x - halfExtents.x)),
        Math.abs(sphereCenter.x - (boxCenter.x + halfExtents.x)),
        Math.abs(sphereCenter.y - (boxCenter.y - halfExtents.y)),
        Math.abs(sphereCenter.y - (boxCenter.y + halfExtents.y)),
        Math.abs(sphereCenter.z - (boxCenter.z - halfExtents.z)),
        Math.abs(sphereCenter.z - (boxCenter.z + halfExtents.z))
      ];
      
      const minIndex = distances.indexOf(Math.min(...distances));
      
      switch (minIndex) {
        case 0: normal = { x: -1, y: 0, z: 0 }; break;
        case 1: normal = { x: 1, y: 0, z: 0 }; break;
        case 2: normal = { x: 0, y: -1, z: 0 }; break;
        case 3: normal = { x: 0, y: 1, z: 0 }; break;
        case 4: normal = { x: 0, y: 0, z: -1 }; break;
        case 5: normal = { x: 0, y: 0, z: 1 }; break;
        default: normal = { x: 1, y: 0, z: 0 }; break;
      }
    }
    
    return {
      point: closestPoint,
      normal,
      depth
    };
  }

  /**
   * Resolve all detected collisions
   */
  private resolveCollisions(): void {
    for (const collision of this.collisions) {
      if (!this.world) continue;
      
      const entityA = this.world.getEntity(collision.entityA);
      const entityB = this.world.getEntity(collision.entityB);
      
      if (!entityA || !entityB) continue;
      
      const rigidBodyA = this.getComponent<RigidBodyComponent>(entityA, 'rigidbody');
      const rigidBodyB = this.getComponent<RigidBodyComponent>(entityB, 'rigidbody');
      const colliderA = this.getComponent<ColliderComponent>(entityA, 'collider');
      const colliderB = this.getComponent<ColliderComponent>(entityB, 'collider');
      
      if (!rigidBodyA || !rigidBodyB || !colliderA || !colliderB) continue;
      
      // Skip if either is a trigger
      if (colliderA.isTrigger || colliderB.isTrigger) {
        // TODO: Fire trigger events
        continue;
      }
      
      this.resolveCollision(rigidBodyA, rigidBodyB, collision, colliderA, colliderB);
    }
  }

  /**
   * Resolve a single collision
   */
  private resolveCollision(
    rigidBodyA: RigidBodyComponent,
    rigidBodyB: RigidBodyComponent,
    collision: CollisionInfo,
    colliderA: ColliderComponent,
    colliderB: ColliderComponent
  ): void {
    
    // Skip static-static collisions
    if (rigidBodyA.isStatic && rigidBodyB.isStatic) return;
    
    // Wake up sleeping bodies
    rigidBodyA.isSleeping = false;
    rigidBodyB.isSleeping = false;
    
    // Calculate relative velocity
    const relativeVelocity = {
      x: rigidBodyA.velocity.x - rigidBodyB.velocity.x,
      y: rigidBodyA.velocity.y - rigidBodyB.velocity.y,
      z: rigidBodyA.velocity.z - rigidBodyB.velocity.z
    };
    
    // Calculate relative velocity in collision normal direction
    const velAlongNormal = 
      relativeVelocity.x * collision.normal.x +
      relativeVelocity.y * collision.normal.y +
      relativeVelocity.z * collision.normal.z;
    
    // Don't resolve if velocities are separating
    if (velAlongNormal > 0) return;
    
    // Calculate restitution
    const restitution = Math.max(
      colliderA.restitution ?? rigidBodyA.restitution,
      colliderB.restitution ?? rigidBodyB.restitution
    );
    
    // Calculate impulse scalar
    let j = -(1 + restitution) * velAlongNormal;
    j /= rigidBodyA.inverseMass + rigidBodyB.inverseMass;
    
    // Apply impulse
    const impulse = {
      x: j * collision.normal.x,
      y: j * collision.normal.y,
      z: j * collision.normal.z
    };
    
    if (!rigidBodyA.isStatic && !rigidBodyA.isKinematic) {
      rigidBodyA.velocity.x += impulse.x * rigidBodyA.inverseMass;
      rigidBodyA.velocity.y += impulse.y * rigidBodyA.inverseMass;
      rigidBodyA.velocity.z += impulse.z * rigidBodyA.inverseMass;
    }
    
    if (!rigidBodyB.isStatic && !rigidBodyB.isKinematic) {
      rigidBodyB.velocity.x -= impulse.x * rigidBodyB.inverseMass;
      rigidBodyB.velocity.y -= impulse.y * rigidBodyB.inverseMass;
      rigidBodyB.velocity.z -= impulse.z * rigidBodyB.inverseMass;
    }
    
    // Position correction to prevent sinking
    const percent = 0.8; // Usually 80% to avoid jittering
    const slop = 0.01; // Usually small positive value
    const correctionMagnitude = Math.max(collision.depth - slop, 0) * percent / 
                                (rigidBodyA.inverseMass + rigidBodyB.inverseMass);
    
    const correction = {
      x: correctionMagnitude * collision.normal.x,
      y: correctionMagnitude * collision.normal.y,
      z: correctionMagnitude * collision.normal.z
    };
    
    // Apply position correction to transforms
    if (!rigidBodyA.isStatic && this.world) {
      const transformA = this.getComponent<TransformComponent>(
        this.world.getEntity(collision.entityA)!, 'transform'
      );
      if (transformA) {
        transformA.position.x += correction.x * rigidBodyA.inverseMass;
        transformA.position.y += correction.y * rigidBodyA.inverseMass;
        transformA.position.z += correction.z * rigidBodyA.inverseMass;
        transformA.isDirty = true;
      }
    }
    
    if (!rigidBodyB.isStatic && this.world) {
      const transformB = this.getComponent<TransformComponent>(
        this.world.getEntity(collision.entityB)!, 'transform'
      );
      if (transformB) {
        transformB.position.x -= correction.x * rigidBodyB.inverseMass;
        transformB.position.y -= correction.y * rigidBodyB.inverseMass;
        transformB.position.z -= correction.z * rigidBodyB.inverseMass;
        transformB.isDirty = true;
      }
    }
  }

  /**
   * Update transforms from physics simulation
   */
  private updateTransforms(entities: Entity[]): void {
    for (const entity of entities) {
      const rigidBody = this.getComponent<RigidBodyComponent>(entity, 'rigidbody')!;
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      
      if (transform && !rigidBody.isStatic) {
        // Transform was already updated during integration
        // Just mark it as dirty for rendering system
        transform.isDirty = true;
      }
    }
  }

  /**
   * Check if a rigid body should go to sleep
   */
  private shouldSleep(rigidBody: RigidBodyComponent): boolean {
    if (rigidBody.isStatic || rigidBody.isKinematic) return false;
    
    const velocityMagnitude = Math.sqrt(
      rigidBody.velocity.x * rigidBody.velocity.x +
      rigidBody.velocity.y * rigidBody.velocity.y +
      rigidBody.velocity.z * rigidBody.velocity.z
    );
    
    const angularMagnitude = Math.sqrt(
      rigidBody.angularVelocity.x * rigidBody.angularVelocity.x +
      rigidBody.angularVelocity.y * rigidBody.angularVelocity.y +
      rigidBody.angularVelocity.z * rigidBody.angularVelocity.z
    );
    
    return velocityMagnitude < this.sleepThreshold && angularMagnitude < this.sleepThreshold;
  }

  /**
   * Apply force to a rigid body
   */
  applyForce(entityId: number, force: Vector3, point?: Vector3): void {
    if (!this.world) return;
    
    const entity = this.world.getEntity(entityId);
    if (!entity) return;
    
    const rigidBody = this.getComponent<RigidBodyComponent>(entity, 'rigidbody');
    if (!rigidBody || rigidBody.isStatic) return;
    
    rigidBody.force.x += force.x;
    rigidBody.force.y += force.y;
    rigidBody.force.z += force.z;
    
    // Wake up the body
    rigidBody.isSleeping = false;
    
    // Apply torque if point is specified
    if (point) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      if (transform) {
        const r = {
          x: point.x - transform.position.x,
          y: point.y - transform.position.y,
          z: point.z - transform.position.z
        };
        
        // Calculate torque = r × F
        rigidBody.torque.x += r.y * force.z - r.z * force.y;
        rigidBody.torque.y += r.z * force.x - r.x * force.z;
        rigidBody.torque.z += r.x * force.y - r.y * force.x;
      }
    }
  }

  /**
   * Apply impulse to a rigid body
   */
  applyImpulse(entityId: number, impulse: Vector3): void {
    if (!this.world) return;
    
    const entity = this.world.getEntity(entityId);
    if (!entity) return;
    
    const rigidBody = this.getComponent<RigidBodyComponent>(entity, 'rigidbody');
    if (!rigidBody || rigidBody.isStatic) return;
    
    rigidBody.velocity.x += impulse.x * rigidBody.inverseMass;
    rigidBody.velocity.y += impulse.y * rigidBody.inverseMass;
    rigidBody.velocity.z += impulse.z * rigidBody.inverseMass;
    
    // Wake up the body
    rigidBody.isSleeping = false;
  }

  /**
   * Set gravity for the physics world
   */
  setGravity(gravity: Vector3): void {
    this.gravity = { ...gravity };
  }

  /**
   * Get physics system debug info
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();
    const spatialStats = this.spatialGrid.getStats();
    
    return {
      ...baseInfo,
      gravity: this.gravity,
      collisionCount: this.collisions.length,
      spatialGrid: spatialStats,
      maxVelocity: this.maxVelocity,
      substeps: this.substeps,
      enableSleeping: this.enableSleeping
    };
  }
}