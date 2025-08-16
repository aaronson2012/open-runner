import { World, type WorldConfig } from './World';
import { TransformSystem } from '@/systems/core/TransformSystem';
import { PhysicsSystem } from '@/systems/core/PhysicsSystem';
import { InputSystem } from '@/systems/core/InputSystem';
import { RenderSystem } from '@/systems/core/RenderSystem';
import { 
  ComponentFactories,
  createTransformComponent,
  createMeshComponent,
  createRigidBodyComponent,
  createColliderComponent,
  createPlayerControllerComponent,
  createTerrainComponent,
  createAudioComponent,
  createAnimationComponent
} from '@/components/core/CoreComponents';
import type { EntityId, Vector3 } from '@/types';

/**
 * High-level ECS manager that provides easy-to-use API for game development
 */
export class ECSManager {
  private world: World;
  private systems: {
    transform: TransformSystem;
    physics: PhysicsSystem;
    input: InputSystem;
    render: RenderSystem;
  };
  
  private isRunning = false;
  private lastTime = 0;
  private frameId = 0;

  constructor(canvas: HTMLCanvasElement, config: WorldConfig = {}) {
    // Initialize world with optimizations enabled
    const worldConfig: WorldConfig = {
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: true,
      maxEntities: 10000,
      maxComponentsPerType: 5000,
      ...config
    };
    
    this.world = new World(worldConfig);
    
    // Create core systems
    this.systems = {
      transform: new TransformSystem(),
      physics: new PhysicsSystem(),
      input: new InputSystem(canvas),
      render: new RenderSystem(canvas)
    };
    
    this.initializeSystems();
    this.registerComponents();
  }

  /**
   * Initialize all systems and set up dependencies
   */
  private initializeSystems(): void {
    // Set world reference for all systems
    this.systems.transform.setWorld(this.world);
    this.systems.physics.setWorld(this.world);
    this.systems.input.setWorld(this.world);
    this.systems.render.setWorld(this.world);
    
    // Add systems to world with dependencies
    this.world.addSystem(this.systems.input, []); // Input first
    this.world.addSystem(this.systems.transform, ['input']); // Transform after input
    this.world.addSystem(this.systems.physics, ['transform']); // Physics after transform
    this.world.addSystem(this.systems.render, ['transform', 'physics']); // Render last
  }

  /**
   * Register component factories for object pooling
   */
  private registerComponents(): void {
    // Register all component types with their factories
    for (const [componentType, factory] of Object.entries(ComponentFactories)) {
      this.world.registerComponent(componentType, factory, 100);
    }
  }

  /**
   * Start the ECS update loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.world.start();
    this.lastTime = performance.now();
    
    const update = (currentTime: number) => {
      if (!this.isRunning) return;
      
      const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
      this.lastTime = currentTime;
      
      // Clamp delta time to prevent large jumps
      const clampedDelta = Math.min(deltaTime, 1/30); // Max 30 FPS
      
      this.world.update(clampedDelta);
      
      this.frameId = requestAnimationFrame(update);
    };
    
    this.frameId = requestAnimationFrame(update);
  }

  /**
   * Stop the ECS update loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.world.stop();
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  // ===== ENTITY CREATION HELPERS =====

  /**
   * Create a basic game object with transform
   */
  createGameObject(position?: Vector3, rotation?: Vector3, scale?: Vector3): EntityId {
    const entityId = this.world.createEntity();
    
    const transform = createTransformComponent(position, rotation, scale);
    this.world.addComponent(entityId, transform);
    
    return entityId;
  }

  /**
   * Create a renderable object
   */
  createRenderableObject(
    geometry: string,
    material: string,
    position?: Vector3,
    rotation?: Vector3,
    scale?: Vector3
  ): EntityId {
    const entityId = this.createGameObject(position, rotation, scale);
    
    const mesh = createMeshComponent(geometry, material);
    this.world.addComponent(entityId, mesh);
    
    return entityId;
  }

