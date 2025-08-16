import type { System, Entity, Vector3, CollisionEvent } from '@/types';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import { SpatialHashGrid, type SpatialObject, type AABB } from '../physics/SpatialHashGrid';
import * as THREE from 'three';

export interface ColliderComponent {
  type: 'collider';
  entityId: number;
  shape: 'box' | 'sphere' | 'capsule' | 'mesh' | 'terrain';
  size: Vector3;
  offset: Vector3;
  isTrigger: boolean;
  layer: number;
  material?: string;
}

export interface CollisionLayer {
  name: string;
  index: number;
  collidesWith: number[]; // Bitfield of layers this can collide with
}

export interface TerrainCollider {
  heightmap: Float32Array;
  width: number;
  height: number;
  scale: Vector3;
  offset: Vector3;
}

export interface CollisionManifold {
  entityA: Entity;
  entityB: Entity;
  contactPoints: Vector3[];
  contactNormal: Vector3;
  penetrationDepth: number;
  isFirstContact: boolean;
  persistentContactId: string;
}

/**
 * Advanced collision detection system with multiple collision shapes,
 * terrain collision, and optimized collision response
 */
export class CollisionSystem implements System {
  readonly id = 'collision';
  readonly priority = 15; // Run after physics
  readonly requiredComponents = ['collider', 'transform'];

  private spatialGrid: SpatialHashGrid;
  private collisionLayers = new Map<string, CollisionLayer>();
  private terrainColliders = new Map<number, TerrainCollider>();
  private persistentContacts = new Map<string, CollisionManifold>();
  private eventCallbacks = new Map<string, ((event: CollisionEvent) => void)[]>();
  
  // Performance tracking
  private stats = {
    broadPhaseChecks: 0,
    narrowPhaseChecks: 0,
    collisionPairs: 0,
    triggerEvents: 0,
    terrainChecks: 0,
    contactsGenerated: 0,
    contactsPersisted: 0
  };

  // Object pools
  private manifoldPool: CollisionManifold[] = [];
  private contactPointPool: Vector3[] = [];

  constructor(spatialGrid: SpatialHashGrid) {
    this.spatialGrid = spatialGrid;
    this.initializeDefaultLayers();
  }

  init(): void {
    console.log('CollisionSystem initialized');
  }

  update(deltaTime: number, entities: Entity[]): void {
    // Reset frame stats
    this.resetStats();
    
    // Clear previous frame collision states
    this.clearCollisionStates(entities);
    
    // Broad-phase collision detection
    const potentialPairs = this.broadPhase(entities);
    
    // Narrow-phase collision detection
    const manifolds = this.narrowPhase(potentialPairs);
    
    // Generate collision events
    this.generateEvents(manifolds);
    
    // Update persistent contacts
    this.updatePersistentContacts(manifolds);
    
    // Terrain collision checks
    this.checkTerrainCollisions(entities);
  }

  private initializeDefaultLayers(): void {
    this.addCollisionLayer('default', 0, [0, 1, 2, 3, 4]);
    this.addCollisionLayer('player', 1, [0, 2, 3, 4]);
    this.addCollisionLayer('enemies', 2, [0, 1, 3, 4]);
    this.addCollisionLayer('collectibles', 3, [1]); // Only collides with player
    this.addCollisionLayer('obstacles', 4, [0, 1, 2]);
    this.addCollisionLayer('triggers', 5, []); // Triggers don't collide, only detect
  }

  private resetStats(): void {
    this.stats.broadPhaseChecks = 0;
    this.stats.narrowPhaseChecks = 0;
    this.stats.collisionPairs = 0;
    this.stats.triggerEvents = 0;
    this.stats.terrainChecks = 0;
    this.stats.contactsGenerated = 0;
    this.stats.contactsPersisted = 0;
  }

  private clearCollisionStates(entities: Entity[]): void {
    for (const entity of entities) {
      const physics = entity.components.get('physics') as PhysicsComponent;
      if (physics) {
        physics.clearCollisionState();
      }
    }
  }

