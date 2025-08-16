// js/managers/particleManager.js
import * as THREE from 'three';
import { createLogger } from '../utils/logger.js'; // Import logger
// Import config objects and performanceManager
import { performanceManager } from '../config/config.js'; // Re-export from config.js
import { particleConfig as P } from '../config/particles.js'; // Alias for brevity
import { playerConfig } from '../config/player.js';

// Base particle settings are now in config.js
// Use P_BASE_MAX_PARTICLES, P_BASE_PARTICLE_LIFETIME, etc.

const logger = createLogger('ParticleManager'); // Instantiate logger

// Reusable vector for drift
const PARTICLE_DRIFT_VELOCITY = new THREE.Vector3(
    P.DRIFT_VELOCITY_X,
    P.DRIFT_VELOCITY_Y,
    P.DRIFT_VELOCITY_Z
);
// Reusable vector for velocity calculation
const _particleVelocity = new THREE.Vector3();

// Get actual particle count based on performance settings
function getMaxParticles() {
    const density = P.PARTICLE_DENSITY ?? 1.0; // Use aliased config object
    return Math.floor(P.BASE_MAX_PARTICLES * density); // Use aliased config object
}

function getParticlesPerSecond() {
    const density = P.PARTICLE_DENSITY ?? 1.0; // Use aliased config object
    return Math.floor(P.BASE_PARTICLES_PER_SECOND * density); // Use aliased config object
}

function getParticleLifetime() {
    // Lower quality = shorter lifetime for better performance
    if (performanceManager.currentQuality === 'low') {
        return P.BASE_PARTICLE_LIFETIME * P.LIFETIME_LOW_QUALITY_FACTOR; // Use constants
    }
    return P.BASE_PARTICLE_LIFETIME; // Use constant
}

// Simple circular texture for particles
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = P.TEXTURE_SIZE; // Use constant
    canvas.height = P.TEXTURE_SIZE; // Use constant
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    // Add gradient stops from config
    P.TEXTURE_GRADIENT_STOPS.forEach(stop => {
        gradient.addColorStop(stop[0], stop[1]);
    });

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Create texture with specific settings to avoid WebGL warnings
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false; // Prevent FLIP_Y warning with 3D textures
    texture.premultiplyAlpha = false; // Prevent PREMULTIPLY_ALPHA warning
    return texture;
}

