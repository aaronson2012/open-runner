/**
 * Example Usage of High-Performance Terrain System
 * Demonstrates initialization, configuration, and integration patterns
 */

import { TerrainSystem } from '../systems/TerrainSystem';
import { createTerrainComponent } from '../components/TerrainComponent';
import { MobileOptimizer } from '../utils/terrain/MobileOptimizations';
import { World } from '../core/ecs/World';
import { TERRAIN_LEVELS } from '../types/terrain';

export class TerrainSystemExample {
  private world: World;
  private terrainSystem: TerrainSystem;
  private mobileOptimizer: MobileOptimizer;
  private terrainEntity: number;

  constructor() {
    this.world = new World();
    this.mobileOptimizer = new MobileOptimizer();
  }

  async initialize(): Promise<void> {
    console.log('Initializing high-performance terrain system...');
    
    // Get mobile-optimized configuration
    const mobileConfig = this.mobileOptimizer.getTerrainConfig();
    const mobileDetection = this.mobileOptimizer.getMobileDetection();
    
    console.log('Device capabilities:', {
      mobile: mobileDetection.isMobile,
      lowEnd: mobileDetection.isLowEnd,
      gpuTier: mobileDetection.gpuTier,
      memory: `${mobileDetection.maxMemory}MB`,
      webgpu: mobileDetection.supportedFeatures.webgpu
    });

    // Create terrain system with optimized configuration
    this.terrainSystem = new TerrainSystem(mobileConfig);
    
    try {
      await this.terrainSystem.initialize();
      console.log('✅ Terrain system initialized successfully');
    } catch (error) {
      console.warn('⚠️ GPU initialization failed, falling back to CPU:', error);
      
      // Fallback configuration for CPU-only generation
      const fallbackConfig = {
        ...mobileConfig,
        enableGPUGeneration: false,
        maxConcurrentChunks: 2
      };
      
      this.terrainSystem = new TerrainSystem(fallbackConfig);
      await this.terrainSystem.initialize();
    }

    // Register system with ECS world
    this.world.addSystem(this.terrainSystem);

    // Create terrain entity with component
    this.terrainEntity = this.world.createEntity();
    const terrainComponent = createTerrainComponent(mobileConfig, {
      enablePerformanceMonitoring: true,
      maxMemoryUsage: mobileDetection.maxMemory * 1024 * 1024 * 0.5, // 50% of device memory
      targetFrameTime: mobileDetection.isMobile ? 33.33 : 16.67 // 30fps mobile, 60fps desktop
    });
    
    this.world.addComponent(this.terrainEntity, terrainComponent);

    // Set initial terrain level (forest for example)
    this.terrainSystem.setTerrainLevel('forest');

    // Setup event listeners for performance monitoring
    this.setupEventListeners();

    console.log('🌍 Terrain system ready for Open Runner!');
  }

  private setupEventListeners(): void {
    // Listen for chunk loading events
    this.terrainSystem.addEventListener('chunk_loaded', (data) => {
      console.log(`Chunk loaded: ${data.chunkId} at LOD ${data.lodLevel}`);
    });

    // Listen for performance warnings
    this.terrainSystem.addEventListener('performance_warning', (data) => {
      console.warn('Performance warning:', data.metrics);
      
      // Automatically adapt settings on performance issues
      this.adaptToPerformance(data.metrics!);
    });

    // Listen for LOD changes
    this.terrainSystem.addEventListener('lod_changed', (data) => {
      console.log(`LOD changed for chunk ${data.chunkId}: ${data.lodLevel}`);
    });
  }

  private adaptToPerformance(metrics: any): void {
    const avgFrameTime = metrics.frameTime || 16.67;
    const currentFPS = 1000 / avgFrameTime;
    
    // Use mobile optimizer to adapt settings
    const newSettings = this.mobileOptimizer.adaptSettings(currentFPS, avgFrameTime);
    
    // Apply new settings to terrain system (would need system method to update config)
    console.log('Adapted terrain settings:', newSettings);
  }

  // Example game loop integration
  update(deltaTime: number): void {
    // Update terrain system as part of game loop
    this.world.update(deltaTime);
    
    // Example: Update player position for terrain streaming
    // In a real game, this would come from your player/camera system
    this.updatePlayerPosition();
    
    // Check for adaptive quality adjustments
    this.checkAdaptiveQuality();
  }

  private updatePlayerPosition(): void {
    // Example player position update
    // In Open Runner, this would be the player's actual position
    const time = Date.now() * 0.001;
    const playerX = Math.sin(time) * 100;
    const playerZ = Math.cos(time) * 100;
    
    this.terrainSystem.setPlayerPosition(playerX, playerZ);
  }

  private checkAdaptiveQuality(): void {
    // Periodically check if we need to adapt quality
    const metrics = this.terrainSystem.getPerformanceMetrics();
    
    if (metrics.frameTime > 20) { // Below 50fps
      const currentFPS = 1000 / metrics.frameTime;
      this.mobileOptimizer.adaptSettings(currentFPS, metrics.frameTime);
    }
  }

