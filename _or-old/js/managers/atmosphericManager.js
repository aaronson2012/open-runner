// js/managers/atmosphericManager.js
import * as THREE from 'three';
import { createLogger } from '../utils/logger.js'; // Stays in utils
// Assuming AssetManager provides createBuzzardModel directly or via a method
import * as ModelFactory from '../rendering/modelFactory.js'; // Moved to rendering

const logger = createLogger('AtmosphericManager'); // Use logger instance

class AtmosphericManager {
    constructor() {
        this.atmosphericElements = []; // Stores active 3D objects
        this.targetScene = null;
        this.player = null;
        this.currentLevelConfig = null; // Store the whole level config for easy access
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
        this.atmosphericElements.forEach(elementData => {
            const element = elementData.model; // The 3D object is stored in model property
            if (element && element.parent) {
                element.parent.remove(element);
            }
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
        this.currentLevelConfig = null;
        logger.info("Atmospheric elements cleared.");
    }

    // Called by LevelManager or Game when a level is loaded
    setupAtmosphereForLevel(levelConfig, targetScene) {
        const sceneToUpdate = targetScene || this.targetScene;
        if (!sceneToUpdate) {
            logger.error("Cannot setup atmosphere: Target scene not set or provided.");
            return;
        }
        this.targetScene = sceneToUpdate; // Ensure correct scene reference
        this.currentLevelConfig = levelConfig;

        this.clearElements(); // Clear previous elements

        if (!levelConfig || !levelConfig.atmosphericProfile) {
            logger.warn(`No atmosphericProfile found for level: ${levelConfig ? levelConfig.levelId || 'Unknown Level' : 'Unknown Level'}. Skipping atmospheric setup.`);
            // Set some defaults or clear scene atmosphere if no profile
            sceneToUpdate.background = new THREE.Color(0x000000); // Default black
            sceneToUpdate.fog = null; // Clear fog
            return;
        }

        const profile = levelConfig.atmosphericProfile;
        logger.info(`Setting up atmosphere for level using profile:`, profile);

        // 1. Apply Scene Background
        if (profile.backgroundColor !== undefined) {
            sceneToUpdate.background = new THREE.Color(profile.backgroundColor);
        }

        // 2. Apply Fog
        if (profile.fog) {
            sceneToUpdate.fog = new THREE.Fog(
                new THREE.Color(profile.fog.color),
                profile.fog.near,
                profile.fog.far
            );
        } else {
            sceneToUpdate.fog = null; // Remove fog if not defined
        }

        // 3. Apply Lighting
        if (profile.lighting) {
            // Ambient Light
            if (profile.lighting.ambient) {
                let ambientLight = sceneToUpdate.getObjectByProperty('isAmbientLight', true);
                if (!ambientLight) {
                    ambientLight = new THREE.AmbientLight();
                    sceneToUpdate.add(ambientLight);
                    logger.info("Created new AmbientLight.");
                }
                ambientLight.color.setHex(profile.lighting.ambient.color);
                ambientLight.intensity = profile.lighting.ambient.intensity;
                logger.info("Ambient light updated from profile:", profile.lighting.ambient);
            }

            // Directional Light
            if (profile.lighting.directional) {
                let directionalLight = sceneToUpdate.getObjectByProperty('isDirectionalLight', true);
                if (!directionalLight) {
                    directionalLight = new THREE.DirectionalLight();
                    // Default position if not in profile, though profile should have it
                    directionalLight.position.set(1, 1, 1);
                    sceneToUpdate.add(directionalLight);
                    logger.info("Created new DirectionalLight.");
                }
                directionalLight.color.setHex(profile.lighting.directional.color);
                directionalLight.intensity = profile.lighting.directional.intensity;
                if (profile.lighting.directional.position) {
                    directionalLight.position.set(
                        profile.lighting.directional.position.x,
                        profile.lighting.directional.position.y,
                        profile.lighting.directional.position.z
                    ).normalize(); // Normalizing is good practice for directional lights
                }
                logger.info("Directional light updated from profile:", profile.lighting.directional);
            }
        } else {
            // Optional: Remove existing lights if no lighting profile is defined
            // This depends on whether other systems might be managing lights.
            // For now, we'll leave existing lights if no profile section.
            logger.warn("No lighting profile found. Existing scene lights (if any) will remain unchanged.");
        }

        // 4. Add Atmospheric Elements
        if (profile.elements && profile.elements.length > 0) {
            profile.elements.forEach(elementConfig => {
                this.createAndAddElement(elementConfig);
            });
        }
        logger.info("Atmosphere setup complete.");
    }

    createAndAddElement(elementConfig) {
        if (!this.targetScene) {
            logger.error("Cannot add element: Target scene not set.");
            return;
        }

        let elementModel;
        switch (elementConfig.type) {
            case 'buzzard':
                try {
                    elementModel = ModelFactory.createBuzzardModel();
                    if (elementModel) {
                        // Initial placement (will be updated in the update loop)
                        // Store config for use in update loop
                        const initialAngle = Math.random() * Math.PI * 2; // Random start angle
                        const initialX = Math.cos(initialAngle) * elementConfig.circleRadius;
                        const initialZ = Math.sin(initialAngle) * elementConfig.circleRadius;
                        elementModel.position.set(initialX, elementConfig.altitude, initialZ);
                        
                        this.targetScene.add(elementModel);
                        this.atmosphericElements.push({ model: elementModel, config: elementConfig, type: 'buzzard' });
                        logger.info(`Added ${elementConfig.type} element.`);
                    } else {
                        logger.warn("Failed to create buzzard model instance for atmospheric element.");
                    }
                } catch (error) {
                    logger.error(`Error creating ${elementConfig.type} model:`, error);
                }
                break;
            // Add cases for other element types here (e.g., clouds, dust particles)
            default:
                logger.warn(`Unknown atmospheric element type: ${elementConfig.type}`);
                break;
        }
    }


    // --- Update Loop ---
    update(deltaTime, elapsedTime) {
        if (!this.player?.model || this.atmosphericElements.length === 0) {
            return;
        }

        const playerX = this.player.model.position.x;
        const playerZ = this.player.model.position.z;

        this.atmosphericElements.forEach((elementData, index) => {
            const model = elementData.model;
            const config = elementData.config;

            switch (elementData.type) {
                case 'buzzard':
                    if (config) {
                        const angleOffset = (Math.PI * 2 / (config.count || 1)) * index; // Use count from config
                        const currentAngle = elapsedTime * config.circleSpeed + angleOffset;
                        
                        const buzzardX = playerX + Math.cos(currentAngle) * config.circleRadius;
                        const buzzardZ = playerZ + Math.sin(currentAngle) * config.circleRadius;
                        model.position.set(buzzardX, config.altitude, buzzardZ);

                        const lookAtY = config.altitude + (config.lookAtOffset ? config.lookAtOffset.y : 0);
                        model.lookAt(playerX, lookAtY, playerZ);
                    }
                    break;
                // Add update logic for other element types here
            }
        });
    }
}

// Singleton instance
const atmosphericManager = new AtmosphericManager();

export default atmosphericManager;