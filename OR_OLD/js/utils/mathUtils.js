// js/utils/mathUtils.js

import * as THREE from 'three'; // Re-enabled THREE import
import { vectorPool, vectorUtils } from './VectorPool.js';

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
 * Generates a random number between min and max
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random number in range [min, max)
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
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
    return current + (target - current) * smoothFactor;
}



/**
 * Get a pooled Vector3 to reduce garbage collection
 * @param {number} x - X component (default: 0)
 * @param {number} y - Y component (default: 0)
 * @param {number} z - Z component (default: 0)
 * @returns {THREE.Vector3} Pooled vector (must be released when done)
 */
export function getPooledVector(x = 0, y = 0, z = 0) {
    return vectorPool.get(x, y, z);
}

/**
 * Release a pooled vector back to the pool
 * @param {THREE.Vector3} vector - Vector to release
 */
export function releaseVector(vector) {
    vectorPool.release(vector);
}

/**
 * Release multiple pooled vectors back to the pool
 * @param {...THREE.Vector3} vectors - Vectors to release
 */
export function releaseVectors(...vectors) {
    vectorPool.releaseAll(...vectors);
}

/**
 * Calculate direction from one point to another using pooled vectors
 * @param {THREE.Vector3} from - Starting point
 * @param {THREE.Vector3} to - Target point
 * @param {boolean} normalize - Whether to normalize (default: true)
 * @returns {THREE.Vector3} Direction vector (must be released when done)
 */
export function getDirection(from, to, normalize = true) {
    return vectorUtils.getDirection(from, to, normalize);
}

/**
 * Get vector pool statistics for debugging
 * @returns {object} Pool statistics
 */
export function getVectorPoolStats() {
    return vectorPool.getStats();
}

// Export the pool and utils for advanced usage
export { vectorPool, vectorUtils };