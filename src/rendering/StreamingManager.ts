import * as THREE from 'three';
import type { ResourceManager } from './ResourceManager';
import type { StreamingConfig, Vector3 } from '@/types';

export class StreamingManager {
  private resourceManager: ResourceManager;
  private config: StreamingConfig;
  
  // Streaming state
  private streamingChunks: Map<string, StreamingChunk> = new Map();
  private loadingChunks: Set<string> = new Set();
  private activeChunks: Set<string> = new Set();
  private lastPlayerPosition: Vector3 = { x: 0, y: 0, z: 0 };
  
  // Performance tracking
  private loadingQueue: LoadingQueue = new LoadingQueue();
  private networkBandwidth = 1; // MB/s estimate
  private loadingStats = {
    totalLoaded: 0,
    totalFailed: 0,
    averageLoadTime: 0,
    bandwidth: 0
  };
  
  // Web Workers for background loading
  private workers: Worker[] = [];
  private workerPool: WorkerPool;
  
  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
    this.config = {
      enabled: true,
      chunkSize: 100,
      preloadDistance: 200,
      unloadDistance: 400,
      maxConcurrentLoads: 4
    };
    
    this.workerPool = new WorkerPool(2); // 2 workers for asset loading
    this.detectNetworkCapabilities();
    
