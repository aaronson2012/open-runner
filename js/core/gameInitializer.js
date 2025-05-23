import * as THREE from 'three';
import { ChunkManager } from '../managers/chunkManager.js';
import { EnemyManager } from '../managers/enemyManager.js';
import { SpatialGrid } from '../physics/spatialGrid.js';
import { ParticleManager } from '../managers/particleManager.js';
import { setupPlayerControls, initInputStateManager } from '../input/controlsSetup.js';
import { setDeviceClass } from '../utils/deviceUtils.js';
import { createPlayerCharacter } from '../entities/playerCharacter.js';
import { performanceManager } from '../config/config.js';
import { worldConfig } from '../config/world.js';
import { playerConfig } from '../config/player.js';
import * as AudioManager from '../managers/audioManager.js';
import { initScene, createFpsCounter } from '../rendering/sceneSetup.js';
import * as LevelManager from '../managers/levelManager.js';
import gameStateManager, { GameStates } from './gameStateManager.js';
import eventBus from './eventBus.js';
import { initPlayerController, updatePlayer as updatePlayerController } from '../entities/playerController.js';
import { initCollisionManager, checkCollisions } from '../managers/collisionManager.js';
import * as ScoreManager from '../managers/scoreManager.js';
import * as UIManager from '../managers/uiManager.js';
import * as AssetManager from '../managers/assetManager.js';
import cameraManager from '../managers/cameraManager.js';
import sceneTransitionManager from '../managers/sceneTransitionManager.js';
import atmosphericManager from '../managers/atmosphericManager.js';
import { createLogger } from '../utils/logger.js';
import * as ModelFactory from '../rendering/modelFactory.js';

const logger = createLogger('GameInitializer');

/**
 * Initializes the core game components and managers asynchronously.
 * Returns an object containing the initialized components.
 * @param {HTMLCanvasElement} canvasElement - The canvas element for rendering.
 * @returns {Promise<object|null>} An object with initialized components or null if initialization fails.
 */
export async function initializeGame(canvasElement) {
    logger.info("Game initialization started...");

    try {
        setDeviceClass();
        performanceManager.init();
        const fpsCounter = createFpsCounter();

        if (!UIManager.initUIManager()) {
            logger.error("UI Manager initialization failed.");
            return null;
        }

        UIManager.updateScoreDisplay(0, false, true);
        UIManager.updateHighScoreDisplay(ScoreManager.getGlobalHighScore());

        const initialLevelId = 'level1';
        const levelLoaded = await LevelManager.loadLevel(initialLevelId);
        if (!levelLoaded) {
            logger.error("Initial level configuration loading failed.");
            return null;
        }
        const currentLevelConfig = LevelManager.getCurrentConfig();

        await AssetManager.initLevelAssets(currentLevelConfig);

        const { scene, camera, renderer } = initScene(canvasElement, currentLevelConfig);

        const playerModelData = createPlayerCharacter();
        const player = {
            model: playerModelData.characterGroup,
            modelParts: playerModelData,
            currentSpeed: playerConfig.SPEED,
            powerup: '',
        };
        player.model.position.set(playerConfig.INITIAL_POS_X, playerConfig.INITIAL_POS_Y, playerConfig.INITIAL_POS_Z);
        player.model.rotation.y = Math.PI; // Set initial rotation to face -Z (forward)

        cameraManager.setCamera(camera);
        cameraManager.setRenderer(renderer);
        sceneTransitionManager.setRenderer(renderer);
        sceneTransitionManager.setCamera(camera);
        sceneTransitionManager.setPlayer(player); // Pass player object
        atmosphericManager.setPlayerReference(player); // Pass player object
        atmosphericManager.setTargetScene(scene); // Initial scene

        const spatialGrid = new SpatialGrid(worldConfig.GRID_CELL_SIZE);
        const enemyManager = new EnemyManager(scene, spatialGrid);
        const chunkManager = new ChunkManager(scene, enemyManager, spatialGrid, currentLevelConfig);
        const particleManager = new ParticleManager(scene);
        LevelManager.setManagers(chunkManager, enemyManager);

        const raycaster = new THREE.Raycaster();
        initPlayerController(raycaster);
        initCollisionManager(spatialGrid, chunkManager);
        const collisionChecker = checkCollisions;

        setupPlayerControls(renderer.domElement);
        initInputStateManager();

        AudioManager.initAudio();

        gameStateManager.setGameState(GameStates.LOADING);
        await chunkManager.loadInitialChunks((loaded, total) => {
            UIManager.updateLoadingProgress(loaded, total);
        });

        gameStateManager.setGameState(GameStates.TITLE);

        logger.info("Game initialization complete.");

        return {
            scene,
            camera,
            renderer,
            player,
            assetManager: AssetManager,
            audioManager: AudioManager,
            cameraManager,
            sceneTransitionManager,
            chunkManager,
            collisionChecker,
            enemyManager,
            gameStateManager,
            levelManager: LevelManager,
            particleManager,
            playerController: { updatePlayer: updatePlayerController },
            spatialGrid,
            uiManager: UIManager,
            atmosphericManager,
            fpsCounter,
            currentLevelConfig,
            eventBus
        };

    } catch (error) {
        logger.error("CRITICAL ERROR during game initialization:", error);
        UIManager.displayError(new Error("Game initialization failed critically. Check console."));
        return null;
    }
}