export class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = []; // Array to hold active particle data { velocity, age }
        this.timeToEmit = 0; // Accumulator for emission rate
        this.activeParticleCount = 0; // Track how many particles are active
        this.maxParticles = getMaxParticles(); // Get max particles based on performance

        // Geometry: We'll manage positions manually
        this.particleGeometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxParticles * 3);
        this.opacities = new Float32Array(this.maxParticles); // For fading

        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));

        // Material using constants
        this.particleMaterial = new THREE.PointsMaterial({
            size: P.SIZE,
            map: createParticleTexture(),
            blending: THREE.AdditiveBlending, // Or NormalBlending
            depthWrite: false, // Particles don't obscure each other as much
            transparent: true,
            vertexColors: false, // Using uniform color for now
            color: P.COLOR,
            opacity: 1.0, // We'll control via attribute/shader later if needed, for now uniform
            sizeAttenuation: performanceManager.currentQuality !== 'low' // Disable size attenuation on low quality
        });

        // The Points object
        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.particleSystem.frustumCulled = false; // Ensure it's always rendered if visible
        this.scene.add(this.particleSystem);

        this.activeParticleCount = 0;
}

    /**
     * Sets the scene for the particle manager and adds the particle system to it.
     * @param {THREE.Scene} newScene - The new scene instance.
     */
    setScene(newScene) {
        if (!newScene || !(newScene instanceof THREE.Scene)) {
            logger.error("ParticleManager: Invalid scene provided to setScene.");
            return;
        }

        // Remove from old scene if necessary
        if (this.particleSystem.parent) {
            this.particleSystem.parent.remove(this.particleSystem);
        }

        this.scene = newScene;
        this.scene.add(this.particleSystem);
        logger.info("ParticleManager scene updated.");
    }

    emitParticle(originPosition) {
        if (this.activeParticleCount >= this.maxParticles) {
            logger.warn("Max particles reached, skipping emission.");
            return; // Pool is full
        }

        const index = this.activeParticleCount;

        // Set initial position slightly randomized around origin using constant
        const randomFactor = P.EMIT_POS_RANDOM_FACTOR;
        this.positions[index * 3 + 0] = originPosition.x + (Math.random() - 0.5) * randomFactor;
        this.positions[index * 3 + 1] = originPosition.y; // Start at ground level (adjust if needed)
        this.positions[index * 3 + 2] = originPosition.z + (Math.random() - 0.5) * randomFactor;

        // Initial velocity using constants and reusable vector
        const speed = THREE.MathUtils.randFloat(P.INITIAL_SPEED_MIN, P.INITIAL_SPEED_MAX);
        _particleVelocity.set(
            (Math.random() - 0.5) * P.EMIT_VEL_SPREAD_FACTOR, // Sideways spread
            Math.random() * (P.EMIT_VEL_UPWARD_BIAS_MAX - P.EMIT_VEL_UPWARD_BIAS_MIN) + P.EMIT_VEL_UPWARD_BIAS_MIN, // Upward bias
            (Math.random() - 0.5) * P.EMIT_VEL_SPREAD_FACTOR + P.EMIT_VEL_BACKWARD_BIAS // Backward bias
        );
        _particleVelocity.normalize().multiplyScalar(speed);

        // Store particle data (using the index directly) - copy velocity from reusable vector
        this.particles[index] = {
            velocity: _particleVelocity.clone(), // Clone needed as _particleVelocity is reused
            age: 0,
            initialY: this.positions[index * 3 + 1] // Store initial Y for potential ground check
        };

        this.opacities[index] = 1.0; // Start fully opaque

        this.activeParticleCount++;
    }

    update(deltaTime, playerPosition) {
        // --- Emission ---
        this.timeToEmit += deltaTime;
        const particlesPerSecond = getParticlesPerSecond();
        const particlesToEmit = Math.floor(this.timeToEmit * particlesPerSecond);

        if (particlesToEmit > 0 && this.activeParticleCount < this.maxParticles) {
            this.timeToEmit -= particlesToEmit / particlesPerSecond; // Reduce accumulator
            // Use reusable vector for emitOrigin
            let _rayOrigin = new THREE.Vector3(); // Declare the temporary vector
            const emitOrigin = _rayOrigin.copy(playerPosition); // Using _rayOrigin as a temp vector
            // Adjust emit origin slightly behind and below the player model center if needed
            emitOrigin.y -= playerConfig.HEIGHT_OFFSET * P.EMIT_ORIGIN_Y_OFFSET_FACTOR; // Use constants
            // emitOrigin.z += 0.5; // Slightly behind player center

            // Only emit as many particles as we have room for
            const actualParticlesToEmit = Math.min(particlesToEmit, this.maxParticles - this.activeParticleCount);
            for (let i = 0; i < actualParticlesToEmit; i++) {
                this.emitParticle(emitOrigin);
            }
        }

        // --- Update Existing Particles ---
        const particleLifetime = getParticleLifetime();
        let aliveCount = 0;
        for (let i = 0; i < this.activeParticleCount; i++) {
            const particle = this.particles[i];
            particle.age += deltaTime;

            if (particle.age >= particleLifetime) {
                // Particle died, swap with the last active particle
                const lastIndex = this.activeParticleCount - 1;
                if (i !== lastIndex) {
                    // Copy data from last particle to current slot
                    this.positions[i * 3 + 0] = this.positions[lastIndex * 3 + 0];
                    this.positions[i * 3 + 1] = this.positions[lastIndex * 3 + 1];
                    this.positions[i * 3 + 2] = this.positions[lastIndex * 3 + 2];
                    this.opacities[i] = this.opacities[lastIndex];
                    this.particles[i] = this.particles[lastIndex];
                }
                this.activeParticleCount--; // Reduce active count
                i--; // Re-process the swapped particle in the next iteration
                continue; // Skip further processing for this (now dead or replaced) particle
            }

            // Update position based on velocity and drift
            const currentPosX = this.positions[i * 3 + 0];
            const currentPosY = this.positions[i * 3 + 1];
            const currentPosZ = this.positions[i * 3 + 2];

            const newPosX = currentPosX + particle.velocity.x * deltaTime + PARTICLE_DRIFT_VELOCITY.x * deltaTime;
            let newPosY = currentPosY + particle.velocity.y * deltaTime + PARTICLE_DRIFT_VELOCITY.y * deltaTime;
            const newPosZ = currentPosZ + particle.velocity.z * deltaTime + PARTICLE_DRIFT_VELOCITY.z * deltaTime;

            // Optional: Prevent particles from going through the "ground" (approximate)
            // if (newPosY < particle.initialY * 0.8) { // If it drops significantly below start
            //     newPosY = particle.initialY * 0.8;
            //     particle.velocity.y *= -0.3; // Dampen bounce
            // }

            this.positions[i * 3 + 0] = newPosX;
            this.positions[i * 3 + 1] = newPosY;
            this.positions[i * 3 + 2] = newPosZ;

            // Update velocity (e.g., gravity, air resistance - simplified for now)
            // particle.velocity.y -= 0.5 * deltaTime; // Simple gravity

            // Update opacity (fade out)
            const lifeRatio = particle.age / getParticleLifetime();
            this.opacities[i] = 1.0 - lifeRatio; // Linear fade

            aliveCount++; // This index is still alive
        }

        // Important: Update the draw range and notify buffer attributes need update
        this.particleGeometry.setDrawRange(0, this.activeParticleCount);
        this.particleGeometry.attributes.position.needsUpdate = true;
        this.particleGeometry.attributes.opacity.needsUpdate = true; // Update opacity attribute
}
}