import * as THREE from 'three';
import { cameraConfig } from '../config/camera.js';
import { GameStates } from '../core/gameStateManager.js';
import { createLogger } from '../utils/logger.js';
import eventBus from '../core/eventBus.js';

const logger = createLogger('CameraManager');

const TITLE_LOOK_AT_TARGET = new THREE.Vector3(0, 0, 0);

const _targetPosition = new THREE.Vector3();
const _cameraOffset = new THREE.Vector3();
const _rotatedOffset = new THREE.Vector3();
const _targetQuaternion = new THREE.Quaternion();
const _targetRotationMatrix = new THREE.Matrix4();
const _newPosition = new THREE.Vector3();

class CameraManager {
    constructor() {
        this.camera = null;
        this.renderer = null;
        this.initialCameraPosition = new THREE.Vector3();
        this.clock = new THREE.Clock();

        this.isTransitioning = false;
        this.transitionType = null;
        this.cameraStartPosition = null;
        this.cameraStartQuaternion = null;
        this.transitionTimeElapsed = 0; // Track time elapsed during transition
        this.transitionDuration = 0.6; // Default, can be overridden

        this.titleCameraDrift = null;

        this._lastGameplayPosition = null;
        this._lastGameplayLookAt = null;

        this._justCompletedTransition = false;
        this._transitionCompletionTime = 0;
        this._smoothingFramesAfterTransition = 0;
        this._frameCountAfterTransition = 0;
        this._initialSmoothingFactor = 0.05; // Initial smoothing factor after transition

        this._lastPlayerPosition = null;
        this._firstPositionFrame = true;
    }

    setCamera(camera) {
        this.camera = camera;
        this.initialCameraPosition.copy(camera.position);
        this._initializeCameraDrift();
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }



    update(deltaTime, currentState, player) {
        if (!this.camera) return;

        if (this.isTransitioning) {
            if (this.transitionType === 'toTitle') {
                this._transitionCameraToTitle(deltaTime);
            } else if (this.transitionType === 'toGameplay') {
                this._updateCameraTransition(deltaTime, player);
            }
        } else {

            if (currentState === GameStates.PLAYING && player?.model) {
                this.updateCameraFollow(player, deltaTime);
            } else if (currentState === GameStates.TITLE || currentState === GameStates.LEVEL_SELECT) {
                this._updateTitleCamera(deltaTime);
            }
        }
    }



    startTransitionToTitle(currentCameraPosition, currentCameraQuaternion) {
        if (this.isTransitioning) {
            logger.debug("Already transitioning, cannot start new transition to title.");
            return;
        }
        logger.debug("Starting camera transition to title.");
        this.isTransitioning = true;
        this.transitionType = 'toTitle';
        this.cameraStartPosition = currentCameraPosition.clone();
        this.cameraStartQuaternion = currentCameraQuaternion.clone();
        this.transitionTimeElapsed = 0; // Reset elapsed time
        this.transitionDuration = 0.5; // Faster transition to title
    }

    startTransitionToGameplay(currentCameraPosition, currentCameraQuaternion) {
        if (this.isTransitioning) {
            logger.debug("Already transitioning, cannot start new transition to gameplay.");
            return;
        }
        logger.debug("Starting camera transition to gameplay.");
        this.isTransitioning = true;
        this.transitionType = 'toGameplay';
        this.cameraStartPosition = currentCameraPosition.clone();
        this.cameraStartQuaternion = currentCameraQuaternion.clone();
        this.transitionTimeElapsed = 0; // Reset elapsed time
        this.transitionDuration = 0.4; // Faster transition to gameplay
    }

    getIsTransitioning() {
        return this.isTransitioning;
    }



    /**
     * Calculates the target position and lookAt point for the gameplay camera.
     * @param {THREE.Object3D} playerModel - The player's 3D model.
     * @returns {{position: THREE.Vector3, lookAt: THREE.Vector3}} The target position and lookAt point.
     * @private
     */
    _calculateGameplayCameraTarget(playerModel) {
        playerModel.getWorldPosition(_targetPosition);

        _cameraOffset.set(
            cameraConfig.FOLLOW_OFFSET_X,
            cameraConfig.FOLLOW_OFFSET_Y,
            cameraConfig.FOLLOW_OFFSET_Z
        );

        _rotatedOffset.copy(_cameraOffset).applyQuaternion(playerModel.quaternion);
        const targetCameraPosition = _targetPosition.clone().add(_rotatedOffset);

        const lookAtPosition = _targetPosition.clone();
        lookAtPosition.y += cameraConfig.LOOK_AT_OFFSET_Y;

        return { position: targetCameraPosition, lookAt: lookAtPosition };
    }


