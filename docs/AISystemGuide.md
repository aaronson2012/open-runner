# Open Runner AI System Guide

## Overview

The Open Runner AI system is a complete, modern ECS-based enemy AI implementation that faithfully recreates the original 6 enemy types with enhanced behaviors, performance optimization, and mobile-friendly design.

## Features

### 🧠 Core AI Components
- **AIComponent**: State machine with decision making and learning
- **EnemyComponent**: Core enemy stats and properties  
- **AggroComponent**: Advanced target detection and threat assessment
- **NavigationComponent**: Pathfinding and movement with obstacle avoidance
- **PatrolComponent**: Roaming behavior and waypoint navigation

### 🎯 Enemy Types (Faithful Recreation)

#### Forest Enemies
- **Bear**: Territorial, aggressive, slow but persistent
  - Speed: 8.0, Aggro: 40.0, Health: 100, Damage: 25
- **Squirrel**: Quick, alert, easily startled
  - Speed: 12.0, Aggro: 20.0, Health: 30, Damage: 8  
- **Deer**: Prey animal, flees from threats
  - Speed: 10.0, Aggro: 36.0, Health: 60, Damage: 15

#### Desert Enemies  
- **Coyote**: Pack hunter, intelligent, coordinated
  - Speed: 11.0, Aggro: 35.0, Health: 70, Damage: 18
- **Rattlesnake**: Ambush predator, high damage, mostly stationary
  - Speed: 2.0, Aggro: 10.0, Health: 40, Damage: 30
- **Scorpion**: Territorial, cautious, moderate threat
  - Speed: 4.0, Aggro: 8.0, Health: 45, Damage: 20

### 🚀 Modern Features
- **State Machine**: Smooth transitions between idle, patrol, chase, attack, return states
- **Group Coordination**: Pack behavior for coyotes with leader/follower dynamics
- **Adaptive Learning**: AI learns player patterns and adjusts tactics
- **LOD System**: Performance optimization based on distance to player
- **Mobile Optimization**: Reduced AI complexity on lower-end devices

## Quick Start

### Basic Setup

```typescript
import { createAIIntegration } from '@/systems/ai';

// Initialize AI system
const world = new World();
const ai = createAIIntegration(world);
ai.init();

// Game loop
function update(deltaTime: number) {
  ai.update(deltaTime);
}
```

### Creating Enemies

```typescript
// Individual enemies
const bear = ai.createEnemies.bear({ x: 100, y: 0, z: 50 });
const squirrel = ai.createEnemies.squirrel({ x: 120, y: 0, z: 30 });

// Enemy packs
const coyotePack = ai.createEnemies.coyotePack(
  { x: 200, y: 0, z: 100 }, // center position
  4 // pack size
);
```

### Level Integration

```typescript
// Spawn enemies from level configuration
const enemies = ai.spawnEnemiesForLevel(
  levelConfig,
  playerPosition,
  {
    difficulty: 1.2,
    maxEnemies: 25,
    chunkSize: 100
  }
);
```

## AI Behavior System

### State Machine

Each enemy AI operates on a state machine with these states:

- **idle**: Waiting, low alertness
- **patrol**: Roaming around spawn area
- **investigate**: Checking suspicious activity
- **chase**: Pursuing detected player
- **attack**: Close combat with player
- **return**: Returning to spawn area after losing target
- **stunned**: Temporarily disabled
- **dead**: Eliminated

### Decision Making

The AI makes decisions based on:
- Distance to player
- Line of sight
- Sound detection
- Movement detection  
- Enemy type personality
- Group coordination
- Learning from previous encounters

### Behavioral Differences

#### Bear Behavior
- Territorial defense around spawn
- Slow but persistent chaser
- High damage close combat
- Investigates disturbances thoroughly

#### Squirrel Behavior  
- Quick reactions and movements
- Wide field of view
- Short attention span
- Flees when outnumbered

#### Deer Behavior
- Prey animal instincts
- Excellent peripheral vision
- Flees from any threat
- Travels in small groups

