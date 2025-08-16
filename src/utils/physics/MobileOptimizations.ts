import type { Vector3, Entity } from '@/types';
import type { AABB } from '../../systems/physics/SpatialHashGrid';

export interface LODLevel {
  distance: number;
  physicsFidelity: number; // 0-1 scale
  collisionChecks: boolean;
  updateFrequency: number; // Hz
}

export interface FrustumPlanes {
  left: Plane;
  right: Plane;
  top: Plane;
  bottom: Plane;
  near: Plane;
  far: Plane;
}

export interface Plane {
  normal: Vector3;
  distance: number;
}

export interface PerformanceSettings {
  targetFPS: number;
  maxPhysicsTime: number; // ms per frame
  adaptiveQuality: boolean;
  aggressiveCulling: boolean;
  reducedPrecision: boolean;
}

/**
 * Mobile-optimized physics features for 60fps performance
 * Includes frustum culling, LOD, and adaptive quality
 */
export class MobileOptimizations {
  private lodLevels: LODLevel[] = [
    { distance: 10, physicsFidelity: 1.0, collisionChecks: true, updateFrequency: 60 },
    { distance: 25, physicsFidelity: 0.7, collisionChecks: true, updateFrequency: 30 },
    { distance: 50, physicsFidelity: 0.4, collisionChecks: false, updateFrequency: 15 },
    { distance: 100, physicsFidelity: 0.2, collisionChecks: false, updateFrequency: 5 },
    { distance: Infinity, physicsFidelity: 0.0, collisionChecks: false, updateFrequency: 0 }
  ];

  private performanceSettings: PerformanceSettings = {
    targetFPS: 60,
    maxPhysicsTime: 8, // 8ms target for physics
    adaptiveQuality: true,
    aggressiveCulling: true,
    reducedPrecision: false
  };

  private frameTimeHistory: number[] = [];
  private physicsTimeHistory: number[] = [];
  private currentQualityLevel = 1.0;
  private lastPerformanceCheck = 0;
  private performanceCheckInterval = 1000; // Check every second

  constructor(settings?: Partial<PerformanceSettings>) {
    if (settings) {
      this.performanceSettings = { ...this.performanceSettings, ...settings };
    }
    
    // Detect mobile device and adjust defaults
    if (this.isMobileDevice()) {
      this.performanceSettings.aggressiveCulling = true;
      this.performanceSettings.reducedPrecision = true;
      this.performanceSettings.maxPhysicsTime = 6; // More aggressive on mobile
    }
  }

  /**
   * Frustum culling for physics objects
   */
  static frustumCullAABB(aabb: AABB, frustum: FrustumPlanes): boolean {
    // Check if AABB is outside any frustum plane
    for (const plane of Object.values(frustum)) {
      // Get the positive vertex (farthest along plane normal)
      const positiveVertex = {
        x: plane.normal.x >= 0 ? aabb.max.x : aabb.min.x,
        y: plane.normal.y >= 0 ? aabb.max.y : aabb.min.y,
        z: plane.normal.z >= 0 ? aabb.max.z : aabb.min.z
      };
      
      // If positive vertex is behind plane, AABB is completely outside
      if (this.distanceToPlane(positiveVertex, plane) < 0) {
        return true; // Culled
      }
    }
    
    return false; // Not culled
  }

  /**
   * Create frustum planes from camera view-projection matrix
   */
  static createFrustumFromMatrix(viewProjectionMatrix: number[]): FrustumPlanes {
    const m = viewProjectionMatrix;
    
    return {
      left: {
        normal: { x: m[3] + m[0], y: m[7] + m[4], z: m[11] + m[8] },
        distance: m[15] + m[12]
      },
      right: {
        normal: { x: m[3] - m[0], y: m[7] - m[4], z: m[11] - m[8] },
        distance: m[15] - m[12]
      },
      top: {
        normal: { x: m[3] - m[1], y: m[7] - m[5], z: m[11] - m[9] },
        distance: m[15] - m[13]
      },
      bottom: {
        normal: { x: m[3] + m[1], y: m[7] + m[5], z: m[11] + m[9] },
        distance: m[15] + m[13]
      },
      near: {
        normal: { x: m[3] + m[2], y: m[7] + m[6], z: m[11] + m[10] },
        distance: m[15] + m[14]
      },
      far: {
        normal: { x: m[3] - m[2], y: m[7] - m[6], z: m[11] - m[10] },
        distance: m[15] - m[14]
      }
    };
  }

  /**
   * Get LOD level for an entity based on distance from camera
   */
  getLODLevel(entityPosition: Vector3, cameraPosition: Vector3): LODLevel {
    const distance = this.calculateDistance(entityPosition, cameraPosition);
    
    for (const lod of this.lodLevels) {
      if (distance <= lod.distance) {
        return {
          ...lod,
          physicsFidelity: lod.physicsFidelity * this.currentQualityLevel
        };
      }
    }
    
    return this.lodLevels[this.lodLevels.length - 1];
  }

  /**
   * Determine if entity should have physics updates this frame
   */
  shouldUpdatePhysics(entity: Entity, cameraPosition: Vector3, frameTime: number): boolean {
    const transform = entity.components.get('transform');
    if (!transform) return false;
    
    const lod = this.getLODLevel(transform.position, cameraPosition);
    
    // Check update frequency
    if (lod.updateFrequency === 0) return false;
    
    const updateInterval = 1000 / lod.updateFrequency;
    const entityLastUpdate = (entity as any)._lastPhysicsUpdate || 0;
    
    return (frameTime - entityLastUpdate) >= updateInterval;
  }

