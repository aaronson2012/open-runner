// RenderWorker.ts - Web Worker for offloading rendering computations
// This worker handles tasks like frustum culling, LOD calculations, and geometry processing

interface WorkerMessage {
  id: string;
  type: string;
  data: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface FrustumCullingData {
  entities: EntityData[];
  frustumMatrix: number[]; // 4x4 matrix as flat array
  cullingDistance: number;
}

interface LODCalculationData {
  entities: EntityData[];
  cameraPosition: number[]; // [x, y, z]
  lodDistances: number[];
}

interface EntityData {
  id: number;
  position: number[]; // [x, y, z]
  scale: number[]; // [x, y, z]
  boundingRadius: number;
}

class RenderWorker {
  private pendingTasks: Map<string, any> = new Map();

  constructor() {
    self.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(event.data);
    };
    
    console.log('RenderWorker initialized');
  }

  private handleMessage(message: WorkerMessage): void {
    const { id, type, data } = message;
    
    try {
      switch (type) {
        case 'frustumCull':
          this.handleFrustumCulling(id, data);
          break;
        case 'calculateLOD':
          this.handleLODCalculation(id, data);
          break;
        case 'processGeometry':
          this.handleGeometryProcessing(id, data);
          break;
        case 'spatialQuery':
          this.handleSpatialQuery(id, data);
          break;
        case 'instancingPrep':
          this.handleInstancingPreparation(id, data);
          break;
        default:
          this.sendError(id, `Unknown task type: ${type}`);
      }
    } catch (error) {
      this.sendError(id, `Task failed: ${error.message}`);
    }
  }

  private handleFrustumCulling(taskId: string, data: FrustumCullingData): void {
    const startTime = performance.now();
    const { entities, frustumMatrix, cullingDistance } = data;
    
    // Convert flat matrix to proper matrix operations
    const frustum = this.createFrustumFromMatrix(frustumMatrix);
    
    const visibleEntities: number[] = [];
    const culledEntities: number[] = [];
    
    for (const entity of entities) {
      const position = entity.position;
      const radius = entity.boundingRadius * Math.max(...entity.scale);
      
      // Distance culling first (cheaper)
      if (cullingDistance > 0) {
        const distanceSquared = 
          position[0] * position[0] + 
          position[1] * position[1] + 
          position[2] * position[2];
        
        if (distanceSquared > cullingDistance * cullingDistance) {
          culledEntities.push(entity.id);
          continue;
        }
      }
      
      // Frustum culling
      if (this.sphereInFrustum(position, radius, frustum)) {
        visibleEntities.push(entity.id);
      } else {
        culledEntities.push(entity.id);
      }
    }
    
    const duration = performance.now() - startTime;
    
    this.sendSuccess(taskId, {
      visibleEntities,
      culledEntities,
      duration,
      totalEntities: entities.length
    });
  }

  private handleLODCalculation(taskId: string, data: LODCalculationData): void {
    const startTime = performance.now();
    const { entities, cameraPosition, lodDistances } = data;
    
    const lodResults: { entityId: number; lodLevel: number; distance: number }[] = [];
    
    for (const entity of entities) {
      const distance = this.calculateDistance(entity.position, cameraPosition);
      
      // Determine LOD level based on distance
      let lodLevel = lodDistances.length - 1; // Default to lowest detail
      
      for (let i = 0; i < lodDistances.length; i++) {
        if (distance <= lodDistances[i]) {
          lodLevel = i;
          break;
        }
      }
      
      lodResults.push({
        entityId: entity.id,
        lodLevel,
        distance
      });
    }
    
    const duration = performance.now() - startTime;
    
    this.sendSuccess(taskId, {
      lodResults,
      duration,
      totalEntities: entities.length
    });
  }

  private handleGeometryProcessing(taskId: string, data: any): void {
    const startTime = performance.now();
    
    // Process geometry data (e.g., mesh simplification, normal calculation)
    const { vertices, indices, operation } = data;
    
    let result: any;
    
    switch (operation) {
      case 'calculateNormals':
        result = this.calculateNormals(vertices, indices);
        break;
      case 'simplifyMesh':
        result = this.simplifyMesh(vertices, indices, data.targetRatio);
        break;
      case 'generateTangents':
        result = this.generateTangents(vertices, indices, data.uvs);
        break;
      default:
        throw new Error(`Unknown geometry operation: ${operation}`);
    }
    
    const duration = performance.now() - startTime;
    
    this.sendSuccess(taskId, {
      result,
      duration,
      vertexCount: vertices.length / 3
    });
  }

