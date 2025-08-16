/**
 * High-Performance Terrain Generation Types
 * Optimized for WebGPU compute shaders and real-time generation
 */

export interface TerrainConfig {
  chunkSize: number;
  renderDistance: number;
  lodLevels: number;
  noiseFrequency: number;
  noiseAmplitude: number;
  heightScale: number;
  enableGPUGeneration: boolean;
  maxConcurrentChunks: number;
}

export interface ChunkPosition {
  x: number;
  z: number;
}

export interface TerrainChunk {
  id: string;
  position: ChunkPosition;
  worldPosition: { x: number, z: number };
  lodLevel: number;
  isLoaded: boolean;
  isGenerated: boolean;
  vertexBuffer?: GPUBuffer;
  indexBuffer?: GPUBuffer;
  normalBuffer?: GPUBuffer;
  vertexCount: number;
  indexCount: number;
  heightData?: Float32Array;
  boundingBox: {
    min: { x: number, y: number, z: number };
    max: { x: number, y: number, z: number };
  };
  lastAccessTime: number;
  priority: number;
  generationPromise?: Promise<void>;
}

export interface NoiseParameters {
  frequency: number;
  amplitude: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  seed: number;
}

export interface TerrainLevel {
  name: string;
  noiseParams: NoiseParameters;
  colorScheme: {
    low: [number, number, number];
    mid: [number, number, number];
    high: [number, number, number];
  };
  vegetationDensity: number;
  rockDensity: number;
}

export interface ComputeShaderResources {
  device: GPUDevice;
  noiseComputePipeline: GPUComputePipeline;
  heightmapComputePipeline: GPUComputePipeline;
  normalComputePipeline: GPUComputePipeline;
  workgroupSize: number;
}

export interface ChunkGenerationJob {
  chunk: TerrainChunk;
  priority: number;
  startTime: number;
  computePass?: GPUComputePassEncoder;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface TerrainPerformanceMetrics {
  chunksGenerated: number;
  averageGenerationTime: number;
  gpuMemoryUsage: number;
  activeChunks: number;
  frameTime: number;
  lodTransitions: number;
  culledChunks: number;
}

export interface SpatialIndex {
  chunks: Map<string, TerrainChunk>;
  grid: Map<string, Set<string>>;
  cellSize: number;
}

export enum TerrainEvent {
  ChunkLoaded = 'chunk_loaded',
  ChunkUnloaded = 'chunk_unloaded',
  LODChanged = 'lod_changed',
  GenerationComplete = 'generation_complete',
  PerformanceWarning = 'performance_warning'
}

export interface TerrainEventData {
  type: TerrainEvent;
  chunkId?: string;
  position?: ChunkPosition;
  lodLevel?: number;
  metrics?: Partial<TerrainPerformanceMetrics>;
}

// Predefined terrain configurations for Open Runner levels
export const TERRAIN_LEVELS: Record<string, TerrainLevel> = {
  forest: {
    name: 'Forest',
    noiseParams: {
      frequency: 0.01,
      amplitude: 8.0,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      seed: 12345
    },
    colorScheme: {
      low: [0.2, 0.4, 0.1],   // Dark green
      mid: [0.3, 0.6, 0.2],   // Medium green
      high: [0.4, 0.7, 0.3]   // Light green
    },
    vegetationDensity: 0.8,
    rockDensity: 0.2
  },
  
  desert: {
    name: 'Desert',
    noiseParams: {
      frequency: 0.015,
      amplitude: 4.0,
      octaves: 3,
      persistence: 0.6,
      lacunarity: 1.8,
      seed: 54321
    },
    colorScheme: {
      low: [0.8, 0.7, 0.4],   // Light sand
      mid: [0.9, 0.8, 0.5],   // Medium sand
      high: [1.0, 0.9, 0.6]   // Bright sand
    },
    vegetationDensity: 0.1,
    rockDensity: 0.4
  }
};

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  chunkSize: 64,
  renderDistance: 512,
  lodLevels: 4,
  noiseFrequency: 0.01,
  noiseAmplitude: 8.0,
  heightScale: 1.0,
  enableGPUGeneration: true,
  maxConcurrentChunks: 8
};