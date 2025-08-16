import type { Entity, ComponentType } from '@/types';

interface QueryCacheEntry {
  entities: Entity[];
  timestamp: number;
  accessCount: number;
}

/**
 * Cache for entity queries to improve performance
 */
export class QueryCache {
  private cache = new Map<string, QueryCacheEntry>();
  private componentInvalidations = new Map<ComponentType, Set<string>>();
  private enabled: boolean;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  
  // Statistics
  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  constructor(enabled: boolean = true, maxSize: number = 100, ttl: number = 5000) {
    this.enabled = enabled;
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate cache key from component types
   */
  private generateKey(componentTypes: ComponentType[]): string {
    return componentTypes.sort().join(',');
  }

  /**
   * Get cached query result
   */
  get(componentTypes: ComponentType[]): Entity[] | null {
    if (!this.enabled) return null;
    
    const key = this.generateKey(componentTypes);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Update access count and timestamp
    entry.accessCount++;
    entry.timestamp = Date.now();
    
    this.hits++;
    return entry.entities;
  }

  /**
   * Cache query result
   */
  set(componentTypes: ComponentType[], entities: Entity[]): void {
    if (!this.enabled) return;
    
    const key = this.generateKey(componentTypes);
    
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }
    
    // Store in cache
    this.cache.set(key, {
      entities: [...entities], // Shallow copy to avoid external mutations
      timestamp: Date.now(),
      accessCount: 1
    });
    
    // Track which component types this query depends on
    for (const componentType of componentTypes) {
      if (!this.componentInvalidations.has(componentType)) {
        this.componentInvalidations.set(componentType, new Set());
      }
      this.componentInvalidations.get(componentType)!.add(key);
    }
  }

  /**
   * Invalidate cache entries that depend on a specific component type
   */
  invalidateForComponent(componentType: ComponentType): void {
    if (!this.enabled) return;
    
    const affectedQueries = this.componentInvalidations.get(componentType);
    if (!affectedQueries) return;
    
    for (const queryKey of affectedQueries) {
      this.cache.delete(queryKey);
      this.invalidations++;
    }
    
    // Clear the invalidation set for this component
    affectedQueries.clear();
  }

  /**
   * Invalidate all cached queries
   */
  invalidateAll(): void {
    if (!this.enabled) return;
    
    const count = this.cache.size;
    this.cache.clear();
    this.componentInvalidations.clear();
    this.invalidations += count;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.componentInvalidations.clear();
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      
      // Clean up component invalidation tracking
      for (const invalidationSet of this.componentInvalidations.values()) {
        invalidationSet.delete(oldestKey);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    if (!this.enabled) return;
    
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
      
      // Clean up component invalidation tracking
      for (const invalidationSet of this.componentInvalidations.values()) {
        invalidationSet.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate,
      invalidations: this.invalidations,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of the cache
   */
  private estimateMemoryUsage(): number {
    // Rough estimation: each cached entity reference + metadata
    const bytesPerEntry = 64; // Estimated overhead per cache entry
    const bytesPerEntityRef = 8; // Estimated size of entity reference
    
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += bytesPerEntry + (entry.entities.length * bytesPerEntityRef);
    }
    
    return totalSize;
  }

  /**
   * Configure cache settings
   */
  configure(options: { enabled?: boolean; maxSize?: number; ttl?: number }): void {
    if (options.enabled !== undefined) {
      this.enabled = options.enabled;
      if (!this.enabled) {
        this.clear();
      }
    }
    
    if (options.maxSize !== undefined && options.maxSize > 0) {
      this.maxSize = options.maxSize;
      
      // Trim cache if necessary
      while (this.cache.size > this.maxSize) {
        this.evictLeastRecentlyUsed();
      }
    }
    
    if (options.ttl !== undefined && options.ttl > 0) {
      this.ttl = options.ttl;
    }
  }
}