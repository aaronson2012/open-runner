import type { UpdateCallback } from '@/types';

export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private deltaTime = 0;
  private fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private targetFPS: number;
  private maxDeltaTime: number;
  private isRunning = false;
  private updateCallbacks: UpdateCallback[] = [];
  
  // Performance tracking
  private frameStartTime = 0;
  private frameTime = 0;
  private averageFrameTime = 16.67; // Target 60 FPS

  constructor(targetFPS = 60) {
    this.targetFPS = targetFPS;
    this.maxDeltaTime = 1000 / 30; // Cap at 30 FPS minimum to prevent large jumps
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = 0;
    
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    this.frameStartTime = performance.now();
    const currentTime = this.frameStartTime;
    
    // Calculate delta time in seconds
    this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, this.maxDeltaTime / 1000);
    this.lastTime = currentTime;

    // Update all registered callbacks
    for (const callback of this.updateCallbacks) {
      callback(this.deltaTime);
    }

    // Calculate frame time and FPS
    this.frameTime = performance.now() - this.frameStartTime;
    this.calculateFPS();

    // Schedule next frame
    this.rafId = requestAnimationFrame(this.loop);
  };

  private calculateFPS(): void {
    this.frameCount++;
    this.fpsTimer += this.deltaTime * 1000; // Convert to ms
    
    // Update FPS every second
    if (this.fpsTimer >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / this.fpsTimer);
      this.averageFrameTime = this.fpsTimer / this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
      
      // Update performance display if enabled
      this.updatePerformanceDisplay();
    }
  }

  private updatePerformanceDisplay(): void {
    const perfElement = document.getElementById('performance');
    if (!perfElement) return;

    const fpsElement = document.getElementById('fps');
    const frameTimeElement = document.getElementById('frame-time');
    
    if (fpsElement) {
      fpsElement.textContent = this.fps.toString();
      
      // Color code FPS
      fpsElement.className = '';
      if (this.fps >= 55) {
        fpsElement.classList.add('fps-good');
      } else if (this.fps >= 30) {
        fpsElement.classList.add('fps-warning');
      } else {
        fpsElement.classList.add('fps-critical');
      }
    }
    
    if (frameTimeElement) {
      frameTimeElement.textContent = this.averageFrameTime.toFixed(1);
    }
  }

  // Public API
  addUpdateCallback(callback: UpdateCallback): void {
    this.updateCallbacks.push(callback);
  }

  removeUpdateCallback(callback: UpdateCallback): void {
    const index = this.updateCallbacks.indexOf(callback);
    if (index !== -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  getDeltaTime(): number {
    return this.deltaTime;
  }

  getFPS(): number {
    return this.fps;
  }

  getFrameTime(): number {
    return this.frameTime;
  }

  getAverageFrameTime(): number {
    return this.averageFrameTime;
  }

  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.maxDeltaTime = 1000 / Math.max(fps / 2, 30);
  }

  getTargetFPS(): number {
    return this.targetFPS;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  // Performance metrics
  getPerformanceMetrics() {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      averageFrameTime: this.averageFrameTime,
      deltaTime: this.deltaTime,
      isRunning: this.isRunning,
      targetFPS: this.targetFPS
    };
  }
}