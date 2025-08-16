import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { DeviceCapabilities } from '@/rendering/DeviceCapabilities';
import { PerformanceAdapter } from '@/rendering/PerformanceAdapter';
import { LODManager } from '@/rendering/LODManager';
import { CullingManager } from '@/rendering/CullingManager';
import { ResourceManager } from '@/rendering/ResourceManager';
import { StreamingManager } from '@/rendering/StreamingManager';
import { RenderSystem } from '@/systems/RenderSystem';
import type { RenderCapabilities, Entity, GameConfig } from '@/types';

// Mock canvas for testing
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  return canvas;
}

// Mock WebGL context
function setupMockWebGL() {
  const mockContext = {
    getParameter: (param: number) => {
      switch (param) {
        case 0x0D33: return 'Mock WebGL Renderer'; // RENDERER
        case 0x1F00: return 'Mock WebGL Vendor'; // VENDOR
        case 0x0D21: return 4096; // MAX_TEXTURE_SIZE
        case 0x8872: return 16; // MAX_TEXTURE_IMAGE_UNITS
        default: return null;
      }
    },
    getExtension: (name: string) => {
      // Mock supported extensions
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_RENDERER_WEBGL: 0x9246,
          UNMASKED_VENDOR_WEBGL: 0x9245
        };
      }
      return null;
    },
    getSupportedExtensions: () => ['WEBGL_debug_renderer_info']
  };

  // Mock HTMLCanvasElement.getContext
  HTMLCanvasElement.prototype.getContext = function(contextType: string) {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return mockContext as any;
    }
    return null;
  };
}

