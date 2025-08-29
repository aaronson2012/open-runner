import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { HeightFunction } from './noise';

export interface InfiniteTerrainOptions {
  size: number; // world size of the mesh (length on X and Z)
  segments: number; // quads per edge
}

export class InfiniteTerrain {
  public readonly mesh: Mesh;

  private readonly scene: Scene;
  private readonly heightFn: HeightFunction;
  private readonly options: InfiniteTerrainOptions;
  private readonly step: number;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly uvs: Float32Array;
  private readonly indices: Uint16Array;
  private lastAnchorX = Number.NaN;
  private lastAnchorZ = Number.NaN;

  constructor(scene: Scene, heightFn: HeightFunction, options: InfiniteTerrainOptions) {
    this.scene = scene;
    this.heightFn = heightFn;
    this.options = options;
    this.step = options.size / options.segments;

    const vertsPerEdge = options.segments + 1;
    const vertexCount = vertsPerEdge * vertsPerEdge;
    this.positions = new Float32Array(vertexCount * 3);
    this.normals = new Float32Array(vertexCount * 3);
    this.uvs = new Float32Array(vertexCount * 2);
    this.indices = new Uint16Array(options.segments * options.segments * 6);

    // Static local XZ grid centered around origin
    let p = 0, uv = 0;
    const half = options.size * 0.5;
    for (let j = 0; j < vertsPerEdge; j++) {
      const zLocal = j * this.step - half;
      const v = j / options.segments;
      for (let i = 0; i < vertsPerEdge; i++) {
        const xLocal = i * this.step - half;
        const u = i / options.segments;
        this.positions[p++] = xLocal;
        this.positions[p++] = 0; // y filled during update
        this.positions[p++] = zLocal;

        this.uvs[uv++] = u;
        this.uvs[uv++] = v;
      }
    }

    // Indices (clockwise winding for Babylon left-handed)
    let ii = 0;
    for (let j = 0; j < options.segments; j++) {
      for (let i = 0; i < options.segments; i++) {
        const i0 = j * vertsPerEdge + i;
        const i1 = i0 + 1;
        const i2 = i0 + vertsPerEdge;
        const i3 = i2 + 1;
        this.indices[ii++] = i0; this.indices[ii++] = i1; this.indices[ii++] = i2;
        this.indices[ii++] = i1; this.indices[ii++] = i3; this.indices[ii++] = i2;
      }
    }

    const mat = new StandardMaterial('terrain_unlit', scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(0.34, 0.52, 0.36);
    mat.useLogarithmicDepth = true;

    this.mesh = new Mesh('infinite_terrain', scene);
    const vd = new VertexData();
    vd.positions = Array.from(this.positions);
    vd.indices = Array.from(this.indices);
    vd.uvs = Array.from(this.uvs);
    VertexData.ComputeNormals(vd.positions, vd.indices, this.normals);
    vd.normals = Array.from(this.normals);
    vd.applyToMesh(this.mesh, true);
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.mesh.checkCollisions = false;
  }

  update(center: Vector3): void {
    const anchorX = Math.floor(center.x / this.step) * this.step;
    const anchorZ = Math.floor(center.z / this.step) * this.step;
    if (anchorX === this.lastAnchorX && anchorZ === this.lastAnchorZ) return;
    this.lastAnchorX = anchorX;
    this.lastAnchorZ = anchorZ;

    const vertsPerEdge = this.options.segments + 1;
    const half = this.options.size * 0.5;

    // Update Y from world-space samples (anchor + local)
    for (let j = 0; j < vertsPerEdge; j++) {
      const zLocal = j * this.step - half;
      const worldZ = anchorZ + zLocal;
      for (let i = 0; i < vertsPerEdge; i++) {
        const xLocal = i * this.step - half;
        const worldX = anchorX + xLocal;
        const idx = (j * vertsPerEdge + i) * 3 + 1; // y index
        this.positions[idx] = this.heightFn(worldX, worldZ);
      }
    }

    // Recompute normals
    VertexData.ComputeNormals(this.positions, this.indices, this.normals);

    // Push to GPU
    this.mesh.updateVerticesData('position', this.positions, true, false);
    this.mesh.updateVerticesData('normal', this.normals, true, false);
  }
}