  /**
   * Adaptive quality management based on performance
   */
  updatePerformanceMetrics(frameTime: number, physicsTime: number): void {
    const now = performance.now();
    
    this.frameTimeHistory.push(frameTime);
    this.physicsTimeHistory.push(physicsTime);
    
    // Keep only recent history
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
      this.physicsTimeHistory.shift();
    }
    
    // Check performance periodically
    if (now - this.lastPerformanceCheck > this.performanceCheckInterval) {
      this.adjustQualityLevel();
      this.lastPerformanceCheck = now;
    }
  }

  /**
   * Get optimized physics timestep based on performance
   */
  getOptimalTimestep(defaultTimestep: number): number {
    if (!this.performanceSettings.adaptiveQuality) {
      return defaultTimestep;
    }
    
    const avgPhysicsTime = this.getAveragePhysicsTime();
    
    if (avgPhysicsTime > this.performanceSettings.maxPhysicsTime) {
      // Physics is taking too long, increase timestep to reduce frequency
      return Math.min(defaultTimestep * 1.5, 1/30); // Cap at 30 FPS
    } else if (avgPhysicsTime < this.performanceSettings.maxPhysicsTime * 0.5) {
      // Physics has headroom, can use smaller timestep for better precision
      return Math.max(defaultTimestep * 0.8, 1/120); // Cap at 120 FPS
    }
    
    return defaultTimestep;
  }

  /**
   * Check if collision detection should be skipped for performance
   */
  shouldSkipCollision(entityA: Entity, entityB: Entity, cameraPosition: Vector3): boolean {
    if (!this.performanceSettings.aggressiveCulling) return false;
    
    const transformA = entityA.components.get('transform');
    const transformB = entityB.components.get('transform');
    
    if (!transformA || !transformB) return true;
    
    // Skip collision if both entities are far from camera
    const distanceA = this.calculateDistance(transformA.position, cameraPosition);
    const distanceB = this.calculateDistance(transformB.position, cameraPosition);
    
    const farThreshold = 75; // Skip collisions beyond this distance
    
    return distanceA > farThreshold && distanceB > farThreshold;
  }

  /**
   * Get reduced precision factor for calculations
   */
  getPrecisionFactor(): number {
    if (!this.performanceSettings.reducedPrecision) return 1.0;
    
    // Reduce precision based on quality level
    return Math.max(0.1, this.currentQualityLevel);
  }

  /**
   * Batch physics updates for better cache performance
   */
  static batchEntitiesByType(entities: Entity[]): Map<string, Entity[]> {
    const batches = new Map<string, Entity[]>();
    
    for (const entity of entities) {
      // Group by component types for better cache locality
      const componentTypes = Array.from(entity.components.keys()).sort().join(',');
      
      if (!batches.has(componentTypes)) {
        batches.set(componentTypes, []);
      }
      
      batches.get(componentTypes)!.push(entity);
    }
    
    return batches;
  }

  /**
   * Memory pool optimization for mobile
   */
  static optimizeMemoryPools(): void {
    // Trigger garbage collection hint on mobile
    if ((window as any).gc && this.prototype.isMobileDevice()) {
      (window as any).gc();
    }
  }

  // Private methods
  private adjustQualityLevel(): void {
    if (!this.performanceSettings.adaptiveQuality) return;
    
    const avgFrameTime = this.getAverageFrameTime();
    const targetFrameTime = 1000 / this.performanceSettings.targetFPS;
    
    if (avgFrameTime > targetFrameTime * 1.2) {
      // Performance is poor, reduce quality
      this.currentQualityLevel = Math.max(0.1, this.currentQualityLevel - 0.1);
    } else if (avgFrameTime < targetFrameTime * 0.8) {
      // Performance is good, can increase quality
      this.currentQualityLevel = Math.min(1.0, this.currentQualityLevel + 0.05);
    }
  }

  private getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 16.67;
    
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.frameTimeHistory.length;
  }

  private getAveragePhysicsTime(): number {
    if (this.physicsTimeHistory.length === 0) return 0;
    
    const sum = this.physicsTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.physicsTimeHistory.length;
  }

  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private static distanceToPlane(point: Vector3, plane: Plane): number {
    return plane.normal.x * point.x + plane.normal.y * point.y + plane.normal.z * point.z + plane.distance;
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  // Public getters
  getCurrentQualityLevel(): number {
    return this.currentQualityLevel;
  }

  getPerformanceSettings(): PerformanceSettings {
    return { ...this.performanceSettings };
  }

  getLODLevels(): LODLevel[] {
    return [...this.lodLevels];
  }

  // Debug information
  getDebugInfo() {
    return {
      currentQualityLevel: this.currentQualityLevel,
      averageFrameTime: this.getAverageFrameTime(),
      averagePhysicsTime: this.getAveragePhysicsTime(),
      performanceHistory: {
        frameTime: [...this.frameTimeHistory],
        physicsTime: [...this.physicsTimeHistory]
      },
      settings: this.performanceSettings,
      lodLevels: this.lodLevels
    };
  }
}

export default MobileOptimizations;