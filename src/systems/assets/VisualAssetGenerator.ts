// Visual Asset Generation System for Open Runner
import { ModelAsset, TextureAsset, BoundingBox } from '../../types/assets/AssetTypes';

interface GeneratedModel {
  vertices: Float32Array;
  indices: Uint16Array;
  normals: Float32Array;
  uvs: Float32Array;
  boundingBox: BoundingBox;
}

interface TextureData {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export class VisualAssetGenerator {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private generatedModels = new Map<string, GeneratedModel>();
  private generatedTextures = new Map<string, TextureData>();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d')!;
  }

  // Character model generation
  generatePlayerModel(): GeneratedModel {
    const cacheKey = 'player_character';
    if (this.generatedModels.has(cacheKey)) {
      return this.generatedModels.get(cacheKey)!;
    }

    // Simple capsule-like player character
    const model = this.generateCapsule(0.3, 1.8, 8, 16);
    this.generatedModels.set(cacheKey, model);
    return model;
  }

  generateEnemyModel(type: string): GeneratedModel {
    const cacheKey = `enemy_${type}`;
    if (this.generatedModels.has(cacheKey)) {
      return this.generatedModels.get(cacheKey)!;
    }

    let model: GeneratedModel;

    switch (type) {
      case 'bear':
        model = this.generateBear();
        break;
      case 'squirrel':
        model = this.generateSquirrel();
        break;
      case 'deer':
        model = this.generateDeer();
        break;
      case 'coyote':
        model = this.generateCoyote();
        break;
      case 'snake':
        model = this.generateSnake();
        break;
      case 'scorpion':
        model = this.generateScorpion();
        break;
      default:
        model = this.generateGenericEnemy();
    }

    this.generatedModels.set(cacheKey, model);
    return model;
  }

  private generateBear(): GeneratedModel {
    // Large, stocky body with rounded shape
    const body = this.generateEllipsoid(0.8, 1.2, 0.6);
    const head = this.generateSphere(0.4, 8);
    
    // Combine body and head
    return this.combineModels([
      { model: body, offset: [0, 0, 0] },
      { model: head, offset: [0, 1.4, 0] }
    ]);
  }

  private generateSquirrel(): GeneratedModel {
    // Small, agile body
    const body = this.generateEllipsoid(0.2, 0.4, 0.15);
    const head = this.generateSphere(0.15, 6);
    const tail = this.generateCylinder(0.05, 0.6, 6);
    
    return this.combineModels([
      { model: body, offset: [0, 0, 0] },
      { model: head, offset: [0, 0.5, 0] },
      { model: tail, offset: [0, 0.2, -0.4] }
    ]);
  }

  private generateDeer(): GeneratedModel {
    // Elegant, tall body
    const body = this.generateEllipsoid(0.4, 0.8, 0.3);
    const head = this.generateEllipsoid(0.25, 0.35, 0.2);
    const legs = this.generateCylinder(0.08, 1.2, 4);
    
    return this.combineModels([
      { model: body, offset: [0, 1.2, 0] },
      { model: head, offset: [0, 2.2, 0.3] },
      { model: legs, offset: [0, 0, 0] }
    ]);
  }

  private generateCoyote(): GeneratedModel {
    // Medium-sized predator body
    const body = this.generateEllipsoid(0.5, 0.9, 0.35);
    const head = this.generateEllipsoid(0.3, 0.4, 0.25);
    
    return this.combineModels([
      { model: body, offset: [0, 0.8, 0] },
      { model: head, offset: [0, 1.4, 0.4] }
    ]);
  }

  private generateSnake(): GeneratedModel {
    // Long, segmented body
    const segments = 12;
    const segmentRadius = 0.1;
    const segmentLength = 0.3;
    
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    for (let i = 0; i < segments; i++) {
      const segment = this.generateCylinder(segmentRadius, segmentLength, 6);
      const offset = i * segmentLength;
      
      // Add segment vertices with sine wave motion
      const waveOffset = Math.sin(i * 0.5) * 0.2;
      this.addModelToArrays(segment, vertices, indices, normals, uvs, [waveOffset, 0, -offset]);
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      boundingBox: this.calculateBoundingBox(new Float32Array(vertices))
    };
  }

