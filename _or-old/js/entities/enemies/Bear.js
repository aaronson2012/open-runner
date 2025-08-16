import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';

export class Bear extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createBearModel(this);
    }
}