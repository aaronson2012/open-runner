import * as THREE from 'three';
import { WebGPURenderer } from '@/rendering/WebGPURenderer';
import { WebGLRenderer } from '@/rendering/WebGLRenderer';
import { DeviceCapabilities } from '@/rendering/DeviceCapabilities';
import { PerformanceAdapter } from '@/rendering/PerformanceAdapter';
import { LODManager } from '@/rendering/LODManager';
import { CullingManager } from '@/rendering/CullingManager';
import { ResourceManager } from '@/rendering/ResourceManager';
import { StreamingManager } from '@/rendering/StreamingManager';
import type { 
  System, 
  Entity, 
  RenderCapabilities, 
  RenderSettings, 
  PerformanceMetrics,
  GameConfig 
} from '@/types';

export class RenderSystem implements System {
  readonly id = 'render';
  readonly priority = 1000; // Render system should run last
  readonly requiredComponents = ['transform', 'mesh'];

  private renderer: WebGPURenderer | WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private capabilities: RenderCapabilities;
  private settings: RenderSettings;
  private performanceAdapter: PerformanceAdapter;
  private lodManager: LODManager;
  private cullingManager: CullingManager;
  private resourceManager: ResourceManager;
  private streamingManager: StreamingManager;
  
  private frameCount = 0;
  private lastFrameTime = 0;
  private renderTargets: Map<string, THREE.WebGLRenderTarget> = new Map();
  private renderPasses: Map<string, THREE.RenderPass> = new Map();
  
