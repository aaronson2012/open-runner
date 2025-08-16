// js/generators/objectGenerator.js
import * as THREE from 'three';
import { prng_alea } from 'seedrandom';
import { noise2D } from '../rendering/terrainGenerator.js'; // Updated path
import { worldConfig } from '../config/world.js'; // Import specific config object
import { createLogger } from '../utils/logger.js'; // Import logger
import { performanceManager } from '../config/config.js'; // For performance settings
import performanceUtils from '../utils/performanceUtils.js'; // For frustum culling
import { SpatialGrid } from '../physics/spatialGrid.js'; // For optimized object placement

const logger = createLogger('ObjectGenerator'); // Instantiate logger
import * as AssetManager from '../managers/assetManager.js'; // Updated path
import * as ModelFactory from '../rendering/modelFactory.js'; // Updated path

/**
 * Generates data for all placeable objects (coins, obstacles) for a specific chunk.
 * Objects will not be placed too close to the player's spawn point (0, 10, 5).
 * @param {number} chunkX - The X coordinate of the chunk.
 * @param {number} chunkZ - The Z coordinate of the chunk.
 * @param {Object} levelConfig - The level configuration containing object types and properties.
 * @returns {Array<Object>} An array of object data objects.
 * Each object contains: { position, type, scale, rotationY, collected, collidable, scoreValue, mesh }
 */
