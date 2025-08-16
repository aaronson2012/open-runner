// js/managers/scoreManager.js
import eventBus from '../core/eventBus.js'; // Moved to core
import { createLogger } from '../utils/logger.js';
import * as LevelManager from './levelManager.js'; // Import LevelManager

const logger = createLogger('ScoreManager');

// Constants
const HIGH_SCORE_KEY = 'openRunner_highScore';
const HIGH_SCORES_BY_LEVEL_KEY = 'openRunner_highScoresByLevel';

// In-memory cache
let globalHighScore = 0;
let highScoresByLevel = {};
let currentScore = 0; // Add state for current score

/**
 * Initialize the score manager
 * Loads high scores from localStorage if available
 */
export function init() {
    logger.debug('Initializing ScoreManager');
    loadHighScores();
    currentScore = 0; // Ensure score is reset on init
}

/**
 * Load high scores from localStorage
 */
export function loadHighScores() {
    try {
        // Load global high score
        const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY);
        if (storedHighScore !== null) {
            globalHighScore = parseInt(storedHighScore, 10);
            logger.debug(`Loaded global high score: ${globalHighScore}`);
        }

        // Load level-specific high scores
        const storedLevelScores = localStorage.getItem(HIGH_SCORES_BY_LEVEL_KEY);
        if (storedLevelScores !== null) {
            highScoresByLevel = JSON.parse(storedLevelScores);
            logger.debug('Loaded level-specific high scores', highScoresByLevel);
        }
    } catch (error) {
        logger.error('Error loading high scores from localStorage:', error);
        // If there's an error, we'll just use the default values (0)
    }
}

/**
 * Save high scores to localStorage
 */
export function saveHighScores() {
    try {
        // Save global high score
        localStorage.setItem(HIGH_SCORE_KEY, globalHighScore.toString());

        // Save level-specific high scores
        localStorage.setItem(HIGH_SCORES_BY_LEVEL_KEY, JSON.stringify(highScoresByLevel));

        logger.debug('High scores saved to localStorage');
    } catch (error) {
        logger.error('Error saving high scores to localStorage:', error);
    }
}

/**
 * Get the current live score for the session.
 * @returns {number} The current score.
 */
export function getCurrentScore() {
    return currentScore;
}

/**
 * Resets the current live score to 0.
 * Emits 'currentScoreUpdated' event to update UI.
 */
export function resetCurrentScore() {
    currentScore = 0;
    logger.debug('Current score reset to 0');

    // Emit event to update UI
    eventBus.emit('currentScoreUpdated', {
        score: 0,
        levelId: LevelManager.getCurrentLevelId()
    });
}

/**
 * Updates the current live score by adding an increment.
 * Emits 'currentScoreUpdated' event.
 * @param {number} increment - The amount to add to the score.
 */
export function updateCurrentScore(increment) {
    if (typeof increment !== 'number' || isNaN(increment)) {
        logger.warn(`Invalid score increment received: ${increment}`);
        return;
    }

    currentScore += increment;
    logger.debug(`Score updated by ${increment}. New score: ${currentScore}`);

    // Emit event for UI and other listeners
    eventBus.emit('currentScoreUpdated', {
        score: currentScore,
        levelId: LevelManager.getCurrentLevelId()
    });
}


/**
 * Get the global high score
 * @returns {number} The global high score
 */
export function getGlobalHighScore() {
    return globalHighScore;
}

/**
 * Get the high score for a specific level
 * @param {string} levelId - The level ID
 * @returns {number} The high score for the level, or 0 if not set
 */
export function getLevelHighScore(levelId) {
    return highScoresByLevel[levelId] || 0;
}

/**
 * Check if a score is a new high score (globally)
 * @param {number} score - The score to check
 * @returns {boolean} Whether the score is a new high score
 */
export function isNewGlobalHighScore(score) {
    return score > globalHighScore;
}

/**
 * Check if a score is a new high score for a specific level
 * @param {number} score - The score to check
 * @param {string} levelId - The level ID
 * @returns {boolean} Whether the score is a new high score for the level
 */
export function isNewLevelHighScore(score, levelId) {
    const currentLevelHighScore = getLevelHighScore(levelId);
    return score > currentLevelHighScore;
}

/**
 * Update the high score if the current score is higher
 * @param {number} score - The score to check against high scores
 * @param {string} levelId - The level ID (optional, for level-specific high score)
 * @param {boolean} emitEvent - Whether to emit the newHighScore event (default: false)
 * @returns {boolean} Whether a new high score was set
 */
export function updateHighScore(score, levelId = null, emitEvent = false) {
    let isNewHighScore = false;

    // Update global high score if needed
    if (isNewGlobalHighScore(score)) {
        globalHighScore = score;
        isNewHighScore = true;
        logger.debug(`New global high score set: ${score}`);
    }

    // Update level-specific high score if provided
    if (levelId && isNewLevelHighScore(score, levelId)) {
        highScoresByLevel[levelId] = score;
        isNewHighScore = true; // It's a new high score for *something*
        logger.debug(`New high score for level ${levelId}: ${score}`);
    }

    // Save to localStorage if any high score was updated
    if (isNewHighScore) {
        saveHighScores();

        // Only emit event if explicitly requested (will be used at game over)
        if (emitEvent) {
            eventBus.emit('newHighScore', {
                score: score,
                levelId: levelId // Pass levelId so listeners know context
            });
        }
    }

    return isNewHighScore;
}

/**
 * Check if a level is unlocked for play
 * @param {string} levelId - The level ID to check
 * @returns {boolean} Whether the level is unlocked
 */
export function isLevelUnlocked(levelId) {
    // Level 1 is always unlocked
    if (levelId === 'level1') {
        return true;
    }

    // For level2, check if player has a score in level1
    if (levelId === 'level2') {
        return highScoresByLevel['level1'] > 0 || globalHighScore > 0;
    }

    // For future levels, can implement more complex unlocking logic
    // For now, default to false for any unknown levels
    logger.warn(`Unknown level ID in isLevelUnlocked: ${levelId}`);
    return false;
}

// Initialize on module load
init();