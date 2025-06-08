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
import powerupNotificationManager from './ui/powerupNotificationManager.js';

const logger = createLogger('CollisionManager'); // Instantiate logger

// --- Collision Constants ---
const playerCollisionRadius = playerConfig.TORSO_WIDTH; // Use imported constant

// Collision sizes/radii are accessed via the imported modelsConfig object,
// e.g., modelsConfig.ROCK_DESERT.COLLISION_RADIUS, modelsConfig.BEAR.COLLISION_WIDTH_FACTOR etc.

// --- Module State ---
let _spatialGrid = null;
let _chunkManager = null;
let _enemyManager = null;

/**
 * Initializes the Collision Manager with necessary dependencies.
 * @param {SpatialGrid} spatialGridInstance
 * @param {ChunkManager} chunkManagerInstance
 * @param {EnemyManager} enemyManagerInstance
 * Removed scoreUpdateCallback and gameOverCallback, using eventBus instead.
 */
export function initCollisionManager(spatialGridInstance, chunkManagerInstance, enemyManagerInstance) {
    _spatialGrid = spatialGridInstance;
    _chunkManager = chunkManagerInstance;
    _enemyManager = enemyManagerInstance;
    // _scoreUpdater = scoreUpdateCallback; // Removed
    // _gameOverHandler = gameOverCallback; // Removed
}

/**
 * Checks for collisions between the player and nearby objects.
 * @param {Object} player - The player object containing position data.
 * @returns {boolean} True if collision checking was performed, false if skipped.
 */
function checkPlayerCollisions(player) {
    // Validate player object
    if (!player) {
        logger.warn('checkPlayerCollisions: Player object is null or undefined');
        return false;
    }

    if (!player.model) {
        logger.warn('checkPlayerCollisions: Player model is null or undefined');
        return false;
    }

    if (!player.model.position) {
        logger.warn('checkPlayerCollisions: Player model has no position property');
        return false;
    }

    const playerPosition = player.model.position;

    // Check game state and dependencies
    if (gameStateManager.getCurrentState() !== GameStates.PLAYING) {
        // Only check collisions during 'playing' state
        return false;
    }

    if (!_spatialGrid) {
        logger.error('checkPlayerCollisions: Spatial grid not initialized');
        return false;
    }

    if (!_chunkManager) {
        logger.error('checkPlayerCollisions: Chunk manager not initialized');
        return false;
    }

    // --- Query Spatial Grid for Nearby Objects ---
    const nearbyObjects = _spatialGrid.queryNearby(playerPosition);

    if (!nearbyObjects || nearbyObjects.size === 0) {
        // No nearby objects to check
        return true;
    }

    // --- Process Nearby Objects ---
    for (const mesh of nearbyObjects) {
        if (!mesh || !mesh.userData || !mesh.position) continue;

        const objectType = mesh.userData.objectType;
        if (!objectType) continue;

        const modelConfig = modelsConfig[objectType.toUpperCase()];
        if (!modelConfig || !modelConfig.collision) continue;

        const collisionConfig = modelConfig.collision;
        const dx = playerPosition.x - mesh.position.x;
        const dz = playerPosition.z - mesh.position.z;
        const distanceSq = dx * dx + dz * dz;

        let collisionRadius = modelConfig.COLLISION_RADIUS || 0.5;
        if (mesh.scale) {
            collisionRadius *= mesh.scale.x;
        }

        let collisionThresholdSq = (playerCollisionRadius + collisionRadius) ** 2;

        if (distanceSq < collisionThresholdSq) {
            switch (collisionConfig.effect) {
                case 'damagePlayer':
                    logger.info(`Player collided with ${collisionConfig.type} of type ${objectType}`);
                    eventBus.emit('playerDied', objectType);
                    return true;

                case 'collectCoin':
                    if (player.powerup === 'magnet') {
                        const magnetRadius = gameplayConfig.MAGNET_POWERUP_RADIUS;
                        collisionThresholdSq = (playerCollisionRadius + collisionRadius + magnetRadius) ** 2;
                        if (distanceSq > collisionThresholdSq) continue;
                    }
                    
                    const { chunkKey, objectIndex, scoreValue } = mesh.userData;
                    if (_chunkManager.collectObject(chunkKey, objectIndex)) {
                        const coinValue = scoreValue || gameplayConfig.DEFAULT_COIN_SCORE;
                        const finalValue = player.powerup === 'doubler' ? coinValue * 2 : coinValue;
                        eventBus.emit('scoreChanged', finalValue);
                        // No need to remove from nearbyObjects, as it's handled by chunkManager
                        logger.debug(`Collected coin with value ${finalValue}`);
                    }
                    break;

                case 'collectPowerup':
                    const { chunkKey: powerupChunkKey, objectIndex: powerupObjectIndex } = mesh.userData;
                    if (_chunkManager.collectObject(powerupChunkKey, powerupObjectIndex)) {
                        const powerupType = collisionConfig.powerupType;
                        const powerupName = powerupType.charAt(0).toUpperCase() + powerupType.slice(1);
                        
                        let powerupColor = 'white'; // Default color
                        switch (powerupType) {
                            case gameplayConfig.POWERUP_TYPE_MAGNET:
                                powerupColor = `#${gameplayConfig.MAGNET_EFFECT_COLOR.toString(16).padStart(6, '0')}`;
                                break;
                            case gameplayConfig.POWERUP_TYPE_DOUBLER:
                                powerupColor = `#${gameplayConfig.DOUBLER_EFFECT_COLOR.toString(16).padStart(6, '0')}`;
                                break;
                            case gameplayConfig.POWERUP_TYPE_INVISIBILITY:
                                powerupColor = `#${gameplayConfig.INVISIBILITY_EFFECT_COLOR.toString(16).padStart(6, '0')}`;
                                break;
                        }

                        powerupNotificationManager.showNotification(powerupName, playerPosition, powerupColor);
                        eventBus.emit('powerupCollected', { type: powerupType });
                        // No need to remove from nearbyObjects, as it's handled by chunkManager
                        logger.debug(`Collected powerup of type ${collisionConfig.powerupType}`);
                    }
                    break;

                case 'impede':
                    const overlap = playerCollisionRadius + collisionRadius - Math.sqrt(distanceSq);
                    if (overlap > 0) {
                        const pushback = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(overlap);
                        player.model.position.add(pushback);

                        // Optionally, apply a force to the player if using a physics engine
                        if (player.physicsComponent) {
                            const pushForce = pushback.clone().multiplyScalar(50); // Adjust force magnitude as needed
                            player.physicsComponent.applyImpulse(pushForce);
                        }
                    }
                    break;
            }
        }
    }

    return true; // Return true to indicate collision checking was performed
}

