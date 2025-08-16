// js/rendering/modelFactory.js
// This file acts as a central export point for model creation functions.

import { createLogger } from '../utils/logger.js';

// Import and re-export from the specialized model files
export * from './models/animalModels.js';
export * from './models/sceneryModels.js';
export * from './models/itemModels.js';
// Note: modelUtils.js contains internal helpers and is not exported from here.

const logger = createLogger('ModelFactory');
logger.info("ModelFactory module loaded, exporting model creation functions.");

// No actual functions defined here anymore, just re-exports.
