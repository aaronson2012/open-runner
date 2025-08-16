// js/utils/mathUtils.js

import * as THREE from 'three'; // Re-enabled THREE import

/**
 * Utility functions for common mathematical operations
 */

/**
 * Clamps a value between min and max
 * @param {number} value - The value to clamp
 * @param {number} min - The minimum allowed value
 * @param {number} max - The maximum allowed value
 * @returns {number} The clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolates between a and b by t
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} The interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Converts degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Generates a random number between min and max
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random number in range [min, max)
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Generates a random integer between min and max (inclusive)
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer in range [min, max]
 */
export function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Smoothly interpolates between a and b with smoothing factor
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} deltaTime - Time since last update
 * @param {number} smoothingFactor - Smoothing factor (0-1, lower = smoother)
 * @returns {number} Smoothed value
 */
export function smoothDamp(current, target, deltaTime, smoothingFactor) {
    // Calculate the smooth factor based on delta time
    const smoothFactor = 1.0 - Math.pow(smoothingFactor, deltaTime);
    return lerp(current, target, smoothFactor);
}

/**
 * Creates a function that applies a smooth drift to a position
 * @param {Object} options - Configuration options
 * @param {THREE.Vector3} options.amplitude - Amplitude of the drift in each axis
 * @param {THREE.Vector3} options.period - Period of the drift in each axis
 * @param {THREE.Vector3} options.center - Center position of the drift
 * @param {number} options.smoothingFactor - Smoothing factor for the drift
 * @returns {function(number): THREE.Vector3} Function that takes deltaTime and returns new position
 */
export function createPositionDrift(options = {}) {
    const config = {
        amplitude: options.amplitude || new THREE.Vector3(1, 1, 1),
        period: options.period || new THREE.Vector3(10, 10, 10),
        center: options.center || new THREE.Vector3(0, 0, 0),
        smoothingFactor: options.smoothingFactor || 0.95
    };

    const originalPosition = config.center.clone();
    let elapsedTime = 0;
    const targetPosition = config.center.clone();
    const currentPosition = config.center.clone();

    return (deltaTime) => {
        elapsedTime += deltaTime;

        // Calculate the target position with sinusoidal drift
        targetPosition.x = originalPosition.x + Math.sin(elapsedTime * (Math.PI * 2) / config.period.x) * config.amplitude.x;
        targetPosition.y = originalPosition.y + Math.sin(elapsedTime * (Math.PI * 2) / config.period.y) * config.amplitude.y;
        targetPosition.z = originalPosition.z + Math.sin(elapsedTime * (Math.PI * 2) / config.period.z) * config.amplitude.z;

        // Apply smoothing
        currentPosition.lerp(targetPosition, 1 - config.smoothingFactor);

        return currentPosition;
    };
}

/**
 * Calculates a smooth step between edge0 and edge1
 * @param {number} edge0 - Lower edge
 * @param {number} edge1 - Upper edge
 * @param {number} x - Input value
 * @returns {number} Smoothed value between 0 and 1
 */
export function smoothStep(edge0, edge1, x) {
    // Scale, bias and saturate x to 0..1 range
    x = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    // Evaluate polynomial
    return x * x * (3 - 2 * x);
}

/**
 * Performs spherical linear interpolation between quaternions
 * @param {THREE.Quaternion} qa - Start quaternion
 * @param {THREE.Quaternion} qb - End quaternion
 * @param {number} t - Interpolation factor (0-1)
 * @returns {THREE.Quaternion} Interpolated quaternion
 */
export function slerpQuaternions(qa, qb, t) {
    const result = new THREE.Quaternion();
    result.slerpQuaternions(qa, qb, clamp(t, 0, 1));
    return result;
}

/**
 * Calculates the distance between two points {x, y?, z?}
 * @param {{x: number, y?: number, z?: number}} a - First point
 * @param {{x: number, y?: number, z?: number}} b - Second point
 * @returns {number} Distance between points
 */
export function distance(a, b) {
    const dx = a.x - b.x;
    const dy = (a.y || 0) - (b.y || 0);
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates the squared distance between two Vector3 points
 * (More efficient than distance when only comparing distances)
 * @param {{x: number, y?: number, z?: number}} a - First point
 * @param {{x: number, y?: number, z?: number}} b - Second point
 * @returns {number} Squared distance between points
 */
export function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = (a.y || 0) - (b.y || 0);
    const dz = (a.z || 0) - (b.z || 0);
    return dx * dx + dy * dy + dz * dz;
}