/**
 * Checks for collisions between an enemy and nearby objects.
 * @param {Object} enemy - The enemy object.
 */
function checkEnemyCollisions(enemy) {
    // Validate enemy and its model before proceeding
    if (!enemy || !enemy.model || !enemy.model.parent) {
        // If the model is not in the scene, it might have been removed by the chunk manager
        // This is not an error, but a race condition we need to handle gracefully
        return;
    }

    if (!enemy.model.position) {
        logger.warn('checkEnemyCollisions: Invalid enemy object provided');
        return;
    }

    const nearbyObjects = _spatialGrid.queryNearby(enemy.model.position);
    if (!nearbyObjects || nearbyObjects.size === 0) {
        return;
    }

    for (const mesh of nearbyObjects) {
        if (!mesh || !mesh.userData || !mesh.position || mesh === enemy.model) continue;

        const objectType = mesh.userData.objectType;
        if (!objectType) continue;

        const modelConfig = modelsConfig[objectType.toUpperCase()];
        if (!modelConfig || !modelConfig.collision) continue;

        const dx = enemy.model.position.x - mesh.position.x;
        const dz = enemy.model.position.z - mesh.position.z;
        const distanceSq = dx * dx + dz * dz;

        const enemyCollisionRadius = (enemy.model.geometry.boundingBox.max.x - enemy.model.geometry.boundingBox.min.x) / 2;
        let objectCollisionRadius = modelConfig.COLLISION_RADIUS || 0.5;
        if (mesh.scale) {
            objectCollisionRadius *= mesh.scale.x;
        }

        const collisionThresholdSq = (enemyCollisionRadius + objectCollisionRadius) ** 2;

        if (distanceSq < collisionThresholdSq) {
            // Enemies push each other away
            if (modelConfig.collision.type === 'enemy') {
                const overlap = Math.sqrt(collisionThresholdSq) - Math.sqrt(distanceSq);
                if (overlap > 0) {
                    const pushback = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(overlap * 0.5);
                    enemy.model.position.add(pushback);
                    mesh.position.sub(pushback);
                }
            }
        }
    }
}

/**
 * Main update function for the collision manager.
 * @param {Object} player - The player object.
 */
export function update(player) {
    if (gameStateManager.getCurrentState() !== GameStates.PLAYING) {
        return;
    }

    checkPlayerCollisions(player);

    if (_enemyManager) {
        const activeEnemies = _enemyManager.getActiveEnemies();
        // Create a snapshot of the enemies to prevent issues with concurrent modification
        const enemiesSnapshot = [...activeEnemies];
        for (const enemy of enemiesSnapshot) {
            checkEnemyCollisions(enemy);
        }
    }
}
