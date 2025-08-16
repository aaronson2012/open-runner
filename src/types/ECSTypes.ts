// Enhanced ECS component types for the complete implementation
import type { Component, Vector3, Vector2, EntityId } from './index';

// ===== ENHANCED CORE COMPONENT TYPES =====

export interface EnhancedTransformComponent extends Component {
  type: 'transform';
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale: Vector3;
  
  // Performance optimizations
  worldMatrix?: Float32Array; // 4x4 transformation matrix
  isDirty: boolean; // Needs matrix recalculation
  
  // Hierarchy support
  parent?: EntityId;
  children: EntityId[];
}

export interface EnhancedMeshComponent extends Component {
  type: 'mesh';
  
  // Core rendering data
  geometry: string; // Geometry asset ID
  material: string; // Material asset ID
  
  // Rendering flags
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  frustumCulled: boolean;
  
  // Level of detail
  lodLevels?: string[]; // Array of geometry IDs for different LOD levels
  lodDistances?: number[]; // Distances for LOD switching
  
  // Instancing support
  instanceCount?: number;
  instanceMatrices?: Float32Array;
  instanceColors?: Float32Array;
  
  // Bounding info for culling
  boundingBox?: {
    min: Vector3;
    max: Vector3;
  };
  boundingRadius?: number;
  
  // Rendering layer/group
  renderLayer: number;
  renderOrder: number;
}

export interface EnhancedRigidBodyComponent extends Component {
  type: 'rigidbody';
  
  // Linear motion
  velocity: Vector3;
  acceleration: Vector3;
  force: Vector3; // Accumulated forces
  
  // Angular motion
  angularVelocity: Vector3;
  angularAcceleration: Vector3;
  torque: Vector3; // Accumulated torques
  
  // Physical properties
  mass: number;
  inverseMass: number; // Cached for performance
  friction: number;
  restitution: number; // Bounciness
  linearDamping: number;
  angularDamping: number;
  
  // State flags
  isKinematic: boolean; // Not affected by forces
  isStatic: boolean; // Cannot move
  isSleeping: boolean; // Performance optimization
  
  // Gravity
  useGravity: boolean;
  gravityScale: number;
  
  // Constraints
  lockPositionX: boolean;
  lockPositionY: boolean;
  lockPositionZ: boolean;
  lockRotationX: boolean;
  lockRotationY: boolean;
  lockRotationZ: boolean;
}

export interface EnhancedColliderComponent extends Component {
  type: 'collider';
  
  // Shape definition
  shape: 'box' | 'sphere' | 'capsule' | 'cylinder' | 'mesh' | 'heightfield';
  size: Vector3; // Dimensions (interpretation depends on shape)
  center: Vector3; // Local offset from transform
  
  // Collision behavior
  isTrigger: boolean; // Doesn't block movement, only detects
  enabled: boolean;
  
  // Collision filtering
  layer: number; // What layer this collider is on
  mask: number; // Which layers this collider can collide with
  
  // Material properties (if not using rigidbody)
  friction?: number;
  restitution?: number;
  
  // Convex decomposition for complex meshes
  convexParts?: string[]; // Array of convex geometry IDs
  
  // Heightfield specific (for terrain)
  heights?: Float32Array;
  heightScale?: number;
  widthSegments?: number;
  depthSegments?: number;
}

export interface PlayerControllerComponent extends Component {
  type: 'playerController';
  
  // Movement parameters
  moveSpeed: number;
  runSpeedMultiplier: number;
  jumpForce: number;
  airControl: number; // 0-1, how much control in air
  
  // State
  isGrounded: boolean;
  isRunning: boolean;
  isJumping: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  
  // Ground detection
  groundCheckDistance: number;
  groundLayers: number; // Layer mask for ground
  groundNormal: Vector3;
  groundAngle: number;
  maxSlopeAngle: number; // Maximum walkable slope in degrees
  
  // Input state
  inputDirection: Vector2; // Normalized input direction
  inputJump: boolean;
  inputRun: boolean;
  inputCrouch: boolean;
  inputSlide: boolean;
  
