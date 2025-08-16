// js/managers/chunkContentManager.js
import * as THREE from 'three';
// import * as UIManager from './uiManager.js'; // Removed unused import
import { createLogger } from '../utils/logger.js';
import Tumbleweed from '../entities/gameObjects/Tumbleweed.js';
import * as AudioManager from './audioManager.js';
import * as AssetManager from './assetManager.js'; // Needed for tree repair
import * as ModelFactory from '../rendering/modelFactory.js'; // Needed for creating visuals
import { createObjectVisual } from '../generators/objectGenerator.js'; // Removed unused disposeObjectVisual import
import { gameplayConfig } from '../config/gameplay.js'; // Needed for collection/magnet logic
import { playerConfig } from '../config/player.js'; // Needed for collection logic
import eventBus from '../core/eventBus.js'; // Needed for scoreChanged event in updateCollectibles
import { modelsConfig as C_MODELS } from '../config/models.js'; // Needed for tree configuration
import { noise2D } from '../rendering/terrainGenerator.js'; // Needed for terrain height calculation
import { performanceManager } from '../config/config.js'; // For performance settings
import performanceUtils from '../utils/performanceUtils.js'; // For frustum culling

const logger = createLogger('ChunkContentManager');

// Collision constants
const playerCollisionRadius = playerConfig.TORSO_WIDTH;

export class ChunkContentManager {
    /**
     * Manages the non-terrain content within chunks (objects, enemies, dynamic elements).
     * @param {object} options - Dependencies for the manager.
     * @param {THREE.Scene} options.scene - The main scene to add/remove objects from.
     * @param {EnemyManager} options.enemyManager - The EnemyManager instance for spawning/removing enemies.
     * @param {SpatialGrid} options.spatialGrid - The spatial grid for collision detection.
     * @param {ObjectPoolManager} options.objectPoolManager - The ObjectPoolManager instance.
     * @param {ChunkManager} options.chunkManager - The ChunkManager instance (needed for enemy spawning).
     * @param {object} options.levelConfig - The current level's configuration.
     * @param {Function} options.getChunkDataCallback - Callback to get chunk data from ChunkManager.
     */
    constructor(options) {
        if (!options.scene || !options.enemyManager || !options.spatialGrid || !options.objectPoolManager || !options.chunkManager || !options.getChunkDataCallback) {
            throw new Error("ChunkContentManager requires scene, enemyManager, spatialGrid, objectPoolManager, chunkManager, and getChunkDataCallback!");
        }
        this.scene = options.scene;
        this.enemyManager = options.enemyManager;
        this.spatialGrid = options.spatialGrid;
        this.objectPoolManager = options.objectPoolManager;
        this.chunkManager = options.chunkManager; // Store chunkManager reference
        this.levelConfig = options.levelConfig;
        this.getChunkData = options.getChunkDataCallback;

        logger.info("ChunkContentManager instantiated");
    }

    /**
     * Sets the level configuration.
     * @param {object} config - The level configuration object.
     */
    setLevelConfig(config) {
        logger.info("Setting level config for ChunkContentManager.");
        this.levelConfig = config;
    }

    /**
     * Loads and populates the content (objects, enemies) for a specific chunk.
     * @param {string} chunkKey - The key identifying the chunk (e.g., "0,0").
     * @param {Array<object>} objectDataArray - Array of data generated for objects in this chunk.
     * @returns {{collectibles: THREE.Mesh[], collidables: THREE.Mesh[], enemies: Enemy[], tumbleweeds: Tumbleweed[]}} - References to the created content.
     */
    _loadEnemy(objectData, chunkKey, enemiesArray) {
        const enemyInstance = this.enemyManager.spawnEnemy(objectData.type, objectData, this.chunkManager, this.levelConfig);
        if (enemyInstance) {
            enemiesArray.push(enemyInstance);
            objectData.enemyInstance = enemyInstance; // Used by unloadContent
        } else {
            logger.error(`Failed to spawn enemy instance for type ${objectData.type} in chunk ${chunkKey}`);
        }
    }

