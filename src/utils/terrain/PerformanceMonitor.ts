/**
 * Performance Monitor for Terrain System
 * Tracks generation times, memory usage, and provides optimization insights
 */

import { TerrainPerformanceMetrics } from '../../types/terrain';

interface PerformanceSample {
  timestamp: number;
  frameTime: number;
  generationTime?: number;
  memoryUsage?: number;
  activeChunks?: number;
}

export class PerformanceMonitor {
  private metrics: TerrainPerformanceMetrics = {
    chunksGenerated: 0,
    averageGenerationTime: 0,
    gpuMemoryUsage: 0,
    activeChunks: 0,
    frameTime: 0,
    lodTransitions: 0,
    culledChunks: 0
  };

  private samples: PerformanceSample[] = [];
  private generationTimes: number[] = [];
  private frameTimes: number[] = [];
  private lastFrameTime = performance.now();
  private isMonitoring = false;
  private maxSamples = 1000; // Keep last 1000 samples
  private warningThresholds = {
    frameTime: 20, // 50fps
    generationTime: 50, // 50ms per chunk
    memoryUsage: 512 * 1024 * 1024, // 512MB
    lodTransitionRate: 10 // Max 10 transitions per second
  };

  startMonitoring(): void {
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    console.log('Performance monitoring started');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
    this.printSummary();
  }

