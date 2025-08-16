// js/utils/performanceUtils.js
import * as THREE from 'three';
import { createLogger } from './logger.js';

const logger = createLogger('PerformanceUtils');

/**
 * A helper class for performance optimizations in the game
 */
class PerformanceUtils {
    constructor() {
        this.frustum = new THREE.Frustum();
        this.matrix = new THREE.Matrix4();
        this.tempMatrix = new THREE.Matrix4();
        this.boundingSpheres = new Map();
        this.tempVector = new THREE.Vector3();
        this.tempBox = new THREE.Box3();
        this.enabled = true;
    }

    /**
     * Update the frustum for culling calculations
     * @param {THREE.Camera} camera - The camera to create the frustum from
     */
    updateFrustum(camera) {
        if (!camera) return;
        this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.matrix);
    }

    /**
     * Check if an object or its parent is visible in the camera frustum
     * @param {THREE.Object3D} object - The object to check visibility for
     * @param {number} [margin=10] - Additional margin to add to bounding sphere for visibility check
     * @returns {boolean} Whether the object should be visible
     */
    isObjectInFrustum(object, margin = 10) {
        if (!this.enabled || !object) return true;

        // Check if object has a parent that manages visibility
        if (object.parent && object.parent.userData && object.parent.userData.managesChildVisibility) {
            return true; // Let the parent manage visibility
        }

        // Get or create a bounding sphere for the object
        let boundingSphere = this.boundingSpheres.get(object.uuid);
        
        if (!boundingSphere || object.userData.needsBoundsUpdate) {
            // Create a temporary bounding box
            this.tempBox.setFromObject(object);
            
            if (this.tempBox.isEmpty()) {
                // If the box is empty, use a small sphere at the object's position
                boundingSphere = new THREE.Sphere(object.position.clone(), margin);
            } else {
                // Get the center of the bounding box
                this.tempBox.getCenter(this.tempVector);
                
                // Calculate the radius as the distance from center to corner plus margin
                const radius = this.tempVector.distanceTo(this.tempBox.max) + margin;
                
                // Create a new bounding sphere
                boundingSphere = new THREE.Sphere(this.tempVector.clone(), radius);
            }
            
            // Store the bounding sphere
            this.boundingSpheres.set(object.uuid, boundingSphere);
            
            // Mark that we've updated the bounds
            object.userData.needsBoundsUpdate = false;
        }
        
        // Transform the sphere's center based on object's world matrix
        const center = boundingSphere.center.clone();
        object.matrixWorld.decompose(this.tempVector, new THREE.Quaternion(), new THREE.Vector3());
        
        // Create a sphere at the world position with the same radius
        const worldSphere = new THREE.Sphere(this.tempVector, boundingSphere.radius);
        
        // Check if the sphere intersects with any frustum plane
        return this.frustum.intersectsSphere(worldSphere);
    }

    /**
     * Update visibility of objects based on frustum culling
     * @param {THREE.Object3D} root - The root object to check (typically scene)
     * @param {THREE.Camera} camera - The camera to use for frustum calculation
     */
    updateObjectVisibility(root, camera) {
        if (!this.enabled) return;
        if (!root || !camera) return;

        // Update the frustum from the camera
        this.updateFrustum(camera);

        // Process the scene graph
        root.traverse(object => {
            // Skip check for objects that specifically requested to bypass culling
            if (object.userData && object.userData.noCulling) {
                return;
            }

            // Skip the actual camera
            if (object.isCamera) return;

            // Skip light sources 
            if (object.isLight) return;

            // Skip particle systems (they're managed separately)
            if (object.userData && object.userData.isParticleSystem) return;

            // Skip objects with zero scale (already hidden)
            if (object.scale.x === 0 || object.scale.y === 0 || object.scale.z === 0) return;
            
            // Skip the player object and immediate children (should always be visible)
            if (object.userData && object.userData.isPlayer) return;
            if (object.parent && object.parent.userData && object.parent.userData.isPlayer) return;

            // Only check for meshes and groups (skip helpers, etc.)
            if (object.isMesh || object.isGroup) {
                // Only toggle visibility if the object has geometry/content
                if (object.isMesh && !object.geometry) return;
                if (object.isGroup && object.children.length === 0) return;
                
                // Skip small object optimization - always show small objects when close enough
                if (object.userData && object.userData.smallObject) {
                    const distToCamera = camera.position.distanceTo(object.position);
                    if (distToCamera < 30) { // Always show small objects in a reasonable range
                        object.visible = true;
                        return;
                    }
                }
                
                // Check if object is in frustum
                const isVisible = this.isObjectInFrustum(object);
                
                // Only update visibility if it's changing (avoid triggering unnecessary updates)
                if (object.visible !== isVisible) {
                    object.visible = isVisible;
                }
            }
        });
    }

    /**
     * Clean up any stored data for objects that have been removed
     * @param {Array} objectIds - Array of object UUIDs to remove
     */
    cleanupObjectData(objectIds) {
        if (!objectIds || objectIds.length === 0) return;
        
        objectIds.forEach(id => {
            this.boundingSpheres.delete(id);
        });
    }
}

const performanceUtils = new PerformanceUtils();
export default performanceUtils;