  // Coyote time and jump buffering
  coyoteTime: number; // Time after leaving ground you can still jump
  coyoteTimer: number;
  jumpBufferTime: number; // Time before landing you can buffer a jump
  jumpBufferTimer: number;
  
  // Wall running/jumping
  wallRunning: boolean;
  wallNormal: Vector3;
  wallRunSpeed: number;
  wallJumpForce: Vector3;
  
  // Sliding
  slideSpeed: number;
  slideDuration: number;
  slideTimer: number;
  slideDirection: Vector3;
  
  // Animation state
  animationState: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'slide' | 'wallrun';
  animationBlendTime: number;
}

export interface TerrainComponent extends Component {
  type: 'terrain';
  
  // Chunk system
  chunkSize: number; // Size of each terrain chunk
  chunkPosition: Vector2; // Chunk coordinates
  
  // Height data
  heightData: Float32Array; // Height values
  heightScale: number; // Multiplier for height values
  heightOffset: number; // Base height offset
  
  // Terrain dimensions
  width: number; // Number of vertices along X
  depth: number; // Number of vertices along Z
  
  // Noise parameters
  noiseScale: number;
  noiseSeed: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  
  // Biome data
  biomeMap?: Uint8Array; // Biome ID for each vertex
  moistureMap?: Float32Array; // Moisture values
  temperatureMap?: Float32Array; // Temperature values
  
  // Materials/textures
  materialLayers: string[]; // Material IDs for blending
  blendMap?: Float32Array; // Texture blending weights
  
  // Level of detail
  lodLevel: number; // Current LOD level
  maxLodLevel: number;
  lodDistance: number; // Distance for LOD calculation
  
  // Streaming
  isLoaded: boolean;
  isGenerating: boolean;
  priority: number; // Generation priority
  
  // Optimization
  needsUpdate: boolean;
  lastUpdateTime: number;
  
  // Collision mesh
  collisionMesh?: string; // Simplified mesh for physics
  
  // Vegetation/details
  grassDensity: number;
  treeDensity: number;
  rockDensity: number;
  
  // Water level
  waterLevel: number;
  
  // Caves/overhangs (advanced)
  caveDensity?: number;
  caveThreshold?: number;
}

export interface AudioComponent extends Component {
  type: 'audio';
  
  // Audio source
  clip: string; // Audio asset ID
  
  // Playback control
  isPlaying: boolean;
  isPaused: boolean;
  loop: boolean;
  autoPlay: boolean;
  
  // Volume and pitch
  volume: number; // 0-1
  pitch: number; // Playback speed multiplier
  
  // 3D audio
  is3D: boolean;
  minDistance: number; // Distance at which volume starts to decrease
  maxDistance: number; // Distance at which volume reaches 0
  rolloffFactor: number; // How quickly volume decreases with distance
  
  // Audio groups/mixing
  audioGroup: string; // For volume control (music, sfx, voice, etc.)
  priority: number; // For voice limiting
  
  // Effects
  reverb?: number; // 0-1
  lowPass?: number; // Frequency cutoff
  highPass?: number; // Frequency cutoff
  
  // State
  currentTime: number;
  duration: number;
  
  // Callbacks
  onStart?: () => void;
  onEnd?: () => void;
  onLoop?: () => void;
}

export interface AnimationComponent extends Component {
  type: 'animation';
  
  // Current animation
  currentClip: string; // Animation asset ID
  
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  loop: boolean;
  
  // Timing
  time: number; // Current time in animation
  duration: number; // Total duration
  speed: number; // Playback speed multiplier
  
  // Blending
  blendMode: 'replace' | 'additive' | 'multiply';
  weight: number; // 0-1, for blending multiple animations
  
  // Animation queue
  queuedClips: string[];
  crossfadeTime: number;
  
  // Events
  events: Array<{
    time: number;
    event: string;
    data?: any;
  }>;
  
  // State machine
  stateMachine?: string; // State machine asset ID
  currentState?: string;
  stateTransitions?: Record<string, string[]>;
  
