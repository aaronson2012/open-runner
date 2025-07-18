# Open Runner Testing Suite

This directory contains a comprehensive testing suite for the Open Runner 3D endless runner game. The test suite covers all major components and systems of the game with 188 test cases across multiple categories.

## Test Structure

```
tests/
├── setup.js              # Test environment configuration and mocks
├── setup.test.js          # Test environment validation
├── core/                  # Core game system tests
│   ├── eventBus.test.js      # Event system communication
│   └── gameStateManager.test.js # Game state transitions
├── utils/                 # Utility function tests
│   ├── mathUtils.test.js     # Mathematical operations
│   ├── deviceUtils.test.js   # Device detection and mobile controls
│   └── debounce.test.js      # Function debouncing utility
├── managers/              # Game manager tests
│   ├── scoreManager.test.js     # Score tracking and high scores
│   └── collisionManager.test.js # Collision detection and response
├── physics/               # Physics system tests
│   └── PhysicsComponent.test.js # Physics simulation and forces
└── integration/           # Integration and end-to-end tests
    └── gameFlow.test.js      # Complete game flow scenarios
```

## Test Categories

### 1. Core Game Systems (55 tests)
- **Event Bus (24 tests)**: Event subscription, emission, error handling
- **Game State Manager (31 tests)**: State transitions, request handling, history management

### 2. Utility Functions (34 tests)
- **Math Utils (15 tests)**: Clamping, random ranges, smooth damping
- **Device Utils (12 tests)**: Mobile detection, device classes, control visibility
- **Debounce (7 tests)**: Function debouncing with timing and arguments

### 3. Manager Systems (43 tests)
- **Score Manager (26 tests)**: Score tracking, high scores, level unlocking, localStorage persistence
- **Collision Manager (17 tests)**: Collision detection, response types, powerup interactions

### 4. Physics System (28 tests)
- **Physics Component**: Force application, velocity management, gravity, friction, collision response

### 5. Integration Tests (23 tests)
- **Game Flow**: Complete gameplay scenarios, state management, event interactions

### 6. Test Environment (5 tests)
- **Setup Validation**: DOM API mocks, WebGL context, localStorage simulation

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### UI Test Runner
```bash
npm run test:ui
```

### Specific Test Files
```bash
npm test tests/core/
npm test tests/utils/mathUtils.test.js
npm test tests/integration/gameFlow.test.js
```

## Test Framework

- **Framework**: Vitest (modern, fast test runner with ES6 module support)
- **Environment**: happy-dom (lightweight DOM simulation)
- **Mocking**: Built-in Vitest mocking capabilities
- **Coverage**: V8 code coverage provider

## Key Features Tested

### Game Mechanics
- ✅ Score collection and tracking
- ✅ Powerup effects (magnet, doubler, invisibility)
- ✅ Collision detection (coins, obstacles, powerups)
- ✅ Level progression and unlocking
- ✅ Game state transitions (playing, paused, game over)

### Physics System
- ✅ Force and impulse application
- ✅ Gravity and friction simulation
- ✅ Collision response and separation
- ✅ Velocity and acceleration management

### Event System
- ✅ Event subscription and emission
- ✅ Error handling in event listeners
- ✅ Event bus communication between components

### Utility Functions
- ✅ Mathematical operations (clamping, smoothing)
- ✅ Device detection (mobile vs desktop)
- ✅ Function debouncing and timing

### Data Persistence
- ✅ High score storage and retrieval
- ✅ Level unlock state management
- ✅ Session score tracking

## Mock Strategy

The test suite uses comprehensive mocking to isolate components:

- **Browser APIs**: Canvas, WebGL, localStorage, navigator
- **Three.js**: Vector3, Mesh, Scene objects
- **Game Dependencies**: Managers, event bus, loggers
- **External Libraries**: CDN-loaded modules

## Coverage Goals

The testing suite aims for high coverage in critical areas:
- ✅ Core game logic: 100% coverage target
- ✅ Manager systems: 90%+ coverage target
- ✅ Utility functions: 100% coverage target
- ✅ Integration flows: Key scenarios covered

## Test Quality Features

- **Isolated Tests**: Each test runs in isolation with fresh mocks
- **Realistic Scenarios**: Integration tests simulate actual gameplay
- **Error Handling**: Tests verify graceful error handling
- **Edge Cases**: Boundary conditions and invalid inputs tested
- **Performance**: Physics and collision tests verify performance characteristics

## Adding New Tests

When adding new features to the game:

1. **Unit Tests**: Add tests for individual functions/classes
2. **Integration Tests**: Add scenarios to `gameFlow.test.js`
3. **Mocks**: Update mocks in `setup.js` if needed
4. **Coverage**: Ensure new code has appropriate test coverage

### Test File Template
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ComponentName', () => {
  let component;

  beforeEach(() => {
    component = new ComponentName();
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle edge case', () => {
      // Test implementation
    });
  });
});
```

## Continuous Integration

The test suite is designed to run in CI environments with:
- ✅ Fast execution (< 3 seconds total)
- ✅ No external dependencies
- ✅ Comprehensive coverage reporting
- ✅ Clear failure reporting

## Testing Philosophy

This test suite follows these principles:
- **Comprehensive**: Tests cover all critical game functionality
- **Fast**: Tests run quickly for rapid development feedback
- **Reliable**: Tests are deterministic and don't depend on timing
- **Maintainable**: Clear structure and good documentation
- **Realistic**: Integration tests reflect actual usage patterns

The goal is to provide confidence that the Open Runner game works correctly across all its systems and interactions.