  update(deltaTime: number): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Update frame time metrics
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > 100) {
      this.frameTimes.shift();
    }

    this.metrics.frameTime = this.calculateAverage(this.frameTimes);

    // Create performance sample
    const sample: PerformanceSample = {
      timestamp: currentTime,
      frameTime: frameTime
    };

    this.addSample(sample);

    // Check for performance warnings
    this.checkPerformanceWarnings();
  }

  recordChunkGeneration(generationTime: number): void {
    this.metrics.chunksGenerated++;
    this.generationTimes.push(generationTime);

    // Keep only recent generation times
    if (this.generationTimes.length > 100) {
      this.generationTimes.shift();
    }

    this.metrics.averageGenerationTime = this.calculateAverage(this.generationTimes);
  }

  recordLODTransition(): void {
    this.metrics.lodTransitions++;
  }

  recordChunkCulled(): void {
    this.metrics.culledChunks++;
  }

  updateMemoryUsage(usage: number): void {
    this.metrics.gpuMemoryUsage = usage;
  }

  updateActiveChunks(count: number): void {
    this.metrics.activeChunks = count;
  }

  private addSample(sample: PerformanceSample): void {
    this.samples.push(sample);

    // Maintain sample limit
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  private checkPerformanceWarnings(): void {
    const warnings: string[] = [];

    // Check frame time
    if (this.metrics.frameTime > this.warningThresholds.frameTime) {
      warnings.push(`High frame time: ${this.metrics.frameTime.toFixed(2)}ms`);
    }

    // Check generation time
    if (this.metrics.averageGenerationTime > this.warningThresholds.generationTime) {
      warnings.push(`Slow chunk generation: ${this.metrics.averageGenerationTime.toFixed(2)}ms`);
    }

    // Check memory usage
    if (this.metrics.gpuMemoryUsage > this.warningThresholds.memoryUsage) {
      warnings.push(`High memory usage: ${(this.metrics.gpuMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }

    // Check LOD transition rate
    const recentSamples = this.samples.slice(-60); // Last 60 frames (~1 second at 60fps)
    const transitionRate = recentSamples.length > 0 ? 
      this.metrics.lodTransitions / (recentSamples.length / 60) : 0;
    
    if (transitionRate > this.warningThresholds.lodTransitionRate) {
      warnings.push(`High LOD transition rate: ${transitionRate.toFixed(2)}/sec`);
    }

    if (warnings.length > 0) {
      console.warn('Terrain performance warnings:', warnings);
    }
  }

  getMetrics(): TerrainPerformanceMetrics {
    return { ...this.metrics };
  }

  getDetailedMetrics(): {
    basic: TerrainPerformanceMetrics;
    advanced: {
      frameTimeP95: number;
      frameTimeP99: number;
      generationTimeP95: number;
      generationTimeP99: number;
      memoryTrend: 'increasing' | 'decreasing' | 'stable';
      performanceScore: number;
      bottleneck: string | null;
    };
  } {
    const frameTimeP95 = this.calculatePercentile(this.frameTimes, 95);
    const frameTimeP99 = this.calculatePercentile(this.frameTimes, 99);
    const generationTimeP95 = this.calculatePercentile(this.generationTimes, 95);
    const generationTimeP99 = this.calculatePercentile(this.generationTimes, 99);

    const memoryTrend = this.calculateMemoryTrend();
    const performanceScore = this.calculatePerformanceScore();
    const bottleneck = this.identifyBottleneck();

    return {
      basic: this.getMetrics(),
      advanced: {
        frameTimeP95,
        frameTimeP99,
        generationTimeP95,
        generationTimeP99,
        memoryTrend,
        performanceScore,
        bottleneck
      }
    };
  }

  private calculateMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.samples.length < 10) return 'stable';

    const recentSamples = this.samples.slice(-10);
    const oldSamples = this.samples.slice(-20, -10);

    const recentAvg = recentSamples.reduce((sum, s) => sum + (s.memoryUsage || 0), 0) / recentSamples.length;
    const oldAvg = oldSamples.length > 0 ? 
      oldSamples.reduce((sum, s) => sum + (s.memoryUsage || 0), 0) / oldSamples.length : recentAvg;

    const changePercent = ((recentAvg - oldAvg) / Math.max(oldAvg, 1)) * 100;

    if (changePercent > 5) return 'increasing';
    if (changePercent < -5) return 'decreasing';
    return 'stable';
  }

  private calculatePerformanceScore(): number {
    // Score from 0-100 based on various metrics
    let score = 100;

    // Frame time penalty (0-30 points)
    const frameTimePenalty = Math.min(30, (this.metrics.frameTime / this.warningThresholds.frameTime) * 30);
    score -= frameTimePenalty;

    // Generation time penalty (0-25 points)
    const generationTimePenalty = Math.min(25, (this.metrics.averageGenerationTime / this.warningThresholds.generationTime) * 25);
    score -= generationTimePenalty;

    // Memory usage penalty (0-25 points)
    const memoryPenalty = Math.min(25, (this.metrics.gpuMemoryUsage / this.warningThresholds.memoryUsage) * 25);
    score -= memoryPenalty;

    // LOD transition penalty (0-20 points)
    const lodPenalty = Math.min(20, (this.metrics.lodTransitions / 1000) * 20);
    score -= lodPenalty;

    return Math.max(0, Math.min(100, score));
  }

  private identifyBottleneck(): string | null {
    const issues: Array<{ name: string; severity: number }> = [];

    // Check frame time
    if (this.metrics.frameTime > this.warningThresholds.frameTime) {
      const severity = this.metrics.frameTime / this.warningThresholds.frameTime;
      issues.push({ name: 'Frame Rate', severity });
    }

    // Check generation time
    if (this.metrics.averageGenerationTime > this.warningThresholds.generationTime) {
      const severity = this.metrics.averageGenerationTime / this.warningThresholds.generationTime;
      issues.push({ name: 'Chunk Generation', severity });
    }

    // Check memory
    if (this.metrics.gpuMemoryUsage > this.warningThresholds.memoryUsage) {
      const severity = this.metrics.gpuMemoryUsage / this.warningThresholds.memoryUsage;
      issues.push({ name: 'Memory Usage', severity });
    }

    if (issues.length === 0) return null;

    // Return the most severe issue
    issues.sort((a, b) => b.severity - a.severity);
    return issues[0].name;
  }

  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const metrics = this.getDetailedMetrics();

    // Frame rate suggestions
    if (metrics.basic.frameTime > 16.67) {
      suggestions.push('Consider reducing render distance or chunk size');
      suggestions.push('Enable LOD system if not already active');
      suggestions.push('Implement frustum culling for chunks');
    }

    // Generation time suggestions
    if (metrics.basic.averageGenerationTime > 30) {
      suggestions.push('Optimize noise algorithm or move to GPU');
      suggestions.push('Reduce chunk resolution for distant chunks');
      suggestions.push('Implement progressive mesh generation');
    }

    // Memory suggestions
    if (metrics.basic.gpuMemoryUsage > 256 * 1024 * 1024) {
      suggestions.push('Implement chunk memory pooling');
      suggestions.push('Compress vertex data where possible');
      suggestions.push('Unload distant chunks more aggressively');
    }

    // LOD suggestions
    if (metrics.basic.lodTransitions > 100) {
      suggestions.push('Increase LOD transition distances');
      suggestions.push('Add hysteresis to LOD calculations');
      suggestions.push('Smooth LOD transitions over multiple frames');
    }

    return suggestions;
  }

  exportMetrics(): string {
    const detailed = this.getDetailedMetrics();
    const suggestions = this.getOptimizationSuggestions();

    return JSON.stringify({
      timestamp: Date.now(),
      metrics: detailed,
      suggestions: suggestions,
      samples: this.samples.slice(-100) // Last 100 samples
    }, null, 2);
  }

  private printSummary(): void {
    const detailed = this.getDetailedMetrics();
    
    console.log('=== Terrain Performance Summary ===');
    console.log(`Performance Score: ${detailed.advanced.performanceScore.toFixed(1)}/100`);
    console.log(`Chunks Generated: ${detailed.basic.chunksGenerated}`);
    console.log(`Average Generation Time: ${detailed.basic.averageGenerationTime.toFixed(2)}ms`);
    console.log(`Average Frame Time: ${detailed.basic.frameTime.toFixed(2)}ms`);
    console.log(`Memory Usage: ${(detailed.basic.gpuMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Active Chunks: ${detailed.basic.activeChunks}`);
    console.log(`LOD Transitions: ${detailed.basic.lodTransitions}`);
    
    if (detailed.advanced.bottleneck) {
      console.log(`Primary Bottleneck: ${detailed.advanced.bottleneck}`);
    }
    
    const suggestions = this.getOptimizationSuggestions();
    if (suggestions.length > 0) {
      console.log('Optimization Suggestions:');
      suggestions.forEach((suggestion, i) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }
  }

  // Mobile-specific monitoring
  
  detectMobilePerformance(): {
    isMobile: boolean;
    recommendedSettings: {
      chunkSize: number;
      renderDistance: number;
      lodLevels: number;
      enableGPU: boolean;
    };
  } {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent) || 
                    'ontouchstart' in window ||
                    navigator.maxTouchPoints > 0;

    // Detect performance level based on frame times
    const avgFrameTime = this.metrics.frameTime;
    const isLowPerformance = avgFrameTime > 20 || this.metrics.averageGenerationTime > 40;

    let recommendedSettings = {
      chunkSize: 64,
      renderDistance: 512,
      lodLevels: 4,
      enableGPU: true
    };

    if (isMobile || isLowPerformance) {
      recommendedSettings = {
        chunkSize: 32,
        renderDistance: 256,
        lodLevels: 3,
        enableGPU: false // Fallback to CPU on mobile for compatibility
      };
    }

    return {
      isMobile,
      recommendedSettings
    };
  }

  // Real-time adaptation
  
  getAdaptiveRecommendations(): {
    shouldReduceQuality: boolean;
    shouldIncreaseQuality: boolean;
    targetChunkSize: number;
    targetRenderDistance: number;
  } {
    const performanceScore = this.calculatePerformanceScore();
    const avgFrameTime = this.metrics.frameTime;
    
    const shouldReduceQuality = performanceScore < 60 || avgFrameTime > 20;
    const shouldIncreaseQuality = performanceScore > 85 && avgFrameTime < 14;
    
    let targetChunkSize = 64;
    let targetRenderDistance = 512;
    
    if (shouldReduceQuality) {
      targetChunkSize = Math.max(32, targetChunkSize * 0.75);
      targetRenderDistance = Math.max(256, targetRenderDistance * 0.75);
    } else if (shouldIncreaseQuality) {
      targetChunkSize = Math.min(128, targetChunkSize * 1.25);
      targetRenderDistance = Math.min(1024, targetRenderDistance * 1.25);
    }
    
    return {
      shouldReduceQuality,
      shouldIncreaseQuality,
      targetChunkSize: Math.floor(targetChunkSize),
      targetRenderDistance: Math.floor(targetRenderDistance)
    };
  }
}