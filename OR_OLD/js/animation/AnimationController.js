// js/animation/AnimationController.js
import { smoothDamp } from '../utils/mathUtils.js';
import { enemyDefaultsConfig } from '../config/enemyDefaults.js';
import { playerConfig } from '../config/player.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AnimationController');

/**
 * Unified animation controller for consistent animation behavior across entities
 */
export class AnimationController {
    constructor() {
        this.activeAnimations = new Map();
    }

    /**
     * Animate enemy legs with walking motion
     * @param {object} legs - Object containing leg references {frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg}
     * @param {number} elapsedTime - Total elapsed time
     * @param {boolean} isMoving - Whether the entity is moving
     * @param {number} currentSpeed - Current movement speed
     * @param {object} config - Animation configuration (optional, uses enemy defaults)
     */
    animateEnemyLegs(legs, elapsedTime, isMoving, currentSpeed, config = enemyDefaultsConfig) {
        if (!legs || typeof legs !== 'object') {
            return;
        }

        const animationSpeed = currentSpeed * config.ANIMATION_SPEED_FACTOR * (isMoving ? 1 : 0);
        const legSwingAmplitude = config.LEG_SWING_AMPLITUDE;

        if (isMoving && animationSpeed > 0) {
            const phase = elapsedTime * animationSpeed;
            
            // Diagonal leg pattern (front-left with back-right, front-right with back-left)
            if (legs.frontLeftLeg) {
                legs.frontLeftLeg.rotation.x = Math.sin(phase) * legSwingAmplitude;
            }
            if (legs.backRightLeg) {
                legs.backRightLeg.rotation.x = Math.sin(phase) * legSwingAmplitude;
            }
            if (legs.frontRightLeg) {
                legs.frontRightLeg.rotation.x = Math.sin(phase + Math.PI) * legSwingAmplitude;
            }
            if (legs.backLeftLeg) {
                legs.backLeftLeg.rotation.x = Math.sin(phase + Math.PI) * legSwingAmplitude;
            }
        } else {
            // Smoothly return to neutral position when stopped
            const smoothTime = config.STOPPED_ANIMATION_SMOOTHING;
            
            if (legs.frontLeftLeg) {
                legs.frontLeftLeg.rotation.x = smoothDamp(legs.frontLeftLeg.rotation.x, 0, smoothTime, smoothTime);
            }
            if (legs.backRightLeg) {
                legs.backRightLeg.rotation.x = smoothDamp(legs.backRightLeg.rotation.x, 0, smoothTime, smoothTime);
            }
            if (legs.frontRightLeg) {
                legs.frontRightLeg.rotation.x = smoothDamp(legs.frontRightLeg.rotation.x, 0, smoothTime, smoothTime);
            }
            if (legs.backLeftLeg) {
                legs.backLeftLeg.rotation.x = smoothDamp(legs.backLeftLeg.rotation.x, 0, smoothTime, smoothTime);
            }
        }
    }

    /**
     * Animate player character with running motion including joint bending
     * @param {object} parts - Object containing limb and joint groups
     * @param {number} animationTime - Animation time
     * @param {number} runSpeed - Speed factor for animation frequency
     * @param {object} config - Player animation configuration (optional, uses player defaults)
     */
    animatePlayerCharacter(parts, animationTime, runSpeed = 10, config = playerConfig) {
        const {
            leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup,
            leftElbowGroup, rightElbowGroup, leftKneeGroup, rightKneeGroup
        } = parts;

        const frequency = runSpeed;
        const armAmplitude = config.ARM_SWING_AMPLITUDE;
        const legAmplitude = config.LEG_SWING_AMPLITUDE;
        const elbowBendAmplitude = config.ELBOW_BEND_AMPLITUDE;
        const kneeBendAmplitude = config.KNEE_BEND_AMPLITUDE;

        // Calculate swing patterns
        const armSwing = Math.sin(animationTime * frequency) * armAmplitude;
        const legSwing = Math.sin(animationTime * frequency) * legAmplitude;

        // Animate main limb groups (opposing pattern for arms and legs)
        if (leftArmGroup) leftArmGroup.rotation.x = legSwing;
        if (rightArmGroup) rightArmGroup.rotation.x = -legSwing;
        if (leftLegGroup) leftLegGroup.rotation.x = -armSwing;
        if (rightLegGroup) rightLegGroup.rotation.x = armSwing;

        // Animate joint bending
        const kneeBend = (Math.cos(animationTime * frequency + Math.PI) + 1) / 2 * kneeBendAmplitude;
        const elbowBend = (Math.cos(animationTime * frequency) + 1) / 2 * elbowBendAmplitude;

        if (leftKneeGroup) leftKneeGroup.rotation.x = -kneeBend;
        if (rightKneeGroup) rightKneeGroup.rotation.x = -kneeBend;
        if (leftElbowGroup) leftElbowGroup.rotation.x = elbowBend;
        if (rightElbowGroup) rightElbowGroup.rotation.x = elbowBend;
    }

