import { ECSManager } from '@/core/ecs/ECSManager';
import type { Vector3 } from '@/types';

/**
 * Example demonstrating the complete ECS system usage
 */
export class ECSExample {
  private ecs: ECSManager;
  private playerId: number;
  private terrainChunks: number[] = [];
  private obstacles: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    // Initialize ECS with optimized settings
    this.ecs = new ECSManager(canvas, {
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: true,
      maxEntities: 10000,
      maxComponentsPerType: 5000
    });

    this.setupScene();
  }

  /**
   * Set up the game scene
   */
  private setupScene(): void {
    // Create player
    this.playerId = this.ecs.createPlayer(
      'player-geometry',
      'player-material',
      { x: 0, y: 5, z: 0 }
    );

    // Create terrain chunks
    this.createTerrain();

    // Create obstacles
    this.createObstacles();

    // Set up camera
    this.ecs.setCameraPosition({ x: 0, y: 10, z: 15 });
    this.ecs.setCameraTarget({ x: 0, y: 0, z: 0 });
    this.ecs.setCameraFOV(60);

    // Set gravity
    this.ecs.setGravity({ x: 0, y: -9.81, z: 0 });

    console.log('ECS Example scene created');
  }

  /**
   * Create terrain chunks for the world
   */
  private createTerrain(): void {
    const chunkSize = 64;
    const worldSize = 5; // 5x5 chunks

    for (let x = -worldSize; x <= worldSize; x++) {
      for (let z = -worldSize; z <= worldSize; z++) {
        const chunkId = this.ecs.createTerrain(x, z, chunkSize);
        this.terrainChunks.push(chunkId);

        // Position the terrain chunk
        this.ecs.setPosition(chunkId, {
          x: x * chunkSize,
          y: 0,
          z: z * chunkSize
        });
      }
    }

    console.log(`Created ${this.terrainChunks.length} terrain chunks`);
  }

  /**
   * Create obstacles in the world
   */
  private createObstacles(): void {
    const obstacleCount = 50;

    for (let i = 0; i < obstacleCount; i++) {
      // Random position
      const position: Vector3 = {
        x: (Math.random() - 0.5) * 200,
        y: Math.random() * 10 + 2,
        z: (Math.random() - 0.5) * 200
      };

      // Random obstacle type
      const obstacleType = Math.random();
      let geometry: string;
      let colliderShape: 'box' | 'sphere' | 'capsule';
      let size: Vector3;

      if (obstacleType < 0.3) {
        // Box obstacle
        geometry = 'box-geometry';
        colliderShape = 'box';
        size = {
          x: Math.random() * 2 + 1,
          y: Math.random() * 3 + 1,
          z: Math.random() * 2 + 1
        };
      } else if (obstacleType < 0.6) {
        // Sphere obstacle
        geometry = 'sphere-geometry';
        colliderShape = 'sphere';
        const radius = Math.random() * 1.5 + 0.5;
        size = { x: radius * 2, y: radius * 2, z: radius * 2 };
      } else {
        // Capsule obstacle
        geometry = 'capsule-geometry';
        colliderShape = 'capsule';
        size = {
          x: Math.random() * 1 + 0.5,
          y: Math.random() * 3 + 2,
          z: Math.random() * 1 + 0.5
        };
      }

      const obstacleId = this.ecs.createPhysicsObject(
        geometry,
        'obstacle-material',
        colliderShape,
        size,
        Math.random() * 100 + 10, // Random mass
        position
      );

      this.obstacles.push(obstacleId);

      // Add some random rotation
      this.ecs.setRotation(obstacleId, {
        x: Math.random() * Math.PI,
        y: Math.random() * Math.PI,
        z: Math.random() * Math.PI
      });

      // Randomly make some obstacles static
      if (Math.random() < 0.3) {
        const rigidBody = this.ecs.getRigidBody(obstacleId);
        if (rigidBody) {
          rigidBody.isStatic = true;
        }
      }
    }

    console.log(`Created ${this.obstacles.length} obstacles`);
  }

  /**
   * Start the example
   */
  start(): void {
    this.ecs.start();
    console.log('ECS Example started');

    // Set up update loop for game logic
    this.gameLoop();
  }

  /**
   * Stop the example
   */
  stop(): void {
    this.ecs.stop();
    console.log('ECS Example stopped');
  }

  /**
   * Game loop for custom logic
   */
  private gameLoop(): void {
    // Update camera to follow player
    this.updateCamera();

    // Handle input
    this.handleInput();

    // Check for game events
    this.checkGameEvents();

    // Schedule next update
    if (this.ecs.getDebugInfo().isRunning) {
      requestAnimationFrame(() => this.gameLoop());
    }
  }

  /**
   * Update camera to follow player
   */
  private updateCamera(): void {
    const playerPos = this.ecs.getPosition(this.playerId);
    if (playerPos) {
      // Follow camera
      const cameraOffset: Vector3 = { x: 0, y: 10, z: 15 };
      this.ecs.setCameraPosition({
        x: playerPos.x + cameraOffset.x,
        y: playerPos.y + cameraOffset.y,
        z: playerPos.z + cameraOffset.z
      });

      this.ecs.setCameraTarget(playerPos);
    }
  }

  /**
   * Handle custom input logic
   */
  private handleInput(): void {
    // Toggle debug mode with F1
    if (this.ecs.isActionPressed('debug')) {
      const debugEnabled = !this.ecs.getDebugInfo().systems.transform.debugEnabled;
      this.ecs.setDebugMode(debugEnabled);
      console.log(`Debug mode ${debugEnabled ? 'enabled' : 'disabled'}`);
    }

    // Reset player position with R key
    if (this.ecs.isKeyDown('KeyR')) {
      this.ecs.setPosition(this.playerId, { x: 0, y: 5, z: 0 });
      
      // Reset velocity
      const rigidBody = this.ecs.getRigidBody(this.playerId);
      if (rigidBody) {
        rigidBody.velocity.x = 0;
        rigidBody.velocity.y = 0;
        rigidBody.velocity.z = 0;
      }
    }

    // Apply force with F key
    if (this.ecs.isKeyDown('KeyF')) {
      this.ecs.applyForce(this.playerId, { x: 0, y: 500, z: 0 });
    }

    // Toggle obstacle visibility with V key
    if (this.ecs.isActionPressed('toggleVisibility')) {
      for (const obstacleId of this.obstacles) {
        const mesh = this.ecs.getMesh(obstacleId);
        if (mesh) {
          mesh.visible = !mesh.visible;
        }
      }
    }
  }

  /**
   * Check for game events and conditions
   */
  private checkGameEvents(): void {
    const playerPos = this.ecs.getPosition(this.playerId);
    if (!playerPos) return;

    // Check if player fell off the world
    if (playerPos.y < -50) {
      console.log('Player fell off the world! Respawning...');
      this.ecs.setPosition(this.playerId, { x: 0, y: 5, z: 0 });
    }

    // Dynamic terrain loading based on player position
    this.updateTerrainLoading(playerPos);

    // Performance monitoring
    this.monitorPerformance();
  }

  /**
   * Dynamic terrain loading example
   */
  private updateTerrainLoading(playerPos: Vector3): void {
    // This is a simplified example of dynamic terrain loading
    // In a real game, you'd implement proper chunk streaming

    const chunkSize = 64;
    const loadDistance = 3; // Load chunks within 3 chunk radius

    const playerChunkX = Math.floor(playerPos.x / chunkSize);
    const playerChunkZ = Math.floor(playerPos.z / chunkSize);

    // Check if we need to load new chunks
    // (This would normally involve actual chunk generation/loading)
    
    // For this example, just log when player moves to a new chunk
    const currentChunk = `${playerChunkX},${playerChunkZ}`;
    if (!this.hasLoggedChunk(currentChunk)) {
      console.log(`Player entered chunk: ${currentChunk}`);
      this.logChunk(currentChunk);
    }
  }

  private loggedChunks = new Set<string>();
  
  private hasLoggedChunk(chunk: string): boolean {
    return this.loggedChunks.has(chunk);
  }
  
  private logChunk(chunk: string): void {
    this.loggedChunks.add(chunk);
  }

  /**
   * Monitor and log performance metrics
   */
  private monitorPerformance(): void {
    // Log performance every 5 seconds
    if (Date.now() % 5000 < 16) { // Roughly every 5 seconds
      const metrics = this.ecs.getPerformanceMetrics();
      
      console.log('Performance Metrics:', {
        entities: metrics.world.entities,
        activeEntities: metrics.world.activeEntities,
        systems: metrics.world.systems,
        fps: Math.round(1000 / (metrics.systems.render.averageUpdateTime || 16.67)),
        queryCache: metrics.memory.queryCache,
        archetypes: Array.from(metrics.memory.archetypes.entries())
      });
    }
  }

  /**
   * Add custom input bindings
   */
  addCustomInputBindings(): void {
    // Note: This would require extending the InputSystem to support dynamic binding addition
    // For now, this is a placeholder showing the intended API
    
    // this.ecs.addInputBinding('debug', ['F1']);
    // this.ecs.addInputBinding('toggleVisibility', ['KeyV']);
    // this.ecs.addInputBinding('resetPlayer', ['KeyR']);
  }

  /**
   * Get current game state
   */
  getGameState() {
    return {
      playerId: this.playerId,
      playerPosition: this.ecs.getPosition(this.playerId),
      terrainChunks: this.terrainChunks.length,
      obstacles: this.obstacles.length,
      performance: this.ecs.getPerformanceMetrics(),
      debug: this.ecs.getDebugInfo()
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.ecs.clear();
    this.terrainChunks = [];
    this.obstacles = [];
    this.loggedChunks.clear();
  }
}

// Example usage:
/*
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const example = new ECSExample(canvas);

// Start the example
example.start();

// Access game state
console.log(example.getGameState());

// Stop when done
// example.stop();
*/