  private handleSpatialQuery(taskId: string, data: any): void {
    const startTime = performance.now();
    const { entities, queryPoint, queryRadius, queryType } = data;
    
    const results: number[] = [];
    
    for (const entity of entities) {
      const distance = this.calculateDistance(entity.position, queryPoint);
      
      switch (queryType) {
        case 'sphere':
          if (distance <= queryRadius) {
            results.push(entity.id);
          }
          break;
        case 'box':
          // Implement box query
          break;
        case 'nearest':
          // Implement nearest neighbor search
          break;
      }
    }
    
    const duration = performance.now() - startTime;
    
    this.sendSuccess(taskId, {
      results,
      duration,
      queriedEntities: entities.length
    });
  }

  private handleInstancingPreparation(taskId: string, data: any): void {
    const startTime = performance.now();
    const { instances, cameraPosition } = data;
    
    // Sort instances by distance for better rendering performance
    const sortedInstances = instances.map((instance: any, index: number) => ({
      ...instance,
      index,
      distance: this.calculateDistance(instance.position, cameraPosition)
    })).sort((a: any, b: any) => a.distance - b.distance);
    
    // Prepare instance matrices
    const matrices: number[] = [];
    const visibleIndices: number[] = [];
    
    for (const instance of sortedInstances) {
      // Create transformation matrix
      const matrix = this.createTransformMatrix(
        instance.position,
        instance.rotation,
        instance.scale
      );
      
      matrices.push(...matrix);
      visibleIndices.push(instance.index);
    }
    
    const duration = performance.now() - startTime;
    
    this.sendSuccess(taskId, {
      matrices,
      visibleIndices,
      duration,
      instanceCount: instances.length
    });
  }

  // Utility functions
  private createFrustumFromMatrix(matrix: number[]): FrustumPlanes {
    // Extract frustum planes from projection * view matrix
    const planes: FrustumPlanes = {
      left: [matrix[3] + matrix[0], matrix[7] + matrix[4], matrix[11] + matrix[8], matrix[15] + matrix[12]],
      right: [matrix[3] - matrix[0], matrix[7] - matrix[4], matrix[11] - matrix[8], matrix[15] - matrix[12]],
      bottom: [matrix[3] + matrix[1], matrix[7] + matrix[5], matrix[11] + matrix[9], matrix[15] + matrix[13]],
      top: [matrix[3] - matrix[1], matrix[7] - matrix[5], matrix[11] - matrix[9], matrix[15] - matrix[13]],
      near: [matrix[3] + matrix[2], matrix[7] + matrix[6], matrix[11] + matrix[10], matrix[15] + matrix[14]],
      far: [matrix[3] - matrix[2], matrix[7] - matrix[6], matrix[11] - matrix[10], matrix[15] - matrix[14]]
    };
    
    // Normalize planes
    for (const planeName in planes) {
      const plane = planes[planeName as keyof FrustumPlanes];
      const length = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
      plane[0] /= length;
      plane[1] /= length;
      plane[2] /= length;
      plane[3] /= length;
    }
    
    return planes;
  }

  private sphereInFrustum(center: number[], radius: number, frustum: FrustumPlanes): boolean {
    // Test sphere against all frustum planes
    for (const planeName in frustum) {
      const plane = frustum[planeName as keyof FrustumPlanes];
      const distance = plane[0] * center[0] + plane[1] * center[1] + plane[2] * center[2] + plane[3];
      
      if (distance < -radius) {
        return false; // Sphere is completely outside this plane
      }
    }
    
    return true; // Sphere is at least partially inside frustum
  }

  private calculateDistance(pos1: number[], pos2: number[]): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateNormals(vertices: Float32Array, indices: Uint32Array): Float32Array {
    const normals = new Float32Array(vertices.length);
    
    // Initialize normals to zero
    normals.fill(0);
    
    // Calculate face normals and accumulate
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;
      
      // Get triangle vertices
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];
      