    /**
     * Generic limb animation for any entity with limb groups
     * @param {object} options - Animation options
     * @param {object} options.limbs - Object containing limb references
     * @param {number} options.time - Animation time
     * @param {number} options.speed - Animation speed multiplier
     * @param {boolean} options.isMoving - Whether entity is moving
     * @param {string} options.pattern - Animation pattern ('diagonal', 'alternating', 'synchronized')
     * @param {number} options.amplitude - Swing amplitude
     */
    animateGenericLimbs(options) {
        const {
            limbs,
            time,
            speed = 1,
            isMoving = true,
            pattern = 'diagonal',
            amplitude = 0.3
        } = options;

        if (!limbs || !isMoving) {
            return;
        }

        const phase = time * speed;

        switch (pattern) {
            case 'diagonal':
                // Front-left with back-right, front-right with back-left
                if (limbs.frontLeft) limbs.frontLeft.rotation.x = Math.sin(phase) * amplitude;
                if (limbs.backRight) limbs.backRight.rotation.x = Math.sin(phase) * amplitude;
                if (limbs.frontRight) limbs.frontRight.rotation.x = Math.sin(phase + Math.PI) * amplitude;
                if (limbs.backLeft) limbs.backLeft.rotation.x = Math.sin(phase + Math.PI) * amplitude;
                break;

            case 'alternating':
                // Left side together, right side together
                if (limbs.left) limbs.left.rotation.x = Math.sin(phase) * amplitude;
                if (limbs.right) limbs.right.rotation.x = Math.sin(phase + Math.PI) * amplitude;
                break;

            case 'synchronized':
                // All limbs move together
                const swing = Math.sin(phase) * amplitude;
                Object.values(limbs).forEach(limb => {
                    if (limb && limb.rotation) {
                        limb.rotation.x = swing;
                    }
                });
                break;

            default:
                logger.warn(`Unknown animation pattern: ${pattern}`);
        }
    }

    /**
     * Stop animation for specific limbs by smoothly returning to neutral
     * @param {object} limbs - Object containing limb references
     * @param {number} smoothTime - Smoothing time factor
     */
    stopAnimation(limbs, smoothTime = 0.1) {
        if (!limbs || typeof limbs !== 'object') {
            return;
        }

        Object.values(limbs).forEach(limb => {
            if (limb && limb.rotation) {
                limb.rotation.x = smoothDamp(limb.rotation.x, 0, smoothTime, smoothTime);
                limb.rotation.y = smoothDamp(limb.rotation.y, 0, smoothTime, smoothTime);
                limb.rotation.z = smoothDamp(limb.rotation.z, 0, smoothTime, smoothTime);
            }
        });
    }

    /**
     * Reset all limbs to neutral position
     * @param {object} limbs - Object containing limb references
     */
    resetToNeutral(limbs) {
        if (!limbs || typeof limbs !== 'object') {
            return;
        }

        Object.values(limbs).forEach(limb => {
            if (limb && limb.rotation) {
                limb.rotation.set(0, 0, 0);
            }
        });
    }

    /**
     * Create an animation state for tracking persistent animations
     * @param {string} id - Unique identifier for the animation
     * @param {object} state - Initial animation state
     */
    createAnimationState(id, state = {}) {
        this.activeAnimations.set(id, {
            time: 0,
            isActive: true,
            ...state
        });
    }

    /**
     * Update animation state
     * @param {string} id - Animation identifier
     * @param {number} deltaTime - Time since last update
     * @param {object} updates - State updates
     */
    updateAnimationState(id, deltaTime, updates = {}) {
        const state = this.activeAnimations.get(id);
        if (state) {
            state.time += deltaTime;
            Object.assign(state, updates);
        }
    }

    /**
     * Get animation state
     * @param {string} id - Animation identifier
     * @returns {object|null} Animation state or null if not found
     */
    getAnimationState(id) {
        return this.activeAnimations.get(id) || null;
    }

    /**
     * Remove animation state
     * @param {string} id - Animation identifier
     */
    removeAnimationState(id) {
        this.activeAnimations.delete(id);
    }

    /**
     * Clear all animation states
     */
    clearAllStates() {
        this.activeAnimations.clear();
    }
}

// Export singleton instance
export const animationController = new AnimationController();