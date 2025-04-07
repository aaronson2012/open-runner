// js/core/game.js
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
import { playerConfig } from '../config/player.js'; // Needed for _loadLevel
import { worldConfig } from '../config/world.js'; // Needed for startGame
import { gameplayConfig } from '../config/gameplay.js'; // Needed for powerup effects
import { resetInputStates, initInputStateManager } from '../input/controlsSetup.js'; // Needed for startGame and event handlers
import { updateMobileControlsVisibility } from '../utils/deviceUtils.js'; // Needed for startGame and event handlers
// Import managers needed for dependency object in _setupEventSubscriptions
import * as ScoreManager from '../managers/scoreManager.js';
import * as LevelManager from '../managers/levelManager.js';
import * as UIManager from '../managers/uiManager.js';
import cameraManager from '../managers/cameraManager.js';
import sceneTransitionManager from '../managers/sceneTransitionManager.js';
import atmosphericManager from '../managers/atmosphericManager.js';
// Import managers needed for startGame/_loadLevel (these are instantiated/returned by initializeGame)
import { initScene } from '../rendering/sceneSetup.js';
import { SpatialGrid } from '../physics/spatialGrid.js';
import { EnemyManager } from '../managers/enemyManager.js';
import { ChunkManager } from '../managers/chunkManager.js';
import { ParticleManager } from '../managers/particleManager.js';
import { initCollisionManager } from '../managers/collisionManager.js';
// Removed unused imports: grayMaterial, createPlayerCharacter, initPlayerController, checkCollisionsController

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
        this.cameraManager = cameraManager; // Use imported singleton
        this.sceneTransitionManager = sceneTransitionManager; // Use imported singleton
        this.chunkManager = null;
        this.collisionChecker = null;
        this.enemyManager = null;
        this.gameStateManager = gameStateManager; // Use imported singleton
        this.levelManager = null;
        this.particleManager = null;
        this.playerController = null;
        this.spatialGrid = null;
        this.uiManager = UIManager; // Use imported module directly
        this.atmosphericManager = atmosphericManager; // Use imported singleton
        this.player = null;
        // this.score = 0; // Score state now managed by ScoreManager
        this.currentLevelConfig = null;
        this.playerAnimationTime = 0;
        this.powerupTimer = null; // Timer managed via event handler
        this.eventBus = eventBus; // Use imported singleton

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
        // gameStateManager is already assigned
        this.levelManager = initResult.levelManager;
        this.particleManager = initResult.particleManager;
        this.playerController = initResult.playerController;
        this.spatialGrid = initResult.spatialGrid;
        this.uiManager = initResult.uiManager;
        this.atmosphericManager = initResult.atmosphericManager;
        this.fpsCounter = initResult.fpsCounter;
        this.currentLevelConfig = initResult.currentLevelConfig;
        this.activeScene = this.scene; // Start with the initial scene

        // Setup event subscriptions after all components are initialized
        this._setupEventSubscriptions();

        // Setup global event listeners
        window.addEventListener('resize', () => this.cameraManager.handleResize(), false);

        // FPS toggle listener
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === controlsConfig.KEY_TOGGLE_FPS) {
                const newFpsState = !configManager.get('debug.showFPS');
                configManager.updateConfig('debug', { SHOW_FPS: newFpsState });
                if (this.fpsCounter) {
                    this.fpsCounter.style.display = newFpsState ? 'block' : 'none';
                }
            }
        });
        // Global key listener for game actions
        const boundHandleGlobalKeys = this.handleGlobalKeys.bind(this);
        document.removeEventListener('keydown', boundHandleGlobalKeys); // Prevent duplicates
        document.addEventListener('keydown', boundHandleGlobalKeys);

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

                // Create a new material for the magnet powerup effect
                const magnetMaterial = new THREE.MeshStandardMaterial({
                    color: gameplayConfig.MAGNET_EFFECT_COLOR,
                    emissive: gameplayConfig.MAGNET_EFFECT_EMISSIVE,
                    metalness: gameplayConfig.MAGNET_EFFECT_METALNESS,
                    roughness: gameplayConfig.MAGNET_EFFECT_ROUGHNESS
                });

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
        requestAnimationFrame(this.animate.bind(this));

        let deltaTime = this.clock.getDelta();
        if (isNaN(deltaTime) || !isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1.0) {
            deltaTime = 1 / 60;
        }
        deltaTime = Math.min(deltaTime, getConfig('MAX_DELTA_TIME', 1 / 15));

        const elapsedTime = this.clock.getElapsedTime();
        const currentState = this.gameStateManager.getCurrentState();

        performanceManager.updateFps();
        if (this.fpsCounter) {
            updateFpsCounter(this.fpsCounter, performanceManager.getCurrentFps());
        }

        this.cameraManager.update(deltaTime, currentState, this.player);

        if (currentState === GameStates.PLAYING) {
            updateGameplay(
                { // Pass dependencies object
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
            // Update player animation time (still managed by Game)
            this.playerAnimationTime += deltaTime;
        }

        this.sceneTransitionManager.update(deltaTime, elapsedTime);
        this.activeScene = this.sceneTransitionManager.getActiveScene() || this.scene;

        // Log active scene and state being rendered
        logger.debug(`[Animate] State: ${currentState}, Rendering activeScene UUID: ${this.activeScene?.uuid}`);
        if (this.renderer && this.activeScene && this.camera) {
            this.renderer.render(this.activeScene, this.camera);
        } else {
             logger.warn("Skipping render: Missing renderer, activeScene, or camera.");
        }
    }

    // --- Game Flow Methods (Called by Event Handlers via Callbacks) ---

    /**
     * Starts or transitions to a specific game level.
     * @param {string} levelId - The ID of the level to start.
     * @returns {Promise<void>}
     */
    async startGame(levelId) {
        logger.info(`[Game] startGame called for level: ${levelId}`); // Log invocation
        logger.info(`Starting level: ${levelId}`);

        resetInputStates();
        logger.info("Input states reset before starting game");
        updateMobileControlsVisibility();

        // Load level config first
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

        // Set intermediate state
        this.gameStateManager.setGameState(GameStates.TRANSITIONING_TO_GAMEPLAY);
    }

    /**
     * Internal helper to load level assets and chunks.
     * @param {string} levelId - The ID of the level to load.
     * @returns {Promise<void>}
     * @private
     */
    async _loadLevel(levelId) {
        logger.info(`[_loadLevel] Starting execution for level ID: ${levelId}`);
        try {
            this.gameStateManager.setGameState(GameStates.LOADING_LEVEL);
            logger.info(`[_loadLevel] Loading level ${levelId}...`);

            const playerCurrentParent = this.player.model?.parent;

            logger.debug("[_loadLevel] Step 1: Unloading previous level...");
            // Unload previous level assets/state
            logger.info("Unloading current level assets and state (if necessary)...");
            this.enemyManager.removeAllEnemies();
            this.chunkManager.clearAllChunks();
            this.atmosphericManager.clearElements();
            if (this.levelManager.getCurrentLevelId() && this.levelManager.getCurrentLevelId() !== levelId) {
                 this.levelManager.unloadCurrentLevel();
            } else {
                 logger.info("Skipping asset disposal (first level or restarting same level).");
            }

            logger.debug("[_loadLevel] Step 2: Ensuring level config...");
            // Ensure config is loaded/set
            this.currentLevelConfig = this.levelManager.getCurrentConfig();
            if (!this.currentLevelConfig || this.levelManager.getCurrentLevelId() !== levelId) {
                 logger.info(`Loading new level config for ${levelId}...`);
                 const levelLoaded = await this.levelManager.loadLevel(levelId);
                 if (!levelLoaded) throw new Error(`Failed to load level config for ${levelId}.`);
                 this.currentLevelConfig = this.levelManager.getCurrentConfig();
            }

            logger.debug("[_loadLevel] Step 3: Initializing assets...");
            // Initialize Assets, Scene, Player, Chunks
            logger.info("Initializing new level assets...");
            await this.assetManager.initLevelAssets(this.currentLevelConfig);
            logger.debug("[_loadLevel] Step 4: Adding atmospheric elements...");
            this.atmosphericManager.addElementsForLevel(levelId, this.gameplayScene);
            logger.debug("[_loadLevel] Step 5: Updating scene appearance...");
            logger.info("Updating scene appearance...");
            this._updateSceneAppearance(this.currentLevelConfig, this.gameplayScene);
            logger.debug("[_loadLevel] Step 6: Setting chunk manager config...");
            this.chunkManager.setLevelConfig(this.currentLevelConfig);

            logger.debug("[_loadLevel] Step 7: Resetting player state...");
            logger.info("Resetting player state...");
            if (this.player.model) {
                if (playerCurrentParent && playerCurrentParent !== this.gameplayScene) {
                    playerCurrentParent.remove(this.player.model);
                }
                this.player.model.position.set(playerConfig.INITIAL_POS_X, playerConfig.INITIAL_POS_Y, playerConfig.INITIAL_POS_Z);
                this.player.model.rotation.set(0, 0, 0);
                this.player.currentSpeed = playerConfig.SPEED;
                this.player.powerup = '';
                if (this.gameplayScene) {
                    logger.debug(`[_loadLevel] Attempting to add player model to gameplayScene (UUID: ${this.gameplayScene.uuid})`);
                    if (this.player.model.parent !== this.gameplayScene) {
                        this.gameplayScene.add(this.player.model);
                    }
                    this.player.model.visible = true;
                    logger.debug(`[_loadLevel] Player model added. Visibility: ${this.player.model.visible}, Parent UUID: ${this.player.model.parent?.uuid}`);
                } else {
                    logger.error("[_loadLevel] Cannot add player model, gameplayScene is null!");
                }
            } else {
                logger.error("Player model is null when trying to reset for new level.");
            }
            // Reset score via ScoreManager
            ScoreManager.resetCurrentScore();
            // The 'currentScoreUpdated' event is now emitted by ScoreManager.updateCurrentScore
            // this.eventBus.emit('currentScoreUpdated', { score: 0, levelId: levelId }); // Removed redundant event emit
            this.playerAnimationTime = 0;
            if (this.powerupTimer) clearTimeout(this.powerupTimer);
            this.powerupTimer = null;

            logger.debug("[_loadLevel] Step 8: Loading initial chunks...");
            logger.info("Loading initial chunks for new level...");
            await this.chunkManager.loadInitialChunks((loaded, total) => {
                 this.uiManager.updateLoadingProgress(loaded, total);
            });
            const initialPlayerChunkX = Math.floor(playerConfig.INITIAL_POS_X / this.chunkManager.chunkSize);
            const initialPlayerChunkZ = Math.floor(playerConfig.INITIAL_POS_Z / this.chunkManager.chunkSize);
            this.chunkManager.lastCameraChunkX = initialPlayerChunkX;
            this.chunkManager.lastCameraChunkZ = initialPlayerChunkZ;

            logger.info(`[_loadLevel] Level ${levelId} loaded successfully.`);

        } catch (error) {
            logger.error(`[_loadLevel] CRITICAL ERROR during level load for ${levelId}:`, error);
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

    // _updateGameplay method is now removed, its logic is in gameplayUpdater.js
}

export { Game };
