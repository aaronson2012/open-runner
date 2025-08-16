import type { SystemId, ComponentType } from '@/types';

interface SystemMetrics {
  totalTime: number;
  callCount: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastFrameTime: number;
}

interface FrameMetrics {
  frameNumber: number;
  totalTime: number;
  systemTimes: Map<SystemId, number>;
  entityCount: number;
  timestamp: number;
}

/**
 * Performance profiler for ECS systems and operations
 */
export class PerformanceProfiler {
  private enabled: boolean;
  private systemMetrics = new Map<SystemId, SystemMetrics>();
  private componentMetrics = new Map<ComponentType, { adds: number; removes: number }>();
  
  // Frame tracking
  private currentFrame: FrameMetrics | null = null;
  private frameHistory: FrameMetrics[] = [];
  private frameNumber = 0;
  private maxFrameHistory = 300; // Keep last 5 seconds at 60fps
  
  // Timing tracking
  private systemStartTimes = new Map<SystemId, number>();
  private frameStartTime = 0;
  
  // Entity tracking
  private entityCreations = 0;
  private entityDestructions = 0;
  
  // Query tracking
  private queryCacheHits = 0;
  private queryCacheMisses = 0;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * Enable or disable profiling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * Start frame timing
   */
  startFrame(): void {
    if (!this.enabled) return;
    
    this.frameStartTime = performance.now();
    this.frameNumber++;
    
    this.currentFrame = {
      frameNumber: this.frameNumber,
      totalTime: 0,
      systemTimes: new Map(),
      entityCount: 0,
      timestamp: this.frameStartTime
    };
  }

  /**
   * End frame timing and store metrics
   */
  endFrame(): void {
    if (!this.enabled || !this.currentFrame) return;
    
    const frameEndTime = performance.now();
    this.currentFrame.totalTime = frameEndTime - this.frameStartTime;
    
    // Store frame in history
    this.frameHistory.push(this.currentFrame);
    
    // Trim history if too long
    if (this.frameHistory.length > this.maxFrameHistory) {
      this.frameHistory.shift();
    }
    
    this.currentFrame = null;
  }

  /**
   * Start timing a system
   */
  startSystem(systemId: SystemId): void {
    if (!this.enabled) return;
    
    this.systemStartTimes.set(systemId, performance.now());
  }

  /**
   * End timing a system and update metrics
   */
  endSystem(systemId: SystemId): void {
    if (!this.enabled) return;
    
    const startTime = this.systemStartTimes.get(systemId);
    if (startTime === undefined) return;
    
    const endTime = performance.now();
    const elapsedTime = endTime - startTime;
    
    // Update system metrics
    let metrics = this.systemMetrics.get(systemId);
    if (!metrics) {
      metrics = {
        totalTime: 0,
        callCount: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        lastFrameTime: 0
      };
      this.systemMetrics.set(systemId, metrics);
    }
    
    metrics.totalTime += elapsedTime;
    metrics.callCount++;
    metrics.averageTime = metrics.totalTime / metrics.callCount;
    metrics.minTime = Math.min(metrics.minTime, elapsedTime);
    metrics.maxTime = Math.max(metrics.maxTime, elapsedTime);
    metrics.lastFrameTime = elapsedTime;
    
    // Update current frame metrics
    if (this.currentFrame) {
      this.currentFrame.systemTimes.set(systemId, elapsedTime);
    }
    
    this.systemStartTimes.delete(systemId);
  }

  /**
   * Record component addition
   */
  recordComponentAddition(componentType: ComponentType): void {
    if (!this.enabled) return;
    
    const metrics = this.componentMetrics.get(componentType) || { adds: 0, removes: 0 };
    metrics.adds++;
    this.componentMetrics.set(componentType, metrics);
  }

  /**
   * Record component removal
   */
  recordComponentRemoval(componentType: ComponentType): void {
    if (!this.enabled) return;
    
    const metrics = this.componentMetrics.get(componentType) || { adds: 0, removes: 0 };
    metrics.removes++;
    this.componentMetrics.set(componentType, metrics);
  }

  /**
   * Record entity creation
   */
  recordEntityCreation(): void {
    if (!this.enabled) return;
    this.entityCreations++;
  }

  /**
   * Record entity destruction
   */
  recordEntityDestruction(): void {
    if (!this.enabled) return;
    this.entityDestructions++;
  }

  /**
   * Record query cache hit
   */
  recordQueryCacheHit(): void {
    if (!this.enabled) return;
    this.queryCacheHits++;
  }

