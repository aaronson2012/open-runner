// Core game types

// Terrain system types
export * from './terrain';

// Re-export terrain components and utilities
export { TerrainSystem } from '../systems/TerrainSystem';
export { createTerrainComponent, type TerrainComponent } from '../components/TerrainComponent';
export { ChunkManager } from '../utils/terrain/ChunkManager';
export { SpatialIndex } from '../utils/terrain/SpatialIndex';
export { PerformanceMonitor } from '../utils/terrain/PerformanceMonitor';
export { MobileOptimizer } from '../utils/terrain/MobileOptimizations';
export { GPUTerrainGenerator } from '../utils/terrain/GPUTerrainGenerator';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  devicePixelRatio: number;
  enableWebGPU: boolean;
  targetFPS: number;
  enableDebug: boolean;
  qualityLevel?: 'low' | 'medium' | 'high' | 'ultra';
  adaptiveQuality?: boolean;
  enableMultiThreading?: boolean;
  enableStreaming?: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
  gpuMemory?: number;
  renderTime?: number;
  culledObjects?: number;
  activeLODs?: number;
}

// ECS Types
export type EntityId = number;
export type ComponentType = string;
export type SystemId = string;

export interface Component {
  readonly type: ComponentType;
  entityId: EntityId;
}

export interface Entity {
  id: EntityId;
  active: boolean;
  components: Map<ComponentType, Component>;
  archetype?: string;
}

export interface System {
  readonly id: SystemId;
  readonly priority: number;
  requiredComponents: ComponentType[];
  init?(): void;
  update(deltaTime: number, entities: Entity[]): void;
  destroy?(): void;
}

// Component Types
export interface TransformComponent extends Component {
  type: 'transform';
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface MeshComponent extends Component {
  type: 'mesh';
  geometry: string;
  material: string;
  castShadow: boolean;
  receiveShadow: boolean;
  lod?: LODLevel[];
  culling?: CullingVolume;
  instanceCount?: number;
  visible?: boolean;
}

export interface RigidBodyComponent extends Component {
  type: 'rigidbody';
  velocity: Vector3;
  acceleration: Vector3;
  mass: number;
  friction: number;
  restitution: number;
}

export interface ColliderComponent extends Component {
  type: 'collider';
  shape: 'box' | 'sphere' | 'capsule' | 'mesh' | 'terrain';
  size: Vector3;
  offset: Vector3;
  isTrigger: boolean;
  layer: number;
  material?: string;
}

export interface PhysicsComponent extends Component {
  type: 'physics';
  mass: number;
  friction: number;
  restitution: number;
  drag: number;
  angularDrag: number;
  gravityScale: number;
  isKinematic: boolean;
  isTrigger: boolean;
  isGrounded: boolean;
  useGravity: boolean;
  freezeRotation: boolean;
  velocity: Vector3;
  angularVelocity: Vector3;
  isAsleep: boolean;
  isColliding: boolean;
}

export interface PlayerComponent extends Component {
  type: 'player';
  // Movement Physics
  speed: number;
  currentSpeed: number;
  maxSpeed: number;
  acceleration: number;
  steering: number;
  steeringSpeed: number;
  
  // Jump & Gravity
  jumpForce: number;
  verticalVelocity: number;
  gravity: number;
  maxFallSpeed: number;
  
  // Ground Detection
  isGrounded: boolean;
  groundDistance: number;
  slopeAngle: number;
  canClimbSlope: boolean;
  isSliding: boolean;
  
  // Animation
  animationSpeed: number;
  limbOffset: number;
  bankAngle: number;
  
  // Game State
  health: number;
  score: number;
  powerUps: string[];
  
  // Mobile Optimizations
  inputSensitivity: number;
  adaptiveQuality: boolean;
  batteryOptimized: boolean;
}

// Game State Types
export interface GameState {
  scene: 'menu' | 'gameplay' | 'pause' | 'gameover' | 'settings';
  score: number;
  highScore: number;
  level: number;
  lives: number;
  isPaused: boolean;
  settings: GameSettings;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  graphics: 'low' | 'medium' | 'high' | 'ultra';
  controlScheme: 'touch' | 'keyboard' | 'gamepad';
  enableVibration: boolean;
  showFPS: boolean;
}

// Input Types
export interface InputState {
  jump: boolean;
  left: boolean;
  right: boolean;
  slide: boolean;
  pause: boolean;
  steering: number; // -1 to 1 for left/right steering
  touch: TouchInput | null;
  gestures: GestureInput[];
  bufferedInputs: BufferedInput[];
}

export interface TouchInput {
  id: number;
  startPosition: Vector2;
  currentPosition: Vector2;
  deltaPosition: Vector2;
  startTime: number;
  isActive: boolean;
  pressure: number;
  radiusX: number;
  radiusY: number;
}

export interface GestureInput {
  type: 'tap' | 'swipe' | 'hold' | 'pinch' | 'pan';
  position: Vector2;
  direction?: Vector2;
  velocity?: Vector2;
  distance?: number;
  scale?: number;
  duration: number;
  timestamp: number;
}

export interface BufferedInput {
  type: string;
  timestamp: number;
  data: any;
  processed: boolean;
}

// Asset Types
export interface AssetManifest {
  models: Record<string, string>;
  textures: Record<string, string>;
  sounds: Record<string, string>;
  shaders: Record<string, { vertex: string; fragment: string }>;
}

export interface LoadedAsset<T = any> {
  id: string;
  data: T;
  size: number;
  loadTime: number;
}

// Events
export interface GameEvent {
  type: string;
  data?: any;
  timestamp: number;
}

export interface CollisionEvent extends GameEvent {
  type: 'collision';
  data: {
    entityA: EntityId;
    entityB: EntityId;
    point: Vector3;
    normal: Vector3;
  };
}

export interface ScoreEvent extends GameEvent {
  type: 'score';
  data: {
    points: number;
    reason: string;
  };
}

// Rendering Types
export interface RenderCapabilities {
  hasWebGPU: boolean;
  hasWebGL2: boolean;
  maxTextureSize: number;
  maxTextures: number;
  hasInstancedDrawing: boolean;
  hasComputeShaders: boolean;
  supportedTextureFormats: string[];
  maxShaderStage: number;
  isHighEndDevice: boolean;
  isMobile: boolean;
}

export interface RenderSettings {
  shadowMapSize: number;
  enableShadows: boolean;
  enableSSAO: boolean;
  enableAntialiasing: boolean;
  enableTextureLOD: boolean;
  enableInstancing: boolean;
  cullingDistance: number;
  lodLevels: number;
  textureQuality: 'low' | 'medium' | 'high';
  shaderPrecision: 'lowp' | 'mediump' | 'highp';
}

export interface LODLevel {
  distance: number;
  geometry: string;
  material: string;
  visible: boolean;
}

export interface CullingVolume {
  frustum: boolean;
  occlusion: boolean;
  distance: boolean;
  maxDistance: number;
}

export interface StreamingConfig {
  enabled: boolean;
  chunkSize: number;
  preloadDistance: number;
  unloadDistance: number;
  maxConcurrentLoads: number;
}

export interface WorkerPool {
  renderWorker?: Worker;
  physicsWorker?: Worker;
  streamingWorker?: Worker;
  audioWorker?: Worker;
}

// Utility Types
export type Dispose = () => void;
export type UpdateCallback = (deltaTime: number) => void;
export type EventCallback<T extends GameEvent = GameEvent> = (event: T) => void;