import type { Entity, Vector3 } from '@/types';
import { BaseSystem } from './BaseSystem';
import type { TransformComponent, MeshComponent } from '@/components/core/CoreComponents';

interface RenderBatch {
  geometry: string;
  material: string;
  instances: {
    entityId: number;
    worldMatrix: Float32Array;
    visible: boolean;
  }[];
}

interface CameraData {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  near: number;
  far: number;
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  viewProjectionMatrix: Float32Array;
}

interface FrustumPlane {
  normal: Vector3;
  distance: number;
}

interface RenderStats {
  drawCalls: number;
  triangles: number;
  vertices: number;
  instancedDrawCalls: number;
  culledObjects: number;
  totalObjects: number;
}

/**
 * High-performance rendering system with frustum culling, batching, and LOD
 */
export class RenderSystem extends BaseSystem {
  private canvas: HTMLCanvasElement;
  private context: WebGL2RenderingContext | null = null;
  private device: GPUDevice | null = null; // WebGPU device
  
  // Camera
  private camera: CameraData;
  private frustumPlanes: FrustumPlane[] = [];
  
  // Rendering
  private renderBatches = new Map<string, RenderBatch>();
  private visibleEntities: Entity[] = [];
  private renderStats: RenderStats = {
    drawCalls: 0,
    triangles: 0,
    vertices: 0,
    instancedDrawCalls: 0,
    culledObjects: 0,
    totalObjects: 0
  };
  
  // Performance settings
  private enableFrustumCulling = true;
  private enableInstancing = true;
  private enableLOD = true;
  private maxInstancesPerBatch = 1000;
  private lodBias = 1.0;
  
  // Matrices (reused to avoid allocations)
  private tempMatrix = new Float32Array(16);
  private tempVector = { x: 0, y: 0, z: 0 };

  constructor(canvas: HTMLCanvasElement) {
    super('render', ['transform', 'mesh'], 1000); // Low priority - render last
    
    this.canvas = canvas;
    
    // Initialize camera
    this.camera = {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 60,
      near: 0.1,
      far: 1000,
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      viewProjectionMatrix: new Float32Array(16)
    };
    
    this.updateCameraMatrices();
  }

  protected async onInit(): Promise<void> {
    await this.initializeRenderer();
    this.updateFrustumPlanes();
    this.debug('Render system initialized');
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // Reset stats
    this.resetStats();
    this.renderStats.totalObjects = entities.length;
    
    // Update camera if needed
    this.updateCameraMatrices();
    this.updateFrustumPlanes();
    
    // Cull entities
    this.visibleEntities = this.enableFrustumCulling 
      ? this.performFrustumCulling(entities)
      : entities.filter(e => {
          const mesh = this.getComponent<MeshComponent>(e, 'mesh');
          return mesh?.visible ?? true;
        });
    
    // Batch rendering
    if (this.enableInstancing) {
      this.batchRender();
    } else {
      this.individualRender();
    }
    
    // Update stats
    this.renderStats.culledObjects = this.renderStats.totalObjects - this.visibleEntities.length;
  }

