// js/managers/enemyManager.js
// import * as THREE from 'three'; // No longer needed directly
// import * as UIManager from './uiManager.js'; // Removed unused import
import { createLogger } from '../utils/logger.js';
// Import the specific enemy classes
import { Bear } from '../entities/enemies/Bear.js';
import { Squirrel } from '../entities/enemies/Squirrel.js';
import { Deer } from '../entities/enemies/Deer.js';
import { Coyote } from '../entities/enemies/Coyote.js';
import { Rattlesnake } from '../entities/enemies/Rattlesnake.js';
import { Scorpion } from '../entities/enemies/Scorpion.js';
import objectPoolManager from './objectPoolManager.js';

const logger = createLogger('EnemyManager');

// Map enemy type strings to their class constructors
const enemyClassMap = {
    bear: Bear,
    squirrel: Squirrel,
    deer: Deer,
    coyote: Coyote,
    rattlesnake: Rattlesnake,
    scorpion: Scorpion,
};

export class EnemyManager {
    constructor(scene, spatialGrid) {
        if (!scene || !spatialGrid) {
            throw new Error("EnemyManager requires scene and SpatialGrid instances!");
        }
        this.scene = scene;
        this.spatialGrid = spatialGrid;
        this.activeEnemies = new Map();
        this.objectPoolManager = objectPoolManager;
    }

    /**
     * Sets the scene for the EnemyManager. Used when transitioning levels.
     * @param {THREE.Scene} scene - The new scene instance.
     */
     setScene(scene) {
        if (!scene) {
            logger.error("Attempted to set invalid scene in EnemyManager.");
            return;
        }
        this.scene = scene;
        logger.info("EnemyManager scene updated.");
    }


    /**
     * Creates and spawns an enemy of the specified type using a map lookup.
     * @param {string} enemyType - The type of enemy (e.g., 'bear').
     * @param {object} initialData - Data containing position, rotation, etc.
     * @param {ChunkManager} chunkManager - The ChunkManager instance.
     * @param {object} levelConfig - The configuration object for the current level.
     * @returns {Enemy|null} The created enemy instance, or null if type is unknown or creation fails.
     */
    spawnEnemy(enemyType, initialData, chunkManager, levelConfig) {
        if (!chunkManager || !levelConfig) {
             const errorMsg = `[EnemyManager] spawnEnemy called without valid ChunkManager or levelConfig! Cannot spawn ${enemyType}.`;
             logger.error(errorMsg); // Use logger instead of UIManager
             // UIManager.displayError(new Error(errorMsg));
             return null;
        }
        const properties = levelConfig.ENEMY_PROPERTIES?.[enemyType];
        if (!properties) {
            logger.warn(`[EnemyManager] Properties not found for enemy type '${enemyType}' in level config.`);
            return null;
        }

        let enemyInstance = this.objectPoolManager.getFromPool('enemies', enemyType);

        if (enemyInstance) {
            enemyInstance.reset(initialData, properties);
            if (enemyInstance.mesh) {
                if (this.scene) {
                    this.scene.add(enemyInstance.mesh);
                    this.spatialGrid.add(enemyInstance.mesh);
                } else {
                     logger.error(`[EnemyManager] Scene is not set when trying to add pooled enemy ${enemyType} mesh!`);
                     return null;
                }
            } else {
                 logger.error(`[EnemyManager] Pooled enemy ${enemyType} missing mesh after reset! Discarding from pool.`);
                 enemyInstance = null;
            }
        }

        if (!enemyInstance) {
            const EnemyClass = enemyClassMap[enemyType];
            if (EnemyClass) {
                try {
                    // Pass chunkManager here as Enemy constructor needs it
                    enemyInstance = new EnemyClass(initialData, properties, this.scene, chunkManager);
                } catch (error) {
                     logger.error(`[EnemyManager] Error instantiating enemy type ${enemyType}:`, error);
                     // UIManager.displayError(new Error(`Failed to create enemy: ${enemyType}`)); // Use logger
                     return null;
                }
            } else {
                logger.warn(`[EnemyManager] Unknown enemy type requested for spawn: ${enemyType}`);
                return null;
            }
        }

        if (enemyInstance && enemyInstance.mesh) {
            if (enemyInstance.mesh.parent !== this.scene && this.scene) {
                 this.scene.add(enemyInstance.mesh);
            }
            this.activeEnemies.set(enemyInstance.mesh.id, enemyInstance);
            this.spatialGrid.add(enemyInstance.mesh);
            return enemyInstance;
        } else {
            logger.error(`[EnemyManager] Failed to obtain valid mesh for enemy type ${enemyType} after spawn/reset.`);
            if (enemyInstance && !enemyInstance.mesh) {
                 this.objectPoolManager.addToPool('enemies', enemyInstance);
            }
            // UIManager.displayError(new Error(`[EnemyManager] Failed to create mesh or instance for enemy type ${enemyType}`)); // Use logger
            return null;
        }
    }

