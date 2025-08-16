/**
 * TerrainComponent for ECS integration
 * Stores terrain state and configuration for entities
 */

import { Component } from '../core/ecs/World';
import { TerrainConfig, TerrainPerformanceMetrics, TerrainLevel } from '../types/terrain';

export interface TerrainComponent extends Component {
  config: TerrainConfig;
  currentLevel: TerrainLevel | null;
  activeChunks: number;
  loadingChunks: number;
  performanceMetrics: TerrainPerformanceMetrics;
  playerPosition: { x: number; z: number };
  lastUpdateTime: number;
  enableGPUGeneration: boolean;
  enablePerformanceMonitoring: boolean;
  maxMemoryUsage: number; // In bytes
  targetFrameTime: number; // In milliseconds
}

export function createTerrainComponent(
  config: Partial<TerrainConfig> = {},
  options: {
    enableGPUGeneration?: boolean;
    enablePerformanceMonitoring?: boolean;
    maxMemoryUsage?: number;
    targetFrameTime?: number;
  } = {}
): TerrainComponent {
  return {
    config: {
      chunkSize: 64,
      renderDistance: 512,
      lodLevels: 4,
      noiseFrequency: 0.01,
      noiseAmplitude: 8.0,
      heightScale: 1.0,
      enableGPUGeneration: true,
      maxConcurrentChunks: 8,
      ...config
    },
    currentLevel: null,
    activeChunks: 0,
    loadingChunks: 0,
    performanceMetrics: {
      chunksGenerated: 0,
      averageGenerationTime: 0,
      gpuMemoryUsage: 0,
      activeChunks: 0,
      frameTime: 0,
      lodTransitions: 0,
      culledChunks: 0
    },
    playerPosition: { x: 0, z: 0 },
    lastUpdateTime: 0,
    enableGPUGeneration: options.enableGPUGeneration ?? true,
    enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? true,
    maxMemoryUsage: options.maxMemoryUsage ?? 512 * 1024 * 1024, // 512MB default
    targetFrameTime: options.targetFrameTime ?? 16.67 // 60fps
  };
}