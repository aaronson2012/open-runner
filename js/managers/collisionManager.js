// js/managers/collisionManager.js
import * as THREE from 'three';
import { createLogger } from '../utils/logger.js'; // Import logger
// Import specific config objects
import { playerConfig } from '../config/player.js';
import { modelsConfig } from '../config/models.js';
import { gameplayConfig } from '../config/gameplay.js';
import { tumbleweedConfig } from '../config/tumbleweed.js';



import gameStateManager, { GameStates } from '../core/gameStateManager.js'; // Import default instance and GameStates enum
import eventBus from '../core/eventBus.js'; // Moved to core

const logger = createLogger('CollisionManager'); // Instantiate logger

// --- Collision Constants ---
const playerCollisionRadius = playerConfig.TORSO_WIDTH; // Use imported constant

// Collision sizes/radii are accessed via the imported modelsConfig object,
// e.g., modelsConfig.ROCK_DESERT.COLLISION_RADIUS, modelsConfig.BEAR.COLLISION_WIDTH_FACTOR etc.

// --- Module State ---
let _spatialGrid = null;
let _chunkManager = null;
// let _scoreUpdater = null; // No longer needed, use eventBus
// let _gameOverHandler = null; // No longer needed, use eventBus

/**
 * Initializes the Collision Manager with necessary dependencies.
 * @param {SpatialGrid} spatialGridInstance
 * @param {ChunkManager} chunkManagerInstance
 * Removed scoreUpdateCallback and gameOverCallback, using eventBus instead.
 */
export function initCollisionManager(spatialGridInstance, chunkManagerInstance) {
    _spatialGrid = spatialGridInstance;
    _chunkManager = chunkManagerInstance;
    // _scoreUpdater = scoreUpdateCallback; // Removed
    // _gameOverHandler = gameOverCallback; // Removed
}

/**
 * Helper function to handle powerup collection logic.
 * @param {THREE.Mesh} mesh - The powerup mesh.
 * @param {object} playerPosition - The player's current position.
 * @param {Array} nearbyArray - The array of nearby objects for potential removal.
 * @param {number} indexInNearbyArray - The index of this mesh in nearbyArray.
 * @returns {boolean} True if a powerup was collected, false otherwise.
 * @private
 */
function _handlePowerupCollection(mesh, playerPosition, nearbyArray, indexInNearbyArray) {
    if (!mesh || !mesh.userData || !mesh.userData.objectType || mesh.userData.collidable) {
        return false;
    }

    const powerupType = mesh.userData.objectType;
    const modelConfigForPowerup = modelsConfig[powerupType.toUpperCase()];

    if (!modelConfigForPowerup || !modelConfigForPowerup.POWERUP_TYPE) {
        // Not a recognized powerup type in modelsConfig or missing POWERUP_TYPE definition
        return false;
    }

    if (!mesh.position) {
        logger.warn(`${powerupType} mesh ${mesh.id || 'unknown'} has no position property`);
        return false;
    }

    const dx = playerPosition.x - mesh.position.x;
    const dz = playerPosition.z - mesh.position.z;
    const distanceSq = dx * dx + dz * dz;

    const collisionRadius = modelConfigForPowerup.COLLISION_RADIUS || 1.0;
    const collisionThresholdSq = (playerCollisionRadius + collisionRadius) ** 2;

    if (distanceSq < collisionThresholdSq) {
        if (!mesh.userData.chunkKey || mesh.userData.objectIndex === undefined) {
            logger.warn(`${powerupType} mesh ${mesh.id || 'unknown'} missing required userData properties`);
            return false;
        }

        const { chunkKey, objectIndex } = mesh.userData;
        const collected = _chunkManager.collectObject(chunkKey, objectIndex);

        if (collected) {
            const actualPowerupType = modelConfigForPowerup.POWERUP_TYPE;
            eventBus.emit('powerupActivated', actualPowerupType);
            nearbyArray.splice(indexInNearbyArray, 1); // Remove from local array for this check
            logger.debug(`Collected ${actualPowerupType} powerup.`);
            return true;
        }
    }
    return false;
}

