// js/managers/objectPoolManager.js
import * as THREE from 'three'; // Re-enabled THREE import as it's used for Object3D checks
import { createLogger } from '../utils/logger.js'; // Stays in utils
import { modelsConfig as C_MODELS } from '../config/models.js'; // Needed for tree configuration
import { createTreeMesh } from '../rendering/models/sceneryModels.js'; // Import for tree creation

const logger = createLogger('ObjectPoolManager'); // Create logger instance

export class ObjectPoolManager { // Add named export
    constructor() {
        this.pools = {
            collectibles: [],  // Pool of inactive collectible meshes (coins, magnets)
            obstacles: [],     // Pool of inactive obstacle meshes (rocks, trees, cacti)
            tumbleweeds: [],    // Pool of inactive tumbleweed instances (GameObjects)
            enemies: []        // Pool of inactive enemy instances
        };
        logger.info("ObjectPoolManager instantiated");
    }

    /**
     * Gets an object from the specified pool, optionally matching a type.
     * @param {string} poolName - The name of the pool ('collectibles', 'obstacles', 'tumbleweeds').
     * @param {string} [objectType=null] - Optional object type to match (e.g., 'coin', 'tree_pine').
     * @returns {THREE.Mesh|Object|null} The retrieved object or null if none available/matching.
     */
    getFromPool(poolName, objectType = null) {
        if (!this.pools[poolName] || this.pools[poolName].length === 0) {
            return null;
        }

        let foundObject = null;
        let foundIndex = -1;

        // If object type specified, find the first matching object from the end
        if (objectType) {
            for (let i = this.pools[poolName].length - 1; i >= 0; i--) {
                const obj = this.pools[poolName][i];
                // Check userData for meshes, or directly for GameObjects like Tumbleweed
                const typeToCheck = obj.userData?.objectType || obj.type; // Assuming Tumbleweed has a 'type' property
                if (typeToCheck === objectType) {
                    foundObject = obj;
                    foundIndex = i;
                    break;
                }
            }
            // If a matching object was found, remove it from the pool
            if (foundIndex !== -1) {
                this.pools[poolName].splice(foundIndex, 1);
                
                // Special handling for log_fallen objects to ensure correct rotation
                if (objectType === 'log_fallen') {
                    foundObject.rotation.x = Math.PI / 2;
                    foundObject.userData.isRotatedLog = true;
                    foundObject.userData.initialRotationX = Math.PI / 2;
                    logger.debug("Ensuring log_fallen has correct horizontal rotation when retrieved from pool");
                }
                
                return foundObject;
            } else {
                 return null; // No matching type found
            }
        } else {
            // If no type specified, just get the last object (LIFO)
            foundObject = this.pools[poolName].pop();
            const type = foundObject.userData?.objectType || foundObject.type || 'unknown';
            
            // Special handling for log_fallen objects to ensure correct rotation even when type not specified
            if (type === 'log_fallen') {
                foundObject.rotation.x = Math.PI / 2;
                foundObject.userData.isRotatedLog = true;
                foundObject.userData.initialRotationX = Math.PI / 2;
                logger.debug("Ensuring log_fallen has correct horizontal rotation when retrieved from pool (no type)");
            }
            
            return foundObject;
        }
    }


    /**
     * Adds an object back to the specified pool.
     * @param {string} poolName - The name of the pool ('collectibles', 'obstacles', 'tumbleweeds').
     * @param {THREE.Mesh|Object} object - The object to add.
     */
    addToPool(poolName, object) {
        if (!this.pools[poolName]) {
            logger.warn(`Attempted to add to non-existent pool: ${poolName}`);
            this.pools[poolName] = []; // Create pool if it doesn't exist
        }
        if (!object) {
            logger.warn(`Attempted to add null/undefined object to pool: ${poolName}`);
            return;
        }

        const objectType = object.userData?.objectType || object.type || 'unknown';

        // Special handling for fallen logs to ensure they stay rotated correctly
        if (objectType === 'log_fallen') {
            // Ensure logs maintain their horizontal rotation when returned to the pool
            // This is important because they look like "topless trees" when vertical
            object.rotation.x = Math.PI / 2;
            object.userData.isRotatedLog = true;
            object.userData.initialRotationX = Math.PI / 2;
            logger.debug("Maintained horizontal rotation for log_fallen object in pool");
        }
            
    if (objectType === 'tree_pine') {
        this._prepareTreeForPool(object);
    }

        // Hide the object but keep it in memory
        if (object.visible !== undefined) { // For THREE.Object3D based objects
            object.visible = false;
        } else if (object.object3D && object.object3D.visible !== undefined) { // For GameObjects like Tumbleweed
            object.object3D.visible = false;
        }

        // Limit pool size based on performance settings (adjust multiplier as needed)
        // Using a fixed large number for now, can be tied to RENDERING config later
        const maxPoolSize = 500; // Example fixed size, adjust as needed
        // const maxPoolSize = (RENDERING?.MAX_OBJECTS_PER_CHUNK || 50) * 5; // Example based on config

        if (this.pools[poolName].length >= maxPoolSize) {
            // If pool is full, dispose the oldest object (FIFO for disposal)
            const oldestObject = this.pools[poolName].shift();
            this._disposeObject(oldestObject, poolName);
        }

        // Add the object to the pool
        this.pools[poolName].push(object);
    }

