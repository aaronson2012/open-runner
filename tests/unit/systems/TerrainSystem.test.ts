import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { TerrainComponent } from '@/components/TerrainComponent';
import { World } from '@/core/ecs/World';
import { ChunkManager } from '@/utils/terrain/ChunkManager';
import { GPUTerrainGenerator } from '@/utils/terrain/GPUTerrainGenerator';
import { PerformanceMonitor } from '@/utils/terrain/PerformanceMonitor';
import type { Entity, Vector3 } from '@/types';

describe('TerrainSystem', () => {
  let terrainSystem: TerrainSystem;
  let world: World;
  let terrainEntity: Entity;
  let terrainComponent: TerrainComponent;
  let chunkManager: ChunkManager;

  beforeEach(() => {
    world = new World({ enableProfiling: true });
    terrainSystem = new TerrainSystem({
      chunkSize: 64,
      viewDistance: 5,
      lodLevels: 3,
      enableGPUGeneration: true,
      enableCollision: true,
      terrainHeight: 100,
      noiseScale: 0.1
    });
    
    world.addSystem(terrainSystem);

    // Create terrain entity
    const entityId = world.createEntity();
    terrainComponent = new TerrainComponent(entityId);
    
    const transform = {
      type: 'transform' as const,
      entityId,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };

    world.addComponent(entityId, terrainComponent);
    world.addComponent(entityId, transform);
    
    terrainEntity = world.getEntity(entityId)!;
    chunkManager = new ChunkManager();
  });

  describe('System Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(terrainSystem.id).toBe('terrain');
      expect(terrainSystem.priority).toBeGreaterThan(0);
      expect(terrainSystem.requiredComponents).toContain('terrain');
    });

    it('should initialize chunk manager', () => {
      world.start();
      
      const stats = terrainSystem.getStats();
      expect(stats.chunkManager).toBeDefined();
    });

    it('should setup GPU terrain generator when enabled', () => {
      const config = terrainSystem.getConfig();
      expect(config.enableGPUGeneration).toBe(true);
    });

    it('should initialize performance monitoring', () => {
      world.start();
      world.update(0.016);
      
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.frameTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Chunk Management', () => {
    beforeEach(() => {
      world.start();
    });

    it('should generate initial chunks around player', () => {
      // Set player position
      const playerPos: Vector3 = { x: 32, y: 0, z: 32 };
      terrainSystem.updatePlayerPosition(playerPos);
      
      world.update(0.016);
      
      const stats = terrainSystem.getStats();
      expect(stats.loadedChunks).toBeGreaterThan(0);
    });

    it('should load chunks within view distance', () => {
      const playerPos: Vector3 = { x: 0, y: 0, z: 0 };
      terrainSystem.updatePlayerPosition(playerPos);
      
      world.update(0.016);
      
      const viewDistance = terrainSystem.getConfig().viewDistance;
      const expectedChunks = Math.pow((viewDistance * 2 + 1), 2);
      
      const stats = terrainSystem.getStats();
      expect(stats.loadedChunks).toBeLessThanOrEqual(expectedChunks);
    });

    it('should unload chunks outside view distance', () => {
      // Load chunks at origin
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      const initialChunks = terrainSystem.getStats().loadedChunks;
      
      // Move player far away
      terrainSystem.updatePlayerPosition({ x: 1000, y: 0, z: 1000 });
      world.update(0.016);
      
      const finalChunks = terrainSystem.getStats().loadedChunks;
      
      // Old chunks should be unloaded
      expect(finalChunks).toBeLessThanOrEqual(initialChunks);
    });

    it('should handle chunk coordinate calculations correctly', () => {
      const worldPos: Vector3 = { x: 130, y: 0, z: 67 };
      const chunkSize = terrainSystem.getConfig().chunkSize;
      
      const expectedChunkX = Math.floor(130 / chunkSize);
      const expectedChunkZ = Math.floor(67 / chunkSize);
      
      const chunkCoords = terrainSystem.worldToChunkCoords(worldPos);
      expect(chunkCoords.x).toBe(expectedChunkX);
      expect(chunkCoords.z).toBe(expectedChunkZ);
    });

    it('should prioritize chunk loading by distance', () => {
      const playerPos: Vector3 = { x: 64, y: 0, z: 64 };
      terrainSystem.updatePlayerPosition(playerPos);
      
      world.update(0.016);
      
      const loadedChunks = terrainSystem.getLoadedChunks();
      expect(loadedChunks.length).toBeGreaterThan(0);
      
      // Closer chunks should be loaded first
      const playerChunkCoords = terrainSystem.worldToChunkCoords(playerPos);
      const hasPlayerChunk = loadedChunks.some(chunk => 
        chunk.x === playerChunkCoords.x && chunk.z === playerChunkCoords.z
      );
      expect(hasPlayerChunk).toBe(true);
    });
  });

  describe('Terrain Generation', () => {
    beforeEach(() => {
      world.start();
    });

    it('should generate height data for chunks', async () => {
      const chunkCoords = { x: 0, z: 0 };
      const heightData = await terrainSystem.generateChunkHeightData(chunkCoords);
      
      expect(heightData).toBeDefined();
      expect(heightData.length).toBeGreaterThan(0);
      
      // Height data should be within reasonable bounds
      heightData.forEach(height => {
        expect(height).toBeGreaterThanOrEqual(0);
        expect(height).toBeLessThanOrEqual(terrainSystem.getConfig().terrainHeight);
      });
    });

    it('should generate consistent height data for same coordinates', async () => {
      const chunkCoords = { x: 1, z: 1 };
      
      const heightData1 = await terrainSystem.generateChunkHeightData(chunkCoords);
      const heightData2 = await terrainSystem.generateChunkHeightData(chunkCoords);
      
      expect(heightData1).toEqual(heightData2);
    });

    it('should apply noise scale correctly', async () => {
      const config = terrainSystem.getConfig();
      const originalScale = config.noiseScale;
      
      // Generate with current scale
      const heightData1 = await terrainSystem.generateChunkHeightData({ x: 0, z: 0 });
      
      // Change noise scale
      terrainSystem.updateConfig({ noiseScale: originalScale * 2 });
      
      // Generate with new scale
      const heightData2 = await terrainSystem.generateChunkHeightData({ x: 0, z: 0 });
      
      // Height data should be different
      expect(heightData1).not.toEqual(heightData2);
    });

    it('should handle biome transitions smoothly', async () => {
      const biome1 = { x: 0, z: 0 };
      const biome2 = { x: 1, z: 0 }; // Adjacent chunk
      
      const heightData1 = await terrainSystem.generateChunkHeightData(biome1);
      const heightData2 = await terrainSystem.generateChunkHeightData(biome2);
      
      // Adjacent chunks should have similar edge heights for smooth transitions
      const chunkSize = terrainSystem.getConfig().chunkSize;
      const edge1 = heightData1.slice(-chunkSize); // Right edge of chunk 1
      const edge2 = heightData2.slice(0, chunkSize); // Left edge of chunk 2
      
      // Heights should be reasonably close for seamless transitions
      for (let i = 0; i < Math.min(edge1.length, edge2.length); i++) {
        const heightDiff = Math.abs(edge1[i] - edge2[i]);
        expect(heightDiff).toBeLessThan(10); // Max 10 units difference
      }
    });
  });

  describe('Level of Detail (LOD)', () => {
    beforeEach(() => {
      world.start();
    });

    it('should apply different LOD levels based on distance', () => {
      const playerPos: Vector3 = { x: 0, y: 0, z: 0 };
      terrainSystem.updatePlayerPosition(playerPos);
      
      world.update(0.016);
      
      const lodLevels = terrainSystem.getConfig().lodLevels;
      const loadedChunks = terrainSystem.getLoadedChunks();
      
      loadedChunks.forEach(chunk => {
        expect(chunk.lodLevel).toBeGreaterThanOrEqual(0);
        expect(chunk.lodLevel).toBeLessThan(lodLevels);
      });
    });

    it('should use highest LOD for closest chunks', () => {
      const playerPos: Vector3 = { x: 32, y: 0, z: 32 };
      terrainSystem.updatePlayerPosition(playerPos);
      
      world.update(0.016);
      
      const playerChunkCoords = terrainSystem.worldToChunkCoords(playerPos);
      const loadedChunks = terrainSystem.getLoadedChunks();
      
      const playerChunk = loadedChunks.find(chunk => 
        chunk.x === playerChunkCoords.x && chunk.z === playerChunkCoords.z
      );
      
      expect(playerChunk?.lodLevel).toBe(0); // Highest LOD
    });

    it('should reduce LOD for distant chunks', () => {
      const playerPos: Vector3 = { x: 0, y: 0, z: 0 };
      terrainSystem.updatePlayerPosition(playerPos);
      
      world.update(0.016);
      
      const loadedChunks = terrainSystem.getLoadedChunks();
      const distantChunks = loadedChunks.filter(chunk => {
        const distance = Math.sqrt(chunk.x * chunk.x + chunk.z * chunk.z);
        return distance > 3;
      });
      
      distantChunks.forEach(chunk => {
        expect(chunk.lodLevel).toBeGreaterThan(0); // Lower LOD
      });
    });

    it('should update LOD when player moves', () => {
      // Start at origin
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      const initialChunks = terrainSystem.getLoadedChunks();
      
      // Move player
      terrainSystem.updatePlayerPosition({ x: 128, y: 0, z: 128 });
      world.update(0.016);
      
      const newChunks = terrainSystem.getLoadedChunks();
      
      // LOD levels should be updated based on new player position
      expect(newChunks.length).toBeGreaterThan(0);
    });
  });

  describe('Collision Detection', () => {
    beforeEach(() => {
      world.start();
      terrainSystem.updatePlayerPosition({ x: 32, y: 0, z: 32 });
      world.update(0.016);
    });

    it('should provide height at world position', () => {
      const worldPos: Vector3 = { x: 35, y: 0, z: 40 };
      const height = terrainSystem.getHeightAtPosition(worldPos);
      
      expect(height).toBeGreaterThanOrEqual(0);
      expect(height).toBeLessThanOrEqual(terrainSystem.getConfig().terrainHeight);
    });

    it('should interpolate height between vertices', () => {
      const pos1: Vector3 = { x: 32, y: 0, z: 32 };
      const pos2: Vector3 = { x: 32.5, y: 0, z: 32.5 };
      
      const height1 = terrainSystem.getHeightAtPosition(pos1);
      const height2 = terrainSystem.getHeightAtPosition(pos2);
      
      // Heights should be smoothly interpolated
      expect(Math.abs(height2 - height1)).toBeLessThan(50);
    });

    it('should calculate terrain normal at position', () => {
      const worldPos: Vector3 = { x: 35, y: 0, z: 40 };
      const normal = terrainSystem.getNormalAtPosition(worldPos);
      
      expect(normal).toBeDefined();
      expect(normal.x).toBeGreaterThanOrEqual(-1);
      expect(normal.x).toBeLessThanOrEqual(1);
      expect(normal.y).toBeGreaterThan(0); // Should point upward
      expect(normal.z).toBeGreaterThanOrEqual(-1);
      expect(normal.z).toBeLessThanOrEqual(1);
      
      // Normal should be normalized
      const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
      expect(length).toBeCloseTo(1, 2);
    });

    it('should handle positions outside loaded chunks gracefully', () => {
      const farPosition: Vector3 = { x: 10000, y: 0, z: 10000 };
      
      const height = terrainSystem.getHeightAtPosition(farPosition);
      expect(height).toBe(0); // Default height for unloaded areas
      
      const normal = terrainSystem.getNormalAtPosition(farPosition);
      expect(normal.y).toBe(1); // Default upward normal
    });

    it('should perform raycast against terrain', () => {
      const origin: Vector3 = { x: 35, y: 100, z: 40 };
      const direction: Vector3 = { x: 0, y: -1, z: 0 };
      
      const raycastResult = terrainSystem.raycast(origin, direction);
      
      expect(raycastResult.hit).toBe(true);
      expect(raycastResult.point?.y).toBeLessThan(origin.y);
      expect(raycastResult.normal).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(() => {
      world.start();
    });

    it('should track generation time', () => {
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.generationTime).toBeGreaterThanOrEqual(0);
    });

    it('should limit chunk loading per frame', () => {
      // Move player to trigger chunk loading
      terrainSystem.updatePlayerPosition({ x: 1000, y: 0, z: 1000 });
      
      const initialChunks = terrainSystem.getStats().loadedChunks;
      
      // Single update should not load all chunks at once
      world.update(0.016);
      
      const newChunks = terrainSystem.getStats().loadedChunks;
      const chunksLoaded = newChunks - initialChunks;
      
      expect(chunksLoaded).toBeLessThanOrEqual(4); // Reasonable limit per frame
    });

    it('should use GPU generation when available', () => {
      const config = terrainSystem.getConfig();
      expect(config.enableGPUGeneration).toBe(true);
      
      // GPU generation should be faster than CPU
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.usingGPU).toBe(true);
    });

    it('should maintain 60fps with active terrain', () => {
      // Simulate active terrain usage
      for (let i = 0; i < 10; i++) {
        terrainSystem.updatePlayerPosition({ 
          x: i * 64, 
          y: 0, 
          z: i * 64 
        });
        world.update(0.016);
      }
      
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.averageFrameTime).toBeLessThan(16.67); // 60fps target
    });

    it('should adapt quality based on performance', () => {
      // Simulate poor performance
      const monitor = terrainSystem.getPerformanceMonitor();
      
      for (let i = 0; i < 20; i++) {
        monitor.recordFrameTime(25); // Poor performance (40fps)
      }
      
      terrainSystem.update(0.016, []);
      
      const config = terrainSystem.getConfig();
      expect(config.adaptiveQuality).toBeLessThan(1.0);
    });

    it('should optimize memory usage', () => {
      // Load many chunks
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          terrainSystem.updatePlayerPosition({ x: x * 64, y: 0, z: z * 64 });
          world.update(0.016);
        }
      }
      
      const stats = terrainSystem.getStats();
      expect(stats.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB limit
    });
  });

  describe('Mobile Optimizations', () => {
    let mobileTerrainSystem: TerrainSystem;
    
    beforeEach(() => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      
      mobileTerrainSystem = new TerrainSystem({
        chunkSize: 32, // Smaller chunks for mobile
        viewDistance: 3, // Reduced view distance
        lodLevels: 2, // Fewer LOD levels
        enableGPUGeneration: false, // CPU generation for compatibility
        mobileOptimized: true
      });
      
      world.addSystem(mobileTerrainSystem);
      world.start();
    });

    it('should use mobile-optimized settings', () => {
      const config = mobileTerrainSystem.getConfig();
      
      expect(config.chunkSize).toBe(32);
      expect(config.viewDistance).toBe(3);
      expect(config.lodLevels).toBe(2);
      expect(config.mobileOptimized).toBe(true);
    });

    it('should reduce terrain detail on mobile', () => {
      mobileTerrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      const loadedChunks = mobileTerrainSystem.getLoadedChunks();
      const totalVertices = loadedChunks.reduce((sum, chunk) => 
        sum + (chunk.vertexCount || 0), 0
      );
      
      // Mobile should have fewer vertices for performance
      expect(totalVertices).toBeLessThan(50000);
    });

    it('should prioritize battery efficiency', () => {
      const monitor = mobileTerrainSystem.getPerformanceMonitor();
      expect(monitor.isBatteryOptimized()).toBe(true);
    });

    it('should reduce generation frequency on mobile', () => {
      const config = mobileTerrainSystem.getConfig();
      expect(config.generationFrequency).toBeLessThan(60); // Less than 60fps
    });
  });

  describe('Biome System', () => {
    beforeEach(() => {
      world.start();
    });

    it('should generate different biomes', () => {
      const forestPos = { x: 0, z: 0 };
      const desertPos = { x: 1000, z: 1000 };
      
      const forestBiome = terrainSystem.getBiomeAtPosition(forestPos);
      const desertBiome = terrainSystem.getBiomeAtPosition(desertPos);
      
      expect(forestBiome).toBeDefined();
      expect(desertBiome).toBeDefined();
      // Biomes should potentially be different for distant positions
    });

    it('should blend biome characteristics', () => {
      const pos1 = { x: 500, z: 500 };
      const pos2 = { x: 600, z: 500 };
      
      const height1 = terrainSystem.getHeightAtPosition({ x: pos1.x, y: 0, z: pos1.z });
      const height2 = terrainSystem.getHeightAtPosition({ x: pos2.x, y: 0, z: pos2.z });
      
      // Heights should transition smoothly between biomes
      expect(Math.abs(height2 - height1)).toBeLessThan(50);
    });

    it('should apply biome-specific generation parameters', () => {
      const biome = terrainSystem.getBiomeAtPosition({ x: 0, z: 0 });
      
      expect(biome).toHaveProperty('heightScale');
      expect(biome).toHaveProperty('roughness');
      expect(biome).toHaveProperty('vegetation');
    });
  });

  describe('Streaming and Memory Management', () => {
    beforeEach(() => {
      world.start();
    });

    it('should stream chunks asynchronously', async () => {
      const chunkPromise = terrainSystem.loadChunkAsync({ x: 5, z: 5 });
      
      expect(chunkPromise).toBeInstanceOf(Promise);
      
      const chunk = await chunkPromise;
      expect(chunk).toBeDefined();
      expect(chunk.x).toBe(5);
      expect(chunk.z).toBe(5);
    });

    it('should prioritize chunk loading by importance', () => {
      terrainSystem.updatePlayerPosition({ x: 64, y: 0, z: 64 });
      
      // Queue multiple chunks for loading
      const loadQueue = terrainSystem.getChunkLoadQueue();
      
      // Player chunk should have highest priority
      const playerChunkCoords = terrainSystem.worldToChunkCoords({ x: 64, y: 0, z: 64 });
      const playerChunkPriority = loadQueue.find(item => 
        item.x === playerChunkCoords.x && item.z === playerChunkCoords.z
      )?.priority;
      
      expect(playerChunkPriority).toBeGreaterThan(0);
    });

    it('should manage memory by unloading distant chunks', () => {
      // Load chunks at origin
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      const initialMemory = terrainSystem.getStats().memoryUsage;
      
      // Move far away to trigger unloading
      terrainSystem.updatePlayerPosition({ x: 2000, y: 0, z: 2000 });
      world.update(0.016);
      
      const finalMemory = terrainSystem.getStats().memoryUsage;
      
      // Memory usage should not increase indefinitely
      expect(finalMemory).toBeLessThanOrEqual(initialMemory * 2);
    });

    it('should cache frequently accessed chunks', () => {
      const position = { x: 32, y: 0, z: 32 };
      
      // Access same chunk multiple times
      for (let i = 0; i < 5; i++) {
        terrainSystem.updatePlayerPosition(position);
        world.update(0.016);
      }
      
      const cacheStats = terrainSystem.getCacheStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Updates', () => {
    it('should update configuration at runtime', () => {
      const newConfig = {
        viewDistance: 10,
        terrainHeight: 200,
        noiseScale: 0.05
      };
      
      terrainSystem.updateConfig(newConfig);
      
      const config = terrainSystem.getConfig();
      expect(config.viewDistance).toBe(10);
      expect(config.terrainHeight).toBe(200);
      expect(config.noiseScale).toBe(0.05);
    });

    it('should validate configuration values', () => {
      const invalidConfig = {
        viewDistance: -1,
        chunkSize: 0,
        lodLevels: 10
      };
      
      terrainSystem.updateConfig(invalidConfig);
      
      const config = terrainSystem.getConfig();
      expect(config.viewDistance).toBeGreaterThan(0);
      expect(config.chunkSize).toBeGreaterThan(0);
      expect(config.lodLevels).toBeLessThanOrEqual(5);
    });

    it('should trigger regeneration when needed', () => {
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      const initialChunks = terrainSystem.getLoadedChunks().length;
      
      // Change configuration that requires regeneration
      terrainSystem.updateConfig({ noiseScale: 0.2 });
      world.update(0.016);
      
      // Chunks should be regenerated
      const stats = terrainSystem.getStats();
      expect(stats.chunksRegenerated).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle terrain generation failures gracefully', async () => {
      // Mock generation failure
      const invalidChunkCoords = { x: NaN, z: NaN };
      
      const heightData = await terrainSystem.generateChunkHeightData(invalidChunkCoords);
      
      // Should return default/fallback data
      expect(heightData).toBeDefined();
      expect(heightData.length).toBeGreaterThan(0);
    });

    it('should handle invalid world positions', () => {
      const invalidPos: Vector3 = { x: Infinity, y: NaN, z: -Infinity };
      
      const height = terrainSystem.getHeightAtPosition(invalidPos);
      expect(height).toBe(0); // Default height
      
      const normal = terrainSystem.getNormalAtPosition(invalidPos);
      expect(normal.y).toBe(1); // Default normal
    });

    it('should handle memory pressure gracefully', () => {
      // Simulate low memory
      terrainSystem.setMemoryPressure(0.9); // 90% memory usage
      
      terrainSystem.updatePlayerPosition({ x: 1000, y: 0, z: 1000 });
      world.update(0.016);
      
      // Should reduce chunk loading under memory pressure
      const stats = terrainSystem.getStats();
      expect(stats.loadedChunks).toBeLessThan(100);
    });

    it('should handle rapid player movement', () => {
      const positions = [
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
        { x: 2000, y: 0, z: 1000 },
        { x: 500, y: 0, z: 2000 }
      ];
      
      expect(() => {
        positions.forEach(pos => {
          terrainSystem.updatePlayerPosition(pos);
          world.update(0.016);
        });
      }).not.toThrow();
    });

    it('should handle concurrent chunk operations', async () => {
      // Request multiple chunks simultaneously
      const chunkPromises = [];
      for (let i = 0; i < 10; i++) {
        chunkPromises.push(terrainSystem.loadChunkAsync({ x: i, z: i }));
      }
      
      const chunks = await Promise.all(chunkPromises);
      
      expect(chunks).toHaveLength(10);
      chunks.forEach((chunk, index) => {
        expect(chunk.x).toBe(index);
        expect(chunk.z).toBe(index);
      });
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up resources on destroy', () => {
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      terrainSystem.destroy();
      
      const stats = terrainSystem.getStats();
      expect(stats.loadedChunks).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });

    it('should cancel pending operations on destroy', () => {
      // Start chunk loading
      terrainSystem.loadChunkAsync({ x: 10, z: 10 });
      
      terrainSystem.destroy();
      
      // Pending operations should be cancelled
      const loadQueue = terrainSystem.getChunkLoadQueue();
      expect(loadQueue).toHaveLength(0);
    });

    it('should release GPU resources properly', () => {
      terrainSystem.destroy();
      
      // GPU resources should be cleaned up
      const metrics = terrainSystem.getPerformanceMetrics();
      expect(metrics.gpuMemoryUsage).toBe(0);
    });
  });
});