    updateCameraFollow(playerObj, deltaTime) {
        if (!this.camera || !playerObj || !playerObj.model) {
            logger.warn("Camera follow skipped: missing camera, player, or player model");
            return;
        }


        const { position: targetCameraPosition, lookAt: lookAtPosition } = this._calculateGameplayCameraTarget(playerObj.model);


        if (!this._lastPlayerPosition) {
            this._lastPlayerPosition = new THREE.Vector3();
            playerObj.model.getWorldPosition(this._lastPlayerPosition);


            this._firstPositionFrame = true;
        } else {
            this._firstPositionFrame = false;
        }


        const currentPlayerPosition = new THREE.Vector3();
        playerObj.model.getWorldPosition(currentPlayerPosition);


        let playerMovement = 0;
        if (!this._firstPositionFrame) {
            playerMovement = currentPlayerPosition.distanceTo(this._lastPlayerPosition);
        }


        this._lastPlayerPosition.copy(currentPlayerPosition);


        const horizontalMovement = Math.sqrt(
            Math.pow(currentPlayerPosition.x - this._lastPlayerPosition.x, 2) +
            Math.pow(currentPlayerPosition.z - this._lastPlayerPosition.z, 2)
        );
        const isPlayerMoving = horizontalMovement > 0.01; // Threshold for significant horizontal movement


        if (this._justCompletedTransition) {

            if (this._frameCountAfterTransition < 5) {
                this.camera.position.copy(targetCameraPosition);
                this.camera.lookAt(lookAtPosition);

                this._lastGameplayPosition = targetCameraPosition.clone();
                this._lastGameplayLookAt = lookAtPosition.clone();

                this._frameCountAfterTransition++;
                return;
            }


            const progress = Math.min(this._frameCountAfterTransition / this._smoothingFramesAfterTransition, 1.0);
            const easedProgress = this._easeInOutCubic(progress);


            const normalSmoothFactor = 1.0 - Math.pow(cameraConfig.SMOOTHING_FACTOR, deltaTime);


            let smoothFactor;
            if (isPlayerMoving) {

                smoothFactor = Math.max(normalSmoothFactor, 0.3);
            } else {

                smoothFactor = normalSmoothFactor * easedProgress;
            }


            this.camera.position.lerp(targetCameraPosition, smoothFactor);
            this.camera.lookAt(lookAtPosition);


            this._frameCountAfterTransition++;


            if (this._frameCountAfterTransition >= this._smoothingFramesAfterTransition) {
                this._justCompletedTransition = false;
                this._frameCountAfterTransition = 0;
                this._lastGameplayPosition = null;
                this._lastGameplayLookAt = null;
            }
        } else {
            let smoothFactor;

            if (isPlayerMoving) {
                smoothFactor = 1.0 - Math.pow(cameraConfig.SMOOTHING_FACTOR * 0.5, deltaTime);
            } else {
                smoothFactor = 1.0 - Math.pow(cameraConfig.SMOOTHING_FACTOR, deltaTime);
            }

            this.camera.position.lerp(targetCameraPosition, smoothFactor);
            this.camera.lookAt(lookAtPosition);
        }
    }



    _createCameraDrift(options = {}) {
        const config = {
            amplitude: options.amplitude || new THREE.Vector3(2, 1, 2),
            period: options.period || new THREE.Vector3(10, 15, 8),
            center: options.center || this.camera.position.clone(),
            smoothingFactor: options.smoothingFactor || 0.95
        };
        const originalPosition = config.center.clone();
        let driftElapsedTime = 0;
        const targetPosition = new THREE.Vector3(); // Reusable vector for drift target

        return (deltaTime) => {
            if (isNaN(deltaTime) || !isFinite(deltaTime) || deltaTime <= 0) {
                return;
            }

            driftElapsedTime += deltaTime;
            targetPosition.copy(originalPosition).add(
                new THREE.Vector3(
                    Math.sin(driftElapsedTime * (Math.PI * 2) / config.period.x) * config.amplitude.x,
                    Math.sin(driftElapsedTime * (Math.PI * 2) / config.period.y) * config.amplitude.y,
                    Math.sin(driftElapsedTime * (Math.PI * 2) / config.period.z) * config.amplitude.z
                )
            );

            if (isNaN(targetPosition.x) || isNaN(targetPosition.y) || isNaN(targetPosition.z)) {
                 logger.error(`NaN detected in camera drift targetPosition: ${targetPosition.toArray()}`);
                 return;
            }

            const lerpFactor = 0.02;
            this.camera.position.lerp(targetPosition, lerpFactor);
        };
    }


