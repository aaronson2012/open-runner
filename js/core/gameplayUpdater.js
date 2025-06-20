
import { createLogger, LogLevel } from '../utils/logger.js';
import cameraManager from '../managers/cameraManager.js';
import { getPlayerManager } from '../managers/playerManager.js';

const logger = createLogger('GameplayUpdater', LogLevel.INFO);

/**
 * Updates all game logic relevant to the PLAYING state.
 * Called by the main game loop when the game state is PLAYING.
 * @param {object} dependencies - Object containing necessary dependencies.
 * @param {object} dependencies.player - The player state object { model, modelParts, currentSpeed, powerup }.
 * @param {object} dependencies.playerController - The player controller module/object.
 * @param {object} dependencies.chunkManager - The ChunkManager instance.
 * @param {object} dependencies.enemyManager - The EnemyManager instance.
 * @param {object} dependencies.particleManager - The ParticleManager instance.
 * @param {object} dependencies.collisionManager - The collision manager instance.
 * @param {object} dependencies.atmosphericManager - The AtmosphericManager instance.
 * @param {number} dependencies.playerAnimationTime - Current animation time for the player.
 * @param {number} deltaTime - Time elapsed since the last frame.
 * @param {number} elapsedTime - Total time elapsed since the game started.
 */
export function updateGameplay(dependencies, deltaTime, elapsedTime) {
    const {
        player,
        playerController,
        chunkManager,
        enemyManager,
        particleManager,
        collisionManager,
        atmosphericManager,
        playerAnimationTime
    } = dependencies;

    if (!player || !playerController || !chunkManager || !enemyManager || !particleManager || !collisionManager || !atmosphericManager) {
        logger.error("Missing one or more dependencies in updateGameplay. Aborting update.");
        return;
    }

    const playerManager = getPlayerManager();
    const currentPowerup = playerManager ? playerManager.getCurrentPowerup() : player.powerup;

    if (player.model) {
        playerController.updatePlayer(player, deltaTime, playerAnimationTime, chunkManager, null);
    } else {
        logger.warn("Cannot update player: player model is missing");
    }

    if (chunkManager && player.model) {
        chunkManager.update(player.model.position);
        chunkManager.updateCollectibles(deltaTime, elapsedTime, player.model.position, currentPowerup);
        chunkManager.updateTumbleweeds(deltaTime, elapsedTime, player.model.position);
    }
    if (enemyManager && player.model) {
        enemyManager.update(player.model.position, currentPowerup, deltaTime, elapsedTime);
    }
    if (particleManager && player.model) {
        particleManager.update(deltaTime, player.model.position);
    }

    if (atmosphericManager) {
        atmosphericManager.update(deltaTime, elapsedTime);
    }

    if (collisionManager && player?.model) {
        collisionManager.update(player);
    }
}
