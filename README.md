# Open Runner - Complete Visual and Audio Asset System

A comprehensive, modern asset management system for the Open Runner game, featuring advanced compression, mobile optimization, streaming, and spatial audio capabilities.

## 🚀 Features

### Core Asset Management
- **Progressive Asset Loading** - Lazy loading with priority-based scheduling
- **Texture Compression** - ASTC, ETC2, S3TC, WebP support with automatic format detection
- **Audio Compression** - Opus, OGG, MP3, AAC with quality adaptation
- **Memory Management** - Automatic memory pools with garbage collection
- **Streaming Support** - Progressive asset streaming for large files

### Mobile Optimization
- **Adaptive Quality** - Automatic quality adjustment based on device capabilities
- **Connection Awareness** - Optimized loading for 2G/3G/4G/5G connections
- **Battery Management** - Reduced loading on low battery
- **Memory Pressure** - Dynamic memory management and asset prioritization

### Audio System
- **Spatial Audio** - Web Audio API with 3D positioning
- **Audio Groups** - Separate volume control for music, SFX, voice, ambient
- **Mobile Audio** - Optimized for mobile audio context restrictions
- **Performance Monitoring** - Real-time audio performance tracking

### Visual Assets
- **Procedural Generation** - Built-in placeholder asset generation
- **Character Models** - Player and 6 enemy types with procedural geometry
- **Environment Textures** - Forest and desert terrain with variations
- **UI Elements** - Coins, powerups, health indicators
- **Particle Effects** - Basic particle textures for visual effects

## 📁 Project Structure

```
src/
├── systems/assets/           # Core asset management system
│   ├── AssetSystem.ts       # Main asset system integration
│   ├── AssetLoader.ts       # Core asset loading with compression
│   ├── AudioSystem.ts       # Spatial audio system
│   ├── VisualAssetGenerator.ts # Procedural asset generation
│   ├── StreamingLoader.ts   # Progressive streaming
│   ├── MobileOptimizer.ts   # Mobile-specific optimizations
│   ├── MemoryManager.ts     # Memory pool management
│   └── AssetManifest.ts     # Asset configuration and manifests
├── types/assets/            # TypeScript type definitions
│   └── AssetTypes.ts        # Complete asset type system
├── utils/compression/       # Compression detection utilities
│   └── CompressionDetector.ts
├── config/                  # Configuration management
│   └── AssetConfig.ts       # Environment-specific configs
├── examples/                # Example usage
│   └── AssetSystemExample.ts
└── assets/                  # Asset directories
    ├── placeholders/        # Generated placeholder assets
    └── generated/           # Runtime generated assets
```

## 🛠 Installation & Setup

```bash
# Install dependencies (if using in a project)
npm install

# The asset system is self-contained and ready to use
```

## 📖 Quick Start

### Basic Usage

```typescript
import { AssetSystem } from './src/systems/assets';

// Initialize asset system
const assetSystem = new AssetSystem({
  maxConcurrentLoads: 4,
  enableStreaming: true,
  enableCompression: true,
  memoryLimit: 256 * 1024 * 1024, // 256MB
  adaptiveQuality: true,
  mobileOptimizations: true
});

// Initialize with critical assets
await assetSystem.initializeSystem();

// Load game content
await assetSystem.loadCollection('forest_level');

// Get loaded assets
const playerModel = assetSystem.getAsset('player_model');
const forestTexture = assetSystem.getAsset('forest_ground_texture');
```

### Audio System

```typescript
// Play sound effects
const coinSoundId = await assetSystem.playAudio('sfx_coin_collect', {
  volume: 0.8,
  groupId: 'sfx'
});

// Play background music with spatial audio
const musicId = await assetSystem.playAudio('music_forest', {
  loop: true,
  volume: 0.6,
  groupId: 'music',
  spatialConfig: {
    enabled: true,
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    maxDistance: 100
  }
});

// Control volume
assetSystem.setMasterVolume(0.8);
assetSystem.setAudioVolume(musicId, 0.5);
```

### Mobile Optimization

The system automatically detects mobile devices and applies optimizations:

- Reduces concurrent downloads
- Enables aggressive compression
- Adapts quality based on connection speed
- Manages memory pressure
- Optimizes for battery life

## 🎮 Asset Collections

### Boot Assets (Critical)
- Player model and texture
- Basic UI elements
- Core fonts and sounds

### Forest Level
- Forest terrain textures
- Forest enemies (bear, squirrel, deer)
- Forest ambience and music
- Environmental assets

### Desert Level  
- Desert terrain textures
- Desert enemies (coyote, snake, scorpion)
- Desert ambience and music
- Environmental assets

### Sound Effects
- Player actions (jump, land, turn)
- Collectibles (coins, powerups)
- Enemy sounds
- Collision effects

## 📱 Mobile Features

