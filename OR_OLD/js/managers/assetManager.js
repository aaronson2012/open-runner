import * as THREE from 'three';
import eventBus from '../core/eventBus.js';
import { materialsConfig } from '../config/materials.js';
import { fallbackGeometriesConfig } from '../config/fallbackGeometries.js';
import { modelsConfig } from '../config/models.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AssetManager');

// Caching
const geometryCache = new Map();
const materialCache = new Map();

export function getGeometry(key, creator) {
    if (!geometryCache.has(key)) {
        geometryCache.set(key, creator());
    }
    return geometryCache.get(key);
}

export function getMaterial(key, creator) {
    if (!materialCache.has(key)) {
        materialCache.set(key, creator());
    }
    return materialCache.get(key);
}


// Model Creator Registry
const modelCreators = {};

export function registerModelCreators(creators) {
    Object.assign(modelCreators, creators);
    logger.info(`Registered ${Object.keys(creators).length} model creators.`);
}


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
    levelAssets.coinGeometry = getGeometry(`coin-${coinRadius}-${coinHeight}-${coinSegments}`, () => {
        const geom = new THREE.CylinderGeometry(coinRadius, coinRadius, coinHeight, coinSegments);
        geom.rotateX(Math.PI / 2);
        return geom;
    });
    levelAssets.coinMaterial = getMaterial(`coin-mat-${coinColor}`, () => new THREE.MeshStandardMaterial({ color: coinColor, metalness: 0.3, roughness: 0.4 }));

    // --- Powerups ---
    // --- Magnet ---
    const magnetVis = levelConfig.MAGNET_VISUALS || {};
    const magnetProps = {
        size: magnetVis.size ?? modelsConfig.MAGNET.DEFAULT_SIZE,
        color: magnetVis.color ?? modelsConfig.MAGNET.DEFAULT_COLOR
    };
    try {
        if (modelCreators.createMagnetModel) {
            levelAssets.magnetGroup = modelCreators.createMagnetModel(magnetProps);
        } else {
            logger.error("createMagnetModel not registered!");
        }
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
        if (modelCreators.createDoublerModel) {
            levelAssets.doublerGroup = modelCreators.createDoublerModel(doublerProps);
        } else {
            logger.error("createDoublerModel not registered!");
        }
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
        if (modelCreators.createInvisibilityModel) {
            levelAssets.invisibilityGroup = modelCreators.createInvisibilityModel(invisibilityProps);
        } else {
            logger.error("createInvisibilityModel not registered!");
        }
    } catch (error) {
      logger.error("Error creating invisibility model:", error);
      eventBus.emit('errorOccurred', "[AssetManager] Error creating invisibility model.");
    }

    // --- Obstacles Materials ---
    levelAssets.rockMaterial = getMaterial('rock-mat', () => new THREE.MeshStandardMaterial({ color: materialsConfig.ROCK_COLOR, roughness: materialsConfig.ROCK_ROUGHNESS }));
    levelAssets.logMaterial = getMaterial('log-mat', () => new THREE.MeshStandardMaterial({ color: materialsConfig.LOG_COLOR, roughness: materialsConfig.LOG_ROUGHNESS }));
    levelAssets.cabinMaterial = getMaterial('cabin-mat', () => new THREE.MeshStandardMaterial({ color: materialsConfig.CABIN_COLOR, roughness: materialsConfig.CABIN_ROUGHNESS }));
    levelAssets.cactusMaterial = getMaterial('cactus-mat', () => new THREE.MeshStandardMaterial({ color: materialsConfig.CACTUS_COLOR, roughness: materialsConfig.CACTUS_ROUGHNESS }));
    levelAssets.saloonMaterial = getMaterial('saloon-mat', () => new THREE.MeshStandardMaterial({ color: materialsConfig.SALOON_COLOR, roughness: materialsConfig.SALOON_ROUGHNESS }));


    // --- Obstacles Geometries ---
    const objectTypes = levelConfig.OBJECT_TYPES || [];
    objectTypes.forEach(objType => {
        switch (objType.type) {
            case 'rock_small':
                levelAssets.rockSmallGeo = getGeometry('rock_small', () => new THREE.IcosahedronGeometry(fallbackGeometriesConfig.ROCK_SMALL.RADIUS, fallbackGeometriesConfig.ROCK_SMALL.DETAIL));
                break;
            case 'rock_large':
                levelAssets.rockLargeGeo = getGeometry('rock_large', () => new THREE.IcosahedronGeometry(fallbackGeometriesConfig.ROCK_LARGE.RADIUS, fallbackGeometriesConfig.ROCK_LARGE.DETAIL));
                break;
            case 'log_fallen':
                levelAssets.logFallenGeo = getGeometry('log_fallen', () => new THREE.CylinderGeometry(fallbackGeometriesConfig.LOG_FALLEN.RADIUS, fallbackGeometriesConfig.LOG_FALLEN.RADIUS, fallbackGeometriesConfig.LOG_FALLEN.HEIGHT, fallbackGeometriesConfig.LOG_FALLEN.SEGMENTS));
                break;
            case 'cabin_simple':
                levelAssets.cabinGeo = getGeometry('cabin_simple', () => new THREE.BoxGeometry(fallbackGeometriesConfig.CABIN.WIDTH, fallbackGeometriesConfig.CABIN.HEIGHT, fallbackGeometriesConfig.CABIN.DEPTH));
                break;
            case 'rock_desert':
                 levelAssets.rockDesertGeo = getGeometry('rock_desert', () => new THREE.DodecahedronGeometry(fallbackGeometriesConfig.ROCK_DESERT.RADIUS, fallbackGeometriesConfig.ROCK_DESERT.DETAIL));
                 break;
            case 'cactus_barrel':
                 levelAssets.cactusBarrelGeo = getGeometry('cactus_barrel', () => new THREE.CylinderGeometry(fallbackGeometriesConfig.CACTUS_BARREL.RAD_BOT, fallbackGeometriesConfig.CACTUS_BARREL.RAD_TOP, fallbackGeometriesConfig.CACTUS_BARREL.HEIGHT, fallbackGeometriesConfig.CACTUS_BARREL.SEGMENTS));
                 break;
            case 'saloon':
                 levelAssets.saloonGeo = getGeometry('saloon', () => new THREE.BoxGeometry(fallbackGeometriesConfig.SALOON.WIDTH, fallbackGeometriesConfig.SALOON.HEIGHT, fallbackGeometriesConfig.SALOON.DEPTH));
                 break;
            case 'skull':
                 levelAssets.skullGeo = getGeometry('skull', () => new THREE.IcosahedronGeometry(fallbackGeometriesConfig.SKULL.RADIUS, fallbackGeometriesConfig.SKULL.DETAIL));
                 break;
            case 'dried_bush':
                 levelAssets.driedBushGeo = getGeometry('dried_bush', () => new THREE.IcosahedronGeometry(fallbackGeometriesConfig.DRIED_BUSH.RADIUS, fallbackGeometriesConfig.DRIED_BUSH.DETAIL));
                 break;
            case 'wagon_wheel':
                 levelAssets.wagonWheelGeo = getGeometry('wagon_wheel', () => new THREE.TorusGeometry(fallbackGeometriesConfig.WAGON_WHEEL.RADIUS, fallbackGeometriesConfig.WAGON_WHEEL.TUBE, fallbackGeometriesConfig.WAGON_WHEEL.RAD_SEG, fallbackGeometriesConfig.WAGON_WHEEL.TUB_SEG));
                 break;
            case 'tumbleweed':
               // Tumbleweed model is complex and created procedurally, so we don't cache a single geometry for it.
               // The createTumbleweedModel function will handle its own caching of sub-parts.
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
        levelAssets.treeFoliageMaterial = getMaterial('tree-foliage-mat', () => new THREE.MeshStandardMaterial({ color: modelsConfig.TREE_PINE.FALLBACK_FOLIAGE_COLOR, roughness: modelsConfig.TREE_PINE.FALLBACK_FOLIAGE_ROUGHNESS }));
        levelAssets.treeTrunkMaterial = getMaterial('tree-trunk-mat', () => new THREE.MeshStandardMaterial({ color: modelsConfig.TREE_PINE.FALLBACK_TRUNK_COLOR, roughness: modelsConfig.TREE_PINE.FALLBACK_TRUNK_ROUGHNESS }));
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

    // Dispose cached assets
    geometryCache.forEach(asset => {
        asset.dispose();
        disposedCount++;
    });
    materialCache.forEach(asset => {
        asset.dispose();
        disposedCount++;
    });
    geometryCache.clear();
    materialCache.clear();

    // Dispose non-cached assets (like groups)
    Object.keys(levelAssets).forEach(key => {
        const asset = levelAssets[key];
        if (asset && asset instanceof THREE.Group) {
            // The geometries and materials within the group's meshes are cached,
            // so we don't need to dispose them individually here.
            // Disposing the cache is sufficient.
        } else if (asset && asset.dispose && !geometryCache.has(key) && !materialCache.has(key)) {
            // Handle any other disposable assets that weren't in the cache
            asset.dispose();
            disposedCount++;
        }
    });

    levelAssets = {}; // Clear the storage object
    logger.info(`Level assets disposed. ${disposedCount} items disposed.`);
}
