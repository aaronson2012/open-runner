import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { HeightFunction } from './noise';
import { TerrainChunk } from './chunk';

export interface TerrainManagerOptions {
  chunkSize: number; // world units
  segments: number; // quads per edge for each chunk
  viewDistanceChunks: number; // radius in chunks
}

export class TerrainManager {
  private readonly scene: Scene;
  private readonly heightFn: HeightFunction;
  private readonly options: TerrainManagerOptions;
  private readonly chunkMaterial: StandardMaterial;
  private readonly chunks = new Map<string, TerrainChunk>();

  constructor(scene: Scene, heightFn: HeightFunction, options: TerrainManagerOptions) {
    this.scene = scene;
    this.heightFn = heightFn;
    this.options = options;
    this.chunkMaterial = new StandardMaterial('terrain_mat', scene);
    this.chunkMaterial.diffuseColor = new Color3(0.34, 0.52, 0.36);
    this.chunkMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
    // Render both sides to avoid disappearing triangles if winding is off
    this.chunkMaterial.backFaceCulling = false;
    this.chunkMaterial.freeze();
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunkMaterial.dispose();
    this.chunks.clear();
  }

  updateAroundPosition(position: Vector3): void {
    const { chunkSize, viewDistanceChunks } = this.options;
    const centerX = Math.floor(position.x / chunkSize);
    const centerZ = Math.floor(position.z / chunkSize);

    const needed = new Set<string>();
    for (let dz = -viewDistanceChunks; dz <= viewDistanceChunks; dz++) {
      for (let dx = -viewDistanceChunks; dx <= viewDistanceChunks; dx++) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = `${cx},${cz}`;
        needed.add(key);
        if (!this.chunks.has(key)) {
          const chunk = new TerrainChunk({
            scene: this.scene,
            chunkX: cx,
            chunkZ: cz,
            chunkSize: this.options.chunkSize,
            segments: this.options.segments,
            heightFn: this.heightFn,
            material: this.chunkMaterial,
          });
          this.chunks.set(key, chunk);
        }
      }
    }

    // Unload chunks that are no longer needed
    for (const [key, chunk] of Array.from(this.chunks.entries())) {
      if (!needed.has(key)) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }
}


