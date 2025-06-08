// js/managers/ui/menuManager.js
import eventBus from '../../core/eventBus.js';
import gameStateManager, { GameStates } from '../../core/gameStateManager.js';
import * as ScoreManager from '../scoreManager.js';
import * as LevelManager from '../levelManager.js';
import { createLogger } from '../../utils/logger.js';
import { getConfig } from '../../config/config.js';

const logger = createLogger('MenuManager');

// --- Element References ---
let gameOverElement;
let gameOverScoreElement;
let gameOverHighScoreElement;
let gameOverRestartButtonElement;
let gameOverTitleButtonElement;
let titleScreenElement;
let startButtonElement;
let levelSelectButtonElement;
let levelSelectScreenElement;
let levelListElement;
let backToTitleButtonElement;
let pauseMenuElement;
let resumeButtonElement;
let restartButtonElement;
let returnToTitleButtonElement;

/**
 * Initializes the Menu Manager by getting references and setting up event listeners.
 * @returns {boolean} True if all essential elements were found, false otherwise.
 */
export function init() {
    logger.info("Initializing MenuManager...");

    // Screen Elements
    titleScreenElement = document.getElementById('titleScreen');
    gameOverElement = document.getElementById('gameOverDisplay');
    levelSelectScreenElement = document.getElementById('levelSelectScreen');
    pauseMenuElement = document.getElementById('pauseMenu');

    // Button Elements
    startButtonElement = document.getElementById('startButton');
    levelSelectButtonElement = document.getElementById('levelSelectButton');
    backToTitleButtonElement = document.getElementById('backToTitleButton');
    resumeButtonElement = document.getElementById('resumeButton');
    restartButtonElement = document.getElementById('restartButton');
    returnToTitleButtonElement = document.getElementById('returnToTitleButton');
    gameOverRestartButtonElement = document.getElementById('gameOverRestartButton');
    gameOverTitleButtonElement = document.getElementById('gameOverTitleButton');

    // Other Elements
    levelListElement = document.getElementById('levelList');
    gameOverScoreElement = document.getElementById('gameOverScore');
    gameOverHighScoreElement = document.getElementById('gameOverHighScore');

    if (!titleScreenElement || !gameOverElement || !levelSelectScreenElement || !pauseMenuElement ||
        !startButtonElement || !levelSelectButtonElement || !backToTitleButtonElement ||
        !resumeButtonElement || !restartButtonElement || !returnToTitleButtonElement ||
        !gameOverRestartButtonElement || !gameOverTitleButtonElement || !levelListElement) {
        logger.error("One or more essential menu UI elements not found! Check HTML IDs.");
        return false;
    }

    eventBus.subscribe('gameStateChanged', handleGameStateChange);
    eventBus.subscribe('gameOver', showGameOverScreenWithScore);

    logger.info("MenuManager initialized successfully.");
    return true;
}

/**
 * Handles game state changes by updating UI visibility.
 * @param {object} eventData - The event object containing newState.
 */
function handleGameStateChange({ newState }) {
    // Hide all menus first
    titleScreenElement.style.display = 'none';
    gameOverElement.style.display = 'none';
    levelSelectScreenElement.style.display = 'none';
    pauseMenuElement.style.display = 'none';

    switch (newState) {
        case GameStates.TITLE:
        case GameStates.TRANSITIONING_TO_TITLE:
            showTitleScreen();
            break;
        case GameStates.LEVEL_SELECT:
            showLevelSelectScreen();
            break;
        case GameStates.PAUSED:
            showPauseMenu();
            break;
        case GameStates.GAME_OVER:
            // The gameOverInfo event handles showing the screen
            break;
    }
}

function showTitleScreen() {
    titleScreenElement.style.display = 'flex';
    titleScreenElement.style.opacity = getConfig('ui.OPACITY_VISIBLE', '1');
    titleScreenElement.style.transition = `opacity ${getConfig('ui.FADE_DURATION_MS', 300) / 1000}s`;
}

