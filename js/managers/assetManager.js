import * as THREE from 'three';
import eventBus from '../core/eventBus.js';
import { materialsConfig } from '../config/materials.js';
import { fallbackGeometriesConfig } from '../config/fallbackGeometries.js';
import { modelsConfig } from '../config/models.js';
import { createLogger } from '../utils/logger.js';
import * as ModelFactory from '../rendering/modelFactory.js';

const logger = createLogger('AssetManager');

// Stores assets for the currently loaded level
let levelAssets = {};

/**
 * Initializes and stores shared assets like geometries and materials for a specific level.
 * @param {object} levelConfig - The configuration object for the level.
 */
export function initLevelAssets(levelConfig) {
    logger.info("Initializing assets for level...");

    // Clear previous level's assets first
    disposeLevelAssets();
    levelAssets = {}; // Reset the storage

    if (!levelConfig) {
        const errorMsg = "Cannot initialize assets without levelConfig!";
        eventBus.emit('errorOccurred', `[AssetManager] ${errorMsg}`);
        logger.error(errorMsg);
        return;
    }

    // --- Coin ---
    const coinVis = levelConfig.COIN_VISUALS || {}; // Start with empty object
    const coinRadius = coinVis.radius ?? fallbackGeometriesConfig.COIN.RADIUS;
    const coinHeight = coinVis.height ?? fallbackGeometriesConfig.COIN.HEIGHT;
    const coinColor = coinVis.color ?? 0xFFFF00; // Default yellow if not in config
    const coinSegments = fallbackGeometriesConfig.COIN.SEGMENTS;
    levelAssets.coinGeometry = new THREE.CylinderGeometry(coinRadius, coinRadius, coinHeight, coinSegments);
    levelAssets.coinGeometry.rotateX(Math.PI / 2);
    levelAssets.coinMaterial = new THREE.MeshStandardMaterial({ color: coinColor, metalness: 0.3, roughness: 0.4 }); // Keep metalness/roughness for now

    // --- Powerups ---
    // --- Magnet ---
    const magnetVis = levelConfig.MAGNET_VISUALS || {};
    const magnetProps = {
        size: magnetVis.size ?? modelsConfig.MAGNET.DEFAULT_SIZE,
        color: magnetVis.color ?? modelsConfig.MAGNET.DEFAULT_COLOR
    };
    try {
        levelAssets.magnetGroup = ModelFactory.createMagnetModel(magnetProps); // Use ModelFactory with potentially defaulted props

        levelAssets.magnetMaterial = new THREE.MeshStandardMaterial({
          color: magnetProps.color, // Use the determined color
          emissive: modelsConfig.MAGNET.MAGNET_EMISSIVE,
          metalness: modelsConfig.MAGNET.MAGNET_METALNESS,
          roughness: modelsConfig.MAGNET.MAGNET_ROUGHNESS
        });
    } catch (error) {
        logger.error("Error creating magnet model:", error);
        eventBus.emit('errorOccurred', "[AssetManager] Error creating magnet model.");
    }

    // --- Doubler --- (Uses level config OR model defaults and ModelFactory)
    const doublerVis = levelConfig.DOUBLER_VISUALS || {};
    const doublerProps = {
      size: doublerVis.size ?? modelsConfig.DOUBLER.DEFAULT_SIZE,
      color: doublerVis.color ?? modelsConfig.DOUBLER.DEFAULT_COLOR
    };
    try {
      levelAssets.doublerGroup = ModelFactory.createDoublerModel(doublerProps);
      // Define doubler material
      levelAssets.doublerMaterial = new THREE.MeshStandardMaterial({
        color: doublerProps.color, 
        emissive: modelsConfig.DOUBLER.DOUBLER_EMISSIVE,
        metalness: modelsConfig.DOUBLER.DOUBLER_METALNESS,
        roughness: modelsConfig.DOUBLER.DOUBLER_ROUGHNESS
      });
    } catch (error) {
      logger.error("Error creating doubler model:", error);
      eventBus.emit('errorOccurred', "[AssetManager] Error creating doubler model.");
    }

    // --- Invisibility ---
    const invisibilityVis = levelConfig.INVISIBILITY_VISUALS || {};
    const invisibilityProps = {
      size: invisibilityVis.size ?? modelsConfig.INVISIBILITY.DEFAULT_SIZE,
      color: invisibilityVis.color ?? modelsConfig.INVISIBILITY.DEFAULT_COLOR
    };
    try {
      levelAssets.invisibilityGroup = ModelFactory.createInvisibilityModel(invisibilityProps);
      // Define invisibility material
      levelAssets.invisibilityMaterial = new THREE.MeshStandardMaterial({
        color: invisibilityProps.color,
        emissive: modelsConfig.INVISIBILITY.INVISIBILITY_EMISSIVE,
        metalness: modelsConfig.INVISIBILITY.INVISIBILITY_METALNESS,
        roughness: modelsConfig.INVISIBILITY.INVISIBILITY_ROUGHNESS,
        transparent: true,
        opacity: 0.7 // Make it semi-transparent to suggest invisibility
      });
    } catch (error) {
      logger.error("Error creating invisibility model:", error);
      eventBus.emit('errorOccurred', "[AssetManager] Error creating invisibility model.");
    }

    // --- Obstacles Materials ---
    levelAssets.rockMaterial = new THREE.MeshStandardMaterial({ color: materialsConfig.ROCK_COLOR, roughness: materialsConfig.ROCK_ROUGHNESS });
    levelAssets.logMaterial = new THREE.MeshStandardMaterial({ color: materialsConfig.LOG_COLOR, roughness: materialsConfig.LOG_ROUGHNESS });
    levelAssets.cabinMaterial = new THREE.MeshStandardMaterial({ color: materialsConfig.CABIN_COLOR, roughness: materialsConfig.CABIN_ROUGHNESS });
    levelAssets.cactusMaterial = new THREE.MeshStandardMaterial({ color: materialsConfig.CACTUS_COLOR, roughness: materialsConfig.CACTUS_ROUGHNESS });
    levelAssets.saloonMaterial = new THREE.MeshStandardMaterial({ color: materialsConfig.SALOON_COLOR, roughness: materialsConfig.SALOON_ROUGHNESS });


    // --- Obstacles Geometries ---
    const objectTypes = levelConfig.OBJECT_TYPES || [];
    objectTypes.forEach(objType => {
        // Only create geometries if they don't exist yet for this level load
        switch (objType.type) {
            case 'rock_small':
                if (!levelAssets.rockSmallGeo) levelAssets.rockSmallGeo = new THREE.IcosahedronGeometry(fallbackGeometriesConfig.ROCK_SMALL.RADIUS, fallbackGeometriesConfig.ROCK_SMALL.DETAIL);
                break;
            case 'rock_large':
                if (!levelAssets.rockLargeGeo) levelAssets.rockLargeGeo = new THREE.IcosahedronGeometry(fallbackGeometriesConfig.ROCK_LARGE.RADIUS, fallbackGeometriesConfig.ROCK_LARGE.DETAIL);
                break;
            case 'log_fallen':
                if (!levelAssets.logFallenGeo) levelAssets.logFallenGeo = new THREE.CylinderGeometry(fallbackGeometriesConfig.LOG_FALLEN.RADIUS, fallbackGeometriesConfig.LOG_FALLEN.RADIUS, fallbackGeometriesConfig.LOG_FALLEN.HEIGHT, fallbackGeometriesConfig.LOG_FALLEN.SEGMENTS);
                break;
            case 'cabin_simple':
                if (!levelAssets.cabinGeo) levelAssets.cabinGeo = new THREE.BoxGeometry(fallbackGeometriesConfig.CABIN.WIDTH, fallbackGeometriesConfig.CABIN.HEIGHT, fallbackGeometriesConfig.CABIN.DEPTH);
                break;
            case 'rock_desert':
                 if (!levelAssets.rockDesertGeo) levelAssets.rockDesertGeo = new THREE.DodecahedronGeometry(fallbackGeometriesConfig.ROCK_DESERT.RADIUS, fallbackGeometriesConfig.ROCK_DESERT.DETAIL);
                 break;
            case 'cactus_barrel':
                 if (!levelAssets.cactusBarrelGeo) levelAssets.cactusBarrelGeo = new THREE.CylinderGeometry(fallbackGeometriesConfig.CACTUS_BARREL.RAD_BOT, fallbackGeometriesConfig.CACTUS_BARREL.RAD_TOP, fallbackGeometriesConfig.CACTUS_BARREL.HEIGHT, fallbackGeometriesConfig.CACTUS_BARREL.SEGMENTS);
                 break;
            case 'saloon':
                 if (!levelAssets.saloonGeo) levelAssets.saloonGeo = new THREE.BoxGeometry(fallbackGeometriesConfig.SALOON.WIDTH, fallbackGeometriesConfig.SALOON.HEIGHT, fallbackGeometriesConfig.SALOON.DEPTH);
                 break;
            case 'skull':
                 if (!levelAssets.skullGeo) levelAssets.skullGeo = new THREE.IcosahedronGeometry(fallbackGeometriesConfig.SKULL.RADIUS, fallbackGeometriesConfig.SKULL.DETAIL);
                 break;
            case 'dried_bush':
                 if (!levelAssets.driedBushGeo) levelAssets.driedBushGeo = new THREE.IcosahedronGeometry(fallbackGeometriesConfig.DRIED_BUSH.RADIUS, fallbackGeometriesConfig.DRIED_BUSH.DETAIL);
                 break;
            case 'wagon_wheel':
                 if (!levelAssets.wagonWheelGeo) levelAssets.wagonWheelGeo = new THREE.TorusGeometry(fallbackGeometriesConfig.WAGON_WHEEL.RADIUS, fallbackGeometriesConfig.WAGON_WHEEL.TUBE, fallbackGeometriesConfig.WAGON_WHEEL.RAD_SEG, fallbackGeometriesConfig.WAGON_WHEEL.TUB_SEG);
                 break;
            case 'tumbleweed':
               if (!levelAssets.tumbleweedGeo) {
                   const tumbleweedModel = ModelFactory.createTumbleweedModel();
                   // Since the model is a group of meshes, we can't assign it directly to a 'Geo' key.
                   // Instead, we'll store the whole group and the object spawner will handle it.
                   // For now, let's just create it. The spawner will need to be updated to use this.
                   // To avoid breaking the existing system, we will create a dummy geometry for now.
                   levelAssets.tumbleweedGeo = new THREE.BufferGeometry(); // Dummy geo
                   // The actual model will be created in the object spawner.
               }
               break;
            case 'tree_pine':
            case 'cactus_saguaro':
            case 'railroad_sign':
            case 'mine_entrance':
            case 'water_tower':
                break;
        }
    });

    // --- Tree Materials ---
    if (objectTypes.some(t => t.type === modelsConfig.TREE_PINE.OBJECT_TYPE)) {
        levelAssets.treeFoliageMaterial = new THREE.MeshStandardMaterial({ color: modelsConfig.TREE_PINE.FALLBACK_FOLIAGE_COLOR, roughness: modelsConfig.TREE_PINE.FALLBACK_FOLIAGE_ROUGHNESS });
        levelAssets.treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: modelsConfig.TREE_PINE.FALLBACK_TRUNK_COLOR, roughness: modelsConfig.TREE_PINE.FALLBACK_TRUNK_ROUGHNESS });
    }

    logger.info("Level assets initialized:", Object.keys(levelAssets));
}

