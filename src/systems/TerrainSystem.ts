/**
 * High-Performance Terrain System for Open Runner
 * Features GPU-accelerated generation, intelligent streaming, and LOD management
 */

import { System } from '../core/ecs/World';
import { TerrainComponent } from '../components/TerrainComponent';
import { GPUTerrainGenerator } from '../utils/terrain/GPUTerrainGenerator';
import { ChunkManager } from '../utils/terrain/ChunkManager';
import { SpatialIndex } from '../utils/terrain/SpatialIndex';
import { PerformanceMonitor } from '../utils/terrain/PerformanceMonitor';
import {
  TerrainConfig,
  TerrainChunk,
  ChunkPosition,
  TerrainLevel,
  TerrainPerformanceMetrics,
  TerrainEvent,
  TerrainEventData,
  TERRAIN_LEVELS,
  DEFAULT_TERRAIN_CONFIG
} from '../types/terrain';

export class TerrainSystem extends System {
  private config: TerrainConfig;
  private currentLevel: TerrainLevel;
  private gpuGenerator: GPUTerrainGenerator;
  private chunkManager: ChunkManager;
  private spatialIndex: SpatialIndex;
  private performanceMonitor: PerformanceMonitor;
  private device: GPUDevice | null = null;
  private playerPosition = { x: 0, z: 0 };
  private lastPlayerPosition = { x: 0, z: 0 };
  private frameCount = 0;
  private loadingPromises = new Map<string, Promise<void>>();
  private eventListeners = new Map<TerrainEvent, Set<(data: TerrainEventData) => void>>();

