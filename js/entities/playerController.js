// js/entities/playerController.js
import * as THREE from 'three';
import { createLogger, LogLevel } from '../utils/logger.js'; // Import logger
// Import config objects
import { playerConfig } from '../config/player.js';
import { controlsConfig } from '../config/controls.js';

import { playWaveFile, effectAudioMap } from '../managers/audioManager.js';
import { animatePlayerCharacter } from './playerCharacter.js'; // Stays in entities
import { keyLeftPressed, keyRightPressed, mouseLeftPressed, mouseRightPressed, touchLeftPressed, touchRightPressed } from '../input/controlsSetup.js'; // Moved to input

const logger = createLogger('PlayerController', LogLevel.DEBUG); // Instantiate logger

// Helper vectors (consider making these local if not needed elsewhere)
const forwardVector = new THREE.Vector3(0, 0, -1);
const playerDirection = new THREE.Vector3();
const playerQuaternion = new THREE.Quaternion();
const downVector = new THREE.Vector3(0, -1, 0); // For terrain raycasting
// Reusable vectors for raycasting origins
const _rayOriginFront = new THREE.Vector3();
const _rayOriginBack = new THREE.Vector3();
const _averageNormal = new THREE.Vector3();
const _slideDirection = new THREE.Vector3();
const _targetQuaternion = new THREE.Quaternion();
const _upVector = new THREE.Vector3(0, 1, 0); // World up vector for reference
const _yawDeltaQuaternion = new THREE.Quaternion(); // For applying input yaw changes
 
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
 */
