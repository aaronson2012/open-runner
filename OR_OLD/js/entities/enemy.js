import * as THREE from 'three';
import { createLogger } from '../utils/logger.js';
import { enemyDefaultsConfig } from '../config/enemyDefaults.js';
import eventBus from '../core/eventBus.js';
import { smoothDamp, getPooledVector, releaseVector } from '../utils/mathUtils.js';
import { animationController } from '../animation/AnimationController.js';

const logger = createLogger('Enemy');


const ENEMY_STATE = {
    IDLE: 'idle',
    ROAMING: 'roaming',
    CHASING: 'chasing',
    RETURNING: 'returning',
};

const groundRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
const _targetQuat = new THREE.Quaternion();
const _lookAtMatrix = new THREE.Matrix4();
const _roamingTargetVec = new THREE.Vector3();


export class Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        if (!chunkManager) {
            const errorMsg = `[Enemy ${initialData.type}] Constructor missing ChunkManager! Grounding will fail.`;
            eventBus.emit('errorOccurred', errorMsg);
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
        this.roamingTarget = null;
        this.roamingWaitTimer = 0;
        this.positionSmoothingFactor = enemyDefaultsConfig.POSITION_SMOOTHING_FACTOR;
        this.lastPosition = initialData.position.clone();


        try {
            this.mesh = this.createMesh(); // Calls subclass specific createMesh
        } catch (error) {
             logger.error(`Error creating mesh for ${this.type}:`, error);
             eventBus.emit('errorOccurred', `[Enemy] Failed to create mesh for type ${this.type}. Error: ${error.message}`);
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
                eventBus.emit('errorOccurred', errorMsg);
                logger.error(errorMsg);
            }
        }
    }


    createMesh() {
        // This method should be implemented by subclasses
        const errorMsg = `createMesh() not implemented for subclass type ${this.type}!`;
        eventBus.emit('errorOccurred', `[Enemy] ${errorMsg}`);
        logger.error(errorMsg);
        return null;
    }

    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!this.mesh || !this.chunkManager) return;

        this._updateGrounding();
        this._updateState(playerPos, currentPowerup, deltaTime);
        const { isMoving, currentSpeed } = this._updateMovement(playerPos, deltaTime);
        this._updateAnimation(elapsedTime, isMoving, currentSpeed);
    }



    _updateGrounding(groundingOffset, modelHeight) {
        if (!this.mesh || !this.chunkManager) return;

        const offset = groundingOffset ?? enemyDefaultsConfig.GROUND_CHECK_OFFSET;
        const height = modelHeight ?? (this.mesh.userData.legHeight || 0.5);

        const currentPosition = this.mesh.position;
        const rayOrigin = getPooledVector(currentPosition.x, currentPosition.y + offset, currentPosition.z);
        groundRaycaster.set(rayOrigin, downVector);
        const nearbyTerrain = this.chunkManager.getTerrainMeshesNear(currentPosition);
        const intersects = groundRaycaster.intersectObjects(nearbyTerrain);

        if (intersects.length > 0) {
            this.lastGroundY = intersects[0].point.y;
            const smoothFactor = enemyDefaultsConfig.GROUND_SMOOTHING_FACTOR;
            this.currentGroundY = this.currentGroundY * (1.0 - smoothFactor) + this.lastGroundY * smoothFactor;
            this.mesh.position.y = this.currentGroundY + height / 2;
        } else {
            this.mesh.position.y = this.currentGroundY + height / 2;
        }

        releaseVector(rayOrigin);
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
            const moveDirection = getPooledVector();
            moveDirection.subVectors(targetPosition, this.mesh.position);
            moveDirection.y = 0;
            const distanceToTarget = moveDirection.length();

            if (distanceToTarget > enemyDefaultsConfig.MOVE_THRESHOLD) {
                moveDirection.normalize();
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
                    this.mesh.position.x += moveDirection.x * moveDistance;
                    this.mesh.position.z += moveDirection.z * moveDistance;
                }

                if (moveDirection.lengthSq() > enemyDefaultsConfig.LOOK_THRESHOLD_SQ) {
                    const lookTargetPos = getPooledVector();
                    lookTargetPos.copy(this.mesh.position).add(moveDirection);
                    _lookAtMatrix.lookAt(this.mesh.position, lookTargetPos, this.mesh.up);
                    _targetQuat.setFromRotationMatrix(_lookAtMatrix);
                    this.mesh.quaternion.slerp(_targetQuat, enemyDefaultsConfig.ROTATION_SLERP_FACTOR);
                    releaseVector(lookTargetPos);
                }
            } else {
                if (this.state === ENEMY_STATE.ROAMING || this.state === ENEMY_STATE.RETURNING) {
                    this.roamingTarget = null;
                    this.setRoamingWaitTimer();
                    this.state = ENEMY_STATE.ROAMING;
                    isMoving = false;
                }
            }

            releaseVector(moveDirection);
        } else {
            isMoving = false;
        }

        return { isMoving, currentSpeed };
    }


    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
        if (this.mesh?.userData?.legs) {
            animationController.animateEnemyLegs(
                this.mesh.userData.legs,
                elapsedTime,
                isMoving,
                currentSpeed
            );
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

    dispose() {
        if (this.mesh) {
            this.removeFromScene();
            this.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat?.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.mesh = null;
        }
    }
}

