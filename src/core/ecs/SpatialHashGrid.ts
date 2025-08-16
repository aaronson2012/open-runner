import type { EntityId, Vector3 } from '@/types';

interface SpatialBounds {
  min: Vector3;
  max: Vector3;
}

interface SpatialEntry {
  entityId: EntityId;
  bounds: SpatialBounds;
  hash: number;
}

/**
 * Spatial hash grid for efficient collision detection and spatial queries
 */
export class SpatialHashGrid {
  private cellSize: number;
  private grid = new Map<number, Set<EntityId>>();
  private entityBounds = new Map<EntityId, SpatialBounds>();
  private entityCells = new Map<EntityId, Set<number>>();
  
  // Performance tracking
  private queryCount = 0;
  private collisionTests = 0;
  private spatialTests = 0;

  constructor(cellSize: number = 10) {
    this.cellSize = cellSize;
  }

  /**
   * Hash a 3D position to a grid cell
   */
  private hash(x: number, y: number, z: number): number {
    // Simple spatial hash function
    const ix = Math.floor(x / this.cellSize);
    const iy = Math.floor(y / this.cellSize);
    const iz = Math.floor(z / this.cellSize);
    
    // Mix the coordinates to create a unique hash
    return ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) >>> 0;
  }

  /**
   * Get all cell hashes that overlap with the given bounds
   */
  private getCellsForBounds(bounds: SpatialBounds): number[] {
    const cells: number[] = [];
    const minCellX = Math.floor(bounds.min.x / this.cellSize);
    const minCellY = Math.floor(bounds.min.y / this.cellSize);
    const minCellZ = Math.floor(bounds.min.z / this.cellSize);
    const maxCellX = Math.floor(bounds.max.x / this.cellSize);
    const maxCellY = Math.floor(bounds.max.y / this.cellSize);
    const maxCellZ = Math.floor(bounds.max.z / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          cells.push(this.hash(x * this.cellSize, y * this.cellSize, z * this.cellSize));
        }
      }
    }

    return cells;
  }

  /**
   * Add or update an entity in the spatial grid
   */
  insert(entityId: EntityId, bounds: SpatialBounds): void {
    // Remove entity if it already exists
    this.remove(entityId);

    // Store bounds
    this.entityBounds.set(entityId, bounds);

    // Get all cells this entity overlaps
    const cells = this.getCellsForBounds(bounds);
    const cellSet = new Set<number>();

    // Add entity to all overlapping cells
    for (const cellHash of cells) {
      if (!this.grid.has(cellHash)) {
        this.grid.set(cellHash, new Set());
      }
      this.grid.get(cellHash)!.add(entityId);
      cellSet.add(cellHash);
    }

    // Store which cells this entity is in
    this.entityCells.set(entityId, cellSet);
  }

  /**
   * Remove an entity from the spatial grid
   */
  remove(entityId: EntityId): void {
    const cells = this.entityCells.get(entityId);
    if (!cells) return;

    // Remove from all cells
    for (const cellHash of cells) {
      const cell = this.grid.get(cellHash);
      if (cell) {
        cell.delete(entityId);
        // Clean up empty cells
        if (cell.size === 0) {
          this.grid.delete(cellHash);
        }
      }
    }

    // Clean up entity data
    this.entityCells.delete(entityId);
    this.entityBounds.delete(entityId);
  }

  /**
   * Query entities within a bounding box
   */
  query(bounds: SpatialBounds): EntityId[] {
    this.queryCount++;
    const result = new Set<EntityId>();
    const cells = this.getCellsForBounds(bounds);

    for (const cellHash of cells) {
      const cell = this.grid.get(cellHash);
      if (cell) {
        for (const entityId of cell) {
          const entityBounds = this.entityBounds.get(entityId);
          if (entityBounds && this.boundsOverlap(bounds, entityBounds)) {
            result.add(entityId);
          }
          this.spatialTests++;
        }
      }
    }

    return Array.from(result);
  }

  /**
   * Query entities within a sphere
   */
  querySphere(center: Vector3, radius: number): EntityId[] {
    const bounds: SpatialBounds = {
      min: {
        x: center.x - radius,
        y: center.y - radius,
        z: center.z - radius
      },
      max: {
        x: center.x + radius,
        y: center.y + radius,
        z: center.z + radius
      }
    };

    const candidates = this.query(bounds);
    const result: EntityId[] = [];

    // Filter by actual sphere distance
    for (const entityId of candidates) {
      const entityBounds = this.entityBounds.get(entityId);
      if (entityBounds) {
        const distance = this.pointToAABBDistance(center, entityBounds);
        if (distance <= radius) {
          result.push(entityId);
        }
      }
    }

    return result;
  }

  /**
   * Query entities along a ray
   */
  queryRay(origin: Vector3, direction: Vector3, maxDistance: number): EntityId[] {
    const normalizedDir = this.normalizeVector(direction);
    const endPoint = {
      x: origin.x + normalizedDir.x * maxDistance,
      y: origin.y + normalizedDir.y * maxDistance,
      z: origin.z + normalizedDir.z * maxDistance
    };

    const bounds: SpatialBounds = {
      min: {
        x: Math.min(origin.x, endPoint.x),
        y: Math.min(origin.y, endPoint.y),
        z: Math.min(origin.z, endPoint.z)
      },
      max: {
        x: Math.max(origin.x, endPoint.x),
        y: Math.max(origin.y, endPoint.y),
        z: Math.max(origin.z, endPoint.z)
      }
    };

    const candidates = this.query(bounds);
    const result: EntityId[] = [];

    // Filter by actual ray intersection
    for (const entityId of candidates) {
      const entityBounds = this.entityBounds.get(entityId);
      if (entityBounds && this.rayIntersectsAABB(origin, normalizedDir, maxDistance, entityBounds)) {
        result.push(entityId);
      }
    }

    return result;
  }

  /**
   * Get all potential collision pairs
   */
  getCollisionPairs(): Array<[EntityId, EntityId]> {
    const pairs: Array<[EntityId, EntityId]> = [];
    const processed = new Set<string>();

    for (const cell of this.grid.values()) {
      const entities = Array.from(cell);
      
      // Check all pairs within this cell
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entityA = entities[i];
          const entityB = entities[j];
          
          // Create a unique pair key (smaller ID first)
          const pairKey = entityA < entityB ? `${entityA}-${entityB}` : `${entityB}-${entityA}`;
          
          if (!processed.has(pairKey)) {
            processed.add(pairKey);
            
            const boundsA = this.entityBounds.get(entityA);
            const boundsB = this.entityBounds.get(entityB);
            
            if (boundsA && boundsB && this.boundsOverlap(boundsA, boundsB)) {
              pairs.push([entityA, entityB]);
            }
            this.collisionTests++;
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Update an entity's position (more efficient than remove + insert)
   */
  update(entityId: EntityId, newBounds: SpatialBounds): void {
    const oldCells = this.entityCells.get(entityId);
    const newCells = new Set(this.getCellsForBounds(newBounds));

    if (oldCells) {
      // Remove from cells no longer occupied
      for (const cellHash of oldCells) {
        if (!newCells.has(cellHash)) {
          const cell = this.grid.get(cellHash);
          if (cell) {
            cell.delete(entityId);
            if (cell.size === 0) {
              this.grid.delete(cellHash);
            }
          }
        }
      }

      // Add to new cells
      for (const cellHash of newCells) {
        if (!oldCells.has(cellHash)) {
          if (!this.grid.has(cellHash)) {
            this.grid.set(cellHash, new Set());
          }
          this.grid.get(cellHash)!.add(entityId);
        }
      }
    } else {
      // Entity doesn't exist, do full insert
      this.insert(entityId, newBounds);
      return;
    }

    // Update stored data
    this.entityBounds.set(entityId, newBounds);
    this.entityCells.set(entityId, newCells);
  }

  /**
   * Check if two bounding boxes overlap
   */
  private boundsOverlap(a: SpatialBounds, b: SpatialBounds): boolean {
    return !(
      a.max.x < b.min.x || a.min.x > b.max.x ||
      a.max.y < b.min.y || a.min.y > b.max.y ||
      a.max.z < b.min.z || a.min.z > b.max.z
    );
  }

  /**
   * Calculate distance from point to AABB
   */
  private pointToAABBDistance(point: Vector3, bounds: SpatialBounds): number {
    const dx = Math.max(0, Math.max(bounds.min.x - point.x, point.x - bounds.max.x));
    const dy = Math.max(0, Math.max(bounds.min.y - point.y, point.y - bounds.max.y));
    const dz = Math.max(0, Math.max(bounds.min.z - point.z, point.z - bounds.max.z));
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Normalize a vector
   */
  private normalizeVector(v: Vector3): Vector3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return {
      x: v.x / length,
      y: v.y / length,
      z: v.z / length
    };
  }

  /**
   * Check if ray intersects AABB
   */
  private rayIntersectsAABB(origin: Vector3, direction: Vector3, maxDistance: number, bounds: SpatialBounds): boolean {
    // Slab method for ray-AABB intersection
    const invDir = {
      x: direction.x === 0 ? Infinity : 1 / direction.x,
      y: direction.y === 0 ? Infinity : 1 / direction.y,
      z: direction.z === 0 ? Infinity : 1 / direction.z
    };

    const t1x = (bounds.min.x - origin.x) * invDir.x;
    const t2x = (bounds.max.x - origin.x) * invDir.x;
    const t1y = (bounds.min.y - origin.y) * invDir.y;
    const t2y = (bounds.max.y - origin.y) * invDir.y;
    const t1z = (bounds.min.z - origin.z) * invDir.z;
    const t2z = (bounds.max.z - origin.z) * invDir.z;

    const tMin = Math.max(
      Math.min(t1x, t2x),
      Math.min(t1y, t2y),
      Math.min(t1z, t2z)
    );
    const tMax = Math.min(
      Math.max(t1x, t2x),
      Math.max(t1y, t2y),
      Math.max(t1z, t2z)
    );

    return tMax >= 0 && tMin <= tMax && tMin <= maxDistance;
  }

  /**
   * Clear all entities from the grid
   */
  clear(): void {
    this.grid.clear();
    this.entityBounds.clear();
    this.entityCells.clear();
    this.resetStats();
  }

  /**
   * Reset performance statistics
   */
  resetStats(): void {
    this.queryCount = 0;
    this.collisionTests = 0;
    this.spatialTests = 0;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      cellCount: this.grid.size,
      entityCount: this.entityBounds.size,
      cellSize: this.cellSize,
      queryCount: this.queryCount,
      collisionTests: this.collisionTests,
      spatialTests: this.spatialTests,
      averageEntitiesPerCell: this.grid.size > 0 
        ? Array.from(this.grid.values()).reduce((sum, cell) => sum + cell.size, 0) / this.grid.size 
        : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    
    // Grid cells
    size += this.grid.size * 64; // Estimated overhead per Map entry
    for (const cell of this.grid.values()) {
      size += cell.size * 8; // 8 bytes per entity ID in Set
    }
    
    // Entity bounds
    size += this.entityBounds.size * (64 + 48); // Map overhead + bounds object
    
    // Entity cells
    size += this.entityCells.size * 64; // Map overhead
    for (const cells of this.entityCells.values()) {
      size += cells.size * 8; // 8 bytes per cell hash in Set
    }
    
    return size;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    const stats = this.getStats();
    const cellOccupancy = new Map<number, number>();
    
    // Calculate cell occupancy distribution
    for (const cell of this.grid.values()) {
      const size = cell.size;
      cellOccupancy.set(size, (cellOccupancy.get(size) || 0) + 1);
    }
    
    return {
      ...stats,
      cellOccupancy: Object.fromEntries(cellOccupancy),
      sampleCells: Array.from(this.grid.entries()).slice(0, 5).map(([hash, entities]) => ({
        hash,
        entityCount: entities.size,
        entities: Array.from(entities).slice(0, 3) // First 3 entities as sample
      }))
    };
  }

  /**
   * Optimize grid by adjusting cell size based on entity distribution
   */
  optimize(): void {
    const stats = this.getStats();
    const avgEntitiesPerCell = stats.averageEntitiesPerCell;
    
    // If too many entities per cell, make cells smaller
    // If too few entities per cell, make cells larger
    if (avgEntitiesPerCell > 10) {
      this.resize(this.cellSize * 0.8);
    } else if (avgEntitiesPerCell < 2 && this.cellSize < 50) {
      this.resize(this.cellSize * 1.2);
    }
  }

  /**
   * Resize the grid and rehash all entities
   */
  private resize(newCellSize: number): void {
    const entities = new Map(this.entityBounds);
    this.cellSize = newCellSize;
    this.clear();
    
    // Re-insert all entities with new cell size
    for (const [entityId, bounds] of entities) {
      this.insert(entityId, bounds);
    }
  }
}