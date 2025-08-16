import type { Entity, EntityId, Component, ComponentType, System, SystemId } from '@/types';
import { ComponentPool } from './ComponentPool';
import { QueryCache } from './QueryCache';
import { SystemDependencyManager } from './SystemDependencyManager';
import { PerformanceProfiler } from './PerformanceProfiler';
import { ComponentArchetype } from './ComponentArchetype';

export interface WorldConfig {
  enableQueryCaching?: boolean;
  enableObjectPooling?: boolean;
  enableProfiling?: boolean;
  maxEntities?: number;
  maxComponentsPerType?: number;
}

export class World {
  private entities = new Map<EntityId, Entity>();
  private systems = new Map<SystemId, System>();
  private components = new Map<ComponentType, Map<EntityId, Component>>();
  private nextEntityId = 1;
  private isRunning = false;
  
  // Performance optimizations
  private componentPools = new Map<ComponentType, ComponentPool>();
  private queryCache: QueryCache;
  private dependencyManager: SystemDependencyManager;
  private profiler: PerformanceProfiler;
  private archetypes = new Map<string, ComponentArchetype>();
  private componentRegistrations = new Map<ComponentType, { factory: () => Component; size: number }>();
  private recycledEntityIds: EntityId[] = [];
  
  private config: Required<WorldConfig>;

  constructor(config: WorldConfig = {}) {
    this.config = {
      enableQueryCaching: true,
      enableObjectPooling: true,
      enableProfiling: false,
      maxEntities: 10000,
      maxComponentsPerType: 5000,
      ...config
    };
    
    this.queryCache = new QueryCache(this.config.enableQueryCaching);
    this.dependencyManager = new SystemDependencyManager();
    this.profiler = new PerformanceProfiler(this.config.enableProfiling);
    
    this.init();
  }

  private init(): void {
    // Initialize component storage
    this.components.clear();
  }

  // Component Registration
  registerComponent<T extends Component>(
    componentType: ComponentType,
    factory: () => T,
    poolSize: number = 100
  ): void {
    this.componentRegistrations.set(componentType, {
      factory: factory as () => Component,
      size: poolSize
    });
    
    if (this.config.enableObjectPooling) {
      this.componentPools.set(componentType, new ComponentPool(factory, poolSize));
    }
  }

  // Entity Management
  createEntity(archetypeSignature?: string): EntityId {
    // Try to reuse recycled entity ID
    const id = this.recycledEntityIds.pop() || this.nextEntityId++;
    
    const entity: Entity = {
      id,
      active: true,
      components: new Map(),
      archetype: archetypeSignature
    };
    
    this.entities.set(id, entity);
    
    // Add to archetype if specified
    if (archetypeSignature) {
      this.getOrCreateArchetype(archetypeSignature).addEntity(id);
    }
    
    this.profiler.recordEntityCreation();
    return id;
  }

  destroyEntity(entityId: EntityId): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    // Remove from archetype
    if (entity.archetype) {
      const archetype = this.archetypes.get(entity.archetype);
      archetype?.removeEntity(entityId);
    }

    // Return components to pools and remove all components
    for (const [componentType, component] of entity.components) {
      this.returnComponentToPool(componentType, component);
      this.removeComponent(entityId, componentType);
    }

    this.entities.delete(entityId);
    
    // Recycle entity ID for reuse
    this.recycledEntityIds.push(entityId);
    
    // Invalidate queries that might include this entity
    this.queryCache.invalidateAll();
    
