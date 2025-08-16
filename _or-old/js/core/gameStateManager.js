
import eventBus from './eventBus.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GameStateManager');

/**
 * Enum for all possible game states
 * @readonly
 * @enum {string}
 */
export const GameStates = Object.freeze({
    LOADING: 'loading',
    TITLE: 'title',
    LEVEL_SELECT: 'levelSelect',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver',
    LEVEL_TRANSITION: 'levelTransition',
    LOADING_LEVEL: 'loadingLevel',
    TRANSITIONING_TO_TITLE: 'transitioningToTitle',
    TRANSITIONING_TO_GAMEPLAY: 'transitioningToGameplay'
});

/**
 * GameStateManager class handles state transitions and notifications
 */
export class GameStateManager {
    constructor() {
        /** @private */
        this.currentState = GameStates.LOADING;
        /** @private */
        this.stateHistory = [GameStates.LOADING];
        /** @private */
        this.maxHistoryLength = 10;
        /** @private */
        this.stateChangeTime = Date.now();
    }

    /**
     * Gets the current game state
     * @returns {string} The current game state
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * Gets the previous game state
     * @returns {string|null} The previous state or null if no history
     */
    getPreviousState() {
        if (this.stateHistory.length < 2) {
            return null;
        }
        return this.stateHistory[this.stateHistory.length - 2];
    }

    /**
     * Gets the time (in ms) spent in the current state
     * @returns {number} Milliseconds in current state
     */
    getTimeInCurrentState() {
        return Date.now() - this.stateChangeTime;
    }

    /**
     * Sets the current game state and emits an event if it changes
     * @param {string} newState - The new state to set (should be one of GameStates)
     * @returns {boolean} Whether the state was changed
     */
    setGameState(newState) {
        if (!Object.values(GameStates).includes(newState)) {
            logger.warn(`[GameStateManager] Attempted to set invalid game state: ${newState}`);
            return false;
        }

        if (this.currentState === newState) {
            return false;
        }

        const oldState = this.currentState;
        this.currentState = newState;
        this.stateChangeTime = Date.now();
        this.stateHistory.push(newState);

        if (this.stateHistory.length > this.maxHistoryLength) {
            this.stateHistory.shift();
        }

        eventBus.emit('gameStateChanged', { newState: newState, oldState: oldState });
        return true;
    }

    /**
     * Checks if the current state is one of the provided states
     * @param {...string} states - States to check against
     * @returns {boolean} Whether current state matches any of the provided states
     */
    isInState(...states) {
        return states.includes(this.currentState);
    }

    /**
     * Revert to the previous state if available
     * @returns {boolean} Whether the state was reverted
     */
    revertToPreviousState() {
        if (this.stateHistory.length < 2) {
            logger.warn("[GameStateManager] Cannot revert: No previous state in history.");
            return false;
        }
        const oldState = this.currentState;
        this.stateHistory.pop();
        const newState = this.stateHistory[this.stateHistory.length - 1];
        this.currentState = newState;
        this.stateChangeTime = Date.now();
        eventBus.emit('gameStateChanged', { newState: newState, oldState: oldState });
        return true;
    }

    /** Requests the game to pause */
    requestPause() {
        if (this.currentState === GameStates.PLAYING) {
            logger.info("Requesting Pause state...");
            eventBus.emit('requestPause'); // Let handler change state
        } else {
            logger.warn(`Cannot pause from state: ${this.currentState}`);
        }
    }

    /** Requests the game to resume */
    requestResume() {
        if (this.currentState === GameStates.PAUSED) {
            logger.info("Requesting Resume (Playing) state...");
            eventBus.emit('requestResume'); // Let handler change state
        } else {
            logger.warn(`Cannot resume from state: ${this.currentState}`);
        }
    }

    /** Requests the current level to be restarted */
    requestRestart() {
        // Allow restart from PAUSED or GAME_OVER
        if (this.currentState === GameStates.PAUSED || this.currentState === GameStates.GAME_OVER) {
            logger.info("Requesting Level Restart...");
            eventBus.emit('requestRestart'); // Let handler manage transitions/state
        } else {
            logger.warn(`Cannot restart from state: ${this.currentState}`);
        }
    }

    /** Requests returning to the title screen */
    requestReturnToTitle() {
        // Allow return from PAUSED, GAME_OVER, LEVEL_SELECT
        if (this.currentState === GameStates.PAUSED ||
            this.currentState === GameStates.GAME_OVER ||
            this.currentState === GameStates.LEVEL_SELECT) {
            logger.info("Requesting Return to Title...");
            eventBus.emit('requestReturnToTitle'); // Let handler manage transitions/state
        } else {
            logger.warn(`Cannot return to title from state: ${this.currentState}`);
        }
    }

    /** Requests showing the level select screen */
    requestShowLevelSelect() {
        if (this.currentState === GameStates.TITLE) {
            logger.info("Requesting Show Level Select...");
            eventBus.emit('requestShowLevelSelect'); // Let handler change state
        } else {
            logger.warn(`Cannot show level select from state: ${this.currentState}`);
        }
    }

    /** Initiates the game over sequence */
    requestGameOverSequence() {
        if (this.currentState === GameStates.PLAYING) {
            logger.info("Requesting Game Over sequence...");
            // The 'playerDied' event usually triggers this.
            // Emitting 'playerDied' here might be clearer than a separate event.
            eventBus.emit('playerDied');
        } else {
            logger.warn(`Cannot trigger game over from state: ${this.currentState}`);
        }
    }
}

const gameStateManager = new GameStateManager();
export default gameStateManager;