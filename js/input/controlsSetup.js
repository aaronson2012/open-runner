import gameStateManager, { GameStates } from '../core/gameStateManager.js';
import * as UIManager from '../managers/uiManager.js';
import eventBus from '../core/eventBus.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ControlsSetup');

// Variables to track keyboard steering keys
export let keyLeftPressed = false;
export let keyRightPressed = false;


export let mouseLeftPressed = false;
export let mouseRightPressed = false;


export let touchLeftPressed = false;
export let touchRightPressed = false;


/**
 * Resets all input state variables to their default (unpressed) state.
 * This is important when transitioning between game states to prevent
 * inputs from persisting across state changes (e.g., when pausing/resuming).
 */
export function resetInputStates() {
    keyLeftPressed = false;
    keyRightPressed = false;
    mouseLeftPressed = false;
    mouseRightPressed = false;
    touchLeftPressed = false;
    touchRightPressed = false;
}


let keydownListener = null;
let keyupListener = null;
let mousedownListener = null;
let mouseupListener = null;
let contextmenuListener = null;


let mobileLeftTouchStartListener = null;
let mobileLeftTouchEndListener = null;
let mobileRightTouchStartListener = null;
let mobileRightTouchEndListener = null;
let mobilePauseTouchListener = null;

export function setupPlayerControls(canvasElement) {

    if (keydownListener) {
        document.removeEventListener('keydown', keydownListener);
    }
    if (keyupListener) {
        document.removeEventListener('keyup', keyupListener);
    }
    if (mousedownListener && canvasElement) {
        canvasElement.removeEventListener('mousedown', mousedownListener);
    }
    if (mouseupListener && canvasElement) {
        canvasElement.removeEventListener('mouseup', mouseupListener);
    }
    if (contextmenuListener && canvasElement) {
        canvasElement.removeEventListener('contextmenu', contextmenuListener);
    }


    try {
        const mobileLeftBtn = document.getElementById('mobileLeftBtn');
        const mobileRightBtn = document.getElementById('mobileRightBtn');
        const mobilePauseBtn = document.getElementById('mobilePauseBtn');

        if (mobileLeftTouchStartListener && mobileLeftBtn) {
            mobileLeftBtn.removeEventListener('touchstart', mobileLeftTouchStartListener);
            mobileLeftBtn.removeEventListener('touchend', mobileLeftTouchEndListener);
        }
        if (mobileRightTouchStartListener && mobileRightBtn) {
            mobileRightBtn.removeEventListener('touchstart', mobileRightTouchStartListener);
            mobileRightBtn.removeEventListener('touchend', mobileRightTouchEndListener);
        }
        if (mobilePauseTouchListener && mobilePauseBtn) {
            mobilePauseBtn.removeEventListener('touchstart', mobilePauseTouchListener);
        }
    } catch (error) {
        logger.error("[Controls] Error cleaning up mobile controls:", error);

    }


    keydownListener = (event) => {
        switch (event.key.toLowerCase()) {
            case 'a':
            case 'arrowleft':
                keyLeftPressed = true;
                break;
            case 'd':
            case 'arrowright':
                keyRightPressed = true;
                break;
        }
    };

    document.addEventListener('keydown', keydownListener);

    keyupListener = (event) => {
        switch (event.key.toLowerCase()) {
            case 'a':
            case 'arrowleft':
                keyLeftPressed = false;
                break;
            case 'd':
            case 'arrowright':
                keyRightPressed = false;
                break;
        }
    };

    document.addEventListener('keyup', keyupListener);


    mousedownListener = (event) => {
        switch (event.button) {
            case 0: // Left Mouse Button
                mouseLeftPressed = true;
                break;
            case 2: // Right Mouse Button
                mouseRightPressed = true;
                event.preventDefault(); // Prevent context menu
                break;
        }
    };

    canvasElement.addEventListener('mousedown', mousedownListener);

    mouseupListener = (event) => {
        switch (event.button) {
            case 0: // Left Mouse Button
                mouseLeftPressed = false;
                break;
            case 2: // Right Mouse Button
                mouseRightPressed = false;
                break;
        }
    };

    canvasElement.addEventListener('mouseup', mouseupListener);


    contextmenuListener = (event) => {
        event.preventDefault();
    };

    canvasElement.addEventListener('contextmenu', contextmenuListener);


    try {
        const mobileLeftBtn = document.getElementById('mobileLeftBtn');
        const mobileRightBtn = document.getElementById('mobileRightBtn');
        const mobilePauseBtn = document.getElementById('mobilePauseBtn');

        if (mobileLeftBtn && mobileRightBtn && mobilePauseBtn) {


            mobileLeftTouchStartListener = (event) => {
                event.preventDefault(); // Prevent default touch behavior
                touchLeftPressed = true;
            };

            mobileLeftTouchEndListener = (event) => {
                event.preventDefault();
                touchLeftPressed = false;
            };


            mobileRightTouchStartListener = (event) => {
                event.preventDefault();
                touchRightPressed = true;
            };

            mobileRightTouchEndListener = (event) => {
                event.preventDefault();
                touchRightPressed = false;
            };


            mobilePauseTouchListener = (event) => {
                event.preventDefault();
                const currentState = gameStateManager.getCurrentState();

                if (currentState === GameStates.PLAYING) {
                    eventBus.emit('requestPause');
                } else if (currentState === GameStates.PAUSED) {
                    eventBus.emit('requestResume');
                }
            };


            mobileLeftBtn.addEventListener('touchstart', mobileLeftTouchStartListener, { passive: false });
            mobileLeftBtn.addEventListener('touchend', mobileLeftTouchEndListener, { passive: false });
            mobileRightBtn.addEventListener('touchstart', mobileRightTouchStartListener, { passive: false });
            mobileRightBtn.addEventListener('touchend', mobileRightTouchEndListener, { passive: false });
            mobilePauseBtn.addEventListener('touchstart', mobilePauseTouchListener, { passive: false });
        } else {
            logger.warn("[Controls] Mobile control buttons not found in the DOM");
        }
    } catch (error) {
        logger.error("[Controls] Error setting up mobile controls:", error);

    }

}



/**
 * Initialize event listeners for game state changes to handle input resets.
 * This should be called once during game initialization.
 */
export function initInputStateManager() {
    // Subscribe to game state changes to reset inputs when pausing/resuming or restarting from game over
    eventBus.subscribe('gameStateChanged', ({ newState, oldState }) => {
        // Reset input states when:
        // 1. Entering or exiting the PAUSED state
        // 2. Transitioning from GAME_OVER to PLAYING (restart)
        // 3. Starting a new game (any state to PLAYING)
        if (newState === GameStates.PAUSED ||
            (oldState === GameStates.PAUSED && newState === GameStates.PLAYING) ||
            (oldState === GameStates.GAME_OVER && newState === GameStates.PLAYING) ||
            (newState === GameStates.PLAYING)) {
            resetInputStates();
        }
    });

}