// js/managers/chunkManager.js
import * as THREE from 'three';
// import * as UIManager from './uiManager.js'; // No longer needed directly
import { createTerrainChunk } from '../rendering/terrainGenerator.js';
import { generateObjectsForChunk } from '../generators/objectGenerator.js'; // Still needed for loadChunk
import { createLogger } from '../utils/logger.js';
import { EnemyManager } from './enemyManager.js'; // Needed for constructor check & passing
import objectPoolManager from './objectPoolManager.js'; // Needed for clearAllChunks
import { worldConfig } from '../config/world.js';
import { ChunkContentManager } from './chunkContentManager.js'; // Import the new manager
import { performanceManager } from '../config/config.js'; // For performance settings
import performanceUtils from '../utils/performanceUtils.js'; // For frustum culling
// Removed unused imports: Tumbleweed, AudioManager, AssetManager, eventBus, playerConfig, gameplayConfig, modelsConfig, createObjectVisual, disposeObjectVisual

const logger = createLogger('ChunkManager');

// Removed unused constant: playerCollisionRadius

export class ChunkManager {
    constructor(scene, enemyManager, spatialGrid, initialLevelConfig = null) {
        if (!scene || !enemyManager || !spatialGrid) {
            throw new Error("ChunkManager requires scene, EnemyManager, and SpatialGrid instances!");
        }
        this.levelConfig = initialLevelConfig;
        this.scene = scene;
        this.enemyManager = enemyManager;
        this.spatialGrid = spatialGrid;
        this.chunkSize = worldConfig.CHUNK_SIZE;
        this.renderDistance = worldConfig.RENDER_DISTANCE_CHUNKS;
        this.loadedChunks = new Map(); // Stores { terrainMesh, objects: objectDataArray, contentManagerData: { ... } }
        this.lastCameraChunkX = null;
        this.lastCameraChunkZ = null;

        // Instantiate the content manager, passing dependencies
        this.contentManager = new ChunkContentManager({
            scene: this.scene,
            enemyManager: this.enemyManager,
            spatialGrid: this.spatialGrid,
            objectPoolManager: objectPoolManager,
            levelConfig: this.levelConfig,
            getChunkDataCallback: this.getChunkData.bind(this),
            chunkManager: this // Pass self-reference
        });

        // Async Loading Queues
        this.chunksToLoadQueue = new Set();
        this.chunksToUnloadQueue = new Set();
        this.processingQueues = false;
    }

    /**
     * Sets the level configuration for both ChunkManager and ChunkContentManager.
     * @param {object} config - The level configuration object.
     */
    setLevelConfig(config) {
        logger.info("Setting level config for ChunkManager and ContentManager.");
        this.levelConfig = config;
        this.contentManager.setLevelConfig(config);
    }

     /**
     * Sets the scene reference for both ChunkManager and ChunkContentManager.
     * @param {THREE.Scene} scene - The new scene instance.
     */
     setScene(scene) {
        if (!scene) {
            logger.error("Attempted to set invalid scene in ChunkManager.");
            return;
        }
        this.scene = scene;
        this.contentManager.scene = scene;
        logger.info("ChunkManager scene updated.");
    }

    /**
     * Retrieves the data associated with a specific chunk key.
     * @param {string} chunkKey - The key of the chunk (e.g., "0,0").
     * @returns {object | undefined} The chunk data object or undefined if not found.
     */
    getChunkData(chunkKey) {
        return this.loadedChunks.get(chunkKey);
    }


    // Calculates the chunk coordinates a position (e.g., player) is currently in
    getPositionChunkCoords(position) {
        if (!position || isNaN(position.x) || isNaN(position.z)) {
            logger.warn(`[ChunkManager] Invalid position provided to getPositionChunkCoords:`, position);
            return { chunkX: null, chunkZ: null };
        }
        const chunkX = Math.floor(position.x / this.chunkSize);
        const chunkZ = Math.floor(position.z / this.chunkSize);
        return { chunkX, chunkZ };
    }

    // Main update function, called every frame - determines which chunks to load/unload
    update(playerPosition) {
        const { chunkX: currentChunkX, chunkZ: currentChunkZ } = this.getPositionChunkCoords(playerPosition);

        if (currentChunkX === null || currentChunkZ === null) {
            logger.warn("[ChunkManager] Skipping update due to invalid player position.");
            return;
        }

        if (currentChunkX !== this.lastCameraChunkX || currentChunkZ !== this.lastCameraChunkZ || this.lastCameraChunkX === null) {
            this.lastCameraChunkX = currentChunkX;
            this.lastCameraChunkZ = currentChunkZ;

            const chunksToLoad = new Set();
            const currentlyLoadedKeys = new Set(this.loadedChunks.keys());

            // Determine required chunks
            for (let x = currentChunkX - this.renderDistance; x <= currentChunkX + this.renderDistance; x++) {
                for (let z = currentChunkZ - this.renderDistance; z <= currentChunkZ + this.renderDistance; z++) {
                    const key = `${x},${z}`;
                    chunksToLoad.add(key);
                    if (!this.loadedChunks.has(key) && !this.chunksToLoadQueue.has(key)) {
                        this.chunksToLoadQueue.add(key);
                        this.chunksToUnloadQueue.delete(key);
                    }
                }
            }

            // Determine chunks to unload
            for (const loadedKey of currentlyLoadedKeys) {
                if (!chunksToLoad.has(loadedKey) && !this.chunksToUnloadQueue.has(loadedKey)) {
                    this.chunksToUnloadQueue.add(loadedKey);
                    this.chunksToLoadQueue.delete(loadedKey);
                }
            }

            this.scheduleQueueProcessing();
        }
    }

