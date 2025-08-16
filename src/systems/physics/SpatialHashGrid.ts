import type { Vector3, EntityId } from '@/types';
import * as THREE from 'three';

/**
 * High-performance spatial hash grid for O(1) neighbor queries
 * Optimized for collision detection and spatial partitioning
 */
export interface SpatialObject {
  entityId: EntityId;
  position: Vector3;
  bounds: AABB;
  lastCellKey?: string;
  userData?: any;
}

export interface AABB {
  min: Vector3;
  max: Vector3;
}

export interface QueryResult {
  objects: SpatialObject[];
  cellsChecked: number;
  totalChecks: number;
}

export class SpatialHashGrid {
  private cellSize: number;
  private invCellSize: number;
  private grid: Map<string, Set<SpatialObject>>;
  private objectToCells: Map<EntityId, Set<string>>;
  private objectPool: SpatialObject[];
  private queryResultPool: QueryResult[];
  
  // Performance tracking
  private stats = {
    totalObjects: 0,
    totalCells: 0,
    queriesThisFrame: 0,
    updatesThisFrame: 0,
    avgObjectsPerCell: 0,
    maxObjectsInCell: 0
  };

  constructor(cellSize: number = 10.0) {
    if (cellSize <= 0) {
      throw new Error('SpatialHashGrid: cellSize must be positive');
    }
    
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.grid = new Map();
    this.objectToCells = new Map();
    this.objectPool = [];
    this.queryResultPool = [];
  }

  /**
   * Convert world position to grid coordinates
   */
  private worldToGrid(position: Vector3): { x: number; y: number; z: number } {
    return {
      x: Math.floor(position.x * this.invCellSize),
      y: Math.floor(position.y * this.invCellSize),
      z: Math.floor(position.z * this.invCellSize)
    };
  }

  /**
   * Generate cell key from grid coordinates
   */
  private gridToKey(gridX: number, gridY: number, gridZ: number): string {
    return `${gridX},${gridY},${gridZ}`;
  }

  /**
   * Get all cell keys that an AABB overlaps
   */
  private getOverlappingCells(bounds: AABB): string[] {
    const minGrid = this.worldToGrid(bounds.min);
    const maxGrid = this.worldToGrid(bounds.max);
    
    const cells: string[] = [];
    
    for (let x = minGrid.x; x <= maxGrid.x; x++) {
      for (let y = minGrid.y; y <= maxGrid.y; y++) {
        for (let z = minGrid.z; z <= maxGrid.z; z++) {
          cells.push(this.gridToKey(x, y, z));
        }
      }
    }
    
    return cells;
  }

  /**
   * Add or update an object in the grid
   */
  add(object: SpatialObject): void {
    this.stats.updatesThisFrame++;
    
    // Remove from old cells if it exists
    this.remove(object.entityId);
    
    const cellKeys = this.getOverlappingCells(object.bounds);
    const cellSet = new Set<string>();
    
    for (const cellKey of cellKeys) {
      // Get or create cell
      let cell = this.grid.get(cellKey);
      if (!cell) {
        cell = new Set();
        this.grid.set(cellKey, cell);
        this.stats.totalCells++;
      }
      
      cell.add(object);
      cellSet.add(cellKey);
      
      // Update max objects per cell
      this.stats.maxObjectsInCell = Math.max(this.stats.maxObjectsInCell, cell.size);
    }
    
    this.objectToCells.set(object.entityId, cellSet);
    this.stats.totalObjects++;
  }

