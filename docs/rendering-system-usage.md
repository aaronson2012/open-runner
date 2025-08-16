# Modern Rendering Pipeline - Usage Guide

## Overview

The Open Runner rendering system provides a production-ready WebGPU/WebGL rendering pipeline with comprehensive mobile optimization, LOD management, and streaming capabilities.

## Key Features

- **WebGPU First**: Modern GPU API with WebGL fallback
- **Mobile Optimized**: 60fps performance on mobile devices
- **Adaptive Quality**: Automatic quality adjustment based on performance
- **LOD Management**: Distance-based Level of Detail switching
- **Frustum Culling**: Efficient view frustum culling
- **Asset Streaming**: Progressive loading of game assets
- **Memory Management**: Intelligent resource cleanup
- **Multi-threading**: Web Worker support for performance

## Quick Start

```typescript
import { Game } from '@/core/game/Game';
import type { GameConfig } from '@/types';

// Create game configuration
const config: GameConfig = {
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  width: window.innerWidth,
  height: window.innerHeight,
  devicePixelRatio: window.devicePixelRatio,
  enableWebGPU: true,
  targetFPS: 60,
  enableDebug: false,
  qualityLevel: 'auto', // Will be auto-detected
  adaptiveQuality: true,
  enableMultiThreading: true,
  enableStreaming: true
};

// Initialize game with modern rendering
const game = new Game(config);

// Game automatically initializes:
// 1. Device capability detection
// 2. WebGPU/WebGL renderer selection
// 3. Performance adapter setup
// 4. LOD and culling systems
// 5. Resource management
// 6. Asset streaming
```

## Device Capability Detection

The system automatically detects device capabilities:

```typescript
import { DeviceCapabilities } from '@/rendering/DeviceCapabilities';

// Detect capabilities
const capabilities = await DeviceCapabilities.detect();

console.log('Device Info:', {
  hasWebGPU: capabilities.hasWebGPU,
  hasWebGL2: capabilities.hasWebGL2,
  maxTextureSize: capabilities.maxTextureSize,
  isHighEndDevice: capabilities.isHighEndDevice,
  isMobile: capabilities.isMobile,
  supportedFormats: capabilities.supportedTextureFormats
});

// Run performance benchmarks
const gpuScore = await DeviceCapabilities.getInstance().runPerformanceBenchmark();
const memoryScore = await DeviceCapabilities.getInstance().runMemoryBenchmark();
```

## Quality Management

### Manual Quality Control

```typescript
// Set specific quality level
game.setQualityLevel('high');

// Available levels: 'low', 'medium', 'high', 'ultra'
const currentQuality = game.getRenderSystem().getPerformanceAdapter().getCurrentQuality();
```

### Adaptive Quality

```typescript
// Enable automatic quality adjustment
game.enableAdaptiveQuality(true);

// Monitor performance metrics
const renderSystem = game.getRenderSystem();
const metrics = renderSystem.getMetrics();

console.log('Performance:', {
  fps: metrics.fps,
  frameTime: metrics.frameTime,
  drawCalls: metrics.drawCalls,
  triangles: metrics.triangles,
  memoryUsage: metrics.memoryUsage,
  culledObjects: metrics.culledObjects
});
```

## LOD (Level of Detail) System

### Creating LOD Levels

```typescript
import { LODManager } from '@/rendering/LODManager';

const lodManager = new LODManager(capabilities);

// Create terrain LOD
const terrainLOD = lodManager.createTerrainLOD(50); // 50 unit base distance
// Results in:
// - High detail: 0-50 units
// - Medium detail: 50-100 units  
// - Low detail: 100-200 units
// - Hidden: 200+ units

// Create vegetation LOD
const vegetationLOD = lodManager.createVegetationLOD(30);

// Create character LOD
const characterLOD = lodManager.createCharacterLOD(25);
```

### Custom LOD Configuration

```typescript
import type { LODLevel } from '@/types';

const customLOD: LODLevel[] = [
  {
    distance: 25,
    geometry: 'building_high_detail',
    material: 'building_pbr_detailed',
    visible: true
  },
  {
    distance: 75,
    geometry: 'building_medium_detail', 
    material: 'building_pbr_medium',
    visible: true
  },
  {
    distance: 150,
    geometry: 'building_low_detail',
    material: 'building_simple',
    visible: true
  },
  {
    distance: 300,
    geometry: 'building_impostor',
    material: 'building_billboard',
    visible: false
  }
];

// Apply to entity
const entity = {
  id: 1,
  active: true,
  components: new Map([
    ['mesh', {
      type: 'mesh',
      lod: customLOD,
      // ...other properties
    }]
  ])
};
```

## Culling System

### Frustum Culling

