// Memory Management System for Asset Loading
import { LoadedAsset } from '../../types/assets/AssetTypes';

interface MemoryPool {
  id: string;
  maxSize: number;
  currentSize: number;
  assets: Set<string>;
  priority: number;
  lastAccessed: number;
}

export class MemoryManager {
  private maxMemory: number;
  private currentMemory: number = 0;
  private pools = new Map<string, MemoryPool>();
  private assetToPool = new Map<string, string>();
  private assetSizes = new Map<string, number>();
  private gcThreshold: number;
  private gcCallbacks: (() => void)[] = [];

  constructor(maxMemory: number) {
    this.maxMemory = maxMemory;
    this.gcThreshold = maxMemory * 0.8; // Trigger GC at 80% capacity
    
    // Create default pools
    this.createDefaultPools();
    
    // Monitor memory usage
    this.startMemoryMonitoring();
  }

  private createDefaultPools(): void {
    // High priority pool for critical assets
    this.createPool('critical', this.maxMemory * 0.3, 0);
    
    // Medium priority for gameplay assets
    this.createPool('gameplay', this.maxMemory * 0.5, 1);
    
    // Low priority for background assets
    this.createPool('background', this.maxMemory * 0.2, 2);
  }

  createPool(
    id: string,
    maxSize: number,
    priority: number = 1
  ): void {
    this.pools.set(id, {
      id,
      maxSize,
      currentSize: 0,
      assets: new Set(),
      priority,
      lastAccessed: Date.now()
    });
  }

  allocateMemory(
    assetId: string,
    size: number,
    poolId: string = 'gameplay'
  ): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      console.warn(`Pool ${poolId} not found, using default`);
      return this.allocateMemory(assetId, size, 'gameplay');
    }

    // Check if we need to free memory first
    if (this.currentMemory + size > this.maxMemory) {
      if (!this.freeMemory(size)) {
        console.warn(`Cannot allocate ${size} bytes, insufficient memory`);
        return false;
      }
    }

    // Check pool capacity
    if (pool.currentSize + size > pool.maxSize) {
      if (!this.freePoolMemory(poolId, size)) {
        console.warn(`Cannot allocate ${size} bytes to pool ${poolId}`);
        return false;
      }
    }

    // Allocate memory
    pool.assets.add(assetId);
    pool.currentSize += size;
    pool.lastAccessed = Date.now();
    
    this.assetToPool.set(assetId, poolId);
    this.assetSizes.set(assetId, size);
    this.currentMemory += size;

    return true;
  }

  releaseMemory(assetId: string): boolean {
    const poolId = this.assetToPool.get(assetId);
    const size = this.assetSizes.get(assetId);

    if (!poolId || !size) {
      return false;
    }

    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    // Release from pool
    pool.assets.delete(assetId);
    pool.currentSize -= size;
    
    // Release from global tracking
    this.assetToPool.delete(assetId);
    this.assetSizes.delete(assetId);
    this.currentMemory -= size;

    return true;
  }

  private freeMemory(requiredSize: number): boolean {
    let freedSize = 0;
    const targetSize = requiredSize + (this.maxMemory * 0.1); // Free 10% extra buffer

    // Sort pools by priority (higher priority = keep longer)
    const sortedPools = Array.from(this.pools.values())
      .sort((a, b) => {
        // First by priority (higher priority last)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by last accessed (older first)
        return a.lastAccessed - b.lastAccessed;
      });

    for (const pool of sortedPools) {
      if (freedSize >= targetSize) break;

      freedSize += this.freePoolMemory(pool.id, targetSize - freedSize, false);
    }

    return freedSize >= requiredSize;
  }

  private freePoolMemory(
    poolId: string,
    requiredSize: number,
    strict: boolean = true
  ): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) return false;

    let freedSize = 0;
    const assetsToRemove: string[] = [];

    // Convert Set to Array for sorting
    const assetIds = Array.from(pool.assets);
    
    // Sort by size (largest first for more efficient freeing)
    assetIds.sort((a, b) => {
      const sizeA = this.assetSizes.get(a) || 0;
      const sizeB = this.assetSizes.get(b) || 0;
      return sizeB - sizeA;
    });

    for (const assetId of assetIds) {
      if (freedSize >= requiredSize && strict) break;

      const size = this.assetSizes.get(assetId);
      if (!size) continue;

      assetsToRemove.push(assetId);
      freedSize += size;
    }

    // Actually remove the assets
    for (const assetId of assetsToRemove) {
      this.triggerAssetCleanup(assetId);
      this.releaseMemory(assetId);
    }

    return freedSize >= requiredSize || !strict;
  }

  private triggerAssetCleanup(assetId: string): void {
    // Notify GC callbacks to perform actual cleanup
    this.gcCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in GC callback:', error);
      }
    });
  }

  private startMemoryMonitoring(): void {
    // Check memory usage every 5 seconds
    setInterval(() => {
      if (this.currentMemory > this.gcThreshold) {
        console.log('Memory threshold exceeded, triggering GC');
        this.freeMemory(this.maxMemory * 0.2); // Free 20% of memory
      }
    }, 5000);

    // Monitor browser memory if available
    if ((performance as any).memory) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo.usedJSHeapSize > memInfo.totalJSHeapSize * 0.9) {
          console.warn('Browser memory critically low, aggressive cleanup');
          this.freeMemory(this.maxMemory * 0.5); // Free 50% of memory
        }
      }, 10000);
    }
  }

  // Public API
  getCurrentUsage(): number {
    return this.currentMemory;
  }

  getMaxMemory(): number {
    return this.maxMemory;
  }

  getUsagePercentage(): number {
    return (this.currentMemory / this.maxMemory) * 100;
  }

  getPoolInfo(poolId: string): MemoryPool | null {
    return this.pools.get(poolId) || null;
  }

  getAllPoolsInfo(): MemoryPool[] {
    return Array.from(this.pools.values());
  }

  onGarbageCollection(callback: () => void): void {
    this.gcCallbacks.push(callback);
  }

  forceGarbageCollection(): void {
    this.freeMemory(this.maxMemory * 0.3); // Free 30% of memory
  }

  getMemoryStats(): {
    total: number;
    used: number;
    free: number;
    pools: { id: string; size: number; maxSize: number; assets: number }[];
  } {
    return {
      total: this.maxMemory,
      used: this.currentMemory,
      free: this.maxMemory - this.currentMemory,
      pools: Array.from(this.pools.values()).map(pool => ({
        id: pool.id,
        size: pool.currentSize,
        maxSize: pool.maxSize,
        assets: pool.assets.size
      }))
    };
  }

  updatePoolPriority(poolId: string, priority: number): void {
    const pool = this.pools.get(poolId);
    if (pool) {
      pool.priority = priority;
    }
  }

  touchPool(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (pool) {
      pool.lastAccessed = Date.now();
    }
  }

  cleanup(): void {
    // Release all memory
    for (const assetId of this.assetToPool.keys()) {
      this.releaseMemory(assetId);
    }
    
    // Clear all pools
    this.pools.clear();
    this.assetToPool.clear();
    this.assetSizes.clear();
    
    // Clear callbacks
    this.gcCallbacks.length = 0;
    
    this.currentMemory = 0;
  }
}