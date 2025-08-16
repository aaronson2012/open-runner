// Asset System Exports - Complete Visual and Audio Asset System for Open Runner
export { AssetSystem } from './AssetSystem';
export { AssetLoader } from './AssetLoader';
export { AudioSystem } from './AudioSystem';
export { VisualAssetGenerator } from './VisualAssetGenerator';
export { StreamingLoader } from './StreamingLoader';
export { MobileOptimizer } from './MobileOptimizer';
export { AssetManifestBuilder } from './AssetManifest';
export { MemoryManager } from './MemoryManager';

// Re-export types
export * from '../../types/assets/AssetTypes';

// Utility exports
export { CompressionDetector } from '../../utils/compression/CompressionDetector';

// Main asset system factory
export function createAssetSystem(config?: any): AssetSystem {
  return new AssetSystem(config);
}