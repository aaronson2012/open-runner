// js/rendering/terrainGenerator.js
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise'; // Use createNoise2D for 2D noise
import { performanceManager } from '../config/config.js'; // Re-export from config.js
import { worldConfig } from '../config/world.js';
import { terrainConfig } from '../config/terrain.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TerrainGenerator');






// Initialize the noise function with the seed
const noise2D = createNoise2D(() => {
    // This function provides the seed. Using a simple string hash for reproducibility.
    // A more robust seeding mechanism might be needed for complex scenarios.
    let h = 0;
    for (let i = 0; i < worldConfig.SEED.length; i++) {
        h = (h << 5) - h + worldConfig.SEED.charCodeAt(i);
        h |= 0; // Convert to 32bit integer
    }
    return h / 0x80000000;
});

// Export the noise function so other modules can calculate terrain height
export { noise2D };

// Renamed function to generate a single chunk at specific coordinates
export function createTerrainChunk(chunkX, chunkZ, levelConfig, lod, neighborLODs) {

    // Calculate world offset for this chunk
    const offsetX = chunkX * worldConfig.CHUNK_SIZE;
    const offsetZ = chunkZ * worldConfig.CHUNK_SIZE;

    let segmentsX, segmentsY;

    // Fail-safe: If LOD is invalid, default to highest quality and log an error.
    if (typeof lod !== 'number' || lod <= 0) {
        logger.error(`Invalid LOD provided for chunk ${chunkX},${chunkZ}. Received: ${lod}. Defaulting to max detail.`);
        segmentsX = terrainConfig.LOD_LEVELS[0].segments;
        segmentsY = terrainConfig.LOD_LEVELS[0].segments;
    } else {
        segmentsX = lod;
        segmentsY = lod;
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
    }

    stitchTerrainEdges(geometry, lod, neighborLODs, { x: chunkX, z: chunkZ }, levelConfig);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: levelConfig.TERRAIN_COLOR, // Use color from level config
        wireframe: false,
        side: THREE.DoubleSide
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.name = `TerrainChunk_${chunkX}_${chunkZ}`; // Assign a unique name

    // Position the chunk correctly in the world
    terrainMesh.position.set(offsetX, 0, offsetZ);
    
    return terrainMesh;
}

function stitchTerrainEdges(geometry, currentLOD, neighborLODs, chunkCoords, levelConfig) {
    const positions = geometry.attributes.position;
    const segments = currentLOD;
    const halfSize = worldConfig.CHUNK_SIZE / 2;

    const stitchEdge = (neighborLOD, edge) => {
        if (currentLOD <= neighborLOD) return;

        const ratio = neighborLOD / currentLOD;
        for (let i = 0; i <= segments; i++) {
            if (i % (1 / ratio) === 0) continue;

            let x, z;
            let index;

            switch (edge) {
                case 'north':
                    x = -halfSize + i * (worldConfig.CHUNK_SIZE / segments);
                    z = -halfSize;
                    index = i;
                    break;
                case 'south':
                    x = -halfSize + i * (worldConfig.CHUNK_SIZE / segments);
                    z = halfSize;
                    index = segments * (segments + 1) + i;
                    break;
                case 'east':
                    x = halfSize;
                    z = -halfSize + i * (worldConfig.CHUNK_SIZE / segments);
                    index = (i + 1) * (segments + 1) - 1;
                    break;
                case 'west':
                    x = -halfSize;
                    z = -halfSize + i * (worldConfig.CHUNK_SIZE / segments);
                    index = i * (segments + 1);
                    break;
            }

            const worldX = x + chunkCoords.x * worldConfig.CHUNK_SIZE;
            const worldZ = z + chunkCoords.z * worldConfig.CHUNK_SIZE;
            const noiseVal = noise2D(worldX * levelConfig.NOISE_FREQUENCY, worldZ * levelConfig.NOISE_FREQUENCY);
            positions.setY(index, noiseVal * levelConfig.NOISE_AMPLITUDE);
        }
    };

    stitchEdge(neighborLODs.north, 'north');
    stitchEdge(neighborLODs.south, 'south');
    stitchEdge(neighborLODs.east, 'east');
    stitchEdge(neighborLODs.west, 'west');
}