  private broadPhase(entities: Entity[]): [Entity, Entity][] {
    const pairs: [Entity, Entity][] = [];
    const checkedPairs = new Set<string>();
    
    for (const entity of entities) {
      const collider = entity.components.get('collider') as ColliderComponent;
      const transform = entity.components.get('transform');
      
      if (!collider || !transform) continue;
      
      // Create AABB for entity
      const aabb = this.createAABBFromCollider(entity, collider, transform);
      
      // Query spatial grid
      const queryResult = this.spatialGrid.queryAABB(aabb);
      this.stats.broadPhaseChecks += queryResult.totalChecks;
      
      for (const spatialObj of queryResult.objects) {
        if (spatialObj.entityId === entity.id) continue;
        
        // Create unique pair ID
        const pairId = entity.id < spatialObj.entityId ? 
          `${entity.id}-${spatialObj.entityId}` : 
          `${spatialObj.entityId}-${entity.id}`;
        
        if (checkedPairs.has(pairId)) continue;
        checkedPairs.add(pairId);
        
        // Find other entity
        const otherEntity = entities.find(e => e.id === spatialObj.entityId);
        if (!otherEntity) continue;
        
        const otherCollider = otherEntity.components.get('collider') as ColliderComponent;
        if (!otherCollider) continue;
        
        // Check layer collision matrix
        if (!this.canLayersCollide(collider.layer, otherCollider.layer)) {
          continue;
        }
        
        pairs.push([entity, otherEntity]);
      }
    }
    
    return pairs;
  }

  private narrowPhase(pairs: [Entity, Entity][]): CollisionManifold[] {
    const manifolds: CollisionManifold[] = [];
    
    for (const [entityA, entityB] of pairs) {
      this.stats.narrowPhaseChecks++;
      
      const colliderA = entityA.components.get('collider') as ColliderComponent;
      const colliderB = entityB.components.get('collider') as ColliderComponent;
      const transformA = entityA.components.get('transform')!;
      const transformB = entityB.components.get('transform')!;
      
      const collision = this.detectCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
      
      if (collision.hit) {
        const manifold = this.getManifold();
        manifold.entityA = entityA;
        manifold.entityB = entityB;
        manifold.contactPoints = collision.contactPoints || [];
        manifold.contactNormal = collision.normal || { x: 0, y: 1, z: 0 };
        manifold.penetrationDepth = collision.penetrationDepth || 0;
        
        // Check if this is a new contact
        const contactId = `${entityA.id}-${entityB.id}`;
        manifold.isFirstContact = !this.persistentContacts.has(contactId);
        manifold.persistentContactId = contactId;
        
        manifolds.push(manifold);
        this.stats.collisionPairs++;
        this.stats.contactsGenerated += manifold.contactPoints.length;
      }
    }
    
    return manifolds;
  }

  private detectCollision(entityA: Entity, entityB: Entity, colliderA: ColliderComponent, colliderB: ColliderComponent, 
                         transformA: any, transformB: any): {
    hit: boolean;
    contactPoints?: Vector3[];
    normal?: Vector3;
    penetrationDepth?: number;
  } {
    // Dispatch to appropriate collision detection method
    if (colliderA.shape === 'sphere' && colliderB.shape === 'sphere') {
      return this.sphereSphereCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
    } else if (colliderA.shape === 'box' && colliderB.shape === 'box') {
      return this.boxBoxCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
    } else if ((colliderA.shape === 'sphere' && colliderB.shape === 'box') || 
               (colliderA.shape === 'box' && colliderB.shape === 'sphere')) {
      return this.sphereBoxCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
    } else if (colliderA.shape === 'capsule' || colliderB.shape === 'capsule') {
      return this.capsuleCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
    } else {
      // Fallback to sphere-sphere for unsupported combinations
      return this.sphereSphereCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
    }
  }