    _loadTumbleweed(objectData, chunkKey, tumbleweedsArray, index) {
        let tumbleweed = this.objectPoolManager.getFromPool('tumbleweeds');
        if (!tumbleweed) {
            tumbleweed = new Tumbleweed({
                position: objectData.position || new THREE.Vector3(0, 0, 0),
                scale: objectData.scale?.x ?? 1,
                scene: this.scene,
                levelConfig: this.levelConfig
            });
        } else {
            if (tumbleweed.object3D) {
                if (objectData.position) tumbleweed.object3D.position.copy(objectData.position);
                tumbleweed.object3D.rotation.set(0, 0, 0);
                const scale = objectData.scale?.x ?? 1;
                tumbleweed.object3D.scale.set(scale, scale, scale);
                if (tumbleweed.object3D.parent !== this.scene) this.scene.add(tumbleweed.object3D);
                tumbleweed.object3D.visible = true;
            }
            if (typeof tumbleweed.reset === 'function') tumbleweed.reset();
        }
        tumbleweed.object3D.userData.chunkKey = chunkKey;
        tumbleweed.object3D.userData.objectIndex = index;
        tumbleweed.object3D.userData.objectType = 'tumbleweed';
        tumbleweed.object3D.userData.gameObject = tumbleweed;
        tumbleweed.object3D.name = `tumbleweed_${chunkKey}_${index}`;
        tumbleweedsArray.push(tumbleweed);
        this.spatialGrid.add(tumbleweed.object3D);
        objectData.gameObject = tumbleweed; // Used by unloadContent indirectly
        objectData.mesh = tumbleweed.object3D; // Used by unloadContent
    }

    _positionDesertRock(mesh) {
        const pos = mesh.position;
        const terrainY = noise2D(
            pos.x * this.levelConfig.NOISE_FREQUENCY,
            pos.z * this.levelConfig.NOISE_FREQUENCY
        ) * this.levelConfig.NOISE_AMPLITUDE;
        const verticalOffset = 0.6;
        mesh.position.y = terrainY + verticalOffset;
        mesh.userData.objectType = 'rock_desert';
        mesh.userData.stayAlignedWithTerrain = true;
        mesh.userData.verticalOffset = verticalOffset;
        logger.debug(`Positioned rock_desert at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) with y=${mesh.position.y.toFixed(2)}`);
    }

    _loadStandardObject(objectData, chunkKey, collectibleMeshesArray, collidableMeshesArray, index) {
        let mesh;
        const poolName = objectData.collidable ? 'obstacles' : 'collectibles';
        
        mesh = this.objectPoolManager.getFromPool(poolName, objectData.type);
        let meshNeedsTransformReset = !!mesh;

        if (!mesh) {
            meshNeedsTransformReset = false;
            try {
                const createdVisual = createObjectVisual(objectData, this.levelConfig);
                if (createdVisual && createdVisual instanceof Promise) {
                    logger.warn(`Unexpected Promise for standard object: ${objectData.type} at index ${index}. This object will not be loaded.`);
                    return;
                } else if (createdVisual) {
                    mesh = createdVisual;
                }
            } catch (error) {
                logger.error(`Error creating visual for object type ${objectData.type} at index ${index}:`, error);
            }
        }

        if (mesh) {
            if (meshNeedsTransformReset) {
                if (objectData.position) mesh.position.copy(objectData.position);
                
                if (objectData.type === 'log_fallen') {
                    mesh.rotation.set(Math.PI / 2, objectData.rotationY ?? 0, 0);
                    mesh.userData.isRotatedLog = true;
                    mesh.userData.initialRotationX = Math.PI / 2;
                } else {
                    mesh.rotation.set(0, objectData.rotationY ?? 0, 0);
                }
                
                mesh.scale.set(objectData.scale?.x ?? 1, objectData.scale?.y ?? 1, objectData.scale?.z ?? 1);
                mesh.visible = true;
            }

            mesh.userData.chunkKey = chunkKey;
            mesh.userData.objectIndex = index;
            mesh.userData.objectType = objectData.type;
            mesh.name = `${objectData.type}_${chunkKey}_${index}`;
            
            if (mesh.parent !== this.scene) this.scene.add(mesh);
            objectData.mesh = mesh; // Used by unloadContent

            if (objectData.collidable) {
                collidableMeshesArray.push(mesh);
                if (objectData.type === 'rock_desert') {
                    this._positionDesertRock(mesh);
                }
            } else {
                collectibleMeshesArray.push(mesh);
            }
            this.spatialGrid.add(mesh);
        }
    }

