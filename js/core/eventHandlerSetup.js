import * as THREE from 'three';
import eventBus from './eventBus.js';
import gameStateManager, { GameStates } from './gameStateManager.js';
import { createLogger } from '../utils/logger.js';
import { getConfig } from '../config/config.js';
import { gameplayConfig } from '../config/gameplay.js';
import { grayMaterial } from '../entities/playerCharacter.js';
import { playWaveFile, effectAudioMap } from '../managers/audioManager.js';
import * as ScoreManager from '../managers/scoreManager.js';
import * as LevelManager from '../managers/levelManager.js';
import { initPlayerManager, getPlayerManager } from '../managers/playerManager.js';

const logger = createLogger('EventHandlerSetup');

// Flag to prevent multiple death processing
let playerDeathProcessing = false;

/**
 * Sets up subscriptions to global events via the event bus.
 * Delegates actions to appropriate managers or emits further events.
 * @param {object} dependencies - Object containing necessary dependencies.
 * @param {object} dependencies.player - The player state object.
 * @param {object} dependencies.levelManager - LevelManager instance/module.
 * @param {object} dependencies.scoreManager - ScoreManager instance/module.
 * @param {object} dependencies.cameraManager - CameraManager instance.
 * @param {object} dependencies.sceneTransitionManager - SceneTransitionManager instance.
 * @param {object} dependencies.atmosphericManager - AtmosphericManager instance.
 * @param {function} dependencies.startGameCallback - Function to start a specific level (bound to Game instance).
 * @param {function} dependencies.loadLevelCallback - Function to load a specific level (bound to Game instance).
 * @param {function} dependencies.resetInputStates - Function to reset input states.
 * @param {function} dependencies.updateMobileControlsVisibility - Function to update mobile controls.
 */
