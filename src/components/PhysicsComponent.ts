import type { Component, EntityId, Vector3 } from '@/types';
import * as THREE from 'three';

export interface PhysicsConfig {
  mass?: number;
  friction?: number;
  restitution?: number;
  drag?: number;
  angularDrag?: number;
  gravityScale?: number;
  isKinematic?: boolean;
  isTrigger?: boolean;
  isGrounded?: boolean;
  useGravity?: boolean;
  freezeRotation?: boolean;
  material?: PhysicsMaterial;
}

export interface PhysicsMaterial {
  name: string;
  friction: number;
  restitution: number;
  density: number;
}

export interface ForceAccumulator {
  force: Vector3;
  torque: Vector3;
  impulse: Vector3;
  angularImpulse: Vector3;
}

export interface PhysicsState {
  velocity: Vector3;
  angularVelocity: Vector3;
  acceleration: Vector3;
  angularAcceleration: Vector3;
  centerOfMass: Vector3;
  inertiaTensor: THREE.Matrix3;
}

export interface CollisionInfo {
  isColliding: boolean;
  contactPoints: Vector3[];
  contactNormals: Vector3[];
  penetrationDepth: number;
  colliderIds: Set<EntityId>;
  triggerIds: Set<EntityId>;
}

/**
 * High-performance physics component with comprehensive simulation capabilities
 */
export class PhysicsComponent implements Component {
  readonly type = 'physics';
  entityId: EntityId;

  // Core physics properties
  private _config: Required<PhysicsConfig>;
  private _state: PhysicsState;
  private _forces: ForceAccumulator;
  private _collision: CollisionInfo;
  
  // Performance optimization
  private _previousPosition: THREE.Vector3;
  private _previousRotation: THREE.Quaternion;
  private _sleepThreshold: number = 0.01;
  private _isAsleep: boolean = false;
  private _sleepTimer: number = 0;
  private _wakeThreshold: number = 0.1;
  
  // Physics materials registry
  private static materials = new Map<string, PhysicsMaterial>([
    ['default', { name: 'default', friction: 0.5, restitution: 0.3, density: 1.0 }],
    ['ice', { name: 'ice', friction: 0.1, restitution: 0.1, density: 0.9 }],
    ['rubber', { name: 'rubber', friction: 0.8, restitution: 0.9, density: 1.2 }],
    ['metal', { name: 'metal', friction: 0.6, restitution: 0.2, density: 7.8 }],
    ['wood', { name: 'wood', friction: 0.7, restitution: 0.4, density: 0.6 }],
    ['stone', { name: 'stone', friction: 0.8, restitution: 0.1, density: 2.5 }]
  ]);

  constructor(entityId: EntityId, config: PhysicsConfig = {}) {
    this.entityId = entityId;
    
    // Initialize configuration with defaults
    this._config = {
      mass: config.mass ?? 1.0,
      friction: config.friction ?? 0.5,
      restitution: config.restitution ?? 0.3,
      drag: config.drag ?? 0.05,
      angularDrag: config.angularDrag ?? 0.1,
      gravityScale: config.gravityScale ?? 1.0,
      isKinematic: config.isKinematic ?? false,
      isTrigger: config.isTrigger ?? false,
      isGrounded: config.isGrounded ?? false,
      useGravity: config.useGravity ?? true,
      freezeRotation: config.freezeRotation ?? false,
      material: config.material ?? PhysicsComponent.materials.get('default')!
    };

    // Initialize physics state
    this._state = {
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      angularAcceleration: { x: 0, y: 0, z: 0 },
      centerOfMass: { x: 0, y: 0, z: 0 },
      inertiaTensor: new THREE.Matrix3().identity()
    };

    // Initialize force accumulator
    this._forces = {
      force: { x: 0, y: 0, z: 0 },
      torque: { x: 0, y: 0, z: 0 },
      impulse: { x: 0, y: 0, z: 0 },
      angularImpulse: { x: 0, y: 0, z: 0 }
    };

    // Initialize collision info
    this._collision = {
      isColliding: false,
      contactPoints: [],
      contactNormals: [],
      penetrationDepth: 0,
      colliderIds: new Set(),
      triggerIds: new Set()
    };

    // Initialize previous state
    this._previousPosition = new THREE.Vector3();
    this._previousRotation = new THREE.Quaternion();

    // Calculate inertia tensor based on mass
    this.updateInertiaTensor();
  }