export function updatePlayer(playerObj, deltaTime, animationTime, chunkManager) {
    if (!playerObj || !playerObj.model || !_raycaster) {
        logger.warn("Player object or raycaster not properly initialized for updatePlayer.");
        return;
    }
 
    const playerModel = playerObj.model; // Convenience reference to the THREE.Group
    const playerParts = playerObj.modelParts; // Convenience reference to animatable parts

    // Initialize verticalVelocity if it doesn't exist
    if (playerObj.verticalVelocity === undefined) {
        playerObj.verticalVelocity = 0;
    }
    // Initialize isSliding if it doesn't exist
    if (playerObj.isSliding === undefined) {
        playerObj.isSliding = false;
    }

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
    // logger.debug(`Input: totalRotationDelta: ${totalRotationDelta.toFixed(4)}`);
 
    // Apply input yaw rotation directly to the quaternion
    if (Math.abs(totalRotationDelta) > 0.0001) { // Apply if there's a meaningful rotation
        _yawDeltaQuaternion.setFromAxisAngle(_upVector, totalRotationDelta);
        playerModel.quaternion.premultiply(_yawDeltaQuaternion); // Premultiply to apply rotation in model's local Y
        if (Math.abs(totalRotationDelta) > controlsConfig.TURN_SOUND_THRESHOLD) {
            playWaveFile(effectAudioMap['turn']);
        }
    }
    // playerModel.rotation.y is now managed by the quaternion update.
 
    // 2. Handle Tilting (Roll) based on TOTAL rotation speed
    // Note: totalRotationRate is still based on the input delta for responsive tilt.
    const totalRotationRate = (deltaTime > 0) ? totalRotationDelta / deltaTime : 0;

    // 3. Animate Limbs
    // Note: Config.PLAYER_SPEED is not directly available via named imports, assuming it's accessible if needed elsewhere or refactor if required.
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
    // 5. Terrain Following and Slope Handling
    if (chunkManager) {
        const currentPosition = playerModel.position;
        const nearbyMeshes = chunkManager.getTerrainMeshesNear(currentPosition);
        let highestGroundY = -Infinity;
        let groundFound = false;
        const hitNormals = [];

        // playerDirection is the intended forward movement direction, calculated at lines 94-95
        // Ray 1: Front - origin projected along player's forward direction
        _rayOriginFront.copy(currentPosition).addScaledVector(playerDirection, playerConfig.RAYCAST_STRIDE_OFFSET);
        _rayOriginFront.y += playerConfig.RAYCAST_ORIGIN_OFFSET;
        _raycaster.set(_rayOriginFront, downVector);
        const intersectsFront = _raycaster.intersectObjects(nearbyMeshes);
        if (intersectsFront.length > 0 && intersectsFront[0].distance < playerConfig.RAYCAST_ORIGIN_OFFSET + playerConfig.HEIGHT_OFFSET + 2) { // Check distance with a small margin
            highestGroundY = Math.max(highestGroundY, intersectsFront[0].point.y);
            if (intersectsFront[0].face) {
                 hitNormals.push(intersectsFront[0].face.normal.clone().transformDirection(intersectsFront[0].object.matrixWorld).normalize());
            } else {
                hitNormals.push(_upVector.clone()); // Fallback if no face normal
            }
            groundFound = true;
        }

        // Ray 2: Back - origin projected along player's backward direction
        _rayOriginBack.copy(currentPosition).addScaledVector(playerDirection, -playerConfig.RAYCAST_STRIDE_OFFSET);
        _rayOriginBack.y += playerConfig.RAYCAST_ORIGIN_OFFSET;
        _raycaster.set(_rayOriginBack, downVector);
        const intersectsBack = _raycaster.intersectObjects(nearbyMeshes);
        if (intersectsBack.length > 0 && intersectsBack[0].distance < playerConfig.RAYCAST_ORIGIN_OFFSET + playerConfig.HEIGHT_OFFSET + 2) { // Check distance
            highestGroundY = Math.max(highestGroundY, intersectsBack[0].point.y);
             if (intersectsBack[0].face) {
                hitNormals.push(intersectsBack[0].face.normal.clone().transformDirection(intersectsBack[0].object.matrixWorld).normalize());
            } else {
                hitNormals.push(_upVector.clone()); // Fallback if no face normal
            }
            groundFound = true;
        }

        if (groundFound) {
            _averageNormal.set(0, 0, 0);
            if (hitNormals.length > 0) {
                hitNormals.forEach(normal => _averageNormal.add(normal));
                _averageNormal.divideScalar(hitNormals.length).normalize();
            } else {
                _averageNormal.copy(_upVector); // Default to up if something went wrong (e.g. no face normals)
            }

            const slopeAngle = _averageNormal.angleTo(_upVector);
            const maxClimbableSlopeRadians = THREE.MathUtils.degToRad(playerConfig.MAX_CLIMBABLE_SLOPE_ANGLE);

            if (slopeAngle > maxClimbableSlopeRadians) {
                playerObj.isSliding = true;
                // Calculate slide direction: perpendicular to player's forward and slope normal, then projected down slope.
                // A simpler way: find the component of gravity acting along the slope.
                _slideDirection.copy(_upVector).negate(); // Gravity direction
                const normalComponent = _averageNormal.clone().multiplyScalar(_slideDirection.dot(_averageNormal));
                _slideDirection.sub(normalComponent).normalize(); // Direction down the steepest part of the slope

                const slideMove = playerConfig.SLIDE_SPEED_FACTOR * playerObj.currentSpeed * deltaTime;
                playerModel.position.addScaledVector(_slideDirection, slideMove);

                // Stick to the slope while sliding
                playerModel.position.y = highestGroundY + playerConfig.HEIGHT_OFFSET;
                playerObj.verticalVelocity = 0;
            } else {
                playerObj.isSliding = false;
                playerModel.position.y = highestGroundY + playerConfig.HEIGHT_OFFSET;
                playerObj.verticalVelocity = 0;
            }
 
            // Player tilt based on terrain slope has been removed.
            // The player's orientation (quaternion) is now primarily updated by:
            // 1. Input yaw rotation (lines 87-94)
            // 2. Input-based roll/tilt (lines 97-102)
            // The player will remain upright relative to their yaw, not aligning to the terrain normal.
        } else {
            // No ground detected
            playerObj.isSliding = false;
            playerObj.verticalVelocity -= playerConfig.GRAVITY * deltaTime;
            playerObj.verticalVelocity = Math.max(playerObj.verticalVelocity, -playerConfig.MAX_FALL_SPEED);
            playerModel.position.y += playerObj.verticalVelocity * deltaTime;

            // Optional: Reset orientation slightly towards upright when airborne
            // _targetQuaternion.setFromEuler(new THREE.Euler(0, playerModel.rotation.y, 0)); // Keep yaw, level roll/pitch
            // playerModel.quaternion.slerp(_targetQuaternion, playerConfig.PLAYER_ALIGN_TO_SLOPE_SPEED * deltaTime * 0.1);


            if (playerModel.position.y < playerConfig.MIN_Y_POSITION) {
                logger.warn("Player has fallen below MIN_Y_POSITION.");
                playerModel.position.y = playerConfig.MIN_Y_POSITION;
                playerObj.verticalVelocity = 0;
            }
        }
    } else {
        // Fallback if no chunkManager (should not happen in normal gameplay)
        playerObj.isSliding = false;
        playerObj.verticalVelocity -= playerConfig.GRAVITY * deltaTime;
        playerObj.verticalVelocity = Math.max(playerObj.verticalVelocity, -playerConfig.MAX_FALL_SPEED);
        playerModel.position.y += playerObj.verticalVelocity * deltaTime;
        if (playerModel.position.y < playerConfig.MIN_Y_POSITION) {
            playerModel.position.y = playerConfig.MIN_Y_POSITION;
            playerObj.verticalVelocity = 0;
        }
    }

    // Camera following is handled by CameraManager via Game's main loop
}
