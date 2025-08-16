import * as THREE from 'three';
import type { WebGPURenderer } from './WebGPURenderer';
import type { WebGLRenderer } from './WebGLRenderer';

export class ResourceManager {
  private renderer: WebGPURenderer | WebGLRenderer;
  
  // Resource caches
  private geometries: Map<string, THREE.BufferGeometry> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private object3Ds: Map<number, THREE.Object3D> = new Map(); // entityId -> Object3D
  private meshInstances: Map<string, InstancedMeshGroup> = new Map();
  
  // Memory management
  private memoryUsage = {
    geometries: 0,
    materials: 0,
    textures: 0,
    total: 0
  };
  
  private maxMemoryUsage = 512 * 1024 * 1024; // 512MB default limit
  private memoryPressureThreshold = 0.8; // 80% of max memory
  
  // Resource loading
  private loadingQueue: Map<string, Promise<any>> = new Map();
  private loadedResources: Set<string> = new Set();
  private failedResources: Set<string> = new Set();
  
  // Garbage collection
  private lastGCTime = 0;
  private gcInterval = 30000; // 30 seconds
  private unusedResourceTimeout = 60000; // 1 minute
  private resourceUsageTracker: Map<string, number> = new Map();
  
  // Compression support
  private compressionFormats: string[] = [];
  
  constructor(renderer: WebGPURenderer | WebGLRenderer) {
    this.renderer = renderer;
    this.detectCompressionSupport();
    this.setupMemoryManagement();
    
    console.log('ResourceManager initialized');
  }

  private detectCompressionSupport(): void {
    if ('getThreeRenderer' in this.renderer) {
      const webglRenderer = this.renderer as WebGLRenderer;
      const compression = webglRenderer.supportsTextureCompression();
      
      if (compression.astc) this.compressionFormats.push('astc');
      if (compression.etc2) this.compressionFormats.push('etc2');
      if (compression.s3tc) this.compressionFormats.push('s3tc');
    }
    
    console.log('Supported compression formats:', this.compressionFormats);
  }

  private setupMemoryManagement(): void {
    // Detect available memory
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      // Allocate portion of device memory for graphics
      this.maxMemoryUsage = Math.min(
        this.maxMemoryUsage,
        deviceMemory * 1024 * 1024 * 1024 * 0.25 // 25% of device memory
      );
    }
    
    // Start garbage collection timer
    setInterval(() => this.runGarbageCollection(), this.gcInterval);
    