  // Property getters and setters
  get mass(): number { return this._config.mass; }
  set mass(value: number) {
    this._config.mass = Math.max(0.001, value);
    this.updateInertiaTensor();
    this.wake();
  }

  get friction(): number { return this._config.friction; }
  set friction(value: number) { this._config.friction = Math.max(0, Math.min(1, value)); }

  get restitution(): number { return this._config.restitution; }
  set restitution(value: number) { this._config.restitution = Math.max(0, Math.min(1, value)); }

  get isKinematic(): boolean { return this._config.isKinematic; }
  set isKinematic(value: boolean) { 
    this._config.isKinematic = value;
    if (value) {
      this.clearForces();
      this.clearVelocity();
    }
  }

  get isTrigger(): boolean { return this._config.isTrigger; }
  set isTrigger(value: boolean) { this._config.isTrigger = value; }

  get isGrounded(): boolean { return this._config.isGrounded; }
  set isGrounded(value: boolean) { this._config.isGrounded = value; }

  get useGravity(): boolean { return this._config.useGravity; }
  set useGravity(value: boolean) { this._config.useGravity = value; }

  get velocity(): Vector3 { return { ...this._state.velocity }; }
  get angularVelocity(): Vector3 { return { ...this._state.angularVelocity }; }

  get isAsleep(): boolean { return this._isAsleep; }
  get isColliding(): boolean { return this._collision.isColliding; }
  get contactPoints(): Vector3[] { return [...this._collision.contactPoints]; }
  get contactNormals(): Vector3[] { return [...this._collision.contactNormals]; }
  get colliderIds(): Set<EntityId> { return new Set(this._collision.colliderIds); }
  get triggerIds(): Set<EntityId> { return new Set(this._collision.triggerIds); }

  // Force and impulse methods
  addForce(force: Vector3, forceMode: 'force' | 'impulse' = 'force'): void {
    if (this._config.isKinematic) return;
    
    this.wake();
    
    if (forceMode === 'force') {
      this._forces.force.x += force.x;
      this._forces.force.y += force.y;
      this._forces.force.z += force.z;
    } else {
      this._forces.impulse.x += force.x;
      this._forces.impulse.y += force.y;
      this._forces.impulse.z += force.z;
    }
  }

  addForceAtPosition(force: Vector3, position: Vector3, forceMode: 'force' | 'impulse' = 'force'): void {
    if (this._config.isKinematic) return;
    
    this.wake();
    
    // Add the force
    this.addForce(force, forceMode);
    
    // Calculate torque from force at position
    const relativePos = {
      x: position.x - this._state.centerOfMass.x,
      y: position.y - this._state.centerOfMass.y,
      z: position.z - this._state.centerOfMass.z
    };
    
    const torque = {
      x: relativePos.y * force.z - relativePos.z * force.y,
      y: relativePos.z * force.x - relativePos.x * force.z,
      z: relativePos.x * force.y - relativePos.y * force.x
    };
    
    this.addTorque(torque, forceMode);
  }

  addTorque(torque: Vector3, forceMode: 'force' | 'impulse' = 'force'): void {
    if (this._config.isKinematic || this._config.freezeRotation) return;
    
    this.wake();
    
    if (forceMode === 'force') {
      this._forces.torque.x += torque.x;
      this._forces.torque.y += torque.y;
      this._forces.torque.z += torque.z;
    } else {
      this._forces.angularImpulse.x += torque.x;
      this._forces.angularImpulse.y += torque.y;
      this._forces.angularImpulse.z += torque.z;
    }
  }

  setVelocity(velocity: Vector3): void {
    if (this._config.isKinematic) return;
    
    this._state.velocity = { ...velocity };
    this.wake();
  }

  setAngularVelocity(angularVelocity: Vector3): void {
    if (this._config.isKinematic || this._config.freezeRotation) return;
    
    this._state.angularVelocity = { ...angularVelocity };
    this.wake();
  }

