/**
 * Performance Dashboard - Real-time performance monitoring and visualization
 * Provides comprehensive performance metrics, alerts, and optimization recommendations
 */

import { PerformanceProfiler } from '@/core/ecs/PerformanceProfiler';
import { PerformanceAdapter } from '@/rendering/PerformanceAdapter';
import { PerformanceMonitor } from '@/utils/terrain/PerformanceMonitor';

interface PerformanceMetrics {
  fps: {
    current: number;
    average: number;
    min: number;
    max: number;
    target: number;
    stability: number; // 0-100, how stable FPS is
  };
  frameTime: {
    current: number;
    average: number;
    p95: number;
    p99: number;
    budget: number;
    variance: number;
  };
  memory: {
    used: number;
    available: number;
    peak: number;
    growth: number; // MB/s
    pressure: number; // 0-1
    gcPause: number;
  };
  gpu: {
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
    drawCalls: number;
    triangles: number;
    shaderSwitches: number;
  };
  entities: {
    total: number;
    active: number;
    culled: number;
    lod: Map<number, number>; // LOD level -> count
  };
  systems: {
    render: number;
    physics: number;
    ai: number;
    input: number;
    audio: number;
  };
  mobile: {
    batteryLevel?: number;
    charging?: boolean;
    thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
    networkType?: string;
    devicePixelRatio: number;
  };
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  category: 'performance' | 'memory' | 'thermal' | 'battery';
  message: string;
  timestamp: number;
  resolved: boolean;
  action?: string;
}

interface OptimizationRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedGain: number; // Expected FPS improvement
}

export class PerformanceDashboard {
  private enabled = false;
  private profiler: PerformanceProfiler;
  private adapter: PerformanceAdapter;
  private terrainMonitor: PerformanceMonitor;
  
  // Metrics tracking
  private currentMetrics: PerformanceMetrics;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 3600; // 1 hour at 1 sample/second
  
  // Alerts and recommendations
  private activeAlerts = new Map<string, PerformanceAlert>();
  private recommendations: OptimizationRecommendation[] = [];
  
  // Monitoring configuration
  private updateInterval = 1000; // 1 second
  private lastUpdate = 0;
  private frameCount = 0;
  private frameTimes: number[] = [];
  
  // Device capabilities
  private deviceInfo: {
    isMobile: boolean;
    isHighEnd: boolean;
    cpuCores: number;
    memoryGB: number;
    gpu: string;
    maxTextureSize: number;
  };
  
  // Performance targets
  private readonly TARGETS = {
    desktop: { fps: 60, frameTime: 16.67 },
    mobile: { fps: 30, frameTime: 33.33 },
    mobileHigh: { fps: 60, frameTime: 16.67 }
  };

  constructor(
    profiler: PerformanceProfiler,
    adapter: PerformanceAdapter,
    terrainMonitor: PerformanceMonitor
  ) {
    this.profiler = profiler;
    this.adapter = adapter;
    this.terrainMonitor = terrainMonitor;
    
    this.deviceInfo = this.detectDeviceCapabilities();
    this.currentMetrics = this.initializeMetrics();
    
    console.log('Performance Dashboard initialized', {
      device: this.deviceInfo,
      targets: this.getPerformanceTargets()
    });
  }

