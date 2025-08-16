// js/entities/gameObjects/Tumbleweed.js

import * as THREE from 'three';
// import GameObject from '../../core/GameObject.js'; // GameObject was removed in Phase 2, this dependency needs fixing later
import PhysicsComponent from '../../physics/PhysicsComponent.js'; // Updated path
import { noise2D } from '../../rendering/terrainGenerator.js'; // Updated path
import eventBus from '../../core/eventBus.js'; // Updated path
import { tumbleweedConfig as C } from '../../config/tumbleweed.js'; // Import specific config object and alias it
import { randomRange } from '../../utils/mathUtils.js'; // Import randomRange if needed
import PlayerCharacter from '../playerCharacter.js'; // For player orientation and JSDoc

/**
 * Tumbleweed GameObject
 * A dynamic hazard that rolls across the terrain toward the player's path
 */
export default class Tumbleweed /* extends GameObject */ { // Removed inheritance as base class is gone
    /**
     * Create a new Tumbleweed
     * @param {Object} options - Configuration options
     * @param {THREE.Vector3} options.position - Initial position
     * @param {number} options.scale - Scale factor
     * @param {THREE.Scene} options.scene - Scene to add to
     * @param {Object} options.levelConfig - Level configuration
     * @param {PlayerCharacter} options.player - The player character instance
     */
    constructor(options = {}) {
        // super({ // Base class removed
        //     name: 'Tumbleweed',
        //     position: options.position,
        //     collidable: true,
        //     ...options
        // });
        // Manually set properties previously handled by GameObject base class
        this.name = C.OBJECT_TYPE_NAME; // Use constant
        this.object3D = new THREE.Group(); // Create the main group
        this.object3D.name = this.name;
        if (options.position) {
            this.object3D.position.copy(options.position);
        }
        this.active = true; // Assume active by default
        this.components = new Map(); // Simple component map

        this.scene = options.scene;
        this.levelConfig = options.levelConfig;
        this.player = options.player; // Store player reference
        this.scale = options.scale || 1.0;

        // Tumbleweed properties - Use constants and randomRange
        this.rollSpeed = randomRange(C.ROLL_SPEED_MIN, C.ROLL_SPEED_MAX);
        this.rotationSpeed = new THREE.Vector3(
            randomRange(C.ROTATION_SPEED_MIN, C.ROTATION_SPEED_MAX),
            randomRange(C.ROTATION_SPEED_MIN, C.ROTATION_SPEED_MAX),
            randomRange(C.ROTATION_SPEED_MIN, C.ROTATION_SPEED_MAX)
        );
        this.targetDirection = new THREE.Vector3();
        this.isActive = false;
        this.activationDistanceSq = C.ACTIVATION_DISTANCE * C.ACTIVATION_DISTANCE; // Store squared distance
        this.deactivationDistanceSq = C.DEACTIVATION_DISTANCE * C.DEACTIVATION_DISTANCE; // Store squared distance

        // Create the visual representation
        this._createVisual();

        // Add physics component using constants
        this.physics = this.addComponent(new PhysicsComponent({
            mass: C.MASS,
            friction: C.FRICTION,
            restitution: C.RESTITUTION,
            useGravity: C.USE_GRAVITY,
            gravityForce: C.GRAVITY_FORCE,
            velocity: new THREE.Vector3(0, 0, 0) // Initial velocity is zero
        }));

        // Add to scene if provided
        if (this.scene) {
            this.addToScene(this.scene);
        }

        // Reusable THREE objects for performance
        this._tempVec3_1 = new THREE.Vector3();
        this._tempVec3_2 = new THREE.Vector3();
        this._tempQuat_1 = new THREE.Quaternion();
        this._tempQuat_2 = new THREE.Quaternion();
        this._tempEuler = new THREE.Euler();
    }

    // --- Methods previously from GameObject base class (simplified) ---
    addComponent(component) {
        component.gameObject = this; // Link component back
        this.components.set(component.name || component.constructor.name, component);
        if (typeof component.onAttach === 'function') {
            component.onAttach(this);
        }
        return component;
    }

    getComponent(name) {
        return this.components.get(name);
    }

    addToScene(parent) {
        if (parent && typeof parent.add === 'function') {
            parent.add(this.object3D);
        }
    }

