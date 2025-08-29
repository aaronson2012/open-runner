import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Material } from '@babylonjs/core/Materials/material';
import type { HeightFunction } from './noise';

export interface TerrainChunkParams {
  scene: Scene;
  chunkX: number; // grid coord
  chunkZ: number; // grid coord
  chunkSize: number; // world units
  segments: number; // quads per edge
  heightFn: HeightFunction;
  material: Material;
}

export class TerrainChunk {
  public readonly key: string;
  public readonly chunkX: number;
  public readonly chunkZ: number;
  public readonly mesh: Mesh;

  private readonly chunkSize: number;
  private readonly segments: number;
  private readonly heightFn: HeightFunction;

  constructor(params: TerrainChunkParams) {
    this.chunkX = params.chunkX;
    this.chunkZ = params.chunkZ;
    this.chunkSize = params.chunkSize;
    this.segments = params.segments;
    this.heightFn = params.heightFn;
    this.key = `${this.chunkX},${this.chunkZ}`;

    this.mesh = this.buildMesh(params.scene, params.material);
  }

  dispose(): void {
    this.mesh.dispose(false, true);
  }

  private buildMesh(scene: Scene, material: Material): Mesh {
    const segments = this.segments;
    const chunkSize = this.chunkSize;

    const vertexCountPerEdge = segments + 1;
    const vertexCount = vertexCountPerEdge * vertexCountPerEdge;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    // Use 16-bit indices for broad WebGL1 compatibility (we are well under 65k)
    const indices = new Uint16Array(segments * segments * 6);

    const x0 = this.chunkX * chunkSize; // world offset
    const z0 = this.chunkZ * chunkSize; // world offset
    const step = chunkSize / segments;
    const delta = step; // for normal sampling

    // Generate positions, uvs, and analytic normals from height function
    let pOffset = 0;
    let nOffset = 0;
    let uvOffset = 0;
    for (let j = 0; j < vertexCountPerEdge; j++) {
      const z = z0 + j * step;
      const v = j / segments;
      for (let i = 0; i < vertexCountPerEdge; i++) {
        const xLocal = i * step;
        const xWorld = x0 + xLocal;
        const u = i / segments;

        const y = this.heightFn(xWorld, z);

        positions[pOffset++] = xLocal;
        positions[pOffset++] = y;
        positions[pOffset++] = j * step;

        uvs[uvOffset++] = u;
        uvs[uvOffset++] = v;

        // Placeholder; filled by ComputeNormals below
        normals[nOffset++] = 0;
        normals[nOffset++] = 1;
        normals[nOffset++] = 0;
      }
    }

    // Generate indices (two triangles per quad)
    let idx = 0;
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const i0 = j * vertexCountPerEdge + i;
        const i1 = i0 + 1;
        const i2 = i0 + vertexCountPerEdge;
        const i3 = i2 + 1;

        // For Babylon's default left-handed system, use clockwise winding
        // Triangle 1
        indices[idx++] = i0;
        indices[idx++] = i1;
        indices[idx++] = i2;
        // Triangle 2
        indices[idx++] = i1;
        indices[idx++] = i3;
        indices[idx++] = i2;
      }
    }

    const mesh = new Mesh(`terrain_${this.key}`, scene);
    const vd = new VertexData();
    vd.positions = Array.from(positions);
    vd.indices = Array.from(indices);
    vd.uvs = Array.from(uvs);
    // Compute smooth normals from geometry for stable lighting
    VertexData.ComputeNormals(vd.positions, vd.indices, normals);
    vd.normals = Array.from(normals);
    vd.applyToMesh(mesh, true);

    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.checkCollisions = false;
    mesh.material = material;
    // Place the chunk at its world offset; vertices stay in local space
    mesh.position = new Vector3(x0, 0, z0);

    return mesh;
  }
}


