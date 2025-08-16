import * as THREE from 'three';
import { World } from '@/core/ecs/World';
import { GameLoop } from '@/core/game/GameLoop';
import { RenderSystem } from '@/systems/RenderSystem';
import { useGameStore } from '@/utils/gameStore';
import type { GameConfig, PerformanceMetrics } from '@/types';

export class Game {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world: World;
  private gameLoop: GameLoop;
  private renderSystem!: RenderSystem;
  private config: GameConfig;
  private isInitialized = false;
  private resizeObserver?: ResizeObserver;

  constructor(config: GameConfig) {
    this.config = config;
    this.world = new World();
    this.gameLoop = new GameLoop(config.targetFPS);
    
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.initScene();
      this.initCamera();
      await this.initRenderSystem();
      this.setupEventListeners();
      this.setupGameLoop();
      
      this.isInitialized = true;
      console.log('Game initialized successfully');
      
      // Hide loading screen
      this.hideLoadingScreen();
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      this.showError('Failed to initialize game. Please refresh and try again.');
    }
  }

  private async initRenderSystem(): Promise<void> {
    console.log('Initializing modern render system...');
    
    // Create render system with modern WebGPU/WebGL support
    this.renderSystem = new RenderSystem(this.scene, this.camera, this.config);
    
    // Add render system to ECS world
    this.world.addSystem(this.renderSystem);
    
    console.log('Modern render system initialized successfully');
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 50, 200);

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    
    // Configure shadow camera
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.setScalar(2048);
    
    this.scene.add(directionalLight);
  }

  private initCamera(): void {
    const aspect = this.config.width / this.config.height;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
  }

  private setupEventListeners(): void {
    // Handle window resize
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.handleResize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    
    const canvas = this.config.canvas;
    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }

    // Handle visibility changes for performance
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  private setupGameLoop(): void {
    this.gameLoop.addUpdateCallback((deltaTime: number) => {
      this.update(deltaTime);
      this.render();
    });
  }

  private update(deltaTime: number): void {
    // Update ECS world
    this.world.update(deltaTime);
    
    // Update game state
    const gameState = useGameStore.getState();
    if (gameState.isPaused) return;
    
    // Additional game-specific updates would go here
  }

  private render(): void {
    // Rendering is now handled by the RenderSystem
    // This method is kept for compatibility but does nothing
    // The RenderSystem handles all rendering in its update() method
  }

  private updatePerformanceMetrics(): void {
    if (!this.renderSystem) return;
    
    const renderMetrics = this.renderSystem.getMetrics();
    const metrics: PerformanceMetrics = {
      fps: this.gameLoop.getFPS(),
      frameTime: this.gameLoop.getFrameTime(),
      drawCalls: renderMetrics.drawCalls,
      triangles: renderMetrics.triangles,
      memoryUsage: renderMetrics.memoryUsage,
      gpuMemory: renderMetrics.gpuMemory,
      renderTime: renderMetrics.renderTime,
      culledObjects: renderMetrics.culledObjects,
      activeLODs: renderMetrics.activeLODs
    };
    
    // Store metrics in game state for UI display
    useGameStore.getState().updatePerformanceMetrics?.(metrics);
  }

  private handleResize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    // Notify render system of resize
    if (this.renderSystem) {
      this.renderSystem.resize(width, height);
    }
  }

  private hideLoadingScreen(): void {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.opacity = '0';
      setTimeout(() => {
        loadingElement.style.display = 'none';
      }, 500);
    }
  }

  private showError(message: string): void {
    const loadingText = document.getElementById('loading-progress');
    if (loadingText) {
      loadingText.textContent = `Error: ${message}`;
      loadingText.style.color = '#ef4444';
    }
  }

  // Public API
  start(): void {
    if (!this.isInitialized) {
      console.warn('Game not initialized yet');
      return;
    }
    
    this.world.start();
    this.gameLoop.start();
    useGameStore.getState().setScene('gameplay');
  }

  pause(): void {
    this.gameLoop.stop();
    useGameStore.getState().setPaused(true);
  }

  resume(): void {
    if (this.isInitialized) {
      this.gameLoop.start();
      useGameStore.getState().setPaused(false);
    }
  }

  stop(): void {
    this.gameLoop.stop();
    this.world.stop();
    useGameStore.getState().setScene('menu');
  }

  destroy(): void {
    this.stop();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.world.clear();
    
    // Cleanup render system
    if (this.renderSystem) {
      this.renderSystem.destroy();
    }
  }

  // Getters
  getRenderer(): any {
    return this.renderSystem?.getRenderer();
  }

  getRenderSystem(): RenderSystem {
    return this.renderSystem;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getWorld(): World {
    return this.world;
  }

  getGameLoop(): GameLoop {
    return this.gameLoop;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // Additional methods for render system control
  setQualityLevel(level: 'low' | 'medium' | 'high' | 'ultra'): void {
    if (this.renderSystem) {
      this.renderSystem.setQualityLevel(level);
    }
  }

  enableAdaptiveQuality(enabled: boolean): void {
    if (this.renderSystem) {
      this.renderSystem.enableAdaptiveQuality(enabled);
    }
  }

  getRenderCapabilities(): any {
    return this.renderSystem?.getCapabilities();
  }

  getRenderSettings(): any {
    return this.renderSystem?.getSettings();
  }
}