### Adaptive Quality
- **Ultra-Low**: 64MB memory, 30% quality, minimal concurrent loads
- **Low**: 128MB memory, 50% quality, basic streaming
- **Medium**: 256MB memory, 70% quality, full streaming
- **High**: 512MB memory, 90% quality, desktop-like experience

### Connection Optimization
- **2G/3G**: Aggressive compression, reduced quality, smaller chunks
- **4G/5G**: Progressive enhancement, higher quality assets
- **WiFi**: Full quality streaming

### Battery Management
- Reduces asset loading on low battery
- Suspends background quality upgrades
- Prioritizes critical assets only

## 🔧 Configuration

### Environment Configs

```typescript
import { AssetConfigManager } from './src/config/AssetConfig';

const configManager = AssetConfigManager.getInstance();
const config = configManager.getOptimizedConfig(deviceCapabilities);
```

### Custom Quality Presets

```typescript
// Apply quality preset
const lowQualityConfig = configManager.getQualityPreset('low');
const assetSystem = new AssetSystem(lowQualityConfig);
```

## 🎨 Asset Generation

The system includes built-in procedural asset generation:

### Character Models
- **Player**: Capsule-shaped character
- **Bear**: Large, stocky predator
- **Squirrel**: Small, agile climber  
- **Deer**: Elegant, tall herbivore
- **Coyote**: Medium predator
- **Snake**: Segmented serpent
- **Scorpion**: Multi-part arthropod

### Textures
- Forest ground with organic variations
- Desert sand with ripple patterns
- Character textures with type-appropriate colors
- UI elements (coins, powerups, health)
- Particle effects

## 📊 Performance Monitoring

```typescript
// Get system information
const systemInfo = assetSystem.getSystemInfo();
console.log('Memory usage:', systemInfo.memoryUsage);
console.log('Device capabilities:', systemInfo.deviceCapabilities);

// Get performance report
const report = assetSystem.getPerformanceReport();
console.log(report);
```

## 🧪 Testing

Run the example to test the complete system:

```typescript
import { runAssetSystemExample } from './src/examples/AssetSystemExample';

// Run complete demonstration
await runAssetSystemExample();
```

## 🔄 Memory Management

The system includes automatic memory management:

- **Memory Pools**: Critical, gameplay, background asset pools
- **Garbage Collection**: Automatic cleanup of unused assets
- **Memory Pressure**: Dynamic quality reduction under pressure
- **Asset Prioritization**: Critical assets protected from cleanup

## 🌐 Compression Support

### Texture Formats
- **ASTC**: Android/modern mobile (8:1 compression)
- **ETC2**: Android fallback (4:1 compression)  
- **S3TC**: Desktop/older Android (4:1 compression)
- **WebP**: Modern browsers (3:1 compression)
- **JPEG/PNG**: Universal fallback

### Audio Formats
- **Opus**: Modern browsers (20:1 compression)
- **OGG**: Firefox/Chrome (10:1 compression)
- **MP3**: Universal support (10:1 compression)
- **AAC**: Safari/mobile (12:1 compression)
- **WAV**: Uncompressed fallback

## 🚨 Error Handling

The system includes comprehensive error handling:

- Automatic fallback to lower quality assets
- Progressive degradation on failures
- Retry mechanisms with exponential backoff
- Graceful degradation for unsupported features

## 🔒 Security Features

- Asset integrity verification
- Safe cleanup of WebGL resources
- Memory leak prevention
- Secure audio context handling

## 📈 Performance Metrics

- **Load Times**: Track asset loading performance
- **Memory Usage**: Monitor memory consumption
- **Compression Ratios**: Measure compression effectiveness
- **Cache Hit Rates**: Monitor caching efficiency
- **Device Capabilities**: Track device-specific performance

## 🚀 Original Player Controller System

This asset system integrates with the existing modern player controller system:

### Mobile-First Design
- **Touch Zones**: Intelligent screen zones for intuitive mobile controls
- **Gesture Recognition**: Tap, swipe, hold, pinch, and pan gestures
- **Haptic Feedback**: Contextual vibration feedback for enhanced mobile experience
- **Battery Optimization**: Automatic performance scaling for extended gameplay

### Performance Features
- **60fps Performance**: Adaptive quality scaling maintains smooth gameplay
- **Input Buffering**: Responsive controls with 150ms input buffering
- **Coyote Time**: 100ms grace period for platform jumping
- **Terrain Following**: Smooth dual-raycast system for complex terrain navigation

## 🤝 Contributing

This asset system is designed to be:
- **Modular**: Easy to extend with new asset types
- **Configurable**: Extensive configuration options
- **Mobile-First**: Optimized for mobile performance
- **Future-Proof**: Support for emerging web standards

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to run!** 🏃‍♂️ The complete visual and audio asset system is now implemented with modern web standards, mobile optimization, and comprehensive performance monitoring.