  clearForces(): void {
    this._forces.force = { x: 0, y: 0, z: 0 };
    this._forces.torque = { x: 0, y: 0, z: 0 };
    this._forces.impulse = { x: 0, y: 0, z: 0 };
    this._forces.angularImpulse = { x: 0, y: 0, z: 0 };
  }

  clearVelocity(): void {
    this._state.velocity = { x: 0, y: 0, z: 0 };
    this._state.angularVelocity = { x: 0, y: 0, z: 0 };
  }

  // Collision methods
  setCollisionState(isColliding: boolean, contactPoint?: Vector3, contactNormal?: Vector3, penetration?: number): void {
    this._collision.isColliding = isColliding;
    
    if (isColliding && contactPoint && contactNormal) {
      this._collision.contactPoints.push({ ...contactPoint });
      this._collision.contactNormals.push({ ...contactNormal });
      this._collision.penetrationDepth = Math.max(this._collision.penetrationDepth, penetration || 0);
    }
  }

  addCollider(entityId: EntityId): void {
    this._collision.colliderIds.add(entityId);
  }

  removeCollider(entityId: EntityId): void {
    this._collision.colliderIds.delete(entityId);
  }

  addTrigger(entityId: EntityId): void {
    this._collision.triggerIds.add(entityId);
  }

  removeTrigger(entityId: EntityId): void {
    this._collision.triggerIds.delete(entityId);
  }

  clearCollisionState(): void {
    this._collision.isColliding = false;
    this._collision.contactPoints.length = 0;
    this._collision.contactNormals.length = 0;
    this._collision.penetrationDepth = 0;
    this._collision.colliderIds.clear();
    this._collision.triggerIds.clear();
  }

  // Physics integration (called by PhysicsSystem)
  integrate(deltaTime: number, gravity: Vector3): void {
    if (this._config.isKinematic || this._isAsleep) return;

    // Apply gravity
    if (this._config.useGravity && !this._config.isGrounded) {
      this.addForce({
        x: gravity.x * this._config.gravityScale * this._config.mass,
        y: gravity.y * this._config.gravityScale * this._config.mass,
        z: gravity.z * this._config.gravityScale * this._config.mass
      });
    }

    // Calculate acceleration from forces: a = F/m
    this._state.acceleration = {
      x: this._forces.force.x / this._config.mass,
      y: this._forces.force.y / this._config.mass,
      z: this._forces.force.z / this._config.mass
    };

    // Apply impulses directly to velocity
    this._state.velocity.x += this._forces.impulse.x / this._config.mass;
    this._state.velocity.y += this._forces.impulse.y / this._config.mass;
    this._state.velocity.z += this._forces.impulse.z / this._config.mass;

    // Update velocity: v = v + a*t
    this._state.velocity.x += this._state.acceleration.x * deltaTime;
    this._state.velocity.y += this._state.acceleration.y * deltaTime;
    this._state.velocity.z += this._state.acceleration.z * deltaTime;

    // Apply drag
    const dragFactor = Math.pow(1 - this._config.drag, deltaTime);
    this._state.velocity.x *= dragFactor;
    this._state.velocity.y *= dragFactor;
    this._state.velocity.z *= dragFactor;

    // Apply friction when grounded
    if (this._config.isGrounded) {
      const frictionFactor = Math.pow(1 - this._config.friction, deltaTime);
      this._state.velocity.x *= frictionFactor;
      this._state.velocity.z *= frictionFactor;
    }

    // Handle angular motion if not frozen
    if (!this._config.freezeRotation) {
      // Calculate angular acceleration from torques
      const invInertia = this._state.inertiaTensor.clone().invert();
      const torqueVec = new THREE.Vector3(this._forces.torque.x, this._forces.torque.y, this._forces.torque.z);
      const angularAccel = torqueVec.applyMatrix3(invInertia);
      
      this._state.angularAcceleration = {
        x: angularAccel.x,
        y: angularAccel.y,
        z: angularAccel.z
      };

      // Apply angular impulses
      const angularImpulseVec = new THREE.Vector3(
        this._forces.angularImpulse.x,
        this._forces.angularImpulse.y,
        this._forces.angularImpulse.z
      ).applyMatrix3(invInertia);
      
      this._state.angularVelocity.x += angularImpulseVec.x;
      this._state.angularVelocity.y += angularImpulseVec.y;
      this._state.angularVelocity.z += angularImpulseVec.z;

      // Update angular velocity
      this._state.angularVelocity.x += this._state.angularAcceleration.x * deltaTime;
      this._state.angularVelocity.y += this._state.angularAcceleration.y * deltaTime;
      this._state.angularVelocity.z += this._state.angularAcceleration.z * deltaTime;

      // Apply angular drag
      const angularDragFactor = Math.pow(1 - this._config.angularDrag, deltaTime);
      this._state.angularVelocity.x *= angularDragFactor;
      this._state.angularVelocity.y *= angularDragFactor;
      this._state.angularVelocity.z *= angularDragFactor;
    }

    // Check for sleep
    this.updateSleepState(deltaTime);

    // Clear forces for next frame
    this.clearForces();
  }