    /**
     * Clears all objects from all pools, disposing their resources.
     */
    clearPools() {
        logger.info("Clearing all object pools...");
        for (const poolName in this.pools) {
            logger.debug(`Clearing pool: ${poolName} (${this.pools[poolName].length} items)`);
            while (this.pools[poolName].length > 0) {
                const object = this.pools[poolName].pop();
                this._disposeObject(object, poolName);
            }
        }
        logger.info("All object pools cleared.");
    }

    /**
     * Disposes of an object's resources based on its type.
     * @param {THREE.Mesh|Object} object - The object to dispose.
     * @param {string} poolName - The name of the pool it came from.
     * @private
     */
    _disposeObject(object, poolName) {
        if (!object) return;

        try {
            if ((poolName === 'tumbleweeds' || poolName === 'enemies') && typeof object.dispose === 'function') {
                object.dispose(); // Call GameObject dispose method if available
            } else if (object instanceof THREE.Object3D) { // Handle Meshes and Groups
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry?.dispose();
                        // Dispose materials carefully
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat?.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
                // Ensure the object itself is removed if it was somehow still parented
                if(object.parent) {
                    object.parent.remove(object);
                }
            } else {
                 logger.warn(`Unknown object type in pool ${poolName} during disposal:`, object);
            }
        } catch (error) {
            logger.error(`Error disposing object from pool ${poolName}:`, error);
        }
    }


    /**
     * Prepares a tree object for pooling by validating, repairing, and resetting it.
     * @param {THREE.Group} tree - The tree object.
     * @private
     */
    _prepareTreeForPool(tree) {
        const config = C_MODELS.TREE_PINE;
        const trunkName = config.TRUNK_NAME;
        const foliageName = config.FOLIAGE_NAME;

        let trunk = tree.children.find(c => c.name === trunkName);
        let foliage = tree.children.find(c => c.name === foliageName);

        // If parts are missing, repair the tree
        if (!trunk || !foliage) {
            logger.warn(`Incomplete tree entering pool. Repairing...`);
            
            // Remove any existing incorrect parts
            [...tree.children].forEach(child => tree.remove(child));

            // Create and add new, correct parts
            const newTrunk = new THREE.Mesh(AssetManager.getAsset('treeTrunkGeometry'), AssetManager.getAsset('treeTrunkMaterial'));
            newTrunk.name = trunkName;
            tree.add(newTrunk);

            const newFoliage = new THREE.Mesh(AssetManager.getAsset('treeFoliageGeometry'), AssetManager.getAsset('treeFoliageMaterial'));
            newFoliage.name = foliageName;
            tree.add(newFoliage);
            
            trunk = newTrunk;
            foliage = newFoliage;
        }

        // Reset transformations and properties
        tree.scale.set(1, 1, 1);
        tree.position.set(0, 0, 0);
        tree.rotation.set(0, 0, 0);
        
        trunk.position.set(0, config.TRUNK_HEIGHT / 2, 0);
        foliage.position.set(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);

        tree.userData.isCompleteTree = true;
        logger.debug("Prepared and validated tree for object pool.");
    }

    /**
     * Gets the current sizes of all pools.
     * @returns {Object} An object with pool names as keys and sizes as values.
     */
    getPoolSizes() {
        const sizes = {};
        for (const poolName in this.pools) {
            sizes[poolName] = this.pools[poolName].length;
        }
        return sizes;
    }
}

// Singleton instance
const objectPoolManager = new ObjectPoolManager();

export default objectPoolManager;