    /**
     * Applies common visual and metadata properties to a tree mesh.
     * @param {THREE.Mesh} mesh - The tree mesh.
     * @param {object} objectData - The data for the tree object.
     * @param {string} chunkKey - The key of the chunk.
     * @param {number} index - The object's index in the chunk.
     * @param {boolean} [isRecreated=false] - Flag if the mesh is a recreated version.
     * @private
     */
    _applyTreeVisualProperties(mesh, objectData, chunkKey, index, isRecreated = false) {
        if (!mesh || !objectData) {
            logger.warn('ChunkContentManager._applyTreeVisualProperties called with null mesh or objectData', { chunkKey, index });
            return;
        }
        if (objectData.position) mesh.position.copy(objectData.position);
        mesh.rotation.set(0, objectData.rotationY ?? 0, 0);
        mesh.scale.set(objectData.scale?.x ?? 1, objectData.scale?.y ?? 1, objectData.scale?.z ?? 1);
        // mesh.visible will be set after finalization by the caller (_loadPineTree)

        mesh.userData.chunkKey = chunkKey;
        mesh.userData.objectIndex = index;
        mesh.userData.objectType = objectData.type; // Should be 'tree_pine'
        mesh.name = `${objectData.type}_${chunkKey}_${index}${isRecreated ? '_recreated' : ''}`;
    }

    /**
     * Ensures a tree mesh is complete (has trunk and foliage), recreating it if necessary.
     * @param {THREE.Mesh} treeToVerify - The initial tree mesh to check (assumed non-null).
     * @param {object} objectData - The data for the tree object.
     * @param {string} chunkKey - The key of the chunk.
     * @param {number} index - The object's index in the chunk.
     * @returns {THREE.Mesh} The finalized, complete tree mesh.
     * @private
     */
    _ensureCompleteTree(treeToVerify, objectData, chunkKey, index) {
        // treeToVerify is assumed to be non-null and to have had _applyTreeVisualProperties called on it.
        let hasTrunk = false, hasFoliage = false;
        const config = C_MODELS.TREE_PINE; // C_MODELS is module-scoped from imports

        treeToVerify.traverse(child => {
            if (child.name === config.TRUNK_NAME) hasTrunk = true;
            if (child.name === config.FOLIAGE_NAME) hasFoliage = true;
        });

        if (hasTrunk && hasFoliage) {
            return treeToVerify; // Tree is complete
        } else {
            logger.warn(`Tree (index: ${index}, name: ${treeToVerify.name}, chunk: ${chunkKey}) from createObjectVisual is incomplete (trunk: ${hasTrunk}, foliage: ${hasFoliage}). Recreating with ModelFactory.`);
            
            // Dispose of the incomplete treeMesh's geometry/materials if it's a new object and not from a pool.
            // This is complex if createObjectVisual might return pooled objects.
            // For now, we assume the incomplete treeToVerify (if not added to scene) will be garbage collected
            // or handled by its original creator/pool if it was from one.

            const recreatedTree = ModelFactory.createTreeMesh();
            this._applyTreeVisualProperties(recreatedTree, objectData, chunkKey, index, true); // Mark as recreated
            return recreatedTree;
        }
    }

