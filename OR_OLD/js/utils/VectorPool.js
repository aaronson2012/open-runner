// js/utils/VectorPool.js
import * as THREE from 'three';
import { createLogger } from './logger.js';

const logger = createLogger('VectorPool');

/**
 * Vector pool for reusable Vector3 instances to reduce garbage collection
 */
export class VectorPool {
    constructor(initialSize = 50) {
        this.pool = [];
        this.inUse = new Set();
        this.created = 0;
        this.borrowed = 0;
        this.returned = 0;
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new THREE.Vector3());
            this.created++;
        }
        
        logger.debug(`VectorPool initialized with ${initialSize} vectors`);
    }

    /**
     * Get a vector from the pool
     * @param {number} x - X component (optional)
     * @param {number} y - Y component (optional)
     * @param {number} z - Z component (optional)
     * @returns {THREE.Vector3} A Vector3 instance
     */
    get(x = 0, y = 0, z = 0) {
        let vector;
        
        if (this.pool.length > 0) {
            vector = this.pool.pop();
        } else {
            vector = new THREE.Vector3();
            this.created++;
        }
        
        vector.set(x, y, z);
        this.inUse.add(vector);
        this.borrowed++;
        
        return vector;
    }

    /**
     * Return a vector to the pool
     * @param {THREE.Vector3} vector - Vector to return
     */
    release(vector) {
        if (!vector || !(vector instanceof THREE.Vector3)) {
            logger.warn('Attempted to release invalid vector');
            return;
        }
        
        if (this.inUse.has(vector)) {
            this.inUse.delete(vector);
            vector.set(0, 0, 0); // Reset to zero
            this.pool.push(vector);
            this.returned++;
        } else {
            logger.warn('Attempted to release vector not from this pool');
        }
    }

    /**
     * Return multiple vectors to the pool
     * @param {...THREE.Vector3} vectors - Vectors to return
     */
    releaseAll(...vectors) {
        vectors.forEach(vector => this.release(vector));
    }

    /**
     * Get pool statistics
     * @returns {object} Pool statistics
     */
    getStats() {
        return {
            available: this.pool.length,
            inUse: this.inUse.size,
            created: this.created,
            borrowed: this.borrowed,
            returned: this.returned,
            efficiency: this.borrowed > 0 ? (this.returned / this.borrowed * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * Clear all vectors and reset pool
     */
    clear() {
        this.pool.length = 0;
        this.inUse.clear();
        this.created = 0;
        this.borrowed = 0;
        this.returned = 0;
        logger.debug('VectorPool cleared');
    }

    /**
     * Expand pool size if needed
     * @param {number} additionalSize - Number of vectors to add
     */
    expand(additionalSize = 25) {
        for (let i = 0; i < additionalSize; i++) {
            this.pool.push(new THREE.Vector3());
            this.created++;
        }
        logger.debug(`VectorPool expanded by ${additionalSize} vectors`);
    }
}

/**
 * Utility class for common vector operations with pooled vectors
 */
export class VectorUtils {
    constructor(vectorPool) {
        this.pool = vectorPool || new VectorPool();
    }

    /**
     * Calculate direction vector from point A to point B
     * @param {THREE.Vector3} from - Starting point
     * @param {THREE.Vector3} to - Target point
     * @param {boolean} normalize - Whether to normalize the result (default: true)
     * @returns {THREE.Vector3} Direction vector (must be released when done)
     */
    getDirection(from, to, normalize = true) {
        const direction = this.pool.get();
        direction.subVectors(to, from);
        if (normalize && direction.lengthSq() > 0) {
            direction.normalize();
        }
        return direction;
    }

    /**
     * Calculate midpoint between two vectors
     * @param {THREE.Vector3} a - First vector
     * @param {THREE.Vector3} b - Second vector
     * @returns {THREE.Vector3} Midpoint vector (must be released when done)
     */
    getMidpoint(a, b) {
        const midpoint = this.pool.get();
        midpoint.addVectors(a, b).multiplyScalar(0.5);
        return midpoint;
    }

    /**
     * Project vector A onto vector B
     * @param {THREE.Vector3} a - Vector to project
     * @param {THREE.Vector3} b - Vector to project onto
     * @returns {THREE.Vector3} Projected vector (must be released when done)
     */
    project(a, b) {
        const projected = this.pool.get();
        const temp = this.pool.get();
        
        temp.copy(b).normalize();
        const scalar = a.dot(temp);
        projected.copy(temp).multiplyScalar(scalar);
        
        this.pool.release(temp);
        return projected;
    }

    /**
     * Reflect vector across a normal
     * @param {THREE.Vector3} vector - Vector to reflect
     * @param {THREE.Vector3} normal - Normal vector
     * @returns {THREE.Vector3} Reflected vector (must be released when done)
     */
    reflect(vector, normal) {
        const reflected = this.pool.get();
        const temp = this.pool.get();
        
        temp.copy(normal).multiplyScalar(2 * vector.dot(normal));
        reflected.subVectors(vector, temp);
        
        this.pool.release(temp);
        return reflected;
    }

    /**
     * Calculate cross product of two vectors
     * @param {THREE.Vector3} a - First vector
     * @param {THREE.Vector3} b - Second vector
     * @returns {THREE.Vector3} Cross product vector (must be released when done)
     */
    cross(a, b) {
        const result = this.pool.get();
        result.crossVectors(a, b);
        return result;
    }

    /**
     * Linearly interpolate between two vectors
     * @param {THREE.Vector3} a - Start vector
     * @param {THREE.Vector3} b - End vector
     * @param {number} t - Interpolation factor (0-1)
     * @returns {THREE.Vector3} Interpolated vector (must be released when done)
     */
    lerp(a, b, t) {
        const result = this.pool.get();
        result.lerpVectors(a, b, t);
        return result;
    }

    /**
     * Calculate distance between two vectors
     * @param {THREE.Vector3} a - First vector
     * @param {THREE.Vector3} b - Second vector
     * @returns {number} Distance
     */
    distance(a, b) {
        return a.distanceTo(b);
    }

    /**
     * Calculate squared distance between two vectors (more efficient for comparisons)
     * @param {THREE.Vector3} a - First vector
     * @param {THREE.Vector3} b - Second vector
     * @returns {number} Squared distance
     */
    distanceSquared(a, b) {
        return a.distanceToSquared(b);
    }

    /**
     * Create a random point within a sphere
     * @param {THREE.Vector3} center - Center of sphere
     * @param {number} radius - Radius of sphere
     * @returns {THREE.Vector3} Random point (must be released when done)
     */
    randomInSphere(center, radius) {
        const point = this.pool.get();
        
        // Generate random point in unit sphere
        const u = Math.random();
        const v = Math.random();
        const w = Math.random();
        
        const mag = Math.pow(u, 1/3) * radius;
        const theta = 2 * Math.PI * v;
        const phi = Math.acos(2 * w - 1);
        
        point.x = center.x + mag * Math.sin(phi) * Math.cos(theta);
        point.y = center.y + mag * Math.sin(phi) * Math.sin(theta);
        point.z = center.z + mag * Math.cos(phi);
        
        return point;
    }

    /**
     * Release a vector back to the pool
     * @param {THREE.Vector3} vector - Vector to release
     */
    release(vector) {
        this.pool.release(vector);
    }

    /**
     * Release multiple vectors back to the pool
     * @param {...THREE.Vector3} vectors - Vectors to release
     */
    releaseAll(...vectors) {
        this.pool.releaseAll(...vectors);
    }

    /**
     * Get pool statistics
     * @returns {object} Pool statistics
     */
    getStats() {
        return this.pool.getStats();
    }
}

// Export singleton instances
export const vectorPool = new VectorPool();
export const vectorUtils = new VectorUtils(vectorPool);