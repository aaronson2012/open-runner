import type { System, Entity, ComponentType, SystemId } from '@/types';
import type { World } from '@/core/ecs/World';

/**
 * Base class for all ECS systems with common functionality
 */
export abstract class BaseSystem implements System {
  public readonly id: SystemId;
  public readonly priority: number;
  public requiredComponents: ComponentType[];
  
  protected world?: World;
  protected enabled = true;
  protected initialized = false;
  
  // Performance tracking
  protected updateCount = 0;
  protected totalUpdateTime = 0;
  protected lastUpdateTime = 0;
  
  // Debug information
  protected debugEnabled = false;

  constructor(
    id: SystemId,
    requiredComponents: ComponentType[],
    priority: number = 0
  ) {
    this.id = id;
    this.requiredComponents = [...requiredComponents];
    this.priority = priority;
  }

  /**
   * Set the world reference
   */
  setWorld(world: World): void {
    this.world = world;
  }

  /**
   * Initialize the system
   */
  init?(): void {
    if (this.initialized) return;
    
    this.onInit();
    this.initialized = true;
  }

  /**
   * Override this for custom initialization
   */
  protected onInit(): void {
    // Base implementation does nothing
  }

  /**
   * Main update method - handles common logic and delegates to onUpdate
   */
  update(deltaTime: number, entities: Entity[]): void {
    if (!this.enabled || !this.initialized) return;
    
    const startTime = performance.now();
    
    this.onUpdate(deltaTime, entities);
    
    const endTime = performance.now();
    const updateTime = endTime - startTime;
    
    this.updateCount++;
    this.totalUpdateTime += updateTime;
    this.lastUpdateTime = updateTime;
    
    if (this.debugEnabled) {
      this.debugUpdate(deltaTime, entities, updateTime);
    }
  }

  /**
   * Override this for system-specific update logic
   */
  protected abstract onUpdate(deltaTime: number, entities: Entity[]): void;

  /**
   * Debug update hook
   */
  protected debugUpdate(deltaTime: number, entities: Entity[], updateTime: number): void {
    if (updateTime > 16.67) { // More than one frame at 60fps
      console.warn(`System ${this.id} took ${updateTime.toFixed(2)}ms to update ${entities.length} entities`);
    }
  }

  /**
   * Cleanup the system
   */
  destroy?(): void {
    this.onDestroy();
    this.enabled = false;
    this.initialized = false;
  }

  /**
   * Override this for custom cleanup
   */
  protected onDestroy(): void {
    // Base implementation does nothing
  }

  /**
   * Enable or disable the system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if system is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable debug mode
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /**
   * Get system performance metrics
   */
  getPerformanceMetrics() {
    const avgUpdateTime = this.updateCount > 0 ? this.totalUpdateTime / this.updateCount : 0;
    
    return {
      id: this.id,
      updateCount: this.updateCount,
      totalUpdateTime: this.totalUpdateTime,
      averageUpdateTime: avgUpdateTime,
      lastUpdateTime: this.lastUpdateTime,
      enabled: this.enabled,
      initialized: this.initialized
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.updateCount = 0;
    this.totalUpdateTime = 0;
    this.lastUpdateTime = 0;
  }

  /**
   * Get a component from an entity (helper method)
   */
  protected getComponent<T>(entity: Entity, componentType: ComponentType): T | undefined {
    return entity.components.get(componentType) as T | undefined;
  }

  /**
   * Check if entity has all required components (helper method)
   */
  protected hasRequiredComponents(entity: Entity): boolean {
    return this.requiredComponents.every(type => entity.components.has(type));
  }

  /**
   * Filter entities that have all required components
   */
  protected filterEntities(entities: Entity[]): Entity[] {
    return entities.filter(entity => this.hasRequiredComponents(entity));
  }

  /**
   * Log debug message if debug is enabled
   */
  protected debug(message: string, ...args: any[]): void {
    if (this.debugEnabled) {
      console.log(`[${this.id}] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   */
  protected warn(message: string, ...args: any[]): void {
    console.warn(`[${this.id}] ${message}`, ...args);
  }

  /**
   * Log error message
   */
  protected error(message: string, ...args: any[]): void {
    console.error(`[${this.id}] ${message}`, ...args);
  }

  /**
   * Get debug information about the system
   */
  getDebugInfo() {
    return {
      id: this.id,
      priority: this.priority,
      requiredComponents: this.requiredComponents,
      enabled: this.enabled,
      initialized: this.initialized,
      debugEnabled: this.debugEnabled,
      performance: this.getPerformanceMetrics()
    };
  }
}