  private generateScorpion(): GeneratedModel {
    // Segmented body with claws and tail
    const body = this.generateEllipsoid(0.3, 0.2, 0.5);
    const tail = this.generateCylinder(0.08, 1.0, 6);
    const claws = this.generateEllipsoid(0.15, 0.1, 0.3);
    
    return this.combineModels([
      { model: body, offset: [0, 0, 0] },
      { model: tail, offset: [0, 0.3, -0.8] },
      { model: claws, offset: [-0.4, 0, 0.3] },
      { model: claws, offset: [0.4, 0, 0.3] }
    ]);
  }

  private generateGenericEnemy(): GeneratedModel {
    // Simple geometric enemy
    return this.generateCube(0.5);
  }

  // Primitive shape generators
  private generateCube(size: number): GeneratedModel {
    const s = size / 2;
    
    const vertices = new Float32Array([
      // Front face
      -s, -s,  s,  s, -s,  s,  s,  s,  s, -s,  s,  s,
      // Back face
      -s, -s, -s, -s,  s, -s,  s,  s, -s,  s, -s, -s,
      // Top face
      -s,  s, -s, -s,  s,  s,  s,  s,  s,  s,  s, -s,
      // Bottom face
      -s, -s, -s,  s, -s, -s,  s, -s,  s, -s, -s,  s,
      // Right face
       s, -s, -s,  s,  s, -s,  s,  s,  s,  s, -s,  s,
      // Left face
      -s, -s, -s, -s, -s,  s, -s,  s,  s, -s,  s, -s
    ]);

    const indices = new Uint16Array([
      0,  1,  2,    0,  2,  3,    // front
      4,  5,  6,    4,  6,  7,    // back
      8,  9,  10,   8,  10, 11,   // top
      12, 13, 14,   12, 14, 15,   // bottom
      16, 17, 18,   16, 18, 19,   // right
      20, 21, 22,   20, 22, 23    // left
    ]);

    const normals = this.generateNormals(vertices, indices);
    const uvs = this.generateUVs(vertices.length / 3);

    return {
      vertices,
      indices,
      normals,
      uvs,
      boundingBox: { min: [-s, -s, -s], max: [s, s, s] }
    };
  }

  private generateSphere(radius: number, segments: number): GeneratedModel {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    // Generate vertices
    for (let lat = 0; lat <= segments; lat++) {
      const theta = (lat * Math.PI) / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = (lon * 2 * Math.PI) / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        vertices.push(radius * x, radius * y, radius * z);
        normals.push(x, y, z);
        uvs.push(lon / segments, lat / segments);
      }
    }