export function generateObjectsForChunk(chunkX, chunkZ, levelConfig) {

    const chunkSeed = `${worldConfig.SEED}_objects_chunk_${chunkX}_${chunkZ}`;
    const rng = prng_alea(chunkSeed);
    const chunkObjectsData = [];
    const spatialGrid = new SpatialGrid(worldConfig.CHUNK_SIZE / 10); // Adjusted divisor for potentially better coverage with 3x3 query
    const chunkOffsetX = chunkX * worldConfig.CHUNK_SIZE;
    const chunkOffsetZ = chunkZ * worldConfig.CHUNK_SIZE;
    const chunkArea = worldConfig.CHUNK_SIZE * worldConfig.CHUNK_SIZE;

    const playerSpawnPoint = new THREE.Vector3(0, 10, 5);
    const playerSpawnSafeRadiusSq = worldConfig.PLAYER_SPAWN_SAFE_RADIUS * worldConfig.PLAYER_SPAWN_SAFE_RADIUS;
    // Removed debug log


    // --- Generate Non-Enemy Objects ---
    for (const objectType of levelConfig.OBJECT_TYPES) {
        const type = objectType.type;
        const density = objectType.density;
        const minDistance = objectType.minDistance;
        const minDistanceSq = minDistance * minDistance;
        const verticalOffset = objectType.verticalOffset;
        const scaleRange = objectType.scaleRange;
        const randomRotationY = objectType.randomRotationY;
        const collidable = objectType.collidable;
        const scoreValue = objectType.scoreValue || 0;
        const maxPlacementAttempts = objectType.maxPlacementAttempts || 10; // Default attempts if not specified

        const averageObjects = chunkArea * density;
        const numObjects = Math.floor(averageObjects * (0.8 + rng() * 0.4));
        let placedCount = 0;

        for (let i = 0; i < numObjects; i++) {
            let placed = false;
            for (let attempt = 0; attempt < maxPlacementAttempts; attempt++) {
                let relativeX, relativeZ, worldX, worldZ;

                if (type === 'tumbleweed' && objectType.spawnOffPath) {
                    const side = rng() > 0.5 ? 1 : -1;
                    const offsetRange = objectType.spawnOffsetRange || [60, 100];
                    const offsetDistance = offsetRange[0] + rng() * (offsetRange[1] - offsetRange[0]);
                    relativeX = (rng() - 0.5) * worldConfig.CHUNK_SIZE * 0.2 + (side * offsetDistance);
                    relativeZ = (rng() - 0.5) * worldConfig.CHUNK_SIZE * 2.0;
                    worldX = relativeX + chunkOffsetX;
                    worldZ = relativeZ + chunkOffsetZ;
                } else {
                    relativeX = (rng() - 0.5) * worldConfig.CHUNK_SIZE;
                    relativeZ = (rng() - 0.5) * worldConfig.CHUNK_SIZE;
                    worldX = relativeX + chunkOffsetX;
                    worldZ = relativeZ + chunkOffsetZ;
                }

                let tooClose = false;
                const nearbyObjects = spatialGrid.queryNearby({ x: worldX, z: worldZ });
                for (const existingObject of nearbyObjects) {
                    const dx = worldX - existingObject.position.x;
                    const dz = worldZ - existingObject.position.z;
                    const requiredDistSq = Math.max(minDistanceSq, existingObject.minDistance * existingObject.minDistance);
                    if (dx * dx + dz * dz < requiredDistSq) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                const dxSpawn = worldX - playerSpawnPoint.x;
                const dzSpawn = worldZ - playerSpawnPoint.z;
                if (dxSpawn * dxSpawn + dzSpawn * dzSpawn < playerSpawnSafeRadiusSq) continue;

                const terrainY = noise2D(worldX * levelConfig.NOISE_FREQUENCY, worldZ * levelConfig.NOISE_FREQUENCY) * levelConfig.NOISE_AMPLITUDE;
                const objectPos = new THREE.Vector3(worldX, terrainY + verticalOffset, worldZ);
                const scaleFactor = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
                const objectScale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);
                const objectRotationY = randomRotationY ? rng() * Math.PI * 2 : 0;

                const objectData = {
                    position: objectPos, type: type, scale: objectScale, rotationY: objectRotationY,
                    collected: false, collidable: collidable, scoreValue: scoreValue,
                    minDistance: minDistance, mesh: null
                };

                if (type === 'tumbleweed') {
                    objectData.isHazard = objectType.isHazard || false;
                    objectData.isDynamic = true;
                    if (objectType.spawnOffPath) {
                        objectData.spawnSide = objectPos.x > chunkOffsetX ? 'right' : 'left';
                    }
                }

                chunkObjectsData.push(objectData);
                spatialGrid.add(objectData); // Add to spatial grid after successful placement
                placed = true;
                placedCount++;
                break;
            }
            if (!placed) {
                 // More informative log when placement fails
                 logger.warn(`Could not place ${type} ${i + 1}/${numObjects} in chunk [${chunkX}, ${chunkZ}] after ${maxPlacementAttempts} attempts. Density or minDistance might be too high.`);
            }
        }
    }

    // --- Generate Enemies ---
    const enemyTypes = levelConfig.ENEMY_TYPES || [];
    const enemyProperties = levelConfig.ENEMY_PROPERTIES || {};
    let maxEnemyMinDistance = 0;
    if (enemyTypes.length > 0) {
        maxEnemyMinDistance = Math.max(...enemyTypes.map(type => enemyProperties[type]?.minDistance || 0));
    }
    const maxEnemyMinDistanceSq = maxEnemyMinDistance * maxEnemyMinDistance;
    const averageEnemies = chunkArea * (levelConfig.ENEMY_SPAWN_DENSITY || 0);
    const numEnemiesToAttempt = Math.floor(averageEnemies * (0.8 + rng() * 0.4));
    let enemiesPlaced = 0;

    for (let i = 0; i < numEnemiesToAttempt; i++) {
        let placed = false;
        const maxTotalAttempts = 20; // Keep attempts reasonable
        for (let attempt = 0; attempt < maxTotalAttempts; attempt++) {
            const relativeX = (rng() - 0.5) * worldConfig.CHUNK_SIZE;
            const relativeZ = (rng() - 0.5) * worldConfig.CHUNK_SIZE;
            const worldX = relativeX + chunkOffsetX;
            const worldZ = relativeZ + chunkOffsetZ;

            let tooClose = false;
            const nearbyEntities = spatialGrid.queryNearby({ x: worldX, z: worldZ });
            for (const existingObject of nearbyEntities) {
                const dx = worldX - existingObject.position.x;
                const dz = worldZ - existingObject.position.z;
                const requiredDistSq = Math.max(
                    existingObject.minDistance * existingObject.minDistance,
                    maxEnemyMinDistanceSq
                );
                if (dx * dx + dz * dz < requiredDistSq) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            const dxSpawn = worldX - playerSpawnPoint.x;
            const dzSpawn = worldZ - playerSpawnPoint.z;
            if (dxSpawn * dxSpawn + dzSpawn * dzSpawn < playerSpawnSafeRadiusSq) continue;

            if (enemyTypes.length === 0) continue;
            const chosenTypeIndex = Math.floor(rng() * enemyTypes.length);
            const chosenType = enemyTypes[chosenTypeIndex];
            const properties = enemyProperties[chosenType];
            if (!properties) {
                 logger.warn(`Missing properties for enemy type: ${chosenType}`);
                 continue;
            }

            const terrainY = noise2D(worldX * levelConfig.NOISE_FREQUENCY, worldZ * levelConfig.NOISE_FREQUENCY) * levelConfig.NOISE_AMPLITUDE;
            const objectPos = new THREE.Vector3(worldX, terrainY + (properties.verticalOffset || 0), worldZ); // Use specific offset or 0
            const objectScale = new THREE.Vector3(1, 1, 1);
            const objectRotationY = rng() * Math.PI * 2;

            const enemyObjectData = {
                position: objectPos, type: chosenType, scale: objectScale, rotationY: objectRotationY,
                collected: false, collidable: true, scoreValue: 0,
                minDistance: properties.minDistance, mesh: null, enemyInstance: null
            };
            chunkObjectsData.push(enemyObjectData);
            spatialGrid.add(enemyObjectData); // Add to spatial grid after successful placement
            placed = true;
            enemiesPlaced++;
            break;
        }
         if (!placed) {
             // More informative log when placement fails
             logger.warn(`Could not place enemy ${i + 1}/${numEnemiesToAttempt} in chunk [${chunkX}, ${chunkZ}] after ${maxTotalAttempts} attempts. Density or minDistance might be too high.`);
         }
    }

    return chunkObjectsData;
}


/**
 * Creates the visual representation (THREE.Mesh or THREE.Group) for a given object data.
 * Uses AssetManager for shared resources and ModelFactory for complex object creation.
 * @param {object} objectData - The data object generated by generateObjectsForChunk.
 * @param {object} levelConfig - The level configuration.
 * @returns {Promise<THREE.Mesh | THREE.Group | null> | THREE.Mesh | THREE.Group | null} 
 *          For tree_pine objects: returns a Promise.
 *          For other objects: returns the mesh directly.
 */
export function createObjectVisual(objectData, levelConfig) {
    // Special handling for tree_pine - return a Promise
    if (objectData.type === 'tree_pine') {
        return new Promise((resolve, reject) => {
            // Use dynamic import for the robustTree module
            import('../rendering/models/robustTree.js')
                .then(robustTree => {
                    try {
                        // Create a tree using the robust tree implementation
                        const tree = robustTree.createRobustTree();
                        
                        // Apply transformations
                        if (objectData.position) tree.position.copy(objectData.position);
                        if (objectData.rotationY !== undefined) tree.rotation.y = objectData.rotationY;
                        if (objectData.scale) {
                            if (objectData.scale.x !== undefined) {
                                tree.scale.set(objectData.scale.x, objectData.scale.y, objectData.scale.z);
                            } else {
                                const scale = 1;
                                tree.scale.set(scale, scale, scale);
                            }
                        }
                        
                        // Return the completed tree
                        resolve(tree);
                    } catch (treeError) {
                        logger.error("Error creating robust tree:", treeError);
                        // Fallback to ModelFactory
                        const fallbackTree = ModelFactory.createTreeMesh();
                        if (objectData.position) fallbackTree.position.copy(objectData.position);
                        if (objectData.rotationY !== undefined) fallbackTree.rotation.y = objectData.rotationY;
                        resolve(fallbackTree);
                    }
                })
                .catch(importError => {
                    logger.error("Error importing robustTree:", importError);
                    // Fallback to the ModelFactory if import fails
                    const fallbackTree = ModelFactory.createTreeMesh();
                    if (objectData.position) fallbackTree.position.copy(objectData.position);
                    if (objectData.rotationY !== undefined) fallbackTree.rotation.y = objectData.rotationY;
                    resolve(fallbackTree);
                });
        });
    }
    
    // For non-tree objects, create synchronously
    let mesh = null;
    let geometry = null;
    let material = null;

    const enemyTypesForLevel = levelConfig?.ENEMY_TYPES || [];
    if (enemyTypesForLevel.includes(objectData.type) || objectData.collected) {
        return null;
    }

    // Use ModelFactory for complex models, AssetManager for simple geometries/materials
    try { // Add try-catch around model creation
        // Tree objects are handled in the Promise section above
        // This section handles all other object types
        
        // Handle all other object types
        switch (objectData.type) {
            case 'coin':
                geometry = AssetManager.getAsset('coinGeometry');
                material = AssetManager.getAsset('coinMaterial');
                break;
            case 'magnet':
                mesh = ModelFactory.createMagnetModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'doubler':
                mesh = ModelFactory.createDoublerModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'invisibility':
                mesh = ModelFactory.createInvisibilityModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'rock_small':
                geometry = AssetManager.getAsset('rockSmallGeo');
                material = AssetManager.getAsset('rockMaterial');
                break;
            case 'rock_large':
                geometry = AssetManager.getAsset('rockLargeGeo');
                material = AssetManager.getAsset('rockMaterial');
                break;
// This has been handled above using dynamic import
// So we don't need the case statement for tree_pine anymore
            case 'log_fallen':
                geometry = AssetManager.getAsset('logFallenGeo');
                material = AssetManager.getAsset('logMaterial');
                break;
            case 'cabin_simple':
                geometry = AssetManager.getAsset('cabinGeo');
                material = AssetManager.getAsset('cabinMaterial');
                break;
            case 'rock_desert':
                // Create a simple mesh directly for better control
                geometry = AssetManager.getAsset('rockDesertGeo');
                material = AssetManager.getAsset('rockMaterial');

                if (geometry && material) {
                    mesh = new THREE.Mesh(geometry, material);

                    // Calculate terrain height and position the rock above it
                    if (objectData.position) {
                        const terrainY = noise2D(
                            objectData.position.x * levelConfig.NOISE_FREQUENCY,
                            objectData.position.z * levelConfig.NOISE_FREQUENCY
                        ) * levelConfig.NOISE_AMPLITUDE;

                        // Use a fixed vertical offset
                        const verticalOffset = 0.6;
                        objectData.position.y = terrainY + verticalOffset;

                        // Set the rock's position
                        mesh.position.copy(objectData.position);
                    }

                    // Set userData directly on the mesh
                    mesh.userData = {
                        objectType: 'rock_desert',
                        stayAlignedWithTerrain: true,
                        verticalOffset: 0.6,
                        collidable: true
                    };

                    mesh.name = 'rock_desert_visual';
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    // Don't use the ModelFactory approach
                    geometry = null; material = null;

                    logger.debug(`Created rock_desert at position (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
                } else {
                    logger.warn(`Missing geometry or material for rock_desert`);
                }
                break;
            case 'cactus_saguaro':
                mesh = ModelFactory.createCactusSaguaroModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'cactus_barrel':
                geometry = AssetManager.getAsset('cactusBarrelGeo');
                material = AssetManager.getAsset('cactusMaterial');
                break;
            case 'saloon':
                mesh = ModelFactory.createSaloonModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'railroad_sign':
                mesh = ModelFactory.createRailroadSignModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'skull':
                geometry = AssetManager.getAsset('skullGeo');
                material = new THREE.MeshStandardMaterial({ color: 0xFFFACD, roughness: 0.6 }); // Instance material
                break;
            case 'dried_bush':
                geometry = AssetManager.getAsset('driedBushGeo');
                material = new THREE.MeshStandardMaterial({ color: 0xBC8F8F, roughness: 0.9 }); // Instance material
                break;
            case 'wagon_wheel':
                geometry = AssetManager.getAsset('wagonWheelGeo');
                material = AssetManager.getAsset('logMaterial');
                break;
            case 'mine_entrance':
                mesh = ModelFactory.createMineEntranceModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'water_tower':
                mesh = ModelFactory.createWaterTowerModel(objectData); // Use factory
                geometry = null; material = null;
                break;
            case 'tumbleweed':
                // Tumbleweed visual is handled by its GameObject class
                return null;
            default:
                logger.warn(`Unknown or unhandled object type for visual creation: ${objectData.type}`);
                return null;
        }
    } catch (error) {
        logger.error(`Error creating visual for object type ${objectData.type}:`, error);
        return null; // Return null if creation fails
    }


    // If mesh wasn't created directly by factory, create it now
    if (mesh === null && geometry && material) {
        mesh = new THREE.Mesh(geometry, material);
    }

    // Apply transformations and set user data if a mesh was created
    if (mesh) {
        mesh.position.copy(objectData.position);
        mesh.scale.copy(objectData.scale);
        mesh.rotation.y = objectData.rotationY;

        // Apply specific initial rotations
        if (objectData.type === 'log_fallen') {
            // Make sure logs are rotated to lie flat on the ground
            mesh.rotation.x = Math.PI / 2;
            
            // Store the rotation in userData to ensure it's not lost
            mesh.userData.initialRotationX = Math.PI / 2;
            mesh.userData.isRotatedLog = true;
            
            // Log the rotation for debugging
            logger.debug(`Created fallen log with rotation.x = ${mesh.rotation.x}`);
        } else if (objectData.type === 'wagon_wheel') {
             // mesh.rotation.z = Math.PI / 2; // Example: Stand it upright if needed
        }

        mesh.name = `${objectData.type}_visual`;
        mesh.userData = {
            objectType: objectData.type,
            collidable: objectData.collidable,
            scoreValue: objectData.scoreValue,
            // Performance optimizations
            needsBoundsUpdate: true, // Flag for frustum culling
            smallObject: ['coin', 'small_rock', 'small_cactus', 'flower', 'mushroom'].includes(objectData.type)
            // chunkKey and objectIndex added by ChunkManager
        };

        // Performance optimizations for static objects
        const perfSettings = performanceManager.getSettings();
        if (perfSettings.useStaticObjects && 
            !['tumbleweed', 'deer', 'bear', 'coyote', 'squirrel', 'rattlesnake', 'scorpion'].includes(objectData.type)) {
            // Disable auto-updates for static scenery objects
            mesh.matrixAutoUpdate = perfSettings.matrixAutoUpdates;
            // Pre-compute the matrix since it won't auto-update
            mesh.updateMatrix();
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    } else if (!objectData.collected && objectData.type !== 'tumbleweed') { // Don't warn for tumbleweeds
         logger.warn(`Failed to create mesh for type: ${objectData.type} (Geometry or Material missing?)`);
         return null;
    } else {
        return null;
    }
}


/**
 * Removes the visual representation of an object from the scene and spatial grid.
 * Handles basic disposal, but avoids disposing shared assets.
 * @param {object} objectData - The data object containing the mesh reference.
 * @param {THREE.Scene} scene - The main scene.
 * @param {SpatialGrid} spatialGrid - The spatial grid instance.
 */
export function disposeObjectVisual(objectData, scene, spatialGrid) { // Removed levelConfig
    if (!objectData || !objectData.mesh || objectData.enemyInstance) {
        return; // No mesh, or it's an enemy (handled elsewhere)
    }

    const mesh = objectData.mesh;

    if (spatialGrid) spatialGrid.remove(mesh);
    if (scene) scene.remove(mesh);

    // --- Resource Disposal ---
    // Geometries and Materials are assumed to be shared via AssetManager
    // and should NOT be disposed here. Complex models created by ModelFactory
    // might need specific disposal if they don't use shared assets, but
    // currently, they primarily use shared materials/geometries from AssetManager.
    // Tree disposal is handled by ObjectPoolManager now.

    // Clear the mesh reference in the original data
    objectData.mesh = null;
}
