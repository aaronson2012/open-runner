import { Game } from './game.js';
import * as MenuManager from '../managers/ui/menuManager.js';
import * as HUDManager from '../managers/ui/hudManager.js';
import * as NotificationManager from '../managers/ui/notificationManager.js';
import * as LoadingScreenManager from '../managers/ui/loadingScreenManager.js';
import * as InteractionManager from '../managers/ui/interactionManager.js';
import eventBus from './eventBus.js';
import { isMobileDevice, updateMobileControlsVisibility } from '../utils/deviceUtils.js';
import { createLogger } from '../utils/logger.js';
import { errorBoundary } from '../utils/errorBoundary.js';
import { testExternalResources, showResourceLoadingError } from '../utils/resourceLoader.js';
import { browserCompatibility } from '../utils/browserCompatibility.js';
import { keyboardNavigation } from '../utils/keyboardNavigation.js';

const logger = createLogger('Main');

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    logger.info("DOM fully loaded and parsed");

    try {
        // Check if external resources are available
        logger.info("Checking external resource availability...");
        const resourcesAvailable = await testExternalResources();
        if (!resourcesAvailable) {
            logger.warn("External resources not available, showing warning");
            showResourceLoadingError();
            // Continue anyway - the game might still work with fallbacks
        }

        // Check browser compatibility
        logger.info("Checking browser compatibility...");
        browserCompatibility.installPolyfills();
        
        if (!browserCompatibility.isCompatible()) {
            logger.warn("Browser compatibility issues detected");
            browserCompatibility.showCompatibilityWarning();
        }

        // Initialize error boundary and keyboard navigation
        logger.info("Error boundary and keyboard navigation initialized");

        // Initialize all UI managers
        MenuManager.init();
        HUDManager.init();
        NotificationManager.init();
        LoadingScreenManager.init();
        InteractionManager.init();
        logger.info("All UI managers initialized.");

        const mobileControls = document.getElementById('mobileControls');
        if (mobileControls) {
            updateMobileControlsVisibility();
            logger.debug('Mobile controls visibility initialized');
        } else {
            logger.warn('Mobile controls element not found in the DOM');
        }
    } catch (error) {
        logger.error('Error setting up UI managers or mobile controls:', error);
    }

    try {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            const errorMsg = "FATAL: Canvas element #gameCanvas not found!";
            logger.error(errorMsg);
            try {
                eventBus.emit('errorOccurred', errorMsg);
            } catch (uiError) {
                logger.error("Could not display error via UIManager:", uiError);
                alert(errorMsg);
            }
            return;
        }

        logger.info("Creating game instance");
        const game = new Game(canvas);
        

        logger.info("Requesting user interaction before initializing the game...");
        await InteractionManager.requestInteraction();
        
        logger.info("User interaction received, proceeding with game initialization...");
        const initialized = await game.init();

        if (initialized) {
            logger.info("Game initialized successfully, starting game loop");
            game.start();
        } else {
            logger.error("Game initialization failed. See previous errors.");
            try {
                eventBus.emit('errorOccurred', "Game initialization failed. Please check console for details.");
            } catch (uiError) {
                logger.error("Could not display error via UIManager:", uiError);
                alert("Game initialization failed. Please check console for details.");
            }
        }
    } catch (error) {
        logger.error("Error during game initialization or start:", error);
        try {
            eventBus.emit('errorOccurred', error.message);
        } catch (uiError) {
            logger.error("Could not display error via UIManager:", uiError);
            alert(`An error occurred: ${error.message}`);
        }
    }
});