```typescript
import { CullingManager } from '@/rendering/CullingManager';

const cullingManager = new CullingManager(camera, renderSettings);

// Configure culling for entities
const entity = {
  components: new Map([
    ['mesh', {
      culling: {
        frustum: true,        // Enable frustum culling
        occlusion: false,     // Disable occlusion culling (expensive)
        distance: true,       // Enable distance culling
        maxDistance: 200      // Cull beyond 200 units
      }
    }]
  ])
};

// Cull entities
const visibleEntities = cullingManager.cull(allEntities);
console.log(`Culled ${cullingManager.getCulledCount()} entities`);
```

### Hierarchical Culling

```typescript
// Group entities for efficient culling
const visibleEntities = cullingManager.hierarchicalCull(entities);

// Portal culling for indoor scenes
const portals = [
  {
    center: new THREE.Vector3(0, 0, 10),
    normal: new THREE.Vector3(0, 0, -1),
    fromZone: 0,
    toZone: 1
  }
];

const visibleInPortals = cullingManager.portalCull(entities, portals);
```

## Resource Management

### Geometry Management

```typescript
import { ResourceManager } from '@/rendering/ResourceManager';

const resourceManager = new ResourceManager(renderer);

// Store geometry
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
resourceManager.setGeometry('box_1x1x1', boxGeometry);

// Retrieve geometry
const geometry = resourceManager.getGeometry('box_1x1x1');

// Memory management
const memoryUsage = resourceManager.getMemoryUsage();
console.log(`Geometry memory: ${memoryUsage.geometries / 1024 / 1024}MB`);

// Force garbage collection
resourceManager.forceGarbageCollection();
```

### Texture Management

```typescript
// Load textures with compression support
const texture = await resourceManager.getTexture('/assets/textures/grass.jpg');

// The system automatically:
// 1. Checks for compressed formats (ASTC, ETC2, S3TC)
// 2. Applies appropriate filtering
// 3. Generates mipmaps
// 4. Tracks memory usage
```

### Instanced Rendering

```typescript
// Create instanced mesh for better performance
const instancedMesh = resourceManager.createInstancedMesh(
  'tree_geometry',
  'tree_material', 
  1000 // instance count
);

// Update instance transforms
const matrix = new THREE.Matrix4();
matrix.setPosition(x, y, z);
resourceManager.updateInstancedMesh(instancedMesh, instanceId, matrix);
```

## Asset Streaming

### Basic Streaming

```typescript
import { StreamingManager } from '@/rendering/StreamingManager';

const streamingManager = new StreamingManager(resourceManager);

// Configure streaming
streamingManager.updateConfig({
  chunkSize: 100,          // 100x100 unit chunks
  preloadDistance: 200,    // Preload within 200 units
  unloadDistance: 400,     // Unload beyond 400 units
  maxConcurrentLoads: 4    // Load 4 chunks simultaneously
});

// Update based on player movement
const playerPosition = { x: 150, y: 0, z: 75 };
streamingManager.update(playerPosition);

// Monitor streaming performance
const stats = streamingManager.getStreamingStats();
console.log('Streaming:', {
  activeChunks: stats.activeChunks,
  loadingChunks: stats.loadingChunks,
  bandwidth: stats.bandwidth + ' MB/s'
});
```

### Progressive Mesh Loading

```typescript
// Load different mesh qualities based on distance
await streamingManager.loadProgressiveMesh('building_complex', playerPosition);

// Automatically loads:
// - Close: building_complex_high.glb
// - Medium: building_complex_medium.glb  
// - Far: building_complex_low.glb
```

### Texture Streaming

```typescript
// Stream textures based on quality needs
await streamingManager.streamTexture('terrain_diffuse', 'high');
await streamingManager.streamTexture('building_normal', 'medium');
await streamingManager.streamTexture('detail_roughness', 'low');
```

## Performance Monitoring

### Real-time Metrics

```typescript
const renderSystem = game.getRenderSystem();

// Get comprehensive metrics
const metrics = renderSystem.getMetrics();

console.log('Performance Metrics:', {
  // Frame rate
  fps: metrics.fps,
  frameTime: metrics.frameTime,
  
  // Rendering
  drawCalls: metrics.drawCalls,
  triangles: metrics.triangles,
  renderTime: metrics.renderTime,
  
  // Memory
  memoryUsage: metrics.memoryUsage,
  gpuMemory: metrics.gpuMemory,
  
  // Optimization
  culledObjects: metrics.culledObjects,
  activeLODs: metrics.activeLODs
});

// Device capabilities
const capabilities = renderSystem.getCapabilities();
console.log('Render Capabilities:', capabilities);

// Current settings
const settings = renderSystem.getSettings();
console.log('Render Settings:', settings);
```

### Performance Adaptation

