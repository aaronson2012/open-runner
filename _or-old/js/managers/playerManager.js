import * as THREE from 'three';
import eventBus from '../core/eventBus.js';
import { createLogger } from '../utils/logger.js';
import { gameplayConfig } from '../config/gameplay.js';
import { playWaveFile, effectAudioMap } from './audioManager.js';

const logger = createLogger('PlayerManager');

/**
 * Manages player state, powerups, and related functionality
 */
class PlayerManager {
    constructor(player) {
        this.player = player;
        this.powerupTimeout = null;
        
        logger.info('PlayerManager initialized');
        
        // Set up event subscriptions
        this._setupEventSubscriptions();
    }
    
    /**
     * Set up event subscriptions related to player management
     * @private
     */
    _setupEventSubscriptions() {
        eventBus.subscribe('powerupActivated', this.handlePowerupActivated.bind(this));
        eventBus.subscribe('resetPowerups', this.resetPowerups.bind(this));
        logger.debug('PlayerManager event subscriptions set up');
    }
    
    /**
     * Handle powerup activation
     * @param {string} powerupType - Type of powerup activated
     */
    handlePowerupActivated(powerupType) {
        logger.debug(`[PlayerManager] handlePowerupActivated called with type: ${powerupType}`);
        const wasActive = this.player.powerup === powerupType;
        this.player.powerup = powerupType;
        logger.debug(`[PlayerManager] this.player.powerup set to: ${this.player.powerup}`);
        playWaveFile(effectAudioMap['powerup']);
        
        if (wasActive) {
            logger.info(`${powerupType} powerup already active, extending duration`);
            if (this.powerupTimeout) clearTimeout(this.powerupTimeout);
        } else {
            logger.info(`${powerupType} powerup started!`);
            // Emit event for visual effect
            logger.debug(`[PlayerManager] Emitting applyPowerupEffect for type: ${powerupType}`);
            eventBus.emit('applyPowerupEffect', { type: powerupType, player: this.player });
        }
        
        if (this.powerupTimeout) clearTimeout(this.powerupTimeout);
        
        let duration = gameplayConfig.POWERUP_DURATION * 1000; // Default duration
        if (powerupType === gameplayConfig.POWERUP_TYPE_INVISIBILITY) {
            duration = gameplayConfig.invisibilityConfig.durationMs;
            logger.debug(`Using invisibility specific duration: ${duration}ms`);
        }

        this.powerupTimeout = setTimeout(() => {
            if (this.player.powerup === powerupType) {
                this.player.powerup = '';
                logger.info(`${powerupType} powerup expired!`);
                eventBus.emit('removePowerupEffect', { type: powerupType, player: this.player });
            }
            this.powerupTimeout = null;
        }, duration);
    }
    
    /**
     * Reset all active powerups
     */
    resetPowerups() {
        if (this.player.powerup) {
            const currentPowerup = this.player.powerup;
            this.player.powerup = '';
            logger.debug(`Powerup ${currentPowerup} reset`);
            
            eventBus.emit('removePowerupEffect', { type: currentPowerup, player: this.player });
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
     * Clean up resources when the manager is no longer needed
     */
    cleanup() {
        this.resetPowerups();
        
        // Unsubscribe from events
        eventBus.unsubscribe('powerupActivated', this.handlePowerupActivated);
        eventBus.unsubscribe('resetPowerups', this.resetPowerups);
        
        logger.info('PlayerManager cleaned up');
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