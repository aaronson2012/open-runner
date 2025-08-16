// Asset Type Definitions for Open Runner
export interface AssetConfig {
  id: string;
  type: AssetType;
  src: string;
  fallbacks?: string[];
  compression?: CompressionConfig;
  priority: AssetPriority;
  preload?: boolean;
  streaming?: boolean;
  memoryPool?: string;
}

export enum AssetType {
  TEXTURE = 'texture',
  MODEL = 'model',
  AUDIO = 'audio',
  SHADER = 'shader',
  FONT = 'font',
  JSON = 'json',
  BINARY = 'binary'
}

export enum AssetPriority {
  CRITICAL = 0,    // Must load before game starts
  HIGH = 1,        // Load immediately after critical
  MEDIUM = 2,      // Load during gameplay
  LOW = 3,         // Load when idle
  BACKGROUND = 4   // Load in background
}

export interface CompressionConfig {
  formats: CompressionFormat[];
  quality: number;
  progressive?: boolean;
  mipmaps?: boolean;
}

export enum CompressionFormat {
  // Texture formats
  ASTC = 'astc',
  ETC2 = 'etc2',
  S3TC = 's3tc',
  PVRTC = 'pvrtc',
  WEBP = 'webp',
  JPEG = 'jpeg',
  PNG = 'png',
  
  // Audio formats
  OPUS = 'opus',
  OGG = 'ogg',
  MP3 = 'mp3',
  AAC = 'aac',
  WAV = 'wav'
}

export interface LoadedAsset<T = any> {
  id: string;
  type: AssetType;
  data: T;
  size: number;
  format: CompressionFormat;
  metadata: AssetMetadata;
  cleanup?: () => void;
}

export interface AssetMetadata {
  loadTime: number;
  fileSize: number;
  dimensions?: { width: number; height: number };
  duration?: number;
  channels?: number;
  sampleRate?: number;
  compressionRatio?: number;
}

export interface LoadingProgress {
  total: number;
  loaded: number;
  failed: number;
  current?: string;
  percentage: number;
  stage: LoadingStage;
}

export enum LoadingStage {
  DETECTING = 'detecting',
  DOWNLOADING = 'downloading',
  DECOMPRESSING = 'decompressing',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  ERROR = 'error'
}

export interface AssetLoaderConfig {
  maxConcurrentLoads: number;
  enableStreaming: boolean;
  enableCompression: boolean;
  memoryLimit: number;
  cacheSize: number;
  retryAttempts: number;
  timeoutMs: number;
  adaptiveQuality: boolean;
  mobileOptimizations: boolean;
}

// Visual Asset Specific Types
export interface TextureAsset extends LoadedAsset<WebGLTexture> {
  width: number;
  height: number;
  format: GLenum;
  mipmaps: boolean;
}

export interface ModelAsset extends LoadedAsset<Float32Array> {
  vertices: Float32Array;
  indices?: Uint16Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

// Audio Asset Specific Types
export interface AudioAsset extends LoadedAsset<AudioBuffer> {
  buffer: AudioBuffer;
  duration: number;
  channels: number;
  sampleRate: number;
  loop?: boolean;
  volume?: number;
  spatialConfig?: SpatialAudioConfig;
}

export interface SpatialAudioConfig {
  enabled: boolean;
  panningModel: PanningModelType;
  distanceModel: DistanceModelType;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
}

// Asset Collections
export interface AssetCollection {
  id: string;
  name: string;
  assets: string[];
  dependencies?: string[];
  loadingStrategy: LoadingStrategy;
}

export enum LoadingStrategy {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  PROGRESSIVE = 'progressive',
  ADAPTIVE = 'adaptive'
}

export interface AssetManifest {
  version: string;
  collections: AssetCollection[];
  assets: AssetConfig[];
  globalConfig: AssetLoaderConfig;
}

// Performance monitoring
export interface AssetPerformanceMetrics {
  totalLoadTime: number;
  totalSize: number;
  cacheHitRate: number;
  compressionRatio: number;
  memoryUsage: number;
  failedAssets: string[];
  deviceCapabilities: DeviceCapabilities;
}

export interface DeviceCapabilities {
  webgl2: boolean;
  astcSupport: boolean;
  etc2Support: boolean;
  s3tcSupport: boolean;
  webAudioAPI: boolean;
  maxTextureSize: number;
  maxConcurrentAudioSources: number;
  totalMemory: number;
  isMobile: boolean;
  connectionType: string;
}