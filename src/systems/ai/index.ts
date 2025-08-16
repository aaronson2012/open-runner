// AI Components
export * from '@/components/ai/EnemyComponent';
export * from '@/components/ai/AIComponent';
export * from '@/components/ai/AggroComponent';
export * from '@/components/ai/NavigationComponent';
export * from '@/components/ai/PatrolComponent';

// AI Systems
export { AISystem } from './AISystem';
export { AggroSystem } from './AggroSystem';
export { NavigationSystem } from './NavigationSystem';
export { PatrolSystem } from './PatrolSystem';

// AI Management
export { EnemyFactory, createEnemyFactory, EnemyTypes, EnemyStats } from './EnemyFactory';
export { AISystemManager, createAISystemManager } from './AISystemManager';
export { AIIntegration, createAIIntegration, AIUsageExample, AIConstants } from './AIIntegration';

// Type exports for external use
export type {
  AIState,
  AIDecision,
  ThreatLevel,
  DetectedTarget,
  NavigationState,
  PathNode,
  Obstacle,
  PatrolType,
  PatrolWaypoint
} from '@/components/ai/AIComponent';

// Re-export commonly used types
export type { Vector3, Entity, EntityId } from '@/types';