# Placeholder Assets for Open Runner

This directory contains placeholder assets that can be used for immediate development and testing. These assets are procedurally generated and can be easily replaced with final art assets.

## Directory Structure

```
placeholders/
├── models/          # 3D model placeholders
├── textures/        # Texture placeholders  
├── audio/           # Audio placeholders
├── ui/              # UI element placeholders
└── effects/         # Effect placeholders
```

## Generated Assets

The asset system automatically generates the following placeholder assets:

### Character Models
- `player_model` - Capsule-shaped player character
- `bear_model` - Large, stocky bear enemy
- `squirrel_model` - Small, agile squirrel enemy  
- `deer_model` - Elegant, tall deer enemy
- `coyote_model` - Medium-sized coyote enemy
- `snake_model` - Segmented snake enemy
- `scorpion_model` - Multi-part scorpion enemy

### Environment Textures
- `forest_ground_texture` - Forest floor with organic variations
- `desert_sand_texture` - Desert sand with ripple patterns
- Character textures for each enemy type with appropriate colors

### UI Elements
- `ui_coin` - Golden coin texture
- `ui_powerup` - Glowing orb powerup
- `ui_health` - Red cross health icon
- `particle_basic` - Basic particle texture for effects

## Usage

These placeholder assets are automatically loaded by the AssetSystem and can be accessed using their asset IDs:

```typescript
const assetSystem = new AssetSystem();
await assetSystem.initializeSystem();

// Get a placeholder model
const playerModel = assetSystem.getAsset('player_model');

// Get a placeholder texture  
const forestTexture = assetSystem.getAsset('forest_ground_texture');
```

## Replacement

To replace placeholder assets with final assets:

1. Add your final assets to the appropriate directories
2. Update the asset manifest to point to the new files
3. The AssetSystem will automatically load the new assets instead of generating placeholders

## Technical Details

- All generated models include vertices, indices, normals, UVs, and bounding boxes
- Textures are generated as HTML5 Canvas elements and converted to WebGL textures
- Models use simple geometric shapes optimized for performance
- All assets include proper cleanup methods for memory management

## Asset Specifications

### Model Format
- Vertices: Float32Array (x, y, z coordinates)
- Indices: Uint16Array (triangle indices)
- Normals: Float32Array (surface normals)
- UVs: Float32Array (texture coordinates)
- Bounding Box: Min/max coordinates

### Texture Format
- Generated as Canvas 2D contexts
- Converted to WebGL textures automatically
- Power-of-2 dimensions for GPU compatibility
- RGBA format with proper mipmapping

### Optimization
- Placeholder assets are optimized for mobile devices
- Geometry complexity is kept minimal for performance
- Textures use efficient generation algorithms
- Memory usage is tracked and managed automatically