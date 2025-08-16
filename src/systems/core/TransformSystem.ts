import type { Entity, Vector3 } from '@/types';
import { BaseSystem } from './BaseSystem';
import type { TransformComponent } from '@/components/core/CoreComponents';

/**
 * System responsible for updating transform matrices and handling hierarchies
 */
export class TransformSystem extends BaseSystem {
  private readonly matrixStack: Float32Array[] = [];
  private readonly identityMatrix = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);

  constructor() {
    super('transform', ['transform'], -100); // High priority - run early
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    // First pass: update all matrices for entities without parents
    const rootEntities: Entity[] = [];
    const childEntities: Entity[] = [];

    for (const entity of entities) {
      const transform = this.getComponent<TransformComponent>(entity, 'transform')!;
      
      if (!transform.parent) {
        rootEntities.push(entity);
      } else {
        childEntities.push(entity);
      }
    }

    // Update root entities first
    for (const entity of rootEntities) {
      this.updateTransformMatrix(entity);
    }

    // Then update children recursively
    this.updateChildrenRecursively(childEntities);
  }

  /**
   * Update children recursively, ensuring parents are updated before children
   */
  private updateChildrenRecursively(entities: Entity[]): void {
    const remaining = [...entities];
    const processed = new Set<number>();

    while (remaining.length > 0) {
      const initialLength = remaining.length;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const entity = remaining[i];
        const transform = this.getComponent<TransformComponent>(entity, 'transform')!;

        // Check if parent has been processed
        if (!transform.parent || processed.has(transform.parent)) {
          this.updateTransformMatrix(entity, transform.parent);
          processed.add(entity.id);
          remaining.splice(i, 1);
        }
      }

      // Prevent infinite loop if there are circular dependencies
      if (remaining.length === initialLength) {
        this.warn('Circular dependency detected in transform hierarchy', 
          remaining.map(e => e.id));
        break;
      }
    }
  }

  /**
   * Update the world matrix for a transform
   */
  private updateTransformMatrix(entity: Entity, parentId?: number): void {
    const transform = this.getComponent<TransformComponent>(entity, 'transform')!;

    if (!transform.isDirty && transform.worldMatrix) {
      return; // No update needed
    }

    // Calculate local transformation matrix
    const localMatrix = this.createTransformMatrix(
      transform.position,
      transform.rotation,
      transform.scale
    );

    if (parentId && this.world) {
      // Get parent's world matrix
      const parentEntity = this.world.getEntity(parentId);
      if (parentEntity) {
        const parentTransform = this.getComponent<TransformComponent>(parentEntity, 'transform');
        if (parentTransform?.worldMatrix) {
          // Multiply local matrix by parent's world matrix
          transform.worldMatrix = this.multiplyMatrices(parentTransform.worldMatrix, localMatrix);
        } else {
          transform.worldMatrix = localMatrix;
        }
      } else {
        transform.worldMatrix = localMatrix;
      }
    } else {
      // No parent, world matrix is the same as local matrix
      transform.worldMatrix = localMatrix;
    }

    transform.isDirty = false;
  }

  /**
   * Create a 4x4 transformation matrix from position, rotation, and scale
   */
  private createTransformMatrix(position: Vector3, rotation: Vector3, scale: Vector3): Float32Array {
    const matrix = new Float32Array(16);

    // Calculate trigonometric values
    const sx = Math.sin(rotation.x), cx = Math.cos(rotation.x);
    const sy = Math.sin(rotation.y), cy = Math.cos(rotation.y);
    const sz = Math.sin(rotation.z), cz = Math.cos(rotation.z);

    // Create rotation matrix (ZYX order)
    const m00 = cy * cz;
    const m01 = cy * sz;
    const m02 = -sy;

    const m10 = sx * sy * cz - cx * sz;
    const m11 = sx * sy * sz + cx * cz;
    const m12 = sx * cy;

    const m20 = cx * sy * cz + sx * sz;
    const m21 = cx * sy * sz - sx * cz;
    const m22 = cx * cy;

    // Apply scale and store in matrix
    matrix[0] = m00 * scale.x;
    matrix[1] = m01 * scale.x;
    matrix[2] = m02 * scale.x;
    matrix[3] = 0;

    matrix[4] = m10 * scale.y;
    matrix[5] = m11 * scale.y;
    matrix[6] = m12 * scale.y;
    matrix[7] = 0;

    matrix[8] = m20 * scale.z;
    matrix[9] = m21 * scale.z;
    matrix[10] = m22 * scale.z;
    matrix[11] = 0;

    // Translation
    matrix[12] = position.x;
    matrix[13] = position.y;
    matrix[14] = position.z;
    matrix[15] = 1;

    return matrix;
  }

  /**
   * Multiply two 4x4 matrices
   */
  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }

    return result;
  }

  /**
   * Mark a transform as dirty (needs matrix recalculation)
   */
  markDirty(entityId: number): void {
    if (!this.world) return;

    const entity = this.world.getEntity(entityId);
    if (!entity) return;

    const transform = this.getComponent<TransformComponent>(entity, 'transform');
    if (transform) {
      transform.isDirty = true;
      
      // Mark all children as dirty too
      this.markChildrenDirty(entityId);
    }
  }

  /**
   * Recursively mark all children as dirty
   */
  private markChildrenDirty(parentId: number): void {
    if (!this.world) return;

    const parentEntity = this.world.getEntity(parentId);
    if (!parentEntity) return;

    const parentTransform = this.getComponent<TransformComponent>(parentEntity, 'transform');
    if (!parentTransform) return;

    for (const childId of parentTransform.children) {
      const childEntity = this.world.getEntity(childId);
      if (childEntity) {
        const childTransform = this.getComponent<TransformComponent>(childEntity, 'transform');
        if (childTransform) {
          childTransform.isDirty = true;
          this.markChildrenDirty(childId);
        }
      }
    }
  }

  /**
   * Set parent-child relationship
   */
  setParent(childId: number, parentId: number | null): void {
    if (!this.world) return;

    const childEntity = this.world.getEntity(childId);
    if (!childEntity) return;

    const childTransform = this.getComponent<TransformComponent>(childEntity, 'transform');
    if (!childTransform) return;

    // Remove from old parent
    if (childTransform.parent) {
      this.removeChild(childTransform.parent, childId);
    }

    // Set new parent
    childTransform.parent = parentId || undefined;
    
    if (parentId) {
      const parentEntity = this.world.getEntity(parentId);
      if (parentEntity) {
        const parentTransform = this.getComponent<TransformComponent>(parentEntity, 'transform');
        if (parentTransform && !parentTransform.children.includes(childId)) {
          parentTransform.children.push(childId);
        }
      }
    }

    // Mark child as dirty
    this.markDirty(childId);
  }

  /**
   * Remove a child from parent
   */
  private removeChild(parentId: number, childId: number): void {
    if (!this.world) return;

    const parentEntity = this.world.getEntity(parentId);
    if (!parentEntity) return;

    const parentTransform = this.getComponent<TransformComponent>(parentEntity, 'transform');
    if (parentTransform) {
      const index = parentTransform.children.indexOf(childId);
      if (index !== -1) {
        parentTransform.children.splice(index, 1);
      }
    }
  }

  /**
   * Get world position of an entity
   */
  getWorldPosition(entityId: number): Vector3 | null {
    if (!this.world) return null;

    const entity = this.world.getEntity(entityId);
    if (!entity) return null;

    const transform = this.getComponent<TransformComponent>(entity, 'transform');
    if (!transform?.worldMatrix) return null;

    return {
      x: transform.worldMatrix[12],
      y: transform.worldMatrix[13],
      z: transform.worldMatrix[14]
    };
  }

  /**
   * Convert local position to world position
   */
  localToWorld(entityId: number, localPosition: Vector3): Vector3 | null {
    if (!this.world) return null;

    const entity = this.world.getEntity(entityId);
    if (!entity) return null;

    const transform = this.getComponent<TransformComponent>(entity, 'transform');
    if (!transform?.worldMatrix) return null;

    const matrix = transform.worldMatrix;
    
    return {
      x: matrix[0] * localPosition.x + matrix[4] * localPosition.y + matrix[8] * localPosition.z + matrix[12],
      y: matrix[1] * localPosition.x + matrix[5] * localPosition.y + matrix[9] * localPosition.z + matrix[13],
      z: matrix[2] * localPosition.x + matrix[6] * localPosition.y + matrix[10] * localPosition.z + matrix[14]
    };
  }

  /**
   * Convert world position to local position
   */
  worldToLocal(entityId: number, worldPosition: Vector3): Vector3 | null {
    if (!this.world) return null;

    const entity = this.world.getEntity(entityId);
    if (!entity) return null;

    const transform = this.getComponent<TransformComponent>(entity, 'transform');
    if (!transform?.worldMatrix) return null;

    // Calculate inverse matrix
    const inverseMatrix = this.invertMatrix(transform.worldMatrix);
    if (!inverseMatrix) return null;

    return {
      x: inverseMatrix[0] * worldPosition.x + inverseMatrix[4] * worldPosition.y + inverseMatrix[8] * worldPosition.z + inverseMatrix[12],
      y: inverseMatrix[1] * worldPosition.x + inverseMatrix[5] * worldPosition.y + inverseMatrix[9] * worldPosition.z + inverseMatrix[13],
      z: inverseMatrix[2] * worldPosition.x + inverseMatrix[6] * worldPosition.y + inverseMatrix[10] * worldPosition.z + inverseMatrix[14]
    };
  }

  /**
   * Invert a 4x4 matrix
   */
  private invertMatrix(matrix: Float32Array): Float32Array | null {
    const m = matrix;
    const inv = new Float32Array(16);

    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

    const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];

    if (det === 0) {
      return null; // Matrix is not invertible
    }

    const invDet = 1.0 / det;
    for (let i = 0; i < 16; i++) {
      inv[i] *= invDet;
    }

    return inv;
  }

  /**
   * Get debug information for transform system
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();
    
    let hierarchyDepth = 0;
    let totalChildren = 0;
    
    if (this.world) {
      const entities = this.world.getEntitiesWithComponents(['transform']);
      for (const entity of entities) {
        const transform = this.getComponent<TransformComponent>(entity, 'transform');
        if (transform) {
          totalChildren += transform.children.length;
          // Calculate max hierarchy depth (simplified)
          let depth = 0;
          let currentParent = transform.parent;
          while (currentParent && depth < 10) { // Prevent infinite loops
            const parentEntity = this.world.getEntity(currentParent);
            if (parentEntity) {
              const parentTransform = this.getComponent<TransformComponent>(parentEntity, 'transform');
              currentParent = parentTransform?.parent;
              depth++;
            } else {
              break;
            }
          }
          hierarchyDepth = Math.max(hierarchyDepth, depth);
        }
      }
    }
    
    return {
      ...baseInfo,
      hierarchyDepth,
      totalChildren,
      matrixPoolSize: this.matrixStack.length
    };
  }
}