    this.profiler.recordEntityDestruction();
  }

  getEntity(entityId: EntityId): Entity | undefined {
    return this.entities.get(entityId);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getActiveEntities(): Entity[] {
    return Array.from(this.entities.values()).filter(entity => entity.active);
  }

  // Component Management
  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const entity = this.entities.get(entityId);
    if (!entity) {
      console.warn(`Entity ${entityId} not found when adding component ${component.type}`);
      return;
    }

    const componentType = component.type;
    
    // Initialize component type storage if needed
    if (!this.components.has(componentType)) {
      this.components.set(componentType, new Map());
    }

    // Update archetype if entity signature changes
    const oldArchetype = entity.archetype;
    const newSignature = this.calculateArchetypeSignature(entityId, [componentType]);
    
    if (oldArchetype !== newSignature) {
      // Remove from old archetype
      if (oldArchetype) {
        this.archetypes.get(oldArchetype)?.removeEntity(entityId);
      }
      
      // Add to new archetype
      entity.archetype = newSignature;
      this.getOrCreateArchetype(newSignature).addEntity(entityId);
    }

    // Store component
    const componentMap = this.components.get(componentType)!;
    componentMap.set(entityId, component);
    entity.components.set(componentType, component);
    component.entityId = entityId;
    
    // Invalidate relevant queries
    this.queryCache.invalidateForComponent(componentType);
    
    this.profiler.recordComponentAddition(componentType);
  }
  
  createComponent<T extends Component>(entityId: EntityId, componentType: ComponentType): T | null {
    if (!this.config.enableObjectPooling) {
      return null;
    }
    
    const pool = this.componentPools.get(componentType);
    if (!pool) {
      return null;
    }
    
    const component = pool.acquire() as T;
    component.entityId = entityId;
    return component;
  }
  
  private returnComponentToPool(componentType: ComponentType, component: Component): void {
    if (!this.config.enableObjectPooling) {
      return;
    }
    
    const pool = this.componentPools.get(componentType);
    if (pool) {
      pool.release(component);
    }
  }

  removeComponent(entityId: EntityId, componentType: ComponentType): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const component = entity.components.get(componentType);
    if (component) {
      this.returnComponentToPool(componentType, component);
    }

    const componentMap = this.components.get(componentType);
    if (componentMap) {
      componentMap.delete(entityId);
    }
    
    entity.components.delete(componentType);
    
    // Update archetype
    const newSignature = this.calculateArchetypeSignature(entityId);
    if (entity.archetype !== newSignature) {
      if (entity.archetype) {
        this.archetypes.get(entity.archetype)?.removeEntity(entityId);
      }
      entity.archetype = newSignature;
      if (newSignature) {
        this.getOrCreateArchetype(newSignature).addEntity(entityId);
      }
    }
    
    // Invalidate relevant queries
    this.queryCache.invalidateForComponent(componentType);
    
    this.profiler.recordComponentRemoval(componentType);
  }

  getComponent<T extends Component>(entityId: EntityId, componentType: ComponentType): T | undefined {
    const componentMap = this.components.get(componentType);
    return componentMap?.get(entityId) as T | undefined;
  }

  hasComponent(entityId: EntityId, componentType: ComponentType): boolean {
    return this.entities.get(entityId)?.components.has(componentType) ?? false;
  }

  hasComponents(entityId: EntityId, componentTypes: ComponentType[]): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    return componentTypes.every(type => entity.components.has(type));
  }

  getEntitiesWithComponent(componentType: ComponentType): Entity[] {
    const componentMap = this.components.get(componentType);
    if (!componentMap) return [];

    const entities: Entity[] = [];
    for (const entityId of componentMap.keys()) {
      const entity = this.entities.get(entityId);
      if (entity && entity.active) {
        entities.push(entity);
      }
    }
    
    return entities;
  }

  getEntitiesWithComponents(componentTypes: ComponentType[]): Entity[] {
    if (componentTypes.length === 0) return this.getActiveEntities();

    // Try cache first
    const cached = this.queryCache.get(componentTypes);
    if (cached) {
      this.profiler.recordQueryCacheHit();
      return cached;
    }

    this.profiler.recordQueryCacheMiss();
    
    // Check if we can use archetype optimization
    const signature = componentTypes.sort().join(',');
    const archetype = this.archetypes.get(signature);
    
    let result: Entity[];
    if (archetype) {
      // Fast path: use archetype
      result = archetype.getEntities().map(id => this.entities.get(id)!).filter(e => e?.active);
    } else {
      // Slow path: filter all entities
      result = this.getActiveEntities().filter(entity => 
        this.hasComponents(entity.id, componentTypes)
      );
    }
    
    // Cache the result
    this.queryCache.set(componentTypes, result);
    
    return result;
  }

  // System Management
  addSystem(system: System, dependencies: SystemId[] = []): void {
    if (this.systems.has(system.id)) {
      console.warn(`System ${system.id} already exists`);
      return;
    }

    this.systems.set(system.id, system);
    this.dependencyManager.addSystem(system.id, dependencies);
    
    // Initialize system if world is running
    if (this.isRunning && system.init) {
      system.init();
    }
  }

  removeSystem(systemId: SystemId): void {
    const system = this.systems.get(systemId);
    if (!system) return;

    // Destroy system if it has cleanup
    if (system.destroy) {
      system.destroy();
    }

    this.systems.delete(systemId);
  }

  getSystem(systemId: SystemId): System | undefined {
    return this.systems.get(systemId);
  }

  // World Lifecycle
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Initialize all systems
    for (const system of this.systems.values()) {
      if (system.init) {
        system.init();
      }
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    // Destroy all systems
    for (const system of this.systems.values()) {
      if (system.destroy) {
        system.destroy();
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning) return;

    this.profiler.startFrame();
    
    // Get systems in dependency order
    const systemOrder = this.dependencyManager.getExecutionOrder();
    
    // Update each system
    for (const systemId of systemOrder) {
      const system = this.systems.get(systemId);
      if (!system) continue;
      
      this.profiler.startSystem(systemId);
      
      const entities = this.getEntitiesWithComponents(system.requiredComponents);
      system.update(deltaTime, entities);
      
      this.profiler.endSystem(systemId);
    }
    
    this.profiler.endFrame();
  }

  // Utility methods
  clear(): void {
    this.stop();
    
    // Clear all entities
    for (const entityId of this.entities.keys()) {
      this.destroyEntity(entityId);
    }
    
    // Clear all systems
    for (const systemId of this.systems.keys()) {
      this.removeSystem(systemId);
    }
    
    // Clear archetypes and caches
    this.archetypes.clear();
    this.queryCache.clear();
    this.dependencyManager.clear();
    this.profiler.reset();
    
    // Reset pools
    for (const pool of this.componentPools.values()) {
      pool.clear();
    }
    
    this.nextEntityId = 1;
    this.recycledEntityIds.length = 0;
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  getActiveEntityCount(): number {
    return this.getActiveEntities().length;
  }

  getSystemCount(): number {
    return this.systems.size;
  }

  // Archetype Management
  private calculateArchetypeSignature(entityId: EntityId, additionalComponents: ComponentType[] = []): string {
    const entity = this.entities.get(entityId);
    if (!entity) return '';
    
    const allComponents = [...entity.components.keys(), ...additionalComponents];
    return allComponents.sort().join(',');
  }
  
  private getOrCreateArchetype(signature: string): ComponentArchetype {
    if (!this.archetypes.has(signature)) {
      this.archetypes.set(signature, new ComponentArchetype(signature));
    }
    return this.archetypes.get(signature)!;
  }
  
  // Performance and Debug Methods
  getPerformanceMetrics() {
    return this.profiler.getMetrics();
  }
  
  getQueryCacheStats() {
    return this.queryCache.getStats();
  }
  
  getArchetypeInfo() {
    const info = new Map<string, number>();
    for (const [signature, archetype] of this.archetypes) {
      info.set(signature, archetype.getEntityCount());
    }
    return info;
  }
  
  // Debug methods
  getDebugInfo() {
    return {
      entities: this.getEntityCount(),
      activeEntities: this.getActiveEntityCount(),
      systems: this.getSystemCount(),
      componentTypes: this.components.size,
      archetypes: this.archetypes.size,
      recycledEntityIds: this.recycledEntityIds.length,
      isRunning: this.isRunning,
      performance: this.profiler.getMetrics(),
      queryCache: this.queryCache.getStats()
    };
  }
}