  /**
   * Record query cache miss
   */
  recordQueryCacheMiss(): void {
    if (!this.enabled) return;
    this.queryCacheMisses++;
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'Profiling is disabled'
      };
    }

    const recentFrames = this.frameHistory.slice(-60); // Last 60 frames
    const avgFrameTime = recentFrames.length > 0 
      ? recentFrames.reduce((sum, frame) => sum + frame.totalTime, 0) / recentFrames.length
      : 0;
    
    const fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
    
    const queryCacheTotal = this.queryCacheHits + this.queryCacheMisses;
    const queryCacheHitRate = queryCacheTotal > 0 ? this.queryCacheHits / queryCacheTotal : 0;
    
    return {
      enabled: true,
      frame: {
        current: this.frameNumber,
        averageTime: avgFrameTime,
        fps: Math.round(fps * 100) / 100,
        history: recentFrames.length
      },
      systems: this.getSystemMetrics(),
      components: this.getComponentMetrics(),
      entities: {
        created: this.entityCreations,
        destroyed: this.entityDestructions,
        net: this.entityCreations - this.entityDestructions
      },
      queryCache: {
        hits: this.queryCacheHits,
        misses: this.queryCacheMisses,
        hitRate: Math.round(queryCacheHitRate * 10000) / 100 // Percentage with 2 decimals
      },
      memory: this.getMemoryEstimate()
    };
  }

  /**
   * Get system-specific metrics
   */
  private getSystemMetrics() {
    const metrics: Record<string, any> = {};
    
    for (const [systemId, data] of this.systemMetrics) {
      metrics[systemId] = {
        averageTime: Math.round(data.averageTime * 1000) / 1000,
        minTime: Math.round(data.minTime * 1000) / 1000,
        maxTime: Math.round(data.maxTime * 1000) / 1000,
        lastFrameTime: Math.round(data.lastFrameTime * 1000) / 1000,
        totalTime: Math.round(data.totalTime * 1000) / 1000,
        callCount: data.callCount,
        callsPerSecond: this.calculateCallsPerSecond(systemId)
      };
    }
    
    return metrics;
  }

  /**
   * Get component-specific metrics
   */
  private getComponentMetrics() {
    const metrics: Record<string, any> = {};
    
    for (const [componentType, data] of this.componentMetrics) {
      metrics[componentType] = {
        additions: data.adds,
        removals: data.removes,
        net: data.adds - data.removes
      };
    }
    
    return metrics;
  }

  /**
   * Calculate calls per second for a system
   */
  private calculateCallsPerSecond(systemId: SystemId): number {
    const recentFrames = this.frameHistory.slice(-60); // Last 60 frames (1 second at 60fps)
    const callCount = recentFrames.filter(frame => frame.systemTimes.has(systemId)).length;
    const timeSpan = recentFrames.length > 0 
      ? (recentFrames[recentFrames.length - 1].timestamp - recentFrames[0].timestamp) / 1000
      : 0;
    
    return timeSpan > 0 ? callCount / timeSpan : 0;
  }

  /**
   * Estimate memory usage
   */
  private getMemoryEstimate(): number {
    // Rough estimation of profiler memory usage
    const frameHistorySize = this.frameHistory.length * 100; // Estimated bytes per frame
    const systemMetricsSize = this.systemMetrics.size * 50; // Estimated bytes per system metric
    const componentMetricsSize = this.componentMetrics.size * 20; // Estimated bytes per component metric
    
    return frameHistorySize + systemMetricsSize + componentMetricsSize;
  }

  /**
   * Get detailed frame analysis
   */
  getFrameAnalysis(frameCount: number = 60) {
    if (!this.enabled) return null;
    
    const frames = this.frameHistory.slice(-frameCount);
    if (frames.length === 0) return null;
    
    const totalTime = frames.reduce((sum, frame) => sum + frame.totalTime, 0);
    const avgFrameTime = totalTime / frames.length;
    const minFrameTime = Math.min(...frames.map(f => f.totalTime));
    const maxFrameTime = Math.max(...frames.map(f => f.totalTime));
    
    // System time analysis
    const systemAnalysis = new Map<SystemId, { total: number; average: number; percentage: number }>();
    
    for (const frame of frames) {
      for (const [systemId, time] of frame.systemTimes) {
        const existing = systemAnalysis.get(systemId) || { total: 0, average: 0, percentage: 0 };
        existing.total += time;
        systemAnalysis.set(systemId, existing);
      }
    }
    
    // Calculate averages and percentages
    for (const [systemId, data] of systemAnalysis) {
      data.average = data.total / frames.length;
      data.percentage = (data.total / totalTime) * 100;
    }
    
    return {
      frameCount: frames.length,
      timespan: frames.length > 1 ? frames[frames.length - 1].timestamp - frames[0].timestamp : 0,
      frameTime: {
        average: avgFrameTime,
        min: minFrameTime,
        max: maxFrameTime,
        variance: this.calculateVariance(frames.map(f => f.totalTime))
      },
      fps: {
        average: 1000 / avgFrameTime,
        min: 1000 / maxFrameTime,
        max: 1000 / minFrameTime
      },
      systems: Object.fromEntries(systemAnalysis)
    };
  }

  /**
   * Calculate variance for a set of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.systemMetrics.clear();
    this.componentMetrics.clear();
    this.frameHistory.length = 0;
    this.frameNumber = 0;
    this.entityCreations = 0;
    this.entityDestructions = 0;
    this.queryCacheHits = 0;
    this.queryCacheMisses = 0;
    this.systemStartTimes.clear();
    this.currentFrame = null;
  }

  /**
   * Export metrics data
   */
  exportData() {
    return {
      timestamp: Date.now(),
      enabled: this.enabled,
      frameHistory: this.frameHistory,
      systemMetrics: Object.fromEntries(this.systemMetrics),
      componentMetrics: Object.fromEntries(this.componentMetrics),
      entityMetrics: {
        created: this.entityCreations,
        destroyed: this.entityDestructions
      },
      queryCacheMetrics: {
        hits: this.queryCacheHits,
        misses: this.queryCacheMisses
      }
    };
  }
}