  /**
   * Remove an object from the grid
   */
  remove(entityId: EntityId): boolean {
    const cellSet = this.objectToCells.get(entityId);
    if (!cellSet) return false;
    
    let objectToRemove: SpatialObject | null = null;
    
    // Remove from all cells
    for (const cellKey of cellSet) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        // Find the object with matching entityId
        for (const obj of cell) {
          if (obj.entityId === entityId) {
            objectToRemove = obj;
            break;
          }
        }
        
        if (objectToRemove) {
          cell.delete(objectToRemove);
          
          // Clean up empty cells
          if (cell.size === 0) {
            this.grid.delete(cellKey);
            this.stats.totalCells--;
          }
        }
      }
    }
    
    this.objectToCells.delete(entityId);
    
    if (objectToRemove) {
      this.stats.totalObjects--;
      // Return object to pool for reuse
      this.objectPool.push(objectToRemove);
      return true;
    }
    
    return false;
  }

  /**
   * Update an object's position (more efficient than remove+add)
   */
  update(entityId: EntityId, newBounds: AABB): boolean {
    const cellSet = this.objectToCells.get(entityId);
    if (!cellSet) return false;
    
    const newCellKeys = this.getOverlappingCells(newBounds);
    const newCellSet = new Set(newCellKeys);
    
    // Check if cells have changed
    if (cellSet.size === newCellSet.size && 
        [...cellSet].every(key => newCellSet.has(key))) {
      // Object hasn't moved to different cells, just update bounds
      for (const cellKey of cellSet) {
        const cell = this.grid.get(cellKey);
        if (cell) {
          for (const obj of cell) {
            if (obj.entityId === entityId) {
              obj.bounds = newBounds;
              return true;
            }
          }
        }
      }
      return false;
    }
    
    // Object moved to different cells, need to relocate
    let objectToMove: SpatialObject | null = null;
    
    // Find and remove from old cells
    for (const cellKey of cellSet) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const obj of cell) {
          if (obj.entityId === entityId) {
            objectToMove = obj;
            cell.delete(obj);
            
            if (cell.size === 0) {
              this.grid.delete(cellKey);
              this.stats.totalCells--;
            }
            break;
          }
        }
      }
    }
    
    if (!objectToMove) return false;
    
    // Update bounds
    objectToMove.bounds = newBounds;
    
    // Add to new cells
    for (const cellKey of newCellKeys) {
      let cell = this.grid.get(cellKey);
      if (!cell) {
        cell = new Set();
        this.grid.set(cellKey, cell);
        this.stats.totalCells++;
      }
      
      cell.add(objectToMove);
      this.stats.maxObjectsInCell = Math.max(this.stats.maxObjectsInCell, cell.size);
    }
    
    this.objectToCells.set(entityId, newCellSet);
    this.stats.updatesThisFrame++;
    
    return true;
  }

  /**
   * Query objects within a radius of a point
   */
  queryRadius(center: Vector3, radius: number): QueryResult {
    this.stats.queriesThisFrame++;
    
    const result = this.getQueryResult();
    const radiusSq = radius * radius;
    
    // Create bounding box for the query
    const bounds: AABB = {
      min: { x: center.x - radius, y: center.y - radius, z: center.z - radius },
      max: { x: center.x + radius, y: center.y + radius, z: center.z + radius }
    };
    
    const cellKeys = this.getOverlappingCells(bounds);
    const checkedObjects = new Set<EntityId>();
    
    result.cellsChecked = cellKeys.length;
    
    for (const cellKey of cellKeys) {
      const cell = this.grid.get(cellKey);
      if (!cell) continue;
      
      for (const obj of cell) {
        if (checkedObjects.has(obj.entityId)) continue;
        checkedObjects.add(obj.entityId);
        
        result.totalChecks++;
        
        // Distance check
        const dx = obj.position.x - center.x;
        const dy = obj.position.y - center.y;
        const dz = obj.position.z - center.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq <= radiusSq) {
          result.objects.push(obj);
        }
      }
    }
    
    return result;
  }

  /**
   * Query objects within an AABB
   */
  queryAABB(bounds: AABB): QueryResult {
    this.stats.queriesThisFrame++;
    
    const result = this.getQueryResult();
    const cellKeys = this.getOverlappingCells(bounds);
    const checkedObjects = new Set<EntityId>();
    
    result.cellsChecked = cellKeys.length;
    
    for (const cellKey of cellKeys) {
      const cell = this.grid.get(cellKey);
      if (!cell) continue;
      
      for (const obj of cell) {
        if (checkedObjects.has(obj.entityId)) continue;
        checkedObjects.add(obj.entityId);
        
        result.totalChecks++;
        
        // AABB intersection test
        if (this.aabbIntersect(obj.bounds, bounds)) {
          result.objects.push(obj);
        }
      }
    }
    
    return result;
  }

  /**
   * Query objects along a ray
   */
  queryRay(origin: Vector3, direction: Vector3, maxDistance: number): QueryResult {
    this.stats.queriesThisFrame++;
    
    const result = this.getQueryResult();
    const normalizedDir = this.normalize(direction);
    const endPoint = {
      x: origin.x + normalizedDir.x * maxDistance,
      y: origin.y + normalizedDir.y * maxDistance,
      z: origin.z + normalizedDir.z * maxDistance
    };
    
    // Create AABB containing the ray
    const bounds: AABB = {
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
    
    const cellKeys = this.getOverlappingCells(bounds);
    const checkedObjects = new Set<EntityId>();
    
    result.cellsChecked = cellKeys.length;
    
    for (const cellKey of cellKeys) {
      const cell = this.grid.get(cellKey);
      if (!cell) continue;
      
      for (const obj of cell) {
        if (checkedObjects.has(obj.entityId)) continue;
        checkedObjects.add(obj.entityId);
        
        result.totalChecks++;
        
        // Ray-AABB intersection test
        if (this.rayAABBIntersect(origin, normalizedDir, obj.bounds, maxDistance)) {
          result.objects.push(obj);
        }
      }
    }
    
    return result;
  }

  /**
   * Get all objects in the grid
   */
  getAllObjects(): SpatialObject[] {
    const allObjects: SpatialObject[] = [];
    const processedObjects = new Set<EntityId>();
    
    for (const cell of this.grid.values()) {
      for (const obj of cell) {
        if (!processedObjects.has(obj.entityId)) {
          allObjects.push(obj);
          processedObjects.add(obj.entityId);
        }
      }
    }
    
    return allObjects;
  }

  /**
   * Clear all objects from the grid
   */
  clear(): void {
    this.grid.clear();
    this.objectToCells.clear();
    this.stats.totalObjects = 0;
    this.stats.totalCells = 0;
    this.stats.maxObjectsInCell = 0;
  }

  /**
   * Optimize the grid by rebuilding with better cell size
   */
  optimize(): void {
    if (this.stats.totalObjects === 0) return;
    
    // Calculate optimal cell size based on object distribution
    const objects = this.getAllObjects();
    let totalSize = 0;
    
    for (const obj of objects) {
      const size = Math.max(
        obj.bounds.max.x - obj.bounds.min.x,
        obj.bounds.max.y - obj.bounds.min.y,
        obj.bounds.max.z - obj.bounds.min.z
      );
      totalSize += size;
    }
    
    const averageSize = totalSize / objects.length;
    const optimalCellSize = averageSize * 2; // Rule of thumb: 2x average object size
    
    if (Math.abs(optimalCellSize - this.cellSize) > this.cellSize * 0.1) {
      // Rebuild with new cell size
      const oldObjects = objects;
      this.cellSize = optimalCellSize;
      this.invCellSize = 1.0 / optimalCellSize;
      this.clear();
      
      for (const obj of oldObjects) {
        this.add(obj);
      }
    }
  }

  /**
   * Reset frame statistics
   */
  resetFrameStats(): void {
    this.stats.queriesThisFrame = 0;
    this.stats.updatesThisFrame = 0;
    
    // Calculate average objects per cell
    if (this.stats.totalCells > 0) {
      this.stats.avgObjectsPerCell = this.stats.totalObjects / this.stats.totalCells;
    } else {
      this.stats.avgObjectsPerCell = 0;
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return { ...this.stats };
  }

  // Helper methods
  private getQueryResult(): QueryResult {
    const result = this.queryResultPool.pop() || {
      objects: [],
      cellsChecked: 0,
      totalChecks: 0
    };
    
    result.objects.length = 0;
    result.cellsChecked = 0;
    result.totalChecks = 0;
    
    return result;
  }

  private returnQueryResult(result: QueryResult): void {
    this.queryResultPool.push(result);
  }

  private aabbIntersect(a: AABB, b: AABB): boolean {
    return (
      a.min.x <= b.max.x && a.max.x >= b.min.x &&
      a.min.y <= b.max.y && a.max.y >= b.min.y &&
      a.min.z <= b.max.z && a.max.z >= b.min.z
    );
  }

  private rayAABBIntersect(origin: Vector3, direction: Vector3, aabb: AABB, maxDistance: number): boolean {
    // Ray-AABB intersection using slab method
    let tmin = 0;
    let tmax = maxDistance;
    
    // Check each axis
    for (const axis of ['x', 'y', 'z'] as const) {
      if (Math.abs(direction[axis]) < 0.0001) {
        // Ray is parallel to this axis
        if (origin[axis] < aabb.min[axis] || origin[axis] > aabb.max[axis]) {
          return false;
        }
      } else {
        const invDir = 1.0 / direction[axis];
        let t1 = (aabb.min[axis] - origin[axis]) * invDir;
        let t2 = (aabb.max[axis] - origin[axis]) * invDir;
        
        if (t1 > t2) {
          [t1, t2] = [t2, t1];
        }
        
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        
        if (tmin > tmax) {
          return false;
        }
      }
    }
    
    return tmin <= maxDistance;
  }

  private normalize(vector: Vector3): Vector3 {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    
    return {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length
    };
  }

  // Debug visualization
  getDebugInfo() {
    return {
      cellSize: this.cellSize,
      totalObjects: this.stats.totalObjects,
      totalCells: this.stats.totalCells,
      avgObjectsPerCell: this.stats.avgObjectsPerCell,
      maxObjectsInCell: this.stats.maxObjectsInCell,
      queriesThisFrame: this.stats.queriesThisFrame,
      updatesThisFrame: this.stats.updatesThisFrame,
      memoryUsage: {
        gridSize: this.grid.size,
        objectToCellsSize: this.objectToCells.size,
        pooledObjects: this.objectPool.length,
        pooledResults: this.queryResultPool.length
      }
    };
  }
}

export default SpatialHashGrid;