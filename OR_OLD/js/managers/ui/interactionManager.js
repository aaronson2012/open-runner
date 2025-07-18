import * as AudioManager from '../audioManager.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('InteractionManager');

let interactionScreen = null;
let interactionPromise = null;
let resolveInteractionPromise = null;

/**
 * Initializes the InteractionManager.
 */
export function init() {
    interactionScreen = document.getElementById('interaction-screen');
    if (!interactionScreen) {
        logger.error('Interaction screen element not found!');
        return false;
    }
    return true;
}

/**
 * Shows the interaction screen and waits for user input.
 * @returns {Promise<void>} A promise that resolves when the user interacts.
 */
export function requestInteraction() {
    if (!interactionScreen) {
        logger.error('Interaction screen not initialized.');
        return Promise.resolve(); // Should not happen, but good practice
    }

    logger.info('Requesting user interaction to initialize audio.');
    interactionScreen.style.display = 'flex';

    // Ensure we only have one promise/listener setup at a time
    if (!interactionPromise) {
        interactionPromise = new Promise(resolve => {
            resolveInteractionPromise = resolve;
        });

        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });
        // Add touch events for mobile devices
        window.addEventListener('touchstart', handleInteraction, { once: true });
        window.addEventListener('touchend', handleInteraction, { once: true });
    }

    return interactionPromise;
}

/**
 * Handles the user interaction (click, keydown, or touch).
 */
async function handleInteraction() {
    // The { once: true } option in addEventListener removes the need for removeEventListener
    if (!resolveInteractionPromise) {
        return;
    }

    logger.info('User interaction detected. Initializing audio...');

    try {
        const audioInitialized = await AudioManager.init();
        if (audioInitialized) {
            logger.info('AudioManager initialized successfully after user interaction.');
        } else {
            logger.error('AudioManager failed to initialize after user interaction.');
            // We still continue, but audio won't work.
        }
    } catch (e) {
        logger.error('Error initializing AudioManager on user interaction:', e);
    }

    interactionScreen.style.display = 'none';

    // Resolve the promise to allow the game to start
    resolveInteractionPromise();

    // Clean up
    resolveInteractionPromise = null;
    interactionPromise = null;
}