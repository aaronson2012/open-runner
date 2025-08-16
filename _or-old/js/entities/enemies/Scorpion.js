import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';
import { enemyDefaultsConfig } from '../../config/enemyDefaults.js';

const groundRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
const _rayOrigin = new THREE.Vector3();

export class Scorpion extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createScorpionModel(this);
    }

    _updateAnimation(elapsedTime, isMoving, currentSpeed) {
    }

     _updateGrounding() {
        if (!this.mesh || !this.chunkManager) return;
        const currentPosition = this.mesh.position;
        _rayOrigin.set(currentPosition.x, currentPosition.y + enemyDefaultsConfig.GROUNDING_OFFSET_SCORPION, currentPosition.z);
        groundRaycaster.set(_rayOrigin, downVector);
        const nearbyTerrain = this.chunkManager.getTerrainMeshesNear(currentPosition);
        const intersects = groundRaycaster.intersectObjects(nearbyTerrain);

        if (intersects.length > 0) {
            this.lastGroundY = intersects[0].point.y;
            const smoothFactor = enemyDefaultsConfig.GROUND_SMOOTHING_FACTOR;
            this.currentGroundY = this.currentGroundY * (1.0 - smoothFactor) + this.lastGroundY * smoothFactor;
            const modelHeight = enemyDefaultsConfig.GROUNDING_HEIGHT_SCORPION;
            this.mesh.position.y = this.currentGroundY + modelHeight / 2;
        } else {
             const modelHeight = enemyDefaultsConfig.GROUNDING_HEIGHT_SCORPION;
             this.mesh.position.y = this.currentGroundY + modelHeight / 2;
        }
    }
}