  // IK (Inverse Kinematics)
  ikTargets?: Array<{
    bone: string;
    target: Vector3;
    weight: number;
  }>;
  
  // Bone overrides
  boneOverrides?: Map<string, {
    position?: Vector3;
    rotation?: Vector3;
    scale?: Vector3;
  }>;
}

// ===== PERFORMANCE AND DEBUGGING TYPES =====

export interface PerformanceMetrics {
  updateTime: number;
  renderTime: number;
  frameTime: number;
  entityCount: number;
  systemCount: number;
  componentCount: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
}

export interface SystemMetrics {
  id: string;
  updateCount: number;
  totalUpdateTime: number;
  averageUpdateTime: number;
  lastUpdateTime: number;
  enabled: boolean;
  initialized: boolean;
}

export interface WorldDebugInfo {
  entities: number;
  activeEntities: number;
  systems: number;
  componentTypes: number;
  archetypes: number;
  recycledEntityIds: number;
  isRunning: boolean;
  performance: PerformanceMetrics;
  queryCache: {
    enabled: boolean;
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// ===== UTILITY TYPES =====

export type ComponentTypeMap = {
  transform: EnhancedTransformComponent;
  mesh: EnhancedMeshComponent;
  rigidbody: EnhancedRigidBodyComponent;
  collider: EnhancedColliderComponent;
  playerController: PlayerControllerComponent;
  terrain: TerrainComponent;
  audio: AudioComponent;
  animation: AnimationComponent;
};

export type ComponentTypeName = keyof ComponentTypeMap;

export interface ComponentFactory<T extends Component = Component> {
  (): T;
}

export interface ECSConfig {
  enableQueryCaching?: boolean;
  enableObjectPooling?: boolean;
  enableProfiling?: boolean;
  maxEntities?: number;
  maxComponentsPerType?: number;
}

// ===== SPATIAL PARTITIONING TYPES =====

export interface SpatialBounds {
  min: Vector3;
  max: Vector3;
}

export interface SpatialEntry {
  entityId: EntityId;
  bounds: SpatialBounds;
  hash: number;
}

export interface QueryResult {
  entities: EntityId[];
  fromCache: boolean;
  queryTime: number;
}

// ===== COLLISION TYPES =====

export interface CollisionInfo {
  entityA: EntityId;
  entityB: EntityId;
  point: Vector3;
  normal: Vector3;
  depth: number;
  impulse?: Vector3;
}

export interface RaycastHit {
  entityId: EntityId;
  point: Vector3;
  normal: Vector3;
  distance: number;
  component: EnhancedColliderComponent;
}

export interface RaycastQuery {
  origin: Vector3;
  direction: Vector3;
  maxDistance: number;
  layerMask?: number;
  ignoreTriggers?: boolean;
}

// ===== ARCHETYPE TYPES =====

export interface ArchetypeInfo {
  signature: string;
  componentTypes: string[];
  entityCount: number;
  memoryEstimate: number;
}

export interface ArchetypeTransition {
  from: string;
  to: string;
  addedComponent?: string;
  removedComponent?: string;
}

// ===== EVENT TYPES =====

export interface ECSEvent {
  type: string;
  entityId?: EntityId;
  componentType?: string;
  data?: any;
  timestamp: number;
}

export interface ComponentAddedEvent extends ECSEvent {
  type: 'component-added';
  entityId: EntityId;
  componentType: string;
  component: Component;
}

export interface ComponentRemovedEvent extends ECSEvent {
  type: 'component-removed';
  entityId: EntityId;
  componentType: string;
}

export interface EntityCreatedEvent extends ECSEvent {
  type: 'entity-created';
  entityId: EntityId;
}

export interface EntityDestroyedEvent extends ECSEvent {
  type: 'entity-destroyed';
  entityId: EntityId;
}

export interface CollisionEvent extends ECSEvent {
  type: 'collision';
  collision: CollisionInfo;
}

export interface TriggerEvent extends ECSEvent {
  type: 'trigger';
  triggerEntity: EntityId;
  otherEntity: EntityId;
  entered: boolean; // true for enter, false for exit
}