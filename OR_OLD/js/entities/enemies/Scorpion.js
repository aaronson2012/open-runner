import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';
import { enemyDefaultsConfig } from '../../config/enemyDefaults.js';

// Scorpion-specific states
const SCORPION_STATE = {
    IDLE: 'idle',
    STALKING: 'stalking',   // Slow approach when player detected
    CHASING: 'chasing',     // Direct chase when close
    RETURNING: 'returning'
};

export class Scorpion extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
        
        // Scorpion-specific properties
        this.scorpionState = SCORPION_STATE.IDLE;
        this.stalkDistance = properties.stalkDistance || 25.0;
        this.chaseDistance = properties.chaseDistance || 10.0;
        this.stalkSpeed = properties.stalkSpeed || 1.5;
        this.chaseSpeed = properties.chaseSpeed || 4.0;
        this.patience = properties.patience || 8.0; // How long to stalk before giving up
        this.patienceTimer = 0;
        
        // Scorpion movement characteristics
        this.isScuttling = false;
        this.clawAnimation = 0;
        this.tailAnimation = 0;
        this.lastStalkDirection = new THREE.Vector3();
        
        // Override some enemy defaults for scorpion behavior
        this.aggroRadius = this.stalkDistance;
        this.deaggroRadius = this.stalkDistance + 10.0;
        this.speed = this.stalkSpeed; // Default to stalk speed
    }

    createMesh() {
        return ModelFactory.createScorpionModel(this);
    }

    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!this.mesh || !this.chunkManager) return;

        this._updateGrounding(
            enemyDefaultsConfig.GROUNDING_OFFSET_SCORPION,
            enemyDefaultsConfig.GROUNDING_HEIGHT_SCORPION
        );

        this._updateScorpionState(playerPos, currentPowerup, deltaTime);
        const { isMoving, currentSpeed } = this._updateScorpionMovement(playerPos, deltaTime);
        this._updateScorpionAnimation(deltaTime, elapsedTime, isMoving, currentSpeed);
    }

    _updateScorpionState(playerPos, currentPowerup, deltaTime) {
        const distanceToPlayer = this.mesh.position.distanceTo(playerPos);
        const distanceToOrigin = this.mesh.position.distanceTo(this.originalPosition);
        
        switch (this.scorpionState) {
            case SCORPION_STATE.IDLE:
                if (distanceToPlayer < this.stalkDistance && currentPowerup !== 'invisibility') {
                    this.scorpionState = SCORPION_STATE.STALKING;
                    this.patienceTimer = this.patience;
                    this.speed = this.stalkSpeed;
                }
                break;
                
            case SCORPION_STATE.STALKING:
                this.patienceTimer -= deltaTime;
                
                if (distanceToPlayer < this.chaseDistance) {
                    // Close enough to start direct chase
                    this.scorpionState = SCORPION_STATE.CHASING;
                    this.speed = this.chaseSpeed;
                } else if (this.patienceTimer <= 0 || 
                          distanceToPlayer > this.stalkDistance || 
                          currentPowerup === 'invisibility') {
                    // Lost patience, player moved away, or player became invisible
                    this.scorpionState = SCORPION_STATE.RETURNING;
                    this.speed = this.stalkSpeed;
                }
                break;
                
            case SCORPION_STATE.CHASING:
                if (distanceToPlayer > this.chaseDistance + 5.0 || currentPowerup === 'invisibility') {
                    // Player escaped direct chase range
                    this.scorpionState = SCORPION_STATE.STALKING;
                    this.speed = this.stalkSpeed;
                    this.patienceTimer = this.patience * 0.5; // Less patience after failed chase
                }
                break;
                
            case SCORPION_STATE.RETURNING:
                if (distanceToOrigin < 2.0) {
                    this.scorpionState = SCORPION_STATE.IDLE;
                } else if (distanceToPlayer < this.chaseDistance && currentPowerup !== 'invisibility') {
                    // Player got very close while returning
                    this.scorpionState = SCORPION_STATE.CHASING;
                    this.speed = this.chaseSpeed;
                }
                break;
        }
    }

    _updateScorpionMovement(playerPos, deltaTime) {
        let targetPosition = null;
        let isMoving = false;
        let currentSpeed = this.speed;
        
        if (this.scorpionState === SCORPION_STATE.STALKING) {
            // Slow, deliberate approach - not directly at player
            targetPosition = this._calculateStalkingPosition(playerPos);
            isMoving = true;
        } else if (this.scorpionState === SCORPION_STATE.CHASING) {
            // Direct chase
            targetPosition = playerPos;
            isMoving = true;
        } else if (this.scorpionState === SCORPION_STATE.RETURNING) {
            targetPosition = this.originalPosition;
            isMoving = true;
        }

        if (isMoving && targetPosition) {
            const moveDirection = new THREE.Vector3();
            moveDirection.subVectors(targetPosition, this.mesh.position);
            moveDirection.y = 0;
            const distanceToTarget = moveDirection.length();

            if (distanceToTarget > enemyDefaultsConfig.MOVE_THRESHOLD) {
                moveDirection.normalize();
                const moveDistance = currentSpeed * deltaTime;

                if (moveDistance >= distanceToTarget) {
                    this.mesh.position.x = targetPosition.x;
                    this.mesh.position.z = targetPosition.z;
                    isMoving = false;
                } else {
                    this.mesh.position.x += moveDirection.x * moveDistance;
                    this.mesh.position.z += moveDirection.z * moveDistance;
                }

                // Scorpions should face the player, not the movement direction
                // This ensures the tail points toward the player while chasing
                const lookTarget = playerPos.clone();
                this.mesh.lookAt(lookTarget);
                
                // Store movement direction for animation
                this.lastStalkDirection.copy(moveDirection);
            } else {
                isMoving = false;
            }
        }

        this.isScuttling = isMoving;
        return { isMoving, currentSpeed };
    }

    _calculateStalkingPosition(playerPos) {
        // Scorpions don't move directly toward the player during stalking
        // They circle and approach from angles
        const directionToPlayer = new THREE.Vector3();
        directionToPlayer.subVectors(playerPos, this.mesh.position);
        directionToPlayer.y = 0;
        directionToPlayer.normalize();

        // Add some lateral movement (circling behavior)
        const circleAngle = Math.sin(Date.now() * 0.002) * 0.5; // Slow circling
        const rotatedDirection = new THREE.Vector3();
        rotatedDirection.x = directionToPlayer.x * Math.cos(circleAngle) - directionToPlayer.z * Math.sin(circleAngle);
        rotatedDirection.z = directionToPlayer.x * Math.sin(circleAngle) + directionToPlayer.z * Math.cos(circleAngle);
        rotatedDirection.y = 0;

        // Calculate target position (closer than current, but not directly at player)
        const approachDistance = 2.0; // How much closer to get each stalking move
        const targetPos = this.mesh.position.clone();
        targetPos.add(rotatedDirection.multiplyScalar(approachDistance));

        return targetPos;
    }

    _updateScorpionAnimation(deltaTime, elapsedTime, isMoving, currentSpeed) {
        if (!this.mesh) return;

        // Update claw animations
        this._updateClawAnimation(elapsedTime, isMoving);
        
        // Update tail animation
        this._updateTailAnimation(elapsedTime, isMoving);
        
        // Update leg animation for scuttling
        this._updateLegAnimation(elapsedTime, isMoving, currentSpeed);
    }

    _updateClawAnimation(elapsedTime, isMoving) {
        // Find claw groups and animate them
        this.mesh.traverse((child) => {
            if (child.name && child.name.includes('claw')) {
                if (isMoving) {
                    // Claws move rhythmically while moving
                    const clawSpeed = 4.0;
                    const clawAmount = 0.2;
                    this.clawAnimation = Math.sin(elapsedTime * clawSpeed) * clawAmount;
                } else {
                    // Idle claw movement
                    const idleSpeed = 1.0;
                    const idleAmount = 0.1;
                    this.clawAnimation = Math.sin(elapsedTime * idleSpeed) * idleAmount;
                }
                
                // Apply claw animation
                child.rotation.y += this.clawAnimation * 0.1;
            }
        });
    }

    _updateTailAnimation(elapsedTime, isMoving) {
        // Find tail segments and animate them
        this.mesh.traverse((child) => {
            if (child.name && child.name.includes('tail')) {
                const segmentIndex = parseInt(child.name.match(/\d+/)?.[0] || '0');
                
                if (isMoving) {
                    // Tail sways while moving
                    const tailSpeed = 3.0;
                    const tailAmount = 0.1;
                    const segmentOffset = segmentIndex * 0.5; // Offset for wave effect
                    this.tailAnimation = Math.sin(elapsedTime * tailSpeed + segmentOffset) * tailAmount;
                } else {
                    // Idle tail movement - more subtle
                    const idleSpeed = 1.5;
                    const idleAmount = 0.05;
                    this.tailAnimation = Math.sin(elapsedTime * idleSpeed) * idleAmount;
                }
                
                // Apply tail animation
                child.rotation.x += this.tailAnimation;
                child.rotation.y += this.tailAnimation * 0.5;
            }
        });
    }

    _updateLegAnimation(elapsedTime, isMoving, currentSpeed) {
        // Scorpions have multiple legs that should animate in a scuttling pattern
        this.mesh.traverse((child) => {
            if (child.name && child.name.includes('leg')) {
                if (isMoving) {
                    // Rapid leg movement for scuttling
                    const legSpeed = currentSpeed * 8.0; // Fast leg movement
                    const legAmount = 0.3;
                    const legIndex = parseInt(child.name.match(/\d+/)?.[0] || '0');
                    const legOffset = legIndex * 0.8; // Stagger leg movements
                    
                    const legRotation = Math.sin(elapsedTime * legSpeed + legOffset) * legAmount;
                    child.rotation.z = legRotation;
                } else {
                    // Return legs to neutral position when not moving
                    child.rotation.z *= 0.9; // Smooth return to zero
                }
            }
        });
    }

    // Override the standard enemy animation method
    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
        // Animation is handled in _updateScorpionAnimation
    }

    // Override reset for scorpion-specific properties
    reset(initialData, properties) {
        super.reset(initialData, properties);
        
        this.scorpionState = SCORPION_STATE.IDLE;
        this.stalkDistance = properties.stalkDistance || 25.0;
        this.chaseDistance = properties.chaseDistance || 10.0;
        this.stalkSpeed = properties.stalkSpeed || 1.5;
        this.chaseSpeed = properties.chaseSpeed || 4.0;
        this.patience = properties.patience || 8.0;
        this.patienceTimer = 0;
        
        this.isScuttling = false;
        this.clawAnimation = 0;
        this.tailAnimation = 0;
        this.lastStalkDirection.set(0, 0, 0);
        
        this.speed = this.stalkSpeed;
    }
}