  /**
   * Create a physics object
   */
  createPhysicsObject(
    geometry: string,
    material: string,
    colliderShape: 'box' | 'sphere' | 'capsule',
    colliderSize: Vector3,
    mass: number = 1,
    position?: Vector3
  ): EntityId {
    const entityId = this.createRenderableObject(geometry, material, position);
    
    const rigidBody = createRigidBodyComponent(mass);
    const collider = createColliderComponent(colliderShape, colliderSize);
    
    this.world.addComponent(entityId, rigidBody);
    this.world.addComponent(entityId, collider);
    
    return entityId;
  }

  /**
   * Create a player character
   */
  createPlayer(
    geometry: string,
    material: string,
    position: Vector3 = { x: 0, y: 0, z: 0 }
  ): EntityId {
    const entityId = this.createPhysicsObject(
      geometry,
      material,
      'capsule',
      { x: 0.5, y: 2, z: 0.5 }, // Player capsule size
      70, // Player mass (70kg)
      position
    );
    
    const playerController = createPlayerControllerComponent();
    this.world.addComponent(entityId, playerController);
    
    return entityId;
  }

  /**
   * Create a terrain chunk
   */
  createTerrain(
    chunkX: number,
    chunkY: number,
    chunkSize: number = 64
  ): EntityId {
    const entityId = this.createGameObject();
    
    const terrain = createTerrainComponent(
      { x: chunkX, y: chunkY },
      { chunkSize }
    );
    
    this.world.addComponent(entityId, terrain);
    
    return entityId;
  }

  /**
   * Create an audio source
   */
  createAudioSource(
    clip: string,
    position?: Vector3,
    is3D: boolean = true
  ): EntityId {
    const entityId = position ? this.createGameObject(position) : this.world.createEntity();
    
    const audio = createAudioComponent(clip, { is3D });
    this.world.addComponent(entityId, audio);
    
    return entityId;
  }

  // ===== COMPONENT ACCESS HELPERS =====

  /**
   * Get transform component
   */
  getTransform(entityId: EntityId) {
    return this.world.getComponent(entityId, 'transform');
  }

  /**
   * Get mesh component
   */
  getMesh(entityId: EntityId) {
    return this.world.getComponent(entityId, 'mesh');
  }

  /**
   * Get rigidbody component
   */
  getRigidBody(entityId: EntityId) {
    return this.world.getComponent(entityId, 'rigidbody');
  }

  /**
   * Get collider component
   */
  getCollider(entityId: EntityId) {
    return this.world.getComponent(entityId, 'collider');
  }

  /**
   * Get player controller component
   */
  getPlayerController(entityId: EntityId) {
    return this.world.getComponent(entityId, 'playerController');
  }

  // ===== ENTITY QUERIES =====

  /**
   * Get all entities with transform
   */
  getAllGameObjects(): EntityId[] {
    return this.world.getEntitiesWithComponents(['transform']).map(e => e.id);
  }

  /**
   * Get all renderable entities
   */
  getAllRenderables(): EntityId[] {
    return this.world.getEntitiesWithComponents(['transform', 'mesh']).map(e => e.id);
  }

  /**
   * Get all physics entities
   */
  getAllPhysicsObjects(): EntityId[] {
    return this.world.getEntitiesWithComponents(['transform', 'rigidbody']).map(e => e.id);
  }

  /**
   * Get all player entities
   */
  getAllPlayers(): EntityId[] {
    return this.world.getEntitiesWithComponents(['transform', 'playerController']).map(e => e.id);
  }

  /**
   * Get all terrain chunks
   */
  getAllTerrain(): EntityId[] {
    return this.world.getEntitiesWithComponents(['terrain']).map(e => e.id);
  }

  // ===== PHYSICS HELPERS =====

  /**
   * Apply force to entity
   */
  applyForce(entityId: EntityId, force: Vector3, point?: Vector3): void {
    this.systems.physics.applyForce(entityId, force, point);
  }

  /**
   * Apply impulse to entity
   */
  applyImpulse(entityId: EntityId, impulse: Vector3): void {
    this.systems.physics.applyImpulse(entityId, impulse);
  }

  /**
   * Set gravity
   */
  setGravity(gravity: Vector3): void {
    this.systems.physics.setGravity(gravity);
  }

  // ===== RENDERING HELPERS =====

  /**
   * Set camera position
   */
  setCameraPosition(position: Vector3): void {
    this.systems.render.setCameraPosition(position);
  }

