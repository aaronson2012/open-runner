# Technical Context: Open Runner

This document provides an overview of the technologies, development environment, and technical constraints for the Open Runner project.

## Technologies Used

-   **Three.js (r163)**: The core 3D rendering library. The project uses ES6 module imports to access Three.js components.
-   **JavaScript (ES6+)**: The entire codebase is written in modern JavaScript, utilizing features like modules, classes, and const/let.
-   **HTML5 & CSS3**: For the basic page structure, UI elements, and styling.
-   **Simplex Noise**: Used for procedural terrain generation.
-   **Seedrandom**: A seeded random number generator used to ensure procedural generation is repeatable.

## Development Setup

The project is designed to be simple to set up and run.

1.  **No Build Step**: The project uses native browser support for ES6 modules and does not require a build step (like Webpack or Vite) for development.
2.  **Local Web Server**: To run the game, the files must be served by a local web server. This is necessary to handle module loading and avoid CORS issues. Any simple server like `npx serve`, Python's `http.server`, or a VS Code Live Server extension will work.
3.  **Dependencies**: Dependencies like Three.js are loaded via an `importmap` in `index.html`, which points to a CDN (unpkg.com). This avoids the need for a local `node_modules` folder.

## Technical Constraints and Considerations

-   **Performance**: As a browser-based 3D game, performance is a key concern. The following strategies are used to manage performance:
    -   **Chunking**: The world is loaded in chunks, and only chunks within the render distance are visible.
    -   **Level of Detail (LOD)**: Terrain chunks use lower-resolution geometry as they get farther from the camera.
    -   **Object Culling**: The game logic is in place to support frustum culling, where objects outside the camera's view are not rendered.
    -   **Asset Re-use**: `AssetManager` ensures that geometries and materials are shared where possible to reduce memory usage.
    -   **Adaptive Quality Settings**: `performanceManager.js` detects the user's device capabilities and adjusts settings like shadow quality, render distance, and anti-aliasing accordingly.
-   **Browser Compatibility**: The use of ES6 modules and other modern JavaScript features means the game will primarily run on modern browsers (Chrome, Firefox, Safari, Edge).
-   **Mobile Support**: The game includes on-screen touch controls and adaptive performance settings to be playable on mobile devices.
-   **Procedural Audio**: To keep the asset size small, most sound effects are generated procedurally using the Web Audio API rather than using pre-recorded audio files. This is handled by the `AudioManager`.
-   **Code Modularity**: The code is organized into modules with clear responsibilities. This makes it easier to maintain and extend. The use of an `EventBus` further decouples these modules. 