function showLevelSelectScreen() {
    levelSelectScreenElement.style.display = 'flex';
    updateUnlockedLevels();
}

function showPauseMenu() {
    pauseMenuElement.style.display = 'flex';
}

function showGameOverScreenWithScore(scoreData) {
    const { score, highScore, isNewHighScore } = scoreData;

    if (isNewHighScore) {
        eventBus.emit('notification', { message: `New High Score: ${highScore}!`, type: 'high-score' });
    }

    if (gameOverElement) {
        if (gameOverScoreElement) {
            gameOverScoreElement.textContent = `${getConfig('ui.SCORE_PREFIX', 'Score: ')}${score}`;
        }
        if (gameOverHighScoreElement) {
            gameOverHighScoreElement.textContent = `${getConfig('ui.HIGH_SCORE_PREFIX', 'High Score: ')}${highScore}`;
        }
        gameOverElement.style.display = 'flex';
    }
}

export function setupStartButton(callback) {
    setupButton(startButtonElement, 'startButton', callback);
}

export function setupLevelSelectButton(callback) {
    setupButton(levelSelectButtonElement, 'levelSelectButton', callback);
}

export function setupBackToTitleButton(callback) {
    setupButton(backToTitleButtonElement, 'backToTitleButton', callback);
}

export function setupPauseMenuButtons(onResume, onRestart, onReturnToTitle) {
    resumeButtonElement = setupButton(resumeButtonElement, 'resumeButton', onResume);
    restartButtonElement = setupButton(restartButtonElement, 'restartButton', onRestart);
    returnToTitleButtonElement = setupButton(returnToTitleButtonElement, 'returnToTitleButton', onReturnToTitle);
}

export function setupGameOverButtons(onRestart, onReturnToTitle) {
    gameOverRestartButtonElement = setupButton(gameOverRestartButtonElement, 'gameOverRestartButton', onRestart);
    gameOverTitleButtonElement = setupButton(gameOverTitleButtonElement, 'gameOverTitleButton', onReturnToTitle);
}

function setupButton(buttonElement, id, callback) {
    if (!buttonElement || !callback) {
        logger.warn(`Button #${id} or its callback is missing for setup.`);
        return null;
    }
    const newButton = buttonElement.cloneNode(true);
    buttonElement.parentNode.replaceChild(newButton, buttonElement);

    const updatedButton = document.getElementById(id);
    if (updatedButton) {
        updatedButton.addEventListener('click', async () => {
            eventBus.emit('uiButtonClicked');
            callback();
        });
        logger.debug(`Event listener added to button #${id}`);
        return updatedButton;
    }
    return null;
}

function updateUnlockedLevels() {
    if (!levelListElement) return;

    levelListElement.innerHTML = '';
    const levelData = LevelManager.getAvailableLevels();

    if (!levelData || levelData.length === 0) {
        logger.error("Could not retrieve level data from LevelManager.");
        return;
    }

    levelData.forEach(data => {
        const levelButton = document.createElement('div');
        levelButton.className = 'level-button';
        const isUnlocked = data.id === 'level1' || ScoreManager.isLevelUnlocked(data.id);

        if (!isUnlocked) {
            levelButton.classList.add('locked');
        }

        const levelName = document.createElement('h3');
        levelName.textContent = data.name || `Level ${data.id}`;

        const levelDesc = document.createElement('p');
        levelDesc.textContent = isUnlocked ? (data.description || '') : getConfig('ui.LOCKED_LEVEL_TEXT', 'Locked');

        levelButton.appendChild(levelName);
        levelButton.appendChild(levelDesc);

        if (isUnlocked) {
            levelButton.addEventListener('click', () => {
                eventBus.emit('uiButtonClicked');
                eventBus.emit('requestLevelTransition', data.id);
            });
        }
        levelListElement.appendChild(levelButton);
    });
}