#### Coyote Behavior
- Pack coordination
- Intelligent pathfinding
- Persistent hunting
- Shares information with pack

#### Rattlesnake Behavior
- Ambush tactics
- Detects vibrations/movement
- High damage strike
- Mostly stationary

#### Scorpion Behavior
- Territorial but cautious
- Moderate aggression
- Burrows when threatened
- Desert adapted

## Advanced Features

### Group Coordination

Coyotes demonstrate advanced pack behavior:

```typescript
// Coyotes automatically coordinate when close together
const pack = ai.createEnemies.coyotePack(centerPos, 4);

// Pack behaviors:
// - Share target information
// - Coordinate attacks
// - Leader/follower dynamics
// - Formation movement
```

### Adaptive Learning

The AI learns from player behavior:

```typescript
// AI tracks player patterns
const ai = entity.components.get('ai');
console.log(ai.learning.playerPredictability); // 0-1 score
console.log(ai.learning.successfulTactics); // What worked
console.log(ai.learning.failedTactics); // What didn't work
```

### Performance Optimization

The system automatically optimizes performance:

```typescript
// Get performance metrics
const metrics = ai.debug.getPerformanceMetrics();
console.log(`Update time: ${metrics.averageUpdateTime}ms`);
console.log(`Active entities: ${metrics.activeEntities}`);

// System automatically:
// - Reduces AI frequency for distant enemies
// - Simplifies pathfinding when needed
// - Adjusts detection ranges based on performance
```

## Powerup Integration

### Invisibility Powerup

```typescript
// When player collects invisibility
onInvisibilityCollected(duration) {
  ai.handlePlayerEvents.invisibility(true, duration);
  // Enemies (except rattlesnakes) lose visual detection
}
```

### Other Events

```typescript
// Game pause
ai.handlePlayerEvents.pause(true);

// Player death  
ai.handlePlayerEvents.death();

// Level completion
ai.handlePlayerEvents.levelComplete();
```

## Debug Tools

### Performance Monitoring

```typescript
// Enable debug mode
ai.debug.setDebugMode(true);

// Get AI states
const states = ai.debug.getAIStates();
states.forEach(state => {
  console.log(`${state.type}: ${state.aiState} at (${state.position.x}, ${state.position.z})`);
});

// Performance metrics
const metrics = ai.debug.getPerformanceMetrics();
console.log(`Total entities: ${metrics.totalEntities}`);
console.log(`Update time: ${metrics.averageUpdateTime.toFixed(2)}ms`);

// Enemy counts by type
const enemyStats = ai.debug.getEnemyStats();
console.log('Enemy counts:', enemyStats);
```

### Visual Debug Information

When debug mode is enabled, the system provides:
- Detection radius visualization
- View cone indicators
- Path visualization
- State information overlay
- Target tracking lines

## Configuration

### Difficulty Scaling

```typescript
// Easy mode (0.5)
ai.setDifficulty(0.5);
// - Slower reactions
// - Reduced aggression
// - Shorter chase times

// Hard mode (1.5)  
ai.setDifficulty(1.5);
// - Faster reactions
// - Increased aggression
// - Better coordination
// - Enhanced detection
```

### Custom Enemy Properties

```typescript
const customBear = ai.createEnemies.bear(position, {
  customProperties: {
    health: 150,           // More health
    moveSpeed: 10.0,       // Faster movement
    aggroRadius: 50.0,     // Larger detection
    territorialRadius: 30.0 // Bigger territory
  }
});
```

## Integration with Legacy System

### Migration from Original

```typescript
// Migrate existing enemies
const legacyEnemies = [
  { type: 'bear', position: {x: 50, y: 0, z: 50}, health: 100 },
  { type: 'squirrel', position: {x: 70, y: 0, z: 30}, health: 30 }
];

const newEnemies = ai.migrateLegacyEnemies(legacyEnemies);
```

### Level Configuration Compatibility

The new system is compatible with existing level configurations:

