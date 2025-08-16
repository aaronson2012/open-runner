import type { SystemId } from '@/types';

interface SystemNode {
  id: SystemId;
  dependencies: Set<SystemId>;
  dependents: Set<SystemId>;
  priority: number;
}

/**
 * Manages system execution order based on dependencies
 */
export class SystemDependencyManager {
  private systems = new Map<SystemId, SystemNode>();
  private executionOrder: SystemId[] = [];
  private needsRecompute = true;

  /**
   * Add a system with its dependencies
   */
  addSystem(systemId: SystemId, dependencies: SystemId[] = [], priority: number = 0): void {
    if (this.systems.has(systemId)) {
      console.warn(`System ${systemId} already exists in dependency manager`);
      return;
    }

    const systemNode: SystemNode = {
      id: systemId,
      dependencies: new Set(dependencies),
      dependents: new Set(),
      priority
    };

    this.systems.set(systemId, systemNode);

    // Update dependent relationships
    for (const depId of dependencies) {
      const depNode = this.systems.get(depId);
      if (depNode) {
        depNode.dependents.add(systemId);
      } else {
        console.warn(`Dependency ${depId} for system ${systemId} not found`);
      }
    }

    this.needsRecompute = true;
  }

  /**
   * Remove a system and update dependencies
   */
  removeSystem(systemId: SystemId): void {
    const systemNode = this.systems.get(systemId);
    if (!systemNode) return;

    // Remove this system from its dependencies' dependents
    for (const depId of systemNode.dependencies) {
      const depNode = this.systems.get(depId);
      if (depNode) {
        depNode.dependents.delete(systemId);
      }
    }

    // Remove this system from its dependents' dependencies
    for (const depId of systemNode.dependents) {
      const depNode = this.systems.get(depId);
      if (depNode) {
        depNode.dependencies.delete(systemId);
      }
    }

    this.systems.delete(systemId);
    this.needsRecompute = true;
  }

  /**
   * Add a dependency relationship between systems
   */
  addDependency(systemId: SystemId, dependsOn: SystemId): void {
    const system = this.systems.get(systemId);
    const dependency = this.systems.get(dependsOn);

    if (!system || !dependency) {
      console.warn(`Cannot add dependency: system ${systemId} or ${dependsOn} not found`);
      return;
    }

    // Check for circular dependencies
    if (this.wouldCreateCycle(systemId, dependsOn)) {
      console.error(`Adding dependency from ${systemId} to ${dependsOn} would create a cycle`);
      return;
    }

    system.dependencies.add(dependsOn);
    dependency.dependents.add(systemId);
    this.needsRecompute = true;
  }

  /**
   * Remove a dependency relationship
   */
  removeDependency(systemId: SystemId, dependsOn: SystemId): void {
    const system = this.systems.get(systemId);
    const dependency = this.systems.get(dependsOn);

    if (system) {
      system.dependencies.delete(dependsOn);
    }
    if (dependency) {
      dependency.dependents.delete(systemId);
    }

    this.needsRecompute = true;
  }

  /**
   * Get the execution order respecting dependencies and priorities
   */
  getExecutionOrder(): SystemId[] {
    if (this.needsRecompute) {
      this.computeExecutionOrder();
      this.needsRecompute = false;
    }
    return [...this.executionOrder];
  }

  /**
   * Check if adding a dependency would create a cycle
   */
  private wouldCreateCycle(from: SystemId, to: SystemId): boolean {
    const visited = new Set<SystemId>();
    const stack = [to];

    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (current === from) {
        return true;
      }
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);
      
      const node = this.systems.get(current);
      if (node) {
        for (const dependent of node.dependents) {
          stack.push(dependent);
        }
      }
    }

    return false;
  }

  /**
   * Compute execution order using topological sort with priority
   */
  private computeExecutionOrder(): void {
    const systems = Array.from(this.systems.values());
    const inDegree = new Map<SystemId, number>();
    const queue: SystemNode[] = [];

    // Initialize in-degree counts
    for (const system of systems) {
      inDegree.set(system.id, system.dependencies.size);
      if (system.dependencies.size === 0) {
        queue.push(system);
      }
    }

    // Sort initial queue by priority
    queue.sort((a, b) => a.priority - b.priority);

    const result: SystemId[] = [];

    while (queue.length > 0) {
      // Get system with highest priority (lowest priority number)
      const current = queue.shift()!;
      result.push(current.id);

      // Process dependents
      const dependentNodes: SystemNode[] = [];
      for (const dependentId of current.dependents) {
        const currentInDegree = inDegree.get(dependentId)! - 1;
        inDegree.set(dependentId, currentInDegree);

        if (currentInDegree === 0) {
          const dependentNode = this.systems.get(dependentId)!;
          dependentNodes.push(dependentNode);
        }
      }

      // Sort dependents by priority and add to queue
      dependentNodes.sort((a, b) => a.priority - b.priority);
      queue.push(...dependentNodes);
      
      // Re-sort queue to maintain priority order
      queue.sort((a, b) => a.priority - b.priority);
    }

    // Check for cycles
    if (result.length !== systems.length) {
      const missingSystems = systems
        .filter(s => !result.includes(s.id))
        .map(s => s.id);
      console.error('Circular dependency detected in systems:', missingSystems);
      
      // Add missing systems at the end as fallback
      result.push(...missingSystems);
    }

    this.executionOrder = result;
  }

  /**
   * Get dependency graph information
   */
  getDependencyGraph(): Map<SystemId, { dependencies: SystemId[]; dependents: SystemId[]; priority: number }> {
    const graph = new Map();
    
    for (const [id, node] of this.systems) {
      graph.set(id, {
        dependencies: Array.from(node.dependencies),
        dependents: Array.from(node.dependents),
        priority: node.priority
      });
    }
    
    return graph;
  }

  /**
   * Validate the dependency graph for cycles
   */
  validateGraph(): { isValid: boolean; cycles: SystemId[][] } {
    const cycles: SystemId[][] = [];
    const visited = new Set<SystemId>();
    const recursionStack = new Set<SystemId>();

    const hasCycle = (systemId: SystemId, path: SystemId[]): boolean => {
      if (recursionStack.has(systemId)) {
        // Found cycle - extract it from the path
        const cycleStart = path.indexOf(systemId);
        const cycle = path.slice(cycleStart);
        cycle.push(systemId);
        cycles.push(cycle);
        return true;
      }

      if (visited.has(systemId)) {
        return false;
      }

      visited.add(systemId);
      recursionStack.add(systemId);
      path.push(systemId);

      const system = this.systems.get(systemId);
      if (system) {
        for (const dependentId of system.dependents) {
          if (hasCycle(dependentId, [...path])) {
            return true;
          }
        }
      }

      recursionStack.delete(systemId);
      return false;
    };

    // Check each system for cycles
    for (const systemId of this.systems.keys()) {
      if (!visited.has(systemId)) {
        hasCycle(systemId, []);
      }
    }

    return {
      isValid: cycles.length === 0,
      cycles
    };
  }

  /**
   * Clear all systems and dependencies
   */
  clear(): void {
    this.systems.clear();
    this.executionOrder = [];
    this.needsRecompute = true;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    const validation = this.validateGraph();
    
    return {
      systemCount: this.systems.size,
      executionOrder: this.getExecutionOrder(),
      dependencyGraph: this.getDependencyGraph(),
      isValid: validation.isValid,
      cycles: validation.cycles,
      needsRecompute: this.needsRecompute
    };
  }
}