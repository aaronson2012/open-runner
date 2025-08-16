import type { Vector3, Entity } from '@/types';
import { PhysicsObjectPools } from './ObjectPool';
import type { AABB } from '../../systems/physics/SpatialHashGrid';

export interface Ray {
  origin: Vector3;
  direction: Vector3;
  maxDistance: number;
}

export interface RaycastHit {
  hit: boolean;
  entity?: Entity;
  point?: Vector3;
  normal?: Vector3;
  distance?: number;
  material?: string;
}

export interface RaycastOptions {
  layerMask?: number;
  ignoreTriggers?: boolean;
  maxHits?: number;
  sortByDistance?: boolean;
}

/**
 * High-performance raycasting utilities for terrain following,
 * line-of-sight checks, and projectile collision
 */
export class RaycastUtils {
  /**
   * Cast a ray against an AABB
   */
  static rayAABBIntersection(ray: Ray, aabb: AABB): RaycastHit {
    const result = PhysicsObjectPools.raycastResultPool.get();
    
    let tmin = 0;
    let tmax = ray.maxDistance;
    
    // Check each axis
    for (const axis of ['x', 'y', 'z'] as const) {
      if (Math.abs(ray.direction[axis]) < 0.0001) {
        // Ray is parallel to this axis
        if (ray.origin[axis] < aabb.min[axis] || ray.origin[axis] > aabb.max[axis]) {
          result.hit = false;
          return result;
        }
      } else {
        const invDir = 1.0 / ray.direction[axis];
        let t1 = (aabb.min[axis] - ray.origin[axis]) * invDir;
        let t2 = (aabb.max[axis] - ray.origin[axis]) * invDir;
        
        if (t1 > t2) {
          [t1, t2] = [t2, t1];
        }
        
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        
        if (tmin > tmax) {
          result.hit = false;
          return result;
        }
      }
    }
    
    if (tmin <= ray.maxDistance && tmin >= 0) {
      result.hit = true;
      result.distance = tmin;
      result.point = {
        x: ray.origin.x + ray.direction.x * tmin,
        y: ray.origin.y + ray.direction.y * tmin,
        z: ray.origin.z + ray.direction.z * tmin
      };
      
      // Calculate normal based on which face was hit
      const epsilon = 0.0001;
      const point = result.point;
      
      if (Math.abs(point.x - aabb.min.x) < epsilon) {
        result.normal = { x: -1, y: 0, z: 0 };
      } else if (Math.abs(point.x - aabb.max.x) < epsilon) {
        result.normal = { x: 1, y: 0, z: 0 };
      } else if (Math.abs(point.y - aabb.min.y) < epsilon) {
        result.normal = { x: 0, y: -1, z: 0 };
      } else if (Math.abs(point.y - aabb.max.y) < epsilon) {
        result.normal = { x: 0, y: 1, z: 0 };
      } else if (Math.abs(point.z - aabb.min.z) < epsilon) {
        result.normal = { x: 0, y: 0, z: -1 };
      } else {
        result.normal = { x: 0, y: 0, z: 1 };
      }
    } else {
      result.hit = false;
    }
    
    return result;
  }