export function setupEventHandlers(dependencies) {
    const {
        player,
        levelManager,
        scoreManager,
        uiManager, // Re-added for score display updates
        cameraManager,
        sceneTransitionManager,
        atmosphericManager,
        startGameCallback,
        loadLevelCallback,
        resetInputStates,
        updateMobileControlsVisibility
    } = dependencies;


    if (!player || !levelManager || !scoreManager || !cameraManager || !sceneTransitionManager || !atmosphericManager || !startGameCallback || !loadLevelCallback || !resetInputStates || !updateMobileControlsVisibility) {
        logger.error("Cannot setup event handlers: Missing one or more required dependencies.");
        return;
    }


    if (!uiManager) {
        logger.warn("UIManager not provided to event handlers. Some UI updates may not work properly.");
    }
    
    const playerManager = getPlayerManager();



    eventBus.subscribe('scoreChanged', (scoreIncrement) => {

        const oldScore = ScoreManager.getCurrentScore();


        ScoreManager.updateCurrentScore(scoreIncrement);

        const newScore = ScoreManager.getCurrentScore();
        logger.info(`Score updated: ${oldScore} + ${scoreIncrement} = ${newScore}`);

        const currentLevelId = levelManager.getCurrentLevelId();
        const currentScore = ScoreManager.getSessionScore(); // Use session score for transitions
        const transitionScore = getConfig('LEVEL1_TRANSITION_SCORE', 300);
        const currentState = gameStateManager.getCurrentState();


        if (currentLevelId === 'level1' && currentState === GameStates.PLAYING) {

            if (currentScore >= transitionScore) {
                logger.info(`Score threshold reached (${currentScore}/${transitionScore}), transitioning to level2`);


                setTimeout(() => {

                    if (gameStateManager.getCurrentState() === GameStates.PLAYING) {

                        gameStateManager.setGameState(GameStates.LEVEL_TRANSITION);


                        logger.info('Ensuring complete cleanup of level1 before transitioning to level2');
                        if (levelManager.getCurrentLevelId() === 'level1') {
                            levelManager.unloadCurrentLevel();
                        }

                        // Reset current score but preserve session score for level 2
                        ScoreManager.resetCurrentScore(false); // false = don't reset session score

                        startGameCallback('level2');
                    }
                }, 100);
            }
        }
    });

    // Powerup management has been moved to PlayerManager
    // eventBus.subscribe('powerupActivated') is now handled by PlayerManager
    // eventBus.subscribe('resetPowerups') is now handled by PlayerManager

    eventBus.subscribe('playerDied', () => {
        logger.info("Player Died event received.");
        
        // Prevent multiple death processing
        if (playerDeathProcessing) {
            logger.info("Player death already being processed, ignoring duplicate event.");
            return;
        }
        
        playerDeathProcessing = true;
        logger.info("Setting playerDeathProcessing flag to true.");
        
        // Defer player death processing by one frame to ensure all score events are processed first
        setTimeout(() => {
            const currentLevelId = levelManager.getCurrentLevelId();
            const currentScore = ScoreManager.getCurrentScore(); // Use imported module
            
            logger.info(`Processing player death with final score: ${currentScore}`);
            
            // Pass true as the third parameter to emit the new high score event only at game over
            const isNewHighScore = ScoreManager.updateHighScore(currentScore, currentLevelId, true);
            const highScore = ScoreManager.getGlobalHighScore();

            logger.info(`High score calculation: current=${currentScore}, high=${highScore}, isNew=${isNewHighScore}`);
            
            // Additional debugging: check localStorage values
            const storedGlobalHighScore = localStorage.getItem('openRunner_highScore');
            const storedLevelScores = localStorage.getItem('openRunner_highScoresByLevel');
            logger.info(`Stored high scores - global: ${storedGlobalHighScore}, levels: ${storedLevelScores}`);

            gameStateManager.setGameState(GameStates.GAME_OVER);

            // Reset powerups through PlayerManager
            playerManager.resetPowerups();

            eventBus.emit('gameOver', {
                score: currentScore,
                highScore: highScore,
                levelId: currentLevelId,
                isNewHighScore: isNewHighScore
            });
        }, 10); // Use setTimeout with small delay to ensure all score events are processed
    });

    eventBus.subscribe('gameStateChanged', ({ newState, oldState }) => {
        logger.info(`Observed state changed to: ${newState} from ${oldState}`);

        if (newState === GameStates.TITLE) {
            // Reset death processing flag when returning to title
            playerDeathProcessing = false;
            logger.info("Reset playerDeathProcessing flag to false.");
            
            ScoreManager.resetCurrentScore();

            if (uiManager) {
                uiManager.updateScoreDisplay(0);
            }

            // Reset powerups through PlayerManager
            playerManager.resetPowerups();
        } else if (newState === GameStates.PLAYING) {
            // Reset death processing flag when starting to play
            playerDeathProcessing = false;
            logger.info("Reset playerDeathProcessing flag to false for new game.");
        }
    });

    eventBus.subscribe('requestLevelTransition', (levelId) => {
        logger.info(`Received requestLevelTransition event for: ${levelId}`);
        try {

            gameStateManager.setGameState(GameStates.LEVEL_TRANSITION);


            const currentLevelId = levelManager.getCurrentLevelId();
            if (currentLevelId && currentLevelId !== levelId) {
                logger.info(`Ensuring complete cleanup of level ${currentLevelId} before transitioning to ${levelId}`);
                levelManager.unloadCurrentLevel();
            }


            startGameCallback(levelId);
        } catch (error) {
            logger.error(`Error during level transition to ${levelId}:`, error);

            gameStateManager.setGameState(GameStates.TITLE);
        }
    });

    eventBus.subscribe('requestPause', () => {
        logger.info("Received requestPause event");
        resetInputStates();
        gameStateManager.setGameState(GameStates.PAUSED);
    });

    eventBus.subscribe('requestResume', () => {
        logger.info("Received requestResume event");
        resetInputStates();
        gameStateManager.setGameState(GameStates.PLAYING);
    });

     eventBus.subscribe('requestRestart', () => {
        logger.info("Received requestRestart event");
        const currentLevelId = levelManager.getCurrentLevelId();
        if (currentLevelId && !sceneTransitionManager.getIsTransitioning() && !cameraManager.getIsTransitioning()) {
            resetInputStates();
            updateMobileControlsVisibility();
            eventBus.emit('uiButtonClicked');
            startGameCallback(currentLevelId);
        } else if (sceneTransitionManager.getIsTransitioning() || cameraManager.getIsTransitioning()) {
            logger.warn("Cannot restart: Transition in progress.");
        } else {
            logger.error("Cannot restart: Current level ID not found.");
        }
    });

     eventBus.subscribe('requestReturnToTitle', () => {
        logger.info("Received requestReturnToTitle event");
        if (sceneTransitionManager.getIsTransitioning() || cameraManager.getIsTransitioning()) {
            logger.warn("Cannot return to title: Transition in progress.");
            return;
        }
        eventBus.emit('uiButtonClicked');
        updateMobileControlsVisibility(false, true); // Force hide
        atmosphericManager.clearElements();

        // Get the current state before changing it
        const currentState = gameStateManager.getCurrentState();

        // Reset score
        ScoreManager.resetCurrentScore();
        // Also directly update the UI score display to ensure it's reset
        if (dependencies.uiManager) {
            dependencies.uiManager.updateScoreDisplay(0);
        }
        logger.debug("Score reset when returning to title");

        // clear powerups
        playerManager.resetPowerups();

        // Only start camera transition if NOT coming from LEVEL_SELECT
        if (currentState !== GameStates.LEVEL_SELECT) {
            cameraManager.startTransitionToTitle(cameraManager.getCamera().position, cameraManager.getCamera().quaternion);
        }

        // Player model removal should happen here or be triggered by the state change
        if (player.model && player.model.parent) {
            player.model.parent.remove(player.model);
        }

        // Set appropriate state
        if (currentState === GameStates.LEVEL_SELECT) {
            gameStateManager.setGameState(GameStates.TITLE);
        } else {
            gameStateManager.setGameState(GameStates.TRANSITIONING_TO_TITLE);
        }
    });

     eventBus.subscribe('requestShowLevelSelect', () => {
        logger.info("Received requestShowLevelSelect event");
         if (sceneTransitionManager.getIsTransitioning() || cameraManager.getIsTransitioning()) {
            logger.warn("Cannot show level select: Transition in progress.");
            return;
        }
        gameStateManager.setGameState(GameStates.LEVEL_SELECT);
    });


    eventBus.subscribe('cameraTransitionComplete', (transitionType) => {
        if (transitionType === 'toTitle') {
            logger.info("Camera transition to title complete, setting state to TITLE.");

            // The gameStateChanged event handler will handle additional cleanup
            // when the state changes to TITLE
            gameStateManager.setGameState(GameStates.TITLE);
        } else if (transitionType === 'toGameplay') {
             logger.info("Camera transition to gameplay complete, setting state to PLAYING.");
             gameStateManager.setGameState(GameStates.PLAYING);
             // The camera manager now handles the smooth transition internally
             // by storing the last position and using it in the first frame
             logger.debug("Camera transition to gameplay complete, state set to PLAYING.");
        }
    });

    logger.info("Event subscriptions set up.");
}
