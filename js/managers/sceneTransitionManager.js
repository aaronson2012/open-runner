// js/managers/sceneTransitionManager.js
import * as THREE from 'three'; // Import THREE
import { createLogger, LogLevel } from '../utils/logger.js'; // Stays in utils, import LogLevel
import eventBus from '../core/eventBus.js'; // Moved to core
import cameraManager from './cameraManager.js'; // Import CameraManager

const logger = createLogger('SceneTransitionManager', LogLevel.DEBUG); // Use logger instance, set level to DEBUG

class SceneTransitionManager {
    constructor() {
        this.isTransitioning = false;
        this.transitionStartTime = 0;
        this.transitionDuration = 0.3; // Reduced duration for faster transitions
        this.activeScene = null;
        // this.gameplayScene = null; // No longer needed, pass target scene directly
        this.player = null; // Reference to the player object
        this.renderer = null; // Reference to the renderer
        this.camera = null; // Reference to the camera
        this.clock = new THREE.Clock(); // Use its own clock

        logger.debug("SceneTransitionManager instantiated");
    }

    // --- Initialization ---
    setRenderer(renderer) { this.renderer = renderer; }
    setCamera(camera) { this.camera = camera; }
    setPlayer(player) { this.player = player; }
    // setActiveScene is handled internally during startTransition

    // --- Transition Control ---
    startTransition(targetScene) {
        if (this.isTransitioning) {
            logger.debug("Already transitioning, cannot start new scene transition.");
            return;
        }
        if (!targetScene) {
             logger.error("Target scene not provided for transition.");
             return;
        }
        logger.debug("Starting scene transition.");
        this.isTransitioning = true;
        this.transitionStartTime = this.clock.getElapsedTime(); // Use internal clock's time
        this.activeScene = targetScene; // Immediately set the target scene as active for rendering

        // Trigger camera transition
        if (this.camera) {
            cameraManager.startTransitionToGameplay(this.camera.position, this.camera.quaternion);
        } else {
            logger.error("Cannot start camera transition: Camera reference missing.");
        }
    }

    getIsTransitioning() {
        return this.isTransitioning;
    }

    getActiveScene() {
        return this.activeScene;
    }

    forceEndTransition() {
        if (this.isTransitioning) {
            logger.warn("Forcing end of scene transition");
            this.isTransitioning = false;
            this._ensurePlayerState(true); // Force render and ensure player state
            eventBus.emit('sceneTransitionComplete'); // Emit completion event
            return true;
        }
        return false;
    }

    // --- Update Loop ---
    update(deltaTime, elapsedTime) {
        if (!this.isTransitioning) return;
        if (!this.activeScene || !this.renderer || !this.camera) {
            logger.error("Missing scene, renderer, or camera during scene transition update.");
            this.isTransitioning = false; // Abort if critical components missing
            return;
        }

        // Ensure player is visible and in the correct scene during transitions
        this._ensurePlayerState();

        const timeElapsed = elapsedTime - this.transitionStartTime;
        const progress = Math.min(timeElapsed / this.transitionDuration, 1.0);

        if (progress < 1.0) {
            // Scene transition is mostly visual fade handled by UI, camera handled by CameraManager
            // We just need to ensure the correct scene is rendered
            this.renderer.render(this.activeScene, this.camera);
        } else {
            // Transition complete
            logger.debug("Scene transition complete.");
            this.isTransitioning = false;

            // Double-check player state after scene transition
            this._ensurePlayerState(true); // Pass true to force render

            eventBus.emit('sceneTransitionComplete'); // Emit event
        }
    }

    // --- Utility ---
    _ensurePlayerState(forceRender = false) {
        if (this.player && this.player.model) {
            // Force visibility
            if (!this.player.model.visible) {
                logger.warn("Player was invisible during scene transition, making visible.");
                this.player.model.visible = true;
            }
            // Ensure player is in the active scene
            if (this.activeScene && this.player.model.parent !== this.activeScene) {
                logger.warn("Player not in active scene during transition, fixing...");
                if (this.player.model.parent) {
                    this.player.model.parent.remove(this.player.model);
                }
                this.activeScene.add(this.player.model);
                logger.debug(`Player added to active scene. Parent exists: ${this.player.model.parent !== null}`);
            }
            // Force a render if requested (e.g., after transition completes)
            if (forceRender && this.renderer && this.activeScene && this.camera) {
                 logger.debug("Forcing render after ensuring player state.");
                 this.renderer.render(this.activeScene, this.camera);
            }
        } else if (forceRender) {
             logger.warn("Player or player model is null when trying to ensure state.");
        }
    }

    // Easing function (can be shared or kept local)
    _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}

// Singleton instance
const sceneTransitionManager = new SceneTransitionManager();

export default sceneTransitionManager;