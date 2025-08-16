import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AISystem } from '@/systems/ai/AISystem';
import { AIComponent } from '@/components/ai/AIComponent';
import { EnemyComponent } from '@/components/ai/EnemyComponent';
import { NavigationComponent } from '@/components/ai/NavigationComponent';
import { PatrolComponent } from '@/components/ai/PatrolComponent';
import { AggroComponent } from '@/components/ai/AggroComponent';
import { World } from '@/core/ecs/World';
import type { Entity, Vector3 } from '@/types';

describe('AI System', () => {
  let aiSystem: AISystem;
  let world: World;
  let playerEntity: Entity;
  let enemyEntity: Entity;
  let aiComponent: AIComponent;
  let enemyComponent: EnemyComponent;

  beforeEach(() => {
    world = new World({ enableProfiling: true });
    aiSystem = new AISystem({
      maxSimultaneousEnemies: 10,
      aggroRange: 15.0,
      deaggroRange: 25.0,
      pathfindingEnabled: true,
      behaviorTreeEnabled: true,
      debugVisualization: false
    });
    
    world.addSystem(aiSystem);

    // Create player entity
    const playerId = world.createEntity();
    world.addComponent(playerId, {
      type: 'player',
      entityId: playerId
    });
    world.addComponent(playerId, {
      type: 'transform',
      entityId: playerId,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    playerEntity = world.getEntity(playerId)!;

    // Create enemy entity
    const enemyId = world.createEntity();
    aiComponent = new AIComponent(enemyId);
    enemyComponent = new EnemyComponent(enemyId, 'basic');
    
    world.addComponent(enemyId, aiComponent);
    world.addComponent(enemyId, enemyComponent);
    world.addComponent(enemyId, {
      type: 'transform',
      entityId: enemyId,
      position: { x: 10, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    
    enemyEntity = world.getEntity(enemyId)!;
  });

  describe('System Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(aiSystem.id).toBe('ai');
      expect(aiSystem.priority).toBeGreaterThan(0);
      expect(aiSystem.requiredComponents).toContain('ai');
    });

    it('should register player entity', () => {
      world.start();
      world.update(0.016);
      
      const playerTracker = aiSystem.getPlayerTracker();
      expect(playerTracker.hasPlayer()).toBe(true);
      expect(playerTracker.getPlayerPosition()).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should initialize behavior trees when enabled', () => {
      const config = aiSystem.getConfig();
      expect(config.behaviorTreeEnabled).toBe(true);
      
      world.start();
      
      const behaviorManager = aiSystem.getBehaviorManager();
      expect(behaviorManager.isInitialized()).toBe(true);
    });

    it('should setup pathfinding grid', () => {
      world.start();
      
      const pathfinder = aiSystem.getPathfinder();
      expect(pathfinder.isGridInitialized()).toBe(true);
    });
  });

  describe('Basic AI Behavior', () => {
    beforeEach(() => {
      world.start();
    });

    it('should update AI state each frame', () => {
      const initialState = aiComponent.getCurrentState();
      
      world.update(0.016);
      
      expect(aiComponent.getUpdateCount()).toBeGreaterThan(0);
    });

    it('should transition between states', () => {
      aiComponent.setState('idle');
      expect(aiComponent.getCurrentState()).toBe('idle');
      
      aiComponent.setState('patrol');
      expect(aiComponent.getCurrentState()).toBe('patrol');
      expect(aiComponent.getStateHistory()).toContain('idle');
    });

    it('should validate state transitions', () => {
      aiComponent.setState('idle');
      
      // Invalid transition should be rejected
      const result = aiComponent.setState('invalid_state');
      expect(result).toBe(false);
      expect(aiComponent.getCurrentState()).toBe('idle');
    });

    it('should execute state-specific behavior', () => {
      aiComponent.setState('wander');
      
      const initialPosition = { ...enemyEntity.components.get('transform')!.position };
      
      // Run several frames to allow movement
      for (let i = 0; i < 30; i++) {
        world.update(0.016);
      }
      
      const finalPosition = enemyEntity.components.get('transform')!.position;
      
      // Enemy should have moved during wandering
      const distanceMoved = Math.sqrt(
        Math.pow(finalPosition.x - initialPosition.x, 2) +
        Math.pow(finalPosition.z - initialPosition.z, 2)
      );
      
      expect(distanceMoved).toBeGreaterThan(0.1);
    });

    it('should respect movement speed limits', () => {
      aiComponent.setState('chase');
      aiComponent.setTargetPosition({ x: 100, y: 0, z: 0 });
      
      const initialPosition = { ...enemyEntity.components.get('transform')!.position };
      
      world.update(0.016);
      
      const finalPosition = enemyEntity.components.get('transform')!.position;
      const distanceMoved = Math.sqrt(
        Math.pow(finalPosition.x - initialPosition.x, 2) +
        Math.pow(finalPosition.z - initialPosition.z, 2)
      );
      
      const maxDistancePerFrame = enemyComponent.speed * 0.016;
      expect(distanceMoved).toBeLessThanOrEqual(maxDistancePerFrame * 1.1); // Small tolerance
    });
  });

  describe('Aggression System', () => {
    let aggroComponent: AggroComponent;
    
    beforeEach(() => {
      aggroComponent = new AggroComponent(enemyEntity.id);
      world.addComponent(enemyEntity.id, aggroComponent);
      world.start();
    });

    it('should detect player within aggro range', () => {
      // Move enemy close to player
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: 5, y: 0, z: 0 }; // Within aggro range
      
      world.update(0.016);
      
      expect(aggroComponent.hasTarget()).toBe(true);
      expect(aggroComponent.getTargetId()).toBe(playerEntity.id);
    });

    it('should not aggro player outside range', () => {
      // Keep enemy far from player
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: 50, y: 0, z: 0 }; // Outside aggro range
      
      world.update(0.016);
      
      expect(aggroComponent.hasTarget()).toBe(false);
    });

    it('should maintain aggro until deaggro range', () => {
      // Move enemy into aggro range
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: 10, y: 0, z: 0 };
      
      world.update(0.016);
      expect(aggroComponent.hasTarget()).toBe(true);
      
      // Move to intermediate distance (between aggro and deaggro)
      transform.position = { x: 20, y: 0, z: 0 };
      
      world.update(0.016);
      expect(aggroComponent.hasTarget()).toBe(true); // Should maintain aggro
      
      // Move beyond deaggro range
      transform.position = { x: 30, y: 0, z: 0 };
      
      world.update(0.016);
      expect(aggroComponent.hasTarget()).toBe(false); // Should lose aggro
    });

    it('should transition to chase state when aggroed', () => {
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: 5, y: 0, z: 0 };
      
      world.update(0.016);
      
      expect(aiComponent.getCurrentState()).toBe('chase');
    });

    it('should track aggro duration', () => {
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: 5, y: 0, z: 0 };
      
      world.update(0.016);
      
      const aggroDuration = aggroComponent.getAggroDuration();
      expect(aggroDuration).toBeGreaterThan(0);
    });

    it('should handle multiple potential targets', () => {
      // Create second player-like entity
      const player2Id = world.createEntity();
      world.addComponent(player2Id, {
        type: 'player',
        entityId: player2Id
      });
      world.addComponent(player2Id, {
        type: 'transform',
        entityId: player2Id,
        position: { x: 3, y: 0, z: 0 }, // Closer than original player
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: 5, y: 0, z: 0 };
      
      world.update(0.016);
      
      // Should target the closer player
      expect(aggroComponent.getTargetId()).toBe(player2Id);
    });
  });

  describe('Patrol Behavior', () => {
    let patrolComponent: PatrolComponent;
    
    beforeEach(() => {
      patrolComponent = new PatrolComponent(enemyEntity.id);
      patrolComponent.setPatrolPoints([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 0, z: 10 },
        { x: 0, y: 0, z: 10 }
      ]);
      
      world.addComponent(enemyEntity.id, patrolComponent);
      aiComponent.setState('patrol');
      world.start();
    });

    it('should move towards patrol points in sequence', () => {
      const currentTarget = patrolComponent.getCurrentTarget();
      expect(currentTarget).toBeDefined();
      
      const transform = enemyEntity.components.get('transform')!;
      const initialDistance = Math.sqrt(
        Math.pow(transform.position.x - currentTarget.x, 2) +
        Math.pow(transform.position.z - currentTarget.z, 2)
      );
      
      // Run multiple frames
      for (let i = 0; i < 30; i++) {
        world.update(0.016);
      }
      
      const finalDistance = Math.sqrt(
        Math.pow(transform.position.x - currentTarget.x, 2) +
        Math.pow(transform.position.z - currentTarget.z, 2)
      );
      
      expect(finalDistance).toBeLessThan(initialDistance);
    });

    it('should advance to next patrol point when reaching current', () => {
      const initialTargetIndex = patrolComponent.getCurrentTargetIndex();
      
      // Force enemy to patrol point
      const currentTarget = patrolComponent.getCurrentTarget();
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { ...currentTarget };
      
      world.update(0.016);
      
      const newTargetIndex = patrolComponent.getCurrentTargetIndex();
      expect(newTargetIndex).not.toBe(initialTargetIndex);
    });

    it('should cycle through patrol points', () => {
      const patrolPoints = patrolComponent.getPatrolPoints();
      let visitedPoints = new Set();
      
      // Run long enough to visit all points
      for (let i = 0; i < 1000; i++) {
        world.update(0.016);
        
        const currentIndex = patrolComponent.getCurrentTargetIndex();
        visitedPoints.add(currentIndex);
        
        if (visitedPoints.size === patrolPoints.length) {
          break;
        }
      }
      
      expect(visitedPoints.size).toBe(patrolPoints.length);
    });

    it('should handle dynamic patrol point changes', () => {
      const newPatrolPoints = [
        { x: 20, y: 0, z: 20 },
        { x: 30, y: 0, z: 20 }
      ];
      
      patrolComponent.setPatrolPoints(newPatrolPoints);
      
      world.update(0.016);
      
      const currentTarget = patrolComponent.getCurrentTarget();
      expect(newPatrolPoints).toContainEqual(currentTarget);
    });

    it('should pause at patrol points when configured', () => {
      patrolComponent.setPauseTime(1.0); // 1 second pause
      
      // Move to patrol point
      const currentTarget = patrolComponent.getCurrentTarget();
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { ...currentTarget };
      
      world.update(0.016);
      
      const isPaused = patrolComponent.isPaused();
      expect(isPaused).toBe(true);
      
      const pauseRemaining = patrolComponent.getPauseTimeRemaining();
      expect(pauseRemaining).toBeGreaterThan(0);
    });
  });

  describe('Navigation and Pathfinding', () => {
    let navigationComponent: NavigationComponent;
    
    beforeEach(() => {
      navigationComponent = new NavigationComponent(enemyEntity.id);
      world.addComponent(enemyEntity.id, navigationComponent);
      world.start();
    });

    it('should calculate path to destination', () => {
      const destination: Vector3 = { x: 20, y: 0, z: 15 };
      
      const pathFound = navigationComponent.setDestination(destination);
      expect(pathFound).toBe(true);
      
      const path = navigationComponent.getCurrentPath();
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(destination);
    });

    it('should follow calculated path', () => {
      const destination: Vector3 = { x: 20, y: 0, z: 15 };
      navigationComponent.setDestination(destination);
      
      const initialPosition = { ...enemyEntity.components.get('transform')!.position };
      
      // Run multiple frames to allow pathfinding
      for (let i = 0; i < 50; i++) {
        world.update(0.016);
      }
      
      const finalPosition = enemyEntity.components.get('transform')!.position;
      
      // Should move towards destination
      const initialDistanceToDestination = Math.sqrt(
        Math.pow(initialPosition.x - destination.x, 2) +
        Math.pow(initialPosition.z - destination.z, 2)
      );
      
      const finalDistanceToDestination = Math.sqrt(
        Math.pow(finalPosition.x - destination.x, 2) +
        Math.pow(finalPosition.z - destination.z, 2)
      );
      
      expect(finalDistanceToDestination).toBeLessThan(initialDistanceToDestination);
    });

    it('should handle obstacles in pathfinding', () => {
      // Add obstacle to pathfinding grid
      aiSystem.addObstacle({ x: 10, y: 0, z: 5 }, { width: 2, height: 2, depth: 2 });
      
      const destination: Vector3 = { x: 15, y: 0, z: 5 };
      navigationComponent.setDestination(destination);
      
      const path = navigationComponent.getCurrentPath();
      
      // Path should avoid obstacle
      const hasPathThroughObstacle = path.some(point => 
        Math.abs(point.x - 10) < 1 && Math.abs(point.z - 5) < 1
      );
      
      expect(hasPathThroughObstacle).toBe(false);
    });

    it('should recalculate path when blocked', () => {
      const destination: Vector3 = { x: 20, y: 0, z: 0 };
      navigationComponent.setDestination(destination);
      
      const initialPath = navigationComponent.getCurrentPath();
      
      // Add blocking obstacle mid-path
      aiSystem.addObstacle({ x: 15, y: 0, z: 0 }, { width: 3, height: 2, depth: 3 });
      
      world.update(0.016);
      
      const newPath = navigationComponent.getCurrentPath();
      expect(newPath).not.toEqual(initialPath);
    });

    it('should handle unreachable destinations', () => {
      // Surround destination with obstacles
      const destination: Vector3 = { x: 50, y: 0, z: 50 };
      
      for (let x = 48; x <= 52; x++) {
        for (let z = 48; z <= 52; z++) {
          if (x !== 50 || z !== 50) {
            aiSystem.addObstacle({ x, y: 0, z }, { width: 1, height: 2, depth: 1 });
          }
        }
      }
      
      const pathFound = navigationComponent.setDestination(destination);
      expect(pathFound).toBe(false);
    });

    it('should optimize path smoothing', () => {
      const destination: Vector3 = { x: 20, y: 0, z: 20 };
      navigationComponent.setDestination(destination);
      
      const rawPath = navigationComponent.getRawPath();
      const smoothedPath = navigationComponent.getCurrentPath();
      
      // Smoothed path should have fewer waypoints
      expect(smoothedPath.length).toBeLessThanOrEqual(rawPath.length);
    });
  });

  describe('Behavior Trees', () => {
    beforeEach(() => {
      world.start();
    });

    it('should execute behavior tree nodes', () => {
      aiComponent.setBehaviorTree('basic_enemy');
      
      world.update(0.016);
      
      const behaviorState = aiComponent.getBehaviorTreeState();
      expect(behaviorState.rootNode).toBeDefined();
      expect(behaviorState.currentNode).toBeDefined();
    });

    it('should handle composite nodes', () => {
      aiComponent.setBehaviorTree('patrol_and_chase');
      
      const behaviorManager = aiSystem.getBehaviorManager();
      const tree = behaviorManager.getTree('patrol_and_chase');
      
      expect(tree.hasCompositeNodes()).toBe(true);
    });

    it('should evaluate conditions correctly', () => {
      aiComponent.setBehaviorTree('conditional_behavior');
      
      // Set up condition for behavior tree
      aiComponent.setBlackboardValue('player_in_range', false);
      
      world.update(0.016);
      
      const currentState = aiComponent.getCurrentState();
      expect(currentState).toBe('patrol'); // Should default to patrol
      
      // Change condition
      aiComponent.setBlackboardValue('player_in_range', true);
      
      world.update(0.016);
      
      const newState = aiComponent.getCurrentState();
      expect(newState).toBe('chase'); // Should switch to chase
    });

    it('should share data through blackboard', () => {
      aiComponent.setBlackboardValue('last_known_player_position', { x: 5, y: 0, z: 5 });
      
      const value = aiComponent.getBlackboardValue('last_known_player_position');
      expect(value).toEqual({ x: 5, y: 0, z: 5 });
    });

    it('should handle behavior tree failures gracefully', () => {
      aiComponent.setBehaviorTree('invalid_tree');
      
      expect(() => world.update(0.016)).not.toThrow();
      
      // Should fallback to default behavior
      const currentState = aiComponent.getCurrentState();
      expect(currentState).toBe('idle');
    });
  });

  describe('Enemy Types and Specialization', () => {
    it('should create different enemy types with unique behaviors', () => {
      const bearId = world.createEntity();
      const bearAI = new AIComponent(bearId);
      const bearEnemy = new EnemyComponent(bearId, 'bear');
      
      world.addComponent(bearId, bearAI);
      world.addComponent(bearId, bearEnemy);
      world.addComponent(bearId, {
        type: 'transform',
        entityId: bearId,
        position: { x: 15, y: 0, z: 15 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      world.start();
      world.update(0.016);
      
      expect(bearEnemy.type).toBe('bear');
      expect(bearEnemy.speed).not.toBe(enemyComponent.speed); // Different stats
    });

    it('should handle flying enemies differently', () => {
      const birdId = world.createEntity();
      const birdAI = new AIComponent(birdId);
      const birdEnemy = new EnemyComponent(birdId, 'bird');
      birdEnemy.canFly = true;
      
      world.addComponent(birdId, birdAI);
      world.addComponent(birdId, birdEnemy);
      world.addComponent(birdId, {
        type: 'transform',
        entityId: birdId,
        position: { x: 0, y: 10, z: 0 }, // Start in air
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      world.start();
      world.update(0.016);
      
      // Flying enemies should use 3D pathfinding
      const navigation = birdAI.getNavigationComponent();
      expect(navigation?.use3DPathfinding()).toBe(true);
    });

    it('should implement pack behavior for group enemies', () => {
      const pack = [];
      
      // Create pack of wolves
      for (let i = 0; i < 3; i++) {
        const wolfId = world.createEntity();
        const wolfAI = new AIComponent(wolfId);
        const wolfEnemy = new EnemyComponent(wolfId, 'wolf');
        wolfEnemy.packBehavior = true;
        
        world.addComponent(wolfId, wolfAI);
        world.addComponent(wolfId, wolfEnemy);
        world.addComponent(wolfId, {
          type: 'transform',
          entityId: wolfId,
          position: { x: i * 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        pack.push(wolfId);
      }
      
      // Set pack relationships
      pack.forEach(wolfId => {
        const wolfAI = world.getEntity(wolfId)?.components.get('ai') as AIComponent;
        wolfAI.setPackMembers(pack.filter(id => id !== wolfId));
      });
      
      world.start();
      world.update(0.016);
      
      // Pack members should coordinate behavior
      const packLeader = pack[0];
      const leaderAI = world.getEntity(packLeader)?.components.get('ai') as AIComponent;
      expect(leaderAI.isPackLeader()).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(() => {
      world.start();
    });

    it('should limit active AI entities for performance', () => {
      // Create many enemies
      const enemies = [];
      for (let i = 0; i < 20; i++) {
        const enemyId = world.createEntity();
        const ai = new AIComponent(enemyId);
        const enemy = new EnemyComponent(enemyId, 'basic');
        
        world.addComponent(enemyId, ai);
        world.addComponent(enemyId, enemy);
        world.addComponent(enemyId, {
          type: 'transform',
          entityId: enemyId,
          position: { x: i * 5, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        enemies.push(enemyId);
      }
      
      world.update(0.016);
      
      const stats = aiSystem.getStats();
      expect(stats.activeAIEntities).toBeLessThanOrEqual(aiSystem.getConfig().maxSimultaneousEnemies);
    });

    it('should use LOD for distant enemies', () => {
      // Create enemy far from player
      const distantEnemyId = world.createEntity();
      const distantAI = new AIComponent(distantEnemyId);
      const distantEnemy = new EnemyComponent(distantEnemyId, 'basic');
      
      world.addComponent(distantEnemyId, distantAI);
      world.addComponent(distantEnemyId, distantEnemy);
      world.addComponent(distantEnemyId, {
        type: 'transform',
        entityId: distantEnemyId,
        position: { x: 100, y: 0, z: 100 }, // Very far from player
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      world.update(0.016);
      
      expect(distantAI.getLODLevel()).toBeGreaterThan(0); // Reduced LOD
      expect(distantAI.getUpdateFrequency()).toBeLessThan(60); // Reduced update rate
    });

    it('should prioritize AI updates by importance', () => {
      // Create enemy close to player (high priority)
      const closeEnemyId = world.createEntity();
      const closeAI = new AIComponent(closeEnemyId);
      
      world.addComponent(closeEnemyId, closeAI);
      world.addComponent(closeEnemyId, new EnemyComponent(closeEnemyId, 'basic'));
      world.addComponent(closeEnemyId, {
        type: 'transform',
        entityId: closeEnemyId,
        position: { x: 2, y: 0, z: 2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      world.update(0.016);
      
      expect(closeAI.getUpdatePriority()).toBeGreaterThan(aiComponent.getUpdatePriority());
    });

    it('should batch pathfinding requests', () => {
      // Create multiple enemies needing pathfinding
      const enemies = [];
      for (let i = 0; i < 5; i++) {
        const enemyId = world.createEntity();
        const ai = new AIComponent(enemyId);
        const navigation = new NavigationComponent(enemyId);
        
        world.addComponent(enemyId, ai);
        world.addComponent(enemyId, navigation);
        world.addComponent(enemyId, new EnemyComponent(enemyId, 'basic'));
        world.addComponent(enemyId, {
          type: 'transform',
          entityId: enemyId,
          position: { x: i * 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        // Request pathfinding for all
        navigation.setDestination({ x: 20, y: 0, z: 20 });
        enemies.push(enemyId);
      }
      
      world.update(0.016);
      
      const pathfindingStats = aiSystem.getPathfindingStats();
      expect(pathfindingStats.batchedRequests).toBeGreaterThan(0);
    });

    it('should maintain performance under load', () => {
      // Create maximum allowed enemies
      const maxEnemies = aiSystem.getConfig().maxSimultaneousEnemies;
      
      for (let i = 0; i < maxEnemies; i++) {
        const enemyId = world.createEntity();
        const ai = new AIComponent(enemyId);
        ai.setState('chase'); // Most expensive state
        
        world.addComponent(enemyId, ai);
        world.addComponent(enemyId, new EnemyComponent(enemyId, 'basic'));
        world.addComponent(enemyId, new NavigationComponent(enemyId));
        world.addComponent(enemyId, {
          type: 'transform',
          entityId: enemyId,
          position: { x: Math.random() * 50, y: 0, z: Math.random() * 50 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }
      
      const startTime = performance.now();
      world.update(0.016);
      const updateTime = performance.now() - startTime;
      
      expect(updateTime).toBeLessThan(16); // Should maintain 60fps
    });
  });

  describe('Mobile Optimizations', () => {
    let mobileAISystem: AISystem;
    
    beforeEach(() => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      
      mobileAISystem = new AISystem({
        maxSimultaneousEnemies: 5, // Reduced for mobile
        aggroRange: 10.0, // Reduced range
        pathfindingEnabled: true,
        behaviorTreeEnabled: false, // Disabled for performance
        mobileOptimized: true
      });
      
      world.addSystem(mobileAISystem);
      world.start();
    });

    it('should reduce maximum concurrent enemies on mobile', () => {
      const config = mobileAISystem.getConfig();
      expect(config.maxSimultaneousEnemies).toBe(5);
    });

    it('should disable expensive features on mobile', () => {
      const config = mobileAISystem.getConfig();
      expect(config.behaviorTreeEnabled).toBe(false);
    });

    it('should use simplified pathfinding on mobile', () => {
      const pathfinder = mobileAISystem.getPathfinder();
      expect(pathfinder.getComplexity()).toBe('simple');
    });

    it('should reduce update frequency on mobile', () => {
      const targetFramerate = mobileAISystem.getTargetFramerate();
      expect(targetFramerate).toBeLessThan(60);
    });
  });

  describe('Debug and Visualization', () => {
    beforeEach(() => {
      aiSystem.enableDebugVisualization(true);
      world.start();
    });

    it('should provide debug information', () => {
      world.update(0.016);
      
      const debugInfo = aiSystem.getDebugInfo();
      expect(debugInfo.activeEntities).toBeGreaterThan(0);
      expect(debugInfo.stateDistribution).toBeDefined();
    });

    it('should visualize AI states', () => {
      aiComponent.setState('chase');
      world.update(0.016);
      
      const visualDebugData = aiSystem.getVisualDebugData();
      expect(visualDebugData.entities).toHaveLength(1);
      expect(visualDebugData.entities[0].state).toBe('chase');
    });

    it('should show pathfinding debug data', () => {
      const navigation = new NavigationComponent(enemyEntity.id);
      world.addComponent(enemyEntity.id, navigation);
      
      navigation.setDestination({ x: 15, y: 0, z: 15 });
      world.update(0.016);
      
      const debugData = aiSystem.getPathfindingDebugData();
      expect(debugData.activePaths).toHaveLength(1);
    });

    it('should track performance metrics', () => {
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      const metrics = aiSystem.getPerformanceMetrics();
      expect(metrics.averageUpdateTime).toBeGreaterThan(0);
      expect(metrics.peakUpdateTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle entities without required components', () => {
      // Create entity with only AI component
      const incompleteId = world.createEntity();
      world.addComponent(incompleteId, new AIComponent(incompleteId));
      
      world.start();
      expect(() => world.update(0.016)).not.toThrow();
    });

    it('should handle invalid behavior tree references', () => {
      aiComponent.setBehaviorTree('non_existent_tree');
      
      world.start();
      expect(() => world.update(0.016)).not.toThrow();
      
      // Should fallback to default state
      expect(aiComponent.getCurrentState()).toBe('idle');
    });

    it('should handle NaN positions gracefully', () => {
      const transform = enemyEntity.components.get('transform')!;
      transform.position = { x: NaN, y: NaN, z: NaN };
      
      world.start();
      expect(() => world.update(0.016)).not.toThrow();
      
      // Position should be reset to safe value
      expect(isNaN(transform.position.x)).toBe(false);
    });

    it('should handle pathfinding failures', () => {
      const navigation = new NavigationComponent(enemyEntity.id);
      world.addComponent(enemyEntity.id, navigation);
      
      // Request path to invalid position
      navigation.setDestination({ x: Infinity, y: 0, z: Infinity });
      
      world.start();
      expect(() => world.update(0.016)).not.toThrow();
    });

    it('should handle state machine corruption', () => {
      // Corrupt state machine
      aiComponent.setState('invalid_state');
      
      world.start();
      world.update(0.016);
      
      // Should recover to valid state
      const validStates = ['idle', 'patrol', 'chase', 'attack', 'flee', 'wander'];
      expect(validStates).toContain(aiComponent.getCurrentState());
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clean up AI resources on entity destruction', () => {
      world.start();
      world.update(0.016);
      
      const initialActiveCount = aiSystem.getStats().activeAIEntities;
      
      world.destroyEntity(enemyEntity.id);
      world.update(0.016);
      
      const finalActiveCount = aiSystem.getStats().activeAIEntities;
      expect(finalActiveCount).toBe(initialActiveCount - 1);
    });

    it('should clean up pathfinding data', () => {
      const navigation = new NavigationComponent(enemyEntity.id);
      world.addComponent(enemyEntity.id, navigation);
      
      navigation.setDestination({ x: 20, y: 0, z: 20 });
      world.start();
      world.update(0.016);
      
      world.destroyEntity(enemyEntity.id);
      world.update(0.016);
      
      const pathfindingStats = aiSystem.getPathfindingStats();
      expect(pathfindingStats.activePaths).toBe(0);
    });

    it('should handle system destruction gracefully', () => {
      world.start();
      world.update(0.016);
      
      aiSystem.destroy();
      
      expect(() => world.update(0.016)).not.toThrow();
    });
  });
});