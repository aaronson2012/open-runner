import * as THREE from 'three';
import { BaseManager } from './BaseManager.js';
import { gameplayConfig } from '../config/gameplay.js';
import { playWaveFile, effectAudioMap } from './audioManager.js';
import powerupNotificationManager from './ui/powerupNotificationManager.js';

/**
 * Manages player state, powerups, and related functionality
 */
class PlayerManager extends BaseManager {
    constructor(player) {
        super('PlayerManager');
        this.player = player;
        this.powerupTimeout = null;
        
        // Store player directly for compatibility and set up events
        if (player) {
            this.isInitialized = true;
            this.setupEventSubscriptions();
        }
    }
    
    /**
     * Validate player dependency
     */
    validateDependencies(config) {
        if (!config.player) {
            this.logger.error('PlayerManager requires a player object');
            return false;
        }
        return true;
    }

    /**
     * Setup player management
     */
    async setupManager(config) {
        this.player = config.player;
        return true;
    }
    
    /**
     * Set up event subscriptions related to player management
     */
    setupEventSubscriptions() {
        this.subscribeToEvent('powerupCollected', this.handlePowerupCollected);
        this.subscribeToEvent('resetPowerups', this.resetPowerups);
        this.logger.debug('PlayerManager event subscriptions set up');
    }

    /**
     * Handle powerup activation
     * @param {string} powerupType - Type of powerup activated
     */
    handlePowerupCollected({ type }) {
        const powerupType = type;
        const wasActive = this.player.powerup === powerupType;
        this.player.powerup = powerupType;
        playWaveFile(effectAudioMap['powerup']);

        if (wasActive) {
            logger.info(`${powerupType} powerup already active, extending duration`);
            if (this.powerupTimeout) clearTimeout(this.powerupTimeout);
        } else {
            logger.info(`${powerupType} powerup started!`);
            eventBus.emit('powerupActivated', { type: powerupType, player: this.player });
        }

        if (this.powerupTimeout) clearTimeout(this.powerupTimeout);

        this.powerupTimeout = setTimeout(() => {
            if (this.player.powerup === powerupType) {
                this.player.powerup = '';
                logger.info(`${powerupType} powerup expired!`);
                eventBus.emit('powerupDeactivated', { type: powerupType, player: this.player });
            }
            this.powerupTimeout = null;
        }, gameplayConfig.POWERUP_DURATION * 1000);
    }

    /**
     * Reset all active powerups
     */
    resetPowerups() {
        if (this.player.powerup) {
            const currentPowerup = this.player.powerup;
            this.player.powerup = '';
            logger.debug(`Powerup ${currentPowerup} reset`);

            eventBus.emit('powerupDeactivated', { type: currentPowerup, player: this.player });
        }

        if (this.powerupTimeout) {
            clearTimeout(this.powerupTimeout);
            this.powerupTimeout = null;
            logger.debug("Powerup timeout cleared");
        }
    }
    
    /**
     * Check if player has an active powerup
     * @param {string} [type] - Optional specific powerup type to check for
     * @returns {boolean} True if player has the specified powerup (or any if type not specified)
     */
    hasPowerup(type) {
        if (type) {
            return this.player.powerup === type;
        }
        return Boolean(this.player.powerup);
    }
    
    /**
     * Get the current active powerup type
     * @returns {string} Current powerup type or empty string if none
     */
    getCurrentPowerup() {
        return this.player.powerup;
    }
    
    /**
     * Clean up player manager resources
     */
    cleanupManager() {
        this.resetPowerups();
        this.player = null;
    }
}

// Singleton instance
let playerManagerInstance = null;

/**
 * Initialize the PlayerManager with a player object
 * @param {object} player - The player object to manage
 * @returns {PlayerManager} The PlayerManager instance
 */
export function initPlayerManager(player) {
    if (!playerManagerInstance) {
        playerManagerInstance = new PlayerManager(player);
    } else {
        logger.warn('PlayerManager already initialized, returning existing instance');
    }
    return playerManagerInstance;
}

/**
 * Get the PlayerManager instance
 * @returns {PlayerManager|null} The PlayerManager instance or null if not initialized
 */
export function getPlayerManager() {
    if (!playerManagerInstance) {
        logger.warn('PlayerManager not initialized, call initPlayerManager first');
    }
    return playerManagerInstance;
}

/**
 * Reset the PlayerManager instance (for testing or level resets)
 */
export function resetPlayerManager() {
    if (playerManagerInstance) {
        playerManagerInstance.cleanup();
        playerManagerInstance = null;
        logger.debug('PlayerManager instance reset');
    }
}

export default {
    initPlayerManager,
    getPlayerManager,
    resetPlayerManager
};