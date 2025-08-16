/**
 * Intelligent Chunk Management System
 * Handles chunk lifecycle, memory management, and object pooling
 */

import { TerrainChunk, TerrainConfig, ChunkPosition } from '../../types/terrain';

export class ChunkManager {
  private chunks = new Map<string, TerrainChunk>();
  private chunkPool: TerrainChunk[] = [];
  private config: TerrainConfig;
  private memoryUsage = 0;
  private maxMemoryUsage: number;

  constructor(config: TerrainConfig, maxMemoryMB: number = 512) {
    this.config = config;
    this.maxMemoryUsage = maxMemoryMB * 1024 * 1024; // Convert to bytes
    this.initializePool();
  }

  private initializePool(): void {
    // Pre-allocate chunk objects for object pooling
    const poolSize = this.config.maxConcurrentChunks * 2;
    
    for (let i = 0; i < poolSize; i++) {
      this.chunkPool.push(this.createEmptyChunk());
    }
  }

  private createEmptyChunk(): TerrainChunk {
    return {
      id: '',
      position: { x: 0, z: 0 },
      worldPosition: { x: 0, z: 0 },
      lodLevel: 0,
      isLoaded: false,
      isGenerated: false,
      vertexCount: 0,
      indexCount: 0,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      },
      lastAccessTime: 0,
      priority: 0
    };
  }

  addChunk(chunk: TerrainChunk): void {
    this.chunks.set(chunk.id, chunk);
    this.updateMemoryUsage(chunk, true);
    
    // Perform memory cleanup if needed
    if (this.memoryUsage > this.maxMemoryUsage) {
      this.performMemoryCleanup();
    }
  }

  removeChunk(chunkId: string): boolean {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return false;
    
    this.updateMemoryUsage(chunk, false);
    this.chunks.delete(chunkId);
    
    // Return chunk to pool after cleanup
    this.recycleChunk(chunk);
    
    return true;
  }

  getChunk(chunkId: string): TerrainChunk | undefined {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      chunk.lastAccessTime = Date.now();
    }
    return chunk;
  }

  getAllChunks(): TerrainChunk[] {
    return Array.from(this.chunks.values());
  }

  getActiveChunkIds(): string[] {
    return Array.from(this.chunks.keys());
  }

  getNearbyChunks(centerPosition: ChunkPosition, radius: number): TerrainChunk[] {
    const nearbyChunks: TerrainChunk[] = [];
    
    for (const chunk of this.chunks.values()) {
      const distance = Math.sqrt(
        Math.pow(chunk.position.x - centerPosition.x, 2) +
        Math.pow(chunk.position.z - centerPosition.z, 2)
      );
      
      if (distance <= radius) {
        nearbyChunks.push(chunk);
      }
    }
    
    return nearbyChunks.sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.position.x - centerPosition.x, 2) +
        Math.pow(a.position.z - centerPosition.z, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.position.x - centerPosition.x, 2) +
        Math.pow(b.position.z - centerPosition.z, 2)
      );
      return distA - distB;
    });
  }

  private updateMemoryUsage(chunk: TerrainChunk, adding: boolean): void {
    // Estimate memory usage based on chunk data
    let chunkMemory = 0;
    
    if (chunk.heightData) {
      chunkMemory += chunk.heightData.byteLength;
    }
    
    if (chunk.vertexBuffer) {
      chunkMemory += chunk.vertexCount * 8 * 4; // 8 floats per vertex
    }
    
    if (chunk.indexBuffer) {
      chunkMemory += chunk.indexCount * 2; // 16-bit indices
    }
    
    if (adding) {
      this.memoryUsage += chunkMemory;
    } else {
      this.memoryUsage = Math.max(0, this.memoryUsage - chunkMemory);
    }
  }

  private performMemoryCleanup(): void {
    const chunks = Array.from(this.chunks.values());
    
    // Sort by last access time (oldest first) and priority (lowest first)
    chunks.sort((a, b) => {
      const timeScore = a.lastAccessTime - b.lastAccessTime;
      const priorityScore = a.priority - b.priority;
      return timeScore + priorityScore * 0.1; // Prioritize by time, with priority as tiebreaker
    });
    
    const targetMemory = this.maxMemoryUsage * 0.8; // Clean up to 80% of max
    
    for (const chunk of chunks) {
      if (this.memoryUsage <= targetMemory) break;
      
      // Don't remove recently accessed or high-priority chunks
      const timeSinceAccess = Date.now() - chunk.lastAccessTime;
      if (timeSinceAccess < 30000 || chunk.priority > 500) continue; // 30 seconds threshold
      
      this.removeChunk(chunk.id);
      
      console.log(`Removed chunk ${chunk.id} during memory cleanup (usage: ${(this.memoryUsage / 1024 / 1024).toFixed(2)}MB)`);
    }
  }

  private recycleChunk(chunk: TerrainChunk): void {
    // Clean up chunk data
    if (chunk.vertexBuffer) {
      chunk.vertexBuffer.destroy();
      chunk.vertexBuffer = undefined;
    }
    
    if (chunk.indexBuffer) {
      chunk.indexBuffer.destroy();
      chunk.indexBuffer = undefined;
    }
    
    chunk.heightData = undefined;
    chunk.generationPromise = undefined;
    
    // Reset chunk to empty state
    const emptyChunk = this.createEmptyChunk();
    Object.assign(chunk, emptyChunk);
    
    // Return to pool if not full
    if (this.chunkPool.length < this.config.maxConcurrentChunks * 2) {
      this.chunkPool.push(chunk);
    }
  }

  getPooledChunk(): TerrainChunk | null {
    return this.chunkPool.pop() || null;
  }

  clear(): void {
    // Cleanup all chunks
    for (const chunk of this.chunks.values()) {
      this.recycleChunk(chunk);
    }
    
    this.chunks.clear();
    this.memoryUsage = 0;
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  getMemoryUsageMB(): number {
    return this.memoryUsage / 1024 / 1024;
  }

  getChunkCount(): number {
    return this.chunks.size;
  }

  // Performance optimization methods
  
  preloadChunks(positions: ChunkPosition[]): void {
    // Mark chunks for preloading (implementation depends on terrain system)
    for (const position of positions) {
      const chunkId = `${position.x}_${position.z}`;
      if (!this.chunks.has(chunkId)) {
        // Create placeholder chunk with high priority
        const chunk = this.getPooledChunk() || this.createEmptyChunk();
        chunk.id = chunkId;
        chunk.position = position;
        chunk.worldPosition = {
          x: position.x * this.config.chunkSize,
          z: position.z * this.config.chunkSize
        };
        chunk.priority = 1000; // High priority for preloading
        chunk.lastAccessTime = Date.now();
        
        this.chunks.set(chunkId, chunk);
      }
    }
  }

  getChunksByLOD(lodLevel: number): TerrainChunk[] {
    return Array.from(this.chunks.values()).filter(chunk => chunk.lodLevel === lodLevel);
  }

  getChunksByPriority(minPriority: number): TerrainChunk[] {
    return Array.from(this.chunks.values())
      .filter(chunk => chunk.priority >= minPriority)
      .sort((a, b) => b.priority - a.priority);
  }

  updateChunkPriorities(playerPosition: ChunkPosition): void {
    const playerChunkX = Math.floor(playerPosition.x);
    const playerChunkZ = Math.floor(playerPosition.z);
    
    for (const chunk of this.chunks.values()) {
      const distance = Math.sqrt(
        Math.pow(chunk.position.x - playerChunkX, 2) +
        Math.pow(chunk.position.z - playerChunkZ, 2)
      );
      
      // Higher priority for closer chunks
      chunk.priority = Math.max(0, 1000 - distance * 10 - chunk.lodLevel * 100);
    }
  }

  getStatistics() {
    const loadedChunks = Array.from(this.chunks.values()).filter(c => c.isLoaded).length;
    const generatedChunks = Array.from(this.chunks.values()).filter(c => c.isGenerated).length;
    const poolSize = this.chunkPool.length;
    
    return {
      totalChunks: this.chunks.size,
      loadedChunks,
      generatedChunks,
      poolSize,
      memoryUsageMB: this.getMemoryUsageMB(),
      memoryUsagePercent: (this.memoryUsage / this.maxMemoryUsage) * 100
    };
  }
}