  private sphereSphereCollision(entityA: Entity, entityB: Entity, colliderA: ColliderComponent, 
                               colliderB: ColliderComponent, transformA: any, transformB: any): {
    hit: boolean;
    contactPoints?: Vector3[];
    normal?: Vector3;
    penetrationDepth?: number;
  } {
    const posA = {
      x: transformA.position.x + colliderA.offset.x,
      y: transformA.position.y + colliderA.offset.y,
      z: transformA.position.z + colliderA.offset.z
    };
    
    const posB = {
      x: transformB.position.x + colliderB.offset.x,
      y: transformB.position.y + colliderB.offset.y,
      z: transformB.position.z + colliderB.offset.z
    };
    
    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    const dz = posA.z - posB.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const radiusA = Math.max(colliderA.size.x, colliderA.size.y, colliderA.size.z) * 0.5;
    const radiusB = Math.max(colliderB.size.x, colliderB.size.y, colliderB.size.z) * 0.5;
    const totalRadius = radiusA + radiusB;
    
    if (distance < totalRadius && distance > 0.001) {
      const penetration = totalRadius - distance;
      const normal = { x: dx / distance, y: dy / distance, z: dz / distance };
      
      const contactPoint = {
        x: posA.x - normal.x * radiusA,
        y: posA.y - normal.y * radiusA,
        z: posA.z - normal.z * radiusA
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

  private boxBoxCollision(entityA: Entity, entityB: Entity, colliderA: ColliderComponent, 
                         colliderB: ColliderComponent, transformA: any, transformB: any): {
    hit: boolean;
    contactPoints?: Vector3[];
    normal?: Vector3;
    penetrationDepth?: number;
  } {
    // Simplified AABB vs AABB collision
    const aabbA = this.createAABBFromCollider(entityA, colliderA, transformA);
    const aabbB = this.createAABBFromCollider(entityB, colliderB, transformB);
    
    if (this.aabbIntersect(aabbA, aabbB)) {
      // Calculate penetration on each axis
      const overlapX = Math.min(aabbA.max.x - aabbB.min.x, aabbB.max.x - aabbA.min.x);
      const overlapY = Math.min(aabbA.max.y - aabbB.min.y, aabbB.max.y - aabbA.min.y);
      const overlapZ = Math.min(aabbA.max.z - aabbB.min.z, aabbB.max.z - aabbA.min.z);
      
      // Find minimum overlap axis
      let normal: Vector3;
      let penetration: number;
      
      if (overlapX <= overlapY && overlapX <= overlapZ) {
        penetration = overlapX;
        normal = transformA.position.x < transformB.position.x ? 
          { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 };
      } else if (overlapY <= overlapZ) {
        penetration = overlapY;
        normal = transformA.position.y < transformB.position.y ? 
          { x: 0, y: -1, z: 0 } : { x: 0, y: 1, z: 0 };
      } else {
        penetration = overlapZ;
        normal = transformA.position.z < transformB.position.z ? 
          { x: 0, y: 0, z: -1 } : { x: 0, y: 0, z: 1 };
      }
      
      const contactPoint = {
        x: (aabbA.min.x + aabbA.max.x + aabbB.min.x + aabbB.max.x) * 0.25,
        y: (aabbA.min.y + aabbA.max.y + aabbB.min.y + aabbB.max.y) * 0.25,
        z: (aabbA.min.z + aabbA.max.z + aabbB.min.z + aabbB.max.z) * 0.25
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

  private sphereBoxCollision(entityA: Entity, entityB: Entity, colliderA: ColliderComponent, 
                            colliderB: ColliderComponent, transformA: any, transformB: any): {
    hit: boolean;
    contactPoints?: Vector3[];
    normal?: Vector3;
    penetrationDepth?: number;
  } {
    // Determine which is sphere and which is box
    let sphereEntity, boxEntity, sphereCollider, boxCollider, sphereTransform, boxTransform;
    
    if (colliderA.shape === 'sphere') {
      sphereEntity = entityA;
      boxEntity = entityB;
      sphereCollider = colliderA;
      boxCollider = colliderB;
      sphereTransform = transformA;
      boxTransform = transformB;
    } else {
      sphereEntity = entityB;
      boxEntity = entityA;
      sphereCollider = colliderB;
      boxCollider = colliderA;
      sphereTransform = transformB;
      boxTransform = transformA;
    }
    
    const spherePos = {
      x: sphereTransform.position.x + sphereCollider.offset.x,
      y: sphereTransform.position.y + sphereCollider.offset.y,
      z: sphereTransform.position.z + sphereCollider.offset.z
    };
    
    const boxAABB = this.createAABBFromCollider(boxEntity, boxCollider, boxTransform);
    
    // Find closest point on box to sphere center
    const closestPoint = {
      x: Math.max(boxAABB.min.x, Math.min(spherePos.x, boxAABB.max.x)),
      y: Math.max(boxAABB.min.y, Math.min(spherePos.y, boxAABB.max.y)),
      z: Math.max(boxAABB.min.z, Math.min(spherePos.z, boxAABB.max.z))
    };
    
    const dx = spherePos.x - closestPoint.x;
    const dy = spherePos.y - closestPoint.y;
    const dz = spherePos.z - closestPoint.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const radius = Math.max(sphereCollider.size.x, sphereCollider.size.y, sphereCollider.size.z) * 0.5;
    
    if (distance < radius) {
      const penetration = radius - distance;
      let normal: Vector3;
      
      if (distance > 0.001) {
        normal = { x: dx / distance, y: dy / distance, z: dz / distance };
      } else {
        // Sphere center is inside box, use closest axis
        const distToFaces = [
          Math.abs(spherePos.x - boxAABB.min.x),
          Math.abs(spherePos.x - boxAABB.max.x),
          Math.abs(spherePos.y - boxAABB.min.y),
          Math.abs(spherePos.y - boxAABB.max.y),
          Math.abs(spherePos.z - boxAABB.min.z),
          Math.abs(spherePos.z - boxAABB.max.z)
        ];
        
        const minIndex = distToFaces.indexOf(Math.min(...distToFaces));
        
        switch (minIndex) {
          case 0: normal = { x: -1, y: 0, z: 0 }; break;
          case 1: normal = { x: 1, y: 0, z: 0 }; break;
          case 2: normal = { x: 0, y: -1, z: 0 }; break;
          case 3: normal = { x: 0, y: 1, z: 0 }; break;
          case 4: normal = { x: 0, y: 0, z: -1 }; break;
          case 5: normal = { x: 0, y: 0, z: 1 }; break;
          default: normal = { x: 0, y: 1, z: 0 };
        }
      }
      
      return {
        hit: true,
        contactPoints: [closestPoint],
        normal: colliderA.shape === 'sphere' ? normal : { x: -normal.x, y: -normal.y, z: -normal.z },
        penetrationDepth: penetration
      };
    }
    
    return { hit: false };
  }

  private capsuleCollision(entityA: Entity, entityB: Entity, colliderA: ColliderComponent, 
                          colliderB: ColliderComponent, transformA: any, transformB: any): {
    hit: boolean;
    contactPoints?: Vector3[];
    normal?: Vector3;
    penetrationDepth?: number;
  } {
    // Simplified capsule collision - treat as sphere for now
    // In a full implementation, this would handle capsule-specific collision
    return this.sphereSphereCollision(entityA, entityB, colliderA, colliderB, transformA, transformB);
  }

  private generateEvents(manifolds: CollisionManifold[]): void {
    for (const manifold of manifolds) {
      const colliderA = manifold.entityA.components.get('collider') as ColliderComponent;
      const colliderB = manifold.entityB.components.get('collider') as ColliderComponent;
      
      // Update physics components
      const physicsA = manifold.entityA.components.get('physics') as PhysicsComponent;
      const physicsB = manifold.entityB.components.get('physics') as PhysicsComponent;
      
      if (physicsA) {
        physicsA.setCollisionState(true, manifold.contactPoints[0], manifold.contactNormal, manifold.penetrationDepth);
        physicsA.addCollider(manifold.entityB.id);
      }
      
      if (physicsB) {
        const reverseNormal = { x: -manifold.contactNormal.x, y: -manifold.contactNormal.y, z: -manifold.contactNormal.z };
        physicsB.setCollisionState(true, manifold.contactPoints[0], reverseNormal, manifold.penetrationDepth);
        physicsB.addCollider(manifold.entityA.id);
      }
      
      // Handle triggers
      if (colliderA.isTrigger || colliderB.isTrigger) {
        this.handleTriggerEvent(manifold);
      }
      
      // Generate collision event
      const event: CollisionEvent = {
        type: 'collision',
        data: {
          entityA: manifold.entityA.id,
          entityB: manifold.entityB.id,
          point: manifold.contactPoints[0],
          normal: manifold.contactNormal
        },
        timestamp: performance.now()
      };
      
      this.dispatchEvent(event);
    }
  }

  private handleTriggerEvent(manifold: CollisionManifold): void {
    this.stats.triggerEvents++;
    
    const physicsA = manifold.entityA.components.get('physics') as PhysicsComponent;
    const physicsB = manifold.entityB.components.get('physics') as PhysicsComponent;
    
    if (physicsA) {
      physicsA.addTrigger(manifold.entityB.id);
    }
    
    if (physicsB) {
      physicsB.addTrigger(manifold.entityA.id);
    }
  }

  private updatePersistentContacts(manifolds: CollisionManifold[]): void {
    // Add new persistent contacts
    for (const manifold of manifolds) {
      this.persistentContacts.set(manifold.persistentContactId, manifold);
      if (!manifold.isFirstContact) {
        this.stats.contactsPersisted++;
      }
    }
    
    // Remove old contacts that weren't updated this frame
    const activeContactIds = new Set(manifolds.map(m => m.persistentContactId));
    for (const [contactId, manifold] of this.persistentContacts) {
      if (!activeContactIds.has(contactId)) {
        this.returnManifold(manifold);
        this.persistentContacts.delete(contactId);
      }
    }
  }

  private checkTerrainCollisions(entities: Entity[]): void {
    for (const entity of entities) {
      const collider = entity.components.get('collider') as ColliderComponent;
      const transform = entity.components.get('transform');
      const physics = entity.components.get('physics') as PhysicsComponent;
      
      if (!collider || !transform || !physics) continue;
      
      for (const [terrainId, terrain] of this.terrainColliders) {
        this.stats.terrainChecks++;
        
        const terrainHeight = this.getTerrainHeight(terrain, transform.position.x, transform.position.z);
        const entityBottom = transform.position.y - collider.size.y * 0.5;
        
        if (entityBottom <= terrainHeight) {
          // Entity is below terrain, resolve collision
          const penetration = terrainHeight - entityBottom;
          const normal = { x: 0, y: 1, z: 0 }; // Assume flat terrain normal for simplicity
          
          physics.setCollisionState(true, 
            { x: transform.position.x, y: terrainHeight, z: transform.position.z },
            normal, penetration
          );
          
          // Correct position
          transform.position.y = terrainHeight + collider.size.y * 0.5;
          physics.isGrounded = true;
          
          // Stop downward velocity
          if (physics.velocity.y < 0) {
            physics.setVelocity({ x: physics.velocity.x, y: 0, z: physics.velocity.z });
          }
        }
      }
    }
  }

  private getTerrainHeight(terrain: TerrainCollider, worldX: number, worldZ: number): number {
    // Convert world coordinates to heightmap coordinates
    const localX = (worldX - terrain.offset.x) / terrain.scale.x;
    const localZ = (worldZ - terrain.offset.z) / terrain.scale.z;
    
    // Clamp to heightmap bounds
    const x = Math.max(0, Math.min(terrain.width - 1, Math.floor(localX)));
    const z = Math.max(0, Math.min(terrain.height - 1, Math.floor(localZ)));
    
    // Get height from heightmap
    const index = z * terrain.width + x;
    const height = terrain.heightmap[index];
    
    return height * terrain.scale.y + terrain.offset.y;
  }

  // Public API methods
  addCollisionLayer(name: string, index: number, collidesWith: number[]): void {
    this.collisionLayers.set(name, { name, index, collidesWith });
  }

  removeCollisionLayer(name: string): void {
    this.collisionLayers.delete(name);
  }

  canLayersCollide(layerA: number, layerB: number): boolean {
    for (const layer of this.collisionLayers.values()) {
      if (layer.index === layerA) {
        return layer.collidesWith.includes(layerB);
      }
    }
    return false;
  }

  addTerrainCollider(entityId: number, terrain: TerrainCollider): void {
    this.terrainColliders.set(entityId, terrain);
  }

  removeTerrainCollider(entityId: number): void {
    this.terrainColliders.delete(entityId);
  }

  addEventListener(eventType: string, callback: (event: CollisionEvent) => void): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType)!.push(callback);
  }

  removeEventListener(eventType: string, callback: (event: CollisionEvent) => void): void {
    const callbacks = this.eventCallbacks.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private dispatchEvent(event: CollisionEvent): void {
    const callbacks = this.eventCallbacks.get(event.type);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(event);
      }
    }
  }

  // Utility methods
  private createAABBFromCollider(entity: Entity, collider: ColliderComponent, transform: any): AABB {
    const pos = {
      x: transform.position.x + collider.offset.x,
      y: transform.position.y + collider.offset.y,
      z: transform.position.z + collider.offset.z
    };
    
    const halfSize = {
      x: collider.size.x * 0.5,
      y: collider.size.y * 0.5,
      z: collider.size.z * 0.5
    };
    
    return {
      min: {
        x: pos.x - halfSize.x,
        y: pos.y - halfSize.y,
        z: pos.z - halfSize.z
      },
      max: {
        x: pos.x + halfSize.x,
        y: pos.y + halfSize.y,
        z: pos.z + halfSize.z
      }
    };
  }

  private aabbIntersect(a: AABB, b: AABB): boolean {
    return (
      a.min.x <= b.max.x && a.max.x >= b.min.x &&
      a.min.y <= b.max.y && a.max.y >= b.min.y &&
      a.min.z <= b.max.z && a.max.z >= b.min.z
    );
  }

  // Object pooling
  private getManifold(): CollisionManifold {
    const manifold = this.manifoldPool.pop();
    if (manifold) {
      manifold.contactPoints.length = 0;
      return manifold;
    }
    
    return {
      entityA: null as any,
      entityB: null as any,
      contactPoints: [],
      contactNormal: { x: 0, y: 0, z: 0 },
      penetrationDepth: 0,
      isFirstContact: true,
      persistentContactId: ''
    };
  }

  private returnManifold(manifold: CollisionManifold): void {
    manifold.contactPoints.length = 0;
    this.manifoldPool.push(manifold);
  }

  // Performance and debugging
  getStats() {
    return {
      ...this.stats,
      spatialGrid: this.spatialGrid.getStats(),
      layers: Array.from(this.collisionLayers.values()),
      terrainColliders: this.terrainColliders.size,
      persistentContacts: this.persistentContacts.size,
      eventListeners: Array.from(this.eventCallbacks.entries()).map(([type, callbacks]) => ({
        type,
        count: callbacks.length
      }))
    };
  }

  destroy(): void {
    this.collisionLayers.clear();
    this.terrainColliders.clear();
    this.persistentContacts.clear();
    this.eventCallbacks.clear();
    this.manifoldPool.length = 0;
    this.contactPointPool.length = 0;
  }
}

export default CollisionSystem;