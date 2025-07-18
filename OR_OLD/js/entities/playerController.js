// NOTE: Always call initPlayerController(raycasterInstance) before using updatePlayer, or player movement will not work.
// js/entities/playerController.js
import * as THREE from 'three';
import { createLogger, LogLevel } from '../utils/logger.js'; // Import logger
// Import config objects
import { playerConfig } from '../config/player.js';
import { controlsConfig } from '../config/controls.js';

import { playWaveFile, effectAudioMap } from '../managers/audioManager.js';
import { animatePlayerCharacter } from './playerCharacter.js'; // Stays in entities
import { keyLeftPressed, keyRightPressed, mouseLeftPressed, mouseRightPressed, touchLeftPressed, touchRightPressed } from '../input/controlsSetup.js'; // Moved to input

const logger = createLogger('PlayerController', LogLevel.WARN); // Instantiate logger

// Helper vectors for player movement calculations
const forwardVector = new THREE.Vector3(0, 0, -1);
const playerDirection = new THREE.Vector3();
const playerQuaternion = new THREE.Quaternion();
const downVector = new THREE.Vector3(0, -1, 0); // For terrain raycasting
// Reusable vectors for raycasting origins
const _rayOriginFront = new THREE.Vector3();
const _rayOriginBack = new THREE.Vector3();

// Raycaster instance (passed in for efficiency)
let _raycaster;

/**
 * Initializes the player controller with necessary dependencies.
 * @param {THREE.Raycaster} raycasterInstance - The shared raycaster instance.
 */
export function initPlayerController(raycasterInstance) {
    _raycaster = raycasterInstance;
}

/**
 * Updates the player's state, including position, rotation, animation, and terrain following.
 * @param {object} playerObj - The player object containing model, modelParts, currentSpeed.
 * @param {number} deltaTime - Time elapsed since the last frame.
 * @param {number} elapsedTime - Total time elapsed.
 * @param {ChunkManager} chunkManager - For terrain height checks.
 * @param {function} updateCameraFollowFunc - Function to update camera position based on player.
 *                                          Pass null during camera transitions.
 */
export function updatePlayer(playerObj, deltaTime, animationTime, chunkManager, updateCameraFollowFunc) {
    if (!playerObj || !playerObj.model || !_raycaster) {
        logger.warn("Player object or raycaster not properly initialized for updatePlayer.");
        return;
    }

    const playerModel = playerObj.model; // Convenience reference to the THREE.Group
    const playerParts = playerObj.modelParts; // Convenience reference to animatable parts

    // --- Update Speed (Uncapped) ---
    playerObj.currentSpeed += playerConfig.SPEED_INCREASE_RATE * deltaTime; // Use imported constant

    // 1. Calculate Rotation Deltas based on combined keyboard, mouse, and touch input
    let rotationInput = 0; // -1 for right, 0 for none, 1 for left
    if (keyLeftPressed || mouseLeftPressed || touchLeftPressed) {
        rotationInput += 1;
    }

    if (keyRightPressed || mouseRightPressed || touchRightPressed) {
        rotationInput -= 1;
    }

    // Calculate total rotation applied this frame
    const totalRotationDelta = rotationInput * controlsConfig.KEY_TURN_SPEED * deltaTime; // Use imported constant

    // Apply total rotation
    if (Math.abs(totalRotationDelta) > controlsConfig.TURN_SOUND_THRESHOLD) { // Use imported constant
        playerModel.rotation.y += totalRotationDelta;
        playWaveFile(effectAudioMap['turn']);
    } else {
        playerModel.rotation.y += totalRotationDelta; // Apply small adjustments without sound
    }

    // 2. Handle Tilting (Roll) based on TOTAL rotation speed
    const totalRotationRate = (deltaTime > 0) ? totalRotationDelta / deltaTime : 0;
    const targetTilt = -totalRotationRate * controlsConfig.PLAYER_TILT_FACTOR; // Use imported constant
    const tiltSmoothingFactor = 1.0 - Math.pow(controlsConfig.PLAYER_TILT_SMOOTHING, deltaTime); // Use imported constant
    playerModel.rotation.z = THREE.MathUtils.lerp(playerModel.rotation.z, targetTilt, tiltSmoothingFactor);

    // 3. Animate Limbs
    
    // For now, assuming playerObj.currentSpeed increase rate implies base speed is handled.
    const cappedSpeedFactor = Math.min(playerObj.currentSpeed / playerConfig.SPEED, playerConfig.MAX_ANIMATION_SPEED_FACTOR); // Use playerConfig.SPEED
    const dynamicAnimSpeed = playerConfig.ANIMATION_BASE_SPEED * cappedSpeedFactor; // Use imported constants
    animatePlayerCharacter(playerParts, animationTime, dynamicAnimSpeed);

    // 4. Move Forward (in the direction the player is facing)
    const moveDistance = playerObj.currentSpeed * deltaTime;
    playerModel.getWorldQuaternion(playerQuaternion);
    playerDirection.copy(forwardVector).applyQuaternion(playerQuaternion).normalize();
    playerModel.position.addScaledVector(playerDirection, moveDistance);

    // 5. Terrain Following (using two rays)
    if (chunkManager) {
        const currentPosition = playerModel.position;
        const nearbyMeshes = chunkManager.getTerrainMeshesNear(currentPosition);
        let highestGroundY = -Infinity;
        let groundFound = false;

        // Ray 1: Front (Use reusable vector)
        _rayOriginFront.set(
            currentPosition.x,
            currentPosition.y + playerConfig.RAYCAST_ORIGIN_OFFSET, // Use imported constant
            currentPosition.z - playerConfig.RAYCAST_STRIDE_OFFSET // Use imported constant
        );
        _raycaster.set(_rayOriginFront, downVector);
        const intersectsFront = _raycaster.intersectObjects(nearbyMeshes);
        if (intersectsFront.length > 0) {
            highestGroundY = Math.max(highestGroundY, intersectsFront[0].point.y);
            groundFound = true;
        }

        // Ray 2: Back (Use reusable vector)
        _rayOriginBack.set(
            currentPosition.x,
            currentPosition.y + playerConfig.RAYCAST_ORIGIN_OFFSET, // Use imported constant
            currentPosition.z + playerConfig.RAYCAST_STRIDE_OFFSET // Use imported constant
        );
        _raycaster.set(_rayOriginBack, downVector);
        const intersectsBack = _raycaster.intersectObjects(nearbyMeshes);
        if (intersectsBack.length > 0) {
            highestGroundY = Math.max(highestGroundY, intersectsBack[0].point.y);
            groundFound = true;
        }

        // Set player Y position based on highest ground found
        if (groundFound) {
            playerModel.position.y = highestGroundY + playerConfig.HEIGHT_OFFSET; // Use imported constant
        } else {
    
        }
    }

    // 6. Camera Following (Call the passed-in function if provided)
    // During camera transitions, updateCameraFollowFunc will be null intentionally
    if (updateCameraFollowFunc) {
        try {
            updateCameraFollowFunc(playerObj, deltaTime);
        } catch (error) {
            logger.error("Error calling camera follow function:", error);
        }
    }
}
