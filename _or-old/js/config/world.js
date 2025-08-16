import { getConfig } from './config.js'; // Import the getConfig helper
import configManager from '../utils/configManager.js'; // Import configManager

const DEFAULT_RENDER_DISTANCE_CHUNKS = 3;
const DEFAULT_MAX_OBJECTS_PER_CHUNK = 20;

export const worldConfig = {
    SEED: 'open-runner-seed',
    CHUNK_SIZE: 100,
    get RENDER_DISTANCE_CHUNKS() {
        if (!configManager.isInitialized()) {
            return DEFAULT_RENDER_DISTANCE_CHUNKS;
        }
        return getConfig('world.RENDER_DISTANCE_CHUNKS', DEFAULT_RENDER_DISTANCE_CHUNKS);
    },
    GRID_CELL_SIZE: 25,
    PLAYER_SPAWN_SAFE_RADIUS: 20,
    get MAX_OBJECTS_PER_CHUNK() {
        if (!configManager.isInitialized()) {
            return DEFAULT_MAX_OBJECTS_PER_CHUNK;
        }
        return getConfig('world.MAX_OBJECTS_PER_CHUNK', DEFAULT_MAX_OBJECTS_PER_CHUNK);
    }
};