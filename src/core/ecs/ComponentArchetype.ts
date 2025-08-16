import type { EntityId, ComponentType } from '@/types';

/**
 * Component archetype for grouping entities with the same component signature
 * This enables cache-friendly iteration and faster queries
 */
export class ComponentArchetype {
  private signature: string;
  private componentTypes: ComponentType[];
  private entities = new Set<EntityId>();
  private entityArray: EntityId[] = [];
  private isDirty = false;

  constructor(signature: string) {
    this.signature = signature;
    this.componentTypes = signature ? signature.split(',').filter(s => s.length > 0) : [];
  }

  /**
   * Get the archetype signature
   */
  getSignature(): string {
    return this.signature;
  }

  /**
   * Get the component types in this archetype
   */
  getComponentTypes(): ComponentType[] {
    return [...this.componentTypes];
  }

  /**
   * Add an entity to this archetype
   */
  addEntity(entityId: EntityId): void {
    if (!this.entities.has(entityId)) {
      this.entities.add(entityId);
      this.isDirty = true;
    }
  }

  /**
   * Remove an entity from this archetype
   */
  removeEntity(entityId: EntityId): void {
    if (this.entities.has(entityId)) {
      this.entities.delete(entityId);
      this.isDirty = true;
    }
  }

  /**
   * Check if entity belongs to this archetype
   */
  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get all entities in this archetype
   * Returns a cached array for performance
   */
  getEntities(): EntityId[] {
    if (this.isDirty) {
      this.entityArray = Array.from(this.entities);
      this.isDirty = false;
    }
    return this.entityArray;
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Check if this archetype is compatible with the required component types
   */
  isCompatibleWith(requiredComponents: ComponentType[]): boolean {
    return requiredComponents.every(required => 
      this.componentTypes.includes(required)
    );
  }

  /**
   * Get entities that match specific component requirements
   * More efficient than filtering all entities
   */
  getCompatibleEntities(requiredComponents: ComponentType[]): EntityId[] {
    if (!this.isCompatibleWith(requiredComponents)) {
      return [];
    }
    return this.getEntities();
  }

  /**
   * Clear all entities from this archetype
   */
  clear(): void {
    this.entities.clear();
    this.entityArray = [];
    this.isDirty = false;
  }

  /**
   * Get archetype statistics
   */
  getStats() {
    return {
      signature: this.signature,
      componentCount: this.componentTypes.length,
      entityCount: this.entities.size,
      componentTypes: this.componentTypes,
      memoryEstimate: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of this archetype
   */
  private estimateMemoryUsage(): number {
    // Rough estimation
    const signatureSize = this.signature.length * 2; // String overhead
    const componentTypesSize = this.componentTypes.length * 20; // Estimated string size
    const entitiesSetSize = this.entities.size * 8; // Set overhead + entity IDs
    const entityArraySize = this.entityArray.length * 4; // Array of numbers
    
    return signatureSize + componentTypesSize + entitiesSetSize + entityArraySize;
  }

  /**
   * Create a hash for faster archetype lookup
   */
  getHash(): string {
    return this.signature;
  }

  /**
   * Check if this archetype is empty
   */
  isEmpty(): boolean {
    return this.entities.size === 0;
  }

  /**
   * Merge entities from another archetype (for archetype transitions)
   */
  mergeFrom(other: ComponentArchetype): void {
    for (const entityId of other.getEntities()) {
      this.addEntity(entityId);
    }
  }

  /**
   * Split entities based on a predicate (for archetype optimization)
   */
  split(predicate: (entityId: EntityId) => boolean): ComponentArchetype {
    const newArchetype = new ComponentArchetype(this.signature);
    const toMove: EntityId[] = [];

    for (const entityId of this.entities) {
      if (predicate(entityId)) {
        toMove.push(entityId);
      }
    }

    for (const entityId of toMove) {
      this.removeEntity(entityId);
      newArchetype.addEntity(entityId);
    }

    return newArchetype;
  }

  /**
   * Validate archetype integrity
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check signature consistency
    const expectedSignature = this.componentTypes.sort().join(',');
    if (this.signature !== expectedSignature) {
      errors.push(`Signature mismatch: expected "${expectedSignature}", got "${this.signature}"`);
    }

    // Check for duplicate component types
    const uniqueTypes = new Set(this.componentTypes);
    if (uniqueTypes.size !== this.componentTypes.length) {
      errors.push('Duplicate component types detected');
    }

    // Check entity array consistency
    if (this.entityArray.length !== this.entities.size && !this.isDirty) {
      errors.push('Entity array size mismatch');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a subset archetype with additional components
   */
  createSubset(additionalComponents: ComponentType[]): ComponentArchetype {
    const newComponents = [...this.componentTypes, ...additionalComponents];
    const newSignature = newComponents.sort().join(',');
    return new ComponentArchetype(newSignature);
  }

  /**
   * Create a superset archetype by removing components
   */
  createSuperset(componentsToRemove: ComponentType[]): ComponentArchetype {
    const newComponents = this.componentTypes.filter(
      type => !componentsToRemove.includes(type)
    );
    const newSignature = newComponents.sort().join(',');
    return new ComponentArchetype(newSignature);
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    const validation = this.validate();
    
    return {
      ...this.getStats(),
      isDirty: this.isDirty,
      validation,
      entities: Array.from(this.entities).slice(0, 10), // First 10 entities for debugging
      totalEntities: this.entities.size
    };
  }
}