  // Sleep/wake system for performance optimization
  private updateSleepState(deltaTime: number): void {
    const velocityMagnitude = Math.sqrt(
      this._state.velocity.x ** 2 + 
      this._state.velocity.y ** 2 + 
      this._state.velocity.z ** 2
    );
    
    const angularVelocityMagnitude = Math.sqrt(
      this._state.angularVelocity.x ** 2 + 
      this._state.angularVelocity.y ** 2 + 
      this._state.angularVelocity.z ** 2
    );

    if (velocityMagnitude < this._sleepThreshold && angularVelocityMagnitude < this._sleepThreshold) {
      this._sleepTimer += deltaTime;
      if (this._sleepTimer > 1.0) { // Sleep after 1 second of inactivity
        this.sleep();
      }
    } else {
      this._sleepTimer = 0;
      if (this._isAsleep && (velocityMagnitude > this._wakeThreshold || angularVelocityMagnitude > this._wakeThreshold)) {
        this.wake();
      }
    }
  }

  sleep(): void {
    this._isAsleep = true;
    this.clearVelocity();
    this.clearForces();
  }

  wake(): void {
    this._isAsleep = false;
    this._sleepTimer = 0;
  }

  // Utility methods
  private updateInertiaTensor(): void {
    // Simple box inertia tensor calculation
    // In a real implementation, this would be calculated based on the collider shape
    const I = (this._config.mass * 2) / 12; // Simplified for unit cube
    this._state.inertiaTensor.set(
      I, 0, 0,
      0, I, 0,
      0, 0, I
    );
  }

  setPreviousTransform(position: THREE.Vector3, rotation: THREE.Quaternion): void {
    this._previousPosition.copy(position);
    this._previousRotation.copy(rotation);
  }

  getPreviousPosition(): THREE.Vector3 {
    return this._previousPosition.clone();
  }

  getPreviousRotation(): THREE.Quaternion {
    return this._previousRotation.clone();
  }

  // Material management
  static addMaterial(material: PhysicsMaterial): void {
    PhysicsComponent.materials.set(material.name, material);
  }

  static getMaterial(name: string): PhysicsMaterial | undefined {
    return PhysicsComponent.materials.get(name);
  }

  setMaterial(materialName: string): boolean {
    const material = PhysicsComponent.materials.get(materialName);
    if (material) {
      this._config.material = material;
      this._config.friction = material.friction;
      this._config.restitution = material.restitution;
      return true;
    }
    return false;
  }

  // Debugging and introspection
  getDebugInfo() {
    return {
      entityId: this.entityId,
      mass: this._config.mass,
      velocity: this._state.velocity,
      angularVelocity: this._state.angularVelocity,
      isAsleep: this._isAsleep,
      isGrounded: this._config.isGrounded,
      isKinematic: this._config.isKinematic,
      isTrigger: this._config.isTrigger,
      isColliding: this._collision.isColliding,
      contactCount: this._collision.contactPoints.length,
      material: this._config.material.name
    };
  }
}

export default PhysicsComponent;