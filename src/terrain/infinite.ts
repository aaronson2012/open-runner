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
  private readonly size: number;
  private readonly half: number;
  private readonly vertsPerEdge: number;
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
    this.size = options.size;
    this.step = options.size / options.segments;
    this.vertsPerEdge = options.segments + 1;
    this.half = options.size * 0.5;

    const vertexCount = this.vertsPerEdge * this.vertsPerEdge;
    this.positions = new Float32Array(vertexCount * 3);
    this.normals = new Float32Array(vertexCount * 3);
    this.uvs = new Float32Array(vertexCount * 2);
    this.indices = new Uint16Array(options.segments * options.segments * 6);

    // Static local XZ grid centered around origin
    let p = 0, uv = 0;
    for (let j = 0; j < this.vertsPerEdge; j++) {
      const zLocal = j * this.step - this.half;
      const v = j / options.segments;
      for (let i = 0; i < this.vertsPerEdge; i++) {
        const xLocal = i * this.step - this.half;
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
        const i0 = j * this.vertsPerEdge + i;
        const i1 = i0 + 1;
        const i2 = i0 + this.vertsPerEdge;
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
    // Snap anchor to grid to keep vertices stationary in local space
    let targetAnchorX = Math.floor(center.x / this.step) * this.step;
    let targetAnchorZ = Math.floor(center.z / this.step) * this.step;

    if (Number.isNaN(this.lastAnchorX)) {
      // Initial populate of all heights
      for (let j = 0; j < this.vertsPerEdge; j++) {
        const zLocal = j * this.step - this.half;
        const worldZ = targetAnchorZ + zLocal;
        for (let i = 0; i < this.vertsPerEdge; i++) {
          const xLocal = i * this.step - this.half;
          const worldX = targetAnchorX + xLocal;
          const idx = (j * this.vertsPerEdge + i) * 3 + 1;
          this.positions[idx] = this.heightFn(worldX, worldZ);
        }
      }
      this.lastAnchorX = targetAnchorX;
      this.lastAnchorZ = targetAnchorZ;
      this.mesh.updateVerticesData('position', this.positions, true, false);
      // Align mesh so local grid is centered relative to the camera's fractional position
      this.mesh.position.x = this.lastAnchorX - center.x;
      this.mesh.position.z = this.lastAnchorZ - center.z;
      return;
    }

    // Scroll in X by whole steps
    let dxSteps = Math.round((targetAnchorX - this.lastAnchorX) / this.step);
    while (dxSteps !== 0) {
      const stepSign = dxSteps > 0 ? 1 : -1;
      const newAnchorX = this.lastAnchorX + stepSign * this.step;
      if (stepSign > 0) {
        // shift left; fill last column
        for (let j = 0; j < this.vertsPerEdge; j++) {
          const rowStart = j * this.vertsPerEdge;
          // shift
          for (let i = 0; i < this.vertsPerEdge - 1; i++) {
            const dst = (rowStart + i) * 3 + 1;
            const src = (rowStart + i + 1) * 3 + 1;
            this.positions[dst] = this.positions[src];
          }
          // new last column
          const iLast = this.vertsPerEdge - 1;
          const zLocal = j * this.step - this.half;
          const worldZ = this.lastAnchorZ + zLocal;
          const xLocal = iLast * this.step - this.half;
          const worldX = newAnchorX + xLocal;
          const idxY = (rowStart + iLast) * 3 + 1;
          this.positions[idxY] = this.heightFn(worldX, worldZ);
        }
      } else {
        // shift right; fill first column
        for (let j = 0; j < this.vertsPerEdge; j++) {
          const rowStart = j * this.vertsPerEdge;
          for (let i = this.vertsPerEdge - 1; i > 0; i--) {
            const dst = (rowStart + i) * 3 + 1;
            const src = (rowStart + i - 1) * 3 + 1;
            this.positions[dst] = this.positions[src];
          }
          const iFirst = 0;
          const zLocal = j * this.step - this.half;
          const worldZ = this.lastAnchorZ + zLocal;
          const xLocal = iFirst * this.step - this.half;
          const worldX = newAnchorX + xLocal;
          const idxY = (rowStart + iFirst) * 3 + 1;
          this.positions[idxY] = this.heightFn(worldX, worldZ);
        }
      }
      this.lastAnchorX = newAnchorX;
      dxSteps -= stepSign;
    }

    // Scroll in Z by whole steps
    let dzSteps = Math.round((targetAnchorZ - this.lastAnchorZ) / this.step);
    while (dzSteps !== 0) {
      const stepSign = dzSteps > 0 ? 1 : -1;
      const newAnchorZ = this.lastAnchorZ + stepSign * this.step;
      if (stepSign > 0) {
        // shift up (towards -z to +z depends on convention); move rows and fill last row
        for (let j = 0; j < this.vertsPerEdge - 1; j++) {
          for (let i = 0; i < this.vertsPerEdge; i++) {
            const dst = (j * this.vertsPerEdge + i) * 3 + 1;
            const src = ((j + 1) * this.vertsPerEdge + i) * 3 + 1;
            this.positions[dst] = this.positions[src];
          }
        }
        const jLast = this.vertsPerEdge - 1;
        const zLocal = jLast * this.step - this.half;
        const worldZ = newAnchorZ + zLocal;
        for (let i = 0; i < this.vertsPerEdge; i++) {
          const xLocal = i * this.step - this.half;
          const worldX = this.lastAnchorX + xLocal;
          const idxY = (jLast * this.vertsPerEdge + i) * 3 + 1;
          this.positions[idxY] = this.heightFn(worldX, worldZ);
        }
      } else {
        // shift down; move rows backwards and fill first row
        for (let j = this.vertsPerEdge - 1; j > 0; j--) {
          for (let i = 0; i < this.vertsPerEdge; i++) {
            const dst = (j * this.vertsPerEdge + i) * 3 + 1;
            const src = ((j - 1) * this.vertsPerEdge + i) * 3 + 1;
            this.positions[dst] = this.positions[src];
          }
        }
        const jFirst = 0;
        const zLocal = jFirst * this.step - this.half;
        const worldZ = newAnchorZ + zLocal;
        for (let i = 0; i < this.vertsPerEdge; i++) {
          const xLocal = i * this.step - this.half;
          const worldX = this.lastAnchorX + xLocal;
          const idxY = (jFirst * this.vertsPerEdge + i) * 3 + 1;
          this.positions[idxY] = this.heightFn(worldX, worldZ);
        }
      }
      this.lastAnchorZ = newAnchorZ;
      dzSteps -= stepSign;
    }

    // Push to GPU (normals not needed; material is unlit)
    this.mesh.updateVerticesData('position', this.positions, true, false);
    // Keep the mesh aligned with the camera's fractional offset
    this.mesh.position.x = this.lastAnchorX - center.x;
    this.mesh.position.z = this.lastAnchorZ - center.z;
  }
}