```typescript
const performanceAdapter = renderSystem.getPerformanceAdapter();

// Check if adjustment is needed
if (performanceAdapter.shouldAdjustQuality()) {
  console.log('Performance adjustment needed');
}

// Get performance recommendations
const workerCount = performanceAdapter.getRecommendedWorkerCount();
const compressionFormat = performanceAdapter.getTextureCompressionFormat();
const enableVRS = performanceAdapter.enableVariableRateShading();

console.log('Recommendations:', {
  workers: workerCount,
  compression: compressionFormat,
  variableRateShading: enableVRS
});
```

## Mobile Optimization

### Battery Optimization

```typescript
// Enable battery-aware optimizations
performanceAdapter.enableBatteryOptimizations();

// Detect thermal throttling
const isThermalThrottling = performanceAdapter.detectThermalThrottling();
if (isThermalThrottling) {
  console.log('Thermal throttling detected, reducing quality');
  game.setQualityLevel('low');
}
```

### Touch-Friendly Settings

```typescript
// Mobile-specific configuration
const mobileConfig: GameConfig = {
  // ...base config
  devicePixelRatio: Math.min(window.devicePixelRatio, 2), // Limit pixel ratio
  qualityLevel: 'medium', // Start with medium quality
  adaptiveQuality: true,  // Enable automatic adjustment
  enableStreaming: true,  // Essential for mobile
  enableMultiThreading: false // May cause issues on some mobile browsers
};

if (capabilities.isMobile) {
  // Apply mobile-specific optimizations
  game.setQualityLevel(capabilities.isHighEndDevice ? 'medium' : 'low');
}
```

## Error Handling

### Graceful Degradation

```typescript
try {
  const game = new Game(config);
  await game.init();
} catch (error) {
  console.error('Rendering initialization failed:', error);
  
  // Fallback to basic renderer
  const fallbackConfig = {
    ...config,
    enableWebGPU: false,
    qualityLevel: 'low',
    adaptiveQuality: false
  };
  
  const fallbackGame = new Game(fallbackConfig);
}
```

### Resource Loading Errors

```typescript
// Handle texture loading failures
try {
  const texture = await resourceManager.getTexture('missing_texture.jpg');
} catch (error) {
  console.warn('Texture load failed, using placeholder:', error);
  // System automatically provides placeholder textures
}

// Monitor failed resources
const stats = resourceManager.getResourceStats();
if (stats.failedResources > 0) {
  console.warn(`${stats.failedResources} resources failed to load`);
}
```

## Best Practices

### Entity Setup

```typescript
// Optimal entity configuration
const optimizedEntity = {
  id: entityId,
  active: true,
  components: new Map([
    ['transform', {
      type: 'transform',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }],
    ['mesh', {
      type: 'mesh',
      geometry: 'shared_geometry_id', // Reuse geometries
      material: 'shared_material_id', // Reuse materials
      castShadow: false,              // Only enable when needed
      receiveShadow: true,
      lod: lodLevels,                 // Always provide LOD
      culling: {
        frustum: true,
        distance: true,
        maxDistance: 200
      },
      instanceCount: 100              // Use instancing when possible
    }]
  ])
};
```

### Memory Management

```typescript
// Set appropriate memory limits
resourceManager.setMemoryLimit(512); // 512MB limit

// Monitor memory pressure
setInterval(() => {
  const pressure = resourceManager.getMemoryPressure();
  if (pressure > 0.8) {
    console.warn('High memory pressure, forcing cleanup');
    resourceManager.forceGarbageCollection();
  }
}, 5000);
```

### Performance Optimization

```typescript
// Optimize for target frame rate
const targetFPS = 60;
const frameTime = 1000 / targetFPS;

// Update LODs less frequently for performance
const lodUpdateFrequency = 4; // Every 4 frames
let frameCount = 0;

function gameLoop() {
  frameCount++;
  
  // Standard updates every frame
  game.update(deltaTime);
  
  // LOD updates every 4 frames
  if (frameCount % lodUpdateFrequency === 0) {
    lodManager.update(cameraPosition, entities);
  }
  
  requestAnimationFrame(gameLoop);
}
```

## Debugging

### Debug Visualization

```typescript
// Enable debug mode
const debugConfig = {
  ...config,
  enableDebug: true
};

// Access debug information
const debugInfo = renderSystem.getRenderer().getDebugInfo();
console.log('Renderer Debug Info:', debugInfo);

// Visualize culling results
const cullingStats = cullingManager.getCullingPerformance();
console.log('Culling Debug:', cullingStats);
```

### Performance Profiling

```typescript
// Profile render system performance
console.time('RenderSystem.update');
renderSystem.update(deltaTime, entities);
console.timeEnd('RenderSystem.update');

// Profile individual components
console.time('Culling');
const visibleEntities = cullingManager.cull(entities);
console.timeEnd('Culling');

console.time('LOD Update');
lodManager.update(cameraPosition, entities);
console.timeEnd('LOD Update');
```

This modern rendering pipeline provides production-ready performance with comprehensive mobile optimization, making it suitable for deploying high-quality 3D web games across all devices.