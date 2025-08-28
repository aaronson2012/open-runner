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
  private lastUpdateCenter = new Vector3(Number.NaN, 0, Number.NaN);

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

    // Throttle updates if still within the same chunk; prevents thrashing
    const curCX = Math.floor(position.x / chunkSize);
    const curCZ = Math.floor(position.z / chunkSize);
    const lastCX = Math.floor(this.lastUpdateCenter.x / chunkSize);
    const lastCZ = Math.floor(this.lastUpdateCenter.z / chunkSize);
    if (curCX === lastCX && curCZ === lastCZ) {
      return;
    }
    this.lastUpdateCenter.set(position.x, 0, position.z);

    const centerX = curCX;
    const centerZ = curCZ;

    // Safety margin of +1 chunk to avoid flicker at the edge while moving
    const radius = viewDistanceChunks + 1;

    const needed = new Set<string>();
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
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


