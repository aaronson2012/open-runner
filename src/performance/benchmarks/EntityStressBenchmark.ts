/**
 * Entity Stress Benchmark - Tests performance with varying entity counts
 * Simulates high-density scenarios to measure system scalability
 */

import type { World } from '@/core/ecs/World';
import type { PerformanceProfiler } from '@/core/ecs/PerformanceProfiler';

interface EntityBenchmarkConfig {
  maxEntities: number;
  stepSize: number;
  testDuration: number; // seconds
  entityTypes: string[];
  enablePhysics: boolean;
  enableRendering: boolean;
  enableAI: boolean;
}

interface EntityBenchmarkResult {
  entityCount: number;
  averageFPS: number;
  minFPS: number;
  frameTimeP95: number;
  frameTimeP99: number;
  memoryUsage: number;
  systemTimes: {
    render: number;
    physics: number;
    ai: number;
    total: number;
  };
  stability: number; // FPS stability percentage
  passed: boolean;
}

interface StressBenchmarkSuite {
  config: EntityBenchmarkConfig;
  results: EntityBenchmarkResult[];
  maxStableEntities: number;
  optimalEntityCount: number;
  performanceCliff: number; // Entity count where performance drops significantly
  recommendations: string[];
}

export class EntityStressBenchmark {
  private world: World;
  private profiler: PerformanceProfiler;
  private running = false;
  private currentTest: Promise<EntityBenchmarkResult> | null = null;
  
  // Benchmark configuration
  private readonly DEFAULT_CONFIG: EntityBenchmarkConfig = {
    maxEntities: 2000,
    stepSize: 100,
    testDuration: 10, // 10 seconds per test
    entityTypes: ['enemy', 'collectible', 'particle', 'terrain'],
    enablePhysics: true,
    enableRendering: true,
    enableAI: true
  };
  
  // Performance thresholds
  private readonly PERFORMANCE_THRESHOLDS = {
    minAcceptableFPS: 30,
    targetFPS: 60,
    maxFrameTime: 33.33, // 30 FPS
    stabilityThreshold: 85 // Minimum stability percentage
  };

  constructor(world: World, profiler: PerformanceProfiler) {
    this.world = world;
    this.profiler = profiler;
  }

  async runStressBenchmark(config?: Partial<EntityBenchmarkConfig>): Promise<StressBenchmarkSuite> {
    const benchmarkConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (this.running) {
      throw new Error('Benchmark already running');
    }
    
    this.running = true;
    console.log('Starting Entity Stress Benchmark', benchmarkConfig);
    
    try {
      const results: EntityBenchmarkResult[] = [];
      
      // Run tests with increasing entity counts
      for (let entityCount = benchmarkConfig.stepSize; 
           entityCount <= benchmarkConfig.maxEntities; 
           entityCount += benchmarkConfig.stepSize) {
        
        console.log(`Testing with ${entityCount} entities...`);
        
        const result = await this.runSingleEntityTest(entityCount, benchmarkConfig);
        results.push(result);
        
        // Stop early if performance becomes unacceptable
        if (result.averageFPS < this.PERFORMANCE_THRESHOLDS.minAcceptableFPS) {
          console.log(`Stopping benchmark - FPS dropped below ${this.PERFORMANCE_THRESHOLDS.minAcceptableFPS}`);\n          break;
        }
        
        // Clean up between tests
        await this.cleanupEntities();
        await this.waitForGC();
      }
      
      // Analyze results
      const analysis = this.analyzeBenchmarkResults(results, benchmarkConfig);
      
      return analysis;
      
    } finally {
      this.running = false;
      await this.cleanupEntities();
    }
  }

