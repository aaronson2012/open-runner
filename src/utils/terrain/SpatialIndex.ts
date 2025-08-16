/**
 * Spatial Index for Fast Terrain Chunk Queries
 * Enables efficient neighbor searches and spatial operations
 */

import { TerrainChunk, ChunkPosition } from '../../types/terrain';

export class SpatialIndex {
  private grid = new Map<string, Set<string>>();
  private chunks = new Map<string, TerrainChunk>();
  private cellSize: number;
  private readonly gridSize = 1024; // Grid cell size in world units

  constructor(chunkSize: number) {
    this.cellSize = chunkSize;
  }

  addChunk(chunk: TerrainChunk): void {
    this.chunks.set(chunk.id, chunk);
    const gridCells = this.getGridCells(chunk);
    
    for (const cellKey of gridCells) {
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, new Set());
      }
      this.grid.get(cellKey)!.add(chunk.id);
    }
  }

  removeChunk(chunk: TerrainChunk): void {
    this.chunks.delete(chunk.id);
    const gridCells = this.getGridCells(chunk);
    
    for (const cellKey of gridCells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        cell.delete(chunk.id);
        if (cell.size === 0) {
          this.grid.delete(cellKey);
        }
      }
    }
  }

  queryRadius(x: number, z: number, radius: number): TerrainChunk[] {
    const results = new Set<TerrainChunk>();
    const radiusSquared = radius * radius;
    
    // Calculate grid cells to check
    const minX = Math.floor((x - radius) / this.gridSize);
    const maxX = Math.floor((x + radius) / this.gridSize);
    const minZ = Math.floor((z - radius) / this.gridSize);
    const maxZ = Math.floor((z + radius) / this.gridSize);
    
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gz = minZ; gz <= maxZ; gz++) {
        const cellKey = `${gx}_${gz}`;
        const cell = this.grid.get(cellKey);
        
        if (cell) {
          for (const chunkId of cell) {
            const chunk = this.chunks.get(chunkId);
            if (chunk) {
              const distanceSquared = this.getDistanceSquaredToChunk(x, z, chunk);
              if (distanceSquared <= radiusSquared) {
                results.add(chunk);
              }
            }
          }
        }
      }
    }
    
    return Array.from(results).sort((a, b) => {
      const distA = this.getDistanceSquaredToChunk(x, z, a);
      const distB = this.getDistanceSquaredToChunk(x, z, b);
      return distA - distB;
    });
  }

  queryRect(minX: number, minZ: number, maxX: number, maxZ: number): TerrainChunk[] {
    const results = new Set<TerrainChunk>();
    
    // Calculate grid cells to check
    const gridMinX = Math.floor(minX / this.gridSize);
    const gridMaxX = Math.floor(maxX / this.gridSize);
    const gridMinZ = Math.floor(minZ / this.gridSize);
    const gridMaxZ = Math.floor(maxZ / this.gridSize);
    
    for (let gx = gridMinX; gx <= gridMaxX; gx++) {
      for (let gz = gridMinZ; gz <= gridMaxZ; gz++) {
        const cellKey = `${gx}_${gz}`;
        const cell = this.grid.get(cellKey);
        
        if (cell) {
          for (const chunkId of cell) {
            const chunk = this.chunks.get(chunkId);
            if (chunk && this.chunkIntersectsRect(chunk, minX, minZ, maxX, maxZ)) {
              results.add(chunk);
            }
          }
        }
      }
    }
    
    return Array.from(results);
  }

  getNeighbors(chunk: TerrainChunk): TerrainChunk[] {
    const neighbors: TerrainChunk[] = [];
    const { x, z } = chunk.position;
    
    // Check 8 neighboring positions
    const neighborPositions = [
      { x: x - 1, z: z - 1 }, { x: x, z: z - 1 }, { x: x + 1, z: z - 1 },
      { x: x - 1, z: z     },                     { x: x + 1, z: z     },
      { x: x - 1, z: z + 1 }, { x: x, z: z + 1 }, { x: x + 1, z: z + 1 }
    ];
    
    for (const pos of neighborPositions) {
      const neighborId = `${pos.x}_${pos.z}`;
      const neighbor = this.chunks.get(neighborId);
      if (neighbor) {
        neighbors.push(neighbor);
      }
    }
    
    return neighbors;
  }

  getDirectNeighbors(chunk: TerrainChunk): {
    north: TerrainChunk | null;
    south: TerrainChunk | null;
    east: TerrainChunk | null;
    west: TerrainChunk | null;
  } {
    const { x, z } = chunk.position;
    
    return {
      north: this.chunks.get(`${x}_${z - 1}`) || null,
      south: this.chunks.get(`${x}_${z + 1}`) || null,
      east: this.chunks.get(`${x + 1}_${z}`) || null,
      west: this.chunks.get(`${x - 1}_${z}`) || null
    };
  }

  findChunkAt(x: number, z: number): TerrainChunk | null {
    const chunkX = Math.floor(x / this.cellSize);
    const chunkZ = Math.floor(z / this.cellSize);
    const chunkId = `${chunkX}_${chunkZ}`;
    
    return this.chunks.get(chunkId) || null;
  }

  queryLine(startX: number, startZ: number, endX: number, endZ: number): TerrainChunk[] {
    const results = new Set<TerrainChunk>();
    
    // Bresenham-like algorithm for grid traversal
    const dx = Math.abs(endX - startX);
    const dz = Math.abs(endZ - startZ);
    const stepX = startX < endX ? 1 : -1;
    const stepZ = startZ < endZ ? 1 : -1;
    
    let error = dx - dz;
    let currentX = Math.floor(startX / this.gridSize);
    let currentZ = Math.floor(startZ / this.gridSize);
    const targetX = Math.floor(endX / this.gridSize);
    const targetZ = Math.floor(endZ / this.gridSize);
    
    while (true) {
      const cellKey = `${currentX}_${currentZ}`;
      const cell = this.grid.get(cellKey);
      
      if (cell) {
        for (const chunkId of cell) {
          const chunk = this.chunks.get(chunkId);
          if (chunk && this.chunkIntersectsLine(chunk, startX, startZ, endX, endZ)) {
            results.add(chunk);
          }
        }
      }
      
      if (currentX === targetX && currentZ === targetZ) break;
      
      const error2 = 2 * error;
      if (error2 > -dz) {
        error -= dz;
        currentX += stepX;
      }
      if (error2 < dx) {
        error += dx;
        currentZ += stepZ;
      }
    }
    
    return Array.from(results);
  }

  private getGridCells(chunk: TerrainChunk): string[] {
    const cells: string[] = [];
    
    // Calculate grid cells that the chunk spans
    const chunkSize = this.cellSize;
    const minX = chunk.worldPosition.x;
    const maxX = chunk.worldPosition.x + chunkSize;
    const minZ = chunk.worldPosition.z;
    const maxZ = chunk.worldPosition.z + chunkSize;
    
    const gridMinX = Math.floor(minX / this.gridSize);
    const gridMaxX = Math.floor(maxX / this.gridSize);
    const gridMinZ = Math.floor(minZ / this.gridSize);
    const gridMaxZ = Math.floor(maxZ / this.gridSize);
    
    for (let gx = gridMinX; gx <= gridMaxX; gx++) {
      for (let gz = gridMinZ; gz <= gridMaxZ; gz++) {
        cells.push(`${gx}_${gz}`);
      }
    }
    
    return cells;
  }

  private getDistanceSquaredToChunk(x: number, z: number, chunk: TerrainChunk): number {
    const chunkCenterX = chunk.worldPosition.x + this.cellSize / 2;
    const chunkCenterZ = chunk.worldPosition.z + this.cellSize / 2;
    
    const dx = x - chunkCenterX;
    const dz = z - chunkCenterZ;
    
    return dx * dx + dz * dz;
  }

  private chunkIntersectsRect(chunk: TerrainChunk, minX: number, minZ: number, maxX: number, maxZ: number): boolean {
    const chunkMinX = chunk.worldPosition.x;
    const chunkMaxX = chunk.worldPosition.x + this.cellSize;
    const chunkMinZ = chunk.worldPosition.z;
    const chunkMaxZ = chunk.worldPosition.z + this.cellSize;
    
    return !(chunkMaxX < minX || chunkMinX > maxX || chunkMaxZ < minZ || chunkMinZ > maxZ);
  }

  private chunkIntersectsLine(chunk: TerrainChunk, startX: number, startZ: number, endX: number, endZ: number): boolean {
    const chunkMinX = chunk.worldPosition.x;
    const chunkMaxX = chunk.worldPosition.x + this.cellSize;
    const chunkMinZ = chunk.worldPosition.z;
    const chunkMaxZ = chunk.worldPosition.z + this.cellSize;
    
    // Simple line-rectangle intersection test
    // Check if line endpoints are inside chunk
    if ((startX >= chunkMinX && startX <= chunkMaxX && startZ >= chunkMinZ && startZ <= chunkMaxZ) ||
        (endX >= chunkMinX && endX <= chunkMaxX && endZ >= chunkMinZ && endZ <= chunkMaxZ)) {
      return true;
    }
    
    // Check if line intersects chunk edges
    return this.lineIntersectsRect(startX, startZ, endX, endZ, chunkMinX, chunkMinZ, chunkMaxX, chunkMaxZ);
  }

  private lineIntersectsRect(x1: number, z1: number, x2: number, z2: number, 
                            rectMinX: number, rectMinZ: number, rectMaxX: number, rectMaxZ: number): boolean {
    // Line-rectangle intersection using parametric line equation
    const dx = x2 - x1;
    const dz = z2 - z1;
    
    if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) return false;
    
    let tMin = 0;
    let tMax = 1;
    
    // Check intersection with vertical edges
    if (Math.abs(dx) > 0.0001) {
      const t1 = (rectMinX - x1) / dx;
      const t2 = (rectMaxX - x1) / dx;
      
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    } else {
      if (x1 < rectMinX || x1 > rectMaxX) return false;
    }
    
    // Check intersection with horizontal edges
    if (Math.abs(dz) > 0.0001) {
      const t1 = (rectMinZ - z1) / dz;
      const t2 = (rectMaxZ - z1) / dz;
      
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    } else {
      if (z1 < rectMinZ || z1 > rectMaxZ) return false;
    }
    
    return tMin <= tMax;
  }

  clear(): void {
    this.grid.clear();
    this.chunks.clear();
  }

  getStatistics() {
    return {
      totalChunks: this.chunks.size,
      gridCells: this.grid.size,
      averageChunksPerCell: this.chunks.size / Math.max(1, this.grid.size),
      cellSize: this.cellSize,
      gridSize: this.gridSize
    };
  }

  // Debug methods
  
  getGridVisualization(centerX: number, centerZ: number, radius: number): {
    cells: Array<{ x: number, z: number, chunkCount: number }>;
    chunks: TerrainChunk[];
  } {
    const cells: Array<{ x: number, z: number, chunkCount: number }> = [];
    const chunks: TerrainChunk[] = [];
    
    const minGridX = Math.floor((centerX - radius) / this.gridSize);
    const maxGridX = Math.floor((centerX + radius) / this.gridSize);
    const minGridZ = Math.floor((centerZ - radius) / this.gridSize);
    const maxGridZ = Math.floor((centerZ + radius) / this.gridSize);
    
    for (let gx = minGridX; gx <= maxGridX; gx++) {
      for (let gz = minGridZ; gz <= maxGridZ; gz++) {
        const cellKey = `${gx}_${gz}`;
        const cell = this.grid.get(cellKey);
        const chunkCount = cell ? cell.size : 0;
        
        cells.push({ x: gx, z: gz, chunkCount });
        
        if (cell) {
          for (const chunkId of cell) {
            const chunk = this.chunks.get(chunkId);
            if (chunk && !chunks.includes(chunk)) {
              chunks.push(chunk);
            }
          }
        }
      }
    }
    
    return { cells, chunks };
  }
}