    console.log('Memory management setup with limit:', (this.maxMemoryUsage / 1024 / 1024).toFixed(0), 'MB');
  }

  // Geometry management
  getGeometry(id: string): THREE.BufferGeometry | null {
    this.markResourceUsed(id);
    return this.geometries.get(id) || null;
  }

  setGeometry(id: string, geometry: THREE.BufferGeometry): void {
    // Estimate memory usage
    const memoryUsage = this.estimateGeometryMemory(geometry);
    
    // Check memory pressure
    if (this.isMemoryPressure(memoryUsage)) {
      this.runGarbageCollection();
      
      // Still under pressure? Don't cache
      if (this.isMemoryPressure(memoryUsage)) {
        console.warn('Memory pressure too high, not caching geometry:', id);
        return;
      }
    }
    
    // Dispose existing geometry if present
    const existing = this.geometries.get(id);
    if (existing) {
      this.memoryUsage.geometries -= this.estimateGeometryMemory(existing);
      existing.dispose();
    }
    
    this.geometries.set(id, geometry);
    this.memoryUsage.geometries += memoryUsage;
    this.updateTotalMemoryUsage();
    this.markResourceUsed(id);
  }

  private estimateGeometryMemory(geometry: THREE.BufferGeometry): number {
    let size = 0;
    
    for (const [, attribute] of Object.entries(geometry.attributes)) {
      size += (attribute as THREE.BufferAttribute).array.byteLength;
    }
    
    if (geometry.index) {
      size += geometry.index.array.byteLength;
    }
    
    return size;
  }

  // Material management
  getMaterial(id: string): THREE.Material | null {
    this.markResourceUsed(id);
    return this.materials.get(id) || null;
  }

  setMaterial(id: string, material: THREE.Material): void {
    const existing = this.materials.get(id);
    if (existing) {
      existing.dispose();
    }
    
    this.materials.set(id, material);
    this.markResourceUsed(id);
  }

  // Texture management
  async getTexture(id: string): Promise<THREE.Texture | null> {
    this.markResourceUsed(id);
    
    // Return cached texture if available
    const cached = this.textures.get(id);
    if (cached) {
      return cached;
    }
    
    // Check if already loading
    const loading = this.loadingQueue.get(id);
    if (loading) {
      return loading;
    }
    
    // Load texture
    const loadPromise = this.loadTexture(id);
    this.loadingQueue.set(id, loadPromise);
    
    try {
      const texture = await loadPromise;
      this.textures.set(id, texture);
      this.loadedResources.add(id);
      this.markResourceUsed(id);
      return texture;
    } catch (error) {
      console.error('Failed to load texture:', id, error);
      this.failedResources.add(id);
      return null;
    } finally {
      this.loadingQueue.delete(id);
    }
  }

  private async loadTexture(id: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      
      // Try compressed format first
      const compressedPath = this.getCompressedTexturePath(id);
      if (compressedPath) {
        loader.load(
          compressedPath,
          (texture) => {
            this.optimizeTexture(texture);
            resolve(texture);
          },
          undefined,
          () => {
            // Fallback to original format
            this.loadOriginalTexture(id, loader, resolve, reject);
          }
        );
      } else {
        this.loadOriginalTexture(id, loader, resolve, reject);
      }
    });
  }

  private loadOriginalTexture(
    id: string,
    loader: THREE.TextureLoader,
    resolve: (texture: THREE.Texture) => void,
    reject: (error: any) => void
  ): void {
    loader.load(
      id,
      (texture) => {
        this.optimizeTexture(texture);
        resolve(texture);
      },
      undefined,
      reject
    );
  }

  private getCompressedTexturePath(originalPath: string): string | null {
    for (const format of this.compressionFormats) {
      const compressedPath = originalPath.replace(/\.(jpg|jpeg|png)$/i, `.${format}`);
      if (compressedPath !== originalPath) {
        return compressedPath;
      }
    }
    return null;
  }

  private optimizeTexture(texture: THREE.Texture): void {
    // Set appropriate filtering based on usage
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    
    // Enable anisotropic filtering if supported
    if ('getThreeRenderer' in this.renderer) {
      const webglRenderer = this.renderer as WebGLRenderer;
      const gl = webglRenderer.getThreeRenderer().getContext();
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        texture.anisotropy = Math.min(4, maxAnisotropy);
      }
    }
    
    // Mark for update
    texture.needsUpdate = true;
  }

  // Object3D management
  getObject3D(entityId: number): THREE.Object3D | null {
    return this.object3Ds.get(entityId) || null;
  }

  createObject3D(entityId: number, meshComponent: any): THREE.Object3D {
    // Check if already exists
    const existing = this.object3Ds.get(entityId);
    if (existing) {
      return existing;
    }
    
    // Create new object based on mesh component
    const geometry = this.getGeometry(meshComponent.geometry);
    const material = this.getMaterial(meshComponent.material);
    
    if (!geometry || !material) {
      // Create placeholder
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
      );
      this.object3Ds.set(entityId, placeholder);
      return placeholder;
    }
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = meshComponent.castShadow || false;
    mesh.receiveShadow = meshComponent.receiveShadow || false;
    
    this.object3Ds.set(entityId, mesh);
    return mesh;
  }

  removeObject3D(entityId: number): void {
    const object3D = this.object3Ds.get(entityId);
    if (object3D) {
      // Cleanup Three.js object
      if (object3D.parent) {
        object3D.parent.remove(object3D);
      }
      
      // Dispose geometry and material if not shared
      if (object3D instanceof THREE.Mesh) {
        // Note: We don't dispose geometry/material here as they might be shared
        // The garbage collector will handle unused resources
      }
      
      this.object3Ds.delete(entityId);
    }
  }

  // Instanced rendering support
  createInstancedMesh(
    geometryId: string,
    materialId: string,
    count: number
  ): THREE.InstancedMesh | null {
    const geometry = this.getGeometry(geometryId);
    const material = this.getMaterial(materialId);
    
    if (!geometry || !material) {
      return null;
    }
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    
    // Cache instanced mesh group
    const groupId = `${geometryId}_${materialId}`;
    const existingGroup = this.meshInstances.get(groupId);
    
    if (existingGroup) {
      existingGroup.meshes.push(instancedMesh);
    } else {
      this.meshInstances.set(groupId, {
        geometryId,
        materialId,
        meshes: [instancedMesh],
        totalInstances: count
      });
    }
    
    return instancedMesh;
  }

  updateInstancedMesh(
    mesh: THREE.InstancedMesh,
    instanceId: number,
    matrix: THREE.Matrix4
  ): void {
    mesh.setMatrixAt(instanceId, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  // Memory management
  private isMemoryPressure(additionalMemory: number = 0): boolean {
    const totalMemory = this.memoryUsage.total + additionalMemory;
    return totalMemory > this.maxMemoryUsage * this.memoryPressureThreshold;
  }

  private updateTotalMemoryUsage(): void {
    this.memoryUsage.total = 
      this.memoryUsage.geometries + 
      this.memoryUsage.materials + 
      this.memoryUsage.textures;
  }

  private markResourceUsed(id: string): void {
    this.resourceUsageTracker.set(id, Date.now());
  }

  private runGarbageCollection(): void {
    const now = Date.now();
    const cutoffTime = now - this.unusedResourceTimeout;
    
    console.log('Running resource garbage collection...');
    
    let freedMemory = 0;
    
    // Clean up unused geometries
    for (const [id, geometry] of this.geometries) {
      const lastUsed = this.resourceUsageTracker.get(id) || 0;
      if (lastUsed < cutoffTime) {
        const memoryUsage = this.estimateGeometryMemory(geometry);
        geometry.dispose();
        this.geometries.delete(id);
        this.resourceUsageTracker.delete(id);
        this.memoryUsage.geometries -= memoryUsage;
        freedMemory += memoryUsage;
      }
    }
    
    // Clean up unused materials
    for (const [id, material] of this.materials) {
      const lastUsed = this.resourceUsageTracker.get(id) || 0;
      if (lastUsed < cutoffTime) {
        material.dispose();
        this.materials.delete(id);
        this.resourceUsageTracker.delete(id);
      }
    }
    
    // Clean up unused textures
    for (const [id, texture] of this.textures) {
      const lastUsed = this.resourceUsageTracker.get(id) || 0;
      if (lastUsed < cutoffTime) {
        const memoryUsage = this.estimateTextureMemory(texture);
        texture.dispose();
        this.textures.delete(id);
        this.resourceUsageTracker.delete(id);
        this.memoryUsage.textures -= memoryUsage;
        freedMemory += memoryUsage;
      }
    }
    
    this.updateTotalMemoryUsage();
    this.lastGCTime = now;
    
    if (freedMemory > 0) {
      console.log(`Garbage collection freed ${(freedMemory / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  private estimateTextureMemory(texture: THREE.Texture): number {
    if (!texture.image) return 0;
    
    const width = texture.image.width || 0;
    const height = texture.image.height || 0;
    
    // Estimate bytes per pixel (RGBA = 4 bytes)
    let bytesPerPixel = 4;
    
    // Adjust for compressed formats
    if (texture.format === THREE.RGB8) bytesPerPixel = 3;
    else if (texture.type === THREE.HalfFloatType) bytesPerPixel *= 2;
    else if (texture.type === THREE.FloatType) bytesPerPixel *= 4;
    
    let size = width * height * bytesPerPixel;
    
    // Add mipmap memory if enabled
    if (texture.generateMipmaps) {
      size *= 1.33; // Approximately 33% overhead for mipmaps
    }
    
    return size;
  }

  // Preloading and streaming
  async preloadResources(resourceIds: string[]): Promise<void> {
    console.log('Preloading resources:', resourceIds.length);
    
    const promises = resourceIds.map(id => {
      if (id.match(/\.(jpg|jpeg|png|webp)$/i)) {
        return this.getTexture(id);
      }
      // Add other resource types as needed
      return Promise.resolve();
    });
    
    await Promise.allSettled(promises);
    console.log('Resource preloading completed');
  }

  // Statistics and monitoring
  getMemoryUsage(): typeof this.memoryUsage {
    return { ...this.memoryUsage };
  }

  getMemoryPressure(): number {
    return this.memoryUsage.total / this.maxMemoryUsage;
  }

  getResourceStats(): {
    geometries: number;
    materials: number;
    textures: number;
    object3Ds: number;
    instancedMeshGroups: number;
    loadingQueue: number;
    failedResources: number;
  } {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
      object3Ds: this.object3Ds.size,
      instancedMeshGroups: this.meshInstances.size,
      loadingQueue: this.loadingQueue.size,
      failedResources: this.failedResources.size
    };
  }

  // Resource validation
  validateResources(): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    // Check geometries
    for (const [id, geometry] of this.geometries) {
      if (geometry.attributes.position) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    }
    
    // Check textures
    for (const [id, texture] of this.textures) {
      if (texture.image) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    }
    
    return { valid, invalid };
  }

  // Force garbage collection
  forceGarbageCollection(): void {
    this.runGarbageCollection();
  }

  // Set memory limits
  setMemoryLimit(limitMB: number): void {
    this.maxMemoryUsage = limitMB * 1024 * 1024;
    console.log('Memory limit set to:', limitMB, 'MB');
  }

  // Clear all resources
  clearAll(): void {
    console.log('Clearing all resources...');
    
    // Dispose all geometries
    for (const [, geometry] of this.geometries) {
      geometry.dispose();
    }
    this.geometries.clear();
    
    // Dispose all materials
    for (const [, material] of this.materials) {
      material.dispose();
    }
    this.materials.clear();
    
    // Dispose all textures
    for (const [, texture] of this.textures) {
      texture.dispose();
    }
    this.textures.clear();
    
    // Clear object3Ds
    this.object3Ds.clear();
    this.meshInstances.clear();
    
    // Reset memory tracking
    this.memoryUsage = {
      geometries: 0,
      materials: 0,
      textures: 0,
      total: 0
    };
    
    this.resourceUsageTracker.clear();
    this.loadingQueue.clear();
    this.loadedResources.clear();
    this.failedResources.clear();
    
    console.log('All resources cleared');
  }

  // Cleanup
  destroy(): void {
    console.log('ResourceManager destroyed');
    this.clearAll();
  }
}

// Helper interface for instanced mesh management
interface InstancedMeshGroup {
  geometryId: string;
  materialId: string;
  meshes: THREE.InstancedMesh[];
  totalInstances: number;
}