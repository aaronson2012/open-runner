# System Patterns: Open Runner

This document outlines the key architectural and design patterns used in the Open Runner project.

## Core Architecture

The game follows a **Manager-based architecture**. Different aspects of the game are handled by dedicated manager modules, which promotes separation of concerns and modularity.

### Key Managers:
- **`Game`**: The central orchestrator, holding references to all managers and driving the main game loop.
- **`GameStateManager`**: A state machine that controls the overall flow of the game (e.g., `TITLE`, `PLAYING`, `PAUSED`, `GAME_OVER`).
- **`LevelManager`**: Manages loading, unloading, and providing configuration for different game levels.
- **`ChunkManager`**: Handles the procedural generation, loading, and unloading of world chunks to create the endless terrain. It is responsible for managing the objects and enemies within each chunk.
- **`EnemyManager`**: Manages the lifecycle of all enemies, including their creation, updates (AI), and removal.
- **`CollisionManager`**: Detects and handles collisions between the player and other game objects.
- **`AssetManager`**: Loads and provides access to shared assets like geometries and materials.
- **`AudioManager`**: Manages all audio playback, including background music and sound effects.
- **`CameraManager`**: Controls the game's camera, including following the player and handling transitions.
- **`UIManager` (Group)**: A collection of UI-specific managers (`MenuManager`, `HUDManager`, etc.) that handle different parts of the user interface.

## Design Patterns

- **Singleton / Module Pattern**: Many managers (like `GameStateManager`, `EventBus`, `AssetManager`) are implemented as single instances that are imported and used across the application. This provides a global access point to their functionality.
- **Event Bus**: The `EventBus` facilitates decoupled communication between different parts of the system. Managers and components can emit events (e.g., `playerDied`, `scoreChanged`) and subscribe to events without having direct dependencies on each other.
- **Component-Based Architecture**: Game objects, like the `Tumbleweed`, are designed with a component-based approach. They are composed of smaller, reusable components (e.g., `PhysicsComponent`, `TumbleweedAIComponent`) that encapsulate specific behaviors.
- **Object Pooling**: Although not explicitly implemented as a generic pool manager, the `EnemyManager` and `ChunkManager` manage the lifecycle of enemies and objects, which is a form of object pooling to reuse objects and improve performance.
- **Factory Pattern**: The `ModelFactory` is used to create complex 3D models for game entities (e.g., `createBearModel`, `createCactusSaguaroModel`). This encapsulates the model creation logic and separates it from the entity classes themselves.
- **Procedural Generation**: The terrain and object placement are generated procedurally based on a seed, using Perlin noise for the terrain height and a random number generator for object distribution within chunks. This ensures that each run is unique but repeatable if the same seed is used.
- **State Pattern**: The `GameStateManager` implements the State pattern to manage the different states of the game. The behavior of the game loop and other systems changes based on the current state.

## Data Flow

1.  **Initialization**: `main.js` kicks off the process. `Game` is instantiated, and `gameInitializer.js` sets up all the managers and core components.
2.  **Game Loop**: The `Game.animate()` method is the heart of the application. It runs on every frame.
3.  **State-Driven Updates**: Inside the loop, the `GameStateManager`'s current state determines what logic is executed.
4.  **Gameplay Update**: In the `PLAYING` state, `gameplayUpdater.js` is called, which in turn updates the `PlayerController`, `ChunkManager`, `EnemyManager`, etc.
5.  **User Input**: `controlsSetup.js` listens for user input and updates state variables (e.g., `keyLeftPressed`). The `PlayerController` reads these variables to move the player.
6.  **Events**: Interactions and state changes are communicated via the `EventBus`. For example, a collision detected by the `CollisionManager` might result in a `playerDied` event, which is then handled by `eventHandlerSetup.js` to trigger the game-over sequence. 