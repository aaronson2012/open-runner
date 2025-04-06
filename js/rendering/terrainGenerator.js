// js/rendering/terrainGenerator.js
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise'; // Use createNoise2D for 2D noise
import { performanceManager } from '../config/config.js'; // Re-export from config.js
import { worldConfig } from '../config/world.js';
import { terrainConfig } from '../config/terrain.js';






// Initialize the noise function with the seed
const noise2D = createNoise2D(() => {
    // This function provides the seed. Using a simple string hash for reproducibility.
    // A more robust seeding mechanism might be needed for complex scenarios.
    let h = 0;
    for (let i = 0; i < worldConfig.SEED.length; i++) {
        h = (h << 5) - h + worldConfig.SEED.charCodeAt(i);
        h |= 0; // Convert to 32bit integer
    }
    return h / 0x80000000; // Normalize to range expected by simplex-noise if needed
});

// Export the noise function so other modules can calculate terrain height
export { noise2D };

// Renamed function to generate a single chunk at specific coordinates
export function createTerrainChunk(chunkX, chunkZ, levelConfig) { // Added levelConfig parameter

    // Calculate world offset for this chunk
    const offsetX = chunkX * worldConfig.CHUNK_SIZE;
    const offsetZ = chunkZ * worldConfig.CHUNK_SIZE;

    // Calculate distance from player's current chunk (assumed to be at 0,0 if not provided)
    // This is used for level of detail (LOD) - further chunks get less detail
    const distanceFromPlayer = Math.sqrt(chunkX * chunkX + chunkZ * chunkZ);

    // Apply level of detail based on distance and performance settings
    // Chunks further away get progressively less detail
    let segmentsX = terrainConfig.SEGMENTS_X;
    let segmentsY = terrainConfig.SEGMENTS_Y;

    // Apply distance-based LOD only if not in ultra quality mode
    // IMPORTANT: To avoid visible seams, we use a step function instead of continuous LOD
    // This ensures adjacent chunks have the same LOD level
    if (performanceManager.currentQuality !== 'ultra') {
        // Use distance bands to ensure adjacent chunks have the same LOD
        // Round to the nearest band to avoid seams between chunks
        const lodBand = Math.floor(distanceFromPlayer / 2) * 2;

        if (lodBand >= 4) {
            // Far chunks (band 4+) - lowest detail
            segmentsX = Math.max(20, Math.floor(terrainConfig.SEGMENTS_X * 0.5));
            segmentsY = Math.max(20, Math.floor(terrainConfig.SEGMENTS_Y * 0.5));
        } else if (lodBand >= 2) {
            // Medium distance chunks (band 2-3) - medium detail
            segmentsX = Math.max(30, Math.floor(terrainConfig.SEGMENTS_X * 0.75));
            segmentsY = Math.max(30, Math.floor(terrainConfig.SEGMENTS_Y * 0.75));
        }

        // Ensure segments are even numbers to avoid seams
        segmentsX = Math.floor(segmentsX / 2) * 2;
        segmentsY = Math.floor(segmentsY / 2) * 2;
    }

    const geometry = new THREE.PlaneGeometry(
        worldConfig.CHUNK_SIZE, // Use CHUNK_SIZE for geometry dimensions
        worldConfig.CHUNK_SIZE,
        segmentsX,
        segmentsY
    );

    // Rotate the plane to be horizontal (XZ plane)
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();
for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);

        // Calculate noise based on vertex's WORLD X and Z coordinates for seamless chunks
        const worldX = vertex.x + offsetX;
        const worldZ = vertex.z + offsetZ;
        const noiseVal = noise2D(worldX * levelConfig.NOISE_FREQUENCY, worldZ * levelConfig.NOISE_FREQUENCY);

        // Apply noise to the Y coordinate (height)
        positions.setY(i, noiseVal * levelConfig.NOISE_AMPLITUDE);
    } // Corrected closing brace for the loop started on line 79

    // Important: Notify Three.js that the positions have changed
    positions.needsUpdate = true;

    // Calculate normals for proper lighting
    geometry.computeVertexNormals();
// Basic green material
    const material = new THREE.MeshStandardMaterial({
        color: levelConfig.TERRAIN_COLOR, // Use color from level config
        wireframe: false, // Set to true to see the geometry structure
        side: THREE.DoubleSide // Render both sides, useful for debugging camera position
    });
const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.name = `TerrainChunk_${chunkX}_${chunkZ}`; // Assign a unique name

    // Position the chunk correctly in the world
    terrainMesh.position.set(offsetX, 0, offsetZ);
return terrainMesh;
}