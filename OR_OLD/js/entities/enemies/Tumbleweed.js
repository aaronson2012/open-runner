import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';
import { enemyDefaultsConfig } from '../../config/enemyDefaults.js';

/**
 * Tumbleweed Enemy - Now integrated into the Enemy system
 * Spawns dynamically when player approaches and despawns when far away
 * Rolls across terrain toward the player with wind-like movement
 */
export class Tumbleweed extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
        
        // Tumbleweed-specific properties
        this.rollSpeed = properties.rollSpeed || 8.0;
        this.activationDistance = properties.activationDistance || 100;
        this.deactivationDistance = properties.deactivationDistance || 150;
        this.isRolling = false;
        this.windDirection = new THREE.Vector3();
        this.rollAxis = new THREE.Vector3();
        this.rotationSpeed = 0;
        
        // Override some enemy defaults for tumbleweed behavior
        this.aggroRadius = this.activationDistance;
        this.deaggroRadius = this.deactivationDistance;
        this.speed = this.rollSpeed;
        
        // Set initial wind direction
        this._generateWindDirection();
    }

    createMesh() {
        return ModelFactory.createTumbleweedModel(this);
    }

    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!this.mesh || !this.chunkManager) return;

        // Use simplified grounding for tumbleweeds
        this._updateGrounding(
            enemyDefaultsConfig.GROUNDING_OFFSET_SNAKE,
            enemyDefaultsConfig.GROUNDING_HEIGHT_SNAKE
        );

        // Custom tumbleweed behavior instead of standard enemy state machine
        this._updateTumbleweedBehavior(playerPos, deltaTime);
        this._updateRollingAnimation(deltaTime);
    }

    _updateTumbleweedBehavior(playerPos, deltaTime) {
        const distanceToPlayer = this.mesh.position.distanceTo(playerPos);
        
        // Activation/deactivation logic
        if (!this.isRolling && distanceToPlayer < this.activationDistance) {
            this._activateRolling(playerPos);
        } else if (this.isRolling && distanceToPlayer > this.deactivationDistance) {
            this._deactivateRolling();
        }

        // Rolling movement
        if (this.isRolling) {
            this._updateRollingMovement(playerPos, deltaTime);
            
            // Occasionally change wind direction for more natural movement
            if (Math.random() < 0.005) { // Small chance each frame
                this._generateWindDirection();
            }
        }
    }

    _activateRolling(playerPos) {
        this.isRolling = true;
        
        // Calculate initial rolling direction (toward player's future position)
        const playerDirection = new THREE.Vector3(0, 0, -1); // Assume player faces forward
        const futurePlayerPos = playerPos.clone().add(playerDirection.multiplyScalar(20));
        
        this.windDirection.subVectors(futurePlayerPos, this.mesh.position);
        this.windDirection.y = 0; // Keep horizontal
        this.windDirection.normalize();
        
        // Add some randomness to make it feel more natural
        this.windDirection.x += (Math.random() - 0.5) * 0.4;
        this.windDirection.z += (Math.random() - 0.5) * 0.4;
        this.windDirection.normalize();
        
        // Set initial rotation speed
        this.rotationSpeed = this.rollSpeed * 0.5;
        
        // Calculate roll axis (perpendicular to movement direction)
        this.rollAxis.set(this.windDirection.z, 0, -this.windDirection.x).normalize();
    }

    _deactivateRolling() {
        this.isRolling = false;
        this.rotationSpeed = 0;
    }

    _updateRollingMovement(playerPos, deltaTime) {
        // Update wind direction to loosely follow player
        const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        toPlayer.y = 0;
        toPlayer.normalize();
        
        // Blend current wind direction with player direction
        this.windDirection.lerp(toPlayer, 0.02 * deltaTime);
        this.windDirection.normalize();
        
        // Move the tumbleweed
        const moveDistance = this.rollSpeed * deltaTime;
        const movement = this.windDirection.clone().multiplyScalar(moveDistance);
        
        this.mesh.position.add(movement);
        
        // Update roll axis
        this.rollAxis.set(this.windDirection.z, 0, -this.windDirection.x).normalize();
    }

    _updateRollingAnimation(deltaTime) {
        if (this.isRolling && this.rotationSpeed > 0) {
            // Rotate around the roll axis for realistic rolling motion
            const rotationAmount = this.rotationSpeed * deltaTime;
            const rollQuaternion = new THREE.Quaternion();
            rollQuaternion.setFromAxisAngle(this.rollAxis, rotationAmount);
            this.mesh.quaternion.premultiply(rollQuaternion);
            
            // Add slight wobble for natural look
            const wobbleX = Math.sin(Date.now() * 0.003) * 0.01;
            const wobbleZ = Math.cos(Date.now() * 0.0025) * 0.01;
            const wobbleQuaternion = new THREE.Quaternion();
            wobbleQuaternion.setFromEuler(new THREE.Euler(wobbleX, 0, wobbleZ));
            this.mesh.quaternion.multiply(wobbleQuaternion);
        }
    }

    _generateWindDirection() {
        // Generate a semi-random wind direction
        const angle = Math.random() * Math.PI * 2;
        this.windDirection.set(Math.cos(angle), 0, Math.sin(angle));
    }

    // Override the standard enemy animation method
    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
        // Tumbleweeds don't have legs or standard animations
        // Rolling animation is handled in _updateRollingAnimation
    }

    // Override reset for tumbleweed-specific properties
    reset(initialData, properties) {
        super.reset(initialData, properties);
        
        this.rollSpeed = properties.rollSpeed || 8.0;
        this.activationDistance = properties.activationDistance || 100;
        this.deactivationDistance = properties.deactivationDistance || 150;
        this.isRolling = false;
        this.rotationSpeed = 0;
        
        this._generateWindDirection();
    }
}