      // Calculate normal
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      
      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];
      
      // Accumulate normal for each vertex
      for (let j = 0; j < 3; j++) {
        const vertexIndex = indices[i + j] * 3;
        normals[vertexIndex] += normal[0];
        normals[vertexIndex + 1] += normal[1];
        normals[vertexIndex + 2] += normal[2];
      }
    }
    
    // Normalize
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

  private simplifyMesh(vertices: Float32Array, indices: Uint32Array, targetRatio: number): {
    vertices: Float32Array;
    indices: Uint32Array;
  } {
    // Simple mesh decimation - remove every nth triangle
    const targetTriangleCount = Math.floor(indices.length / 3 * targetRatio);
    const step = Math.max(1, Math.floor(indices.length / 3 / targetTriangleCount));
    
    const newIndices: number[] = [];
    
    for (let i = 0; i < indices.length; i += step * 3) {
      if (i + 2 < indices.length) {
        newIndices.push(indices[i], indices[i + 1], indices[i + 2]);
      }
    }
    
    return {
      vertices, // Keep original vertices for simplicity
      indices: new Uint32Array(newIndices)
    };
  }

  private generateTangents(vertices: Float32Array, indices: Uint32Array, uvs: Float32Array): Float32Array {
    // Simplified tangent generation
    const tangents = new Float32Array(vertices.length);
    
    // For each triangle, calculate tangent
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i];
      const i2 = indices[i + 1];
      const i3 = indices[i + 2];
      
      // Get positions
      const v1 = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
      const v2 = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];
      const v3 = [vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2]];
      
      // Get UVs
      const uv1 = [uvs[i1 * 2], uvs[i1 * 2 + 1]];
      const uv2 = [uvs[i2 * 2], uvs[i2 * 2 + 1]];
      const uv3 = [uvs[i3 * 2], uvs[i3 * 2 + 1]];
      
      // Calculate tangent
      const deltaPos1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const deltaPos2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      const deltaUV1 = [uv2[0] - uv1[0], uv2[1] - uv1[1]];
      const deltaUV2 = [uv3[0] - uv1[0], uv3[1] - uv1[1]];
      
      const r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);
      const tangent = [
        (deltaPos1[0] * deltaUV2[1] - deltaPos2[0] * deltaUV1[1]) * r,
        (deltaPos1[1] * deltaUV2[1] - deltaPos2[1] * deltaUV1[1]) * r,
        (deltaPos1[2] * deltaUV2[1] - deltaPos2[2] * deltaUV1[1]) * r
      ];
      
      // Accumulate tangent for each vertex
      for (let j = 0; j < 3; j++) {
        const vertexIndex = indices[i + j] * 3;
        tangents[vertexIndex] += tangent[0];
        tangents[vertexIndex + 1] += tangent[1];
        tangents[vertexIndex + 2] += tangent[2];
      }
    }
    
    return tangents;
  }

  private createTransformMatrix(position: number[], rotation: number[], scale: number[]): number[] {
    // Create transformation matrix from position, rotation, scale
    const matrix = new Array(16).fill(0);
    
    // Simple implementation - in practice you'd use proper matrix math
    matrix[0] = scale[0];
    matrix[5] = scale[1];
    matrix[10] = scale[2];
    matrix[12] = position[0];
    matrix[13] = position[1];
    matrix[14] = position[2];
    matrix[15] = 1;
    
    // Note: Rotation is omitted for simplicity
    // In a real implementation, you'd apply rotation transformations
    
    return matrix;
  }

  private sendSuccess(taskId: string, data: any): void {
    const response: WorkerResponse = {
      id: taskId,
      success: true,
      data
    };
    
    self.postMessage(response);
  }

  private sendError(taskId: string, error: string): void {
    const response: WorkerResponse = {
      id: taskId,
      success: false,
      error
    };
    
    self.postMessage(response);
  }
}

// Type definitions
interface FrustumPlanes {
  left: number[];
  right: number[];
  bottom: number[];
  top: number[];
  near: number[];
  far: number[];
}

// Initialize worker
new RenderWorker();

// Export for TypeScript (this won't be included in worker bundle)
export {};