  constructor(config: Partial<TerrainConfig> = {}) {
    super(['terrain']);
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
    this.currentLevel = TERRAIN_LEVELS.forest; // Default to forest
    this.performanceMonitor = new PerformanceMonitor();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize WebGPU
      await this.initializeWebGPU();
      
      // Initialize subsystems
      this.gpuGenerator = new GPUTerrainGenerator(this.device!);
      await this.gpuGenerator.initialize();
      
      this.chunkManager = new ChunkManager(this.config);
      this.spatialIndex = new SpatialIndex(this.config.chunkSize);
      
      this.performanceMonitor.startMonitoring();
      
      console.log('TerrainSystem initialized successfully');
      console.log(`GPU generation: ${this.config.enableGPUGeneration ? 'ENABLED' : 'DISABLED'}`);
      console.log(`Chunk size: ${this.config.chunkSize}, Render distance: ${this.config.renderDistance}`);
    } catch (error) {
      console.error('Failed to initialize TerrainSystem:', error);
      // Fallback to CPU generation
      this.config.enableGPUGeneration = false;
    }
  }

  private async initializeWebGPU(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter');
    }

    this.device = await adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxComputeWorkgroupsPerDimension: 65535,
        maxComputeInvocationsPerWorkgroup: 256,
        maxStorageBufferBindingSize: 1024 * 1024 * 1024 // 1GB
      }
    });

    this.device.lost.then((info) => {
      console.error('WebGPU device lost:', info);
      this.config.enableGPUGeneration = false;
    });
  }

  update(deltaTime: number): void {
    this.frameCount++;
    
    // Update performance monitoring
    this.performanceMonitor.update(deltaTime);
    
    // Check if player moved significantly
    const playerMoved = this.hasPlayerMovedSignificantly();
    
    if (playerMoved || this.frameCount % 60 === 0) { // Check every second
      this.updateChunkVisibility();
      this.lastPlayerPosition = { ...this.playerPosition };
    }
    
    // Process chunk loading/unloading
    this.processChunkUpdates();
    
    // Update component data
    this.updateTerrainComponents();
    
    // Cleanup old chunks periodically
    if (this.frameCount % 300 === 0) { // Every 5 seconds
      this.performMaintenance();
    }
  }

  private hasPlayerMovedSignificantly(): boolean {
    const threshold = this.config.chunkSize / 4; // Quarter chunk movement
    const dx = Math.abs(this.playerPosition.x - this.lastPlayerPosition.x);
    const dz = Math.abs(this.playerPosition.z - this.lastPlayerPosition.z);
    return dx > threshold || dz > threshold;
  }

  private updateChunkVisibility(): void {
    const visibleChunks = this.calculateVisibleChunks();
    const currentChunks = new Set(this.chunkManager.getActiveChunkIds());
    const requiredChunks = new Set(visibleChunks.map(pos => this.getChunkId(pos)));
    
    // Unload chunks that are no longer visible
    for (const chunkId of currentChunks) {
      if (!requiredChunks.has(chunkId)) {
        this.unloadChunk(chunkId);
      }
    }
    
    // Load new visible chunks
    for (const chunkPos of visibleChunks) {
      const chunkId = this.getChunkId(chunkPos);
      if (!currentChunks.has(chunkId)) {
        this.loadChunk(chunkPos);
      }
    }
  }

  private calculateVisibleChunks(): ChunkPosition[] {
    const visibleChunks: ChunkPosition[] = [];
    const playerChunkX = Math.floor(this.playerPosition.x / this.config.chunkSize);
    const playerChunkZ = Math.floor(this.playerPosition.z / this.config.chunkSize);
    const renderChunks = Math.ceil(this.config.renderDistance / this.config.chunkSize);
    
    for (let x = playerChunkX - renderChunks; x <= playerChunkX + renderChunks; x++) {
      for (let z = playerChunkZ - renderChunks; z <= playerChunkZ + renderChunks; z++) {
        const distance = Math.sqrt(
          Math.pow(x - playerChunkX, 2) + Math.pow(z - playerChunkZ, 2)
        );
        
        if (distance <= renderChunks) {
          visibleChunks.push({ x, z });
        }
      }
    }
    
    // Sort by distance for priority loading
    visibleChunks.sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.x - playerChunkX, 2) + Math.pow(a.z - playerChunkZ, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.x - playerChunkX, 2) + Math.pow(b.z - playerChunkZ, 2)
      );
      return distA - distB;
    });
    
    return visibleChunks;
  }

  private loadChunk(position: ChunkPosition): void {
    const chunkId = this.getChunkId(position);
    
    if (this.loadingPromises.has(chunkId)) {
      return; // Already loading
    }
    
    const distance = this.getDistanceToPlayer(position);
    const lodLevel = this.calculateLODLevel(distance);
    
    const chunk: TerrainChunk = {
      id: chunkId,
      position,
      worldPosition: {
        x: position.x * this.config.chunkSize,
        z: position.z * this.config.chunkSize
      },
      lodLevel,
      isLoaded: false,
      isGenerated: false,
      vertexCount: 0,
      indexCount: 0,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      },
      lastAccessTime: Date.now(),
      priority: this.calculateChunkPriority(distance, lodLevel)
    };
    
    // Start async generation
    const loadingPromise = this.generateChunkAsync(chunk);
    this.loadingPromises.set(chunkId, loadingPromise);
    
    loadingPromise
      .then(() => {
        this.chunkManager.addChunk(chunk);
        this.spatialIndex.addChunk(chunk);
        chunk.isLoaded = true;
        
        this.emitEvent(TerrainEvent.ChunkLoaded, {
          type: TerrainEvent.ChunkLoaded,
          chunkId: chunk.id,
          position: chunk.position,
          lodLevel: chunk.lodLevel
        });
      })
      .catch((error) => {
        console.error(`Failed to load chunk ${chunkId}:`, error);
      })
      .finally(() => {
        this.loadingPromises.delete(chunkId);
      });
  }

  private unloadChunk(chunkId: string): void {
    const chunk = this.chunkManager.getChunk(chunkId);
    if (!chunk) return;
    
    // Cleanup GPU resources
    if (chunk.vertexBuffer) {
      chunk.vertexBuffer.destroy();
    }
    if (chunk.indexBuffer) {
      chunk.indexBuffer.destroy();
    }
    
    this.chunkManager.removeChunk(chunkId);
    this.spatialIndex.removeChunk(chunk);
    
    this.emitEvent(TerrainEvent.ChunkUnloaded, {
      type: TerrainEvent.ChunkUnloaded,
      chunkId: chunk.id,
      position: chunk.position
    });
  }

  private async generateChunkAsync(chunk: TerrainChunk): Promise<void> {
    const startTime = performance.now();
    
    try {
      if (this.config.enableGPUGeneration && this.gpuGenerator) {
        await this.gpuGenerator.generateChunkAsync(chunk, this.currentLevel.noiseParams);
      } else {
        await this.generateChunkCPU(chunk);
      }
      
      const generationTime = performance.now() - startTime;
      this.performanceMonitor.recordChunkGeneration(generationTime);
      
    } catch (error) {
      console.error(`Chunk generation failed for ${chunk.id}:`, error);
      throw error;
    }
  }

  private async generateChunkCPU(chunk: TerrainChunk): Promise<void> {
    // Fallback CPU implementation
    const chunkSize = this.config.chunkSize;
    const vertices = new Float32Array(chunkSize * chunkSize * 8); // pos + normal + uv
    const indices = new Uint16Array((chunkSize - 1) * (chunkSize - 1) * 6);
    const heightData = new Float32Array(chunkSize * chunkSize);
    
    // Generate height data using noise
    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunk.worldPosition.x + x;
        const worldZ = chunk.worldPosition.z + z;
        const height = this.sampleNoise(worldX, worldZ);
        heightData[x + z * chunkSize] = height;
      }
    }
    
    // Generate vertices and normals
    this.generateCPUVertices(chunk, vertices, heightData, chunkSize);
    this.generateCPUIndices(indices, chunkSize);
    
    // Create GPU buffers if device available
    if (this.device) {
      chunk.vertexBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      
      chunk.indexBuffer = this.device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });
      
      this.device.queue.writeBuffer(chunk.vertexBuffer, 0, vertices);
      this.device.queue.writeBuffer(chunk.indexBuffer, 0, indices);
    }
    
    chunk.heightData = heightData;
    chunk.vertexCount = vertices.length / 8;
    chunk.indexCount = indices.length;
    chunk.isGenerated = true;
  }

  private sampleNoise(x: number, z: number): number {
    const params = this.currentLevel.noiseParams;
    let value = 0;
    let amplitude = params.amplitude;
    let frequency = params.frequency;
    let maxValue = 0;
    
    for (let i = 0; i < params.octaves; i++) {
      value += this.simplexNoise2D(x * frequency + params.seed, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= params.persistence;
      frequency *= params.lacunarity;
    }
    
    return value / maxValue;
  }

  private simplexNoise2D(x: number, z: number): number {
    // Simplified 2D simplex noise implementation
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    
    const s = (x + z) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(z + s);
    
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const z0 = z - (j - t);
    
    let i1, j1;
    if (x0 > z0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }
    
    const x1 = x0 - i1 + G2;
    const z1 = z0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const z2 = z0 - 1.0 + 2.0 * G2;
    
    const gi0 = ((i & 255) + (j & 255) * 57) % 12;
    const gi1 = (((i + i1) & 255) + ((j + j1) & 255) * 57) % 12;
    const gi2 = (((i + 1) & 255) + ((j + 1) & 255) * 57) % 12;
    
    let n0 = 0, n1 = 0, n2 = 0;
    
    let t0 = 0.5 - x0 * x0 - z0 * z0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.gradDot2D(gi0, x0, z0);
    }
    
    let t1 = 0.5 - x1 * x1 - z1 * z1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.gradDot2D(gi1, x1, z1);
    }
    
    let t2 = 0.5 - x2 * x2 - z2 * z2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.gradDot2D(gi2, x2, z2);
    }
    
    return 70.0 * (n0 + n1 + n2);
  }

  private gradDot2D(gi: number, x: number, z: number): number {
    const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
    return grad[gi][0] * x + grad[gi][1] * z;
  }

  private generateCPUVertices(
    chunk: TerrainChunk,
    vertices: Float32Array,
    heightData: Float32Array,
    chunkSize: number
  ): void {
    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const index = (x + z * chunkSize) * 8;
        const height = heightData[x + z * chunkSize];
        
        // Position
        vertices[index + 0] = chunk.worldPosition.x + x;
        vertices[index + 1] = height;
        vertices[index + 2] = chunk.worldPosition.z + z;
        
        // Normal (simplified calculation)
        const normal = this.calculateNormal(x, z, chunkSize, heightData);
        vertices[index + 3] = normal.x;
        vertices[index + 4] = normal.y;
        vertices[index + 5] = normal.z;
        
        // UV
        vertices[index + 6] = x / (chunkSize - 1);
        vertices[index + 7] = z / (chunkSize - 1);
      }
    }
  }

  private calculateNormal(x: number, z: number, chunkSize: number, heightData: Float32Array): { x: number, y: number, z: number } {
    const heightScale = 0.1;
    
    const heightL = x > 0 ? heightData[(x - 1) + z * chunkSize] : heightData[x + z * chunkSize];
    const heightR = x < chunkSize - 1 ? heightData[(x + 1) + z * chunkSize] : heightData[x + z * chunkSize];
    const heightD = z > 0 ? heightData[x + (z - 1) * chunkSize] : heightData[x + z * chunkSize];
    const heightU = z < chunkSize - 1 ? heightData[x + (z + 1) * chunkSize] : heightData[x + z * chunkSize];
    
    const dx = (heightR - heightL) * heightScale;
    const dz = (heightU - heightD) * heightScale;
    
    const length = Math.sqrt(dx * dx + 4 + dz * dz);
    return {
      x: -dx / length,
      y: 2 / length,
      z: -dz / length
    };
  }

  private generateCPUIndices(indices: Uint16Array, chunkSize: number): void {
    let indexPos = 0;
    
    for (let z = 0; z < chunkSize - 1; z++) {
      for (let x = 0; x < chunkSize - 1; x++) {
        const topLeft = x + z * chunkSize;
        const topRight = (x + 1) + z * chunkSize;
        const bottomLeft = x + (z + 1) * chunkSize;
        const bottomRight = (x + 1) + (z + 1) * chunkSize;
        
        indices[indexPos++] = topLeft;
        indices[indexPos++] = bottomLeft;
        indices[indexPos++] = topRight;
        
        indices[indexPos++] = topRight;
        indices[indexPos++] = bottomLeft;
        indices[indexPos++] = bottomRight;
      }
    }
  }

  private calculateLODLevel(distance: number): number {
    const lodDistance = this.config.renderDistance / this.config.lodLevels;
    return Math.min(Math.floor(distance / lodDistance), this.config.lodLevels - 1);
  }

  private calculateChunkPriority(distance: number, lodLevel: number): number {
    return Math.max(0, 1000 - distance * 10 - lodLevel * 100);
  }

  private getDistanceToPlayer(position: ChunkPosition): number {
    const chunkCenterX = position.x * this.config.chunkSize + this.config.chunkSize / 2;
    const chunkCenterZ = position.z * this.config.chunkSize + this.config.chunkSize / 2;
    
    return Math.sqrt(
      Math.pow(this.playerPosition.x - chunkCenterX, 2) +
      Math.pow(this.playerPosition.z - chunkCenterZ, 2)
    );
  }

  private getChunkId(position: ChunkPosition): string {
    return `${position.x}_${position.z}`;
  }

  private processChunkUpdates(): void {
    // Update chunk priorities based on current player position
    for (const chunk of this.chunkManager.getAllChunks()) {
      const distance = this.getDistanceToPlayer(chunk.position);
      const newLOD = this.calculateLODLevel(distance);
      
      if (newLOD !== chunk.lodLevel) {
        chunk.lodLevel = newLOD;
        chunk.priority = this.calculateChunkPriority(distance, newLOD);
        
        // Potentially regenerate chunk with new LOD
        if (Math.abs(newLOD - chunk.lodLevel) > 1) {
          this.loadChunk(chunk.position); // This will replace the chunk
        }
        
        this.emitEvent(TerrainEvent.LODChanged, {
          type: TerrainEvent.LODChanged,
          chunkId: chunk.id,
          lodLevel: newLOD
        });
      }
      
      chunk.lastAccessTime = Date.now();
    }
  }

  private updateTerrainComponents(): void {
    // Update terrain components with current state
    for (const entity of this.entities) {
      const terrainComponent = this.world.getComponent(entity, TerrainComponent);
      if (terrainComponent) {
        terrainComponent.activeChunks = this.chunkManager.getActiveChunkIds().length;
        terrainComponent.loadingChunks = this.loadingPromises.size;
        terrainComponent.performanceMetrics = this.performanceMonitor.getMetrics();
      }
    }
  }

  private performMaintenance(): void {
    const currentTime = Date.now();
    const maxAge = 300000; // 5 minutes
    
    // Remove old chunks that haven't been accessed recently
    for (const chunk of this.chunkManager.getAllChunks()) {
      if (currentTime - chunk.lastAccessTime > maxAge) {
        const distance = this.getDistanceToPlayer(chunk.position);
        if (distance > this.config.renderDistance * 1.5) {
          this.unloadChunk(chunk.id);
        }
      }
    }
    
    // Check performance and emit warnings if needed
    const metrics = this.performanceMonitor.getMetrics();
    if (metrics.averageFrameTime > 20) { // 50fps threshold
      this.emitEvent(TerrainEvent.PerformanceWarning, {
        type: TerrainEvent.PerformanceWarning,
        metrics: metrics
      });
    }
  }

  // Public API methods
  
  setPlayerPosition(x: number, z: number): void {
    this.playerPosition = { x, z };
  }

  setTerrainLevel(levelName: keyof typeof TERRAIN_LEVELS): void {
    if (TERRAIN_LEVELS[levelName]) {
      this.currentLevel = TERRAIN_LEVELS[levelName];
      
      // Clear existing chunks to regenerate with new parameters
      this.chunkManager.clear();
      this.spatialIndex.clear();
    }
  }

  getHeightAtPosition(x: number, z: number): number {
    const chunkX = Math.floor(x / this.config.chunkSize);
    const chunkZ = Math.floor(z / this.config.chunkSize);
    const chunkId = this.getChunkId({ x: chunkX, z: chunkZ });
    
    const chunk = this.chunkManager.getChunk(chunkId);
    if (!chunk || !chunk.heightData) {
      return 0; // Return default height if chunk not loaded
    }
    
    const localX = Math.floor(x - chunk.worldPosition.x);
    const localZ = Math.floor(z - chunk.worldPosition.z);
    
    if (localX >= 0 && localX < this.config.chunkSize && 
        localZ >= 0 && localZ < this.config.chunkSize) {
      return chunk.heightData[localX + localZ * this.config.chunkSize];
    }
    
    return 0;
  }

  getNearbyChunks(x: number, z: number, radius: number): TerrainChunk[] {
    return this.spatialIndex.queryRadius(x, z, radius);
  }

  getPerformanceMetrics(): TerrainPerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  // Event system
  
  addEventListener(event: TerrainEvent, callback: (data: TerrainEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  removeEventListener(event: TerrainEvent, callback: (data: TerrainEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emitEvent(event: TerrainEvent, data: TerrainEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in terrain event listener:`, error);
        }
      }
    }
  }

  // Cleanup
  
  destroy(): void {
    this.performanceMonitor.stopMonitoring();
    this.chunkManager.clear();
    this.spatialIndex.clear();
    this.gpuGenerator?.destroy();
    this.loadingPromises.clear();
    this.eventListeners.clear();
    
    if (this.device) {
      this.device.destroy();
    }
  }
}