  private detectDeviceCapabilities() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent) || 'ontouchstart' in window;
    const cpuCores = navigator.hardwareConcurrency || 4;
    
    // Estimate device tier based on available information
    const isHighEnd = cpuCores >= 6 && !isMobile;
    const memoryGB = (navigator as any).deviceMemory || (isMobile ? 4 : 8);
    
    // Get GPU info if available
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const gpu = gl ? (gl.getParameter(gl.RENDERER) || 'Unknown') : 'No WebGL';
    const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048;
    
    return {
      isMobile,
      isHighEnd,
      cpuCores,
      memoryGB,
      gpu: gpu.toString(),
      maxTextureSize
    };
  }

  private getPerformanceTargets() {
    if (this.deviceInfo.isMobile) {
      return this.deviceInfo.isHighEnd ? this.TARGETS.mobileHigh : this.TARGETS.mobile;
    }
    return this.TARGETS.desktop;
  }

  private initializeMetrics(): PerformanceMetrics {
    const targets = this.getPerformanceTargets();
    
    return {
      fps: {
        current: 0,
        average: 0,
        min: Infinity,
        max: 0,
        target: targets.fps,
        stability: 100
      },
      frameTime: {
        current: 0,
        average: 0,
        p95: 0,
        p99: 0,
        budget: targets.frameTime,
        variance: 0
      },
      memory: {
        used: 0,
        available: 0,
        peak: 0,
        growth: 0,
        pressure: 0,
        gcPause: 0
      },
      gpu: {
        utilization: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        drawCalls: 0,
        triangles: 0,
        shaderSwitches: 0
      },
      entities: {
        total: 0,
        active: 0,
        culled: 0,
        lod: new Map()
      },
      systems: {
        render: 0,
        physics: 0,
        ai: 0,
        input: 0,
        audio: 0
      },
      mobile: {
        devicePixelRatio: window.devicePixelRatio || 1
      }
    };
  }

  enable(): void {
    this.enabled = true;
    this.profiler.setEnabled(true);
    this.terrainMonitor.startMonitoring();
    
    // Start mobile-specific monitoring
    if (this.deviceInfo.isMobile) {
      this.enableMobileMonitoring();
    }
    
    console.log('Performance Dashboard enabled');
  }

  disable(): void {
    this.enabled = false;
    this.profiler.setEnabled(false);
    this.terrainMonitor.stopMonitoring();
    console.log('Performance Dashboard disabled');
  }

  update(deltaTime: number): void {
    if (!this.enabled) return;
    
    const now = performance.now();
    
    // Update frame timing
    this.updateFrameMetrics(deltaTime);
    
    // Update detailed metrics every second
    if (now - this.lastUpdate >= this.updateInterval) {
      this.updateDetailedMetrics();
      this.checkAlerts();
      this.updateRecommendations();
      this.storeMetricsHistory();
      this.lastUpdate = now;
    }
    
    // Update adapters
    this.adapter.update(deltaTime);
    this.terrainMonitor.update(deltaTime);
  }

  private updateFrameMetrics(deltaTime: number): void {
    this.frameCount++;
    const frameTime = deltaTime;
    this.frameTimes.push(frameTime);
    
    // Keep only recent frame times (last 60 frames)
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
    
    const fps = 1000 / frameTime;
    
    // Update FPS metrics
    this.currentMetrics.fps.current = fps;
    this.currentMetrics.fps.min = Math.min(this.currentMetrics.fps.min, fps);
    this.currentMetrics.fps.max = Math.max(this.currentMetrics.fps.max, fps);
    
    // Calculate average from recent frames
    if (this.frameTimes.length > 0) {
      const avgFrameTime = this.frameTimes.reduce((sum, ft) => sum + ft, 0) / this.frameTimes.length;
      this.currentMetrics.fps.average = 1000 / avgFrameTime;
      this.currentMetrics.frameTime.average = avgFrameTime;
      this.currentMetrics.frameTime.current = frameTime;
      
      // Calculate percentiles
      const sortedFrameTimes = [...this.frameTimes].sort((a, b) => a - b);
      this.currentMetrics.frameTime.p95 = this.getPercentile(sortedFrameTimes, 95);
      this.currentMetrics.frameTime.p99 = this.getPercentile(sortedFrameTimes, 99);
      
      // Calculate variance for stability
      const variance = this.calculateVariance(this.frameTimes);
      this.currentMetrics.frameTime.variance = variance;
      this.currentMetrics.fps.stability = Math.max(0, 100 - (variance / avgFrameTime) * 100);
    }
  }

  private updateDetailedMetrics(): void {
    this.updateMemoryMetrics();
    this.updateSystemMetrics();
    this.updateEntityMetrics();
    
    if (this.deviceInfo.isMobile) {
      this.updateMobileMetrics();
    }
  }

  private updateMemoryMetrics(): void {
    try {
      // Use Memory API if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.totalJSHeapSize;
        const limit = memory.jsHeapSizeLimit;
        
        this.currentMetrics.memory.used = used;
        this.currentMetrics.memory.available = limit - used;
        this.currentMetrics.memory.peak = Math.max(this.currentMetrics.memory.peak, used);
        this.currentMetrics.memory.pressure = used / limit;
      }
      
      // Monitor WebGL memory usage
      const gl = this.getWebGLContext();
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          // Extract memory info from renderer string if available
          this.parseGPUMemoryInfo(renderer);
        }
      }
      
    } catch (error) {
      console.warn('Failed to update memory metrics:', error);
    }
  }

  private updateSystemMetrics(): void {
    const profilerMetrics = this.profiler.getMetrics();
    
    if (profilerMetrics.enabled && profilerMetrics.systems) {
      this.currentMetrics.systems.render = profilerMetrics.systems.RenderSystem?.lastFrameTime || 0;
      this.currentMetrics.systems.physics = profilerMetrics.systems.PhysicsSystem?.lastFrameTime || 0;
      this.currentMetrics.systems.ai = profilerMetrics.systems.AISystem?.lastFrameTime || 0;
      this.currentMetrics.systems.input = profilerMetrics.systems.InputSystem?.lastFrameTime || 0;
      this.currentMetrics.systems.audio = profilerMetrics.systems.AudioSystem?.lastFrameTime || 0;
    }
  }

  private updateEntityMetrics(): void {
    // Get entity counts from ECS systems
    const profilerMetrics = this.profiler.getMetrics();
    
    if (profilerMetrics.enabled && profilerMetrics.entities) {
      this.currentMetrics.entities.total = profilerMetrics.entities.net;
    }
    
    // Get terrain-specific metrics
    const terrainMetrics = this.terrainMonitor.getMetrics();
    this.currentMetrics.entities.active = terrainMetrics.activeChunks;
    this.currentMetrics.entities.culled = terrainMetrics.culledChunks;
  }

  private updateMobileMetrics(): void {
    // Battery API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.currentMetrics.mobile.batteryLevel = battery.level * 100;
        this.currentMetrics.mobile.charging = battery.charging;
      }).catch(() => {});
    }
    
    // Network information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.currentMetrics.mobile.networkType = connection.effectiveType;
    }
    
    // Thermal state estimation (iOS)
    if ('webkitTemperature' in navigator) {
      const temp = (navigator as any).webkitTemperature;
      if (temp > 40) this.currentMetrics.mobile.thermalState = 'critical';
      else if (temp > 35) this.currentMetrics.mobile.thermalState = 'serious';
      else if (temp > 30) this.currentMetrics.mobile.thermalState = 'fair';
      else this.currentMetrics.mobile.thermalState = 'nominal';
    }
  }

  private enableMobileMonitoring(): void {
    // Monitor visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('App backgrounded - reducing performance monitoring');
      } else {
        console.log('App foregrounded - resuming performance monitoring');
      }
    });
    
    // Monitor orientation changes
    window.addEventListener('orientationchange', () => {
      console.log('Orientation changed - recalibrating performance targets');
      setTimeout(() => {
        this.currentMetrics.mobile.devicePixelRatio = window.devicePixelRatio || 1;
      }, 100);
    });
  }

  private checkAlerts(): void {
    this.checkPerformanceAlerts();
    this.checkMemoryAlerts();
    
    if (this.deviceInfo.isMobile) {
      this.checkMobileAlerts();
    }
  }

  private checkPerformanceAlerts(): void {
    const fps = this.currentMetrics.fps.average;
    const target = this.currentMetrics.fps.target;
    const frameTime = this.currentMetrics.frameTime.average;
    const budget = this.currentMetrics.frameTime.budget;
    
    // Low FPS alert
    const lowFpsThreshold = target * 0.8;
    if (fps < lowFpsThreshold) {
      this.addAlert({
        id: 'low-fps',
        type: 'warning',
        category: 'performance',
        message: `Low FPS detected: ${fps.toFixed(1)} (target: ${target})`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Consider reducing graphics quality'
      });
    } else {
      this.resolveAlert('low-fps');
    }
    
    // High frame time alert
    if (frameTime > budget * 1.2) {
      this.addAlert({
        id: 'high-frametime',
        type: 'warning',
        category: 'performance',
        message: `High frame time: ${frameTime.toFixed(2)}ms (budget: ${budget.toFixed(2)}ms)`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Optimize rendering or physics systems'
      });
    } else {
      this.resolveAlert('high-frametime');
    }
    
    // FPS instability alert
    if (this.currentMetrics.fps.stability < 70) {
      this.addAlert({
        id: 'fps-unstable',
        type: 'warning',
        category: 'performance',
        message: `Unstable FPS detected: ${this.currentMetrics.fps.stability.toFixed(1)}% stability`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Check for GC pauses or frame spikes'
      });
    } else {
      this.resolveAlert('fps-unstable');
    }
  }

  private checkMemoryAlerts(): void {
    const pressure = this.currentMetrics.memory.pressure;
    const growth = this.currentMetrics.memory.growth;
    
    // Memory pressure alert
    if (pressure > 0.8) {
      this.addAlert({
        id: 'memory-pressure',
        type: 'critical',
        category: 'memory',
        message: `High memory pressure: ${(pressure * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Release unused resources'
      });
    } else if (pressure > 0.6) {
      this.addAlert({
        id: 'memory-pressure',
        type: 'warning',
        category: 'memory',
        message: `Moderate memory pressure: ${(pressure * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Monitor memory usage closely'
      });
    } else {
      this.resolveAlert('memory-pressure');
    }
    
    // Memory leak detection
    if (growth > 1) { // 1 MB/s growth
      this.addAlert({
        id: 'memory-leak',
        type: 'critical',
        category: 'memory',
        message: `Potential memory leak: ${growth.toFixed(2)} MB/s growth`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Check for unreleased resources'
      });
    } else {
      this.resolveAlert('memory-leak');
    }
  }

  private checkMobileAlerts(): void {
    const battery = this.currentMetrics.mobile.batteryLevel;
    const thermal = this.currentMetrics.mobile.thermalState;
    
    // Battery alert
    if (battery && battery < 20 && !this.currentMetrics.mobile.charging) {
      this.addAlert({
        id: 'low-battery',
        type: 'warning',
        category: 'battery',
        message: `Low battery: ${battery.toFixed(0)}%`,
        timestamp: Date.now(),
        resolved: false,
        action: 'Enable battery optimization mode'
      });
    } else {
      this.resolveAlert('low-battery');
    }
    
    // Thermal alert
    if (thermal === 'critical') {
      this.addAlert({
        id: 'thermal-critical',
        type: 'critical',
        category: 'thermal',
        message: 'Critical thermal state detected',
        timestamp: Date.now(),
        resolved: false,
        action: 'Reduce performance immediately'
      });
    } else if (thermal === 'serious') {
      this.addAlert({
        id: 'thermal-warning',
        type: 'warning',
        category: 'thermal',
        message: 'High thermal state detected',
        timestamp: Date.now(),
        resolved: false,
        action: 'Consider reducing graphics quality'
      });
    } else {
      this.resolveAlert('thermal-critical');
      this.resolveAlert('thermal-warning');
    }
  }

  private updateRecommendations(): void {
    this.recommendations = [];
    
    const fps = this.currentMetrics.fps.average;
    const target = this.currentMetrics.fps.target;
    const pressure = this.currentMetrics.memory.pressure;
    
    // Performance recommendations
    if (fps < target * 0.9) {
      this.recommendations.push({
        id: 'reduce-quality',
        priority: 'high',
        category: 'Performance',
        title: 'Reduce Graphics Quality',
        description: 'Current FPS is below target. Reducing graphics quality can improve performance.',
        impact: `Expected FPS gain: ${(target * 0.1).toFixed(0)}`,
        implementation: 'Enable adaptive quality in renderer settings',
        estimatedGain: target * 0.15
      });
    }
    
    if (pressure > 0.7) {
      this.recommendations.push({
        id: 'reduce-memory',
        priority: 'high',
        category: 'Memory',
        title: 'Reduce Memory Usage',
        description: 'High memory pressure detected. Consider reducing texture quality or entity count.',
        impact: 'Reduced memory pressure and GC pauses',
        implementation: 'Lower texture resolution, reduce view distance',
        estimatedGain: 5
      });
    }
    
    // Mobile-specific recommendations
    if (this.deviceInfo.isMobile) {
      if (this.currentMetrics.mobile.thermalState === 'serious') {
        this.recommendations.push({
          id: 'thermal-optimization',
          priority: 'critical',
          category: 'Thermal',
          title: 'Enable Thermal Optimization',
          description: 'Device is getting hot. Reducing performance to prevent throttling.',
          impact: 'Prevent thermal throttling',
          implementation: 'Reduce frame rate target, lower quality settings',
          estimatedGain: 0
        });
      }
    }
    
    // System-specific recommendations
    const renderTime = this.currentMetrics.systems.render;
    const physicsTime = this.currentMetrics.systems.physics;
    
    if (renderTime > 10) { // 10ms render time
      this.recommendations.push({
        id: 'optimize-rendering',
        priority: 'medium',
        category: 'Rendering',
        title: 'Optimize Rendering Pipeline',
        description: 'Render system is taking significant time. Consider optimization.',
        impact: 'Reduced render times',
        implementation: 'Enable frustum culling, reduce draw calls',
        estimatedGain: 8
      });
    }
    
    if (physicsTime > 5) { // 5ms physics time
      this.recommendations.push({
        id: 'optimize-physics',
        priority: 'medium',
        category: 'Physics',
        title: 'Optimize Physics System',
        description: 'Physics system is consuming significant CPU time.',
        impact: 'Improved overall performance',
        implementation: 'Reduce physics update frequency, simplify collision shapes',
        estimatedGain: 5
      });
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    this.activeAlerts.set(alert.id, alert);
  }

  private resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      setTimeout(() => this.activeAlerts.delete(alertId), 5000); // Remove after 5 seconds
    }
  }

  private storeMetricsHistory(): void {
    const snapshot = JSON.parse(JSON.stringify(this.currentMetrics));
    (snapshot as any).timestamp = Date.now();
    
    this.metricsHistory.push(snapshot);
    
    // Trim history if too long
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  // Utility methods
  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.floor((percentile / 100) * sortedArray.length);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getWebGLContext(): WebGLRenderingContext | null {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  }

  private parseGPUMemoryInfo(renderer: string): void {
    // Attempt to extract memory info from GPU renderer string
    // This is very vendor-specific and may not always work
    const memoryMatch = renderer.match(/(\d+)MB/i);
    if (memoryMatch) {
      this.currentMetrics.gpu.memoryTotal = parseInt(memoryMatch[1]) * 1024 * 1024;
    }
  }

  // Public API
  getCurrentMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.currentMetrics));
  }

  getMetricsHistory(duration?: number): PerformanceMetrics[] {
    if (!duration) return [...this.metricsHistory];
    
    const cutoff = Date.now() - duration;
    return this.metricsHistory.filter(m => (m as any).timestamp >= cutoff);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  getRecommendations(): OptimizationRecommendation[] {
    return [...this.recommendations];
  }

  getPerformanceScore(): number {
    const fps = this.currentMetrics.fps.average;
    const target = this.currentMetrics.fps.target;
    const stability = this.currentMetrics.fps.stability;
    const pressure = this.currentMetrics.memory.pressure;
    
    // Calculate score from 0-100
    let score = 100;
    
    // FPS penalty (0-40 points)
    const fpsRatio = Math.min(1, fps / target);
    score -= (1 - fpsRatio) * 40;
    
    // Stability penalty (0-20 points)
    score -= (100 - stability) * 0.2;
    
    // Memory pressure penalty (0-30 points)
    score -= pressure * 30;
    
    // Alert penalty (0-10 points)
    const criticalAlerts = this.getActiveAlerts().filter(a => a.type === 'critical').length;
    const warningAlerts = this.getActiveAlerts().filter(a => a.type === 'warning').length;
    score -= criticalAlerts * 5 + warningAlerts * 2;
    
    return Math.max(0, Math.min(100, score));
  }

  exportData(): {
    metrics: PerformanceMetrics;
    history: PerformanceMetrics[];
    alerts: PerformanceAlert[];
    recommendations: OptimizationRecommendation[];
    deviceInfo: any;
    score: number;
  } {
    return {
      metrics: this.getCurrentMetrics(),
      history: this.getMetricsHistory(),
      alerts: this.getActiveAlerts(),
      recommendations: this.getRecommendations(),
      deviceInfo: this.deviceInfo,
      score: this.getPerformanceScore()
    };
  }

  // Visualization methods for HTML dashboard
  generateHTMLReport(): string {
    const metrics = this.getCurrentMetrics();
    const score = this.getPerformanceScore();
    const alerts = this.getActiveAlerts();
    const recommendations = this.getRecommendations();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Open Runner - Performance Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
          .metric-card { background: #2a2a2a; padding: 15px; margin: 10px; border-radius: 8px; }
          .score { font-size: 24px; font-weight: bold; color: ${score > 80 ? '#4CAF50' : score > 60 ? '#FF9800' : '#F44336'}; }
          .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
          .alert.warning { background: #FF9800; color: #000; }
          .alert.critical { background: #F44336; }
          .recommendation { background: #0277BD; padding: 10px; margin: 5px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Performance Dashboard</h1>
        <div class="metric-card">
          <h2>Performance Score: <span class="score">${score.toFixed(1)}/100</span></h2>
        </div>
        
        <div class="metric-card">
          <h3>FPS Metrics</h3>
          <p>Current: ${metrics.fps.current.toFixed(1)} | Average: ${metrics.fps.average.toFixed(1)} | Target: ${metrics.fps.target}</p>
          <p>Stability: ${metrics.fps.stability.toFixed(1)}%</p>
        </div>
        
        <div class="metric-card">
          <h3>Frame Time</h3>
          <p>Current: ${metrics.frameTime.current.toFixed(2)}ms | Average: ${metrics.frameTime.average.toFixed(2)}ms</p>
          <p>P95: ${metrics.frameTime.p95.toFixed(2)}ms | P99: ${metrics.frameTime.p99.toFixed(2)}ms</p>
        </div>
        
        <div class="metric-card">
          <h3>Memory</h3>
          <p>Used: ${(metrics.memory.used / 1024 / 1024).toFixed(2)}MB</p>
          <p>Pressure: ${(metrics.memory.pressure * 100).toFixed(1)}%</p>
        </div>
        
        ${alerts.length > 0 ? `
        <div class="metric-card">
          <h3>Active Alerts</h3>
          ${alerts.map(alert => `
            <div class="alert ${alert.type}">
              <strong>${alert.message}</strong>
              ${alert.action ? `<br>Action: ${alert.action}` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${recommendations.length > 0 ? `
        <div class="metric-card">
          <h3>Optimization Recommendations</h3>
          ${recommendations.map(rec => `
            <div class="recommendation">
              <strong>${rec.title}</strong> (${rec.priority} priority)<br>
              ${rec.description}<br>
              <em>Expected gain: ${rec.estimatedGain.toFixed(0)} FPS</em>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        <div class="metric-card">
          <h3>Device Information</h3>
          <p>Type: ${this.deviceInfo.isMobile ? 'Mobile' : 'Desktop'} (${this.deviceInfo.isHighEnd ? 'High-end' : 'Standard'})</p>
          <p>CPU Cores: ${this.deviceInfo.cpuCores}</p>
          <p>Memory: ${this.deviceInfo.memoryGB}GB</p>
          <p>GPU: ${this.deviceInfo.gpu}</p>
        </div>
      </body>
      </html>
    `;
  }

  destroy(): void {
    this.disable();
    this.metricsHistory = [];
    this.activeAlerts.clear();
    this.recommendations = [];
    console.log('Performance Dashboard destroyed');
  }
}