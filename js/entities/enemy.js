import * as THREE from 'three';
import { createLogger } from '../utils/logger.js';
import { enemyDefaultsConfig } from '../config/enemyDefaults.js';
import * as UIManager from '../managers/uiManager.js';
import { smoothDamp } from '../utils/mathUtils.js';

const logger = createLogger('Enemy');


const ENEMY_STATE = {
    IDLE: 'idle',
    ROAMING: 'roaming',
    CHASING: 'chasing',
    RETURNING: 'returning',
};

const groundRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
const _moveDirection = new THREE.Vector3();
const _lookTargetPos = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _lookAtMatrix = new THREE.Matrix4();
const _roamingTargetVec = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();


export class Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        if (!chunkManager) {
            const errorMsg = `[Enemy ${initialData.type}] Constructor missing ChunkManager! Grounding will fail.`;
            UIManager.displayError(new Error(errorMsg));
            logger.error(errorMsg);
        }
        this.scene = scene;
        this.chunkManager = chunkManager;
        this.type = initialData.type || 'unknown';
        this.originalPosition = initialData.position.clone();

        this.speed = properties.speed ?? enemyDefaultsConfig.SPEED;
        this.aggroRadius = properties.aggroRadius ?? enemyDefaultsConfig.AGGRO_RADIUS;
        this.deaggroRadius = properties.deaggroRadius ?? enemyDefaultsConfig.DEAGGRO_RADIUS;
        this.roamingRadius = properties.roamingRadius ?? enemyDefaultsConfig.ROAMING_RADIUS;
        this.roamingSpeedFactor = properties.roamingSpeedFactor ?? enemyDefaultsConfig.ROAMING_SPEED_FACTOR;
        this.roamingMinWaitTime = properties.roamingMinWaitTime ?? enemyDefaultsConfig.ROAMING_MIN_WAIT_TIME;
        this.roamingMaxWaitTime = properties.roamingMaxWaitTime ?? enemyDefaultsConfig.ROAMING_MAX_WAIT_TIME;
        this.state = ENEMY_STATE.IDLE;
        this.mesh = null;
        this.groundCheckCounter = Math.floor(Math.random() * 5);
        this.lastGroundY = initialData.position.y;
        this.currentGroundY = initialData.position.y;
        this.verticalVelocity = 0; // Initialize vertical velocity
        this.roamingTarget = null;
        this.roamingWaitTimer = 0;
        this.positionSmoothingFactor = enemyDefaultsConfig.POSITION_SMOOTHING_FACTOR;
        this.lastPosition = initialData.position.clone();


        try {
            this.mesh = this.createMesh(); // Calls subclass specific createMesh
        } catch (error) {
             logger.error(`Error creating mesh for ${this.type}:`, error);
             UIManager.displayError(new Error(`[Enemy] Failed to create mesh for type ${this.type}. See console.`));
             this.mesh = null;
        }

        if (this.mesh) {
            this.mesh.position.copy(initialData.position);
            this.mesh.rotation.y = initialData.rotationY || 0;
            if (!this.mesh.userData) this.mesh.userData = {};
            this.mesh.userData.enemyInstance = this;
            this.mesh.userData.objectType = this.type;

            if (this.scene) {
                this.scene.add(this.mesh);
            } else {
                const errorMsg = `[Enemy ${this.type}] Scene not available for adding mesh!`;
                UIManager.displayError(new Error(errorMsg));
                logger.error(errorMsg);
            }
        }
    }


    createMesh() {
        const errorMsg = `createMesh() not implemented for subclass type ${this.type}!`;
        UIManager.displayError(new Error(`[Enemy] ${errorMsg}`));
        logger.error(errorMsg);
        return null;
    }

    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!this.mesh || !this.chunkManager) return;

        this._updateGrounding(deltaTime); // Pass deltaTime for gravity calculation
        this._updateState(playerPos, currentPowerup, deltaTime);
        const { isMoving, currentSpeed } = this._updateMovement(playerPos, deltaTime);
        this._updateAnimation(elapsedTime, isMoving, currentSpeed);
    }



    _updateGrounding(deltaTime) {
        const currentPosition = this.mesh.position;
        const legHeight = this.mesh.userData.legHeight || 0.5; // Define legHeight once

        _rayOrigin.set(currentPosition.x, currentPosition.y + enemyDefaultsConfig.GROUND_CHECK_OFFSET, currentPosition.z);
        groundRaycaster.set(_rayOrigin, downVector);
        const nearbyTerrain = this.chunkManager.getTerrainMeshesNear(currentPosition);
        const intersects = groundRaycaster.intersectObjects(nearbyTerrain);

        if (intersects.length > 0) {
            this.lastGroundY = intersects[0].point.y;
            const smoothFactor = enemyDefaultsConfig.GROUND_SMOOTHING_FACTOR;
            this.currentGroundY = this.currentGroundY * (1.0 - smoothFactor) + this.lastGroundY * smoothFactor;
            this.mesh.position.y = this.currentGroundY + legHeight / 2;
            this.verticalVelocity = 0; // Reset vertical velocity when grounded
        } else {
            // Apply gravity
            this.verticalVelocity -= enemyDefaultsConfig.GRAVITY * deltaTime;
            // Clamp to max fall speed
            this.verticalVelocity = Math.max(this.verticalVelocity, -enemyDefaultsConfig.MAX_FALL_SPEED);
            // Update enemy position based on fall speed
            this.mesh.position.y += this.verticalVelocity * deltaTime;

            // Check for falling out of the world
            if (this.mesh.position.y < enemyDefaultsConfig.MIN_Y_POSITION) {
                logger.warn(`Enemy ${this.type} has fallen below MIN_Y_POSITION. Clamping position.`);
                // For now, clamp to MIN_Y_POSITION to prevent falling indefinitely
                // Future: Consider despawn or other logic here
                this.mesh.position.y = enemyDefaultsConfig.MIN_Y_POSITION;
                this.verticalVelocity = 0; // Stop further falling
            } else if (this.mesh.position.y < this.currentGroundY + legHeight / 2 && this.verticalVelocity < 0) {
                // This case handles falling slightly below the last known ground due to discrete steps.
                // If we are now below where we thought ground was, and still falling,
                // but no new ground was found by the raycast above, we continue falling.
                // If a more robust "snap to ground if very close" is needed, it would go here,
                // but the current raycast should handle re-grounding in the next frame if ground appears.
            }
        }
    }

    _updateState(playerPos, currentPowerup, deltaTime) {
        const distanceToPlayer = this.mesh.position.distanceTo(playerPos);
        const distanceToOrigin = this.mesh.position.distanceTo(this.originalPosition);

        switch (this.state) {
            case ENEMY_STATE.IDLE:
                this.state = ENEMY_STATE.ROAMING;
                this.pickNewRoamingTarget();

            case ENEMY_STATE.ROAMING:
                 if (distanceToPlayer < this.aggroRadius && currentPowerup !== 'invisibility') {
                    this.state = ENEMY_STATE.CHASING;
                    this.roamingTarget = null;
                    this.roamingWaitTimer = 0;
                 } else if (this.roamingWaitTimer > 0) {
                    this.roamingWaitTimer -= deltaTime;
                    if (this.roamingWaitTimer <= 0) {
                        this.pickNewRoamingTarget();
                    }
                 }
                break;
            case ENEMY_STATE.CHASING:
                if (distanceToPlayer > this.deaggroRadius || currentPowerup === 'invisibility') {
                    this.state = ENEMY_STATE.RETURNING;
                }
                break;
            case ENEMY_STATE.RETURNING:
                if (distanceToOrigin < enemyDefaultsConfig.RETURN_DISTANCE_THRESHOLD) {
                    this.state = ENEMY_STATE.ROAMING;
                    this.roamingTarget = null;
                    this.setRoamingWaitTimer();
                } else if (distanceToPlayer < this.aggroRadius) {
                    this.state = ENEMY_STATE.CHASING;
                    this.roamingTarget = null;
                    this.roamingWaitTimer = 0;
                }
                break;
        }
    }

    _updateMovement(playerPos, deltaTime) {
        let targetPosition = null;
        let isMoving = false;
        let currentSpeed = this.speed;

        if (this.state === ENEMY_STATE.CHASING) {
            targetPosition = playerPos;
        } else if (this.state === ENEMY_STATE.RETURNING) {
            targetPosition = this.originalPosition;
        } else if (this.state === ENEMY_STATE.ROAMING && this.roamingTarget && this.roamingWaitTimer <= 0) {
            targetPosition = this.roamingTarget;
            currentSpeed = this.speed * this.roamingSpeedFactor;
        }

        isMoving = !!targetPosition && this.roamingWaitTimer <= 0;

        if (isMoving && targetPosition) {
            _moveDirection.subVectors(targetPosition, this.mesh.position);
            _moveDirection.y = 0;
            const distanceToTarget = _moveDirection.length();

            if (distanceToTarget > enemyDefaultsConfig.MOVE_THRESHOLD) {
                _moveDirection.normalize();
                const moveDistance = currentSpeed * deltaTime;

                if (moveDistance >= distanceToTarget) {
                    this.mesh.position.x = targetPosition.x;
                    this.mesh.position.z = targetPosition.z;
                    if (this.state === ENEMY_STATE.ROAMING || this.state === ENEMY_STATE.RETURNING) {
                        this.roamingTarget = null;
                        this.setRoamingWaitTimer();
                        this.state = ENEMY_STATE.ROAMING; // Ensure state is ROAMING after reaching target
                        isMoving = false;
                    }
                } else {
                    this.mesh.position.x += _moveDirection.x * moveDistance;
                    this.mesh.position.z += _moveDirection.z * moveDistance;
                }

                if (_moveDirection.lengthSq() > enemyDefaultsConfig.LOOK_THRESHOLD_SQ) {
                    _lookTargetPos.copy(this.mesh.position).add(_moveDirection);
                    _lookAtMatrix.lookAt(this.mesh.position, _lookTargetPos, this.mesh.up);
                    _targetQuat.setFromRotationMatrix(_lookAtMatrix);
                    this.mesh.quaternion.slerp(_targetQuat, enemyDefaultsConfig.ROTATION_SLERP_FACTOR);
                }
            } else {
                if (this.state === ENEMY_STATE.ROAMING || this.state === ENEMY_STATE.RETURNING) {
                    this.roamingTarget = null;
                    this.setRoamingWaitTimer();
                    this.state = ENEMY_STATE.ROAMING;
                    isMoving = false;
                }
            }
        } else {
            isMoving = false;
        }

        return { isMoving, currentSpeed };
    }


    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
        if (this.mesh?.userData?.legs) {
            const legs = this.mesh.userData.legs;
            const animationSpeed = currentSpeed * enemyDefaultsConfig.ANIMATION_SPEED_FACTOR * (isMoving ? 1 : 0);
            const legSwingAmplitude = enemyDefaultsConfig.LEG_SWING_AMPLITUDE;

            if (isMoving && animationSpeed > 0) {
                const phase = elapsedTime * animationSpeed;
                legs.frontLeftLeg.rotation.x = Math.sin(phase) * legSwingAmplitude;
                legs.backRightLeg.rotation.x = Math.sin(phase) * legSwingAmplitude;
                legs.frontRightLeg.rotation.x = Math.sin(phase + Math.PI) * legSwingAmplitude;
                legs.backLeftLeg.rotation.x = Math.sin(phase + Math.PI) * legSwingAmplitude;
            } else {
                const smoothTime = enemyDefaultsConfig.STOPPED_ANIMATION_SMOOTHING;
                legs.frontLeftLeg.rotation.x = smoothDamp(legs.frontLeftLeg.rotation.x, 0, smoothTime, smoothTime);
                legs.backRightLeg.rotation.x = smoothDamp(legs.backRightLeg.rotation.x, 0, smoothTime, smoothTime);
                legs.frontRightLeg.rotation.x = smoothDamp(legs.frontRightLeg.rotation.x, 0, smoothTime, smoothTime);
                legs.backLeftLeg.rotation.x = smoothDamp(legs.backLeftLeg.rotation.x, 0, smoothTime, smoothTime);
            }
        }
    }

    getMesh() {
        return this.mesh;
    }

    removeFromScene() {
        if (this.scene && this.mesh) {
            this.scene.remove(this.mesh);
        }
    }


    pickNewRoamingTarget() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.roamingRadius;
        const targetX = this.originalPosition.x + Math.cos(angle) * radius;
        const targetZ = this.originalPosition.z + Math.sin(angle) * radius;
        this.roamingTarget = _roamingTargetVec.set(targetX, this.originalPosition.y, targetZ);
    }

    setRoamingWaitTimer() {
        this.roamingWaitTimer = this.roamingMinWaitTime + Math.random() * (this.roamingMaxWaitTime - this.roamingMinWaitTime);
    }

    /**
     * Resets the enemy's state for reuse from an object pool.
     * @param {object} initialData - Data containing position, rotation, etc.
     * @param {object} properties - Enemy-specific properties from level config.
     */
    reset(initialData, properties) {
        this.state = ENEMY_STATE.IDLE;
        this.originalPosition.copy(initialData.position);
        this.lastPosition.copy(initialData.position);
        this.currentGroundY = initialData.position.y;
        this.lastGroundY = initialData.position.y;
        this.verticalVelocity = 0; // Reset vertical velocity
        this.roamingTarget = null;
        this.roamingWaitTimer = 0;
        this.groundCheckCounter = Math.floor(Math.random() * 5);

        this.speed = properties.speed ?? enemyDefaultsConfig.SPEED;
        this.aggroRadius = properties.aggroRadius ?? enemyDefaultsConfig.AGGRO_RADIUS;
        this.deaggroRadius = properties.deaggroRadius ?? enemyDefaultsConfig.DEAGGRO_RADIUS;
        this.roamingRadius = properties.roamingRadius ?? enemyDefaultsConfig.ROAMING_RADIUS;
        this.roamingSpeedFactor = properties.roamingSpeedFactor ?? enemyDefaultsConfig.ROAMING_SPEED_FACTOR;
        this.roamingMinWaitTime = properties.roamingMinWaitTime ?? enemyDefaultsConfig.ROAMING_MIN_WAIT_TIME;
        this.roamingMaxWaitTime = properties.roamingMaxWaitTime ?? enemyDefaultsConfig.ROAMING_MAX_WAIT_TIME;

        if (this.mesh) {
            this.mesh.position.copy(initialData.position);
            this.mesh.rotation.set(0, initialData.rotationY || 0, 0);
            this.mesh.visible = true;
            if (this.mesh.userData?.legs) {
                Object.values(this.mesh.userData.legs).forEach(leg => leg.rotation.set(0, 0, 0));
            }
        } else {
            logger.error(`[Enemy ${this.type}] Cannot reset mesh properties, mesh is null!`);
        }
    }
}

