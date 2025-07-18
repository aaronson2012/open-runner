// WARNING: performanceManager must be initialized before importing this config for correct values.
import performanceManager from '../utils/performanceManager.js';
export const terrainConfig = {
    SEGMENTS_X: performanceManager.getSettings().terrainSegments,
    SEGMENTS_Y: performanceManager.getSettings().terrainSegments,
    LOD_LEVELS: [
        { distance: 3, segments: 32 },   // Highest detail for immediate chunks (reduced from 4)
        { distance: 6, segments: 16 },   // Medium detail (reduced from 8)
        { distance: 12, segments: 8 },   // Low detail (reduced from 16)
        { distance: 24, segments: 4 }    // Lowest detail (reduced from 32)
    ]
};