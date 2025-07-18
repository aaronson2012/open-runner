import performanceManager from '../utils/performanceManager.js';
export const worldConfig = {
    SEED: 'open-runner-seed',
    CHUNK_SIZE: 100,
    RENDER_DISTANCE_CHUNKS: performanceManager.getSettings().renderDistance,
    GRID_CELL_SIZE: 25,
    PLAYER_SPAWN_SAFE_RADIUS: 20,
    MAX_OBJECTS_PER_CHUNK: performanceManager.getSettings().maxObjectsPerChunk
};