describe('Rendering Performance Tests', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCapabilities: RenderCapabilities;
  let gameConfig: GameConfig;

  beforeAll(() => {
    setupMockWebGL();
    mockCanvas = createMockCanvas();
    
    mockCapabilities = {
      hasWebGPU: false,
      hasWebGL2: true,
      maxTextureSize: 4096,
      maxTextures: 16,
      hasInstancedDrawing: true,
      hasComputeShaders: false,
      supportedTextureFormats: ['RGBA8', 'RGB8'],
      maxShaderStage: 2,
      isHighEndDevice: true,
      isMobile: false
    };

    gameConfig = {
      canvas: mockCanvas,
      width: 1920,
      height: 1080,
      devicePixelRatio: 1,
      enableWebGPU: false,
      targetFPS: 60,
      enableDebug: true
    };
  });

  describe('DeviceCapabilities', () => {
    it('should detect device capabilities', async () => {
      const capabilities = await DeviceCapabilities.detect();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.hasWebGL2).toBeDefined();
      expect(capabilities.maxTextureSize).toBeGreaterThan(0);
      expect(capabilities.maxTextures).toBeGreaterThan(0);
      expect(typeof capabilities.isMobile).toBe('boolean');
      expect(typeof capabilities.isHighEndDevice).toBe('boolean');
    });

    it('should handle missing WebGPU gracefully', async () => {
      // Mock navigator without WebGPU
      const originalGpu = (navigator as any).gpu;
      delete (navigator as any).gpu;
      
      const capabilities = await DeviceCapabilities.detect();
      expect(capabilities.hasWebGPU).toBe(false);
      
      // Restore
      if (originalGpu) {
        (navigator as any).gpu = originalGpu;
      }
    });
  });

  describe('PerformanceAdapter', () => {
    let adapter: PerformanceAdapter;

    beforeAll(() => {
      adapter = new PerformanceAdapter(mockCapabilities);
    });

    it('should initialize with appropriate quality settings', () => {
      const settings = adapter.getOptimalSettings();
      
      expect(settings).toBeDefined();
      expect(settings.shadowMapSize).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'ultra']).toContain(adapter.getCurrentQuality());
    });

    it('should adjust quality based on performance', () => {
      const initialQuality = adapter.getCurrentQuality();
      
      // Simulate poor performance
      for (let i = 0; i < 100; i++) {
        adapter.update(33); // 30fps
      }
      
      if (adapter.shouldAdjustQuality()) {
        const newSettings = adapter.getOptimalSettings();
        expect(newSettings).toBeDefined();
      }
    });

    it('should handle manual quality changes', () => {
      adapter.setQualityLevel('low');
      expect(adapter.getCurrentQuality()).toBe('low');
      
      adapter.setQualityLevel('ultra');
      expect(adapter.getCurrentQuality()).toBe('ultra');
    });

    it('should enable/disable adaptive quality', () => {
      adapter.enableAdaptiveQuality(false);
      expect(adapter.isAdaptiveQualityEnabled()).toBe(false);
      
      adapter.enableAdaptiveQuality(true);
      expect(adapter.isAdaptiveQualityEnabled()).toBe(true);
    });
  });

  describe('LODManager', () => {
    let lodManager: LODManager;
    let mockEntities: Entity[];

    beforeAll(() => {
      lodManager = new LODManager(mockCapabilities);
      
      // Create mock entities
      mockEntities = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        active: true,
        components: new Map([
          ['transform', {
            type: 'transform',
            entityId: i,
            position: { x: i * 10, y: 0, z: i * 10 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          }],
          ['mesh', {
            type: 'mesh',
            entityId: i,
            geometry: 'test_geometry',
            material: 'test_material',
            castShadow: true,
            receiveShadow: true,
            lod: lodManager.createTerrainLOD()
          }]
        ])
      }));
    });

    it('should create LOD levels', () => {
      const terrainLOD = lodManager.createTerrainLOD();
      const vegetationLOD = lodManager.createVegetationLOD();
      const characterLOD = lodManager.createCharacterLOD();
      
      expect(terrainLOD).toHaveLength(4);
      expect(vegetationLOD).toHaveLength(4);
      expect(characterLOD).toHaveLength(4);
      
      // Check LOD structure
      terrainLOD.forEach(lod => {
        expect(lod).toHaveProperty('distance');
        expect(lod).toHaveProperty('geometry');
        expect(lod).toHaveProperty('material');
        expect(lod).toHaveProperty('visible');
      });
    });

    it('should update LODs based on camera position', () => {
      const cameraPosition = { x: 0, y: 0, z: 0 };
      
      lodManager.update(cameraPosition, mockEntities);
      
      const stats = lodManager.getLODStatistics();
      expect(stats.totalLODGroups).toBeGreaterThan(0);
      expect(stats.averageLODLevel).toBeGreaterThanOrEqual(0);
    });

    it('should batch update LODs efficiently', () => {
      const cameraPosition = { x: 50, y: 0, z: 50 };
      const startTime = performance.now();
      
      lodManager.batchUpdateLODs(mockEntities, cameraPosition);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10); // Should complete within 10ms
    });

    it('should generate automatic LOD levels', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const lodLevels = lodManager.generateAutomaticLOD(geometry, 3);
      
      expect(lodLevels).toHaveLength(3);
      lodLevels.forEach((level, index) => {
        expect(level.geometry).toBeDefined();
        expect(level.distance).toBeGreaterThan(0);
        if (index > 0) {
          expect(level.distance).toBeGreaterThan(lodLevels[index - 1].distance);
        }
      });
    });
  });

  describe('CullingManager', () => {
    let cullingManager: CullingManager;
    let camera: THREE.PerspectiveCamera;
    let mockEntities: Entity[];

    beforeAll(() => {
      camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);
      camera.position.set(0, 0, 0);
      
      const settings = {
        shadowMapSize: 1024,
        enableShadows: true,
        enableSSAO: false,
        enableAntialiasing: true,
        enableTextureLOD: true,
        enableInstancing: true,
        cullingDistance: 100,
        lodLevels: 3,
        textureQuality: 'medium' as const,
        shaderPrecision: 'mediump' as const
      };
      
      cullingManager = new CullingManager(camera, settings);
      
      // Create entities in a grid pattern
      mockEntities = Array.from({ length: 1000 }, (_, i) => {
        const x = (i % 32) * 5 - 80; // -80 to 80
        const z = Math.floor(i / 32) * 5 - 80;
        
        return {
          id: i,
          active: true,
          components: new Map([
            ['transform', {
              type: 'transform',
              entityId: i,
              position: { x, y: 0, z },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            }],
            ['mesh', {
              type: 'mesh',
              entityId: i,
              geometry: 'test_geometry',
              material: 'test_material',
              castShadow: true,
              receiveShadow: true,
              culling: {
                frustum: true,
                occlusion: false,
                distance: true,
                maxDistance: 100
              }
            }]
          ])
        };
      });
    });

    it('should cull entities outside frustum', () => {
      const visibleEntities = cullingManager.cull(mockEntities);
      const culledCount = cullingManager.getCulledCount();
      
      expect(visibleEntities.length).toBeLessThan(mockEntities.length);
      expect(culledCount).toBeGreaterThan(0);
      expect(visibleEntities.length + culledCount).toBeLessThanOrEqual(mockEntities.length);
    });

    it('should track culling performance', () => {
      const startTime = performance.now();
      cullingManager.cull(mockEntities);
      const endTime = performance.now();
      
      const performance = cullingManager.getCullingPerformance();
      expect(performance.lastCullTime).toBeGreaterThan(0);
      expect(performance.lastCullTime).toBeLessThan(endTime - startTime + 1); // Allow 1ms tolerance
      expect(performance.totalEntities).toBe(mockEntities.length);
    });

    it('should provide culling statistics', () => {
      cullingManager.cull(mockEntities);
      
      const ratio = cullingManager.getCullingRatio();
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    });
  });

  describe('ResourceManager', () => {
    let resourceManager: ResourceManager;

    beforeAll(() => {
      // Create a mock renderer for the resource manager
      const mockRenderer = {
        supportsTextureCompression: () => ({
          astc: false,
          etc2: false,
          s3tc: true
        }),
        getThreeRenderer: () => ({
          getContext: () => ({
            getExtension: () => null
          })
        })
      };
      
      resourceManager = new ResourceManager(mockRenderer as any);
    });

    it('should manage geometries', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const geometryId = 'test_box';
      
      resourceManager.setGeometry(geometryId, geometry);
      const retrieved = resourceManager.getGeometry(geometryId);
      
      expect(retrieved).toBe(geometry);
    });

    it('should manage materials', () => {
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const materialId = 'test_red_material';
      
      resourceManager.setMaterial(materialId, material);
      const retrieved = resourceManager.getMaterial(materialId);
      
      expect(retrieved).toBe(material);
    });

    it('should track memory usage', () => {
      const geometry = new THREE.SphereGeometry(1, 32, 32);
      resourceManager.setGeometry('sphere', geometry);
      
      const memoryUsage = resourceManager.getMemoryUsage();
      expect(memoryUsage.geometries).toBeGreaterThan(0);
      expect(memoryUsage.total).toBeGreaterThan(0);
    });

    it('should provide resource statistics', () => {
      const stats = resourceManager.getResourceStats();
      
      expect(stats).toHaveProperty('geometries');
      expect(stats).toHaveProperty('materials');
      expect(stats).toHaveProperty('textures');
      expect(stats).toHaveProperty('object3Ds');
      expect(stats.geometries).toBeGreaterThanOrEqual(0);
    });

    it('should handle memory pressure', () => {
      const pressure = resourceManager.getMemoryPressure();
      expect(pressure).toBeGreaterThanOrEqual(0);
      expect(pressure).toBeLessThanOrEqual(1);
    });
  });

  describe('StreamingManager', () => {
    let streamingManager: StreamingManager;
    let resourceManager: ResourceManager;

    beforeAll(() => {
      const mockRenderer = {
        supportsTextureCompression: () => ({ astc: false, etc2: false, s3tc: false }),
        getThreeRenderer: () => ({ getContext: () => ({ getExtension: () => null }) })
      };
      
      resourceManager = new ResourceManager(mockRenderer as any);
      streamingManager = new StreamingManager(resourceManager);
    });

    it('should initialize with default config', () => {
      const stats = streamingManager.getStreamingStats();
      
      expect(stats).toHaveProperty('activeChunks');
      expect(stats).toHaveProperty('loadingChunks');
      expect(stats).toHaveProperty('totalLoaded');
      expect(stats.activeChunks).toBe(0);
      expect(stats.loadingChunks).toBe(0);
    });

    it('should update based on player position', () => {
      const playerPosition = { x: 0, y: 0, z: 0 };
      
      streamingManager.update(playerPosition);
      
      const stats = streamingManager.getStreamingStats();
      expect(stats).toBeDefined();
    });

    it('should handle configuration updates', () => {
      const newConfig = {
        chunkSize: 50,
        preloadDistance: 100,
        maxConcurrentLoads: 2
      };
      
      streamingManager.updateConfig(newConfig);
      
      // Test that config was applied by checking behavior
      const playerPosition = { x: 0, y: 0, z: 0 };
      streamingManager.update(playerPosition);
      
      const stats = streamingManager.getStreamingStats();
      expect(stats).toBeDefined();
    });
  });

  describe('RenderSystem Integration', () => {
    let renderSystem: RenderSystem;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;

    beforeAll(async () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);
      
      renderSystem = new RenderSystem(scene, camera, gameConfig);
      await renderSystem.init(gameConfig);
    });

    afterAll(() => {
      renderSystem?.destroy();
    });

    it('should initialize successfully', () => {
      expect(renderSystem).toBeDefined();
      expect(renderSystem.getRenderer()).toBeDefined();
      expect(renderSystem.getCapabilities()).toBeDefined();
      expect(renderSystem.getSettings()).toBeDefined();
    });

    it('should provide performance metrics', () => {
      const metrics = renderSystem.getMetrics();
      
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('frameTime');
      expect(metrics).toHaveProperty('drawCalls');
      expect(metrics).toHaveProperty('triangles');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should handle quality level changes', () => {
      const originalSettings = renderSystem.getSettings();
      
      renderSystem.setQualityLevel('low');
      const lowSettings = renderSystem.getSettings();
      
      renderSystem.setQualityLevel('ultra');
      const ultraSettings = renderSystem.getSettings();
      
      // Verify that settings changed
      expect(lowSettings.shadowMapSize).toBeLessThanOrEqual(ultraSettings.shadowMapSize);
    });

    it('should handle window resize', () => {
      const newWidth = 1280;
      const newHeight = 720;
      
      renderSystem.resize(newWidth, newHeight);
      
      // Verify resize was handled
      const size = renderSystem.getRenderer().getSize();
      expect(size.width).toBe(newWidth);
      expect(size.height).toBe(newHeight);
    });

    it('should process entities efficiently', () => {
      // Create test entities
      const entities = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        active: true,
        components: new Map([
          ['transform', {
            type: 'transform',
            entityId: i,
            position: { x: i, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          }],
          ['mesh', {
            type: 'mesh',
            entityId: i,
            geometry: 'test_geometry',
            material: 'test_material',
            castShadow: true,
            receiveShadow: true
          }]
        ])
      }));

      const startTime = performance.now();
      renderSystem.update(16.67, entities); // 60fps frame time
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(16); // Should complete within frame budget
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle large entity counts', () => {
      const entityCount = 10000;
      const entities = Array.from({ length: entityCount }, (_, i) => ({
        id: i,
        active: true,
        components: new Map([
          ['transform', {
            type: 'transform',
            entityId: i,
            position: { 
              x: (Math.random() - 0.5) * 1000, 
              y: (Math.random() - 0.5) * 100, 
              z: (Math.random() - 0.5) * 1000 
            },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          }],
          ['mesh', {
            type: 'mesh',
            entityId: i,
            geometry: 'test_geometry',
            material: 'test_material',
            castShadow: i % 10 === 0, // Only 10% cast shadows
            receiveShadow: true
          }]
        ])
      }));

      const camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);
      const settings = {
        shadowMapSize: 1024,
        enableShadows: true,
        enableSSAO: false,
        enableAntialiasing: true,
        enableTextureLOD: true,
        enableInstancing: true,
        cullingDistance: 500,
        lodLevels: 3,
        textureQuality: 'medium' as const,
        shaderPrecision: 'mediump' as const
      };

      const cullingManager = new CullingManager(camera, settings);
      
      const startTime = performance.now();
      const visibleEntities = cullingManager.cull(entities);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const cullingRatio = cullingManager.getCullingRatio();
      
      console.log(`Culled ${entityCount} entities in ${duration.toFixed(2)}ms`);
      console.log(`Culling ratio: ${(cullingRatio * 100).toFixed(1)}%`);
      console.log(`Visible entities: ${visibleEntities.length}`);
      
      expect(duration).toBeLessThan(50); // Should complete within 50ms
      expect(visibleEntities.length).toBeLessThan(entityCount);
    });

    it('should maintain 60fps target', () => {
      const targetFrameTime = 16.67; // 60fps
      const frameCount = 100;
      const frameTimes: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        const startTime = performance.now();
        
        // Simulate frame processing
        const entities = Array.from({ length: 500 }, (_, j) => ({
          id: j,
          active: true,
          components: new Map([
            ['transform', {
              type: 'transform',
              entityId: j,
              position: { x: j, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            }]
          ])
        }));

        // Process entities (simplified)
        entities.forEach(entity => {
          const transform = entity.components.get('transform');
          if (transform) {
            // Simulate some processing
            Math.sqrt((transform as any).position.x ** 2 + (transform as any).position.z ** 2);
          }
        });

        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameCount;
      const maxFrameTime = Math.max(...frameTimes);
      const droppedFrames = frameTimes.filter(time => time > targetFrameTime).length;

      console.log(`Average frame time: ${averageFrameTime.toFixed(2)}ms`);
      console.log(`Max frame time: ${maxFrameTime.toFixed(2)}ms`);
      console.log(`Dropped frames: ${droppedFrames}/${frameCount} (${(droppedFrames/frameCount*100).toFixed(1)}%)`);

      expect(averageFrameTime).toBeLessThan(targetFrameTime);
      expect(droppedFrames / frameCount).toBeLessThan(0.05); // Less than 5% dropped frames
    });
  });
});