    // Generate indices
    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = lat * (segments + 1) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      boundingBox: {
        min: [-radius, -radius, -radius],
        max: [radius, radius, radius]
      }
    };
  }

  private generateCylinder(radius: number, height: number, segments: number): GeneratedModel {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const halfHeight = height / 2;

    // Generate vertices for sides
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Top vertex
      vertices.push(x, halfHeight, z);
      normals.push(x / radius, 0, z / radius);
      uvs.push(i / segments, 1);

      // Bottom vertex
      vertices.push(x, -halfHeight, z);
      normals.push(x / radius, 0, z / radius);
      uvs.push(i / segments, 0);
    }

    // Generate side indices
    for (let i = 0; i < segments; i++) {
      const topIndex = i * 2;
      const bottomIndex = i * 2 + 1;
      const nextTopIndex = (i + 1) * 2;
      const nextBottomIndex = (i + 1) * 2 + 1;

      indices.push(topIndex, bottomIndex, nextTopIndex);
      indices.push(bottomIndex, nextBottomIndex, nextTopIndex);
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      boundingBox: {
        min: [-radius, -halfHeight, -radius],
        max: [radius, halfHeight, radius]
      }
    };
  }

  private generateEllipsoid(radiusX: number, radiusY: number, radiusZ: number): GeneratedModel {
    const segments = 12;
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let lat = 0; lat <= segments; lat++) {
      const theta = (lat * Math.PI) / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = (lon * 2 * Math.PI) / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = radiusX * cosPhi * sinTheta;
        const y = radiusY * cosTheta;
        const z = radiusZ * sinPhi * sinTheta;

        vertices.push(x, y, z);
        
        // Calculate normal
        const nx = (x / radiusX) / radiusX;
        const ny = (y / radiusY) / radiusY;
        const nz = (z / radiusZ) / radiusZ;
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        normals.push(nx / length, ny / length, nz / length);
        
        uvs.push(lon / segments, lat / segments);
      }
    }

    // Generate indices (same as sphere)
    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = lat * (segments + 1) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      boundingBox: {
        min: [-radiusX, -radiusY, -radiusZ],
        max: [radiusX, radiusY, radiusZ]
      }
    };
  }

  private generateCapsule(radius: number, height: number, segments: number, rings: number): GeneratedModel {
    const cylinder = this.generateCylinder(radius, height - 2 * radius, segments);
    const topSphere = this.generateSphere(radius, Math.floor(rings / 2));
    const bottomSphere = this.generateSphere(radius, Math.floor(rings / 2));

    return this.combineModels([
      { model: cylinder, offset: [0, 0, 0] },
      { model: topSphere, offset: [0, (height - 2 * radius) / 2, 0] },
      { model: bottomSphere, offset: [0, -(height - 2 * radius) / 2, 0] }
    ]);
  }

  private combineModels(models: { model: GeneratedModel; offset: [number, number, number] }[]): GeneratedModel {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    let vertexOffset = 0;

    for (const { model, offset } of models) {
      this.addModelToArrays(model, vertices, indices, normals, uvs, offset, vertexOffset);
      vertexOffset += model.vertices.length / 3;
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      boundingBox: this.calculateBoundingBox(new Float32Array(vertices))
    };
  }

  private addModelToArrays(
    model: GeneratedModel,
    vertices: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    offset: [number, number, number],
    indexOffset: number = 0
  ): void {
    // Add vertices with offset
    for (let i = 0; i < model.vertices.length; i += 3) {
      vertices.push(
        model.vertices[i] + offset[0],
        model.vertices[i + 1] + offset[1],
        model.vertices[i + 2] + offset[2]
      );
    }

    // Add indices with offset
    for (let i = 0; i < model.indices.length; i++) {
      indices.push(model.indices[i] + indexOffset);
    }

    // Add normals and UVs as-is
    normals.push(...Array.from(model.normals));
    uvs.push(...Array.from(model.uvs));
  }

  private generateNormals(vertices: Float32Array, indices: Uint16Array): Float32Array {
    const normals = new Float32Array(vertices.length);
    
    // Calculate face normals
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;

      // Get triangle vertices
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];

      // Calculate face normal
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      
      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];

      // Normalize
      const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      if (length > 0) {
        normal[0] /= length;
        normal[1] /= length;
        normal[2] /= length;
      }

      // Add to vertex normals
      normals[i1] += normal[0];
      normals[i1 + 1] += normal[1];
      normals[i1 + 2] += normal[2];
      
      normals[i2] += normal[0];
      normals[i2 + 1] += normal[1];
      normals[i2 + 2] += normal[2];
      
      normals[i3] += normal[0];
      normals[i3 + 1] += normal[1];
      normals[i3 + 2] += normal[2];
    }

    // Normalize vertex normals
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.sqrt(
        normals[i] * normals[i] +
        normals[i + 1] * normals[i + 1] +
        normals[i + 2] * normals[i + 2]
      );
      
      if (length > 0) {
        normals[i] /= length;
        normals[i + 1] /= length;
        normals[i + 2] /= length;
      }
    }

    return normals;
  }

  private generateUVs(vertexCount: number): Float32Array {
    const uvs = new Float32Array(vertexCount * 2);
    
    // Simple planar mapping
    for (let i = 0; i < vertexCount; i++) {
      uvs[i * 2] = (i % 4) / 3;     // u coordinate
      uvs[i * 2 + 1] = Math.floor(i / 4) / 3; // v coordinate
    }

    return uvs;
  }

  private calculateBoundingBox(vertices: Float32Array): BoundingBox {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    };
  }

  // Texture generation methods
  generateTexture(id: string, width: number, height: number, generator: (ctx: CanvasRenderingContext2D) => void): TextureData {
    if (this.generatedTextures.has(id)) {
      return this.generatedTextures.get(id)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;

    generator(context);

    const textureData: TextureData = {
      canvas,
      context,
      width,
      height
    };

    this.generatedTextures.set(id, textureData);
    return textureData;
  }

  generateForestTexture(): TextureData {
    return this.generateTexture('forest_ground', 512, 512, (ctx) => {
      // Forest floor texture
      ctx.fillStyle = '#3a5f3a';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add some variation
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 20 + 5;
        
        ctx.fillStyle = `hsla(${Math.random() * 60 + 90}, 30%, ${Math.random() * 20 + 20}%, 0.5)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  generateDesertTexture(): TextureData {
    return this.generateTexture('desert_sand', 512, 512, (ctx) => {
      // Desert sand texture
      ctx.fillStyle = '#d4b896';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add sand ripples
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const width = Math.random() * 100 + 50;
        const height = Math.random() * 10 + 2;
        
        ctx.fillStyle = `rgba(${200 + Math.random() * 40}, ${170 + Math.random() * 30}, ${120 + Math.random() * 30}, 0.3)`;
        ctx.fillRect(x, y, width, height);
      }
    });
  }

  generateCharacterTexture(type: string): TextureData {
    return this.generateTexture(`character_${type}`, 256, 256, (ctx) => {
      // Base character color
      let baseColor = '#8B4513'; // Brown for most animals
      
      switch (type) {
        case 'player':
          baseColor = '#4169E1'; // Blue for player
          break;
        case 'bear':
          baseColor = '#8B4513'; // Brown
          break;
        case 'squirrel':
          baseColor = '#D2691E'; // Orange-brown
          break;
        case 'deer':
          baseColor = '#DEB887'; // Tan
          break;
        case 'coyote':
          baseColor = '#A0522D'; // Sienna
          break;
        case 'snake':
          baseColor = '#228B22'; // Green
          break;
        case 'scorpion':
          baseColor = '#8B4513'; // Dark brown
          break;
      }
      
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, 256, 256);
      
      // Add some texture variation
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const size = Math.random() * 10 + 2;
        
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  generateParticleTexture(): TextureData {
    return this.generateTexture('particle', 64, 64, (ctx) => {
      // Simple circular particle
      const centerX = 32;
      const centerY = 32;
      const radius = 30;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  generateUITexture(type: string): TextureData {
    return this.generateTexture(`ui_${type}`, 128, 128, (ctx) => {
      switch (type) {
        case 'coin':
          // Golden coin
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(64, 64, 50, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.strokeStyle = '#B8860B';
          ctx.lineWidth = 4;
          ctx.stroke();
          break;
          
        case 'powerup':
          // Glowing orb
          const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 50);
          gradient.addColorStop(0, '#00FFFF');
          gradient.addColorStop(0.7, '#0080FF');
          gradient.addColorStop(1, '#0040FF');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(64, 64, 50, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'health':
          // Red cross
          ctx.fillStyle = '#FF0000';
          ctx.fillRect(54, 24, 20, 80);
          ctx.fillRect(24, 54, 80, 20);
          break;
      }
    });
  }

  // Utility methods
  getGeneratedModel(id: string): GeneratedModel | null {
    return this.generatedModels.get(id) || null;
  }

  getGeneratedTexture(id: string): TextureData | null {
    return this.generatedTextures.get(id) || null;
  }

  clearCache(): void {
    this.generatedModels.clear();
    this.generatedTextures.clear();
  }

  getStats(): { models: number; textures: number } {
    return {
      models: this.generatedModels.size,
      textures: this.generatedTextures.size
    };
  }
}