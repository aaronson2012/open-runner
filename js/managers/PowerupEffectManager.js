import * as THREE from 'three';
import eventBus from '../core/eventBus.js';
import { gameplayConfig } from '../config/gameplay.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PowerupEffectManager');

class PowerupEffectManager {
    constructor() {
        this.player = null;
        this._setupEventSubscriptions();
        logger.info('PowerupEffectManager initialized');
    }

    setPlayer(player) {
        this.player = player;
    }

    _setupEventSubscriptions() {
        eventBus.subscribe('powerupActivated', this.handlePowerupActivated.bind(this));
        eventBus.subscribe('powerupDeactivated', this.handlePowerupDeactivated.bind(this));
    }

    handlePowerupActivated({ type, player }) {
        this.setPlayer(player);
        if (type === gameplayConfig.POWERUP_TYPE_MAGNET && this.player && this.player.model) {
            this.applyMagnetEffect();
        } else if (type === gameplayConfig.POWERUP_TYPE_DOUBLER && this.player && this.player.model) {
            this.applyDoublerEffect();
        } else if (type === gameplayConfig.POWERUP_TYPE_INVISIBILITY && this.player && this.player.model) {
            this.applyInvisibilityEffect();
        }
    }

    handlePowerupDeactivated({ type, player }) {
        this.setPlayer(player);
        if (type === gameplayConfig.POWERUP_TYPE_MAGNET && this.player && this.player.model) {
            this.removeMagnetEffect();
        } else if (type === gameplayConfig.POWERUP_TYPE_DOUBLER && this.player && this.player.model) {
            this.removeDoublerEffect();
        } else if (type === gameplayConfig.POWERUP_TYPE_INVISIBILITY && this.player && this.player.model) {
            this.removeInvisibilityEffect();
        }
    }

    applyMagnetEffect() {
        logger.info(`Applying magnet powerup visual effect to player`);
        const magnetMaterial = new THREE.MeshStandardMaterial({
            color: gameplayConfig.MAGNET_EFFECT_COLOR,
            emissive: gameplayConfig.MAGNET_EFFECT_EMISSIVE,
            metalness: gameplayConfig.MAGNET_EFFECT_METALNESS,
            roughness: gameplayConfig.MAGNET_EFFECT_ROUGHNESS
        });

        this.player.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                child.material = magnetMaterial;
            }
        });
    }

    removeMagnetEffect() {
        logger.info(`Removing magnet powerup visual effect from player`);
        this.player.model.traverse(child => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
            }
        });
    }

    applyDoublerEffect() {
        logger.info(`Applying doubler powerup visual effect to player`);
        const doublerMaterial = new THREE.MeshStandardMaterial({
            color: gameplayConfig.DOUBLER_EFFECT_COLOR,
            emissive: gameplayConfig.DOUBLER_EFFECT_EMISSIVE,
            metalness: gameplayConfig.DOUBLER_EFFECT_METALNESS,
            roughness: gameplayConfig.DOUBLER_EFFECT_ROUGHNESS
        });

        this.player.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                child.material = doublerMaterial;
            }
        });

        if (!this.player.doublerIndicator) {
            this.player.doublerIndicator = new THREE.Group();
            const xMaterial = new THREE.MeshStandardMaterial({
                color: gameplayConfig.DOUBLER_EFFECT_COLOR,
                emissive: gameplayConfig.DOUBLER_EFFECT_EMISSIVE,
                metalness: 0.8,
                roughness: 0.1
            });
            const indicatorSize = 0.3;
            const indicatorHeight = 2.0;
            const bgGeometry = new THREE.CylinderGeometry(indicatorSize * 1.2, indicatorSize * 1.2, 0.05, 16);
            bgGeometry.rotateX(Math.PI / 2);
            const bgMaterial = new THREE.MeshStandardMaterial({
                color: 0x000033,
                transparent: true,
                opacity: 0.6
            });
            const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
            const diag1Geometry = new THREE.BoxGeometry(indicatorSize * 0.15, indicatorSize * 1.4, 0.05);
            const diag1 = new THREE.Mesh(diag1Geometry, xMaterial);
            diag1.rotation.z = Math.PI / 4;
            diag1.position.z = 0.03;
            const diag2Geometry = new THREE.BoxGeometry(indicatorSize * 0.15, indicatorSize * 1.4, 0.05);
            const diag2 = new THREE.Mesh(diag2Geometry, xMaterial);
            diag2.rotation.z = -Math.PI / 4;
            diag2.position.z = 0.03;
            this.player.doublerIndicator.add(bgMesh);
            this.player.doublerIndicator.add(diag1);
            this.player.doublerIndicator.add(diag2);
            this.player.doublerIndicator.position.set(0, indicatorHeight, 0);
            this.player.model.add(this.player.doublerIndicator);
        }
    }

    removeDoublerEffect() {
        logger.info(`Removing doubler powerup visual effect from player`);
        this.player.model.traverse(child => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
            }
        });

        if (this.player.doublerIndicator) {
            this.player.model.remove(this.player.doublerIndicator);
            this.player.doublerIndicator.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.player.doublerIndicator = null;
        }
    }

    applyInvisibilityEffect() {
        logger.info(`Applying invisibility powerup visual effect to player`);
        const invisibilityMaterial = new THREE.MeshStandardMaterial({
            color: gameplayConfig.INVISIBILITY_EFFECT_COLOR,
            emissive: gameplayConfig.INVISIBILITY_EFFECT_EMISSIVE,
            metalness: gameplayConfig.INVISIBILITY_EFFECT_METALNESS,
            roughness: gameplayConfig.INVISIBILITY_EFFECT_ROUGHNESS,
            transparent: true,
            opacity: gameplayConfig.INVISIBILITY_EFFECT_OPACITY
        });

        this.player.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                child.material = invisibilityMaterial;
            }
        });
    }

    removeInvisibilityEffect() {
        logger.info(`Removing invisibility powerup visual effect from player`);
        this.player.model.traverse(child => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
            }
        });

        if (this.player.invisibilityIndicator) {
            this.player.model.remove(this.player.invisibilityIndicator);
            this.player.invisibilityIndicator.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.player.invisibilityIndicator = null;
        }

        if (this.player.invisibilityEffect) {
            this.player.model.remove(this.player.invisibilityEffect);
            this.player.invisibilityEffect.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.player.invisibilityEffect = null;
            if (this.player.invisibilityEffectUpdateHandler) {
                eventBus.unsubscribe('gameLoopUpdate', this.player.invisibilityEffectUpdateHandler);
                this.player.invisibilityEffectUpdateHandler = null;
            }
        }
    }
}

const powerupEffectManager = new PowerupEffectManager();
export default powerupEffectManager;