    removeFromScene() {
        if (this.object3D.parent) {
            this.object3D.parent.remove(this.object3D);
        }
    }

    emit(eventName, ...args) {
        // Placeholder for event emission if needed, maybe link to global eventBus?
    }
    // --- End GameObject methods ---


    /**
     * Create the visual representation of the tumbleweed
     * @private
     */
    _createVisual() {
        // Create a more detailed tumbleweed model using constants
        const geometry = new THREE.IcosahedronGeometry(C.MAIN_GEOMETRY_RADIUS, C.MAIN_GEOMETRY_DETAIL);
        const material = new THREE.MeshStandardMaterial({
            color: C.MAIN_MATERIAL_COLOR,
            roughness: C.MAIN_MATERIAL_ROUGHNESS,
            metalness: C.MAIN_MATERIAL_METALNESS,
            wireframe: C.MAIN_MATERIAL_WIREFRAME
        });

        // Create the main mesh
        const mainMesh = new THREE.Mesh(geometry, material);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;

        // Create a second mesh for more detail using constants
        const innerGeometry = new THREE.IcosahedronGeometry(C.INNER_GEOMETRY_RADIUS, C.INNER_GEOMETRY_DETAIL);
        const innerMaterial = new THREE.MeshStandardMaterial({
            color: C.INNER_MATERIAL_COLOR,
            roughness: C.INNER_MATERIAL_ROUGHNESS,
            metalness: C.INNER_MATERIAL_METALNESS
        });
        const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);

        // Add meshes to the object3D group
        this.object3D.add(mainMesh);
        this.object3D.add(innerMesh);

        // Set scale
        this.object3D.scale.set(this.scale, this.scale, this.scale);

