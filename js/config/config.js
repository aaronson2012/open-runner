// Main configuration file - Imports section configs and registers them with ConfigManager

import configManager from '../utils/configManager.js';
import { createLogger, setGlobalLogLevel, LogLevel } from '../utils/logger.js';
import performanceManager from '../utils/performanceManager.js';


import { worldConfig } from './world.js';
import { terrainConfig } from './terrain.js';
import { playerConfig } from './player.js';
import { cameraConfig } from './camera.js';
import { controlsConfig } from './controls.js';
import { renderingConfig } from './rendering.js';
import { renderingAdvancedConfig } from './renderingAdvanced.js';
import { gameplayConfig } from './gameplay.js';
import { tumbleweedConfig } from './tumbleweed.js';
import { uiConfig } from './ui.js';
import { modelsConfig } from './models.js';
import { particleConfig } from './particles.js';
import { enemyDefaultsConfig } from './enemyDefaults.js';
import { audioConfig } from './audio.js';
import { materialsConfig } from './materials.js';
import { fallbackGeometriesConfig } from './fallbackGeometries.js';
import { debugConfig } from './debug.js';

const logger = createLogger('Config');

const SECTIONS = {
    WORLD: 'world',
    TERRAIN: 'terrain',
    PLAYER: 'player',
    CAMERA: 'camera',
    CONTROLS: 'controls',
    RENDERING: 'rendering',
    GAMEPLAY: 'gameplay',
    TUMBLEWEED: 'tumbleweed',
    UI: 'ui',
    MODELS: 'models',
    PARTICLES: 'particles',
    RENDERING_ADVANCED: 'renderingAdvanced',
    ENEMY_DEFAULTS: 'enemyDefaults',
    AUDIO: 'audio',
    MATERIALS: 'materials',
    FALLBACK_GEOMETRIES: 'fallbackGeometries',
    DEBUG: 'debug'
};


const defaultConfig = {
    DEBUG_MODE: false,
    MAX_DELTA_TIME: 1 / 15, // Max time step allowed
    LEVEL1_TRANSITION_SCORE: 300 // Score needed to transition from level 1
};


configManager.setDefaults(defaultConfig);
configManager.registerConfig(SECTIONS.WORLD, worldConfig);
configManager.registerConfig(SECTIONS.TERRAIN, terrainConfig);
configManager.registerConfig(SECTIONS.PLAYER, playerConfig);
configManager.registerConfig(SECTIONS.CAMERA, cameraConfig);
configManager.registerConfig(SECTIONS.CONTROLS, controlsConfig);
configManager.registerConfig(SECTIONS.RENDERING, renderingConfig);
configManager.registerConfig(SECTIONS.GAMEPLAY, gameplayConfig);
configManager.registerConfig(SECTIONS.TUMBLEWEED, tumbleweedConfig);
configManager.registerConfig(SECTIONS.UI, uiConfig);
configManager.registerConfig(SECTIONS.MODELS, modelsConfig);
configManager.registerConfig(SECTIONS.PARTICLES, particleConfig);
configManager.registerConfig(SECTIONS.RENDERING_ADVANCED, renderingAdvancedConfig);
configManager.registerConfig(SECTIONS.ENEMY_DEFAULTS, enemyDefaultsConfig);
configManager.registerConfig(SECTIONS.AUDIO, audioConfig);
configManager.registerConfig(SECTIONS.MATERIALS, materialsConfig);
configManager.registerConfig(SECTIONS.FALLBACK_GEOMETRIES, fallbackGeometriesConfig);
configManager.registerConfig(SECTIONS.DEBUG, debugConfig);

logger.debug('Game configuration sections registered');

// Signal that all core configurations have been registered
configManager.setInitializationComplete(true);
logger.info('ConfigManager initialization marked as complete.');

const logLevelString = debugConfig.LOG_LEVEL || 'INFO';
if (LogLevel.hasOwnProperty(logLevelString)) {
    setGlobalLogLevel(LogLevel[logLevelString]);
    logger.info(`Set global log level to ${logLevelString}`);
} else {
    logger.warn(`Invalid log level in config: ${logLevelString}, using INFO`);
    setGlobalLogLevel(LogLevel.INFO);
}



/**
 * Gets a configuration value
 * @param {string} key - Configuration key in format "section.key"
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value or default
 */
export function getConfig(key, defaultValue) {
    return configManager.get(key, defaultValue);
}

/**
 * Gets an entire configuration section
 * @param {string} section - Section name (use SECTIONS constants)
 * @returns {Object|null} Configuration section object or null if not found
 */
export function getConfigSection(section) {
    return configManager.getSection(section);
}

/**
 * Updates configuration values within a section
 * @param {string} section - Section name (use SECTIONS constants)
 * @param {Object} updates - Key-value pairs of updates
 * @returns {boolean} Whether the update was successful
 */
export function updateConfig(section, updates) {
    return configManager.updateConfig(section, updates);
}

// Set up performance manager callback to update config when settings change
performanceManager.setOnSettingsChanged((settings) => {
    logger.debug('Updating configuration based on performance settings change...');
    // Update terrain settings
    updateConfig(SECTIONS.TERRAIN, {
        SEGMENTS_X: settings.terrainSegments,
        SEGMENTS_Y: settings.terrainSegments
    });

    // Update world settings
    updateConfig(SECTIONS.WORLD, {
        RENDER_DISTANCE_CHUNKS: settings.renderDistance,
        MAX_OBJECTS_PER_CHUNK: settings.maxObjectsPerChunk
    });

    // Update rendering settings
    updateConfig(SECTIONS.RENDERING, {
        SHADOWS_ENABLED: settings.shadowsEnabled,
        PIXEL_RATIO: settings.pixelRatio,
        ANTIALIAS: settings.antialias
    });

    // Update particle settings
    updateConfig(SECTIONS.PARTICLES, {
        PARTICLE_DENSITY: settings.particleDensity
    });

    // Update advanced rendering (shadow map size)
    const shadowQuality = settings.quality === 'low' ? renderingAdvancedConfig.SHADOW_MAP_SIZE_LOW :
                         settings.quality === 'medium' ? renderingAdvancedConfig.SHADOW_MAP_SIZE_MEDIUM :
                         renderingAdvancedConfig.SHADOW_MAP_SIZE_HIGH; // Default to high for ultra/custom
    updateConfig(SECTIONS.RENDERING_ADVANCED, {
        // Apply shadow map size based on quality setting
        SHADOW_MAP_SIZE: shadowQuality

    });


    logger.debug('Configuration updated based on performance settings');
});

// Export SECTIONS enum for use elsewhere
export { SECTIONS };


export { performanceManager };


export default configManager;