    // --- Async Queue Processing ---

    scheduleQueueProcessing() {
        if (this.processingQueues || (this.chunksToLoadQueue.size === 0 && this.chunksToUnloadQueue.size === 0)) {
            return;
        }
        this.processingQueues = true;
        requestAnimationFrame(() => this.processNextChunkInQueue());
    }

    async processNextChunkInQueue() {
        if (this.chunksToUnloadQueue.size > 0) {
            const keyToUnload = this.chunksToUnloadQueue.values().next().value;
            this.chunksToUnloadQueue.delete(keyToUnload);
            this.unloadChunk(keyToUnload);
        }
        else if (this.chunksToLoadQueue.size > 0) {
            const keyToLoad = this.chunksToLoadQueue.values().next().value;
            this.chunksToLoadQueue.delete(keyToLoad);
            const [chunkX, chunkZ] = keyToLoad.split(',').map(Number);
            await this.loadChunk(chunkX, chunkZ);
        }

        if (this.chunksToLoadQueue.size > 0 || this.chunksToUnloadQueue.size > 0) {
             requestAnimationFrame(() => this.processNextChunkInQueue());
        } else {
            this.processingQueues = false;
            logger.debug("Chunk load/unload queues processed.");
        }
    }

    // --- Load/Unload Logic ---

    async loadChunk(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        if (this.loadedChunks.has(key)) {
            logger.warn(`Attempted to load chunk ${key} which is already loaded.`);
            return;
        }
        try {
            if (!this.levelConfig) {
                throw new Error(`Cannot load chunk ${key}, levelConfig is not set!`);
            }
            
            // Get current performance settings
            const perfSettings = performanceManager.getSettings();

            // 1. Create Terrain
            const terrainMesh = createTerrainChunk(chunkX, chunkZ, this.levelConfig);
            
            // Apply performance optimizations to terrain
            if (perfSettings.useStaticObjects) {
                // Disable matrix auto-updates for static terrain
                terrainMesh.matrixAutoUpdate = perfSettings.matrixAutoUpdates;
                terrainMesh.updateMatrix(); // Pre-compute the matrix since it won't auto-update
                
                // Mark terrain for frustum culling
                terrainMesh.userData.needsBoundsUpdate = true;
            }
            
            this.scene.add(terrainMesh);

            // 2. Generate Object Data
            const objectDataArray = generateObjectsForChunk(chunkX, chunkZ, this.levelConfig);
            
            // Create chunk data structure to be populated
            const chunkData = {
                terrainMesh: terrainMesh,
                objects: objectDataArray,
                contentManagerData: null
            };
            
            // Store early to avoid duplicate loading
            this.loadedChunks.set(key, chunkData);

            // Check if we need to delay object creation for performance
            const objectLoadDelay = perfSettings.objectLoadDelay || 0;
            
            if (objectLoadDelay > 0) {
                // Delay creating objects to avoid frame drops
                setTimeout(() => {
                    // Double-check chunk is still needed before creating objects
                    if (this.loadedChunks.has(key)) {
                        try {
                            // 3. Load Content using Content Manager (now back to sync)
                            const contentManagerData = this.contentManager.loadContent(key, objectDataArray);
                            // Update the chunk data with content
                            chunkData.contentManagerData = contentManagerData;
                        } catch (error) {
                            logger.error(`Error in delayed content loading for chunk ${key}:`, error);
                        }
                    }
                }, objectLoadDelay);
                
                return chunkData;
            }
            
            // 3. Load Content immediately using Content Manager (now back to sync)
            const contentManagerData = this.contentManager.loadContent(key, objectDataArray);
            
            // Update the chunk data with content
            chunkData.contentManagerData = contentManagerData;
            
            return chunkData;

        } catch (error) {
            const errorMsg = `Error loading chunk ${key}: ${error.message}`;
            // UIManager.displayError(new Error(`[ChunkManager] ${errorMsg}`)); // UIManager removed
            logger.error(errorMsg, error);
        }
    }

