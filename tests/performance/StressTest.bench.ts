import { bench, describe } from 'vitest';
import { PerformanceTestUtils } from './setup-performance';
import { World } from '@/core/ecs/World';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { PlayerSystem } from '@/systems/PlayerSystem';
import { AISystem } from '@/systems/ai/AISystem';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { PowerupManager } from '@/powerups/PowerupManager';
import { PlayerComponent } from '@/components/PlayerComponent';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import { AIComponent } from '@/components/ai/AIComponent';
import { EnemyComponent } from '@/components/ai/EnemyComponent';
import type { Entity } from '@/types';

describe('Performance Stress Tests', () => {
  describe('Entity Management Benchmarks', () => {
    bench('Create 1000 entities with components', async () => {
      const world = new World({ maxEntities: 2000 });
      
      await PerformanceTestUtils.measureAsync('entity-creation', async () => {
        for (let i = 0; i < 1000; i++) {
          const entityId = world.createEntity();
          
          world.addComponent(entityId, {
            type: 'transform',
            entityId,
            position: { x: Math.random() * 1000, y: 0, z: Math.random() * 1000 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          });
          
          if (i % 3 === 0) {
            world.addComponent(entityId, new PhysicsComponent(entityId));
          }
          
          if (i % 5 === 0) {
            world.addComponent(entityId, new PlayerComponent(entityId));
          }
          
          if (i % 7 === 0) {
            world.addComponent(entityId, new AIComponent(entityId));
            world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
          }
        }
      }, 100); // Should complete in under 100ms
    });

    bench('Query 1000 entities by component', () => {
      const world = new World();
      
      // Setup entities
      for (let i = 0; i < 1000; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        if (i % 2 === 0) {
          world.addComponent(entityId, new PhysicsComponent(entityId));
        }
      }
      
      PerformanceTestUtils.measure('entity-query', () => {
        const entities = world.getEntitiesWithComponents(['transform', 'physics']);
        return entities.length;
      }, 5); // Should complete in under 5ms
    });

    bench('Mass entity destruction', () => {
      const world = new World();
      const entities = [];
      
      // Create entities
      for (let i = 0; i < 1000; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        entities.push(entityId);
      }
      
      PerformanceTestUtils.measure('mass-destruction', () => {
        entities.forEach(id => world.destroyEntity(id));
      }, 50); // Should complete in under 50ms
    });
  });

  describe('Physics System Benchmarks', () => {
    bench('Physics simulation with 500 dynamic bodies', async () => {
      const world = new World();
      const physicsSystem = new PhysicsSystem({
        gravity: { x: 0, y: -9.81, z: 0 },
        enableCollision: true,
        solverIterations: 4
      });
      world.addSystem(physicsSystem);
      
      // Create physics entities
      for (let i = 0; i < 500; i++) {
        const entityId = world.createEntity();
        const physics = new PhysicsComponent(entityId);
        physics.setVelocity({
          x: (Math.random() - 0.5) * 20,
          y: Math.random() * 10,
          z: (Math.random() - 0.5) * 20
        });
        
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { 
            x: (Math.random() - 0.5) * 100, 
            y: Math.random() * 50, 
            z: (Math.random() - 0.5) * 100 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        world.addComponent(entityId, physics);
      }
      
      world.start();
      
      await PerformanceTestUtils.measureAsync('physics-simulation', async () => {
        for (let frame = 0; frame < 60; frame++) {
          world.update(0.016);
        }
      }, 1000); // 60 frames should complete in under 1 second
    });

    bench('Collision detection stress test', () => {
      const world = new World();
      const physicsSystem = new PhysicsSystem({
        enableCollision: true,
        spatialGridCellSize: 5.0
      });
      world.addSystem(physicsSystem);
      
      // Create overlapping entities for maximum collision checks
      for (let i = 0; i < 200; i++) {
        const entityId = world.createEntity();
        const physics = new PhysicsComponent(entityId);
        
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { 
            x: Math.random() * 20, // Concentrated area for collisions
            y: 1, 
            z: Math.random() * 20 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        world.addComponent(entityId, physics);
      }
      
      world.start();
      
      PerformanceTestUtils.measure('collision-detection', () => {
        world.update(0.016);
        return physicsSystem.getStats().collisionChecks;
      }, 16); // Should maintain 60fps
    });

    bench('Raycast performance with 1000 entities', () => {
      const world = new World();
      const physicsSystem = new PhysicsSystem();
      world.addSystem(physicsSystem);
      
      // Create target entities
      for (let i = 0; i < 1000; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { 
            x: (Math.random() - 0.5) * 200, 
            y: Math.random() * 10, 
            z: (Math.random() - 0.5) * 200 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        world.addComponent(entityId, new PhysicsComponent(entityId));
      }
      
      world.start();
      world.update(0.016); // Initialize spatial grid
      
      PerformanceTestUtils.measure('raycast-performance', () => {
        const results = [];
        for (let i = 0; i < 100; i++) {
          const origin = { x: 0, y: 5, z: 0 };
          const direction = { 
            x: Math.random() - 0.5, 
            y: -0.5, 
            z: Math.random() - 0.5 
          };
          
          const result = physicsSystem.raycast(origin, direction, 100);
          results.push(result);
        }
        return results.length;
      }, 10); // 100 raycasts should complete in under 10ms
    });
  });

  describe('AI System Benchmarks', () => {
    bench('AI pathfinding with 50 enemies', async () => {
      const world = new World();
      const aiSystem = new AISystem({
        maxSimultaneousEnemies: 50,
        pathfindingEnabled: true
      });
      world.addSystem(aiSystem);
      
      // Create player
      const playerId = world.createEntity();
      world.addComponent(playerId, { type: 'player', entityId: playerId });
      world.addComponent(playerId, {
        type: 'transform',
        entityId: playerId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      // Create AI enemies
      for (let i = 0; i < 50; i++) {
        const enemyId = world.createEntity();
        const ai = new AIComponent(enemyId);
        ai.setState('chase');
        
        world.addComponent(enemyId, ai);
        world.addComponent(enemyId, new EnemyComponent(enemyId, 'basic'));
        world.addComponent(enemyId, {
          type: 'transform',
          entityId: enemyId,
          position: { 
            x: (Math.random() - 0.5) * 100, 
            y: 0, 
            z: (Math.random() - 0.5) * 100 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }
      
      world.start();
      
      await PerformanceTestUtils.measureAsync('ai-pathfinding', async () => {
        for (let frame = 0; frame < 30; frame++) {
          world.update(0.016);
        }
      }, 500); // 30 frames should complete in under 500ms
    });

    bench('AI behavior tree evaluation', () => {
      const world = new World();
      const aiSystem = new AISystem({
        behaviorTreeEnabled: true,
        maxSimultaneousEnemies: 100
      });
      world.addSystem(aiSystem);
      
      // Create AI entities with behavior trees
      for (let i = 0; i < 100; i++) {
        const entityId = world.createEntity();
        const ai = new AIComponent(entityId);
        ai.setBehaviorTree('basic_enemy');
        
        world.addComponent(entityId, ai);
        world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }
      
      world.start();
      
      PerformanceTestUtils.measure('behavior-trees', () => {
        world.update(0.016);
        return aiSystem.getStats().activeAIEntities;
      }, 8); // Should complete in under 8ms for 60fps
    });
  });

  describe('Terrain System Benchmarks', () => {
    bench('Terrain generation and LOD', async () => {
      const world = new World();
      const terrainSystem = new TerrainSystem({
        chunkSize: 32,
        viewDistance: 5,
        lodLevels: 3,
        enableGPUGeneration: true
      });
      world.addSystem(terrainSystem);
      
      world.start();
      
      await PerformanceTestUtils.measureAsync('terrain-generation', async () => {
        // Simulate player movement requiring terrain generation
        const positions = [
          { x: 0, y: 0, z: 0 },
          { x: 100, y: 0, z: 0 },
          { x: 100, y: 0, z: 100 },
          { x: 0, y: 0, z: 100 },
          { x: -100, y: 0, z: 0 }
        ];
        
        for (const pos of positions) {
          terrainSystem.updatePlayerPosition(pos);
          
          // Allow several frames for chunk loading
          for (let i = 0; i < 5; i++) {
            world.update(0.016);
          }
        }
      }, 2000); // Should complete in under 2 seconds
    });

    bench('Height queries with spatial optimization', () => {
      const world = new World();
      const terrainSystem = new TerrainSystem({
        chunkSize: 64,
        viewDistance: 3
      });
      world.addSystem(terrainSystem);
      
      world.start();
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      PerformanceTestUtils.measure('height-queries', () => {
        let totalHeight = 0;
        
        for (let i = 0; i < 1000; i++) {
          const pos = {
            x: (Math.random() - 0.5) * 200,
            y: 0,
            z: (Math.random() - 0.5) * 200
          };
          
          totalHeight += terrainSystem.getHeightAtPosition(pos);
        }
        
        return totalHeight;
      }, 5); // 1000 height queries in under 5ms
    });
  });

  describe('Powerup System Benchmarks', () => {
    bench('Powerup spawning and collection', () => {
      const world = new World();
      const powerupManager = new PowerupManager(world, {
        enableParticleEffects: true,
        maxConcurrentPowerups: 100
      });
      
      PerformanceTestUtils.measure('powerup-operations', () => {
        // Spawn many powerups
        for (let i = 0; i < 50; i++) {
          const position = { 
            x: (Math.random() - 0.5) * 100, 
            y: 1, 
            z: (Math.random() - 0.5) * 100 
          };
          powerupManager.spawnMagnetPowerup(position);
        }
        
        // Update system
        powerupManager.update(0.016);
        
        // Get all particles (tests visual effects performance)
        const particles = powerupManager.getAllParticles();
        return particles.length;
      }, 10); // Should complete in under 10ms
    });

    bench('Magnet system with 200 collectibles', () => {
      const world = new World();
      const powerupManager = new PowerupManager(world);
      
      // Create player
      const playerId = world.createEntity();
      world.addComponent(playerId, { type: 'player', entityId: playerId });
      world.addComponent(playerId, {
        type: 'transform',
        entityId: playerId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      // Create collectibles
      for (let i = 0; i < 200; i++) {
        const collectibleId = world.createEntity();
        world.addComponent(collectibleId, {
          type: 'collectible',
          entityId: collectibleId
        });
        world.addComponent(collectibleId, {
          type: 'transform',
          entityId: collectibleId,
          position: { 
            x: (Math.random() - 0.5) * 50, 
            y: 0, 
            z: (Math.random() - 0.5) * 50 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }
      
      // Activate magnet
      const magnetPowerup = powerupManager.spawnMagnetPowerup({ x: 1, y: 0, z: 0 });
      powerupManager.forceCollectPowerup(magnetPowerup.id);
      
      PerformanceTestUtils.measure('magnet-system', () => {
        powerupManager.update(0.016);
      }, 8); // Should complete in under 8ms for 60fps
    });
  });

  describe('Memory and Garbage Collection', () => {
    bench('Memory allocation patterns', () => {
      const world = new World();
      const initialMemory = PerformanceTestUtils.getMemoryUsage();
      
      PerformanceTestUtils.measure('memory-test', () => {
        // Create and destroy entities in cycles
        for (let cycle = 0; cycle < 10; cycle++) {
          const entities = [];
          
          // Create phase
          for (let i = 0; i < 100; i++) {
            const entityId = world.createEntity();
            world.addComponent(entityId, {
              type: 'transform',
              entityId,
              position: { x: i, y: 0, z: cycle },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            });
            entities.push(entityId);
          }
          
          // Destroy phase
          entities.forEach(id => world.destroyEntity(id));
        }
        
        const finalMemory = PerformanceTestUtils.getMemoryUsage();
        return finalMemory.used - initialMemory.used;
      }, 100); // Should complete in under 100ms
    });

    bench('Object pool efficiency', () => {
      const world = new World({ enableObjectPooling: true });
      
      // Register pooled components
      world.registerComponent('physics', () => new PhysicsComponent(0), 200);
      world.registerComponent('player', () => new PlayerComponent(0), 50);
      
      PerformanceTestUtils.measure('object-pooling', () => {
        const entities = [];
        
        // Create entities using pools
        for (let i = 0; i < 100; i++) {
          const entityId = world.createEntity();
          
          const physics = world.createComponent<PhysicsComponent>(entityId, 'physics');
          const player = world.createComponent<PlayerComponent>(entityId, 'player');
          
          if (physics) world.addComponent(entityId, physics);
          if (player) world.addComponent(entityId, player);
          
          entities.push(entityId);
        }
        
        // Return to pools
        entities.forEach(id => world.destroyEntity(id));
        
        return entities.length;
      }, 20); // Should be fast with pooling
    });
  });

  describe('Mobile Performance Simulation', () => {
    bench('Low-end mobile simulation', async () => {
      // Simulate low-end mobile device
      PerformanceTestUtils.simulateLowEndDevice();
      
      const world = new World();
      const physicsSystem = new PhysicsSystem({
        enableCollision: true,
        solverIterations: 2 // Reduced for mobile
      });
      const aiSystem = new AISystem({
        maxSimultaneousEnemies: 3, // Very limited for low-end
        behaviorTreeEnabled: false
      });
      
      world.addSystem(physicsSystem);
      world.addSystem(aiSystem);
      
      // Create limited entities for mobile
      for (let i = 0; i < 20; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: i * 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        if (i % 4 === 0) {
          world.addComponent(entityId, new PhysicsComponent(entityId));
        }
        
        if (i % 6 === 0 && i < 6) { // Only 1-2 AI entities
          world.addComponent(entityId, new AIComponent(entityId));
          world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
        }
      }
      
      world.start();
      
      await PerformanceTestUtils.measureAsync('mobile-simulation', async () => {
        // Simulate 2 seconds of gameplay at 30fps
        for (let frame = 0; frame < 60; frame++) {
          world.update(0.033); // 30fps
        }
      }, 3000); // Should complete in under 3 seconds even on simulated low-end
    });

    bench('Battery optimization mode', () => {
      const world = new World();
      const powerupManager = new PowerupManager(world, {
        mobileOptimized: true,
        performanceMode: 'low',
        enableParticleEffects: false
      });
      
      // Enable battery optimization
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({ level: 0.15 }), // Low battery
        writable: true
      });
      
      PerformanceTestUtils.measure('battery-mode', () => {
        // Reduced operations for battery saving
        for (let i = 0; i < 10; i++) {
          powerupManager.spawnMagnetPowerup({ x: i, y: 0, z: 0 });
        }
        
        powerupManager.update(0.033); // 30fps for battery saving
        
        const stats = powerupManager.getStats();
        return stats.performance.adaptiveQuality;
      }, 5); // Should be very fast in battery mode
    });
  });

  describe('Concurrent Operations', () => {
    bench('Parallel system updates', async () => {
      const world = new World();
      const systems = [
        new PhysicsSystem(),
        new AISystem({ maxSimultaneousEnemies: 10 }),
        new TerrainSystem({ viewDistance: 2 })
      ];
      
      systems.forEach(system => world.addSystem(system));
      
      // Create varied entities
      for (let i = 0; i < 100; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        if (i % 3 === 0) world.addComponent(entityId, new PhysicsComponent(entityId));
        if (i % 5 === 0) {
          world.addComponent(entityId, new AIComponent(entityId));
          world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
        }
      }
      
      world.start();
      
      await PerformanceTestUtils.measureAsync('parallel-systems', async () => {
        for (let frame = 0; frame < 60; frame++) {
          world.update(0.016);
        }
      }, 1000); // 60 frames of all systems should complete in under 1 second
    });

    bench('Stress test with all systems', async () => {
      const world = new World();
      
      // Add all major systems
      world.addSystem(new PhysicsSystem({ enableCollision: true }));
      world.addSystem(new PlayerSystem());
      world.addSystem(new AISystem({ maxSimultaneousEnemies: 15 }));
      world.addSystem(new TerrainSystem({ viewDistance: 3 }));
      
      const powerupManager = new PowerupManager(world);
      
      // Create maximum viable entity load
      for (let i = 0; i < 200; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { 
            x: (Math.random() - 0.5) * 200, 
            y: 0, 
            z: (Math.random() - 0.5) * 200 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        if (i % 2 === 0) world.addComponent(entityId, new PhysicsComponent(entityId));
        if (i % 8 === 0) world.addComponent(entityId, new PlayerComponent(entityId));
        if (i % 6 === 0 && i < 30) {
          world.addComponent(entityId, new AIComponent(entityId));
          world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
        }
        if (i % 10 === 0) {
          world.addComponent(entityId, { type: 'collectible', entityId });
        }
      }
      
      world.start();
      
      await PerformanceTestUtils.measureAsync('full-stress-test', async () => {
        for (let frame = 0; frame < 180; frame++) { // 3 seconds at 60fps
          world.update(0.016);
          if (frame % 10 === 0) {
            powerupManager.update(0.016);
          }
        }
      }, 5000); // Should complete 3 seconds of gameplay in under 5 seconds real time
    });
  });
});

// Additional utility benchmarks
describe('Utility Performance Tests', () => {
  bench('Component archetype switching', () => {
    const world = new World();
    const entityId = world.createEntity();
    
    PerformanceTestUtils.measure('archetype-switching', () => {
      // Add and remove components to trigger archetype changes
      for (let i = 0; i < 100; i++) {
        world.addComponent(entityId, new PhysicsComponent(entityId));
        world.addComponent(entityId, new PlayerComponent(entityId));
        world.addComponent(entityId, new AIComponent(entityId));
        
        world.removeComponent(entityId, 'physics');
        world.removeComponent(entityId, 'player');
        world.removeComponent(entityId, 'ai');
      }
    }, 50); // Should handle archetype switching efficiently
  });

  bench('Spatial queries', () => {
    const world = new World();
    const physicsSystem = new PhysicsSystem({
      spatialGridCellSize: 10.0
    });
    world.addSystem(physicsSystem);
    
    // Create spatially distributed entities
    for (let x = 0; x < 50; x++) {
      for (let z = 0; z < 50; z++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: x * 5, y: 0, z: z * 5 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        world.addComponent(entityId, new PhysicsComponent(entityId));
      }
    }
    
    world.start();
    world.update(0.016); // Initialize spatial grid
    
    PerformanceTestUtils.measure('spatial-queries', () => {
      let totalResults = 0;
      
      for (let i = 0; i < 100; i++) {
        const origin = { 
          x: Math.random() * 250, 
          y: 5, 
          z: Math.random() * 250 
        };
        const direction = { x: 0, y: -1, z: 0 };
        
        const result = physicsSystem.raycast(origin, direction, 10);
        if (result.hit) totalResults++;
      }
      
      return totalResults;
    }, 20); // Spatial queries should be very fast
  });
});