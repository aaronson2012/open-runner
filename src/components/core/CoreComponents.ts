import type { Component, Vector3, Vector2, EntityId } from '@/types';

// ===== TRANSFORM COMPONENT =====
export interface TransformComponent extends Component {
  type: 'transform';
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale: Vector3;
  
  // Derived/cached data for performance
  worldMatrix?: Float32Array; // 4x4 transformation matrix
  isDirty: boolean; // Needs matrix recalculation
  
  // Hierarchy support
  parent?: EntityId;
  children: EntityId[];
}

export function createTransformComponent(
  position: Vector3 = { x: 0, y: 0, z: 0 },
  rotation: Vector3 = { x: 0, y: 0, z: 0 },
  scale: Vector3 = { x: 1, y: 1, z: 1 }
): TransformComponent {
  return {
    type: 'transform',
    entityId: 0,
    position: { ...position },
    rotation: { ...rotation },
    scale: { ...scale },
    worldMatrix: new Float32Array(16),
    isDirty: true,
    children: []
  };
}

// ===== MESH COMPONENT =====
export interface MeshComponent extends Component {
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

export function createMeshComponent(
  geometry: string,
  material: string,
  options: Partial<Pick<MeshComponent, 'visible' | 'castShadow' | 'receiveShadow' | 'renderLayer' | 'renderOrder'>> = {}
): MeshComponent {
  return {
    type: 'mesh',
    entityId: 0,
    geometry,
    material,
    visible: options.visible ?? true,
    castShadow: options.castShadow ?? true,
    receiveShadow: options.receiveShadow ?? true,
    frustumCulled: true,
    renderLayer: options.renderLayer ?? 0,
    renderOrder: options.renderOrder ?? 0
  };
}

// ===== PHYSICS COMPONENTS =====
export interface RigidBodyComponent extends Component {
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

export function createRigidBodyComponent(
  mass: number = 1,
  options: Partial<Pick<RigidBodyComponent, 'friction' | 'restitution' | 'isKinematic' | 'isStatic' | 'useGravity'>> = {}
): RigidBodyComponent {
  const inverseMass = mass > 0 ? 1 / mass : 0;
  
  return {
    type: 'rigidbody',
    entityId: 0,
    velocity: { x: 0, y: 0, z: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    force: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    angularAcceleration: { x: 0, y: 0, z: 0 },
    torque: { x: 0, y: 0, z: 0 },
    mass,
    inverseMass,
    friction: options.friction ?? 0.3,
    restitution: options.restitution ?? 0.3,
    linearDamping: 0.1,
    angularDamping: 0.1,
    isKinematic: options.isKinematic ?? false,
    isStatic: options.isStatic ?? false,
    isSleeping: false,
    useGravity: options.useGravity ?? true,
    gravityScale: 1,
    lockPositionX: false,
    lockPositionY: false,
    lockPositionZ: false,
    lockRotationX: false,
    lockRotationY: false,
    lockRotationZ: false
  };
}

export interface ColliderComponent extends Component {
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

export function createColliderComponent(
  shape: ColliderComponent['shape'],
  size: Vector3,
  options: Partial<Pick<ColliderComponent, 'isTrigger' | 'layer' | 'mask' | 'center'>> = {}
): ColliderComponent {
  return {
    type: 'collider',
    entityId: 0,
    shape,
    size: { ...size },
    center: options.center ? { ...options.center } : { x: 0, y: 0, z: 0 },
    isTrigger: options.isTrigger ?? false,
    enabled: true,
    layer: options.layer ?? 0,
    mask: options.mask ?? 0xFFFFFFFF // Collide with all layers by default
  };
}

// ===== PLAYER CONTROLLER COMPONENT =====
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

export function createPlayerControllerComponent(
  options: Partial<Pick<PlayerControllerComponent, 'moveSpeed' | 'jumpForce' | 'maxSlopeAngle'>> = {}
): PlayerControllerComponent {
  return {
    type: 'playerController',
    entityId: 0,
    moveSpeed: options.moveSpeed ?? 5,
    runSpeedMultiplier: 1.5,
    jumpForce: options.jumpForce ?? 8,
    airControl: 0.3,
    isGrounded: false,
    isRunning: false,
    isJumping: false,
    isCrouching: false,
    isSliding: false,
    groundCheckDistance: 0.1,
    groundLayers: 1,
    groundNormal: { x: 0, y: 1, z: 0 },
    groundAngle: 0,
    maxSlopeAngle: options.maxSlopeAngle ?? 45,
    inputDirection: { x: 0, y: 0 },
    inputJump: false,
    inputRun: false,
    inputCrouch: false,
    inputSlide: false,
    coyoteTime: 0.1,
    coyoteTimer: 0,
    jumpBufferTime: 0.1,
    jumpBufferTimer: 0,
    wallRunning: false,
    wallNormal: { x: 0, y: 0, z: 0 },
    wallRunSpeed: 6,
    wallJumpForce: { x: 5, y: 8, z: 0 },
    slideSpeed: 8,
    slideDuration: 1,
    slideTimer: 0,
    slideDirection: { x: 0, y: 0, z: 0 },
    animationState: 'idle',
    animationBlendTime: 0.1
  };
}

// ===== TERRAIN COMPONENT =====
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

export function createTerrainComponent(
  chunkPosition: Vector2,
  options: Partial<Pick<TerrainComponent, 'chunkSize' | 'heightScale' | 'noiseScale' | 'noiseSeed'>> = {}
): TerrainComponent {
  const chunkSize = options.chunkSize ?? 64;
  const vertexCount = (chunkSize + 1) * (chunkSize + 1);
  
  return {
    type: 'terrain',
    entityId: 0,
    chunkSize,
    chunkPosition: { ...chunkPosition },
    heightData: new Float32Array(vertexCount),
    heightScale: options.heightScale ?? 20,
    heightOffset: 0,
    width: chunkSize + 1,
    depth: chunkSize + 1,
    noiseScale: options.noiseScale ?? 0.01,
    noiseSeed: options.noiseSeed ?? 1337,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
    materialLayers: ['grass', 'rock', 'snow'],
    lodLevel: 0,
    maxLodLevel: 3,
    lodDistance: 100,
    isLoaded: false,
    isGenerating: false,
    priority: 0,
    needsUpdate: true,
    lastUpdateTime: 0,
    grassDensity: 0.5,
    treeDensity: 0.1,
    rockDensity: 0.05,
    waterLevel: 0
  };
}

// ===== AUDIO COMPONENT =====
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

export function createAudioComponent(
  clip: string,
  options: Partial<Pick<AudioComponent, 'volume' | 'loop' | 'is3D' | 'audioGroup' | 'autoPlay'>> = {}
): AudioComponent {
  return {
    type: 'audio',
    entityId: 0,
    clip,
    isPlaying: false,
    isPaused: false,
    loop: options.loop ?? false,
    autoPlay: options.autoPlay ?? false,
    volume: options.volume ?? 1,
    pitch: 1,
    is3D: options.is3D ?? false,
    minDistance: 1,
    maxDistance: 100,
    rolloffFactor: 1,
    audioGroup: options.audioGroup ?? 'sfx',
    priority: 0,
    currentTime: 0,
    duration: 0
  };
}

// ===== ANIMATION COMPONENT =====
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

export function createAnimationComponent(
  currentClip: string,
  options: Partial<Pick<AnimationComponent, 'loop' | 'speed' | 'autoPlay'>> = {}
): AnimationComponent {
  return {
    type: 'animation',
    entityId: 0,
    currentClip,
    isPlaying: options.autoPlay ?? false,
    isPaused: false,
    loop: options.loop ?? true,
    time: 0,
    duration: 1,
    speed: options.speed ?? 1,
    blendMode: 'replace',
    weight: 1,
    queuedClips: [],
    crossfadeTime: 0.2,
    events: []
  };
}

// Component factory functions for object pooling
export const ComponentFactories = {
  transform: () => createTransformComponent(),
  mesh: () => createMeshComponent('', ''),
  rigidbody: () => createRigidBodyComponent(),
  collider: () => createColliderComponent('box', { x: 1, y: 1, z: 1 }),
  playerController: () => createPlayerControllerComponent(),
  terrain: () => createTerrainComponent({ x: 0, y: 0 }),
  audio: () => createAudioComponent(''),
  animation: () => createAnimationComponent('')
} as const;

export type ComponentTypeMap = {
  transform: TransformComponent;
  mesh: MeshComponent;
  rigidbody: RigidBodyComponent;
  collider: ColliderComponent;
  playerController: PlayerControllerComponent;
  terrain: TerrainComponent;
  audio: AudioComponent;
  animation: AnimationComponent;
};