    /**
     * Removes an enemy instance and its mesh from the scene.
     * @param {Enemy} enemyInstance - The enemy instance to remove.
     */
    removeEnemy(enemyInstance) {
        if (!enemyInstance || !enemyInstance.mesh) {
            logger.warn("[EnemyManager] Attempted to remove invalid enemy instance or instance without mesh.");
            return;
        }

        const meshId = enemyInstance.mesh.id;
        if (this.activeEnemies.has(meshId)) {
            this.spatialGrid.remove(enemyInstance.mesh);
            enemyInstance.removeFromScene();
            this.activeEnemies.delete(meshId);
            this.objectPoolManager.addToPool('enemies', enemyInstance);
        } else {
            logger.warn(`[EnemyManager] Attempted to remove enemy (ID: ${meshId}) not found in active list.`);
            this.spatialGrid.remove(enemyInstance.mesh);
            enemyInstance.removeFromScene();
        }
    }

     /**
     * Removes an enemy based on its mesh ID.
     * @param {number} meshId - The ID of the enemy's mesh to remove.
     */
    removeEnemyByMeshId(meshId) {
        const enemyInstance = this.activeEnemies.get(meshId);
        if (enemyInstance) {
            this.removeEnemy(enemyInstance);
        } else {
             logger.warn(`[EnemyManager] Attempted to remove enemy by mesh ID ${meshId}, but not found.`);
        }
    }


    /**
     * Updates all active enemies.
     * @param {THREE.Vector3} playerPos - The current position of the player.
     * @param {number} deltaTime - Time elapsed since the last frame.
     * @param {number} elapsedTime - Total time elapsed.
     */
    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!playerPos) return;
        for (const enemy of this.activeEnemies.values()) {
            enemy.update(playerPos, currentPowerup, deltaTime, elapsedTime);
            if (enemy.mesh) {
                this.spatialGrid.update(enemy.mesh);
            }
        }
    }

    /**
     * Gets the meshes of all currently active enemies.
     * @returns {THREE.Mesh[]} An array of active enemy meshes.
     */
    getActiveEnemyMeshes() {
        const meshes = [];
        for (const enemy of this.activeEnemies.values()) {
            if (enemy.mesh) {
                meshes.push(enemy.mesh);
            }
        }
        return meshes;
    }

    /**
     * Gets the count of currently active enemies.
     * @returns {number} The number of active enemies.
     */
    getActiveEnemiesCount() {
        return this.activeEnemies.size;
    }

    /**
     * Removes all active enemies from the scene and clears the manager.
     * Used during level transitions.
     */
    removeAllEnemies() {
        logger.info(`[EnemyManager] Removing all ${this.activeEnemies.size} enemies...`);
        const enemiesToRemove = [...this.activeEnemies.values()];
        for (const enemyInstance of enemiesToRemove) {
            this.removeEnemy(enemyInstance);
        }
        if (this.activeEnemies.size > 0) {
             logger.warn(`[EnemyManager] activeEnemies map not empty after removeAllEnemies. Size: ${this.activeEnemies.size}`);
             this.activeEnemies.clear();
        }
        logger.info("[EnemyManager] All enemies removed.");
    }
}
