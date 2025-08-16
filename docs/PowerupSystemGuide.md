# Powerup System Integration Guide

The complete powerup system for Open Runner provides faithful recreation of original mechanics with modern ECS architecture, mobile optimization, and comprehensive visual effects.

## Quick Start

### Basic Integration

```typescript
import { World } from '@/core/ecs/World';
import { PowerupSystem } from '@/powerups';

// Create and initialize the powerup system
const world = new World();
const powerupSystem = new PowerupSystem(world);

// In your game loop
function gameLoop(deltaTime: number) {
  powerupSystem.update(deltaTime);
  
  // Get rendering data
  const particles = powerupSystem.getParticlesForRendering();
  const visualEffects = powerupSystem.getVisualEffectsForRendering();
  const uiElements = powerupSystem.getUIElementsForRendering();
  
  // Render particles, effects, and UI...
}
```

### Mobile-Optimized Setup

```typescript
// For mobile devices
const mobileSystem = PowerupSystem.createMobileOptimized(world);

// Or with custom mobile config
const customMobileSystem = new PowerupSystem(world, {
  mobileOptimized: true,
  performanceMode: 'medium',
  maxConcurrentPowerups: 3,
  enableParticleEffects: true,
  enableVisualEffects: true
});
```

### Progressive Unlocking

```typescript
// Enable progressive powerup unlocking
const progressiveSystem = PowerupSystem.createProgressive(world);

// Update with game state
function gameLoop(deltaTime: number) {
  const gameState = {
    playerLevel: getCurrentLevel(),
    playerScore: getCurrentScore(),
    playerPosition: getPlayerPosition()
  };
  
  progressiveSystem.update(deltaTime, gameState);
}
```

## Powerup Types

### Magnet Powerup
- **Duration**: 10 seconds
- **Effect**: Attracts coins within 80-unit radius
- **Visual**: Red metallic effect with attraction field
- **Force**: 150 units/second attraction speed

```typescript
// Spawn a magnet powerup
const magnetPowerup = powerupSystem.spawnMagnet({ x: 100, y: 0, z: 50 });
```

### Doubler Powerup
- **Duration**: 10 seconds
- **Effect**: 2x score multiplier for all collectibles
- **Visual**: Blue effect with "X2" indicator
- **Bonus Tracking**: Tracks total bonus score earned

```typescript
// Spawn a doubler powerup
const doublerPowerup = powerupSystem.spawnDoubler({ x: 150, y: 0, z: 75 });
```

### Invisibility Powerup
- **Duration**: 10 seconds
- **Effect**: Immunity to enemies and obstacles
- **Visual**: Purple semi-transparent with shimmer effect
- **Collision Bypass**: Tracks number of collisions bypassed

```typescript
// Spawn an invisibility powerup
const invisibilityPowerup = powerupSystem.spawnInvisibility({ x: 200, y: 0, z: 100 });
```

## Configuration Options

### Performance Modes

```typescript
const config = {
  performanceMode: 'high' | 'medium' | 'low',
  mobileOptimized: boolean,
  maxConcurrentPowerups: number,
  enableVisualEffects: boolean,
  enableParticleEffects: boolean
};
```

### Auto Spawning

```typescript
const autoSpawnConfig = {
  autoSpawn: {
    enabled: true,
    spawnRate: 2, // powerups per minute
    spawnArea: {
      center: { x: 0, y: 0, z: 0 },
      radius: 100
    },
    availableTypes: [PowerupType.MAGNET, PowerupType.DOUBLER, PowerupType.INVISIBILITY]
  }
};
```

### Progressive Unlocking

```typescript
const progressiveConfig = {
  progressiveUnlock: {
    enabled: true,
    levelThresholds: {
      [PowerupType.MAGNET]: 1,
      [PowerupType.DOUBLER]: 3,
      [PowerupType.INVISIBILITY]: 5
    },
    scoreThresholds: {
      [PowerupType.MAGNET]: 0,
      [PowerupType.DOUBLER]: 1000,
      [PowerupType.INVISIBILITY]: 2500
    }
  }
};
```

## API Reference

### Core Methods

```typescript
// Spawning powerups
spawnPowerup(type: PowerupType, position: Vector3): Entity
spawnPowerupBatch(types: PowerupType[], area: SpawnArea, count: number): Entity[]
spawnProgressivePowerups(level: number, score: number, position: Vector3): Entity[]

// Quick spawn methods
spawnMagnet(position: Vector3): Entity
spawnDoubler(position: Vector3): Entity
spawnInvisibility(position: Vector3): Entity

// Status queries
getActivePowerups(): Map<number, PowerupComponent>
hasPowerupActive(entityId: number, type: PowerupType): boolean
getRemainingTime(entityId: number): number

// Rendering data
getParticlesForRendering(): Particle[]
getVisualEffectsForRendering(): Map<string, VisualEffect>
getUIElementsForRendering(): Map<number, UIElement>

// Configuration
updateConfig(config: Partial<PowerupSystemConfig>): void
setAutoSpawnEnabled(enabled: boolean): void
setDebugMode(enabled: boolean): void

// Statistics and debugging
getStats(): PowerupSystemStats
forceCollectPowerup(entityId: number): boolean
```

### Event System

```typescript
// Listen for powerup events
powerupSystem.addEventListener('collected', (event) => {
  console.log(`Powerup ${event.powerupType} collected!`);
});

powerupSystem.addEventListener('activated', (event) => {
  console.log(`Powerup ${event.powerupType} activated!`);
});

powerupSystem.addEventListener('expired', (event) => {
  console.log(`Powerup ${event.powerupType} expired!`);
});
```

## Component Architecture

