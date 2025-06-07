// js/entities/gameObjects/Tumbleweed.js

import * as THREE from 'three';
import * as ModelFactory from '../../rendering/modelFactory.js';
import PhysicsComponent from '../../physics/PhysicsComponent.js';
import TumbleweedAIComponent from '../../components/TumbleweedAIComponent.js';
import eventBus from '../../core/eventBus.js';
import { tumbleweedConfig as C } from '../../config/tumbleweed.js';
import { randomRange } from '../../utils/mathUtils.js';

/**
 * Tumbleweed GameObject
 * A dynamic hazard that rolls across the terrain toward the player's path
 */
export default class Tumbleweed {
    /**
     * Create a new Tumbleweed
     * @param {Object} options - Configuration options
     * @param {THREE.Vector3} options.position - Initial position
     * @param {number} options.scale - Scale factor
     * @param {THREE.Scene} options.scene - Scene to add to
     * @param {Object} options.levelConfig - Level configuration
     */
    constructor(options = {}) {
        this.name = C.OBJECT_TYPE_NAME;
        this.object3D = new THREE.Group();
        this.object3D.name = this.name;
        if (options.position) {
            this.object3D.position.copy(options.position);
        }
        this.active = true;
        this.components = new Map();

        this.scene = options.scene;
        this.levelConfig = options.levelConfig;
        this.scale = options.scale || 1.0;

        this._createVisual();

        this.addComponent(new PhysicsComponent({
            mass: C.MASS,
            friction: C.FRICTION,
            restitution: C.RESTITUTION,
            useGravity: C.USE_GRAVITY,
            gravityForce: C.GRAVITY_FORCE,
            velocity: new THREE.Vector3(0, 0, 0)
        }));

        this.addComponent(new TumbleweedAIComponent());

        if (this.scene) {
            this.addToScene(this.scene);
        }
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
        const tumbleweedModel = ModelFactory.createTumbleweedModel();
        this.object3D.add(tumbleweedModel);

        // Set scale
        this.object3D.scale.set(this.scale, this.scale, this.scale);

        // Set userData for collision detection
        this.object3D.userData = {
            objectType: 'tumbleweed',
            collidable: true,
            gameObject: this
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

        this.components.forEach(component => {
            if (component.enabled && typeof component.update === 'function') {
                component.update(deltaTime, elapsedTime, playerPosition);
            }
        });
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
