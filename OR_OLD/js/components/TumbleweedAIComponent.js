// js/components/TumbleweedAIComponent.js

import * as THREE from 'three';
import { tumbleweedConfig as C } from '../config/tumbleweed.js';
import { randomRange } from '../utils/mathUtils.js';
import { noise2D } from '../rendering/terrainGenerator.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TumbleweedAIComponent');

export default class TumbleweedAIComponent {
    constructor(options = {}) {
        this.name = 'TumbleweedAIComponent';
        this.gameObject = null;
        this.enabled = options.enabled !== undefined ? options.enabled : true;

        this.targetDirection = new THREE.Vector3();
        this.isActive = false;
        this.activationDistanceSq = C.ACTIVATION_DISTANCE * C.ACTIVATION_DISTANCE;
        this.deactivationDistanceSq = C.DEACTIVATION_DISTANCE * C.DEACTIVATION_DISTANCE;
        this.rollSpeed = randomRange(C.ROLL_SPEED_MIN, C.ROLL_SPEED_MAX);
        this.rotationSpeed = new THREE.Vector3(
            randomRange(C.ROTATION_SPEED_MIN, C.ROTATION_SPEED_MAX),
            randomRange(C.ROTATION_SPEED_MIN, C.ROTATION_SPEED_MAX),
            randomRange(C.ROTATION_SPEED_MIN, C.ROTATION_SPEED_MAX)
        );

        this._tempVec3_1 = new THREE.Vector3();
        this._tempVec3_2 = new THREE.Vector3();
        this._tempQuat_1 = new THREE.Quaternion();
        this._tempQuat_2 = new THREE.Quaternion();
        this._tempEuler = new THREE.Euler();
    }

    onAttach(gameObject) {
        this.gameObject = gameObject;
        this.physics = this.gameObject.getComponent('PhysicsComponent');
        if (!this.physics) {
            logger.error('TumbleweedAIComponent requires a PhysicsComponent on the same GameObject.');
        }
    }

    update(deltaTime, elapsedTime, playerPosition) {
        if (!this.enabled || !this.gameObject || !this.physics) return;

        this._updateTerrainHeight();

        const distanceToPlayerSq = this.gameObject.object3D.position.distanceToSquared(playerPosition);

        if (!this.isActive && distanceToPlayerSq < this.activationDistanceSq) {
            this._activate(playerPosition);
        } else if (this.isActive && distanceToPlayerSq > this.deactivationDistanceSq) {
            this._deactivate();
        }

        if (this.isActive) {
            this._updateMovement(deltaTime, playerPosition);
        }
        
        this._updateTerrainHeight();
    }

    _activate(playerPosition) {
        this.isActive = true;
        this._updateTerrainHeight();

        const playerDirection = this._tempVec3_1.set(0, 0, -1).applyQuaternion(
            this._tempQuat_1.setFromEuler(this._tempEuler.set(0, 0, 0))
        );

        const targetAheadDistance = randomRange(C.TARGET_AHEAD_MIN, C.TARGET_AHEAD_MAX);
        const targetPoint = this._tempVec3_2.copy(playerPosition).add(
            playerDirection.multiplyScalar(targetAheadDistance)
        );

        this.targetDirection.subVectors(targetPoint, this.gameObject.object3D.position).normalize();
        this.targetDirection.x += (Math.random() - 0.5) * C.TARGET_RANDOMNESS;
        this.targetDirection.normalize();

        const initialSpeedFactor = randomRange(C.INITIAL_SPEED_FACTOR_MIN, C.INITIAL_SPEED_FACTOR_MAX);
        const initialSpeed = this.rollSpeed * initialSpeedFactor;

        const velocity = this._tempVec3_1.copy(this.targetDirection).multiplyScalar(initialSpeed);
        velocity.y = Math.abs(velocity.y) + 1.0;
        this.physics.setVelocity(velocity);
    }

    _deactivate() {
        this.isActive = false;
        this.physics.setVelocity(this._tempVec3_1.set(0, 0, 0));
    }

    _updateMovement(deltaTime, playerPosition) {
        const velocity = this._tempVec3_1.copy(this.physics.velocity);
        this.physics.applyForce(this._tempVec3_2.set(0, 2.0, 0));

        if (velocity.lengthSq() > C.MIN_VELOCITY_SQ_THRESHOLD) {
            const playerForward = this._tempVec3_2.set(0, 0, -1).applyQuaternion(
                this._tempQuat_1.setFromEuler(this._tempEuler.set(0, 0, 0))
            );

            const targetAheadDistance = randomRange(C.UPDATE_TARGET_AHEAD_MIN, C.UPDATE_TARGET_AHEAD_MAX);
            const targetPoint = this._tempVec3_1.copy(playerPosition).add(
                playerForward.multiplyScalar(targetAheadDistance)
            );

            const newDirection = this._tempVec3_2.subVectors(targetPoint, this.gameObject.object3D.position).normalize();
            newDirection.x += (Math.random() - 0.5) * C.UPDATE_DIRECTION_RANDOMNESS;
            newDirection.normalize();

            this.targetDirection.lerp(newDirection, C.STEERING_LERP_FACTOR);

            const steeringForce = this._tempVec3_1.copy(this.targetDirection).multiplyScalar(this.rollSpeed * C.STEERING_FORCE_FACTOR);
            this.physics.applyForce(steeringForce);

            const maxSpeed = this.rollSpeed * C.MAX_SPEED_FACTOR;
            if (this.physics.velocity.length() > maxSpeed) {
                this.physics.velocity.normalize().multiplyScalar(maxSpeed);
            }

            const movementDir = this._tempVec3_2.copy(this.physics.velocity).normalize();
            const rotationAxis = this._tempVec3_1.set(movementDir.z, 0, -movementDir.x).normalize();
            const rotationAmount = this.physics.velocity.length() * deltaTime;
            const rotationQuat = this._tempQuat_1.setFromAxisAngle(rotationAxis, rotationAmount);
            this.gameObject.object3D.quaternion.premultiply(rotationQuat);

            const wobbleQuat = this._tempQuat_2.setFromEuler(
                this._tempEuler.set(
                    this.rotationSpeed.x * deltaTime * C.WOBBLE_FACTOR,
                    this.rotationSpeed.y * deltaTime * C.WOBBLE_FACTOR,
                    this.rotationSpeed.z * deltaTime * C.WOBBLE_FACTOR
                )
            );
            this.gameObject.object3D.quaternion.premultiply(wobbleQuat);
        }
    }

    _updateTerrainHeight() {
        if (!this.gameObject.levelConfig) return;

        const pos = this.gameObject.object3D.position;
        const terrainY = noise2D(
            pos.x * this.gameObject.levelConfig.NOISE_FREQUENCY,
            pos.z * this.gameObject.levelConfig.NOISE_FREQUENCY
        ) * this.gameObject.levelConfig.NOISE_AMPLITUDE;

        const desiredY = terrainY + C.TERRAIN_ADJUST_THRESHOLD;

        if (pos.y < desiredY) {
            pos.y = desiredY;

            if (this.physics.velocity.y < 0) {
                this.physics.velocity.y = Math.abs(this.physics.velocity.y) * C.GROUND_BOUNCE_FACTOR + 0.5;
            } else {
                this.physics.velocity.y += 0.5;
            }
        }

        if (this.physics.velocity.y < -5) {
            this.physics.velocity.y = -5;
        }

        if (pos.y < desiredY + 0.5 && this.physics.velocity.y < 0.2) {
            this.physics.velocity.y = 0.2;
        }
    }

    dispose() {
        // Nothing to dispose of here, but good practice to have the method.
    }
}