  /**
   * Initialize WebGL2 or WebGPU renderer
   */
  private async initializeRenderer(): Promise<void> {
    // Try WebGPU first
    if ('gpu' in navigator) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          this.device = await adapter.requestDevice();
          this.debug('WebGPU renderer initialized');
          return;
        }
      } catch (error) {
        this.warn('WebGPU initialization failed, falling back to WebGL2', error);
      }
    }
    
    // Fall back to WebGL2
    this.context = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    
    if (!this.context) {
      throw new Error('Failed to initialize WebGL2 context');
    }
    
    // Enable extensions
    this.context.getExtension('EXT_color_buffer_float');
    this.context.getExtension('OES_texture_float_linear');
    this.context.getExtension('WEBGL_draw_buffers');
    
    // Set up initial state
    this.context.enable(this.context.DEPTH_TEST);
    this.context.enable(this.context.CULL_FACE);
    this.context.cullFace(this.context.BACK);
    this.context.depthFunc(this.context.LEQUAL);
    
    this.debug('WebGL2 renderer initialized');
  }

  /**
   * Update camera matrices
   */
  private updateCameraMatrices(): void {
    // View matrix (look-at)
    this.createLookAtMatrix(
      this.camera.position,
      this.camera.target,
      this.camera.up,
      this.camera.viewMatrix
    );
    
    // Projection matrix
    const aspect = this.canvas.width / this.canvas.height;
    this.createPerspectiveMatrix(
      this.camera.fov,
      aspect,
      this.camera.near,
      this.camera.far,
      this.camera.projectionMatrix
    );
    
    // View-projection matrix
    this.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.viewMatrix,
      this.camera.viewProjectionMatrix
    );
  }

  /**
   * Create look-at matrix
   */
  private createLookAtMatrix(eye: Vector3, target: Vector3, up: Vector3, out: Float32Array): void {
    const fx = target.x - eye.x;
    const fy = target.y - eye.y;
    const fz = target.z - eye.z;
    
    const flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (flen === 0) return;
    
    const nfx = fx / flen;
    const nfy = fy / flen;
    const nfz = fz / flen;
    
    const sx = nfy * up.z - nfz * up.y;
    const sy = nfz * up.x - nfx * up.z;
    const sz = nfx * up.y - nfy * up.x;
    
    const slen = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (slen === 0) return;
    
    const nsx = sx / slen;
    const nsy = sy / slen;
    const nsz = sz / slen;
    
    const ux = nsy * nfz - nsz * nfy;
    const uy = nsz * nfx - nsx * nfz;
    const uz = nsx * nfy - nsy * nfx;
    
    out[0] = nsx;
    out[1] = ux;
    out[2] = -nfx;
    out[3] = 0;
    out[4] = nsy;
    out[5] = uy;
    out[6] = -nfy;
    out[7] = 0;
    out[8] = nsz;
    out[9] = uz;
    out[10] = -nfz;
    out[11] = 0;
    out[12] = -(nsx * eye.x + nsy * eye.y + nsz * eye.z);
    out[13] = -(ux * eye.x + uy * eye.y + uz * eye.z);
    out[14] = -(-nfx * eye.x + -nfy * eye.y + -nfz * eye.z);
    out[15] = 1;
  }

  /**
   * Create perspective projection matrix
   */
  private createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number, out: Float32Array): void {
    const f = 1 / Math.tan((fov * Math.PI / 180) / 2);
    const rangeInv = 1 / (near - far);
    
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * rangeInv;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = far * near * rangeInv * 2;
    out[15] = 0;
  }

  /**
   * Multiply two 4x4 matrices
   */
  private multiplyMatrices(a: Float32Array, b: Float32Array, out: Float32Array): void {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
  }

  /**
   * Update frustum planes for culling
   */
  private updateFrustumPlanes(): void {
    const vp = this.camera.viewProjectionMatrix;
    
    // Extract frustum planes from view-projection matrix
    this.frustumPlanes = [
      // Left plane
      {
        normal: { x: vp[3] + vp[0], y: vp[7] + vp[4], z: vp[11] + vp[8] },
        distance: vp[15] + vp[12]
      },
      // Right plane
      {
        normal: { x: vp[3] - vp[0], y: vp[7] - vp[4], z: vp[11] - vp[8] },
        distance: vp[15] - vp[12]
      },
      // Top plane
      {
        normal: { x: vp[3] - vp[1], y: vp[7] - vp[5], z: vp[11] - vp[9] },
        distance: vp[15] - vp[13]
      },
      // Bottom plane
      {
        normal: { x: vp[3] + vp[1], y: vp[7] + vp[5], z: vp[11] + vp[9] },
        distance: vp[15] + vp[13]
      },
      // Near plane
      {
        normal: { x: vp[3] + vp[2], y: vp[7] + vp[6], z: vp[11] + vp[10] },
        distance: vp[15] + vp[14]
      },
      // Far plane
      {
        normal: { x: vp[3] - vp[2], y: vp[7] - vp[6], z: vp[11] - vp[10] },
        distance: vp[15] - vp[14]
      }
    ];
    
    // Normalize planes
    for (const plane of this.frustumPlanes) {
      const length = Math.sqrt(
        plane.normal.x * plane.normal.x +
        plane.normal.y * plane.normal.y +
        plane.normal.z * plane.normal.z
      );
      if (length > 0) {
        plane.normal.x /= length;
        plane.normal.y /= length;
        plane.normal.z /= length;
        plane.distance /= length;
      }
    }
  }

  /**
   * Perform frustum culling
   */
  private performFrustumCulling(entities: Entity[]): Entity[] {
    const visible: Entity[] = [];
    
    for (const entity of entities) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform');
      const mesh = this.getComponent<MeshComponent>(entity, 'mesh');
      
      if (!transform || !mesh || !mesh.visible) continue;
      
      // Check if entity is within frustum
      if (this.isInFrustum(transform, mesh)) {
        visible.push(entity);
      }
    }
    
    return visible;
  }

  /**
   * Check if entity is within viewing frustum
   */
  private isInFrustum(transform: TransformComponent, mesh: MeshComponent): boolean {
    // Use bounding sphere for fast culling
    const position = transform.position;
    let radius = 1; // Default radius
    
    if (mesh.boundingRadius !== undefined) {
      radius = mesh.boundingRadius;
    } else if (mesh.boundingBox) {
      // Calculate radius from bounding box
      const dx = mesh.boundingBox.max.x - mesh.boundingBox.min.x;
      const dy = mesh.boundingBox.max.y - mesh.boundingBox.min.y;
      const dz = mesh.boundingBox.max.z - mesh.boundingBox.min.z;
      radius = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.5;
    }
    
    // Apply transform scale
    const maxScale = Math.max(transform.scale.x, transform.scale.y, transform.scale.z);
    radius *= maxScale;
    
    // Test against all frustum planes
    for (const plane of this.frustumPlanes) {
      const distance = 
        plane.normal.x * position.x +
        plane.normal.y * position.y +
        plane.normal.z * position.z +
        plane.distance;
      
      if (distance < -radius) {
        return false; // Outside this plane
      }
    }
    
    return true; // Inside all planes
  }

  /**
   * Batch entities for instanced rendering
   */
  private batchRender(): void {
    this.renderBatches.clear();
    
    // Group entities by geometry/material
    for (const entity of this.visibleEntities) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform')!;
      const mesh = this.getComponent<MeshComponent>(entity, 'mesh')!;
      
      const batchKey = `${mesh.geometry}-${mesh.material}`;
      
      if (!this.renderBatches.has(batchKey)) {
        this.renderBatches.set(batchKey, {
          geometry: mesh.geometry,
          material: mesh.material,
          instances: []
        });
      }
      
      const batch = this.renderBatches.get(batchKey)!;
      batch.instances.push({
        entityId: entity.id,
        worldMatrix: transform.worldMatrix || new Float32Array(16),
        visible: mesh.visible
      });
    }
    
    // Render batches
    for (const batch of this.renderBatches.values()) {
      this.renderBatch(batch);
    }
  }

  /**
   * Render individual entities
   */
  private individualRender(): void {
    for (const entity of this.visibleEntities) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform')!;
      const mesh = this.getComponent<MeshComponent>(entity, 'mesh')!;
      
      this.renderEntity(transform, mesh);
    }
  }

  /**
   * Render a batch of instances
   */
  private renderBatch(batch: RenderBatch): void {
    if (batch.instances.length === 0) return;
    
    // TODO: Implement actual rendering based on graphics API
    // This is a placeholder that would integrate with your graphics engine
    
    if (this.device) {
      // WebGPU rendering
      this.renderBatchWebGPU(batch);
    } else if (this.context) {
      // WebGL2 rendering
      this.renderBatchWebGL2(batch);
    }
    
    // Update stats
    if (batch.instances.length > 1) {
      this.renderStats.instancedDrawCalls++;
    } else {
      this.renderStats.drawCalls++;
    }
  }

  /**
   * Render batch with WebGPU
   */
  private renderBatchWebGPU(batch: RenderBatch): void {
    // TODO: Implement WebGPU batch rendering
    // This would involve:
    // 1. Creating instance buffers with world matrices
    // 2. Binding geometry and material resources
    // 3. Drawing instanced geometry
    this.debug(`WebGPU batch render: ${batch.geometry} x${batch.instances.length}`);
  }

  /**
   * Render batch with WebGL2
   */
  private renderBatchWebGL2(batch: RenderBatch): void {
    if (!this.context) return;
    
    // TODO: Implement WebGL2 batch rendering
    // This would involve:
    // 1. Binding shader program
    // 2. Setting up vertex buffers and instance data
    // 3. Drawing instanced geometry
    this.debug(`WebGL2 batch render: ${batch.geometry} x${batch.instances.length}`);
    
    // Placeholder draw call
    this.renderStats.drawCalls++;
  }

  /**
   * Render individual entity
   */
  private renderEntity(transform: TransformComponent, mesh: MeshComponent): void {
    // TODO: Implement individual entity rendering
    // This would render a single entity without instancing
    this.debug(`Individual render: ${mesh.geometry}`);
    this.renderStats.drawCalls++;
  }

  /**
   * Calculate LOD level based on distance
   */
  private calculateLODLevel(entity: Entity): number {
    if (!this.enableLOD) return 0;
    
    const transform = this.getComponent<TransformComponent>(entity, 'transform');
    const mesh = this.getComponent<MeshComponent>(entity, 'mesh');
    
    if (!transform || !mesh?.lodDistances) return 0;
    
    // Calculate distance to camera
    const dx = transform.position.x - this.camera.position.x;
    const dy = transform.position.y - this.camera.position.y;
    const dz = transform.position.z - this.camera.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Apply LOD bias
    const adjustedDistance = distance * this.lodBias;
    
    // Find appropriate LOD level
    for (let i = 0; i < mesh.lodDistances.length; i++) {
      if (adjustedDistance < mesh.lodDistances[i]) {
        return i;
      }
    }
    
    return mesh.lodDistances.length; // Furthest LOD
  }

  /**
   * Reset render statistics
   */
  private resetStats(): void {
    this.renderStats.drawCalls = 0;
    this.renderStats.triangles = 0;
    this.renderStats.vertices = 0;
    this.renderStats.instancedDrawCalls = 0;
    this.renderStats.culledObjects = 0;
    this.renderStats.totalObjects = 0;
  }

  // Public camera control methods

  /**
   * Set camera position
   */
  setCameraPosition(position: Vector3): void {
    this.camera.position = { ...position };
  }

  /**
   * Set camera target
   */
  setCameraTarget(target: Vector3): void {
    this.camera.target = { ...target };
  }

  /**
   * Set camera field of view
   */
  setCameraFOV(fov: number): void {
    this.camera.fov = Math.max(1, Math.min(179, fov));
  }

  /**
   * Set camera near/far planes
   */
  setCameraClipping(near: number, far: number): void {
    this.camera.near = Math.max(0.001, near);
    this.camera.far = Math.max(this.camera.near + 0.001, far);
  }

  /**
   * Get camera data
   */
  getCamera(): CameraData {
    return { ...this.camera };
  }

  /**
   * Get render statistics
   */
  getRenderStats(): RenderStats {
    return { ...this.renderStats };
  }

  /**
   * Enable/disable frustum culling
   */
  setFrustumCulling(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
  }

  /**
   * Enable/disable instanced rendering
   */
  setInstancing(enabled: boolean): void {
    this.enableInstancing = enabled;
  }

  /**
   * Enable/disable LOD system
   */
  setLOD(enabled: boolean): void {
    this.enableLOD = enabled;
  }

  /**
   * Set LOD bias (higher = more aggressive LOD)
   */
  setLODBias(bias: number): void {
    this.lodBias = Math.max(0.1, Math.min(10, bias));
  }

  /**
   * Resize render targets
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (this.context) {
      this.context.viewport(0, 0, width, height);
    }
    
    // Update projection matrix with new aspect ratio
    this.updateCameraMatrices();
  }

  /**
   * Get render system debug info
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();
    
    return {
      ...baseInfo,
      rendererType: this.device ? 'WebGPU' : (this.context ? 'WebGL2' : 'None'),
      camera: this.camera,
      renderStats: this.renderStats,
      visibleEntities: this.visibleEntities.length,
      batchCount: this.renderBatches.size,
      settings: {
        frustumCulling: this.enableFrustumCulling,
        instancing: this.enableInstancing,
        lod: this.enableLOD,
        lodBias: this.lodBias,
        maxInstancesPerBatch: this.maxInstancesPerBatch
      }
    };
  }
}