  /**
   * Cast a ray against a sphere
   */
  static raySphereIntersection(ray: Ray, center: Vector3, radius: number): RaycastHit {
    const result = PhysicsObjectPools.raycastResultPool.get();
    
    const oc = {
      x: ray.origin.x - center.x,
      y: ray.origin.y - center.y,
      z: ray.origin.z - center.z
    };
    
    const a = this.dot(ray.direction, ray.direction);
    const b = 2 * this.dot(oc, ray.direction);
    const c = this.dot(oc, oc) - radius * radius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant >= 0) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      
      if (t >= 0 && t <= ray.maxDistance) {
        result.hit = true;
        result.distance = t;
        result.point = {
          x: ray.origin.x + ray.direction.x * t,
          y: ray.origin.y + ray.direction.y * t,
          z: ray.origin.z + ray.direction.z * t
        };
        
        // Calculate normal
        const dx = result.point.x - center.x;
        const dy = result.point.y - center.y;
        const dz = result.point.z - center.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (length > 0) {
          result.normal = { x: dx / length, y: dy / length, z: dz / length };
        } else {
          result.normal = { x: 0, y: 1, z: 0 };
        }
      } else {
        result.hit = false;
      }
    } else {
      result.hit = false;
    }
    
    return result;
  }

  /**
   * Cast a ray against a heightmap for terrain collision
   */
  static rayHeightmapIntersection(
    ray: Ray,
    heightmap: Float32Array,
    width: number,
    height: number,
    scale: Vector3,
    offset: Vector3
  ): RaycastHit {
    const result = PhysicsObjectPools.raycastResultPool.get();
    
    // Convert ray to heightmap space
    const localOrigin = {
      x: (ray.origin.x - offset.x) / scale.x,
      y: (ray.origin.y - offset.y) / scale.y,
      z: (ray.origin.z - offset.z) / scale.z
    };
    
    const localDirection = {
      x: ray.direction.x / scale.x,
      y: ray.direction.y / scale.y,
      z: ray.direction.z / scale.z
    };
    
    // DDA-like algorithm for heightmap traversal
    const stepX = localDirection.x > 0 ? 1 : -1;
    const stepZ = localDirection.z > 0 ? 1 : -1;
    
    let currentX = Math.floor(localOrigin.x);
    let currentZ = Math.floor(localOrigin.z);
    
    const deltaX = Math.abs(1 / localDirection.x);
    const deltaZ = Math.abs(1 / localDirection.z);
    
    let nextXBoundary = stepX > 0 ? currentX + 1 : currentX;
    let nextZBoundary = stepZ > 0 ? currentZ + 1 : currentZ;
    
    let tMaxX = deltaX * Math.abs(nextXBoundary - localOrigin.x);
    let tMaxZ = deltaZ * Math.abs(nextZBoundary - localOrigin.z);
    
    const maxSteps = Math.max(width, height) * 2;
    
    for (let step = 0; step < maxSteps; step++) {
      // Check if we're within heightmap bounds
      if (currentX >= 0 && currentX < width && currentZ >= 0 && currentZ < height) {
        const heightmapIndex = currentZ * width + currentX;
        const terrainHeight = heightmap[heightmapIndex];
        
        // Calculate ray height at this position
        const t = tMaxX < tMaxZ ? tMaxX : tMaxZ;
        const rayHeight = localOrigin.y + localDirection.y * t;
        
        // Check for intersection
        if (rayHeight <= terrainHeight && t <= ray.maxDistance) {
          // Binary search for exact intersection point
          const exactT = this.binarySearchHeightmapIntersection(
            localOrigin, localDirection, heightmap, width, height, 
            currentX, currentZ, t - Math.min(deltaX, deltaZ), t
          );
          
          if (exactT >= 0) {
            result.hit = true;
            result.distance = exactT;
            
            // Convert back to world space
            result.point = {
              x: ray.origin.x + ray.direction.x * exactT,
              y: ray.origin.y + ray.direction.y * exactT,
              z: ray.origin.z + ray.direction.z * exactT
            };
            
            // Calculate normal from heightmap gradient
            result.normal = this.calculateHeightmapNormal(
              heightmap, width, height, currentX, currentZ, scale
            );
            
            return result;
          }
        }
      }
      
      // Move to next cell
      if (tMaxX < tMaxZ) {
        tMaxX += deltaX;
        currentX += stepX;
      } else {
        tMaxZ += deltaZ;
        currentZ += stepZ;
      }
      
      // Check bounds
      if (currentX < 0 || currentX >= width || currentZ < 0 || currentZ >= height) {
        break;
      }
    }
    
    result.hit = false;
    return result;
  }

  /**
   * Cast multiple rays in a cone for area-based collision detection
   */
  static raycastCone(
    origin: Vector3,
    direction: Vector3,
    maxDistance: number,
    coneAngle: number,
    rayCount: number
  ): RaycastHit[] {
    const results: RaycastHit[] = [];
    const angleStep = coneAngle / (rayCount - 1);
    const startAngle = -coneAngle * 0.5;
    
    // Create rotation around the direction vector
    const perpendicular = this.getPerpendicular(direction);
    
    for (let i = 0; i < rayCount; i++) {
      const angle = startAngle + angleStep * i;
      const rotatedDirection = this.rotateAroundAxis(direction, perpendicular, angle);
      
      const ray: Ray = {
        origin,
        direction: rotatedDirection,
        maxDistance
      };
      
      // Note: In a complete implementation, this would raycast against the actual scene
      // For now, we'll return empty results
      const result = PhysicsObjectPools.raycastResultPool.get();
      result.hit = false;
      results.push(result);
    }
    
    return results;
  }

  /**
   * Ground following raycast - optimized for player movement
   */
  static groundFollowRaycast(
    position: Vector3,
    maxDistance: number = 2.0,
    offset: number = 0.1
  ): RaycastHit {
    const ray: Ray = {
      origin: { x: position.x, y: position.y + offset, z: position.z },
      direction: { x: 0, y: -1, z: 0 },
      maxDistance
    };
    
    // Note: In a complete implementation, this would raycast against terrain
    const result = PhysicsObjectPools.raycastResultPool.get();
    result.hit = false;
    return result;
  }

  // Helper methods
  private static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private static cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  private static normalize(v: Vector3): Vector3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    
    return {
      x: v.x / length,
      y: v.y / length,
      z: v.z / length
    };
  }

  private static getPerpendicular(v: Vector3): Vector3 {
    if (Math.abs(v.x) < 0.9) {
      return this.normalize(this.cross(v, { x: 1, y: 0, z: 0 }));
    } else {
      return this.normalize(this.cross(v, { x: 0, y: 1, z: 0 }));
    }
  }

  private static rotateAroundAxis(vector: Vector3, axis: Vector3, angle: number): Vector3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = this.dot(vector, axis);
    const cross = this.cross(axis, vector);
    
    return {
      x: vector.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
      y: vector.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
      z: vector.z * cos + cross.z * sin + axis.z * dot * (1 - cos)
    };
  }

  private static binarySearchHeightmapIntersection(
    origin: Vector3,
    direction: Vector3,
    heightmap: Float32Array,
    width: number,
    height: number,
    cellX: number,
    cellZ: number,
    tStart: number,
    tEnd: number,
    iterations: number = 8
  ): number {
    for (let i = 0; i < iterations; i++) {
      const tMid = (tStart + tEnd) * 0.5;
      const rayHeight = origin.y + direction.y * tMid;
      
      const heightmapIndex = cellZ * width + cellX;
      const terrainHeight = heightmap[heightmapIndex];
      
      if (rayHeight > terrainHeight) {
        tStart = tMid;
      } else {
        tEnd = tMid;
      }
    }
    
    return (tStart + tEnd) * 0.5;
  }

  private static calculateHeightmapNormal(
    heightmap: Float32Array,
    width: number,
    height: number,
    x: number,
    z: number,
    scale: Vector3
  ): Vector3 {
    const getHeight = (hx: number, hz: number) => {
      hx = Math.max(0, Math.min(width - 1, hx));
      hz = Math.max(0, Math.min(height - 1, hz));
      return heightmap[hz * width + hx];
    };
    
    const hL = getHeight(x - 1, z);
    const hR = getHeight(x + 1, z);
    const hD = getHeight(x, z - 1);
    const hU = getHeight(x, z + 1);
    
    const normal = {
      x: (hL - hR) / (2 * scale.x),
      y: 1,
      z: (hD - hU) / (2 * scale.z)
    };
    
    return this.normalize(normal);
  }
}

export default RaycastUtils;