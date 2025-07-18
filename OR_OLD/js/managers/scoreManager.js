// js/managers/scoreManager.js
import { BaseManager } from './BaseManager.js';
import * as LevelManager from './levelManager.js'; // Import LevelManager
import { debugConfig } from '../config/debug.js';

// Constants
const HIGH_SCORE_KEY = 'openRunner_highScore';
const HIGH_SCORES_BY_LEVEL_KEY = 'openRunner_highScoresByLevel';

// In-memory cache
let globalHighScore = 0;
let highScoresByLevel = {};
let currentScore = 0; // Add state for current score
let sessionScore = 0; // Track cumulative score across levels in a session

class ScoreManager extends BaseManager {
    constructor() {
        super('ScoreManager');
        this.globalHighScore = 0;
        this.highScoresByLevel = {};
        this.currentScore = 0;
        this.sessionScore = 0;
    }

    /**
     * Setup score manager
     */
    async setupManager(config) {
        this.loadHighScores();
        this.currentScore = 0; // Ensure score is reset on init
        this.sessionScore = 0; // Reset session score on init
        return true;
    }

    /**
     * Load high scores from localStorage
     */
    loadHighScores() {
        try {
            // Load global high score
            const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY);
            if (storedHighScore !== null) {
                this.globalHighScore = parseInt(storedHighScore, 10);
                this.logger.debug(`Loaded global high score: ${this.globalHighScore}`);
            }

            // Load level-specific high scores
            const storedLevelScores = localStorage.getItem(HIGH_SCORES_BY_LEVEL_KEY);
            if (storedLevelScores !== null) {
                this.highScoresByLevel = JSON.parse(storedLevelScores);
                this.logger.debug('Loaded level-specific high scores', this.highScoresByLevel);
            }
        } catch (error) {
            this.logger.error('Error loading high scores from localStorage:', error);
            // If there's an error, we'll just use the default values (0)
        }
    }

    /**
     * Save high scores to localStorage
     */
    saveHighScores() {
        try {
            // Save global high score
            localStorage.setItem(HIGH_SCORE_KEY, this.globalHighScore.toString());

            // Save level-specific high scores
            localStorage.setItem(HIGH_SCORES_BY_LEVEL_KEY, JSON.stringify(this.highScoresByLevel));

            this.logger.debug('High scores saved to localStorage');
        } catch (error) {
            this.logger.error('Error saving high scores to localStorage:', error);
        }
    }

    /**
     * Get the current live score for the session.
     * @returns {number} The current score.
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Get the session score (cumulative across levels).
     * @returns {number} The session score.
     */
    getSessionScore() {
        return this.sessionScore;
    }

    /**
     * Resets the current live score to 0.
     * Emits 'currentScoreUpdated' event to update UI.
     * @param {boolean} resetSession - Whether to also reset the session score (default: true)
     */
    resetCurrentScore(resetSession = true) {
        this.currentScore = 0;
        if (resetSession) {
            this.sessionScore = 0;
            this.logger.debug('Current and session score reset to 0');
        } else {
            this.logger.debug('Current score reset to 0, session score preserved');
        }

        // Emit event to update UI
        import('../core/eventBus.js').then(({ default: eventBus }) => {
            eventBus.emit('currentScoreUpdated', {
                score: this.currentScore,
                sessionScore: this.sessionScore,
                levelId: LevelManager.getCurrentLevelId()
            });
        });
    }

    /**
     * Updates the current live score by adding an increment.
     * Emits 'currentScoreUpdated' event.
     * @param {number} increment - The amount to add to the score.
     */
    updateCurrentScore(increment) {
        if (typeof increment !== 'number' || isNaN(increment)) {
            this.logger.warn(`Invalid score increment received: ${increment}`);
            return;
        }

        this.currentScore += increment;
        this.sessionScore += increment;
        
        // Enforce maximum session score of 600 points
        if (this.sessionScore > 600) {
            const excess = this.sessionScore - 600;
            this.currentScore -= excess;
            this.sessionScore = 600;
            this.logger.warn(`Session score capped at 600. Excess ${excess} points discarded.`);
        }
        
        this.logger.info(`Score updated by ${increment}. Current: ${this.currentScore}, Session: ${this.sessionScore}`);

        // Emit event for UI and other listeners
        import('../core/eventBus.js').then(({ default: eventBus }) => {
            eventBus.emit('currentScoreUpdated', {
                score: this.currentScore,
                sessionScore: this.sessionScore,
                levelId: LevelManager.getCurrentLevelId()
            });
        });
    }

    /**
     * Get the global high score
     * @returns {number} The global high score
     */
    getGlobalHighScore() {
        this.logger.debug(`getGlobalHighScore() returning: ${this.globalHighScore}`);
        return this.globalHighScore;
    }

    /**
     * Get the high score for a specific level
     * @param {string} levelId - The level ID
     * @returns {number} The high score for the level, or 0 if not set
     */
    getLevelHighScore(levelId) {
        return this.highScoresByLevel[levelId] || 0;
    }

    /**
     * Check if a score is a new high score (globally)
     * @param {number} score - The score to check
     * @returns {boolean} Whether the score is a new high score
     */
    isNewGlobalHighScore(score) {
        return score > this.globalHighScore;
    }

    /**
     * Check if a score is a new high score for a specific level
     * @param {number} score - The score to check
     * @param {string} levelId - The level ID
     * @returns {boolean} Whether the score is a new high score for the level
     */
    isNewLevelHighScore(score, levelId) {
        const currentLevelHighScore = this.getLevelHighScore(levelId);
        return score > currentLevelHighScore;
    }

    /**
     * Update the high score if the current score is higher
     * @param {number} score - The score to check against high scores
     * @param {string} levelId - The level ID (optional, for level-specific high score)
     * @param {boolean} emitEvent - Whether to emit the newHighScore event (default: false)
     * @returns {boolean} Whether a new high score was set
     */
    updateHighScore(score, levelId = null, emitEvent = false) {
        let isNewHighScore = false;


        if (this.isNewGlobalHighScore(score)) {
            const oldGlobalHighScore = this.globalHighScore;
            this.globalHighScore = score;
            isNewHighScore = true;
            this.logger.info(`New global high score set: ${oldGlobalHighScore} -> ${score}`);
        } else {
            this.logger.info(`Score ${score} is not a new global high score (current: ${this.globalHighScore})`);
        }

        // Update level-specific high score if provided
        if (levelId && this.isNewLevelHighScore(score, levelId)) {
            this.highScoresByLevel[levelId] = score;
            isNewHighScore = true; // It's a new high score for *something*
            this.logger.debug(`New high score for level ${levelId}: ${score}`);
        }

        // Save to localStorage if any high score was updated
        if (isNewHighScore) {
            this.saveHighScores();

            // Only emit event if explicitly requested (will be used at game over)
            if (emitEvent) {
                import('../core/eventBus.js').then(({ default: eventBus }) => {
                    eventBus.emit('newHighScore', {
                        score: score,
                        levelId: levelId // Pass levelId so listeners know context
                    });
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
    isLevelUnlocked(levelId) {
        // Check debug option first
        if (debugConfig.UNLOCK_ALL_LEVELS) {
            return true;
        }

        // Level 1 is always unlocked
        if (levelId === 'level1') {
            return true;
        }

        // For level2, check if player has achieved 300 points in session
        if (levelId === 'level2') {
            return this.sessionScore >= 300;
        }

        // For future levels, can implement more complex unlocking logic
        // For now, default to false for any unknown levels
        this.logger.warn(`Unknown level ID in isLevelUnlocked: ${levelId}`);
        return false;
    }
}

// Create singleton instance
const scoreManager = new ScoreManager();

// Initialize immediately
scoreManager.init();

// Export functions that maintain existing API
export function init() {
    return scoreManager.init();
}

export function loadHighScores() {
    return scoreManager.loadHighScores();
}

export function saveHighScores() {
    return scoreManager.saveHighScores();
}

export function getCurrentScore() {
    return scoreManager.getCurrentScore();
}

export function getSessionScore() {
    return scoreManager.getSessionScore();
}

export function resetCurrentScore(resetSession = true) {
    return scoreManager.resetCurrentScore(resetSession);
}

export function updateCurrentScore(increment) {
    return scoreManager.updateCurrentScore(increment);
}

export function getGlobalHighScore() {
    return scoreManager.getGlobalHighScore();
}

export function getLevelHighScore(levelId) {
    return scoreManager.getLevelHighScore(levelId);
}

export function isNewGlobalHighScore(score) {
    return scoreManager.isNewGlobalHighScore(score);
}

export function isNewLevelHighScore(score, levelId) {
    return scoreManager.isNewLevelHighScore(score, levelId);
}

export function updateHighScore(score, levelId = null, emitEvent = false) {
    return scoreManager.updateHighScore(score, levelId, emitEvent);
}

export function isLevelUnlocked(levelId) {
    return scoreManager.isLevelUnlocked(levelId);
}