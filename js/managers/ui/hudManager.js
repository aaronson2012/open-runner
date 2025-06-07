// js/managers/ui/hudManager.js
import eventBus from '../../core/eventBus.js';
import { GameStates } from '../../core/gameStateManager.js';
import * as ScoreManager from '../scoreManager.js';
import { createLogger } from '../../utils/logger.js';
import { getConfig } from '../../config/config.js';

const logger = createLogger('HUDManager');

// --- Element References ---
let scoreElement;
let highScoreElement;

// --- Internal State ---
let currentScore = 0;
let currentHighScore = 0;

/**
 * Initializes the HUD Manager.
 * @returns {boolean} True if initialization is successful.
 */
export function init() {
    logger.info("Initializing HUDManager...");

    scoreElement = document.getElementById('scoreDisplay');
    highScoreElement = document.getElementById('highScoreDisplay');

    if (!scoreElement || !highScoreElement) {
        logger.error("Score or High Score element not found! Check HTML IDs.");
        return false;
    }

    // Create high score element if it doesn't exist
    if (!highScoreElement) {
        highScoreElement = document.createElement('div');
        highScoreElement.id = 'highScoreDisplay';
        highScoreElement.className = 'high-score';
        highScoreElement.style.position = 'fixed';
        highScoreElement.style.top = '15px';
        highScoreElement.style.right = '15px';
        highScoreElement.style.zIndex = '10';
        document.body.appendChild(highScoreElement);
    }

    eventBus.subscribe('gameStateChanged', handleGameStateChange);
    eventBus.subscribe('scoreChanged', updateScore);
    eventBus.subscribe('currentScoreUpdated', checkForLiveHighScore);

    // Set initial state
    hideAll();

    logger.info("HUDManager initialized successfully.");
    return true;
}

/**
 * Handles game state changes to show/hide HUD elements.
 * @param {object} eventData - The event object containing the new state.
 */
function handleGameStateChange({ newState }) {
    if (newState === GameStates.PLAYING) {
        showHUD();
    } else {
        hideAll();
    }
}

/**
 * Shows the main game HUD elements.
 */
function showHUD() {
    updateScoreDisplay(currentScore);
    updateHighScoreDisplay(ScoreManager.getGlobalHighScore());

    const fadeDurationMs = getConfig('ui.FADE_DURATION_MS', 300);
    const opacityVisible = getConfig('ui.OPACITY_VISIBLE', '1');

    if (scoreElement) {
        scoreElement.style.display = 'block';
        scoreElement.style.opacity = opacityVisible;
        scoreElement.style.transition = `opacity ${fadeDurationMs / 1000}s`;
    }

    if (highScoreElement && ScoreManager.getGlobalHighScore() > 0) {
        highScoreElement.style.display = 'block';
        highScoreElement.style.opacity = opacityVisible;
        highScoreElement.style.transition = `opacity ${fadeDurationMs / 1000}s`;
    }
}

/**
 * Hides all HUD elements.
 */
function hideAll() {
    if (scoreElement) scoreElement.style.display = 'none';
    if (highScoreElement) highScoreElement.style.display = 'none';
}

/**
 * Updates the score based on an increment.
 * @param {number} scoreIncrement - The amount to change the score by.
 */
function updateScore(scoreIncrement) {
    if (scoreIncrement < 0) {
        currentScore = 0;
    } else {
        currentScore += scoreIncrement;
    }
    updateScoreDisplay(currentScore);
}

/**
 * Checks if the current score has surpassed the high score and updates the display.
 * @param {object} data - Contains the current score.
 */
function checkForLiveHighScore({ score }) {
    const highScore = ScoreManager.getGlobalHighScore();
    if (score > highScore) {
        updateHighScoreDisplay(score);
        if (highScoreElement) {
            highScoreElement.style.display = 'block';
            highScoreElement.classList.add('high-score-pulse');
            setTimeout(() => {
                highScoreElement.classList.remove('high-score-pulse');
            }, getConfig('ui.PULSE_ANIMATION_DURATION_MS', 1000));
        }
    }
}

/**
 * Updates the score display with a specific value.
 * @param {number} score - The score to display.
 */
function updateScoreDisplay(score) {
    currentScore = score;
    if (scoreElement) {
        const prefix = getConfig('ui.SCORE_PREFIX', 'Score: ');
        scoreElement.textContent = `${prefix}${currentScore}`;
    }
}

/**
 * Updates the high score display.
 * @param {number} highScore - The high score to display.
 */
function updateHighScoreDisplay(highScore) {
    currentHighScore = highScore;
    if (highScoreElement) {
        const prefix = getConfig('ui.HIGH_SCORE_PREFIX', 'High Score: ');
        highScoreElement.textContent = `${prefix}${currentHighScore}`;
    }
}