  // Performance tracking
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    gpuMemory: 0,
    renderTime: 0,
    culledObjects: 0,
    activeLODs: 0
  };

  constructor(
    scene: THREE.Scene, 
    camera: THREE.PerspectiveCamera, 
    config: GameConfig
  ) {
    this.scene = scene;
    this.camera = camera;
    
    // Initialize all subsystems
    this.init(config);
  }

  async init(config?: GameConfig): Promise<void> {
    console.log('Initializing RenderSystem...');
    
    try {
      // Detect device capabilities
      this.capabilities = await DeviceCapabilities.detect();
      console.log('Device capabilities:', this.capabilities);
      
      // Initialize performance adapter
      this.performanceAdapter = new PerformanceAdapter(this.capabilities);
      
      // Get optimal render settings
      this.settings = this.performanceAdapter.getOptimalSettings();
      console.log('Render settings:', this.settings);
      
      // Initialize appropriate renderer based on capabilities
      await this.initRenderer(config);
      
      // Initialize rendering subsystems
      this.resourceManager = new ResourceManager(this.renderer);
      this.lodManager = new LODManager(this.capabilities);
      this.cullingManager = new CullingManager(this.camera, this.settings);
      this.streamingManager = new StreamingManager(this.resourceManager);
      
      // Setup render pipeline
      this.setupRenderPipeline();
      
      console.log('RenderSystem initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize RenderSystem:', error);
      throw error;
    }
  }

  private async initRenderer(config?: GameConfig): Promise<void> {
    const canvas = config?.canvas || document.createElement('canvas');
    
    try {
      // Try WebGPU first if supported and enabled
      if (this.capabilities.hasWebGPU && config?.enableWebGPU !== false) {
        console.log('Initializing WebGPU renderer...');
        this.renderer = new WebGPURenderer(canvas, this.settings);
        await (this.renderer as WebGPURenderer).init();
        console.log('WebGPU renderer initialized successfully');
        return;
      }
    } catch (error) {
      console.warn('WebGPU initialization failed, falling back to WebGL:', error);
    }
    
    // Fallback to WebGL
    console.log('Initializing WebGL renderer...');
    this.renderer = new WebGLRenderer(canvas, this.settings);
    await (this.renderer as WebGLRenderer).init();
    console.log('WebGL renderer initialized successfully');
  }

  private setupRenderPipeline(): void {
    // Setup shadow mapping if enabled
    if (this.settings.enableShadows) {
      this.setupShadowMapping();
    }
    
    // Setup post-processing effects
    this.setupPostProcessing();
    
    // Setup render targets for advanced features
    this.setupRenderTargets();
  }

  private setupShadowMapping(): void {
    const shadowMapSize = this.settings.shadowMapSize;
    
    // Configure shadow settings for lights in the scene
    this.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight || 
          object instanceof THREE.SpotLight) {
        object.castShadow = true;
        object.shadow.mapSize.setScalar(shadowMapSize);
        
        if (object instanceof THREE.DirectionalLight) {
          object.shadow.camera.near = 0.1;
          object.shadow.camera.far = 500;
          object.shadow.camera.left = -50;
          object.shadow.camera.right = 50;
          object.shadow.camera.top = 50;
          object.shadow.camera.bottom = -50;
        }
      }
    });
  }

  private setupPostProcessing(): void {
    // Setup render targets for post-processing
    const width = this.renderer.getSize().width;
    const height = this.renderer.getSize().height;
    
    if (this.settings.enableSSAO) {
      const ssaoTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.FloatType
      });
      this.renderTargets.set('ssao', ssaoTarget);
    }
  }

  private setupRenderTargets(): void {
    const width = this.renderer.getSize().width;
    const height = this.renderer.getSize().height;
    
    // Main color buffer
    const colorTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      generateMipmaps: false
    });
    this.renderTargets.set('color', colorTarget);
    
    // Depth buffer for advanced techniques
    const depthTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.DepthFormat,
      type: THREE.UnsignedIntType,
      generateMipmaps: false
    });
    this.renderTargets.set('depth', depthTarget);
  }

  update(deltaTime: number, entities: Entity[]): void {
    const startTime = performance.now();
    
    // Update performance adapter
    this.performanceAdapter.update(deltaTime);
    
    // Check if we need to adjust quality
    if (this.performanceAdapter.shouldAdjustQuality()) {
      this.adjustRenderQuality();
    }
    
    // Update streaming manager
    this.streamingManager.update(this.camera.position);
    
    // Process entities for rendering
    const renderableEntities = this.processEntities(entities);
    
    // Update LOD system
    this.lodManager.update(this.camera.position, renderableEntities);
    
    // Perform culling
    const visibleEntities = this.cullingManager.cull(renderableEntities);
    
    // Render the frame
    this.render(visibleEntities);
    
    // Update metrics
    this.updateMetrics(performance.now() - startTime);
    
    this.frameCount++;
  }

  private processEntities(entities: Entity[]): Entity[] {
    const renderableEntities: Entity[] = [];
    
    for (const entity of entities) {
      const transform = entity.components.get('transform');
      const mesh = entity.components.get('mesh');
      
      if (transform && mesh && entity.active) {
        renderableEntities.push(entity);
      }
    }
    
    return renderableEntities;
  }

  private render(entities: Entity[]): void {
    // Clear buffers
    this.renderer.clear();
    
    // Render shadows first if enabled
    if (this.settings.enableShadows) {
      this.renderShadows(entities);
    }
    
    // Main render pass
    this.renderMainPass(entities);
    
    // Post-processing effects
    if (this.settings.enableSSAO) {
      this.renderSSAO();
    }
    
    // Present final result
    this.renderer.present();
  }

  private renderShadows(entities: Entity[]): void {
    // Shadow rendering implementation
    const lights = this.scene.children.filter(
      obj => obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight
    );
    
    for (const light of lights) {
      if ((light as any).castShadow) {
        // Render shadow map for this light
        this.renderer.renderShadowMap(light as THREE.Light, entities);
      }
    }
  }

  private renderMainPass(entities: Entity[]): void {
    // Update entity transforms and materials
    for (const entity of entities) {
      this.updateEntityRenderData(entity);
    }
    
    // Render to main framebuffer
    this.renderer.render(this.scene, this.camera);
  }

  private renderSSAO(): void {
    // SSAO implementation would go here
    // This is a placeholder for the post-processing effect
  }

  private updateEntityRenderData(entity: Entity): void {
    const transform = entity.components.get('transform') as any;
    const mesh = entity.components.get('mesh') as any;
    
    if (!transform || !mesh) return;
    
    // Get or create Three.js objects for this entity
    let object3D = this.resourceManager.getObject3D(entity.id);
    if (!object3D) {
      object3D = this.resourceManager.createObject3D(entity.id, mesh);
      this.scene.add(object3D);
    }
    
    // Update transform
    object3D.position.set(transform.position.x, transform.position.y, transform.position.z);
    object3D.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    object3D.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    
    // Update LOD if applicable
    if (mesh.lod) {
      this.lodManager.updateEntityLOD(entity.id, object3D, mesh.lod);
    }
  }

  private adjustRenderQuality(): void {
    const newSettings = this.performanceAdapter.getOptimalSettings();
    
    // Apply new settings
    this.settings = newSettings;
    this.renderer.updateSettings(newSettings);
    
    // Update subsystems
    this.cullingManager.updateSettings(newSettings);
    this.lodManager.updateSettings(newSettings);
    
    console.log('Render quality adjusted:', newSettings);
  }

  private updateMetrics(renderTime: number): void {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    
    this.metrics.fps = 1000 / deltaTime;
    this.metrics.frameTime = deltaTime;
    this.metrics.renderTime = renderTime;
    this.metrics.drawCalls = this.renderer.getDrawCalls();
    this.metrics.triangles = this.renderer.getTriangles();
    this.metrics.culledObjects = this.cullingManager.getCulledCount();
    this.metrics.activeLODs = this.lodManager.getActiveLODCount();
    
    // GPU memory usage (approximation)
    if ('memory' in performance) {
      this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
    
    this.lastFrameTime = now;
  }

  // Public API
  getRenderer(): WebGPURenderer | WebGLRenderer {
    return this.renderer;
  }

  getCapabilities(): RenderCapabilities {
    return this.capabilities;
  }

  getSettings(): RenderSettings {
    return this.settings;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  setQualityLevel(level: 'low' | 'medium' | 'high' | 'ultra'): void {
    this.performanceAdapter.setQualityLevel(level);
    this.adjustRenderQuality();
  }

  enableAdaptiveQuality(enabled: boolean): void {
    this.performanceAdapter.enableAdaptiveQuality(enabled);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    
    // Update render targets
    for (const [, target] of this.renderTargets) {
      target.setSize(width, height);
    }
    
    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  destroy(): void {
    console.log('Destroying RenderSystem...');
    
    // Cleanup subsystems
    this.resourceManager?.destroy();
    this.streamingManager?.destroy();
    this.lodManager?.destroy();
    this.cullingManager?.destroy();
    this.performanceAdapter?.destroy();
    
    // Cleanup render targets
    for (const [, target] of this.renderTargets) {
      target.dispose();
    }
    this.renderTargets.clear();
    
    // Cleanup renderer
    this.renderer?.destroy();
    
    console.log('RenderSystem destroyed');
  }
}