  // Example terrain interaction methods
  
  getHeightAtPlayerPosition(): number {
    // Example: Get terrain height for collision detection
    const playerPos = { x: 0, z: 0 }; // Would get from player system
    return this.terrainSystem.getHeightAtPosition(playerPos.x, playerPos.z);
  }

  switchToDesertLevel(): void {
    console.log('Switching to desert terrain...');
    this.terrainSystem.setTerrainLevel('desert');
  }

  switchToForestLevel(): void {
    console.log('Switching to forest terrain...');
    this.terrainSystem.setTerrainLevel('forest');
  }

  // Debug and monitoring methods
  
  getDebugInfo(): any {
    return {
      terrainMetrics: this.terrainSystem.getPerformanceMetrics(),
      mobileOptimizations: this.mobileOptimizer.getDebugInfo(),
      nearbyChunks: this.terrainSystem.getNearbyChunks(0, 0, 256).length,
      currentLevel: 'forest' // Would track current level
    };
  }

  exportPerformanceReport(): string {
    const metrics = this.terrainSystem.getPerformanceMetrics();
    const mobileInfo = this.mobileOptimizer.getDebugInfo();
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      terrain: metrics,
      mobile: mobileInfo,
      recommendations: this.getOptimizationRecommendations()
    }, null, 2);
  }

  private getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.terrainSystem.getPerformanceMetrics();
    const mobileDetection = this.mobileOptimizer.getMobileDetection();
    
    if (metrics.frameTime > 16.67) {
      recommendations.push('Consider reducing render distance or enabling more aggressive LOD');
    }
    
    if (metrics.averageGenerationTime > 30) {
      if (mobileDetection.supportedFeatures.webgpu) {
        recommendations.push('Enable GPU generation for better performance');
      } else {
        recommendations.push('Reduce chunk size or complexity for faster generation');
      }
    }
    
    if (mobileDetection.isMobile && metrics.activeChunks > 20) {
      recommendations.push('Reduce active chunk count for mobile devices');
    }
    
    return recommendations;
  }

  // Cleanup
  destroy(): void {
    this.terrainSystem?.destroy();
    this.world?.destroy();
    console.log('Terrain system cleaned up');
  }
}

// Usage example for Open Runner integration
export async function createOpenRunnerTerrain(): Promise<TerrainSystemExample> {
  const example = new TerrainSystemExample();
  await example.initialize();
  return example;
}

// Performance testing utilities
export class TerrainPerformanceTest {
  private terrainSystem: TerrainSystem;
  private testResults: any[] = [];

  constructor(terrainSystem: TerrainSystem) {
    this.terrainSystem = terrainSystem;
  }

  async runBenchmark(duration: number = 30000): Promise<any> {
    console.log(`Running terrain performance benchmark for ${duration}ms...`);
    
    const startTime = Date.now();
    const initialMetrics = this.terrainSystem.getPerformanceMetrics();
    
    // Simulate player movement for chunk loading
    let testX = 0;
    let testZ = 0;
    
    const interval = setInterval(() => {
      testX += Math.random() * 20 - 10;
      testZ += Math.random() * 20 - 10;
      this.terrainSystem.setPlayerPosition(testX, testZ);
      
      const currentMetrics = this.terrainSystem.getPerformanceMetrics();
      this.testResults.push({
        timestamp: Date.now() - startTime,
        metrics: currentMetrics
      });
    }, 100);

    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(interval);
        
        const finalMetrics = this.terrainSystem.getPerformanceMetrics();
        const benchmark = this.analyzeBenchmarkResults(initialMetrics, finalMetrics);
        
        console.log('Benchmark completed:', benchmark);
        resolve(benchmark);
      }, duration);
    });
  }

  private analyzeBenchmarkResults(initial: any, final: any): any {
    const chunksGenerated = final.chunksGenerated - initial.chunksGenerated;
    const avgGenerationTime = final.averageGenerationTime;
    const avgFrameTime = final.frameTime;
    
    return {
      duration: this.testResults.length * 100, // ms
      chunksGenerated,
      averageGenerationTime: avgGenerationTime,
      averageFrameTime: avgFrameTime,
      fps: 1000 / avgFrameTime,
      memoryUsage: final.gpuMemoryUsage,
      performanceScore: this.calculatePerformanceScore(avgFrameTime, avgGenerationTime),
      samples: this.testResults.length
    };
  }

  private calculatePerformanceScore(frameTime: number, generationTime: number): number {
    const framePenalty = Math.max(0, (frameTime - 16.67) / 16.67);
    const generationPenalty = Math.max(0, (generationTime - 20) / 20);
    
    return Math.max(0, 100 - (framePenalty * 50) - (generationPenalty * 25));
  }
}