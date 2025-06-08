import performanceManager from '../utils/performanceManager.js';
export const terrainConfig = {
    SEGMENTS_X: performanceManager.getSettings().terrainSegments,
    SEGMENTS_Y: performanceManager.getSettings().terrainSegments,
    LOD_LEVELS: [
        { distance: 4, segments: 32 },   // Highest detail for chunks within 4 units
        { distance: 8, segments: 16 },   // Medium detail
        { distance: 16, segments: 8 },  // Low detail
        { distance: 32, segments: 4 }    // Lowest detail for chunks at a distance
    ]
};