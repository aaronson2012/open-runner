import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';
import { enemyDefaultsConfig } from '../../config/enemyDefaults.js';

export class Rattlesnake extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createRattlesnakeModel(this);
    }

    update(playerPos, currentPowerup, deltaTime, elapsedTime) {
        if (!this.mesh || !this.chunkManager) return;

        this._updateGrounding(
            enemyDefaultsConfig.GROUNDING_OFFSET_SNAKE,
            enemyDefaultsConfig.GROUNDING_HEIGHT_SNAKE
        );

        this._updateState(playerPos, currentPowerup, deltaTime);
        const { isMoving, currentSpeed } = this._updateMovement(playerPos, deltaTime);
        this._updateAnimation(elapsedTime, isMoving, currentSpeed);
    }

    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
        // Specific animation for snake can be added here.
    }
}