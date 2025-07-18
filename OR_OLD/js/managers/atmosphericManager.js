// js/managers/atmosphericManager.js
import * as THREE from 'three';
import { createLogger } from '../utils/logger.js'; // Stays in utils
// Assuming AssetManager provides createBuzzardModel directly or via a method
import * as ModelFactory from '../rendering/modelFactory.js'; // Moved to rendering

const logger = createLogger('AtmosphericManager'); // Use logger instance

class AtmosphericManager {
    constructor() {
        this.atmosphericElements = [];
        this.targetScene = null; // Scene to add elements to
        this.player = null; // Reference to player for positioning
        this.currentLevelId = null; // Track current level
        logger.info("AtmosphericManager instantiated");
    }

    // --- Initialization ---
    setTargetScene(scene) {
        this.targetScene = scene;
        logger.info("Target scene set.");
    }

    setPlayerReference(player) {
        this.player = player;
        logger.info("Player reference set.");
    }

    // --- Management ---
    clearElements() {
        logger.info("Clearing atmospheric elements...");
        this.atmosphericElements.forEach(element => {
            if (element && element.parent) {
                element.parent.remove(element);
            }
            // Dispose geometry and materials if necessary
            if (element.traverse) {
                element.traverse((child) => {
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
        });
        this.atmosphericElements = [];
        this.currentLevelId = null; // Reset level ID when clearing
        logger.info("Atmospheric elements cleared.");
    }

    addElementsForLevel(levelId, targetScene) {
        // Use provided targetScene or the stored one
        const sceneToAdd = targetScene || this.targetScene;
        if (!sceneToAdd) {
            logger.error("Cannot add atmospheric elements: Target scene not set or provided.");
            return;
        }
        // Ensure elements are added to the correct scene reference
        this.targetScene = sceneToAdd;

        this.clearElements(); // Clear previous elements before adding new ones
        this.currentLevelId = levelId;

        if (levelId === 'level2') {
            logger.info("Adding atmospheric buzzards for level 2...");
            const numBuzzards = 4;
            const circleRadius = 150;
            const buzzardAltitude = 80;
            for (let i = 0; i < numBuzzards; i++) {
                try {
                    // Use ModelFactory to create the buzzard
                    const buzzard = ModelFactory.createBuzzardModel();
                    if (buzzard) {
                        const angleOffset = (Math.PI * 2 / numBuzzards) * i;
                        // Initial placement relative to origin (will be updated relative to player)
                        const buzzardX = Math.cos(angleOffset) * circleRadius;
                        const buzzardZ = Math.sin(angleOffset) * circleRadius;
                        buzzard.position.set(buzzardX, buzzardAltitude, buzzardZ);
                        this.targetScene.add(buzzard); // Use the correct scene reference
                        this.atmosphericElements.push(buzzard);
                    } else {
                         logger.warn("Failed to create buzzard model instance.");
                    }
                } catch (error) {
                    logger.error("Error creating buzzard model:", error);
                }
            }
            logger.info(`${this.atmosphericElements.length} buzzards added.`);
        }

    }

    // --- Update Loop ---
    update(deltaTime, elapsedTime) {
        if (this.atmosphericElements.length === 0 || this.currentLevelId !== 'level2' || !this.player?.model) {
            return; // Only update if elements exist, it's level 2, and player exists
        }

        const circleRadius = 150;
        const circleSpeed = 0.05;
        const buzzardAltitude = 80;
        const playerX = this.player.model.position.x;
        const playerZ = this.player.model.position.z;

        this.atmosphericElements.forEach((buzzard, index) => {
            const angleOffset = (Math.PI * 2 / this.atmosphericElements.length) * index;
            const currentAngle = elapsedTime * circleSpeed + angleOffset;
            const buzzardX = playerX + Math.cos(currentAngle) * circleRadius;
            const buzzardZ = playerZ + Math.sin(currentAngle) * circleRadius;
            buzzard.position.set(buzzardX, buzzardAltitude, buzzardZ);
            // Look slightly below the player for a more natural pose
            buzzard.lookAt(playerX, buzzardAltitude - 10, playerZ);
        });
    }
}

// Singleton instance
const atmosphericManager = new AtmosphericManager();

export default atmosphericManager;