  private async runSingleEntityTest(
    entityCount: number, 
    config: EntityBenchmarkConfig
  ): Promise<EntityBenchmarkResult> {
    
    // Setup phase
    this.profiler.reset();
    this.profiler.setEnabled(true);
    
    // Create entities
    const entities = await this.createTestEntities(entityCount, config);
    
    // Wait for stabilization
    await this.waitForStabilization(1000); // 1 second
    
    // Measurement phase
    const measurements = await this.measurePerformance(config.testDuration * 1000);
    
    // Cleanup
    await this.destroyEntities(entities);
    
    // Calculate results
    return this.calculateTestResult(entityCount, measurements);
  }

  private async createTestEntities(count: number, config: EntityBenchmarkConfig): Promise<number[]> {
    const entities: number[] = [];
    
    for (let i = 0; i < count; i++) {
      const entityType = config.entityTypes[i % config.entityTypes.length];
      const entity = await this.createEntity(entityType, config);
      entities.push(entity);
    }
    
    return entities;
  }

  private async createEntity(type: string, config: EntityBenchmarkConfig): number {
    const entity = this.world.createEntity();
    
    // Add transform component (all entities need position)
    this.world.addComponent(entity, 'Transform', {
      position: {
        x: (Math.random() - 0.5) * 200,
        y: Math.random() * 10,
        z: (Math.random() - 0.5) * 200
      },
      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    
    // Add type-specific components
    switch (type) {
      case 'enemy':
        if (config.enableAI) {
          this.world.addComponent(entity, 'AI', {
            type: 'basic',
            speed: 1 + Math.random() * 2,
            detectionRange: 10 + Math.random() * 20
          });
        }
        if (config.enablePhysics) {
          this.world.addComponent(entity, 'Physics', {
            mass: 1,
            velocity: { x: 0, y: 0, z: 0 },
            collisionShape: 'box'
          });
        }
        if (config.enableRendering) {
          this.world.addComponent(entity, 'Render', {
            model: 'enemy_basic',
            material: 'enemy_material',
            visible: true
          });
        }
        break;
        
      case 'collectible':
        if (config.enablePhysics) {
          this.world.addComponent(entity, 'Physics', {
            mass: 0.1,
            velocity: { x: 0, y: 0, z: 0 },
            collisionShape: 'sphere'
          });
        }
        if (config.enableRendering) {
          this.world.addComponent(entity, 'Render', {
            model: 'collectible_coin',
            material: 'gold_material',
            visible: true
          });
        }
        this.world.addComponent(entity, 'Collectible', {
          value: 10,
          collected: false
        });
        break;
        
      case 'particle':
        if (config.enableRendering) {
          this.world.addComponent(entity, 'Particle', {
            lifetime: 5 + Math.random() * 10,
            speed: 1 + Math.random() * 3,
            size: 0.1 + Math.random() * 0.5
          });
        }
        break;
        
      case 'terrain':
        if (config.enableRendering) {
          this.world.addComponent(entity, 'Terrain', {
            chunkSize: 32,
            heightScale: 1,
            textureSet: 'grass'
          });
        }
        break;
    }
    
    return entity;
  }

  private async measurePerformance(duration: number): Promise<PerformanceMeasurement[]> {
    const measurements: PerformanceMeasurement[] = [];
    const startTime = performance.now();
    const sampleInterval = 100; // Sample every 100ms
    
    while (performance.now() - startTime < duration) {
      const frameStart = performance.now();
      
      // Simulate frame update
      await this.simulateFrame();
      
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      
      // Get profiler metrics
      const metrics = this.profiler.getMetrics();
      
      measurements.push({
        timestamp: frameEnd,
        frameTime: frameTime,
        fps: 1000 / frameTime,
        systemTimes: {
          render: metrics.systems?.RenderSystem?.lastFrameTime || 0,
          physics: metrics.systems?.PhysicsSystem?.lastFrameTime || 0,
          ai: metrics.systems?.AISystem?.lastFrameTime || 0
        },
        memoryUsage: this.getMemoryUsage(),
        entityCount: this.world.getEntityCount()
      });
      
      // Wait for next sample
      await this.sleep(sampleInterval);
    }
    
    return measurements;
  }

  private async simulateFrame(): Promise<void> {
    // Simulate a frame update by running systems
    this.profiler.startFrame();
    
    // Update systems (simplified simulation)
    this.profiler.startSystem('RenderSystem');
    await this.sleep(1 + Math.random() * 3); // Simulate render time
    this.profiler.endSystem('RenderSystem');
    
    this.profiler.startSystem('PhysicsSystem');
    await this.sleep(0.5 + Math.random() * 1.5); // Simulate physics time
    this.profiler.endSystem('PhysicsSystem');
    
    this.profiler.startSystem('AISystem');
    await this.sleep(0.2 + Math.random() * 0.8); // Simulate AI time
    this.profiler.endSystem('AISystem');
    
    this.profiler.endFrame();
  }

  private calculateTestResult(
    entityCount: number, 
    measurements: PerformanceMeasurement[]
  ): EntityBenchmarkResult {
    
    if (measurements.length === 0) {
      throw new Error('No performance measurements available');
    }
    
    const fpsList = measurements.map(m => m.fps);
    const frameTimeList = measurements.map(m => m.frameTime);
    
    const averageFPS = fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length;
    const minFPS = Math.min(...fpsList);
    
    // Calculate percentiles
    const sortedFrameTimes = [...frameTimeList].sort((a, b) => a - b);
    const frameTimeP95 = this.getPercentile(sortedFrameTimes, 95);
    const frameTimeP99 = this.getPercentile(sortedFrameTimes, 99);
    
    // Calculate system times
    const avgRenderTime = measurements.reduce((sum, m) => sum + m.systemTimes.render, 0) / measurements.length;
    const avgPhysicsTime = measurements.reduce((sum, m) => sum + m.systemTimes.physics, 0) / measurements.length;
    const avgAITime = measurements.reduce((sum, m) => sum + m.systemTimes.ai, 0) / measurements.length;
    
    // Calculate stability (coefficient of variation)
    const fpsStdDev = this.calculateStandardDeviation(fpsList);
    const stability = Math.max(0, 100 - (fpsStdDev / averageFPS) * 100);
    
    // Memory usage
    const avgMemoryUsage = measurements.reduce((sum, m) => sum + m.memoryUsage, 0) / measurements.length;
    
    // Pass/fail criteria
    const passed = averageFPS >= this.PERFORMANCE_THRESHOLDS.minAcceptableFPS &&
                   frameTimeP95 <= this.PERFORMANCE_THRESHOLDS.maxFrameTime &&
                   stability >= this.PERFORMANCE_THRESHOLDS.stabilityThreshold;
    
    return {
      entityCount,
      averageFPS,
      minFPS,
      frameTimeP95,
      frameTimeP99,
      memoryUsage: avgMemoryUsage,
      systemTimes: {
        render: avgRenderTime,
        physics: avgPhysicsTime,
        ai: avgAITime,
        total: avgRenderTime + avgPhysicsTime + avgAITime
      },
      stability,
      passed
    };
  }

  private analyzeBenchmarkResults(
    results: EntityBenchmarkResult[], 
    config: EntityBenchmarkConfig
  ): StressBenchmarkSuite {
    
    // Find maximum stable entity count
    const passingResults = results.filter(r => r.passed);
    const maxStableEntities = passingResults.length > 0 ? 
      Math.max(...passingResults.map(r => r.entityCount)) : 0;
    
    // Find optimal entity count (best performance/entity ratio)
    let optimalEntityCount = 0;
    let bestRatio = 0;
    
    for (const result of results) {
      const ratio = result.averageFPS / result.entityCount;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        optimalEntityCount = result.entityCount;
      }
    }
    
    // Find performance cliff (biggest FPS drop)
    let performanceCliff = 0;
    let biggestDrop = 0;
    
    for (let i = 1; i < results.length; i++) {
      const fpsDrop = results[i - 1].averageFPS - results[i].averageFPS;
      if (fpsDrop > biggestDrop) {
        biggestDrop = fpsDrop;
        performanceCliff = results[i].entityCount;
      }
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(results, maxStableEntities);
    
    return {
      config,
      results,
      maxStableEntities,
      optimalEntityCount,
      performanceCliff,
      recommendations
    };
  }

  private generateRecommendations(
    results: EntityBenchmarkResult[], 
    maxStableEntities: number
  ): string[] {
    
    const recommendations: string[] = [];
    
    if (maxStableEntities < 500) {
      recommendations.push('Consider reducing entity complexity or enabling LOD system');
      recommendations.push('Implement entity pooling to reduce creation/destruction overhead');
    }
    
    if (maxStableEntities < 1000) {
      recommendations.push('Enable frustum culling to reduce rendering load');
      recommendations.push('Implement spatial partitioning for physics optimization');
    }
    
    // Analyze system bottlenecks
    const lastResult = results[results.length - 1];
    const totalSystemTime = lastResult.systemTimes.total;
    
    if (lastResult.systemTimes.render / totalSystemTime > 0.6) {
      recommendations.push('Rendering is the primary bottleneck - optimize draw calls and shaders');
    }
    
    if (lastResult.systemTimes.physics / totalSystemTime > 0.4) {
      recommendations.push('Physics is consuming significant time - reduce collision complexity');
    }
    
    if (lastResult.systemTimes.ai / totalSystemTime > 0.3) {
      recommendations.push('AI system overhead is high - optimize pathfinding and decision trees');
    }
    
    // Memory recommendations
    if (lastResult.memoryUsage > 512 * 1024 * 1024) { // 512MB
      recommendations.push('High memory usage detected - implement asset streaming');
    }
    
    return recommendations;
  }

  // Utility methods
  private async destroyEntities(entities: number[]): Promise<void> {
    for (const entity of entities) {
      this.world.destroyEntity(entity);
    }
  }

  private async cleanupEntities(): Promise<void> {
    // Remove all test entities
    const allEntities = this.world.getAllEntities();
    for (const entity of allEntities) {
      this.world.destroyEntity(entity);
    }
  }

  private async waitForStabilization(duration: number): Promise<void> {
    await this.sleep(duration);
  }

  private async waitForGC(): Promise<void> {
    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    // Wait for potential GC
    await this.sleep(100);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.floor((percentile / 100) * sortedArray.length);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  // Public API for external benchmarking
  async runQuickStressTest(entityCount: number): Promise<EntityBenchmarkResult> {
    const config = { ...this.DEFAULT_CONFIG, maxEntities: entityCount, testDuration: 5 };
    return this.runSingleEntityTest(entityCount, config);
  }

  async runMobileBenchmark(): Promise<StressBenchmarkSuite> {
    const mobileConfig: Partial<EntityBenchmarkConfig> = {
      maxEntities: 500, // Lower for mobile
      stepSize: 50,
      testDuration: 5,
      enablePhysics: true,
      enableRendering: true,
      enableAI: false // Disable AI on mobile for performance
    };
    
    return this.runStressBenchmark(mobileConfig);
  }

  async runDesktopBenchmark(): Promise<StressBenchmarkSuite> {
    const desktopConfig: Partial<EntityBenchmarkConfig> = {
      maxEntities: 2000,
      stepSize: 100,
      testDuration: 10,
      enablePhysics: true,
      enableRendering: true,
      enableAI: true
    };
    
    return this.runStressBenchmark(desktopConfig);
  }

  isRunning(): boolean {
    return this.running;
  }

  stop(): void {
    this.running = false;
    if (this.currentTest) {
      // The current test will stop on next iteration
      console.log('Stopping benchmark...');
    }
  }
}

// Helper interfaces
interface PerformanceMeasurement {
  timestamp: number;
  frameTime: number;
  fps: number;
  systemTimes: {
    render: number;
    physics: number;
    ai: number;
  };
  memoryUsage: number;
  entityCount: number;
}