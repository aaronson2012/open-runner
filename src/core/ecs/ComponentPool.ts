import type { Component } from '@/types';

/**
 * Object pool for components to reduce garbage collection pressure
 */
export class ComponentPool {
  private pool: Component[] = [];
  private factory: () => Component;
  private maxSize: number;
  private activeCount = 0;

  constructor(factory: () => Component, maxSize: number = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
    
    // Pre-populate pool
    this.prewarm(Math.min(10, maxSize));
  }

  /**
   * Pre-populate the pool with instances
   */
  private prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Get a component from the pool or create a new one
   */
  acquire(): Component {
    let component: Component;
    
    if (this.pool.length > 0) {
      component = this.pool.pop()!;
    } else {
      component = this.factory();
    }
    
    this.activeCount++;
    
    // Reset component to default state
    this.resetComponent(component);
    
    return component;
  }

  /**
   * Return a component to the pool
   */
  release(component: Component): void {
    if (this.pool.length < this.maxSize) {
      // Reset component state before returning to pool
      this.resetComponent(component);
      this.pool.push(component);
    }
    
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  /**
   * Reset component to default state
   */
  private resetComponent(component: Component): void {
    // Reset common properties
    component.entityId = 0;
    
    // Type-specific resets can be added here
    // This is a basic implementation - components may need custom reset logic
  }

  /**
   * Clear the entire pool
   */
  clear(): void {
    this.pool.length = 0;
    this.activeCount = 0;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.pool.length,
      active: this.activeCount,
      total: this.pool.length + this.activeCount,
      maxSize: this.maxSize,
      utilization: this.activeCount / (this.pool.length + this.activeCount)
    };
  }

  /**
   * Resize the pool
   */
  resize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    
    // Trim pool if it's too large
    if (this.pool.length > newMaxSize) {
      this.pool.splice(newMaxSize);
    }
  }
}