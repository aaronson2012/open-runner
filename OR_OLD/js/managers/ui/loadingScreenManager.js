// js/managers/ui/loadingScreenManager.js
import eventBus from '../../core/eventBus.js';
import { GameStates } from '../../core/gameStateManager.js';
import { createLogger } from '../../utils/logger.js';
import { getConfig } from '../../config/config.js';

const logger = createLogger('LoadingScreenManager');

// --- Element References ---
let loadingScreenElement;
let progressBarElement;
let progressTextElement;

/**
 * Initializes the Loading Screen Manager.
 * @returns {boolean} True if initialization is successful.
 */
export function init() {
    logger.info("Initializing LoadingScreenManager...");

    loadingScreenElement = document.getElementById('loadingScreen');
    progressBarElement = document.getElementById('progressBar');
    progressTextElement = document.getElementById('progressText');

    if (!loadingScreenElement || !progressBarElement || !progressTextElement) {
        logger.error("Loading screen elements not found! Check HTML IDs.");
        return false;
    }

    eventBus.subscribe('gameStateChanged', handleGameStateChange);

    logger.info("LoadingScreenManager initialized successfully.");
    return true;
}

/**
 * Handles game state changes to show/hide the loading screen.
 * @param {object} eventData - The event object containing the new state.
 */
function handleGameStateChange({ newState }) {
    if (newState === GameStates.LOADING || newState === GameStates.LOADING_LEVEL || newState === GameStates.LEVEL_TRANSITION) {
        showLoadingScreen();
    } else {
        hideLoadingScreen();
    }
}

/**
 * Shows the loading screen overlay.
 * @param {string} [message='Loading...'] - Optional message to display.
 */
export function showLoadingScreen(message = 'Loading...') {
    if (!loadingScreenElement) return;

    loadingScreenElement.style.transition = 'none';
    loadingScreenElement.style.opacity = '1';
    loadingScreenElement.style.display = 'flex';

    if (progressTextElement) {
        progressTextElement.textContent = message;
    }
    if (progressBarElement) {
        progressBarElement.style.width = '0%';
    }
}

/**
 * Hides the loading screen overlay with a smooth fade out.
 */
export function hideLoadingScreen() {
    if (!loadingScreenElement || loadingScreenElement.style.display === 'none') return;

    const fadeDurationMs = getConfig('ui.LOADING_HIDE_DELAY_MS', 400);
    loadingScreenElement.style.transition = `opacity ${fadeDurationMs / 1000}s ease`;
    loadingScreenElement.style.opacity = '0';

    setTimeout(() => {
        loadingScreenElement.style.display = 'none';
        loadingScreenElement.style.opacity = '1'; // Reset for next time
    }, fadeDurationMs);
}

/**
 * Updates the loading progress bar and text.
 * @param {number} loadedCount - Number of items loaded.
 * @param {number} totalCount - Total number of items to load.
 */
export function updateLoadingProgress(loadedCount, totalCount) {
    const percentage = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;
    if (progressBarElement) {
        progressBarElement.style.width = `${percentage}%`;
    }
    if (progressTextElement) {
        progressTextElement.textContent = `${getConfig('ui.LOADING_TEXT_PREFIX', 'Loading... ')}${percentage.toFixed(0)}${getConfig('ui.LOADING_TEXT_SUFFIX', '%')}`;
    }
}