    _loadPineTree(objectData, chunkKey, collectibleMeshesArray, collidableMeshesArray, index) {
        createObjectVisual(objectData, this.levelConfig)
            .then(initialMeshFromVisual => {
                let currentTreeMesh;

                if (!initialMeshFromVisual) {
                    logger.warn(`createObjectVisual returned null for tree (chunk: ${chunkKey}, index: ${index}). Attempting fallback creation.`);
                    currentTreeMesh = ModelFactory.createTreeMesh();
                    this._applyTreeVisualProperties(currentTreeMesh, objectData, chunkKey, index, true); // Mark as recreated
                } else {
                    currentTreeMesh = initialMeshFromVisual;
                    this._applyTreeVisualProperties(currentTreeMesh, objectData, chunkKey, index, false); // Standard application
                }

                // Verify the tree (either from createObjectVisual or the first fallback) and recreate if necessary
                const finalTreeMesh = this._ensureCompleteTree(currentTreeMesh, objectData, chunkKey, index);
                
                finalTreeMesh.visible = true; // Set visibility on the finalized mesh

                if (finalTreeMesh.parent !== this.scene) {
                    this.scene.add(finalTreeMesh);
                }
                objectData.mesh = finalTreeMesh; // Used by unloadContent

                if (objectData.collidable) {
                    collidableMeshesArray.push(finalTreeMesh);
                } else {
                    // Trees are typically collidable, but respecting the data if not
                    collectibleMeshesArray.push(finalTreeMesh);
                }
                this.spatialGrid.add(finalTreeMesh);
            })
            .catch(error => {
                logger.error(`Error during initial creation of tree (chunk: ${chunkKey}, index: ${index}): ${error.stack || error}. Attempting fallback creation.`);
                try {
                    const fallbackTree = ModelFactory.createTreeMesh();
                    this._applyTreeVisualProperties(fallbackTree, objectData, chunkKey, index, true); // Mark as recreated
                    
                    // Assuming ModelFactory.createTreeMesh() produces a complete tree,
                    // so _ensureCompleteTree is not strictly needed here but could be added for extreme safety.
                    fallbackTree.visible = true;

                    if (fallbackTree.parent !== this.scene) {
                        this.scene.add(fallbackTree);
                    }
                    objectData.mesh = fallbackTree;

                    if (objectData.collidable) {
                        collidableMeshesArray.push(fallbackTree);
                    } else {
                        collectibleMeshesArray.push(fallbackTree);
                    }
                    this.spatialGrid.add(fallbackTree);
                    logger.info(`Successfully created fallback tree for (chunk: ${chunkKey}, index: ${index}) after promise rejection.`);
                } catch (fallbackError) {
                    logger.error(`CRITICAL: Failed to create even a fallback tree for (chunk: ${chunkKey}, index: ${index}): ${fallbackError.stack || fallbackError}`);
                }
            });
    }

    loadContent(chunkKey, objectDataArray) {
        if (!this.levelConfig) {
            logger.error(`Cannot load content for chunk ${chunkKey}, levelConfig is not set!`);
            return { collectibles: [], collidables: [], enemies: [], tumbleweeds: [] };
        }

        const collectibleMeshes = [];
        const collidableMeshes = [];
        const enemies = [];
        const tumbleweeds = [];

        objectDataArray.forEach((objectData, index) => {
            // objectData.objectIndex is set to `index` by ObjectGenerator
            const enemyTypesForLevel = this.levelConfig?.ENEMY_TYPES || [];

            if (enemyTypesForLevel.includes(objectData.type)) {
                this._loadEnemy(objectData, chunkKey, enemies);
            } else if (objectData.type === 'tumbleweed' && objectData.isDynamic) {
                this._loadTumbleweed(objectData, chunkKey, tumbleweeds, index);
            } else if (objectData.type === 'tree_pine') {
                this._loadPineTree(objectData, chunkKey, collectibleMeshes, collidableMeshes, index);
            } else {
                this._loadStandardObject(objectData, chunkKey, collectibleMeshes, collidableMeshes, index);
            }
        });

        return { collectibles: collectibleMeshes, collidables: collidableMeshes, enemies: enemies, tumbleweeds: tumbleweeds };
    }

