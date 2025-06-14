import { Enemy } from '../enemy.js';
import * as ModelFactory from '../../rendering/modelFactory.js';

/**
 * Generic enemy classes for each type
 */
export class Bear extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createBearModel(this);
    }
}

export class Coyote extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createCoyoteModel(this);
    }
}

export class Deer extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createDeerModel(this);
    }
}

export class Squirrel extends Enemy {
    constructor(initialData, properties, scene, chunkManager) {
        super(initialData, properties, scene, chunkManager);
    }

    createMesh() {
        return ModelFactory.createSquirrelModel(this);
    }
}