/**
 * Checks for collisions between the player and nearby objects.
 * @param {Object} player - The player object containing position data.
 * @returns {boolean} True if collision checking was performed, false if skipped.
 */
export function checkCollisions(player) {
    // Validate player object
    if (!player) {
        logger.warn('checkCollisions: Player object is null or undefined');
        return false;
    }

    if (!player.model) {
        logger.warn('checkCollisions: Player model is null or undefined');
        return false;
    }

    if (!player.model.position) {
        logger.warn('checkCollisions: Player model has no position property');
        return false;
    }

    const playerPosition = player.model.position;

    // Check game state and dependencies
    if (gameStateManager.getCurrentState() !== GameStates.PLAYING) {
        // Only check collisions during 'playing' state
        return false;
    }

    if (!_spatialGrid) {
        logger.error('checkCollisions: Spatial grid not initialized');
        return false;
    }

    if (!_chunkManager) {
        logger.error('checkCollisions: Chunk manager not initialized');
        return false;
    }

    // --- Query Spatial Grid for Nearby Objects ---
    const nearbyObjects = _spatialGrid.queryNearby(playerPosition);

    if (!nearbyObjects || nearbyObjects.size === 0) {
        // No nearby objects to check
        return true;
    }

    // --- Process Nearby Objects ---
    const nearbyArray = Array.from(nearbyObjects).filter(obj => obj != null);

    // Check Collectibles first (iterating backwards for safe removal)
    for (let i = nearbyArray.length - 1; i >= 0; i--) {
        const mesh = nearbyArray[i];
        if (!mesh || !mesh.userData) continue;
        // Log details of every nearby object being checked
        if (!mesh.position) continue;

        // handle coins
        if (mesh && mesh.userData && mesh.userData.objectType === 'coin' && !mesh.userData.collidable) {
            // Ensure mesh has a valid position
            if (!mesh.position) {
                logger.warn(`Coin mesh ${mesh.id || 'unknown'} has no position property`);
                continue;
            }

            const dx = playerPosition.x - mesh.position.x;
            const dy = playerPosition.y - mesh.position.y; // Keep dy for potential future 3D checks
            const dz = playerPosition.z - mesh.position.z;
            const distanceSq = dx * dx + dz * dz; // Use 2D distance for gameplay logic consistency
            const coinCollisionRadius = mesh.geometry?.parameters?.radiusBottom || 0.5; // Smaller default, consistent with magnet logic

            // When magnet is active, we need to ensure coins are collected properly
            // and don't get stuck inside the player model
            let collisionThresholdSq;
            const minSafeDistanceSq = (playerCollisionRadius * gameplayConfig.PLAYER_SAFE_DISTANCE_FACTOR) ** 2; // Use constant

            if (player.powerup === 'magnet') {
                // Use a much larger collection radius when magnet is active
                // This ensures coins don't get stuck inside the player model
                // This must be larger than the minSafeDistanceSq
                collisionThresholdSq = (playerCollisionRadius + coinCollisionRadius * gameplayConfig.COIN_COLLECTION_RADIUS_FACTOR) ** 2; // Use constant factor

                // Force collect any coins that somehow got too close to the player
                // This is a safety measure to prevent coins from getting stuck
                if (distanceSq < minSafeDistanceSq) {
                    // Ensure mesh has the required userData properties
                    if (!mesh.userData.chunkKey || mesh.userData.objectIndex === undefined) {
                        logger.warn(`Coin mesh ${mesh.id || 'unknown'} missing required userData properties`);
                        continue;
                    }

                    const { chunkKey, objectIndex, scoreValue } = mesh.userData;
                    const collected = _chunkManager.collectObject(chunkKey, objectIndex);

                    if (collected) {
                        // If doubler powerup is active, double the coin value
                        const coinValue = scoreValue || gameplayConfig.DEFAULT_COIN_SCORE;
                        const finalValue = player.powerup === 'doubler' ? coinValue * 2 : coinValue;
                        
                        eventBus.emit('scoreChanged', finalValue);
                        nearbyArray.splice(i, 1);
                        logger.debug(`Collected coin (magnet force collect) with value ${finalValue}`);
                    }
                    continue; // Skip to next object
                }
            } else {
                // Normal collection radius when magnet is not active
                collisionThresholdSq = (playerCollisionRadius + coinCollisionRadius) ** 2;
            }

            if (distanceSq < collisionThresholdSq) {
                // Ensure mesh has the required userData properties
                if (!mesh.userData.chunkKey || mesh.userData.objectIndex === undefined) {
                    logger.warn(`Coin mesh ${mesh.id || 'unknown'} missing required userData properties`);
                    continue;
                }

                const { chunkKey, objectIndex, scoreValue } = mesh.userData;
                const collected = _chunkManager.collectObject(chunkKey, objectIndex);

                if (collected) {
                    // If doubler powerup is active, double the coin value
                    const coinValue = scoreValue || gameplayConfig.DEFAULT_COIN_SCORE;
                    const finalValue = player.powerup === 'doubler' ? coinValue * 2 : coinValue;
                    
                    // Emit score change event instead of calling callback
                    eventBus.emit('scoreChanged', finalValue);
                    nearbyArray.splice(i, 1); // Remove from local array for this check
                    logger.debug(`Collected coin with value ${finalValue}`);
                }
            }
        }

        // handle powerups (magnet, doubler, invisibility)
        if (_handlePowerupCollection(mesh, playerPosition, nearbyArray, i)) {
            // If a powerup was collected, it was removed from nearbyArray, so continue.
            continue;
        }
    }

    // Now check remaining nearby objects for obstacles and enemies
    for (const mesh of nearbyArray) {
        if (!mesh || !mesh.userData) {
            continue;
        }

        if (!mesh.position) {
            logger.warn(`Mesh ${mesh.id || 'unknown'} has no position property`);
            continue;
        }

        const dx = playerPosition.x - mesh.position.x;
        const dz = playerPosition.z - mesh.position.z;
        const distanceSq = dx * dx + dz * dz;

        // Check if it's an Obstacle
        // Check if it's a standard Obstacle OR a Tumbleweed
        if (mesh.userData.collidable && !mesh.userData.enemyInstance) {
            const objectType = mesh.userData.objectType;

            if (!objectType) {
                logger.warn(`Collidable mesh ${mesh.id || 'unknown'} has no objectType property`);
                continue;
            }

            // Special check for Tumbleweed hazard
            if (objectType === tumbleweedConfig.OBJECT_TYPE_NAME) { // Use constant for tumbleweed type name
                if (!mesh.scale) {
                    logger.warn(`Tumbleweed mesh ${mesh.id || 'unknown'} has no scale property`);
                    continue;
                }

                const tumbleweedRadius = (modelsConfig.TUMBLEWEED_MODEL?.COLLISION_RADIUS || 1.0) * mesh.scale.x; // Use constant from config
                const collisionThresholdSqTumbleweed = (playerCollisionRadius + tumbleweedRadius) ** 2;

                if (distanceSq < collisionThresholdSqTumbleweed) {
                    logger.info(`Player collided with tumbleweed at position (${mesh.position.x.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
                    eventBus.emit('playerDied', 'tumbleweed'); // Emit player death event with cause
                    return true; // Stop checking and return true to indicate collision was processed
                }
            }
            // Special check for trees to allow walking under foliage
            else if (objectType === modelsConfig.TREE_PINE?.OBJECT_TYPE && modelsConfig.TREE_PINE?.ALLOW_WALK_UNDER) { // Use constants
                if (!mesh.scale) {
                    logger.warn(`Tree mesh ${mesh.id || 'unknown'} has no scale property`);
                    continue;
                }

                // Use trunk radius from config
                const trunkRadius = modelsConfig.TREE_PINE?.TRUNK_RADIUS * mesh.scale.x || 0.5;
                const collisionThresholdSqTrunk = (playerCollisionRadius + trunkRadius) ** 2;

                // Only check for collision with the trunk if we're close enough horizontally
                if (distanceSq < collisionThresholdSqTrunk) {
                    // Get the height of the player relative to the tree base
                    const playerY = playerPosition.y;
                    const treeBaseY = mesh.position.y;

                    // Tree trunk height from config
                    const trunkHeight = modelsConfig.TREE_PINE?.TRUNK_HEIGHT * mesh.scale.y || 1.0;
                    const trunkTopY = treeBaseY + trunkHeight;

                    // Calculate player's feet position
                    const playerFeetY = playerY - playerConfig.HEIGHT_OFFSET; // Use imported constant

                    // Only trigger collision if player's feet are below the top of the trunk
                    // Add a small buffer using constant
                    if (playerFeetY < trunkTopY - (gameplayConfig.TREE_COLLISION_BUFFER || 0.1)) {
                        logger.info(`Player collided with tree trunk at position (${mesh.position.x.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
                        eventBus.emit('playerDied', 'tree'); // Emit player death event with cause
                        return true; // Stop checking and return true to indicate collision was processed
                    }
                    // Otherwise player is above trunk height and can walk under foliage
                    logger.debug(`Player is above tree trunk height at position (${mesh.position.x.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
                }
            }
            // Check for other static obstacles
            else {
                if (!mesh.scale) {
                    logger.warn(`Obstacle mesh ${mesh.id || 'unknown'} has no scale property`);
                    continue;
                }

                // Get radius from MODELS config, fallback to 1.0
                const modelConfig = modelsConfig[objectType.toUpperCase()]; // Find config based on type name
                const obstacleRadius = (modelConfig?.COLLISION_RADIUS || 1.0) * mesh.scale.x;
                const collisionThresholdSqObstacle = (playerCollisionRadius + obstacleRadius) ** 2;

                if (distanceSq < collisionThresholdSqObstacle) {
                    logger.info(`Player collided with obstacle of type ${objectType} at position (${mesh.position.x.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
                    eventBus.emit('playerDied', objectType); // Emit player death event with cause
                    return true; // Stop checking and return true to indicate collision was processed
                }
            }
        }
        // Check if it's an Enemy
        else if (mesh.userData.enemyInstance) {
            if (!mesh.userData.enemyInstance.type) {
                logger.warn(`Enemy mesh ${mesh.id || 'unknown'} has no type property`);
                continue;
            }

            const enemyType = mesh.userData.enemyInstance.type;
            let enemyRadius = 0.5; // Default fallback
            const enemyConfig = modelsConfig[enemyType.toUpperCase()]; // Find config based on type name

            if (enemyConfig) {
                // Use radius if defined in config
                if (enemyConfig.COLLISION_RADIUS) {
                    enemyRadius = enemyConfig.COLLISION_RADIUS;
                }
                // Otherwise, estimate from width/depth factors if available
                else if (enemyConfig.COLLISION_WIDTH_FACTOR && enemyConfig.COLLISION_DEPTH_FACTOR &&
                         enemyConfig.TORSO_WIDTH && enemyConfig.TORSO_DEPTH) {
                    const approxWidth = enemyConfig.TORSO_WIDTH * enemyConfig.COLLISION_WIDTH_FACTOR;
                    const approxDepth = enemyConfig.TORSO_DEPTH * enemyConfig.COLLISION_DEPTH_FACTOR;
                    enemyRadius = (approxWidth + approxDepth) / 4; // Average estimate
                }
            }
            const collisionThresholdSqEnemy = (playerCollisionRadius + enemyRadius) ** 2;

            if (distanceSq < collisionThresholdSqEnemy) {
                logger.info(`Player collided with enemy of type ${enemyType} at position (${mesh.position.x.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
                eventBus.emit('playerDied', 'enemy'); // Emit player death event with cause
                return true; // Stop checking and return true to indicate collision was processed
            }
        }
    }

    return true; // Return true to indicate collision checking was performed
}