```javascript
// Original level config still works
const level1Config = {
  ENEMY_TYPES: ['bear', 'squirrel', 'deer'],
  ENEMY_SPAWN_DENSITY: 0.0001875,
  ENEMY_PROPERTIES: {
    'bear': { speed: 8.0, aggroRadius: 40.0 },
    'squirrel': { speed: 12.0, aggroRadius: 20.0 },
    'deer': { speed: 10.0, aggroRadius: 36.0 }
  }
};
```

## Performance Guidelines

### Recommended Limits

- **Maximum enemies per chunk**: 8
- **Total active enemies**: 32
- **Update frequency**: 60 FPS (16.67ms budget)
- **Detection range**: Auto-adjusted based on performance

### Mobile Optimization

```typescript
// The system automatically optimizes for mobile:
// - Reduces AI update frequency on slower devices
// - Simplifies pathfinding algorithms
// - Adjusts detection ranges
// - Uses spatial partitioning for efficiency

// Manual performance control
if (isMobileDevice()) {
  ai.setDifficulty(0.8); // Slightly easier for performance
}
```

## Best Practices

### 1. Enemy Placement

```typescript
// Good: Spread enemies out
const bear1 = ai.createEnemies.bear({ x: 100, y: 0, z: 50 });
const bear2 = ai.createEnemies.bear({ x: 150, y: 0, z: 100 });

// Bad: Too many enemies in one spot (performance impact)
for (let i = 0; i < 10; i++) {
  ai.createEnemies.bear({ x: 100, y: 0, z: 50 });
}
```

### 2. Pack Management

```typescript
// Good: Reasonable pack sizes
const smallPack = ai.createEnemies.coyotePack(position, 3);
const mediumPack = ai.createEnemies.coyotePack(position, 4);

// Bad: Huge packs (performance impact)
const hugePack = ai.createEnemies.coyotePack(position, 20);
```

### 3. Level Design

```typescript
// Good: Balanced enemy distribution
const forestConfig = {
  ENEMY_TYPES: ['bear', 'squirrel', 'deer'],
  ENEMY_SPAWN_DENSITY: 0.0002, // Reasonable density
  // ...
};

// Bad: Too high density
const laggyConfig = {
  ENEMY_SPAWN_DENSITY: 0.01, // Will cause performance issues
  // ...
};
```

## Troubleshooting

### Common Issues

#### 1. Enemies Not Moving
```typescript
// Check if AI is paused
ai.handlePlayerEvents.pause(false);

// Check enemy health
const enemy = entity.components.get('enemy');
if (enemy.isDead || !enemy.isActive) {
  // Enemy is dead or inactive
}
```

#### 2. Performance Issues
```typescript
// Monitor performance
const metrics = ai.debug.getPerformanceMetrics();
if (metrics.averageUpdateTime > 16.67) {
  console.warn('AI performance issues detected');
  
  // Reduce enemy count or difficulty
  ai.setDifficulty(0.8);
}
```

#### 3. Enemies Not Detecting Player
```typescript
// Check invisibility status
ai.handlePlayerEvents.invisibility(false);

// Check debug mode for detection visualization
ai.debug.setDebugMode(true);
```

### Debug Commands

```typescript
// System status
ai.debug.logStatus();

// Performance check
console.log(ai.debug.getPerformanceMetrics());

// AI state dump
console.table(ai.debug.getAIStates());

// Clear all enemies (emergency reset)
ai.debug.clearAllEnemies();
```

## API Reference

See the [AI System API Documentation](./ai-api.md) for complete method signatures and parameters.

## Examples

Complete examples are available in:
- `src/examples/AISystemDemo.ts` - Comprehensive demo
- `tests/unit/ai/AISystem.test.ts` - Unit tests with usage examples

## Changelog

### v2.0.0 - Complete Rewrite
- Modern ECS architecture
- All 6 original enemy types faithfully recreated
- Advanced AI behaviors and coordination
- Mobile optimization
- Performance monitoring
- Comprehensive testing

### Migration from v1.x
See [Migration Guide](./ai-migration.md) for upgrading from the legacy enemy system.