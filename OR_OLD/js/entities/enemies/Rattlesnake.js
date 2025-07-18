import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';
import { enemyDefaultsConfig } from '../../config/enemyDefaults.js';

// Rattlesnake-specific states
const RATTLESNAKE_STATE = {
    CURLED: 'curled',       // Idle state - coiled up
    RATTLING: 'rattling',   // Warning state - tail rattling
    LEAPING: 'leaping',     // Attack state - lunging at player
    RETURNING: 'returning'  // Returning to original position
};

export class Rattlesnake extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
        
        // Rattlesnake-specific properties
        this.rattlesnakeState = RATTLESNAKE_STATE.CURLED;
        this.rattleDistance = properties.rattleDistance || 15.0;
        this.leapDistance = properties.leapDistance || 8.0;
        this.leapSpeed = properties.leapSpeed || 25.0;
        this.rattleTimer = 0;
        this.rattleDuration = properties.rattleDuration || 1.5;
        this.leapCooldown = 0;
        this.leapCooldownTime = properties.leapCooldownTime || 3.0;
        
        // Leap mechanics
        this.isLeaping = false;
        this.leapStartPos = new THREE.Vector3();
        this.leapTargetPos = new THREE.Vector3();
        this.leapProgress = 0;
        
        // Animation properties
        this.rattleIntensity = 0;
        this.coilRotation = 0;
        
        // Override some enemy defaults
        this.aggroRadius = this.rattleDistance;
        this.speed = 2.0; // Snakes are slow when moving normally
    }

    createMesh() {
        const mesh = ModelFactory.createRattlesnakeModel(this);
        
        // Set initial curled position
        if (mesh) {
            this._setCurledPose(mesh);
        }
        
        return mesh;
    }

    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!this.mesh || !this.chunkManager) return;

        this._updateGrounding(
            enemyDefaultsConfig.GROUNDING_OFFSET_SNAKE,
            enemyDefaultsConfig.GROUNDING_HEIGHT_SNAKE
        );

        // Update cooldowns
        if (this.leapCooldown > 0) {
            this.leapCooldown -= deltaTime;
        }

        this._updateRattlesnakeState(playerPos, currentPowerup, deltaTime);
        this._updateRattlesnakeMovement(playerPos, deltaTime);
        this._updateRattlesnakeAnimation(deltaTime, elapsedTime);
    }

    _updateRattlesnakeState(playerPos, currentPowerup, deltaTime) {
        const distanceToPlayer = this.mesh.position.distanceTo(playerPos);
        const distanceToOrigin = this.mesh.position.distanceTo(this.originalPosition);
        
        switch (this.rattlesnakeState) {
            case RATTLESNAKE_STATE.CURLED:
                if (distanceToPlayer < this.rattleDistance && currentPowerup !== 'invisibility') {
                    this.rattlesnakeState = RATTLESNAKE_STATE.RATTLING;
                    this.rattleTimer = this.rattleDuration;
                    this.rattleIntensity = 1.0;
                }
                break;
                
            case RATTLESNAKE_STATE.RATTLING:
                this.rattleTimer -= deltaTime;
                
                if (distanceToPlayer < this.leapDistance && this.leapCooldown <= 0) {
                    // Close enough to leap!
                    this._initiateLeap(playerPos);
                } else if (this.rattleTimer <= 0) {
                    // Done rattling, return to curled if player moved away
                    if (distanceToPlayer > this.rattleDistance) {
                        this.rattlesnakeState = RATTLESNAKE_STATE.CURLED;
                        this.rattleIntensity = 0;
                    }
                } else if (distanceToPlayer > this.rattleDistance) {
                    // Player moved away during rattle
                    this.rattlesnakeState = RATTLESNAKE_STATE.CURLED;
                    this.rattleIntensity = 0;
                }
                break;
                
            case RATTLESNAKE_STATE.LEAPING:
                // Leap logic handled in movement update
                break;
                
            case RATTLESNAKE_STATE.RETURNING:
                if (distanceToOrigin < 1.0) {
                    this.rattlesnakeState = RATTLESNAKE_STATE.CURLED;
                    this.leapCooldown = this.leapCooldownTime;
                } else if (distanceToPlayer < this.rattleDistance && this.leapCooldown <= 0) {
                    // Player got close again while returning
                    this.rattlesnakeState = RATTLESNAKE_STATE.RATTLING;
                    this.rattleTimer = this.rattleDuration;
                    this.rattleIntensity = 1.0;
                }
                break;
        }
    }

    _updateRattlesnakeMovement(playerPos, deltaTime) {
        if (this.rattlesnakeState === RATTLESNAKE_STATE.LEAPING) {
            this._updateLeapMovement(deltaTime);
        } else if (this.rattlesnakeState === RATTLESNAKE_STATE.RETURNING) {
            // Use standard enemy movement to return to origin
            const targetPosition = this.originalPosition;
            const moveDirection = new THREE.Vector3();
            moveDirection.subVectors(targetPosition, this.mesh.position);
            moveDirection.y = 0;
            const distanceToTarget = moveDirection.length();

            if (distanceToTarget > 0.1) {
                moveDirection.normalize();
                const moveDistance = this.speed * deltaTime;
                
                if (moveDistance >= distanceToTarget) {
                    this.mesh.position.copy(targetPosition);
                } else {
                    this.mesh.position.add(moveDirection.multiplyScalar(moveDistance));
                }
                
                // Face movement direction
                const lookTarget = this.mesh.position.clone().add(moveDirection);
                this.mesh.lookAt(lookTarget);
            }
        }
        // Curled and rattling states don't move
    }

    _initiateLeap(playerPos) {
        this.rattlesnakeState = RATTLESNAKE_STATE.LEAPING;
        this.isLeaping = true;
        this.leapProgress = 0;
        
        this.leapStartPos.copy(this.mesh.position);
        this.leapTargetPos.copy(playerPos);
        
        // Predict player movement slightly
        const forwardDirection = new THREE.Vector3(0, 0, -1); // Assume player faces forward
        const predictedMovement = forwardDirection.multiplyScalar(5);
        this.leapTargetPos.add(predictedMovement);
        
        // Keep Y position similar to avoid flying too high
        this.leapTargetPos.y = this.leapStartPos.y + 1.0;
        
        // Face the target
        this.mesh.lookAt(this.leapTargetPos);
    }

    _updateLeapMovement(deltaTime) {
        this.leapProgress += this.leapSpeed * deltaTime;
        
        if (this.leapProgress >= 1.0) {
            // Leap finished
            this.mesh.position.copy(this.leapTargetPos);
            this.isLeaping = false;
            this.rattlesnakeState = RATTLESNAKE_STATE.RETURNING;
        } else {
            // Interpolate position with arc
            const t = this.leapProgress;
            const arcHeight = 2.0; // Height of the leap arc
            
            // Linear interpolation for X and Z
            this.mesh.position.x = THREE.MathUtils.lerp(this.leapStartPos.x, this.leapTargetPos.x, t);
            this.mesh.position.z = THREE.MathUtils.lerp(this.leapStartPos.z, this.leapTargetPos.z, t);
            
            // Parabolic arc for Y
            const baseY = THREE.MathUtils.lerp(this.leapStartPos.y, this.leapTargetPos.y, t);
            const arcY = arcHeight * Math.sin(t * Math.PI); // Sine wave for smooth arc
            this.mesh.position.y = baseY + arcY;
        }
    }

    _updateRattlesnakeAnimation(deltaTime, elapsedTime) {
        if (!this.mesh) return;
        
        // Update rattle animation
        if (this.rattlesnakeState === RATTLESNAKE_STATE.RATTLING) {
            this._updateRattleAnimation(elapsedTime);
        }
        
        // Update coil animation for curled state
        if (this.rattlesnakeState === RATTLESNAKE_STATE.CURLED) {
            this._updateCoilAnimation(elapsedTime);
        }
        
        // Update pose based on state
        this._updateSnakePose();
    }

    _updateRattleAnimation(elapsedTime) {
        // Find rattle segments and animate them
        this.mesh.traverse((child) => {
            if (child.name && child.name.includes('rattle')) {
                // Rapid vibration for rattle
                const vibrationSpeed = 30.0; // Very fast vibration
                const vibrationAmount = 0.1 * this.rattleIntensity;
                
                child.rotation.x = Math.sin(elapsedTime * vibrationSpeed) * vibrationAmount;
                child.rotation.z = Math.cos(elapsedTime * vibrationSpeed * 1.1) * vibrationAmount;
            }
        });
    }

    _updateCoilAnimation(elapsedTime) {
        // Gentle breathing-like movement when curled
        this.coilRotation += Math.sin(elapsedTime * 2.0) * 0.01;
        this.mesh.rotation.y = this.coilRotation;
    }

    _updateSnakePose() {
        switch (this.rattlesnakeState) {
            case RATTLESNAKE_STATE.CURLED:
                this._setCurledPose(this.mesh);
                break;
            case RATTLESNAKE_STATE.RATTLING:
                this._setRattlingPose(this.mesh);
                break;
            case RATTLESNAKE_STATE.LEAPING:
                this._setLeapingPose(this.mesh);
                break;
        }
    }

    _setCurledPose(mesh) {
        // Coiled up position - make snake segments form a spiral
        mesh.traverse((child) => {
            if (child.name && child.name.includes('segment')) {
                // Segments should be arranged in a coil
                const segmentIndex = parseInt(child.name.match(/\d+/)?.[0] || '0');
                const coilRadius = 0.5;
                const coilAngle = segmentIndex * 0.5;
                
                child.position.x = Math.cos(coilAngle) * coilRadius * (1 - segmentIndex * 0.1);
                child.position.z = Math.sin(coilAngle) * coilRadius * (1 - segmentIndex * 0.1);
                child.rotation.y = coilAngle;
            }
        });
    }

    _setRattlingPose(mesh) {
        // Head raised, tail up and vibrating
        mesh.traverse((child) => {
            if (child.name && child.name.includes('head')) {
                child.position.y += 0.5; // Raise head
                child.rotation.x = -0.3; // Tilt head up slightly
            }
        });
    }

    _setLeapingPose(mesh) {
        // Extended pose for leaping
        mesh.traverse((child) => {
            if (child.name && child.name.includes('segment')) {
                // Straighten out the body for leap
                const segmentIndex = parseInt(child.name.match(/\d+/)?.[0] || '0');
                child.position.x = 0;
                child.position.z = -segmentIndex * 0.3;
                child.rotation.y = 0;
            }
        });
    }

    // Override the standard enemy animation method
    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
        // Rattlesnakes don't have legs, animation handled in _updateRattlesnakeAnimation
    }

    // Override reset for rattlesnake-specific properties
    reset(initialData, properties) {
        super.reset(initialData, properties);
        
        this.rattlesnakeState = RATTLESNAKE_STATE.CURLED;
        this.rattleDistance = properties.rattleDistance || 15.0;
        this.leapDistance = properties.leapDistance || 8.0;
        this.leapSpeed = properties.leapSpeed || 25.0;
        this.rattleTimer = 0;
        this.rattleDuration = properties.rattleDuration || 1.5;
        this.leapCooldown = 0;
        this.leapCooldownTime = properties.leapCooldownTime || 3.0;
        
        this.isLeaping = false;
        this.leapProgress = 0;
        this.rattleIntensity = 0;
        this.coilRotation = 0;
        
        if (this.mesh) {
            this._setCurledPose(this.mesh);
        }
    }
}