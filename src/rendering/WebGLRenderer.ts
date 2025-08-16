import * as THREE from 'three';
import type { RenderSettings, Entity } from '@/types';

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private settings: RenderSettings;
  
  // Shadow map management
  private shadowMaps: Map<string, THREE.WebGLRenderTarget> = new Map();
  
  // Performance tracking
  private frameStartTime = 0;
  
  constructor(canvas: HTMLCanvasElement, settings: RenderSettings) {
    this.canvas = canvas;
    this.settings = settings;
  }

  async init(): Promise<void> {
    console.log('Initializing WebGL renderer...');
    
    try {
      // Create Three.js WebGL renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: this.settings.enableAntialiasing,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: false,
        precision: this.settings.shaderPrecision,
        preserveDrawingBuffer: false
      });
      
      // Configure renderer
      this.configureRenderer();
      
      // Setup extensions and capabilities
      this.setupExtensions();
      
      console.log('WebGL renderer initialized successfully');
      console.log('WebGL capabilities:', {
        webgl2: this.renderer.capabilities.isWebGL2,
        maxTextures: this.renderer.capabilities.maxTextures,
        maxVertexTextures: this.renderer.capabilities.maxVertexTextures,
        maxTextureSize: this.renderer.capabilities.maxTextureSize,
        maxCubemapSize: this.renderer.capabilities.maxCubemapSize,
        maxAttributes: this.renderer.capabilities.maxAttributes,
        maxVaryings: this.renderer.capabilities.maxVaryings,
        maxFragmentUniforms: this.renderer.capabilities.maxFragmentUniforms,
        maxVertexUniforms: this.renderer.capabilities.maxVertexUniforms,
        precision: this.renderer.capabilities.precision,
        floatFragmentTextures: this.renderer.capabilities.floatFragmentTextures,
        floatVertexTextures: this.renderer.capabilities.floatVertexTextures
      });
      
    } catch (error) {
      console.error('WebGL initialization failed:', error);
      throw error;
    }
  }

  private configureRenderer(): void {
    const { width, height } = this.getSize();
    
    // Set size
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Configure color space and tone mapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Configure shadows
    if (this.settings.enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = true;
    }
    
    // Performance optimizations
    this.renderer.info.autoReset = false;
    this.renderer.sortObjects = true;
    
    // Configure culling
    this.renderer.localClippingEnabled = false;
    this.renderer.clippingPlanes = [];
    
    // Configure clear settings
    this.renderer.autoClear = true;
    this.renderer.autoClearColor = true;
    this.renderer.autoClearDepth = true;
    this.renderer.autoClearStencil = true;
    
    // Set clear color
    this.renderer.setClearColor(0x000000, 1.0);
  }

  private setupExtensions(): void {
    const gl = this.renderer.getContext();
    
    // Enable useful extensions
    const extensions = [
      'OES_texture_float',
      'OES_texture_float_linear',
      'OES_texture_half_float',
      'OES_texture_half_float_linear',
      'WEBGL_depth_texture',
      'EXT_texture_filter_anisotropic',
      'ANGLE_instanced_arrays',
      'WEBGL_draw_buffers',
      'EXT_disjoint_timer_query',
      'EXT_disjoint_timer_query_webgl2'
    ];
    
    const supportedExtensions: string[] = [];
    for (const ext of extensions) {
      if (gl.getExtension(ext)) {
        supportedExtensions.push(ext);
      }
    }
    
    console.log('Supported WebGL extensions:', supportedExtensions);
    
    // Configure anisotropic filtering if available
    const anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropyExt) {
      const maxAnisotropy = gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      console.log('Max anisotropy:', maxAnisotropy);
    }
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.frameStartTime = performance.now();
    
    // Reset info for accurate metrics
    this.renderer.info.reset();
    
    // Render the scene
    this.renderer.render(scene, camera);
  }

  renderShadowMap(light: THREE.Light, entities: Entity[]): void {
    if (!this.settings.enableShadows) return;
    
    const lightId = (light as any).uuid;
    let shadowMap = this.shadowMaps.get(lightId);
    
    if (!shadowMap) {
      shadowMap = this.createShadowMap(light);
      this.shadowMaps.set(lightId, shadowMap);
    }
    
    // Setup shadow camera
    let shadowCamera: THREE.Camera;
    
    if (light instanceof THREE.DirectionalLight) {
      shadowCamera = this.setupDirectionalLightShadowCamera(light);
    } else if (light instanceof THREE.SpotLight) {
      shadowCamera = this.setupSpotLightShadowCamera(light);
    } else if (light instanceof THREE.PointLight) {
      shadowCamera = this.setupPointLightShadowCamera(light);
    } else {
      return; // Unsupported light type
    }
    
    // Render shadow map
    const originalRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(shadowMap);
    this.renderer.clear();
    
    // Create temporary scene with only shadow casting objects
    const shadowScene = new THREE.Scene();
    
    // Add shadow casting meshes (this would be populated from entities)
    // For now, we'll assume the scene contains the objects
    shadowScene.copy(light.parent || new THREE.Scene(), false);
    
    this.renderer.render(shadowScene, shadowCamera);
    this.renderer.setRenderTarget(originalRenderTarget);
  }

  private createShadowMap(light: THREE.Light): THREE.WebGLRenderTarget {
    const shadowMapSize = this.settings.shadowMapSize;
    
    let format: THREE.PixelFormat;
    let type: THREE.TextureDataType;
    
    if (this.renderer.capabilities.isWebGL2) {
      format = THREE.DepthFormat;
      type = THREE.UnsignedIntType;
    } else {
      format = THREE.RGBAFormat;
      type = THREE.UnsignedByteType;
    }
    
    const shadowMap = new THREE.WebGLRenderTarget(shadowMapSize, shadowMapSize, {
      format,
      type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false
    });
    
    return shadowMap;
  }

  private setupDirectionalLightShadowCamera(light: THREE.DirectionalLight): THREE.OrthographicCamera {
    const camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 500);
    camera.position.copy(light.position);
    camera.lookAt(light.target.position);
    return camera;
  }

  private setupSpotLightShadowCamera(light: THREE.SpotLight): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      light.angle * 2 * 180 / Math.PI,
      1,
      0.1,
      light.distance || 1000
    );
    camera.position.copy(light.position);
    camera.lookAt(light.target.position);
    return camera;
  }

  private setupPointLightShadowCamera(light: THREE.PointLight): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, light.distance || 1000);
    camera.position.copy(light.position);
    return camera;
  }

  clear(): void {
    this.renderer.clear();
  }

  present(): void {
    // WebGL presents automatically
  }

  updateSettings(settings: RenderSettings): void {
    this.settings = settings;
    
    // Update shadow settings
    if (this.settings.enableShadows !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = this.settings.enableShadows;
      this.renderer.shadowMap.needsUpdate = true;
    }
    
    // Update shadow map size if changed
    const currentShadowMapSize = this.renderer.shadowMap.type;
    if (this.settings.shadowMapSize !== currentShadowMapSize) {
      // Recreate shadow maps with new size
      for (const [, shadowMap] of this.shadowMaps) {
        shadowMap.dispose();
      }
      this.shadowMaps.clear();
    }
    
    // Update pixel ratio if on mobile
    const maxPixelRatio = this.settings.textureQuality === 'low' ? 1 : 
                         this.settings.textureQuality === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  }

  getSize(): { width: number; height: number } {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    return { width: size.x, height: size.y };
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    
    // Update shadow maps if they exist
    for (const [, shadowMap] of this.shadowMaps) {
      shadowMap.setSize(this.settings.shadowMapSize, this.settings.shadowMapSize);
    }
  }

  getDrawCalls(): number {
    return this.renderer.info.render.calls;
  }

  getTriangles(): number {
    return this.renderer.info.render.triangles;
  }

  getRenderTime(): number {
    return performance.now() - this.frameStartTime;
  }

  // Advanced features
  enableInstancedRendering(): boolean {
    return this.renderer.capabilities.isWebGL2;
  }

  enableComputeShaders(): boolean {
    // WebGL doesn't support compute shaders
    return false;
  }

  getMaxTextureSize(): number {
    return this.renderer.capabilities.maxTextureSize;
  }

  getMaxTextures(): number {
    return this.renderer.capabilities.maxTextures;
  }

  supportsFloatTextures(): boolean {
    return this.renderer.capabilities.floatFragmentTextures;
  }

  supportsHalfFloatTextures(): boolean {
    return this.renderer.capabilities.floatFragmentTextures;
  }

  // Memory management
  getGPUMemoryUsage(): number {
    // Estimate GPU memory usage
    const info = this.renderer.info;
    const textureMemory = info.memory.textures * 1024 * 1024; // Rough estimate
    const geometryMemory = info.memory.geometries * 1024 * 1024; // Rough estimate
    return textureMemory + geometryMemory;
  }

  // Texture compression support
  supportsTextureCompression(): { astc: boolean; etc2: boolean; s3tc: boolean } {
    const gl = this.renderer.getContext();
    
    return {
      astc: !!gl.getExtension('WEBGL_compressed_texture_astc'),
      etc2: !!gl.getExtension('WEBGL_compressed_texture_etc'),
      s3tc: !!gl.getExtension('WEBGL_compressed_texture_s3tc')
    };
  }

  // Performance profiling
  beginFrame(): void {
    this.frameStartTime = performance.now();
  }

  endFrame(): number {
    return performance.now() - this.frameStartTime;
  }

  // Debug utilities
  getDebugInfo(): any {
    return {
      renderer: 'WebGL',
      webglVersion: this.renderer.capabilities.isWebGL2 ? 2 : 1,
      vendor: this.renderer.getContext().getParameter(this.renderer.getContext().VENDOR),
      renderer: this.renderer.getContext().getParameter(this.renderer.getContext().RENDERER),
      version: this.renderer.getContext().getParameter(this.renderer.getContext().VERSION),
      capabilities: this.renderer.capabilities,
      info: this.renderer.info,
      extensions: this.renderer.getContext().getSupportedExtensions()
    };
  }

  // Cleanup
  destroy(): void {
    console.log('Destroying WebGL renderer...');
    
    // Dispose shadow maps
    for (const [, shadowMap] of this.shadowMaps) {
      shadowMap.dispose();
    }
    this.shadowMaps.clear();
    
    // Dispose renderer
    this.renderer.dispose();
    
    console.log('WebGL renderer destroyed');
  }

  // Compatibility methods for unified interface
  getThreeRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  setRenderTarget(target: THREE.WebGLRenderTarget | null): void {
    this.renderer.setRenderTarget(target);
  }

  getRenderTarget(): THREE.WebGLRenderTarget | null {
    return this.renderer.getRenderTarget();
  }

  readRenderTargetPixels(
    target: THREE.WebGLRenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: ArrayBufferView
  ): void {
    this.renderer.readRenderTargetPixels(target, x, y, width, height, buffer);
  }

  copyFramebufferToTexture(position: THREE.Vector2, texture: THREE.Texture): void {
    this.renderer.copyFramebufferToTexture(position, texture);
  }

  copyTextureToTexture(position: THREE.Vector2, srcTexture: THREE.Texture, dstTexture: THREE.Texture): void {
    this.renderer.copyTextureToTexture(position, srcTexture, dstTexture);
  }
}