    /**
     * Unloads the content (objects, enemies) for a specific chunk.
     * @param {object} chunkData - The data object for the chunk being unloaded.
     */
    unloadContent(chunkData) {
        if (!chunkData) return;

        if (chunkData.objects) {
            chunkData.objects.forEach(objectData => {
                if (!objectData.enemyInstance && objectData.mesh && objectData.type !== 'tumbleweed') {
                    this.scene.remove(objectData.mesh);
                    this.spatialGrid.remove(objectData.mesh);
                    
                    // For trees, completely dispose them instead of pooling
                    if (objectData.type === 'tree_pine') {
                        // Dispose of the tree meshes
                        objectData.mesh.traverse(child => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => mat.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                        logger.debug("Disposed tree completely instead of pooling");
                    } else {
                        // For other object types, use the object pool as normal
                        const poolName = objectData.collidable ? 'obstacles' : 'collectibles';
                        this.objectPoolManager.addToPool(poolName, objectData.mesh);
                    }
                    objectData.mesh = null;
                }
            });
        }

        if (chunkData.contentManagerData?.enemies) { // Use contentManagerData
            chunkData.contentManagerData.enemies.forEach(enemyInstance => {
                this.enemyManager.removeEnemy(enemyInstance);
            });
        }

        if (chunkData.contentManagerData?.tumbleweeds) { // Use contentManagerData
            chunkData.contentManagerData.tumbleweeds.forEach(tumbleweed => {
                this.scene.remove(tumbleweed.object3D);
                this.spatialGrid.remove(tumbleweed.object3D);
                this.objectPoolManager.addToPool('tumbleweeds', tumbleweed);
            });
        }
    }

    /**
     * Handles the collection of an object within a specific chunk.
     * @param {string} chunkKey - The key of the chunk containing the object.
     * @param {number} objectIndex - The index of the object within the chunk's data array.
     * @returns {boolean} True if collection was successful, false otherwise.
     */
    collectObject(chunkKey, objectIndex) {
        const chunkData = this.getChunkData(chunkKey);
        if (chunkData && chunkData.objects && objectIndex >= 0 && objectIndex < chunkData.objects.length) {
            const object = chunkData.objects[objectIndex];
            if (object && !object.collidable && object.mesh && !object.collected) {
                this.spatialGrid.remove(object.mesh);
                this.scene.remove(object.mesh);
                this.objectPoolManager.addToPool('collectibles', object.mesh);

                // Correctly access the collectibles array within contentManagerData
                const collectibleIndex = chunkData.contentManagerData?.collectibles?.indexOf(object.mesh);
                if (collectibleIndex > -1) {
                    chunkData.contentManagerData.collectibles.splice(collectibleIndex, 1);
                } else {
                    logger.warn(`Collected object mesh not found in collectibles list for chunk ${chunkKey}, index ${objectIndex}`);
                }

                object.mesh = null;
                object.collected = true;
                AudioManager.playWaveFile(AudioManager.effectAudioMap['coin']);
                return true;
            } else {
                 logger.warn(`Attempted to collect invalid, collidable, or already collected object: chunk ${chunkKey}, index ${objectIndex}`);
            }
        } else {
            logger.warn(`Attempted to collect coin with invalid chunkKey or objectIndex: chunk ${chunkKey}, index ${objectIndex}`);
        }
        return false;
    }

    /**
     * Updates collectible visuals (spin, magnet effect).
     * @param {Map<string, object>} loadedChunks - Map of currently loaded chunk data.
     * @param {number} deltaTime - Time since last frame.
     * @param {number} elapsedTime - Total elapsed time.
     * @param {THREE.Vector3} playerPosition - Current player position.
     * @param {string} playerPowerup - Current player powerup type.
     */
    updateCollectibles(loadedChunks, deltaTime, elapsedTime, playerPosition, playerPowerup) {
        if (!this.levelConfig || !this.levelConfig.COIN_VISUALS) return;
        const spinSpeed = this.levelConfig.COIN_VISUALS.spinSpeed || 1.0;
        const magnetActive = playerPowerup === gameplayConfig.POWERUP_TYPE_MAGNET;
        const doublerActive = playerPowerup === gameplayConfig.POWERUP_TYPE_DOUBLER;
        const invisibilityActive = playerPowerup === gameplayConfig.POWERUP_TYPE_INVISIBILITY;
        const magnetRadius = gameplayConfig.MAGNET_POWERUP_RADIUS;
        const magnetForce = gameplayConfig.MAGNET_POWERUP_FORCE;

        // Log magnet-related states for debugging
        if (playerPowerup === gameplayConfig.POWERUP_TYPE_MAGNET || magnetActive) { // Log if magnet is supposed to be active or is detected as active
            logger.debug(`[ChunkContentManager] updateCollectibles: playerPowerup: "${playerPowerup}", gameplayConfig.POWERUP_TYPE_MAGNET: "${gameplayConfig.POWERUP_TYPE_MAGNET}"`);
            logger.debug(`[ChunkContentManager] updateCollectibles: magnetActive: ${magnetActive}, magnetRadius: ${magnetRadius}, magnetForce: ${magnetForce}`);
        }

        for (const [key, chunkData] of loadedChunks.entries()) {
            // Use the contentManagerData references for iteration
            const collectibles = chunkData.contentManagerData?.collectibles;
            if (collectibles && collectibles.length > 0) {
                for (let i = collectibles.length - 1; i >= 0; i--) {
                    const collectibleMesh = collectibles[i];
                    if (!collectibleMesh) continue;

                    if (!collectibleMesh.userData.objectType) {
                         if (collectibleMesh.geometry?.type === 'CylinderGeometry') {
                             collectibleMesh.userData.objectType = 'coin';
                         } else if (collectibleMesh.name?.includes('doubler')) {
                             collectibleMesh.userData.objectType = 'doubler';
                         } else if (collectibleMesh.name?.includes('magnet')) {
                             collectibleMesh.userData.objectType = 'magnet';
                         } else if (collectibleMesh.name?.includes('invisbility')) {
                             collectibleMesh.userData.objectType = 'invisibility';
                         } else {
                             collectibleMesh.userData.objectType = 'unknown_collectible';
                         }
                     }

                    // Spin collectibles for visual effect
                    if (collectibleMesh.userData.objectType === 'coin' || 
                        collectibleMesh.userData.objectType === 'magnet' ||
                        collectibleMesh.userData.objectType === 'doubler' ||
                        collectibleMesh.userData.objectType === 'invisibility') {
                        collectibleMesh.rotation.y += spinSpeed * deltaTime;
                    }

                    // Add visual effects for active powerups
                    if (doublerActive && collectibleMesh.userData.objectType === 'coin') {
                        // Optional: Add a visual effect to coins when doubler is active
                        // For example, a subtle pulsing glow effect or color tint
                        if (!collectibleMesh.userData.originalEmissive) {
                            if (collectibleMesh.material) {
                                collectibleMesh.userData.originalEmissive = collectibleMesh.material.emissive?.clone() || new THREE.Color(0x000000);
                                collectibleMesh.material.emissive = new THREE.Color(gameplayConfig.DOUBLER_EFFECT_EMISSIVE);
                            }
                        }
                    } else if (!doublerActive && collectibleMesh.userData.objectType === 'coin' && collectibleMesh.userData.originalEmissive) {
                        // Reset emissive when doubler is not active
                        if (collectibleMesh.material) {
                            collectibleMesh.material.emissive.copy(collectibleMesh.userData.originalEmissive);
                            delete collectibleMesh.userData.originalEmissive;
                        }
                    }

                    // Apply magnet effect if active
                    if (magnetActive && playerPosition && collectibleMesh.userData.objectType === 'coin') {
                        const dx = playerPosition.x - collectibleMesh.position.x;
                        const dy = playerPosition.y - collectibleMesh.position.y;
                        const dz = playerPosition.z - collectibleMesh.position.z;
                        const distanceSq = dx * dx + dy * dy + dz * dz;

                        if (distanceSq < magnetRadius * magnetRadius) {
                            const distance = Math.sqrt(distanceSq);
                            const dirX = dx / distance;
                            const dirY = dy / distance;
                            const dirZ = dz / distance;

                            const normalizedDist = distance / magnetRadius;
                            const acceleration = Math.pow(1 - normalizedDist, 4.0);
                            const moveSpeed = magnetForce * acceleration * deltaTime;

                            const newX = collectibleMesh.position.x + dirX * moveSpeed;
                            const newY = collectibleMesh.position.y + dirY * moveSpeed;
                            const newZ = collectibleMesh.position.z + dirZ * moveSpeed;

                            const newDx = playerPosition.x - newX;
                            const newDy = playerPosition.y - newY;
                            const newDz = playerPosition.z - newZ;
                            const newDistanceSq = newDx * newDx + newDy * newDy + newDz * newDz;

                            const coinCollisionRadius = collectibleMesh.geometry?.parameters?.radiusBottom ?? 0.5;
                            const collectionThresholdSq = (playerCollisionRadius + coinCollisionRadius * gameplayConfig.COIN_COLLECTION_RADIUS_FACTOR) ** 2;
                            const minSafeDistanceSq = (playerCollisionRadius * gameplayConfig.PLAYER_SAFE_DISTANCE_FACTOR) ** 2;

                            const wouldPassThreshold =
                                (distanceSq > collectionThresholdSq && newDistanceSq < collectionThresholdSq) ||
                                (newDistanceSq < minSafeDistanceSq);

                            if (wouldPassThreshold) {
                                const { chunkKey, objectIndex, scoreValue } = collectibleMesh.userData;
                                if (chunkKey !== undefined && objectIndex !== undefined) {
                                    const collected = this.collectObject(chunkKey, objectIndex);
                                    if (collected) {
                                        // Calculate the final score value based on active powerups
                                        const coinValue = scoreValue || gameplayConfig.DEFAULT_COIN_SCORE;
                                        const finalValue = doublerActive ? coinValue * gameplayConfig.DOUBLER_MULTIPLIER : coinValue;
                                        eventBus.emit('scoreChanged', finalValue);
                                        logger.debug(`Collected coin (magnet pull) with final value ${finalValue} (doubler active: ${doublerActive})`);
                                    }
                                }
                            } else if (newDistanceSq > minSafeDistanceSq) {
                                collectibleMesh.position.set(newX, newY, newZ);
                            } else {
                                const safeDistance = Math.sqrt(minSafeDistanceSq);
                                const safeFactor = safeDistance / Math.sqrt(newDistanceSq);
                                collectibleMesh.position.x = playerPosition.x - newDx * safeFactor;
                                collectibleMesh.position.y = playerPosition.y - newDy * safeFactor;
                                collectibleMesh.position.z = playerPosition.z - newDz * safeFactor;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Updates all active Tumbleweeds and terrain-aligned objects.
     * @param {Map<string, object>} loadedChunks - Map of currently loaded chunk data.
     * @param {number} deltaTime - Time since last frame.
     * @param {number} elapsedTime - Total elapsed time.
     * @param {THREE.Vector3} playerPosition - Current player position.
     */
    updateTumbleweeds(loadedChunks, deltaTime, elapsedTime, playerPosition) {
        // Static counter to track frames for rock updates
        if (!this._rockUpdateCounter) this._rockUpdateCounter = 0;
        this._rockUpdateCounter++;

        // Update rocks every frame to ensure they stay above ground
        const updateRocksThisFrame = true;

        for (const [key, chunkData] of loadedChunks.entries()) {
            // Use the contentManagerData references for iteration
            const tumbleweeds = chunkData.contentManagerData?.tumbleweeds;
            if (tumbleweeds && tumbleweeds.length > 0) {
                tumbleweeds.forEach(tumbleweed => {
                    if (tumbleweed) {
                        tumbleweed.update(deltaTime, elapsedTime, playerPosition);
                        this.spatialGrid.update(tumbleweed.object3D);
                    }
                });
            }

            // Update static objects that need to stay aligned with terrain
            if (updateRocksThisFrame) {
                this._updateTerrainAlignedObjects(chunkData);
            }
        }
    }

    /**
     * Updates objects that need to stay aligned with the terrain.
     * @param {object} chunkData - The chunk data containing objects to update.
     * @private
     */
    _updateTerrainAlignedObjects(chunkData) {
        if (!chunkData || !this.levelConfig) return;

        // First check objects array for any rock_desert objects
        if (chunkData.objects) {
            for (const objectData of chunkData.objects) {
                if (objectData && objectData.type === 'rock_desert' && objectData.mesh) {
                    this._updateRockPosition(objectData.mesh);
                }
            }
        }

        // Then check collidables array as a backup
        const collidables = chunkData.contentManagerData?.collidables;
        if (collidables && collidables.length > 0) {
            for (const mesh of collidables) {
                if (mesh && mesh.userData &&
                    (mesh.userData.objectType === 'rock_desert' ||
                     mesh.name?.includes('rock_desert'))) {
                    this._updateRockPosition(mesh);
                }
            }
        }
    }

    /**
     * Attempts to repair a tree mesh by creating missing parts
     * @param {THREE.Group} treeMesh - The tree mesh to repair
     * @param {boolean} hasTrunk - Whether the tree has a trunk
     * @param {boolean} hasFoliage - Whether the tree has foliage
     * @returns {boolean} - Whether the repair was successful
     * @private
     */
    _repairTreeMesh(treeMesh, hasTrunk, hasFoliage) {
        try {
            const config = C_MODELS.TREE_PINE;
            
            // Rather than trying to repair parts of a tree, let's replace the entire tree
            // This is simpler and more reliable
            logger.debug("Creating a new tree to replace broken one");
            
            // Get original tree data so we can transfer it
            const originalPosition = treeMesh.position.clone();
            const originalRotation = treeMesh.rotation.clone();
            const originalScale = treeMesh.scale.clone();
            const originalUserData = { ...treeMesh.userData };
            const originalParent = treeMesh.parent;
            const originalName = treeMesh.name;
            const originalChunkKey = treeMesh.userData.chunkKey;
            const originalObjectIndex = treeMesh.userData.objectIndex;

            // Remove the broken tree from the scene and spatial grid
            if (this.spatialGrid && treeMesh.parent) {
                this.spatialGrid.remove(treeMesh);
                treeMesh.parent.remove(treeMesh);
            }
            
            // Create a new complete tree
            const newTree = ModelFactory.createTreeMesh(); 
            
            // Transfer identifying data
            newTree.position.copy(originalPosition);
            newTree.rotation.copy(originalRotation);
            newTree.scale.copy(originalScale);
            newTree.name = originalName || 'tree_pine_visual';
            
            // Transfer important userData
            newTree.userData.objectType = 'tree_pine';
            newTree.userData.collidable = originalUserData.collidable || true;
            newTree.userData.chunkKey = originalChunkKey;
            newTree.userData.objectIndex = originalObjectIndex;
            
            // Add to scene and spatial grid
            if (originalParent) {
                originalParent.add(newTree);
                if (this.spatialGrid) {
                    this.spatialGrid.add(newTree);
                }
            }
            
            logger.debug(`Replaced broken tree with new one at (${originalPosition.x.toFixed(2)}, ${originalPosition.y.toFixed(2)}, ${originalPosition.z.toFixed(2)})`);
            
            return true;
        } catch (error) {
            logger.error("Error replacing tree:", error);
            return false;
        }
    }
    
    _updateRockPosition(mesh) {
        if (!mesh || !this.levelConfig) return;

        // Force all desert rocks to stay aligned with terrain
        const pos = mesh.position;
        const terrainY = noise2D(
            pos.x * this.levelConfig.NOISE_FREQUENCY,
            pos.z * this.levelConfig.NOISE_FREQUENCY
        ) * this.levelConfig.NOISE_AMPLITUDE;

        // Use a fixed vertical offset for desert rocks
        const verticalOffset = 0.6;
        mesh.position.y = terrainY + verticalOffset;

        // Ensure userData is set correctly
        mesh.userData.objectType = 'rock_desert';
        mesh.userData.stayAlignedWithTerrain = true;
        mesh.userData.verticalOffset = verticalOffset;

        // Update the spatial grid with the new position
        this.spatialGrid.update(mesh);

        // Log for debugging
        logger.debug(`Updated rock_desert position at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) to y=${mesh.position.y.toFixed(2)}`);
    }
}