    console.log('StreamingManager initialized');
  }

  private detectNetworkCapabilities(): void {
    // Detect network connection
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      
      // Estimate bandwidth based on connection type
      const bandwidthEstimates = {
        'slow-2g': 0.05,  // 50 KB/s
        '2g': 0.25,       // 250 KB/s
        '3g': 0.75,       // 750 KB/s
        '4g': 2.0,        // 2 MB/s
        '5g': 10.0        // 10 MB/s
      };
      
      this.networkBandwidth = bandwidthEstimates[effectiveType] || 1.0;
      
      console.log('Network capabilities detected:', {
        effectiveType,
        estimatedBandwidth: this.networkBandwidth + ' MB/s',
        downlink: connection.downlink,
        rtt: connection.rtt
      });
      
      // Adjust config based on network
      this.adjustConfigForNetwork(effectiveType);
    }
  }

  private adjustConfigForNetwork(networkType: string): void {
    switch (networkType) {
      case 'slow-2g':
      case '2g':
        this.config.chunkSize = 50;
        this.config.maxConcurrentLoads = 1;
        this.config.preloadDistance = 100;
        break;
      case '3g':
        this.config.chunkSize = 75;
        this.config.maxConcurrentLoads = 2;
        this.config.preloadDistance = 150;
        break;
      case '4g':
      case '5g':
        this.config.chunkSize = 100;
        this.config.maxConcurrentLoads = 4;
        this.config.preloadDistance = 200;
        break;
    }
    
    console.log('Streaming config adjusted for network:', this.config);
  }

  update(playerPosition: Vector3): void {
    if (!this.config.enabled) return;
    
    this.lastPlayerPosition = { ...playerPosition };
    
    // Update active chunks based on player position
    this.updateActiveChunks(playerPosition);
    
    // Process loading queue
    this.processLoadingQueue();
    
    // Unload distant chunks
    this.unloadDistantChunks(playerPosition);
  }

  private updateActiveChunks(playerPosition: Vector3): void {
    const currentChunk = this.getChunkId(playerPosition);
    const preloadRadius = Math.ceil(this.config.preloadDistance / this.config.chunkSize);
    
    // Calculate chunks to load
    const chunksToLoad: string[] = [];
    
    for (let x = -preloadRadius; x <= preloadRadius; x++) {
      for (let z = -preloadRadius; z <= preloadRadius; z++) {
        const chunkX = Math.floor(playerPosition.x / this.config.chunkSize) + x;
        const chunkZ = Math.floor(playerPosition.z / this.config.chunkSize) + z;
        const chunkId = `${chunkX},${chunkZ}`;
        
        const distance = Math.sqrt(x * x + z * z) * this.config.chunkSize;
        
        if (distance <= this.config.preloadDistance) {
          if (!this.activeChunks.has(chunkId) && !this.loadingChunks.has(chunkId)) {
            chunksToLoad.push(chunkId);
          }
        }
      }
    }
    
    // Add to loading queue with priority based on distance
    for (const chunkId of chunksToLoad) {
      const [chunkX, chunkZ] = chunkId.split(',').map(Number);
      const chunkCenter = {
        x: chunkX * this.config.chunkSize + this.config.chunkSize / 2,
        y: 0,
        z: chunkZ * this.config.chunkSize + this.config.chunkSize / 2
      };
      
      const distance = this.calculateDistance(playerPosition, chunkCenter);
      const priority = Math.max(0, this.config.preloadDistance - distance);
      
      this.loadingQueue.add({
        id: chunkId,
        type: 'chunk',
        priority,
        estimatedSize: this.estimateChunkSize(),
        callback: () => this.loadChunk(chunkId)
      });
    }
  }

  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private getChunkId(position: Vector3): string {
    const chunkX = Math.floor(position.x / this.config.chunkSize);
    const chunkZ = Math.floor(position.z / this.config.chunkSize);
    return `${chunkX},${chunkZ}`;
  }

  private estimateChunkSize(): number {
    // Estimate chunk size in bytes (this would be based on actual content)
    return 1024 * 1024; // 1MB estimate
  }

  private async loadChunk(chunkId: string): Promise<void> {
    if (this.loadingChunks.has(chunkId) || this.activeChunks.has(chunkId)) {
      return;
    }
    
    this.loadingChunks.add(chunkId);
    
    const startTime = performance.now();
    
    try {
      console.log('Loading chunk:', chunkId);
      
      // Generate chunk content (in a real implementation, this would load from server)
      const chunkData = await this.generateChunkData(chunkId);
      
      // Create streaming chunk
      const chunk = new StreamingChunk(chunkId, chunkData);
      this.streamingChunks.set(chunkId, chunk);
      
      // Load resources for this chunk
      await this.loadChunkResources(chunk);
      
      this.activeChunks.add(chunkId);
      this.loadingStats.totalLoaded++;
      
      const loadTime = performance.now() - startTime;
      this.updateLoadingStats(loadTime, chunkData.size);
      
      console.log(`Chunk ${chunkId} loaded in ${loadTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Failed to load chunk:', chunkId, error);
      this.loadingStats.totalFailed++;
    } finally {
      this.loadingChunks.delete(chunkId);
    }
  }

  private async generateChunkData(chunkId: string): Promise<ChunkData> {
    // This would typically load chunk data from a server or generate procedurally
    const [chunkX, chunkZ] = chunkId.split(',').map(Number);
    
    // Generate procedural content for demo
    const objects: ChunkObject[] = [];
    const size = this.config.chunkSize;
    
    // Add some objects to the chunk
    for (let i = 0; i < 10; i++) {
      objects.push({
        id: `${chunkId}_obj_${i}`,
        position: {
          x: chunkX * size + Math.random() * size,
          y: Math.random() * 10,
          z: chunkZ * size + Math.random() * size
        },
        type: Math.random() > 0.5 ? 'tree' : 'rock',
        geometryId: Math.random() > 0.5 ? 'tree_01' : 'rock_01',
        materialId: Math.random() > 0.5 ? 'tree_material' : 'rock_material'
      });
    }
    
    return {
      id: chunkId,
      bounds: {
        min: { x: chunkX * size, y: -10, z: chunkZ * size },
        max: { x: (chunkX + 1) * size, y: 50, z: (chunkZ + 1) * size }
      },
      objects,
      size: objects.length * 100 // Estimated size
    };
  }

  private async loadChunkResources(chunk: StreamingChunk): Promise<void> {
    const resourcePromises: Promise<any>[] = [];
    
    for (const object of chunk.data.objects) {
      // Load geometry if not already loaded
      if (!this.resourceManager.getGeometry(object.geometryId)) {
        resourcePromises.push(this.loadGeometry(object.geometryId));
      }
      
      // Load material if not already loaded
      if (!this.resourceManager.getMaterial(object.materialId)) {
        resourcePromises.push(this.loadMaterial(object.materialId));
      }
    }
    
    // Load resources in parallel
    await Promise.allSettled(resourcePromises);
  }

  private async loadGeometry(geometryId: string): Promise<void> {
    // This would load geometry from server or generate procedurally
    let geometry: THREE.BufferGeometry;
    
    switch (geometryId) {
      case 'tree_01':
        geometry = this.createTreeGeometry();
        break;
      case 'rock_01':
        geometry = this.createRockGeometry();
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    this.resourceManager.setGeometry(geometryId, geometry);
  }

  private async loadMaterial(materialId: string): Promise<void> {
    // This would load material from server or create programmatically
    let material: THREE.Material;
    
    switch (materialId) {
      case 'tree_material':
        material = new THREE.MeshLambertMaterial({ color: 0x22aa22 });
        break;
      case 'rock_material':
        material = new THREE.MeshLambertMaterial({ color: 0x777777 });
        break;
      default:
        material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    }
    
    this.resourceManager.setMaterial(materialId, material);
  }

  private createTreeGeometry(): THREE.BufferGeometry {
    // Simple tree geometry (trunk + canopy)
    const geometry = new THREE.CylinderGeometry(0.1, 0.2, 2, 8);
    return geometry;
  }

  private createRockGeometry(): THREE.BufferGeometry {
    // Simple rock geometry
    const geometry = new THREE.SphereGeometry(0.5, 8, 6);
    return geometry;
  }

  private processLoadingQueue(): void {
    const maxConcurrent = this.config.maxConcurrentLoads;
    const currentlyLoading = this.loadingChunks.size;
    
    if (currentlyLoading >= maxConcurrent) {
      return;
    }
    
    const available = maxConcurrent - currentlyLoading;
    const nextTasks = this.loadingQueue.getNext(available);
    
    for (const task of nextTasks) {
      task.callback().catch(error => {
        console.error('Loading task failed:', task.id, error);
      });
    }
  }

  private unloadDistantChunks(playerPosition: Vector3): void {
    const chunksToUnload: string[] = [];
    
    for (const chunkId of this.activeChunks) {
      const [chunkX, chunkZ] = chunkId.split(',').map(Number);
      const chunkCenter = {
        x: chunkX * this.config.chunkSize + this.config.chunkSize / 2,
        y: 0,
        z: chunkZ * this.config.chunkSize + this.config.chunkSize / 2
      };
      
      const distance = this.calculateDistance(playerPosition, chunkCenter);
      
      if (distance > this.config.unloadDistance) {
        chunksToUnload.push(chunkId);
      }
    }
    
    for (const chunkId of chunksToUnload) {
      this.unloadChunk(chunkId);
    }
  }

  private unloadChunk(chunkId: string): void {
    console.log('Unloading chunk:', chunkId);
    
    const chunk = this.streamingChunks.get(chunkId);
    if (chunk) {
      // Remove objects from scene (this would be handled by the entity system)
      for (const object of chunk.data.objects) {
        // In a real implementation, you'd remove entities from the world
        // For now, we'll just log
        console.log('Removing object:', object.id);
      }
      
      this.streamingChunks.delete(chunkId);
    }
    
    this.activeChunks.delete(chunkId);
    this.loadingQueue.remove(chunkId);
  }

  private updateLoadingStats(loadTime: number, dataSize: number): void {
    // Update average load time
    this.loadingStats.averageLoadTime = 
      (this.loadingStats.averageLoadTime * (this.loadingStats.totalLoaded - 1) + loadTime) / 
      this.loadingStats.totalLoaded;
    
    // Update bandwidth estimate
    const bytesPerSecond = dataSize / (loadTime / 1000);
    this.loadingStats.bandwidth = 
      (this.loadingStats.bandwidth * 0.9) + (bytesPerSecond / 1024 / 1024 * 0.1); // MB/s
  }

  // Progressive mesh loading
  async loadProgressiveMesh(meshId: string, position: Vector3): Promise<void> {
    const distance = this.calculateDistance(this.lastPlayerPosition, position);
    
    // Load different LOD levels based on distance
    let lodLevel = 'high';
    if (distance > 50) lodLevel = 'medium';
    if (distance > 100) lodLevel = 'low';
    
    const meshPath = `/assets/meshes/${meshId}_${lodLevel}.glb`;
    
    try {
      // Use worker for loading
      const geometryData = await this.workerPool.loadMesh(meshPath);
      this.resourceManager.setGeometry(`${meshId}_${lodLevel}`, geometryData);
    } catch (error) {
      console.error('Failed to load progressive mesh:', meshId, error);
    }
  }

  // Texture streaming
  async streamTexture(textureId: string, quality: 'low' | 'medium' | 'high'): Promise<void> {
    const texturePath = `/assets/textures/${textureId}_${quality}.jpg`;
    
    try {
      const texture = await this.resourceManager.getTexture(texturePath);
      if (texture) {
        console.log('Texture streamed:', textureId, quality);
      }
    } catch (error) {
      console.error('Failed to stream texture:', textureId, error);
    }
  }

  // Preload critical resources
  async preloadCriticalResources(resourceList: string[]): Promise<void> {
    console.log('Preloading critical resources:', resourceList.length);
    
    const promises = resourceList.map(async (resourceId) => {
      try {
        if (resourceId.includes('texture')) {
          await this.resourceManager.getTexture(resourceId);
        } else if (resourceId.includes('geometry')) {
          // Load geometry
        }
      } catch (error) {
        console.warn('Failed to preload resource:', resourceId, error);
      }
    });
    
    await Promise.allSettled(promises);
    console.log('Critical resources preloaded');
  }

  // Configuration
  updateConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Streaming config updated:', this.config);
  }

  // Statistics
  getStreamingStats(): {
    activeChunks: number;
    loadingChunks: number;
    totalLoaded: number;
    totalFailed: number;
    averageLoadTime: number;
    bandwidth: number;
    queueSize: number;
  } {
    return {
      activeChunks: this.activeChunks.size,
      loadingChunks: this.loadingChunks.size,
      totalLoaded: this.loadingStats.totalLoaded,
      totalFailed: this.loadingStats.totalFailed,
      averageLoadTime: this.loadingStats.averageLoadTime,
      bandwidth: this.loadingStats.bandwidth,
      queueSize: this.loadingQueue.size()
    };
  }

  // Cleanup
  destroy(): void {
    console.log('StreamingManager destroyed');
    
    // Clear all chunks
    for (const chunkId of this.activeChunks) {
      this.unloadChunk(chunkId);
    }
    
    // Terminate workers
    this.workerPool.destroy();
    
    this.streamingChunks.clear();
    this.loadingChunks.clear();
    this.activeChunks.clear();
    this.loadingQueue.clear();
  }
}

// Helper classes
class StreamingChunk {
  public id: string;
  public data: ChunkData;
  public loadTime: number;
  
  constructor(id: string, data: ChunkData) {
    this.id = id;
    this.data = data;
    this.loadTime = Date.now();
  }
}

class LoadingQueue {
  private queue: LoadingTask[] = [];
  
  add(task: LoadingTask): void {
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
  }
  
  getNext(count: number): LoadingTask[] {
    return this.queue.splice(0, count);
  }
  
  remove(id: string): void {
    const index = this.queue.findIndex(task => task.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }
  
  size(): number {
    return this.queue.length;
  }
  
  clear(): void {
    this.queue = [];
  }
}

class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private availableWorkers: Worker[] = [];
  
  constructor(workerCount: number) {
    // In a real implementation, you'd create actual workers
    console.log(`WorkerPool initialized with ${workerCount} workers`);
  }
  
  async loadMesh(path: string): Promise<THREE.BufferGeometry> {
    // Simulate mesh loading
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(new THREE.BoxGeometry(1, 1, 1));
      }, 100);
    });
  }
  
  destroy(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
  }
}

// Type definitions
interface ChunkData {
  id: string;
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  objects: ChunkObject[];
  size: number;
}

interface ChunkObject {
  id: string;
  position: Vector3;
  type: string;
  geometryId: string;
  materialId: string;
}

interface LoadingTask {
  id: string;
  type: string;
  priority: number;
  estimatedSize: number;
  callback: () => Promise<void>;
}

interface WorkerTask {
  id: string;
  type: string;
  data: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}