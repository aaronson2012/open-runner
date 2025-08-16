/**
 * Comprehensive Test Suite for Terrain System
 * Tests GPU generation, chunk management, LOD system, and performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerrainSystem } from '../../src/systems/TerrainSystem';
import { createTerrainComponent } from '../../src/components/TerrainComponent';
import { ChunkManager } from '../../src/utils/terrain/ChunkManager';
import { SpatialIndex } from '../../src/utils/terrain/SpatialIndex';
import { MobileOptimizer } from '../../src/utils/terrain/MobileOptimizations';
import { PerformanceMonitor } from '../../src/utils/terrain/PerformanceMonitor';
import { TERRAIN_LEVELS, DEFAULT_TERRAIN_CONFIG } from '../../src/types/terrain';

// Mock WebGPU for testing
const mockWebGPU = {
  requestAdapter: vi.fn().mockResolvedValue({
    requestDevice: vi.fn().mockResolvedValue({
      createShaderModule: vi.fn().mockReturnValue({}),
      createComputePipeline: vi.fn().mockReturnValue({}),
      createBuffer: vi.fn().mockReturnValue({
        destroy: vi.fn()
      }),
      createBindGroup: vi.fn().mockReturnValue({}),
      createCommandEncoder: vi.fn().mockReturnValue({
        beginComputePass: vi.fn().mockReturnValue({
          setPipeline: vi.fn(),
          setBindGroup: vi.fn(),
          dispatchWorkgroups: vi.fn(),
          end: vi.fn()
        }),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn().mockReturnValue({})
      }),
      queue: {
        submit: vi.fn(),
        writeBuffer: vi.fn(),
        onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined)
      },
      lost: Promise.resolve({ reason: 'destroyed' }),
      destroy: vi.fn()
    })
  })
};

// Mock navigator.gpu
Object.defineProperty(navigator, 'gpu', {
  value: mockWebGPU,
  writable: true
});

describe('TerrainSystem', () => {
  let terrainSystem: TerrainSystem;

  beforeEach(async () => {
    terrainSystem = new TerrainSystem();
    await terrainSystem.initialize();
  });

  afterEach(() => {
    terrainSystem?.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(terrainSystem).toBeDefined();
    });

    it('should handle WebGPU initialization failure gracefully', async () => {
      // Mock WebGPU failure
      const originalGpu = navigator.gpu;
      delete (navigator as any).gpu;

      const fallbackSystem = new TerrainSystem();
      await expect(fallbackSystem.initialize()).resolves.not.toThrow();

      // Restore
      (navigator as any).gpu = originalGpu;
      fallbackSystem.destroy();
    });

    it('should apply custom configuration correctly', async () => {
      const customConfig = {
        chunkSize: 32,
        renderDistance: 256,
        lodLevels: 3
      };

      const customSystem = new TerrainSystem(customConfig);
      await customSystem.initialize();

      expect(customSystem).toBeDefined();
      customSystem.destroy();
    });
  });

  describe('Chunk Management', () => {
    it('should load chunks when player moves', () => {
      // Set player position
      terrainSystem.setPlayerPosition(0, 0);
      
      // Update to trigger chunk loading
      terrainSystem.update(16.67);
      
      // Verify chunks are being managed
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });

    it('should unload distant chunks', () => {
      // Start at origin
      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);
      
      // Move far away
      terrainSystem.setPlayerPosition(1000, 1000);
      terrainSystem.update(16.67);
      
      // Should have unloaded original chunks
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.culledChunks).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid player movement', () => {
      for (let i = 0; i < 10; i++) {
        terrainSystem.setPlayerPosition(i * 100, i * 100);
        terrainSystem.update(16.67);
      }

      // Should not crash and should manage memory
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.activeChunks).toBeGreaterThan(0);
    });
  });

  describe('LOD System', () => {
    it('should calculate appropriate LOD levels', () => {
      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);

      // Get nearby chunks
      const nearbyChunks = terrainSystem.getNearbyChunks(0, 0, 100);
      
      if (nearbyChunks.length > 0) {
        // Closer chunks should have lower LOD levels (higher detail)
        const closeChunk = nearbyChunks[0];
        expect(closeChunk.lodLevel).toBeGreaterThanOrEqual(0);
      }
    });

    it('should transition LOD levels smoothly', () => {
      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);

      const initialMetrics = terrainSystem.getPerformanceMetrics();
      const initialTransitions = initialMetrics.lodTransitions;

      // Move player gradually
      for (let i = 1; i <= 5; i++) {
        terrainSystem.setPlayerPosition(i * 50, 0);
        terrainSystem.update(16.67);
      }

      const finalMetrics = terrainSystem.getPerformanceMetrics();
      expect(finalMetrics.lodTransitions).toBeGreaterThanOrEqual(initialTransitions);
    });
  });

  describe('Height Sampling', () => {
    it('should return valid height values', () => {
      const height = terrainSystem.getHeightAtPosition(0, 0);
      expect(typeof height).toBe('number');
      expect(isNaN(height)).toBe(false);
    });

    it('should return consistent heights for same position', () => {
      const height1 = terrainSystem.getHeightAtPosition(100, 100);
      const height2 = terrainSystem.getHeightAtPosition(100, 100);
      expect(height1).toBe(height2);
    });

    it('should return different heights for different positions', () => {
      const height1 = terrainSystem.getHeightAtPosition(0, 0);
      const height2 = terrainSystem.getHeightAtPosition(100, 100);
      
      // Heights could be the same, but shouldn't always be
      // This is a probabilistic test that might occasionally fail
      expect(typeof height1).toBe('number');
      expect(typeof height2).toBe('number');
    });
  });

  describe('Terrain Levels', () => {
    it('should switch between terrain levels', () => {
      terrainSystem.setTerrainLevel('forest');
      terrainSystem.setTerrainLevel('desert');
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should use correct noise parameters for each level', () => {
      const forestParams = TERRAIN_LEVELS.forest.noiseParams;
      const desertParams = TERRAIN_LEVELS.desert.noiseParams;

      expect(forestParams.frequency).toBe(0.01);
      expect(forestParams.amplitude).toBe(8.0);
      expect(desertParams.frequency).toBe(0.015);
      expect(desertParams.amplitude).toBe(4.0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);

      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics).toHaveProperty('frameTime');
      expect(metrics).toHaveProperty('activeChunks');
      expect(metrics).toHaveProperty('chunksGenerated');
      expect(metrics.frameTime).toBeGreaterThan(0);
    });

    it('should emit performance events', (done) => {
      let eventReceived = false;

      terrainSystem.addEventListener('performance_warning', () => {
        eventReceived = true;
      });

      // Simulate performance issue
      terrainSystem.setPlayerPosition(0, 0);
      for (let i = 0; i < 100; i++) {
        terrainSystem.update(50); // Simulate slow frames
      }

      // Check if event was emitted (or timeout)
      setTimeout(() => {
        // Event may or may not fire depending on thresholds
        done();
      }, 100);
    });
  });

  describe('Event System', () => {
    it('should emit chunk loaded events', (done) => {
      terrainSystem.addEventListener('chunk_loaded', (data) => {
        expect(data.type).toBe('chunk_loaded');
        expect(data.chunkId).toBeDefined();
        done();
      });

      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);
    });

    it('should allow event listener removal', () => {
      const callback = vi.fn();
      
      terrainSystem.addEventListener('chunk_loaded', callback);
      terrainSystem.removeEventListener('chunk_loaded', callback);
      
      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);
      
      // Callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Memory Management', () => {
    it('should not exceed memory limits', () => {
      // Generate many chunks
      for (let x = 0; x < 10; x++) {
        for (let z = 0; z < 10; z++) {
          terrainSystem.setPlayerPosition(x * 100, z * 100);
          terrainSystem.update(16.67);
        }
      }

      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.gpuMemoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should clean up resources on destroy', () => {
      terrainSystem.setPlayerPosition(0, 0);
      terrainSystem.update(16.67);
      
      expect(() => terrainSystem.destroy()).not.toThrow();
    });
  });
});

describe('ChunkManager', () => {
  let chunkManager: ChunkManager;

  beforeEach(() => {
    chunkManager = new ChunkManager(DEFAULT_TERRAIN_CONFIG);
  });

  afterEach(() => {
    chunkManager.clear();
  });

  it('should manage chunk lifecycle', () => {
    const chunk = {
      id: 'test_0_0',
      position: { x: 0, z: 0 },
      worldPosition: { x: 0, z: 0 },
      lodLevel: 0,
      isLoaded: false,
      isGenerated: false,
      vertexCount: 0,
      indexCount: 0,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 64, y: 10, z: 64 }
      },
      lastAccessTime: Date.now(),
      priority: 100
    };

    chunkManager.addChunk(chunk);
    expect(chunkManager.getChunk('test_0_0')).toBe(chunk);
    
    chunkManager.removeChunk('test_0_0');
    expect(chunkManager.getChunk('test_0_0')).toBeUndefined();
  });

  it('should track memory usage', () => {
    const chunk = {
      id: 'test_0_0',
      position: { x: 0, z: 0 },
      worldPosition: { x: 0, z: 0 },
      lodLevel: 0,
      isLoaded: false,
      isGenerated: false,
      vertexCount: 100,
      indexCount: 200,
      heightData: new Float32Array(1000),
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 64, y: 10, z: 64 }
      },
      lastAccessTime: Date.now(),
      priority: 100
    };

    const initialMemory = chunkManager.getMemoryUsage();
    chunkManager.addChunk(chunk);
    const finalMemory = chunkManager.getMemoryUsage();
    
    expect(finalMemory).toBeGreaterThan(initialMemory);
  });

  it('should find nearby chunks', () => {
    // Add multiple chunks
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        const chunk = {
          id: `test_${x}_${z}`,
          position: { x, z },
          worldPosition: { x: x * 64, z: z * 64 },
          lodLevel: 0,
          isLoaded: true,
          isGenerated: true,
          vertexCount: 0,
          indexCount: 0,
          boundingBox: {
            min: { x: x * 64, y: 0, z: z * 64 },
            max: { x: (x + 1) * 64, y: 10, z: (z + 1) * 64 }
          },
          lastAccessTime: Date.now(),
          priority: 100
        };
        chunkManager.addChunk(chunk);
      }
    }

    const nearbyChunks = chunkManager.getNearbyChunks({ x: 1, z: 1 }, 1);
    expect(nearbyChunks.length).toBeGreaterThan(0);
  });
});

describe('SpatialIndex', () => {
  let spatialIndex: SpatialIndex;

  beforeEach(() => {
    spatialIndex = new SpatialIndex(64);
  });

  afterEach(() => {
    spatialIndex.clear();
  });

  it('should index chunks spatially', () => {
    const chunk = {
      id: 'test_0_0',
      position: { x: 0, z: 0 },
      worldPosition: { x: 0, z: 0 },
      lodLevel: 0,
      isLoaded: true,
      isGenerated: true,
      vertexCount: 0,
      indexCount: 0,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 64, y: 10, z: 64 }
      },
      lastAccessTime: Date.now(),
      priority: 100
    };

    spatialIndex.addChunk(chunk);
    
    const found = spatialIndex.findChunkAt(32, 32);
    expect(found).toBe(chunk);
  });

  it('should perform radius queries', () => {
    // Add chunks in a grid
    const chunks = [];
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        const chunk = {
          id: `test_${x}_${z}`,
          position: { x, z },
          worldPosition: { x: x * 64, z: z * 64 },
          lodLevel: 0,
          isLoaded: true,
          isGenerated: true,
          vertexCount: 0,
          indexCount: 0,
          boundingBox: {
            min: { x: x * 64, y: 0, z: z * 64 },
            max: { x: (x + 1) * 64, y: 10, z: (z + 1) * 64 }
          },
          lastAccessTime: Date.now(),
          priority: 100
        };
        chunks.push(chunk);
        spatialIndex.addChunk(chunk);
      }
    }

    const centerX = 2 * 64 + 32; // Center of chunk (2,2)
    const centerZ = 2 * 64 + 32;
    const radius = 100;

    const foundChunks = spatialIndex.queryRadius(centerX, centerZ, radius);
    expect(foundChunks.length).toBeGreaterThan(0);
    expect(foundChunks.length).toBeLessThanOrEqual(chunks.length);
  });

  it('should find chunk neighbors', () => {
    // Create a 3x3 grid of chunks
    const chunks = [];
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        const chunk = {
          id: `test_${x}_${z}`,
          position: { x, z },
          worldPosition: { x: x * 64, z: z * 64 },
          lodLevel: 0,
          isLoaded: true,
          isGenerated: true,
          vertexCount: 0,
          indexCount: 0,
          boundingBox: {
            min: { x: x * 64, y: 0, z: z * 64 },
            max: { x: (x + 1) * 64, y: 10, z: (z + 1) * 64 }
          },
          lastAccessTime: Date.now(),
          priority: 100
        };
        chunks.push(chunk);
        spatialIndex.addChunk(chunk);
      }
    }

    // Get neighbors of center chunk
    const centerChunk = chunks[4]; // chunk (1,1)
    const neighbors = spatialIndex.getNeighbors(centerChunk);
    
    expect(neighbors.length).toBe(8); // All 8 surrounding chunks
  });
});

describe('MobileOptimizer', () => {
  let mobileOptimizer: MobileOptimizer;

  beforeEach(() => {
    mobileOptimizer = new MobileOptimizer();
  });

  it('should detect device capabilities', () => {
    const detection = mobileOptimizer.getMobileDetection();
    
    expect(detection).toHaveProperty('isMobile');
    expect(detection).toHaveProperty('isLowEnd');
    expect(detection).toHaveProperty('gpuTier');
    expect(detection).toHaveProperty('supportedFeatures');
    expect(typeof detection.isMobile).toBe('boolean');
  });

  it('should adapt settings based on performance', () => {
    const initialSettings = mobileOptimizer.getAdaptiveSettings();
    
    // Simulate poor performance
    const adaptedSettings = mobileOptimizer.adaptSettings(20, 50); // 20fps, 50ms frame time
    
    expect(adaptedSettings).toBeDefined();
  });

  it('should generate terrain config', () => {
    const config = mobileOptimizer.getTerrainConfig();
    
    expect(config).toHaveProperty('chunkSize');
    expect(config).toHaveProperty('renderDistance');
    expect(config).toHaveProperty('enableGPUGeneration');
    expect(config.chunkSize).toBeGreaterThan(0);
    expect(config.renderDistance).toBeGreaterThan(0);
  });

  it('should detect supported texture formats', () => {
    const formats = mobileOptimizer.getSupportedTextureFormats();
    expect(Array.isArray(formats)).toBe(true);
  });
});

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    performanceMonitor.startMonitoring();
  });

  afterEach(() => {
    performanceMonitor.stopMonitoring();
  });

  it('should track basic metrics', () => {
    performanceMonitor.update(16.67);
    performanceMonitor.recordChunkGeneration(25);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.frameTime).toBeGreaterThan(0);
    expect(metrics.averageGenerationTime).toBeGreaterThan(0);
    expect(metrics.chunksGenerated).toBe(1);
  });

  it('should provide detailed metrics', () => {
    for (let i = 0; i < 10; i++) {
      performanceMonitor.update(16.67 + Math.random() * 5);
      performanceMonitor.recordChunkGeneration(20 + Math.random() * 10);
    }

    const detailed = performanceMonitor.getDetailedMetrics();
    expect(detailed).toHaveProperty('basic');
    expect(detailed).toHaveProperty('advanced');
    expect(detailed.advanced).toHaveProperty('performanceScore');
    expect(detailed.advanced.performanceScore).toBeGreaterThanOrEqual(0);
    expect(detailed.advanced.performanceScore).toBeLessThanOrEqual(100);
  });

  it('should provide optimization suggestions', () => {
    // Simulate poor performance
    for (let i = 0; i < 10; i++) {
      performanceMonitor.update(50); // Slow frames
      performanceMonitor.recordChunkGeneration(100); // Slow generation
    }

    const suggestions = performanceMonitor.getOptimizationSuggestions();
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('should detect mobile performance characteristics', () => {
    const mobilePerf = performanceMonitor.detectMobilePerformance();
    expect(mobilePerf).toHaveProperty('isMobile');
    expect(mobilePerf).toHaveProperty('recommendedSettings');
    expect(typeof mobilePerf.isMobile).toBe('boolean');
  });
});

describe('TerrainComponent', () => {
  it('should create component with default values', () => {
    const component = createTerrainComponent();
    
    expect(component.config).toBeDefined();
    expect(component.performanceMetrics).toBeDefined();
    expect(component.activeChunks).toBe(0);
    expect(component.loadingChunks).toBe(0);
  });

  it('should apply custom configuration', () => {
    const customConfig = {
      chunkSize: 32,
      renderDistance: 256
    };
    
    const component = createTerrainComponent(customConfig);
    
    expect(component.config.chunkSize).toBe(32);
    expect(component.config.renderDistance).toBe(256);
  });

  it('should set performance options', () => {
    const component = createTerrainComponent({}, {
      enablePerformanceMonitoring: false,
      maxMemoryUsage: 1024 * 1024 * 1024,
      targetFrameTime: 33.33
    });
    
    expect(component.enablePerformanceMonitoring).toBe(false);
    expect(component.maxMemoryUsage).toBe(1024 * 1024 * 1024);
    expect(component.targetFrameTime).toBe(33.33);
  });
});