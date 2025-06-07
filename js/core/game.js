import * as THREE from 'three';
import eventBus from './eventBus.js';
import gameStateManager, { GameStates } from './gameStateManager.js';
import { initializeGame } from './gameInitializer.js';
import { setupEventHandlers } from './eventHandlerSetup.js';
import { updateGameplay } from './gameplayUpdater.js';
import { createLogger } from '../utils/logger.js';
import { updateFpsCounter } from '../rendering/sceneSetup.js';
import { performanceManager } from '../config/config.js';
import { controlsConfig } from '../config/controls.js';
import configManager, { getConfig } from '../config/config.js';
import { playerConfig } from '../config/player.js';
import { gameplayConfig } from '../config/gameplay.js';
import { resetInputStates } from '../input/controlsSetup.js';
import { updateMobileControlsVisibility } from '../utils/deviceUtils.js';
import * as ScoreManager from '../managers/scoreManager.js';
import * as UIManager from '../managers/uiManager.js';
import { initPlayerManager } from '../managers/playerManager.js';
import cameraManager from '../managers/cameraManager.js';
import sceneTransitionManager from '../managers/sceneTransitionManager.js';
import atmosphericManager from '../managers/atmosphericManager.js';
import { initScene } from '../rendering/sceneSetup.js';
import { initCollisionManager } from '../managers/collisionManager.js';
import { noise2D } from '../rendering/terrainGenerator.js';

const logger = createLogger('Game');

class Game {
    /**
     * Creates an instance of the Game.
     * @param {HTMLCanvasElement} canvasElement - The canvas element for rendering.
     * @throws {Error} If canvasElement is not provided.
     */
    constructor(canvasElement) {
        if (!canvasElement) {
            throw new Error("Canvas element is required to initialize the game.");
        }
        this.canvas = canvasElement;
        this.clock = new THREE.Clock();

        // Properties to be initialized in init()
        this.scene = null;
        this.gameplayScene = null;
        this.activeScene = null;
        this.camera = null;
        this.renderer = null;
        this.fpsCounter = null;
        this.assetManager = null;
        this.audioManager = null;
        this.cameraManager = cameraManager;
        this.sceneTransitionManager = sceneTransitionManager;
        this.chunkManager = null;
        this.collisionChecker = null;
        this.enemyManager = null;
        this.gameStateManager = gameStateManager;
        this.levelManager = null;
        this.particleManager = null;
        this.playerController = null;
        this.spatialGrid = null;
        this.uiManager = UIManager;
        this.atmosphericManager = atmosphericManager;
        this.player = null;
        this.currentLevelConfig = null;
        this.playerAnimationTime = 0;
        this.playerManager = null;
        this.eventBus = eventBus;
        this.animationFrameId = null;
        this.lastRenderFrameTime = 0; // For throttling renders in certain states
        this.powerupMaterials = {}; // Cache for powerup materials

        // Bind animate method once to prevent memory issues
        this.boundAnimate = this.animate.bind(this);

        logger.info("Game class instantiated");
    }

