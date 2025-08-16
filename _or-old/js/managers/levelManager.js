// js/managers/levelManager.js
import * as UIManager from './uiManager.js'; // Stays in managers
import * as AssetManager from './assetManager.js'; // Stays in managers
import { createLogger } from '../utils/logger.js'; // Import logger
import eventBus from '../core/eventBus.js';

const logger = createLogger('LevelManager'); // Instantiate logger
// Define available levels
const AVAILABLE_LEVELS = [
    { id: 'level1', name: 'Forest', description: 'Run through the lush forest landscape' },
    { id: 'level2', name: 'Desert', description: 'Navigate the hot desert terrain' }
    // Add more levels in AVAILABLE_LEVELS as they are created
];

let currentLevelId = null; // Will store the string ID (e.g., 'level1')
let currentLevelConfig = null;
let chunkManagerInstance = null; // Reference to ChunkManager
let enemyManagerInstance = null; // Reference to EnemyManager
/**
 * Loads the configuration for a specific level.
 * @param {string} levelId - The ID of the level to load (e.g., 'level1', 'level2').
 * @returns {Promise<boolean>} True if loading was successful, false otherwise.
 */
export async function loadLevel(levelId) { // levelId is now a string
    logger.info(`Loading level: ${levelId}`);
    let configModule;
    try {
        switch (levelId) {
            case 'level1':
                configModule = await import('../levels/level1_forest.js'); // Updated path
                currentLevelConfig = configModule.level1Config;
                break;
            case 'level2':
                configModule = await import('../levels/level2_desert.js'); // Updated path
                currentLevelConfig = configModule.level2Config;
                break;
            // Add cases for future levels here
            default:
                logger.error(`[LevelManager] Unknown level ID: ${levelId}`);
                currentLevelConfig = null;
                currentLevelId = null;
                return false;
        }

        if (!currentLevelConfig) {
             // Use UI Manager for critical config load failure
             UIManager.displayError(new Error(`[LevelManager] Failed to load config object for level ${levelId}`));
             currentLevelId = null;
             return false;
        }

        currentLevelId = levelId;
        // Asset initialization is now handled by Game.init() after level loading
        if (!currentLevelConfig) {
            logger.error("[LevelManager] Cannot proceed, config is null.");
            // The config load itself succeeded earlier, but the config object is null.
            // This is a critical error that should be handled.
            return false;
        }

        // Scene setup/reset is handled by atmosphericManager.setupAtmosphereForLevel() after level loading

        return true;

    } catch (error) {
        // Use UI Manager for critical level load failure
        UIManager.displayError(new Error(`[LevelManager] Error loading level ${levelId}: ${error.message}`));
        currentLevelConfig = null;
        currentLevelId = null;
        return false;
    }
}

/**
 * Gets the configuration object for the currently loaded level.
 * @returns {object | null} The configuration object or null if no level is loaded.
 */
export function getCurrentConfig() {
    return currentLevelConfig;
}

/**
 * Gets the ID of the currently loaded level.
 * @returns {string | null} The current level ID (e.g., 'level1') or null.
 */
export function getCurrentLevelId() {
    return currentLevelId;
}

/**
 * Stores references to the core managers needed for level loading/unloading.
 * @param {ChunkManager} chunkMgr
 * @param {EnemyManager} enemyMgr
 */
export function setManagers(chunkMgr, enemyMgr) {
    chunkManagerInstance = chunkMgr;
    enemyManagerInstance = enemyMgr;
}

/**
 * Handles unloading the current level's assets and state.
 */
export function unloadCurrentLevel() {
    if (!currentLevelId) {
        logger.info("[LevelManager] No current level to unload.");
        return;
    }

    logger.info(`[LevelManager] Unloading level: ${currentLevelId}`);

    // Signal ChunkManager to clear chunks
    if (chunkManagerInstance) {
        logger.info("[LevelManager] Clearing all chunks...");
        chunkManagerInstance.clearAllChunks();
    } else {
        logger.warn("[LevelManager] ChunkManager instance not set, cannot clear chunks.");
    }

    // Signal EnemyManager to remove enemies
    if (enemyManagerInstance) {
        logger.info("[LevelManager] Removing all enemies...");
        enemyManagerInstance.removeAllEnemies();
    } else {
        logger.warn("[LevelManager] EnemyManager instance not set, cannot remove enemies.");
    }

    // Signal AssetManager to dispose level-specific assets
    logger.info("[LevelManager] Disposing level-specific assets...");
    AssetManager.disposeLevelAssets(); // Called directly via namespace

    // Double-check that everything is cleared
    if (chunkManagerInstance && chunkManagerInstance.getLoadedChunksCount && chunkManagerInstance.getLoadedChunksCount() > 0) {
        logger.warn(`[LevelManager] After cleanup, ${chunkManagerInstance.getLoadedChunksCount()} chunks still loaded. Forcing another cleanup...`);
        chunkManagerInstance.clearAllChunks();
    }

    if (enemyManagerInstance && enemyManagerInstance.getActiveEnemiesCount && enemyManagerInstance.getActiveEnemiesCount() > 0) {
        logger.warn(`[LevelManager] After cleanup, ${enemyManagerInstance.getActiveEnemiesCount()} enemies still active. Forcing another cleanup...`);
        enemyManagerInstance.removeAllEnemies();
    }

    // clear any powerups
    eventBus.emit('resetPowerups');

    logger.info(`[LevelManager] Level ${currentLevelId} unloaded successfully.`);
    currentLevelId = null;
    currentLevelConfig = null;
}

/**
 * Gets the list of available levels.
 * @returns {Array<Object>} An array of level objects ({ id: string, name: string }).
 */
export function getAvailableLevels() {
    return AVAILABLE_LEVELS;
}
