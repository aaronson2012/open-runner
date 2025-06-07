// js/rendering/modelFactory.js
// This file acts as a central export point for model creation functions.

import { createLogger } from '../utils/logger.js';
import * as AssetManager from '../managers/assetManager.js';

// Import all model creation functions
import * as AnimalModels from './models/animalModels.js';
import * as SceneryModels from './models/sceneryModels.js';
import * as ItemModels from './models/itemModels.js';
import * as RobustTree from './models/robustTree.js';

const logger = createLogger('ModelFactory');

const allModelCreators = {
    ...AnimalModels,
    ...SceneryModels,
    ...ItemModels,
    ...RobustTree
};

// Register all creators with the AssetManager
AssetManager.registerModelCreators(allModelCreators);

logger.info("ModelFactory module loaded and model creators registered.");

// Re-export for any legacy direct usage if needed, though AssetManager should be the primary interface
export * from './models/animalModels.js';
export * from './models/sceneryModels.js';
export * from './models/itemModels.js';
export * from './models/robustTree.js';