    _initializeCameraDrift() {
        if (this.camera) {
            this.titleCameraDrift = this._createCameraDrift({
                amplitude: new THREE.Vector3(15, 7.5, 10),
                period: new THREE.Vector3(45, 30, 60),
                center: this.initialCameraPosition.clone()
            });
        } else {
            logger.warn("Camera not set when trying to initialize drift.");
        }
    }

    _updateTitleCamera(deltaTime) {
        if (this.titleCameraDrift) {
            this.titleCameraDrift(deltaTime);
            this.camera.lookAt(TITLE_LOOK_AT_TARGET);
        }
    }



    _transitionCameraToTitle(deltaTime) {
        if (!this.camera) return;

        this.transitionTimeElapsed += deltaTime;
        const progress = Math.min(this.transitionTimeElapsed / this.transitionDuration, 1.0);

        if (progress < 1.0) {
            const easedProgress = this._easeInOutCubic(progress);
            const targetPosition = this.initialCameraPosition;
            const startPos = this.cameraStartPosition || this.camera.position;
            _newPosition.lerpVectors(startPos, targetPosition, easedProgress);
            this.camera.position.copy(_newPosition);

            _targetRotationMatrix.lookAt(_newPosition, TITLE_LOOK_AT_TARGET, this.camera.up);
            _targetQuaternion.setFromRotationMatrix(_targetRotationMatrix);
            const startQuat = this.cameraStartQuaternion || this.camera.quaternion;

             if (startQuat && _targetQuaternion) {
                this.camera.quaternion.copy(startQuat).slerp(_targetQuaternion, easedProgress);
            } else {
                logger.warn("Missing start or target quaternion for slerp during title transition.");
                this.camera.lookAt(TITLE_LOOK_AT_TARGET);
            }
        } else {
            this.camera.position.copy(this.initialCameraPosition);
            this.camera.lookAt(TITLE_LOOK_AT_TARGET);
            this.isTransitioning = false;
            this.transitionType = null;
            this._initializeCameraDrift(); // Re-initialize drift for when we return
            eventBus.emit('cameraTransitionComplete', 'toTitle');
        }
    }

    _updateCameraTransition(deltaTime, player) {
         if (!this.camera || !player || !player.model) {
            logger.warn("Missing camera or player model during gameplay camera transition.");
            this.isTransitioning = false;
            this.transitionType = null;
            return;
        }


        const { position: targetCameraPosition, lookAt: lookAtPosition } = this._calculateGameplayCameraTarget(player.model);


        this.transitionTimeElapsed += deltaTime;
        const progress = Math.min(this.transitionTimeElapsed / this.transitionDuration, 1.0);

        if (progress < 1.0) {
            const easedProgress = this._easeInOutCubic(progress);
            const startPos = this.cameraStartPosition || this.camera.position; // Use stored start position
            _newPosition.lerpVectors(startPos, targetCameraPosition, easedProgress);
            this.camera.position.copy(_newPosition);


            this.camera.lookAt(lookAtPosition);


            this._lastGameplayPosition = targetCameraPosition.clone();
            this._lastGameplayLookAt = lookAtPosition.clone();
        } else {
            // Camera transition to player complete

            this.camera.position.copy(targetCameraPosition);
            this.camera.lookAt(lookAtPosition);


            this._lastGameplayPosition = targetCameraPosition.clone();
            this._lastGameplayLookAt = lookAtPosition.clone();


            this.isTransitioning = false;
            this.transitionType = null;


            this._justCompletedTransition = true;
            this._transitionCompletionTime = Date.now();
            this._smoothingFramesAfterTransition = 15;
            this._frameCountAfterTransition = 0;


            this._lastPlayerPosition = new THREE.Vector3();
            player.model.getWorldPosition(this._lastPlayerPosition);
            this._firstPositionFrame = true;

            eventBus.emit('cameraTransitionComplete', 'toGameplay');
        }
    }




    _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    handleResize() {
        if (this.camera && this.renderer) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            logger.debug(`Resized camera and renderer to ${width}x${height}`);
        } else {
            logger.warn("Cannot handle resize: Camera or renderer not set.");
        }
    }

    getCamera() {
        return this.camera;
    }

    getInitialPosition() {
        return this.initialCameraPosition.clone();
    }
}


const cameraManager = new CameraManager();

export default cameraManager;