### PowerupComponent
Core component containing powerup state and configuration.

```typescript
interface PowerupComponent {
  type: PowerupType;
  state: PowerupState;
  config: PowerupConfig;
  activationTime: number;
  expirationTime: number;
  remainingDuration: number;
  isActive: boolean;
  effectsApplied: boolean;
}
```

### CollectibleComponent
Handles collection mechanics and visual feedback.

```typescript
interface CollectibleComponent {
  collectionRadius: number;
  scoreValue: number;
  isCollected: boolean;
  collectionTime: number;
  collectorEntityId: number | null;
  magneticAttraction: boolean;
  bounceAmplitude: number;
  rotationSpeed: number;
  glowIntensity: number;
}
```

### MagnetComponent
Manages magnetic attraction for coins and collectibles.

```typescript
interface MagnetComponent {
  isActive: boolean;
  attractionRadius: number;
  attractionForce: number;
  targetTypes: string[];
  affectedEntities: Set<number>;
  visualEffect: MagnetVisualEffect;
}
```

## System Architecture

### PowerupSystem
Manages powerup lifecycle, activation, and expiration.

### CollectionSystem
Handles collision detection and collection effects.

### MagnetSystem
Implements magnetic attraction physics.

### VisualEffectsSystem
Manages visual feedback and particle effects.

## Mobile Optimization

### Automatic Optimizations
- Dynamic particle count adjustment based on device capabilities
- Reduced visual effects on low-end devices
- Performance monitoring with adaptive quality scaling
- Touch-optimized interaction radii

### Device Capability Detection
```typescript
interface DeviceCapabilities {
  maxParticles: number;
  reducedEffects: boolean;
  lowDetailMode: boolean;
}
```

### Performance Monitoring
```typescript
interface PerformanceMetrics {
  frameTime: number;
  lastFrameTime: number;
  adaptiveQuality: number;
  particleCount: number;
}
```

## Testing

### Unit Tests
```bash
npm test tests/powerups/components/
npm test tests/powerups/systems/
npm test tests/powerups/PowerupFactory.test.ts
```

### Integration Tests
```bash
npm test tests/powerups/PowerupSystemIntegration.test.ts
```

### Performance Tests
```bash
npm test tests/performance/powerups/
```

## Best Practices

### Performance
1. Use progressive unlocking to reduce complexity
2. Enable mobile optimizations on appropriate devices
3. Monitor performance metrics and adjust particle counts
4. Use object pooling for frequently spawned powerups

### Visual Effects
1. Match original game aesthetics with modern enhancements
2. Provide clear visual feedback for all powerup states
3. Use consistent color schemes (Red=Magnet, Blue=Doubler, Purple=Invisibility)
4. Implement smooth transitions and animations

### Gameplay
1. Maintain faithful 10-second duration for all powerups
2. Preserve original collision detection accuracy
3. Implement proper stacking behavior for multiple powerups
4. Provide clear UI feedback for remaining time

## Troubleshooting

### Common Issues

1. **Powerups not collecting**: Check collision radius and player entity setup
2. **Performance drops**: Reduce particle count or enable mobile optimizations
3. **Visual effects missing**: Verify WebGL support and effect configuration
4. **Progressive unlocking not working**: Check level/score thresholds

### Debug Mode
```typescript
// Enable debug mode for detailed logging
powerupSystem.setDebugMode(true);

// Get system statistics
const stats = powerupSystem.getStats();
console.log('Powerup System Stats:', stats);
```

### Factory Statistics
```typescript
// Get factory creation statistics
const factoryStats = PowerupSystem.getFactoryStats();
console.log('Factory Stats:', factoryStats);
```

## Example Implementation

```typescript
// Complete example setup
import { World } from '@/core/ecs/World';
import { PowerupSystem, PowerupType } from '@/powerups';

class GameManager {
  private world: World;
  private powerupSystem: PowerupSystem;
  
  constructor() {
    this.world = new World();
    this.powerupSystem = PowerupSystem.createProgressive(this.world);
    
    // Setup event listeners
    this.setupPowerupEvents();
  }
  
  private setupPowerupEvents() {
    this.powerupSystem.addEventListener('collected', (event) => {
      this.playCollectionSound(event.powerupType);
      this.showCollectionEffect(event);
    });
    
    this.powerupSystem.addEventListener('activated', (event) => {
      this.showActivationUI(event.powerupType);
    });
    
    this.powerupSystem.addEventListener('expired', (event) => {
      this.hideActivationUI(event.powerupType);
    });
  }
  
  update(deltaTime: number) {
    const gameState = {
      playerLevel: this.getPlayerLevel(),
      playerScore: this.getPlayerScore(),
      playerPosition: this.getPlayerPosition()
    };
    
    this.powerupSystem.update(deltaTime, gameState);
    
    // Render powerup effects
    this.renderPowerupEffects();
  }
  
  private renderPowerupEffects() {
    const particles = this.powerupSystem.getParticlesForRendering();
    const visualEffects = this.powerupSystem.getVisualEffectsForRendering();
    const uiElements = this.powerupSystem.getUIElementsForRendering();
    
    // Integrate with your rendering system
    this.renderer.renderParticles(particles);
    this.renderer.renderVisualEffects(visualEffects);
    this.renderer.renderUI(uiElements);
  }
  
  // Manual powerup spawning for level design
  spawnLevelPowerups(levelData: LevelData) {
    levelData.powerupSpawns.forEach(spawn => {
      this.powerupSystem.spawnPowerup(spawn.type, spawn.position);
    });
  }
}
```

This comprehensive powerup system provides faithful recreation of original Open Runner mechanics while adding modern enhancements, mobile optimization, and extensive customization options.