    /**
     * Initializes the game asynchronously by calling the initializer function
     * and setting up instance properties and event listeners.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    async init() {
        const initResult = await initializeGame(this.canvas);

        if (!initResult) {
            logger.error("Game initialization failed.");
            return false;
        }

        // Assign initialized components and managers to the game instance
        this.scene = initResult.scene;
        this.camera = initResult.camera;
        this.renderer = initResult.renderer;
        this.player = initResult.player;
        this.assetManager = initResult.assetManager;
        this.audioManager = initResult.audioManager;
        this.cameraManager = initResult.cameraManager;
        this.sceneTransitionManager = initResult.sceneTransitionManager;
        this.chunkManager = initResult.chunkManager;
        this.collisionChecker = initResult.collisionChecker;
        this.enemyManager = initResult.enemyManager;

        this.levelManager = initResult.levelManager;
        this.particleManager = initResult.particleManager;
        this.playerController = initResult.playerController;
        this.spatialGrid = initResult.spatialGrid;
        this.uiManager = initResult.uiManager;
        this.atmosphericManager = initResult.atmosphericManager;
        this.fpsCounter = initResult.fpsCounter;
        this.currentLevelConfig = initResult.currentLevelConfig;
        this.activeScene = this.scene; // Start with the initial scene
        
        // Initialize PlayerManager
        this.playerManager = initPlayerManager(this.player);
        logger.info("PlayerManager initialized");

        // Setup event subscriptions after all components are initialized
        this._setupEventSubscriptions();

        // Setup global event listeners with proper references for cleanup
        this.resizeHandler = () => this.cameraManager.handleResize();
        window.addEventListener('resize', this.resizeHandler, false);

        // FPS toggle listener
        this.fpsToggleHandler = (event) => {
            if (event.key.toLowerCase() === controlsConfig.KEY_TOGGLE_FPS) {
                const newFpsState = !configManager.get('debug.showFPS');
                configManager.updateConfig('debug', { SHOW_FPS: newFpsState });
                if (this.fpsCounter) {
                    this.fpsCounter.style.display = newFpsState ? 'block' : 'none';
                }
            }
        };
        document.addEventListener('keydown', this.fpsToggleHandler);
        // Global key listener for game actions
        this.boundHandleGlobalKeys = this.handleGlobalKeys.bind(this);
        document.removeEventListener('keydown', this.boundHandleGlobalKeys); // Prevent duplicates
        document.addEventListener('keydown', this.boundHandleGlobalKeys);

        // Setup UI Button Listeners
        this.uiManager.setupStartButton(() => this.startGame('level1'));
        this.uiManager.setupBackToTitleButton(() => this.gameStateManager.requestReturnToTitle());
        this.uiManager.setupLevelSelectButton(() => this.gameStateManager.requestShowLevelSelect());
        this.uiManager.setupPauseMenuButtons(
            () => this.gameStateManager.requestResume(),
            () => this.gameStateManager.requestRestart(),
            () => this.gameStateManager.requestReturnToTitle()
        );
        this.uiManager.setupGameOverButtons(
            () => this.gameStateManager.requestRestart(),
            () => this.gameStateManager.requestReturnToTitle()
        );

        logger.info("Game instance initialized successfully.");
        return true;
    }

    /**
     * Sets up subscriptions to global events via the event bus.
     * @private
     */
    _setupEventSubscriptions() {
        // Pass required dependencies to the setup function
        setupEventHandlers({
            player: this.player,
            levelManager: this.levelManager,
            scoreManager: ScoreManager,
            uiManager: this.uiManager,
            cameraManager: this.cameraManager,
            sceneTransitionManager: this.sceneTransitionManager,
            atmosphericManager: this.atmosphericManager,
            startGameCallback: this.startGame.bind(this),
            loadLevelCallback: this._loadLevel.bind(this),
            resetInputStates: resetInputStates,
            updateMobileControlsVisibility: updateMobileControlsVisibility,
            // Removed score/timer getters/setters
        });

        // Event listeners for powerup effects
        eventBus.subscribe('applyPowerupEffect', ({ type, player }) => {
            if (type === gameplayConfig.POWERUP_TYPE_MAGNET && player && player.model) {
                logger.info(`Applying ${type} powerup visual effect to player`);

                let magnetMaterial = this.powerupMaterials.magnet;
                if (!magnetMaterial) {
                    magnetMaterial = new THREE.MeshStandardMaterial({
                        color: gameplayConfig.MAGNET_EFFECT_COLOR,
                        emissive: gameplayConfig.MAGNET_EFFECT_EMISSIVE,
                        metalness: gameplayConfig.MAGNET_EFFECT_METALNESS,
                        roughness: gameplayConfig.MAGNET_EFFECT_ROUGHNESS
                    });
                    this.powerupMaterials.magnet = magnetMaterial;
                }

                // Apply the material to all meshes in the player model
                player.model.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        // Store the original material if not already stored
                        if (!child.userData.originalMaterial) {
                            child.userData.originalMaterial = child.material;
                        }
                        child.material = magnetMaterial;
                    }
                });
            } else if (type === gameplayConfig.POWERUP_TYPE_DOUBLER && player && player.model) {
                logger.info(`Applying ${type} powerup visual effect to player`);

                let doublerMaterial = this.powerupMaterials.doubler;
                if (!doublerMaterial) {
                    doublerMaterial = new THREE.MeshStandardMaterial({
                        color: gameplayConfig.DOUBLER_EFFECT_COLOR,
                        emissive: gameplayConfig.DOUBLER_EFFECT_EMISSIVE,
                        metalness: gameplayConfig.DOUBLER_EFFECT_METALNESS,
                        roughness: gameplayConfig.DOUBLER_EFFECT_ROUGHNESS
                    });
                    this.powerupMaterials.doubler = doublerMaterial;
                }

                // Apply the material to all meshes in the player model
                player.model.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        // Store the original material if not already stored
                        if (!child.userData.originalMaterial) {
                            child.userData.originalMaterial = child.material;
                        }
                        child.material = doublerMaterial;
                    }
                });
                
                // Create a visual indicator for the doubler powerup
                if (!player.doublerIndicator) {
                    player.doublerIndicator = new THREE.Group();
                    
                    // Create a material for the X indicator
                    const xMaterial = new THREE.MeshStandardMaterial({
                        color: gameplayConfig.DOUBLER_EFFECT_COLOR,
                        emissive: gameplayConfig.DOUBLER_EFFECT_EMISSIVE,
                        metalness: 0.8,
                        roughness: 0.1
                    });
                    
                    // Create a floating X above the player's head
                    const indicatorSize = 0.3;
                    const indicatorHeight = 2.0; // Height above player
                    
                    // Create a background disc for the X
                    const bgGeometry = new THREE.CylinderGeometry(indicatorSize * 1.2, indicatorSize * 1.2, 0.05, 16);
                    bgGeometry.rotateX(Math.PI / 2);
                    const bgMaterial = new THREE.MeshStandardMaterial({
                        color: 0x000033, // Dark blue background
                        transparent: true,
                        opacity: 0.6
                    });
                    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
                    
                    // First diagonal of X (top-left to bottom-right)
                    const diag1Geometry = new THREE.BoxGeometry(indicatorSize * 0.15, indicatorSize * 1.4, 0.05);
                    const diag1 = new THREE.Mesh(diag1Geometry, xMaterial);
                    diag1.rotation.z = Math.PI / 4; // 45-degree angle
                    diag1.position.z = 0.03; // Slightly in front of the background
                    
                    // Second diagonal of X (top-right to bottom-left)
                    const diag2Geometry = new THREE.BoxGeometry(indicatorSize * 0.15, indicatorSize * 1.4, 0.05);
                    const diag2 = new THREE.Mesh(diag2Geometry, xMaterial);
                    diag2.rotation.z = -Math.PI / 4; // -45-degree angle
                    diag2.position.z = 0.03; // Slightly in front of the background
                    
                    // Add all parts to the indicator group
                    player.doublerIndicator.add(bgMesh);
                    player.doublerIndicator.add(diag1);
                    player.doublerIndicator.add(diag2);
                    
                    // Position the indicator above the player's head
                    player.doublerIndicator.position.set(0, indicatorHeight, 0);
                    
                    // Add to player model so it moves with the player
                    player.model.add(player.doublerIndicator);
                }
            } else if (type === gameplayConfig.POWERUP_TYPE_INVISIBILITY && player && player.model) {
                logger.info(`Applying ${type} powerup visual effect to player`);
                
                let invisibilityMaterial = this.powerupMaterials.invisibility;
                if (!invisibilityMaterial) {
                    invisibilityMaterial = new THREE.MeshStandardMaterial({
                        color: gameplayConfig.INVISIBILITY_EFFECT_COLOR,
                        emissive: gameplayConfig.INVISIBILITY_EFFECT_EMISSIVE,
                        metalness: gameplayConfig.INVISIBILITY_EFFECT_METALNESS,
                        roughness: gameplayConfig.INVISIBILITY_EFFECT_ROUGHNESS,
                        transparent: true,
                        opacity: gameplayConfig.INVISIBILITY_EFFECT_OPACITY
                    });
                    this.powerupMaterials.invisibility = invisibilityMaterial;
                }
                
                // Apply the material to all meshes in the player model
                player.model.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        // Store the original material if not already stored
                        if (!child.userData.originalMaterial) {
                            child.userData.originalMaterial = child.material;
                        }
                        child.material = invisibilityMaterial;
                    }
                });
            }
        });

        eventBus.subscribe('removePowerupEffect', ({ type, player }) => {
            if (type === gameplayConfig.POWERUP_TYPE_MAGNET && player && player.model) {
                logger.info(`Removing ${type} powerup visual effect from player`);

                // Restore original materials
                player.model.traverse(child => {
                    if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                        // Clear the stored material reference
                        delete child.userData.originalMaterial;
                    }
                });
            } else if (type === gameplayConfig.POWERUP_TYPE_DOUBLER && player && player.model) {
                logger.info(`Removing ${type} powerup visual effect from player`);

                // Restore original materials
                player.model.traverse(child => {
                    if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                        // Clear the stored material reference
                        delete child.userData.originalMaterial;
                    }
                });
                
                // Remove the doubler indicator
                if (player.doublerIndicator) {
                    player.model.remove(player.doublerIndicator);
                    
                    // Dispose geometries and materials
                    player.doublerIndicator.traverse(child => {
                        if (child instanceof THREE.Mesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => m.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        }
                    });
                    
                    player.doublerIndicator = null;
                }
            } else if (type === gameplayConfig.POWERUP_TYPE_INVISIBILITY && player && player.model) {
                logger.info(`Removing ${type} powerup visual effect from player`);
                
                // Restore original materials
                player.model.traverse(child => {
                    if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                        // Clear the stored material reference
                        delete child.userData.originalMaterial;
                    }
                });
                
                // Remove the invisibility indicator
                if (player.invisibilityIndicator) {
                    player.model.remove(player.invisibilityIndicator);
                    
                    // Dispose geometries and materials
                    player.invisibilityIndicator.traverse(child => {
                        if (child instanceof THREE.Mesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => m.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        }
                    });
                    
                    player.invisibilityIndicator = null;
                }
                
                // Remove particle effect
                if (player.invisibilityEffect) {
                    player.model.remove(player.invisibilityEffect);
                    
                    // Dispose geometries and materials
                    player.invisibilityEffect.traverse(child => {
                        if (child instanceof THREE.Mesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => m.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        }
                    });
                    
                    player.invisibilityEffect = null;
                    
                    // Unsubscribe from update event
                    if (player.invisibilityEffectUpdateHandler) {
                        eventBus.unsubscribe('gameLoopUpdate', player.invisibilityEffectUpdateHandler);
                        player.invisibilityEffectUpdateHandler = null;
                    }
                }
            }
        });
    }

    /**
     * Starts the main game loop.
     */
    start() {
        logger.info("Starting game loop...");
        this.animate();
    }

    /**
     * The main game loop, called recursively via requestAnimationFrame.
     * Updates game state, managers, camera, and renders the active scene.
     * @private
     */
    animate() {
        try {
            this.animationFrameId = requestAnimationFrame(this.boundAnimate);

            let deltaTime = this.clock.getDelta();
            if (isNaN(deltaTime) || !isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1.0) {
                deltaTime = 1 / 60;
            }
            deltaTime = Math.min(deltaTime, getConfig('MAX_DELTA_TIME', 1 / 15));

            const elapsedTime = this.clock.getElapsedTime();
            const currentState = this.gameStateManager.getCurrentState();

            // Update performance manager
            try {
                performanceManager.updateFps();
                if (this.fpsCounter) {
                    updateFpsCounter(this.fpsCounter, performanceManager.getCurrentFps());
                }
            } catch (error) {
                logger.error("Error updating performance manager:", error);
            }

            // Update camera manager
            try {
                if (this.cameraManager) {
                    this.cameraManager.update(deltaTime, currentState, this.player);
                }
            } catch (error) {
                logger.error("Error updating camera manager:", error);
            }

            // Update gameplay systems
            if (currentState === GameStates.PLAYING) {
                try {
                    updateGameplay(
                        {
                            player: this.player,
                            playerController: this.playerController,
                            chunkManager: this.chunkManager,
                            enemyManager: this.enemyManager,
                            particleManager: this.particleManager,
                            collisionChecker: this.collisionChecker,
                            atmosphericManager: this.atmosphericManager,
                            playerAnimationTime: this.playerAnimationTime
                        },
                        deltaTime,
                        elapsedTime
                    );
                    this.playerAnimationTime += deltaTime;
                } catch (error) {
                    logger.error("Error in gameplay update:", error);
                }
            }

            // Update scene transition manager
            try {
                if (this.sceneTransitionManager) {
                    this.sceneTransitionManager.update(deltaTime, elapsedTime);
                    this.activeScene = this.sceneTransitionManager.getActiveScene() || this.scene;
                }
            } catch (error) {
                logger.error("Error updating scene transition manager:", error);
            }

            // Render the scene
            try {
                if (this.renderer && this.activeScene && this.camera) {
                    // Skip rendering during certain states to improve performance
                    const skipRender = currentState === GameStates.LOADING ||
                                      (currentState === GameStates.PAUSED && this.lastRenderFrameTime &&
                                        (elapsedTime - this.lastRenderFrameTime < 0.1)); // Render paused state at 10fps

                    if (!skipRender) {
                        this.renderer.render(this.activeScene, this.camera);
                        this.lastRenderFrameTime = elapsedTime;
                    }
                } else {
                    // Only log this occasionally to avoid spam
                    if (Math.random() < 0.01) { // 1% chance to log
                        logger.warn("Skipping render: Missing renderer, activeScene, or camera.");
                    }
                }
            } catch (error) {
                logger.error("Error during rendering:", error);
            }
        } catch (error) {
            logger.error("Critical error in game loop:", error);
            // Try to continue the game loop despite the error
            this.animationFrameId = requestAnimationFrame(this.boundAnimate);
        }
    }

    /**
     * Cleans up resources and event listeners when the game is stopped.
     * Call this method before destroying the game instance.
     */
    cleanup() {
        logger.info("Cleaning up game resources and event listeners");

        // Cancel animation frame first to stop the game loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Remove global event listeners
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.fpsToggleHandler) {
            document.removeEventListener('keydown', this.fpsToggleHandler);
            this.fpsToggleHandler = null;
        }

        if (this.boundHandleGlobalKeys) {
            document.removeEventListener('keydown', this.boundHandleGlobalKeys);
            this.boundHandleGlobalKeys = null;
        }

        // Clean up managers in proper order
        if (this.playerManager) {
            this.playerManager.cleanup();
            this.playerManager = null;
        }

        if (this.chunkManager) {
            this.chunkManager.clearAllChunks();
            this.chunkManager = null;
        }

        if (this.enemyManager) {
            this.enemyManager.removeAllEnemies();
            this.enemyManager = null;
        }

        if (this.particleManager) {
            this.particleManager.dispose();
            this.particleManager = null;
        }

        if (this.audioManager) {
            this.audioManager.stopMusic();
            this.audioManager = null;
        }

        // Clean up event bus subscriptions
        if (this.eventBus) {
            this.eventBus.unsubscribeAll('applyPowerupEffect');
            this.eventBus.unsubscribeAll('removePowerupEffect');
        }

        // Dispose of Three.js resources
        if (this.powerupMaterials) {
            for (const key in this.powerupMaterials) {
                if (this.powerupMaterials[key] && typeof this.powerupMaterials[key].dispose === 'function') {
                    this.powerupMaterials[key].dispose();
                    logger.debug(`Disposed cached powerup material: ${key}`);
                }
            }
            this.powerupMaterials = {}; // Clear the cache
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        // Clear scene references
        if (this.scene) {
            this.scene.clear();
            this.scene = null;
        }

        if (this.gameplayScene) {
            this.gameplayScene.clear();
            this.gameplayScene = null;
        }

        this.activeScene = null;
        this.camera = null;
        this.player = null;

        logger.info("Game cleanup completed");
    }

    // --- Game Flow Methods (Called by Event Handlers via Callbacks) ---

    /**
     * Starts or transitions to a specific game level.
     * @param {string} levelId - The ID of the level to start.
     * @returns {Promise<void>}
     */
    async startGame(levelId) {
        // Prevent multiple simultaneous level loads
        if (this._loadingLevel) {
            logger.warn(`Already loading a level, ignoring request to load ${levelId}`);
            return;
        }

        this._loadingLevel = true;

        try {
            logger.info(`Starting level: ${levelId}`);

            // Stop any currently playing music FIRST, before anything else
            if (this.audioManager) {
                logger.info(`Stopping current music before starting level: ${levelId}`);
                await this.audioManager.stopMusic();

                // Add a short delay to ensure audio operations complete
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                logger.warn("Audio manager not available, cannot stop music");
            }

        resetInputStates();
        logger.info("Input states reset before starting game");
        updateMobileControlsVisibility();

        // Load level config
        const levelLoaded = await this.levelManager.loadLevel(levelId);
        if (!levelLoaded) {
            logger.error(`Failed to load level config for ${levelId} in startGame. Aborting.`);
            this.gameStateManager.setGameState(GameStates.TITLE);
            this.uiManager.displayError(new Error(`Failed to load level ${levelId}.`));
            return;
        }
        this.currentLevelConfig = this.levelManager.getCurrentConfig();

        // Create/Get Gameplay Scene
        if (!this.gameplayScene) {
             const gameplaySceneComponents = initScene(this.canvas, this.currentLevelConfig);
             this.gameplayScene = gameplaySceneComponents.scene;
        } else {
             this._updateSceneAppearance(this.currentLevelConfig, this.gameplayScene);
        }

        // Position player on terrain before starting camera transition
        // await this._positionPlayerOnTerrain(); // This call is redundant, _loadLevel will also call it.

        // Start camera transition
        this.cameraManager.startTransitionToGameplay(this.camera.position, this.camera.quaternion);

        // Reset/Reconfigure Managers for the new scene
        this.spatialGrid.clear();
        this.enemyManager.setScene(this.gameplayScene);
        this.chunkManager.setScene(this.gameplayScene);
        this.particleManager.setScene(this.gameplayScene);
        this.atmosphericManager.setTargetScene(this.gameplayScene);
        initCollisionManager(this.spatialGrid, this.chunkManager); // Re-initialize with current refs

        // Load level assets, chunks etc.
        await this._loadLevel(levelId);

        // Start scene transition
        this.sceneTransitionManager.startTransition(this.gameplayScene);
        this.activeScene = this.sceneTransitionManager.getActiveScene();

        // Set intermediate state before playing music
        // This ensures any state transition handlers finish first
        this.gameStateManager.setGameState(GameStates.TRANSITIONING_TO_GAMEPLAY);

        // Wait a small amount of time for state change events to be processed
        await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            logger.error(`Error in startGame for ${levelId}:`, error);
            this.gameStateManager.setGameState(GameStates.TITLE);
            this.uiManager.displayError(new Error(`Failed to start level ${levelId}.`));
        } finally {
            this._loadingLevel = false;
        }
    }


    /**
     * Internal helper to load level assets and chunks.
     * @param {string} levelId - The ID of the level to load.
     * @returns {Promise<void>}
     * @private
     */
    async _loadLevel(levelId) {
        try {
            this.gameStateManager.setGameState(GameStates.LOADING_LEVEL);
            logger.info(`Loading level ${levelId}...`);

            const playerCurrentParent = this.player.model?.parent;

            // Unload previous level assets/state
            logger.info(`Cleaning up resources before loading level ${levelId}...`);

            // First, remove all enemies with error handling
            try {
                if (this.enemyManager) {
                    this.enemyManager.removeAllEnemies();
                }
            } catch (error) {
                logger.error("Error removing enemies:", error);
            }

            // Clear all chunks and their content with error handling
            try {
                if (this.chunkManager) {
                    this.chunkManager.clearAllChunks();
                }
            } catch (error) {
                logger.error("Error clearing chunks:", error);
            }

            // Clear atmospheric elements with error handling
            try {
                if (this.atmosphericManager) {
                    this.atmosphericManager.clearElements();
                }
            } catch (error) {
                logger.error("Error clearing atmospheric elements:", error);
            }

            // Ensure complete level unloading if we're changing levels
            try {
                const currentLevelId = this.levelManager.getCurrentLevelId();
                if (currentLevelId && currentLevelId !== levelId) {
                    logger.info(`Unloading current level ${currentLevelId} before loading ${levelId}`);
                    this.levelManager.unloadCurrentLevel();
                }
            } catch (error) {
                logger.error("Error unloading current level:", error);
            }

            // Force a garbage collection hint
            if (window.gc) {
                try {
                    window.gc();
                    logger.debug('Garbage collection hint sent');
                } catch (e) {
                    // Ignore errors, gc() is not available in all browsers
                }
            }

            // Ensure config is loaded/set
            this.currentLevelConfig = this.levelManager.getCurrentConfig();
            if (!this.currentLevelConfig || this.levelManager.getCurrentLevelId() !== levelId) {
                const levelLoaded = await this.levelManager.loadLevel(levelId);
                if (!levelLoaded) throw new Error(`Failed to load level config for ${levelId}.`);
                this.currentLevelConfig = this.levelManager.getCurrentConfig();
            }

            // Initialize Assets, Scene, Player, Chunks
            await this.assetManager.initLevelAssets(this.currentLevelConfig);
            this.atmosphericManager.addElementsForLevel(levelId, this.gameplayScene);
            this._updateSceneAppearance(this.currentLevelConfig, this.gameplayScene);
            this.chunkManager.setLevelConfig(this.currentLevelConfig);
            if (this.player.model) {
                if (playerCurrentParent && playerCurrentParent !== this.gameplayScene) {
                    playerCurrentParent.remove(this.player.model);
                }
                this.player.model.position.set(playerConfig.INITIAL_POS_X, playerConfig.INITIAL_POS_Y, playerConfig.INITIAL_POS_Z);
                this.player.model.rotation.set(0, 0, 0);
                this.player.currentSpeed = playerConfig.SPEED;
                this.player.powerup = '';
                if (this.gameplayScene) {
                    if (this.player.model.parent !== this.gameplayScene) {
                        this.gameplayScene.add(this.player.model);
                    }
                    this.player.model.visible = true;
                } else {
                    logger.error("Cannot add player model, gameplayScene is null!");
                }
            } else {
                logger.error("Player model is null when trying to reset for new level.");
            }
            // Reset score via ScoreManager
            ScoreManager.resetCurrentScore();
            // Also directly update the UI score display to ensure it's reset
            // Don't make it visible yet - it should stay hidden during loading
            this.uiManager.updateScoreDisplay(0, false, true);
            // The 'currentScoreUpdated' event is now emitted by ScoreManager.resetCurrentScore
            this.playerAnimationTime = 0;
            
            // Reset powerups through PlayerManager
            if (this.playerManager) {
                this.playerManager.resetPowerups();
            }

            // Load initial chunks
            await this.chunkManager.loadInitialChunks((loaded, total) => {
                 this.uiManager.updateLoadingProgress(loaded, total);
            });

            // Position player on terrain after chunks are loaded
            await this._positionPlayerOnTerrain();
            const initialPlayerChunkX = Math.floor(playerConfig.INITIAL_POS_X / this.chunkManager.chunkSize);
            const initialPlayerChunkZ = Math.floor(playerConfig.INITIAL_POS_Z / this.chunkManager.chunkSize);
            this.chunkManager.lastCameraChunkX = initialPlayerChunkX;
            this.chunkManager.lastCameraChunkZ = initialPlayerChunkZ;

        } catch (error) {
            logger.error(`CRITICAL ERROR during level load for ${levelId}:`, error);
            this.gameStateManager.setGameState(GameStates.TITLE);
            this.uiManager.displayError(new Error(`Failed to load level ${levelId}. Returning to title.`));
        }
    }

    /**
     * Updates the visual appearance (background, fog, lighting) of a given scene based on level config.
     * @param {object} levelConfig - The configuration object for the level.
     * @param {THREE.Scene} sceneToUpdate - The scene object to apply changes to.
     * @private
     */
    _updateSceneAppearance(levelConfig, sceneToUpdate) {
         if (sceneToUpdate && levelConfig) {
             sceneToUpdate.background = new THREE.Color(levelConfig.SCENE_BACKGROUND_COLOR);
             sceneToUpdate.fog = new THREE.Fog(levelConfig.SCENE_FOG_COLOR, levelConfig.SCENE_FOG_NEAR, levelConfig.SCENE_FOG_FAR);
             const ambient = sceneToUpdate.getObjectByProperty('isAmbientLight', true);
             if (ambient) {
                 ambient.color.setHex(levelConfig.AMBIENT_LIGHT_COLOR);
                 ambient.intensity = levelConfig.AMBIENT_LIGHT_INTENSITY;
             }
             const directional = sceneToUpdate.getObjectByProperty('isDirectionalLight', true);
             if (directional) {
                 directional.color.setHex(levelConfig.DIRECTIONAL_LIGHT_COLOR);
                 directional.intensity = levelConfig.DIRECTIONAL_LIGHT_INTENSITY;
                 directional.position.set(
                      levelConfig.DIRECTIONAL_LIGHT_POS_X,
                      levelConfig.DIRECTIONAL_LIGHT_POS_Y,
                      levelConfig.DIRECTIONAL_LIGHT_POS_Z
                 ).normalize();
             }
         }
     }


     // --- Input Handling ---
     /**
      * Handles global keydown events for actions like pausing, resuming, restarting, etc.
      * @param {KeyboardEvent} event - The keyboard event object.
      * @private
      */
    handleGlobalKeys(event) {
        const currentState = this.gameStateManager.getCurrentState();
        logger.debug(`Key pressed: ${event.key} (lowercase: ${event.key.toLowerCase()}) in state: ${currentState}`);

        const lowerCaseKey = event.key.toLowerCase();

        // Use gameStateManager request methods
        if (lowerCaseKey === controlsConfig.KEY_PAUSE_RESUME_BACK) {
            if (currentState === GameStates.PLAYING) {
                this.gameStateManager.requestPause();
            } else if (currentState === GameStates.PAUSED) {
                this.gameStateManager.requestResume();
            } else if (currentState === GameStates.LEVEL_SELECT) {
                this.gameStateManager.requestReturnToTitle();
            }
        } else if (lowerCaseKey === controlsConfig.KEY_RESTART_GAME_OVER && currentState === GameStates.GAME_OVER) {
            this.gameStateManager.requestRestart();
        } else if (lowerCaseKey === controlsConfig.KEY_LEVEL_SELECT_TITLE) {
            if (currentState === GameStates.TITLE) {
                this.gameStateManager.requestShowLevelSelect();
            }
        }
        // FPS toggle handled separately in constructor
    }



    /**
     * Positions the player on the terrain by calculating the terrain height at the player's position
     * and adjusting the player's Y coordinate accordingly.
     * @returns {Promise<void>}
     * @private
     */
    async _positionPlayerOnTerrain() {
        if (!this.player || !this.player.model) {
            logger.error("Cannot position player on terrain: player or player model is missing");
            return;
        }

        if (!this.currentLevelConfig) {
            logger.error("Cannot position player on terrain: level config is missing");
            return;
        }

        if (!this.chunkManager) {
            logger.error("Cannot position player on terrain: chunk manager is missing");
            return;
        }

        // noise2D is now imported at the top of the module

        // Get player position
        const playerPos = this.player.model.position;

        // Calculate terrain height at player position
        const terrainY = noise2D(
            playerPos.x * this.currentLevelConfig.NOISE_FREQUENCY,
            playerPos.z * this.currentLevelConfig.NOISE_FREQUENCY
        ) * this.currentLevelConfig.NOISE_AMPLITUDE;

        // Set player Y position to terrain height plus offset
        playerPos.y = terrainY + playerConfig.HEIGHT_OFFSET;

        logger.info(`Player positioned on terrain at height ${playerPos.y}`);

        // Ensure chunks are loaded around player
        await this.chunkManager.loadInitialChunks();

        // Force an update of nearby terrain meshes
        const nearbyMeshes = this.chunkManager.getTerrainMeshesNear(playerPos);
        if (nearbyMeshes.length === 0) {
            logger.warn("No terrain meshes found near player position");
        }
    }
}

export { Game };
