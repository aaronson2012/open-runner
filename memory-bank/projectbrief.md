# Project Brief: Open Runner

Open Runner is a 3D endless runner game built with Three.js. The player controls a character that runs through a procedurally generated world, avoiding obstacles and enemies, and collecting coins to increase their score. The game features multiple levels, increasing difficulty, and power-ups.

## Core Features

- **Procedural Terrain Generation**: Every run is unique, with dynamically generated terrain.
- **Multiple Environments**: The game includes at least two levels: a forest and a desert, each with unique obstacles and enemies.
- **Increasing Difficulty**: The player's speed increases over time, making the game more challenging.
- **Collectibles and Power-ups**: Players can collect coins for score and find power-ups like magnets to aid in collection.
- **Enemies**: The game features various enemies with different behaviors.
- **Mobile and Desktop Support**: The game is playable on both desktop and mobile devices.
- **Performance Settings**: Users can adjust quality settings to match their device's capabilities.

## Technical Stack

- **Rendering Engine**: Three.js
- **Language**: JavaScript (ES6+ Modules)
- **Architecture**: Component-based architecture with managers for different systems (audio, assets, etc.).
- **Physics**: Simple custom physics engine with collision detection.

## Project Structure

The project is organized into the following main directories:

- `js/core/`: Core game engine components, including the main game loop, state management, and initialization.
- `js/config/`: Configuration files for various game settings.
- `js/entities/`: Game objects like the player, enemies, and other interactive items.
- `js/managers/`: Managers for handling assets, audio, chunks, collisions, and other systems.
- `js/rendering/`: Code related to 3D rendering, including models and scene setup.
- `js/levels/`: Configuration files for each game level.
- `js/utils/`: Utility functions and helper modules. 