/**
 * Retrieves a pre-initialized asset by key for the current level.
 * @param {string} key - The key of the asset (e.g., 'coinGeometry', 'rockMaterial').
 * @returns {THREE.BufferGeometry | THREE.Material | THREE.Group | undefined} The requested asset or undefined if not found.
 */
export function getAsset(key) {
    if (!levelAssets[key]) {
        // This might be expected if an asset isn't used in the current level
    }
    return levelAssets[key];
}

/**
 * Disposes of assets loaded for the current level.
 * Call this before loading a new level.
 */
export function disposeLevelAssets() {
    logger.info("Disposing current level assets...");
    let disposedCount = 0;
    Object.keys(levelAssets).forEach(key => {
        const asset = levelAssets[key];
        if (asset) {
            try {
                if (asset.dispose) { // Materials and Geometries have dispose()
                    asset.dispose();
                    disposedCount++;
                } else if (asset instanceof THREE.Texture) { // Handle textures
                     asset.dispose();
                     disposedCount++;
                } else if (asset instanceof THREE.Group) {
                    // Dispose resources within groups (like magnet model)
                    asset.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.geometry?.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => m?.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        }
                    });

                }
            } catch (error) {
                logger.error(`Error disposing asset "${key}":`, error);
            }
        }
    });
    levelAssets = {}; // Clear the storage object
    logger.info(`Level assets disposed. ${disposedCount} items disposed.`);
}

// --- Model Factory Functions Removed ---
// All create...Model functions and helpers (createBoxPart, createEyes, etc.)
// have been moved to js/modelFactory.js