    unloadChunk(key) {
        const chunkData = this.loadedChunks.get(key);
        if (chunkData) {
            // 1. Unload Terrain Mesh
            if (chunkData.terrainMesh) {
                this.scene.remove(chunkData.terrainMesh);
                chunkData.terrainMesh.geometry?.dispose();
                if (chunkData.terrainMesh.material) {
                    if (Array.isArray(chunkData.terrainMesh.material)) {
                        chunkData.terrainMesh.material.forEach(material => material?.dispose());
                    } else {
                        chunkData.terrainMesh.material.dispose();
                    }
                }
            }

            // 2. Unload Content using Content Manager
            this.contentManager.unloadContent(chunkData);

            // 3. Remove from loaded chunks map
            this.loadedChunks.delete(key);
        } else {
             logger.warn(`Attempted to unload chunk ${key} which was not found in loaded chunks.`);
        }
    }

    // --- Helper Methods ---

    getTerrainMeshesNear(position) {
        const { chunkX: centerChunkX, chunkZ: centerChunkZ } = this.getPositionChunkCoords(position);
        const nearbyMeshes = [];
        for (let x = centerChunkX - 1; x <= centerChunkX + 1; x++) {
            for (let z = centerChunkZ - 1; z <= centerChunkZ + 1; z++) {
                const key = `${x},${z}`;
                const chunkData = this.loadedChunks.get(key);
                if (chunkData && chunkData.terrainMesh) {
                    nearbyMeshes.push(chunkData.terrainMesh);
                }
            }
        }
        return nearbyMeshes;
    } // <-- Added missing closing brace
    /**
     * Loads the initial set of chunks around the starting position.
     * @param {Function} [progressCallback] - Optional callback for loading progress (loaded, total).
     */
    async loadInitialChunks(progressCallback) {
        const startChunkX = 0;
        const startChunkZ = 0;
        // Use renderDistance from instance property
        const initialLoadRadius = this.renderDistance;
        logger.info(`Initial load radius set to: ${initialLoadRadius}`);

        const chunksToLoadInitially = [];
        for (let x = startChunkX - initialLoadRadius; x <= startChunkX + initialLoadRadius; x++) {
            for (let z = startChunkZ - initialLoadRadius; z <= startChunkZ + initialLoadRadius; z++) {
                chunksToLoadInitially.push({ x, z });
            }
        }

        const totalChunks = chunksToLoadInitially.length;
        let loadedCount = 0;

        if (progressCallback) progressCallback(loadedCount, totalChunks);

        // Process chunks with async loadChunk
        for (const chunkCoords of chunksToLoadInitially) {
             const key = `${chunkCoords.x},${chunkCoords.z}`;
             if (!this.loadedChunks.has(key)) {
                 try {
                     await this.loadChunk(chunkCoords.x, chunkCoords.z); // Call the async instance method
                 } catch (error) {
                     const errorMsg = `Error during initial load of chunk ${key}: ${error.message}`;
                     logger.error(errorMsg, error);
                 }
             } else {
                 logger.warn(`Chunk ${key} was already loaded (unexpected during initial load).`);
             }
             loadedCount++;
             // Update progress after each chunk load attempt
             if (progressCallback) progressCallback(loadedCount, totalChunks);
        }

        this.lastCameraChunkX = startChunkX;
        this.lastCameraChunkZ = startChunkZ;
        logger.info("Initial chunks loading process complete.");
    }
    // --- Content Management Delegation ---

    collectObject(chunkKey, objectIndex) {
        return this.contentManager.collectObject(chunkKey, objectIndex);
    }

    updateCollectibles(deltaTime, elapsedTime, playerPosition, playerPowerup) {
        this.contentManager.updateCollectibles(this.loadedChunks, deltaTime, elapsedTime, playerPosition, playerPowerup);
    }

    updateTumbleweeds(deltaTime, elapsedTime, playerPosition) {
        this.contentManager.updateTumbleweeds(this.loadedChunks, deltaTime, elapsedTime, playerPosition);
    }

    // --- Cleanup ---

    /**
     * Gets the number of currently loaded chunks.
     * @returns {number} The count of loaded chunks.
     */
    getLoadedChunksCount() {
        return this.loadedChunks.size;
    }

    /**
     * Clears all loaded chunks and their content.
     * Used during level transitions.
     */
    clearAllChunks() {
        logger.info(`Clearing all ${this.loadedChunks.size} loaded chunks...`);
        this.chunksToLoadQueue.clear();
        this.chunksToUnloadQueue.clear();
        this.processingQueues = false;

        const keysToUnload = [...this.loadedChunks.keys()];
        keysToUnload.forEach(key => {
            this.unloadChunk(key);
        });

        if (this.loadedChunks.size > 0) {
            logger.warn(`loadedChunks map not empty after clearAllChunks. Size: ${this.loadedChunks.size}`);
            this.loadedChunks.clear();
        }

        objectPoolManager.clearPools(); // Use imported singleton directly

        this.lastCameraChunkX = null;
        this.lastCameraChunkZ = null;
        logger.info("All chunks and pools cleared.");
    }
}