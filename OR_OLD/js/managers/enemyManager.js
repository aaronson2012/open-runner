// js/managers/enemyManager.js
import { BaseManager } from './BaseManager.js';
import eventBus from '../core/eventBus.js';
import { Bear, Coyote, Deer, Squirrel } from '../entities/enemies/genericEnemyFactory.js';
import { Rattlesnake } from '../entities/enemies/Rattlesnake.js';
import { Scorpion } from '../entities/enemies/Scorpion.js';
import { Tumbleweed } from '../entities/enemies/Tumbleweed.js';
import objectPoolManager from './objectPoolManager.js';

// Map enemy type strings to their class constructors
const enemyClassMap = {
    bear: Bear,
    squirrel: Squirrel,
    deer: Deer,
    coyote: Coyote,
    rattlesnake: Rattlesnake,
    scorpion: Scorpion,
    tumbleweed: Tumbleweed,
};

export class EnemyManager extends BaseManager {
    constructor(scene, spatialGrid) {
        super('EnemyManager');
        this.spatialGrid = spatialGrid;
        this.activeEnemies = new Map();
        this.objectPoolManager = objectPoolManager;
        
        // Store the scene directly for compatibility
        if (scene && spatialGrid) {
            this.scene = scene;
            this.isInitialized = true;
        }
    }

    /**
     * Validate EnemyManager dependencies
     */
    validateDependencies(config) {
        if (!config.scene || !config.spatialGrid) {
            this.logger.error("EnemyManager requires scene and SpatialGrid instances!");
            return false;
        }
        return true;
    }

    /**
     * Setup enemy manager
     */
    async setupManager(config) {
        this.spatialGrid = config.spatialGrid;
        return true;
    }

    /**
     * Handle scene changes for enemy management
     */
    onSceneChanged(oldScene, newScene) {
        // Scene change handled by base class, no additional logic needed
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
            this.logger.error(errorMsg);
            eventBus.emit('errorOccurred', errorMsg);
            return null;
       }
       const properties = levelConfig.ENEMY_PROPERTIES?.[enemyType];
       if (!properties) {
           this.logger.warn(`[EnemyManager] Properties not found for enemy type '${enemyType}' in level config.`);
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
                    this.logger.error(`[EnemyManager] Scene is not set when trying to add pooled enemy ${enemyType} mesh!`);
                    return null;
               }
           } else {
                this.logger.error(`[EnemyManager] Pooled enemy ${enemyType} missing mesh after reset! Discarding from pool.`);
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
                    this.logger.error(`[EnemyManager] Error instantiating enemy type ${enemyType}:`, error);
                    eventBus.emit('errorOccurred', `Failed to create enemy: ${enemyType}`);
                    return null;
               }
           } else {
               this.logger.warn(`[EnemyManager] Unknown enemy type requested for spawn: ${enemyType}`);
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
           this.logger.error(`[EnemyManager] Failed to obtain valid mesh for enemy type ${enemyType} after spawn/reset.`);
           if (enemyInstance && !enemyInstance.mesh) {
                this.objectPoolManager.addToPool('enemies', enemyInstance);
           }
           eventBus.emit('errorOccurred', `[EnemyManager] Failed to create mesh or instance for enemy type ${enemyType}`);
           return null;
       }
   }

    /**
     * Removes an enemy instance and its mesh from the scene.
     * @param {Enemy} enemyInstance - The enemy instance to remove.
     */
    removeEnemy(enemyInstance) {
        if (!enemyInstance || !enemyInstance.mesh) {
            this.logger.warn("[EnemyManager] Attempted to remove invalid enemy instance or instance without mesh.");
            return;
        }

        const meshId = enemyInstance.mesh.id;
        if (this.activeEnemies.has(meshId)) {
            this.spatialGrid.remove(enemyInstance.mesh);
            enemyInstance.removeFromScene();
            this.activeEnemies.delete(meshId);
            this.objectPoolManager.addToPool('enemies', enemyInstance, enemyInstance.type);
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
             this.logger.warn(`[EnemyManager] Attempted to remove enemy by mesh ID ${meshId}, but not found.`);
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
     * Gets all active enemy instances.
     * @returns {IterableIterator<Enemy>} An iterator for the active enemy instances.
     */
    getActiveEnemies() {
        return this.activeEnemies.values();
    }

    /**
     * Removes all active enemies from the scene and clears the manager.
     * Used during level transitions.
     */
    removeAllEnemies() {
        this.logger.info(`[EnemyManager] Removing all ${this.activeEnemies.size} enemies...`);
        const enemiesToRemove = [...this.activeEnemies.values()];
        for (const enemyInstance of enemiesToRemove) {
            this.removeEnemy(enemyInstance);
        }
        if (this.activeEnemies.size > 0) {
             this.logger.warn(`[EnemyManager] activeEnemies map not empty after removeAllEnemies. Size: ${this.activeEnemies.size}`);
             this.activeEnemies.clear();
        }
        this.logger.info("[EnemyManager] All enemies removed.");
    }

    /**
     * Cleanup enemy manager resources
     */
    cleanupManager() {
        this.removeAllEnemies();
        this.spatialGrid = null;
        this.objectPoolManager = null;
    }
}
