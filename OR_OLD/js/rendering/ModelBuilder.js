// js/rendering/ModelBuilder.js
import * as THREE from 'three';
import { getAsset, getGeometry, getMaterial } from '../managers/assetManager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModelBuilder');

/**
 * A fluent API builder for consolidating repetitive model creation patterns.
 * Handles the common pattern of: create group → get config → create geometry → create material → create mesh → set shadows → add to group
 */
export class ModelBuilder {
    constructor() {
        this.reset();
    }

    /**
     * Reset the builder for reuse
     * @returns {ModelBuilder} This builder for chaining
     */
    reset() {
        this.group = new THREE.Group();
        this.config = null;
        this.properties = null;
        return this;
    }

    /**
     * Set the configuration object for the model
     * @param {object} config - Model configuration from C_MODELS
     * @returns {ModelBuilder} This builder for chaining
     */
    withConfig(config) {
        this.config = config;
        return this;
    }

    /**
     * Set optional properties for the model
     * @param {object} properties - Optional properties (e.g., color, size)
     * @returns {ModelBuilder} This builder for chaining
     */
    withProperties(properties) {
        this.properties = properties;
        return this;
    }

    /**
     * Create a mesh using asset or fallback geometry and material
     * @param {object} options - Mesh creation options
     * @param {string} options.geometryKey - Key for geometry asset or fallback name
     * @param {function} options.geometryFallback - Function to create fallback geometry
     * @param {string} options.materialKey - Key for material asset or material name
     * @param {function} options.materialFallback - Function to create fallback material
     * @param {object} options.position - Position for the mesh {x, y, z}
     * @param {object} options.rotation - Rotation for the mesh {x, y, z}
     * @param {object} options.scale - Scale for the mesh {x, y, z}
     * @param {boolean} options.castShadow - Whether mesh should cast shadows (default: true)
     * @param {boolean} options.receiveShadow - Whether mesh should receive shadows (default: true)
     * @param {object} options.userData - Additional userData for the mesh
     * @returns {ModelBuilder} This builder for chaining
     */
    addMesh(options) {
        const {
            geometryKey,
            geometryFallback,
            materialKey,
            materialFallback,
            position = { x: 0, y: 0, z: 0 },
            rotation = { x: 0, y: 0, z: 0 },
            scale = { x: 1, y: 1, z: 1 },
            castShadow = true,
            receiveShadow = true,
            userData = {}
        } = options;

        // Get geometry from asset or create fallback
        let geometry;
        if (geometryKey && this.config && this.config[geometryKey]) {
            geometry = getAsset(this.config[geometryKey]);
        }
        if (!geometry && geometryFallback) {
            const fallbackName = typeof geometryKey === 'string' ? geometryKey : 'fallback-geometry';
            geometry = getGeometry(fallbackName, geometryFallback);
        }

        // Get material from asset or create fallback
        let material;
        if (materialKey && this.config && this.config[materialKey]) {
            material = getAsset(this.config[materialKey]);
        }
        if (!material && materialFallback) {
            const fallbackName = typeof materialKey === 'string' ? materialKey : 'fallback-material';
            material = getMaterial(fallbackName, materialFallback);
        }

        if (!geometry || !material) {
            logger.warn(`Missing geometry or material for mesh creation`, {
                geometryKey,
                materialKey,
                hasGeometry: !!geometry,
                hasMaterial: !!material
            });
            return this;
        }

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Set position, rotation, scale
        mesh.position.set(position.x, position.y, position.z);
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
        mesh.scale.set(scale.x, scale.y, scale.z);
        
        // Set shadows
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        
        // Set userData
        Object.assign(mesh.userData, userData);
        
        // Add to group
        this.group.add(mesh);
        
        return this;
    }

    /**
     * Apply shadow settings to all meshes in the group
     * @param {boolean} castShadow - Whether meshes should cast shadows (default: true)
     * @param {boolean} receiveShadow - Whether meshes should receive shadows (default: true)
     * @returns {ModelBuilder} This builder for chaining
     */
    withShadows(castShadow = true, receiveShadow = true) {
        this.group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = castShadow;
                child.receiveShadow = receiveShadow;
            }
        });
        return this;
    }

    /**
     * Set userData on the group
     * @param {object} userData - UserData to set on the group
     * @returns {ModelBuilder} This builder for chaining
     */
    withUserData(userData) {
        Object.assign(this.group.userData, userData);
        return this;
    }

    /**
     * Set the name of the group
     * @param {string} name - Name for the group
     * @returns {ModelBuilder} This builder for chaining
     */
    withName(name) {
        this.group.name = name;
        return this;
    }

    /**
     * Add a child object to the group
     * @param {THREE.Object3D} child - Child object to add
     * @returns {ModelBuilder} This builder for chaining
     */
    addChild(child) {
        this.group.add(child);
        return this;
    }

    /**
     * Apply a transform to the entire group
     * @param {object} transform - Transform options
     * @param {object} transform.position - Position {x, y, z}
     * @param {object} transform.rotation - Rotation {x, y, z}
     * @param {object} transform.scale - Scale {x, y, z}
     * @returns {ModelBuilder} This builder for chaining
     */
    withTransform(transform) {
        if (transform.position) {
            this.group.position.set(transform.position.x, transform.position.y, transform.position.z);
        }
        if (transform.rotation) {
            this.group.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
        }
        if (transform.scale) {
            this.group.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
        }
        return this;
    }

    /**
     * Execute a custom function with access to the group
     * @param {function} fn - Function to execute, receives (group, config, properties)
     * @returns {ModelBuilder} This builder for chaining
     */
    execute(fn) {
        if (typeof fn === 'function') {
            fn(this.group, this.config, this.properties);
        }
        return this;
    }

    /**
     * Build and return the final group
     * @returns {THREE.Group} The built model group
     */
    build() {
        const result = this.group;
        this.reset(); // Reset for next use
        return result;
    }
}

// Export a singleton instance for convenience
export const modelBuilder = new ModelBuilder();