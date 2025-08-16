/**
 * High-performance object pooling system for physics calculations
 * Reduces garbage collection pressure during intensive physics simulation
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;
  private currentSize = 0;
  
  // Performance tracking
  private stats = {
    created: 0,
    reused: 0,
    returned: 0,
    maxPoolSize: 0
  };

  constructor(createFn: () => T, resetFn?: (obj: T) => void, maxSize = 1000) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  get(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this.stats.reused++;
      return obj;
    }
    
    const obj = this.createFn();
    this.stats.created++;
    this.currentSize++;
    return obj;
  }

  return(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.pool.push(obj);
      this.stats.returned++;
      this.stats.maxPoolSize = Math.max(this.stats.maxPoolSize, this.pool.length);
    }
  }

  clear(): void {
    this.pool.length = 0;
    this.currentSize = 0;
  }

  getStats() {
    return {
      ...this.stats,
      currentPoolSize: this.pool.length,
      totalObjectsCreated: this.currentSize,
      reuseRatio: this.stats.reused / (this.stats.created + this.stats.reused)
    };
  }
}

/**
 * Specialized pools for common physics objects
 */
export class PhysicsObjectPools {
  static vector3Pool = new ObjectPool(
    () => ({ x: 0, y: 0, z: 0 }),
    (v) => { v.x = 0; v.y = 0; v.z = 0; }
  );

  static contactPointPool = new ObjectPool(
    () => ({
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 0 },
      penetration: 0,
      separation: 0
    }),
    (cp) => {
      cp.point.x = cp.point.y = cp.point.z = 0;
      cp.normal.x = cp.normal.y = cp.normal.z = 0;
      cp.penetration = cp.separation = 0;
    }
  );

  static aabbPool = new ObjectPool(
    () => ({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 }
    }),
    (aabb) => {
      aabb.min.x = aabb.min.y = aabb.min.z = 0;
      aabb.max.x = aabb.max.y = aabb.max.z = 0;
    }
  );

  static raycastResultPool = new ObjectPool(
    () => ({
      hit: false,
      distance: 0,
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 0 },
      entity: null
    }),
    (result) => {
      result.hit = false;
      result.distance = 0;
      result.point.x = result.point.y = result.point.z = 0;
      result.normal.x = result.normal.y = result.normal.z = 0;
      result.entity = null;
    }
  );

  static clearAll(): void {
    this.vector3Pool.clear();
    this.contactPointPool.clear();
    this.aabbPool.clear();
    this.raycastResultPool.clear();
  }

  static getGlobalStats() {
    return {
      vector3: this.vector3Pool.getStats(),
      contactPoint: this.contactPointPool.getStats(),
      aabb: this.aabbPool.getStats(),
      raycastResult: this.raycastResultPool.getStats()
    };
  }
}

export default ObjectPool;