        // Set userData for collision detection
        this.object3D.userData = {
            objectType: C.OBJECT_TYPE_NAME, // Use constant
            collidable: true,
            gameObject: this,
            isHazard: true
        };
    }

    /**
     * Update the tumbleweed
     * @param {number} deltaTime - Time since last update in seconds
     * @param {number} elapsedTime - Total elapsed time in seconds
     * @param {THREE.Vector3} playerPosition - Current player position
     */
    update(deltaTime, elapsedTime, playerPosition) {
        if (!this.active) return;

        // FIRST: Update terrain height to ensure we start above ground
        // This is crucial to prevent sinking
        this._updateTerrainHeight();

        // Call base update (updates components)
        // super.update(deltaTime, elapsedTime); // Base class removed, update components manually
        this.components.forEach(component => {
             if (component.enabled && typeof component.update === 'function') {
                 component.update(deltaTime, elapsedTime);
             }
         });


        // Check if we should activate/deactivate based on distance to player
        const distanceToPlayerSq = this.object3D.position.distanceToSquared(playerPosition);

        if (!this.isActive && distanceToPlayerSq < this.activationDistanceSq) { // Use pre-calculated squared distance
            this._activate(playerPosition);
        } else if (this.isActive && distanceToPlayerSq > this.deactivationDistanceSq) { // Use pre-calculated squared distance
            this._deactivate();
        }

        // If active, update movement
        if (this.isActive) {
            this._updateMovement(deltaTime, playerPosition);
        }

        // Update physics for the tumbleweed
        if (this.physics) {
            this.physics.update(deltaTime);
        }

        // Update terrain height AGAIN after physics to ensure we stay above ground
        this._updateTerrainHeight();
    }

    /**
     * Activate the tumbleweed
     * @param {THREE.Vector3} playerPosition - Current player position
     * @private
     */
    _activate(playerPosition) {
        this.isActive = true;

        // First, ensure the tumbleweed is properly positioned above the terrain
        // This is crucial to prevent it from starting below the ground
        this._updateTerrainHeight();

        // Calculate initial direction toward player's path using reusable objects
        // Get player's actual forward direction
        if (this.player && this.player.object3D) {
            this.player.object3D.getWorldDirection(this._tempVec3_1); // _tempVec3_1 now holds player's world direction
        } else {
            // Fallback to original assumption if player object is not available
            this._tempVec3_1.set(0, 0, -1);
            // console.warn('Tumbleweed (_activate): Player object not available for orientation, defaulting to Z-forward.');
        }
        const playerDirection = this._tempVec3_1; // Use the vector directly

        // Calculate a point ahead of the player using constants and reusable objects
        const targetAheadDistance = randomRange(C.TARGET_AHEAD_MIN, C.TARGET_AHEAD_MAX);
        const targetPoint = this._tempVec3_2.copy(playerPosition).add(
            playerDirection.multiplyScalar(targetAheadDistance) // Modify playerDirection in place
        );

        // Direction from tumbleweed to that point
        this.targetDirection.subVectors(targetPoint, this.object3D.position).normalize();

        // Add some randomness to the initial direction using constant
        this.targetDirection.x += (Math.random() - 0.5) * C.TARGET_RANDOMNESS;
        this.targetDirection.normalize();

        // Set initial velocity using constants and reusable vector
        const initialSpeedFactor = randomRange(C.INITIAL_SPEED_FACTOR_MIN, C.INITIAL_SPEED_FACTOR_MAX);
        const initialSpeed = this.rollSpeed * initialSpeedFactor;

        // Set velocity with a slight upward component to help it stay above ground
        const velocity = this._tempVec3_1.copy(this.targetDirection).multiplyScalar(initialSpeed);
        velocity.y = Math.abs(velocity.y) + 1.0; // Add a small upward velocity
        this.physics.setVelocity(velocity);
    }

    /**
     * Deactivate the tumbleweed
     * @private
     */
    _deactivate() {
        this.isActive = false;
        this.physics.setVelocity(this._tempVec3_1.set(0, 0, 0)); // Use reusable vector
    }

    /**
     * Update the tumbleweed's movement
     * @param {number} deltaTime - Time since last update in seconds
     * @param {THREE.Vector3} playerPosition - Current player position
     * @private
     */
    _updateMovement(deltaTime, playerPosition) {
        // Get current velocity using reusable vector
        const velocity = this._tempVec3_1.copy(this.physics.velocity);

        // Add a small upward force to help keep the tumbleweed above ground
        // This counteracts gravity and helps prevent sinking
        this.physics.applyForce(this._tempVec3_2.set(0, 2.0, 0));

        // Only adjust direction if we have some velocity (use constant)
        if (velocity.lengthSq() > C.MIN_VELOCITY_SQ_THRESHOLD) {
            // Calculate direction to player's path using reusable objects
            // Get player's actual forward direction
            if (this.player && this.player.object3D) {
                this.player.object3D.getWorldDirection(this._tempVec3_2); // _tempVec3_2 now holds player's world direction
            } else {
                // Fallback to original assumption if player object is not available
                this._tempVec3_2.set(0, 0, -1);
                // console.warn('Tumbleweed (_updateMovement): Player object not available for orientation, defaulting to Z-forward.');
            }
            const playerForward = this._tempVec3_2; // Use the vector directly

            // Calculate a point ahead of the player using constants and reusable objects
            const targetAheadDistance = randomRange(C.UPDATE_TARGET_AHEAD_MIN, C.UPDATE_TARGET_AHEAD_MAX);
            const targetPoint = this._tempVec3_1.copy(playerPosition).add(
                playerForward.multiplyScalar(targetAheadDistance) // Modify playerForward in place
            );

            // Calculate new direction using reusable vector
            const newDirection = this._tempVec3_2.subVectors(targetPoint, this.object3D.position).normalize();

            // Add some randomness using constant
            newDirection.x += (Math.random() - 0.5) * C.UPDATE_DIRECTION_RANDOMNESS;
            newDirection.normalize();

            // Blend current direction with new direction using constant
            this.targetDirection.lerp(newDirection, C.STEERING_LERP_FACTOR);

            // Apply a force in the target direction using constant and reusable vector
            const steeringForce = this._tempVec3_1.copy(this.targetDirection).multiplyScalar(this.rollSpeed * C.STEERING_FORCE_FACTOR);
            this.physics.applyForce(steeringForce);

            // Limit max speed using constant
            const maxSpeed = this.rollSpeed * C.MAX_SPEED_FACTOR;
            if (this.physics.velocity.length() > maxSpeed) {
                this.physics.velocity.normalize().multiplyScalar(maxSpeed);
            }

            // Rotate the tumbleweed based on movement
            // Calculate rotation axis perpendicular to movement direction using reusable vectors
            const movementDir = this._tempVec3_2.copy(this.physics.velocity).normalize(); // Use tempVec3_2
            const rotationAxis = this._tempVec3_1.set(movementDir.z, 0, -movementDir.x).normalize(); // Use tempVec3_1

            // Rotation amount based on distance traveled
            const rotationAmount = this.physics.velocity.length() * deltaTime;

            // Apply rotation using reusable quaternion
            const rotationQuat = this._tempQuat_1.setFromAxisAngle(rotationAxis, rotationAmount); // Use tempQuat_1
            this.object3D.quaternion.premultiply(rotationQuat);

            // Add some random wobble using constants and reusable objects
            const wobbleQuat = this._tempQuat_2.setFromEuler( // Use tempQuat_2
                this._tempEuler.set( // Use tempEuler
                    this.rotationSpeed.x * deltaTime * C.WOBBLE_FACTOR,
                    this.rotationSpeed.y * deltaTime * C.WOBBLE_FACTOR,
                    this.rotationSpeed.z * deltaTime * C.WOBBLE_FACTOR
                )
            );
            this.object3D.quaternion.premultiply(wobbleQuat);
        }
    }

    /**
     * Update the tumbleweed's height to stay on the terrain
     * @private
     */
    _updateTerrainHeight() {
        if (!this.levelConfig) return;

        const pos = this.object3D.position;
        const terrainY = noise2D(
            pos.x * this.levelConfig.NOISE_FREQUENCY,
            pos.z * this.levelConfig.NOISE_FREQUENCY
        ) * this.levelConfig.NOISE_AMPLITUDE;

        // Calculate the desired Y position, including a threshold to stay above terrain.
        const targetY = terrainY + C.TERRAIN_ADJUST_THRESHOLD;

        // Smoothly interpolate the Tumbleweed's Y position towards the targetY.
        // THREE.MathUtils.lerp(current, target, alpha)
        // A smaller GROUND_FOLLOW_SMOOTH_FACTOR results in smoother, less aggressive following.
        pos.y = THREE.MathUtils.lerp(pos.y, targetY, C.GROUND_FOLLOW_SMOOTH_FACTOR);


        // If the tumbleweed is below the target Y after interpolation (e.g., due to fast fall or steep slope)
        // and its vertical velocity is negative (moving downwards), make it bounce.
        if (pos.y < targetY && this.physics.velocity.y < 0) {
            // Apply a bounce. The bounce factor determines how much velocity is retained.
            // A small upward push is added to ensure it clears the terrain.
            this.physics.velocity.y = Math.abs(this.physics.velocity.y) * C.GROUND_BOUNCE_FACTOR + 0.5; // Added 0.5 for a bit more push
        } else if (pos.y < targetY) {
            // If it's below the targetY but not moving downwards (or moving upwards slowly),
            // gently push it up to prevent sinking over time on flat or gentle slopes.
            this.physics.velocity.y += 0.2; // Gentle upward push
        }


        // Clamp the maximum downward velocity to prevent tunneling through terrain.
        // Uses the new MAX_DOWNWARD_VELOCITY_CLAMP config.
        if (this.physics.velocity.y < C.MAX_DOWNWARD_VELOCITY_CLAMP) {
            this.physics.velocity.y = C.MAX_DOWNWARD_VELOCITY_CLAMP;
        }

        // Apply a minimum upward velocity if the Tumbleweed is very close to the ground
        // and not already moving upwards sufficiently. This helps maintain a slight hover or
        // prevents it from appearing "stuck" to the ground.
        // Uses MIN_UPWARD_PUSH_OFFSET and MIN_UPWARD_VELOCITY_NEAR_GROUND configs.
        if (pos.y < targetY + C.MIN_UPWARD_PUSH_OFFSET && this.physics.velocity.y < C.MIN_UPWARD_VELOCITY_NEAR_GROUND) {
            this.physics.velocity.y = C.MIN_UPWARD_VELOCITY_NEAR_GROUND;
        }
    }

    /**
     * Handle collision with the player
     */
    onPlayerCollision() {
        // Emit player death event
        eventBus.emit('playerDied');
    }

    /**
     * Dispose resources
     */
     dispose() {
        // Dispose components
        this.components.forEach(component => {
            if (typeof component.dispose === 'function') {
                component.dispose();
            }
        });
        this.components.clear();

        // Dispose geometry and materials
        if (this.object3D) {
            this.object3D.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m?.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        // Remove from scene if still attached
        this.removeFromScene();
    }
}