  /**
   * Set camera target
   */
  setCameraTarget(target: Vector3): void {
    this.systems.render.setCameraTarget(target);
  }

  /**
   * Set camera field of view
   */
  setCameraFOV(fov: number): void {
    this.systems.render.setCameraFOV(fov);
  }

  // ===== INPUT HELPERS =====

  /**
   * Check if key is down
   */
  isKeyDown(keyCode: string): boolean {
    return this.systems.input.isKeyDown(keyCode);
  }

  /**
   * Check if action is active
   */
  isActionActive(action: string): boolean {
    return this.systems.input.isActionActive(action);
  }

  /**
   * Check if action was pressed this frame
   */
  isActionPressed(action: string): boolean {
    return this.systems.input.isActionPressed(action);
  }

  // ===== ENTITY MANAGEMENT =====

  /**
   * Destroy an entity
   */
  destroyEntity(entityId: EntityId): void {
    this.world.destroyEntity(entityId);
  }

  /**
   * Check if entity exists
   */
  entityExists(entityId: EntityId): boolean {
    return this.world.getEntity(entityId) !== undefined;
  }

  // ===== PERFORMANCE AND DEBUG =====

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      world: this.world.getDebugInfo(),
      systems: {
        transform: this.systems.transform.getPerformanceMetrics(),
        physics: this.systems.physics.getPerformanceMetrics(),
        input: this.systems.input.getPerformanceMetrics(),
        render: this.systems.render.getPerformanceMetrics()
      },
      memory: {
        queryCache: this.world.getQueryCacheStats(),
        archetypes: this.world.getArchetypeInfo()
      }
    };
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      world: this.world.getDebugInfo(),
      systems: {
        transform: this.systems.transform.getDebugInfo(),
        physics: this.systems.physics.getDebugInfo(),
        input: this.systems.input.getDebugInfo(),
        render: this.systems.render.getDebugInfo()
      },
      isRunning: this.isRunning,
      frameId: this.frameId
    };
  }

  /**
   * Clear all entities and reset world
   */
  clear(): void {
    this.world.clear();
  }

  /**
   * Enable/disable system debugging
   */
  setDebugMode(enabled: boolean): void {
    this.systems.transform.setDebugEnabled(enabled);
    this.systems.physics.setDebugEnabled(enabled);
    this.systems.input.setDebugEnabled(enabled);
    this.systems.render.setDebugEnabled(enabled);
  }

  // ===== UTILITY METHODS =====

  /**
   * Set world position of entity
   */
  setPosition(entityId: EntityId, position: Vector3): void {
    const transform = this.getTransform(entityId);
    if (transform) {
      transform.position.x = position.x;
      transform.position.y = position.y;
      transform.position.z = position.z;
      transform.isDirty = true;
      
      // Mark transform system to update this entity
      this.systems.transform.markDirty(entityId);
    }
  }

  /**
   * Get world position of entity
   */
  getPosition(entityId: EntityId): Vector3 | null {
    return this.systems.transform.getWorldPosition(entityId);
  }

  /**
   * Set rotation of entity
   */
  setRotation(entityId: EntityId, rotation: Vector3): void {
    const transform = this.getTransform(entityId);
    if (transform) {
      transform.rotation.x = rotation.x;
      transform.rotation.y = rotation.y;
      transform.rotation.z = rotation.z;
      transform.isDirty = true;
      
      this.systems.transform.markDirty(entityId);
    }
  }

  /**
   * Set scale of entity
   */
  setScale(entityId: EntityId, scale: Vector3): void {
    const transform = this.getTransform(entityId);
    if (transform) {
      transform.scale.x = scale.x;
      transform.scale.y = scale.y;
      transform.scale.z = scale.z;
      transform.isDirty = true;
      
      this.systems.transform.markDirty(entityId);
    }
  }

  /**
   * Set visibility of entity
   */
  setVisible(entityId: EntityId, visible: boolean): void {
    const mesh = this.getMesh(entityId);
    if (mesh) {
      mesh.visible = visible;
    }
  }

  /**
   * Set parent-child relationship
   */
  setParent(childId: EntityId, parentId: EntityId | null): void {
    this.systems.transform.setParent(childId, parentId);
  }
}