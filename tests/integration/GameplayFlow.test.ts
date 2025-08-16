import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@/core/ecs/World';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { PlayerSystem } from '@/systems/PlayerSystem';
import { AISystem } from '@/systems/ai/AISystem';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { PowerupManager } from '@/powerups/PowerupManager';
import { ScoreSystem } from '@/systems/score/ScoreSystem';
import { PlayerComponent } from '@/components/PlayerComponent';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import { AIComponent } from '@/components/ai/AIComponent';
import { EnemyComponent } from '@/components/ai/EnemyComponent';
import { PowerupType } from '@/powerups/types/PowerupTypes';
import type { Entity, Vector3 } from '@/types';

describe('Gameplay Flow Integration Tests', () => {
  let world: World;
  let physicsSystem: PhysicsSystem;
  let playerSystem: PlayerSystem;
  let aiSystem: AISystem;
  let terrainSystem: TerrainSystem;
  let powerupManager: PowerupManager;
  let scoreSystem: ScoreSystem;
  let playerEntity: Entity;
  let playerComponent: PlayerComponent;
  let physicsComponent: PhysicsComponent;

  beforeEach(() => {
    world = new World({ enableProfiling: true });
    
    // Initialize systems
    physicsSystem = new PhysicsSystem({
      gravity: { x: 0, y: -9.81, z: 0 },
      timeStep: 1/60,
      enableCollision: true
    });
    
    playerSystem = new PlayerSystem();
    
    aiSystem = new AISystem({
      maxSimultaneousEnemies: 5,
      aggroRange: 15.0,
      pathfindingEnabled: true
    });
    
    terrainSystem = new TerrainSystem({
      chunkSize: 32,
      viewDistance: 3,
      enableCollision: true
    });
    
    scoreSystem = new ScoreSystem();
    powerupManager = new PowerupManager(world);
    
    // Add systems to world
    world.addSystem(physicsSystem);
    world.addSystem(playerSystem);
    world.addSystem(aiSystem);
    world.addSystem(terrainSystem);
    world.addSystem(scoreSystem);
    
    // Create player entity
    const playerId = world.createEntity();
    playerComponent = new PlayerComponent(playerId);
    physicsComponent = new PhysicsComponent(playerId);
    
    world.addComponent(playerId, playerComponent);
    world.addComponent(playerId, physicsComponent);
    world.addComponent(playerId, {
      type: 'player',
      entityId: playerId
    });
    world.addComponent(playerId, {
      type: 'transform',
      entityId: playerId,
      position: { x: 0, y: 2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    
    playerEntity = world.getEntity(playerId)!;
    
    world.start();
  });

  describe('Player Movement and Physics Integration', () => {
    it('should handle player movement with physics constraints', () => {
      const initialPosition = { ...playerEntity.components.get('transform')!.position };
      
      // Apply player input
      playerComponent.applySteering(1.0, 0.016); // Full right steering
      playerComponent.accelerate(0.016);
      
      // Update physics and systems
      for (let i = 0; i < 30; i++) {
        world.update(0.016);
      }
      
      const finalPosition = playerEntity.components.get('transform')!.position;
      
      // Player should have moved
      expect(finalPosition.x).not.toBe(initialPosition.x);
      expect(finalPosition.z).not.toBe(initialPosition.z);
      
      // Physics should keep player grounded
      expect(physicsComponent.isGrounded).toBe(true);
      expect(finalPosition.y).toBeCloseTo(2, 1); // Should stay near ground level
    });

    it('should handle player jumping and gravity', () => {
      const initialY = playerEntity.components.get('transform')!.position.y;
      
      // Player jumps
      const jumped = playerComponent.jump();
      expect(jumped).toBe(true);
      
      // Should be airborne initially
      world.update(0.016);
      expect(physicsComponent.isGrounded).toBe(false);
      expect(physicsComponent.verticalVelocity).toBeGreaterThan(0);
      
      // Should fall back down due to gravity
      for (let i = 0; i < 100; i++) {
        world.update(0.016);
        if (physicsComponent.isGrounded) break;
      }
      
      expect(physicsComponent.isGrounded).toBe(true);
      expect(playerEntity.components.get('transform')!.position.y).toBeCloseTo(initialY, 1);
    });

    it('should handle collision with terrain', () => {
      // Move player to ensure terrain is loaded
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      // Get terrain height at player position
      const playerPos = playerEntity.components.get('transform')!.position;
      const terrainHeight = terrainSystem.getHeightAtPosition(playerPos);
      
      // Player should be positioned correctly relative to terrain
      expect(playerPos.y).toBeGreaterThanOrEqual(terrainHeight);
    });

    it('should maintain physics stability during high-speed movement', () => {
      // Set very high speed
      playerComponent.currentSpeed = playerComponent.maxSpeed;
      physicsComponent.setVelocity({ x: 50, y: 0, z: 50 });
      
      let previousPosition = { ...playerEntity.components.get('transform')!.position };
      
      // Update for several frames
      for (let i = 0; i < 20; i++) {
        world.update(0.016);
        
        const currentPosition = playerEntity.components.get('transform')!.position;
        
        // Verify no teleportation or NaN values
        expect(isNaN(currentPosition.x)).toBe(false);
        expect(isNaN(currentPosition.y)).toBe(false);
        expect(isNaN(currentPosition.z)).toBe(false);
        
        const distance = Math.sqrt(
          Math.pow(currentPosition.x - previousPosition.x, 2) +
          Math.pow(currentPosition.z - previousPosition.z, 2)
        );
        
        // Movement should be reasonable per frame
        expect(distance).toBeLessThan(10); // Max 10 units per frame
        
        previousPosition = { ...currentPosition };
      }
    });
  });

  describe('AI and Player Interaction', () => {
    let enemyEntity: Entity;
    let enemyAI: AIComponent;
    let enemyComponent: EnemyComponent;
    
    beforeEach(() => {
      // Create enemy
      const enemyId = world.createEntity();
      enemyAI = new AIComponent(enemyId);
      enemyComponent = new EnemyComponent(enemyId, 'basic');
      
      world.addComponent(enemyId, enemyAI);
      world.addComponent(enemyId, enemyComponent);
      world.addComponent(enemyId, {
        type: 'transform',
        entityId: enemyId,
        position: { x: 20, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      enemyEntity = world.getEntity(enemyId)!;
      world.update(0.016); // Initialize systems
    });

    it('should detect player and initiate chase', () => {
      // Move enemy close to player
      const enemyTransform = enemyEntity.components.get('transform')!;
      enemyTransform.position = { x: 10, y: 2, z: 0 }; // Within aggro range
      
      // Run several frames to allow AI processing
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      // Enemy should enter chase state
      expect(enemyAI.getCurrentState()).toBe('chase');
    });

    it('should handle player-enemy collision', () => {
      // Position enemy very close to player
      const enemyTransform = enemyEntity.components.get('transform')!;
      enemyTransform.position = { x: 0.5, y: 2, z: 0 };
      
      // Add physics component to enemy for collision
      const enemyPhysics = new PhysicsComponent(enemyEntity.id);
      world.addComponent(enemyEntity.id, enemyPhysics);
      
      const initialHealth = playerComponent.health;
      
      // Run collision detection
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      // Player should take damage if collision occurred
      const collisions = physicsComponent.getColliders();
      if (collisions.includes(enemyEntity.id)) {
        expect(playerComponent.health).toBeLessThan(initialHealth);
      }
    });

    it('should handle line of sight and obstacles', () => {
      // Add obstacle between player and enemy
      const obstacleId = world.createEntity();
      world.addComponent(obstacleId, {
        type: 'transform',
        entityId: obstacleId,
        position: { x: 10, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2, y: 3, z: 2 }
      });
      world.addComponent(obstacleId, new PhysicsComponent(obstacleId));
      
      // Position enemy behind obstacle
      const enemyTransform = enemyEntity.components.get('transform')!;
      enemyTransform.position = { x: 15, y: 2, z: 0 };
      
      world.update(0.016);
      
      // Enemy should not immediately chase if no line of sight
      const hasLineOfSight = aiSystem.hasLineOfSight(enemyEntity.id, playerEntity.id);
      if (!hasLineOfSight) {
        expect(enemyAI.getCurrentState()).not.toBe('chase');
      }
    });

    it('should handle multiple enemies with different behaviors', () => {
      // Create additional enemies
      const enemies = [];
      
      for (let i = 0; i < 3; i++) {
        const enemyId = world.createEntity();
        const ai = new AIComponent(enemyId);
        const enemy = new EnemyComponent(enemyId, ['basic', 'aggressive', 'defensive'][i]);
        
        world.addComponent(enemyId, ai);
        world.addComponent(enemyId, enemy);
        world.addComponent(enemyId, {
          type: 'transform',
          entityId: enemyId,
          position: { x: 5 + i * 3, y: 2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        enemies.push(enemyId);
      }
      
      // Run AI updates
      for (let i = 0; i < 20; i++) {
        world.update(0.016);
      }
      
      // Different enemy types should exhibit different behaviors
      const aiStates = enemies.map(id => {
        const entity = world.getEntity(id)!;
        const ai = entity.components.get('ai') as AIComponent;
        return ai.getCurrentState();
      });
      
      // At least some variation in behavior should exist
      const uniqueStates = new Set(aiStates);
      expect(uniqueStates.size).toBeGreaterThan(1);
    });
  });

  describe('Powerup Collection and Effects', () => {
    it('should collect powerup and apply effects', () => {
      // Spawn magnet powerup near player
      const powerup = powerupManager.spawnMagnetPowerup({ x: 1, y: 2, z: 0 });
      
      const initialMaxSpeed = playerComponent.maxSpeed;
      
      // Force collection
      powerupManager.forceCollectPowerup(powerup.id);
      
      // Check powerup is active
      const hasActivePowerup = powerupManager.hasPowerupActive(playerEntity.id, PowerupType.MAGNET);
      expect(hasActivePowerup).toBe(true);
      
      // Magnet should affect nearby collectibles
      const collectible = world.createEntity();
      world.addComponent(collectible, {
        type: 'collectible',
        entityId: collectible
      });
      world.addComponent(collectible, {
        type: 'transform',
        entityId: collectible,
        position: { x: 5, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      
      const initialCollectiblePos = { ...world.getEntity(collectible)!.components.get('transform')!.position };
      
      // Run magnet system
      for (let i = 0; i < 20; i++) {
        powerupManager.update(0.016);
        world.update(0.016);
      }
      
      const finalCollectiblePos = world.getEntity(collectible)!.components.get('transform')!.position;
      
      // Collectible should move towards player
      const initialDistance = Math.sqrt(initialCollectiblePos.x ** 2 + initialCollectiblePos.z ** 2);
      const finalDistance = Math.sqrt(finalCollectiblePos.x ** 2 + finalCollectiblePos.z ** 2);
      
      expect(finalDistance).toBeLessThan(initialDistance);
    });

    it('should handle powerup stacking and conflicts', () => {
      // Collect speed boost
      const speedPowerup = powerupManager.spawnPowerup(PowerupType.DOUBLER, { x: 1, y: 2, z: 0 });
      powerupManager.forceCollectPowerup(speedPowerup.id);
      
      // Collect another powerup
      const invisPowerup = powerupManager.spawnInvisibilityPowerup({ x: 1.5, y: 2, z: 0 });
      powerupManager.forceCollectPowerup(invisPowerup.id);
      
      // Both should be active
      expect(powerupManager.hasPowerupActive(playerEntity.id, PowerupType.DOUBLER)).toBe(true);
      expect(powerupManager.hasPowerupActive(playerEntity.id, PowerupType.INVISIBILITY)).toBe(true);
      
      const activePowerups = powerupManager.getActivePowerups();
      expect(activePowerups.size).toBeGreaterThan(0);
    });

    it('should handle powerup expiration', (done) => {
      const powerup = powerupManager.spawnMagnetPowerup({ x: 1, y: 2, z: 0 });
      powerupManager.forceCollectPowerup(powerup.id);
      
      expect(powerupManager.hasPowerupActive(playerEntity.id, PowerupType.MAGNET)).toBe(true);
      
      // Monitor for expiration
      const checkExpiration = () => {
        powerupManager.update(0.016);
        world.update(0.016);
        
        if (!powerupManager.hasPowerupActive(playerEntity.id, PowerupType.MAGNET)) {
          done();
        } else {
          setTimeout(checkExpiration, 16);
        }
      };
      
      setTimeout(checkExpiration, 100);
    }, 5000);

    it('should affect score system when collecting items', () => {
      const initialScore = playerComponent.score;
      
      // Create collectible coins
      for (let i = 0; i < 5; i++) {
        const coinId = world.createEntity();
        world.addComponent(coinId, {
          type: 'collectible',
          entityId: coinId,
          value: 100
        });
        world.addComponent(coinId, {
          type: 'transform',
          entityId: coinId,
          position: { x: i, y: 2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
      }
      
      // Force collection of all coins
      const coins = world.getEntitiesWithComponent('collectible');
      coins.forEach(coin => {
        scoreSystem.collectItem(playerEntity.id, coin.id);
      });
      
      world.update(0.016);
      
      expect(playerComponent.score).toBeGreaterThan(initialScore);
    });
  });

  describe('Terrain and Environment Interaction', () => {
    it('should load terrain chunks as player moves', () => {
      const initialChunks = terrainSystem.getStats().loadedChunks;
      
      // Move player to new area
      const playerTransform = playerEntity.components.get('transform')!;
      playerTransform.position = { x: 100, y: 2, z: 100 };
      
      terrainSystem.updatePlayerPosition(playerTransform.position);
      
      // Run several frames to allow chunk loading
      for (let i = 0; i < 10; i++) {
        world.update(0.016);
      }
      
      const finalChunks = terrainSystem.getStats().loadedChunks;
      expect(finalChunks).toBeGreaterThanOrEqual(initialChunks);
    });

    it('should handle player collision with terrain features', () => {
      // Ensure terrain is loaded
      terrainSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      world.update(0.016);
      
      // Test various terrain positions
      const testPositions = [
        { x: 10, y: 0, z: 10 },
        { x: -5, y: 0, z: 15 },
        { x: 20, y: 0, z: -10 }
      ];
      
      testPositions.forEach(pos => {
        const terrainHeight = terrainSystem.getHeightAtPosition(pos);
        
        // Move player to this position
        const playerTransform = playerEntity.components.get('transform')!;
        playerTransform.position = { x: pos.x, y: terrainHeight + 2, z: pos.z };
        
        world.update(0.016);
        
        // Player should be positioned correctly on terrain
        expect(playerTransform.position.y).toBeGreaterThanOrEqual(terrainHeight);
      });
    });

    it('should handle slope climbing and sliding', () => {
      // Move to area with slopes
      const slopePosition = { x: 30, y: 0, z: 30 };
      terrainSystem.updatePlayerPosition(slopePosition);
      world.update(0.016);
      
      const terrainNormal = terrainSystem.getNormalAtPosition(slopePosition);
      const slopeAngle = Math.acos(terrainNormal.y) * (180 / Math.PI);
      
      playerComponent.updateSlopeDetection(slopeAngle);
      
      if (slopeAngle > 45) {
        expect(playerComponent.isSliding).toBe(true);
        expect(playerComponent.canClimbSlope).toBe(false);
      } else {
        expect(playerComponent.canClimbSlope).toBe(true);
      }
    });

    it('should optimize terrain LOD based on player distance', () => {
      // Move player around to trigger LOD changes
      const positions = [
        { x: 0, y: 0, z: 0 },
        { x: 50, y: 0, z: 50 },
        { x: 100, y: 0, z: 100 }
      ];
      
      positions.forEach(pos => {
        terrainSystem.updatePlayerPosition(pos);
        world.update(0.016);
        
        const loadedChunks = terrainSystem.getLoadedChunks();
        
        // Chunks closer to player should have higher LOD
        loadedChunks.forEach(chunk => {
          const distance = Math.sqrt(
            Math.pow(chunk.x * terrainSystem.getConfig().chunkSize - pos.x, 2) +
            Math.pow(chunk.z * terrainSystem.getConfig().chunkSize - pos.z, 2)
          );
          
          if (distance < terrainSystem.getConfig().chunkSize) {
            expect(chunk.lodLevel).toBe(0); // Highest LOD for nearby chunks
          }
        });
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain stable framerate with many entities', () => {
      // Create many entities
      const entityCount = 100;
      
      for (let i = 0; i < entityCount; i++) {
        const entityId = world.createEntity();
        
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { 
            x: (Math.random() - 0.5) * 200, 
            y: 2, 
            z: (Math.random() - 0.5) * 200 
          },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        // Some are enemies
        if (i % 3 === 0) {
          world.addComponent(entityId, new AIComponent(entityId));
          world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
        }
        
        // Some are collectibles
        if (i % 5 === 0) {
          world.addComponent(entityId, {
            type: 'collectible',
            entityId,
            value: 10
          });
        }
        
        // Some have physics
        if (i % 2 === 0) {
          world.addComponent(entityId, new PhysicsComponent(entityId));
        }
      }
      
      // Measure performance over multiple frames
      const frameTimes = [];
      
      for (let i = 0; i < 60; i++) {
        const startTime = performance.now();
        
        world.update(0.016);
        powerupManager.update(0.016);
        
        const frameTime = performance.now() - startTime;
        frameTimes.push(frameTime);
      }
      
      const averageFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
      const maxFrameTime = Math.max(...frameTimes);
      
      // Should maintain reasonable performance
      expect(averageFrameTime).toBeLessThan(16); // 60fps average
      expect(maxFrameTime).toBeLessThan(25); // No frame should be too slow
    });

    it('should handle rapid player movement without issues', () => {
      const initialPosition = { ...playerEntity.components.get('transform')!.position };
      
      // Rapid movement pattern
      const movementPattern = [
        { x: 50, z: 0 },
        { x: 50, z: 50 },
        { x: 0, z: 50 },
        { x: -50, z: 0 },
        { x: 0, z: 0 }
      ];
      
      movementPattern.forEach((target, index) => {
        const playerTransform = playerEntity.components.get('transform')!;
        playerTransform.position = { x: target.x, y: 2, z: target.z };
        
        terrainSystem.updatePlayerPosition(playerTransform.position);
        
        // Multiple updates per position
        for (let i = 0; i < 5; i++) {
          expect(() => {
            world.update(0.016);
            powerupManager.update(0.016);
          }).not.toThrow();
        }
      });
    });

    it('should handle memory pressure gracefully', () => {
      // Create and destroy many entities to test memory management
      for (let cycle = 0; cycle < 10; cycle++) {
        const entities = [];
        
        // Create entities
        for (let i = 0; i < 50; i++) {
          const entityId = world.createEntity();
          world.addComponent(entityId, {
            type: 'transform',
            entityId,
            position: { x: i, y: 2, z: cycle * 10 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          });
          entities.push(entityId);
        }
        
        world.update(0.016);
        
        // Destroy entities
        entities.forEach(id => world.destroyEntity(id));
        world.update(0.016);
      }
      
      // Memory usage should be reasonable
      const debugInfo = world.getDebugInfo();
      expect(debugInfo.entities).toBeLessThan(20); // Only core entities should remain
    });
  });

  describe('Save State and Persistence', () => {
    it('should save and restore player state', () => {
      // Modify player state
      playerComponent.score = 5000;
      playerComponent.health = 75;
      playerComponent.addPowerUp('speed_boost');
      
      const playerTransform = playerEntity.components.get('transform')!;
      playerTransform.position = { x: 25, y: 3, z: 15 };
      
      // Serialize state
      const playerState = playerComponent.serialize();
      const transformState = { ...playerTransform };
      
      // Reset player
      playerComponent.score = 0;
      playerComponent.health = 100;
      playerComponent.powerUps.length = 0;
      playerTransform.position = { x: 0, y: 2, z: 0 };
      
      // Restore state
      playerComponent.deserialize(playerState);
      Object.assign(playerTransform, transformState);
      
      // Verify restoration
      expect(playerComponent.score).toBe(5000);
      expect(playerComponent.health).toBe(75);
      expect(playerComponent.powerUps).toContain('speed_boost');
      expect(playerTransform.position).toEqual({ x: 25, y: 3, z: 15 });
    });

    it('should handle game session lifecycle', () => {
      // Simulate game session
      const sessionData = {
        startTime: Date.now(),
        playerPosition: { x: 0, y: 2, z: 0 },
        score: 0,
        enemiesDefeated: 0
      };
      
      // Play for a while
      for (let i = 0; i < 100; i++) {
        world.update(0.016);
        powerupManager.update(0.016);
      }
      
      // Update session data
      const finalTransform = playerEntity.components.get('transform')!;
      sessionData.playerPosition = { ...finalTransform.position };
      sessionData.score = playerComponent.score;
      sessionData.enemiesDefeated = scoreSystem.getStats().enemiesDefeated || 0;
      
      // Session should have valid data
      expect(sessionData.score).toBeGreaterThanOrEqual(0);
      expect(sessionData.playerPosition).toBeDefined();
      expect(sessionData.startTime).toBeGreaterThan(0);
    });
  });

  describe('Mobile Performance Integration', () => {
    beforeEach(() => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', { value: 2, writable: true });
    });

    it('should adapt quality settings for mobile', () => {
      // Systems should detect mobile and adapt
      const terrainConfig = terrainSystem.getConfig();
      const aiConfig = aiSystem.getConfig();
      const powerupConfig = powerupManager.getStats().config;
      
      // Mobile optimizations should be active
      expect(powerupConfig.mobileOptimized).toBe(true);
    });

    it('should maintain performance on simulated low-end device', () => {
      // Simulate low-end device constraints
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, writable: true });
      
      // Create moderate load
      for (let i = 0; i < 20; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, {
          type: 'transform',
          entityId,
          position: { x: i * 2, y: 2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        if (i % 3 === 0) {
          world.addComponent(entityId, new AIComponent(entityId));
          world.addComponent(entityId, new EnemyComponent(entityId, 'basic'));
        }
      }
      
      // Test performance
      const frameTimes = [];
      for (let i = 0; i < 30; i++) {
        const startTime = performance.now();
        
        world.update(0.016);
        powerupManager.update(0.016);
        
        frameTimes.push(performance.now() - startTime);
      }
      
      const averageFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
      
      // Should maintain 30fps on low-end mobile (33.33ms budget)
      expect(averageFrameTime).toBeLessThan(30);
    });
  });

  describe('Error Recovery and Stability', () => {
    it('should recover from entity corruption', () => {
      // Corrupt an entity
      const corruptId = world.createEntity();
      const transform = {
        type: 'transform' as const,
        entityId: corruptId,
        position: { x: NaN, y: Infinity, z: -Infinity },
        rotation: { x: NaN, y: NaN, z: NaN },
        scale: { x: 0, y: 0, z: 0 }
      };
      
      world.addComponent(corruptId, transform);
      world.addComponent(corruptId, new PhysicsComponent(corruptId));
      
      // System should handle corruption gracefully
      expect(() => {
        for (let i = 0; i < 10; i++) {
          world.update(0.016);
        }
      }).not.toThrow();
      
      // Corrupt entity should be cleaned up or corrected
      const entity = world.getEntity(corruptId);
      if (entity) {
        const finalTransform = entity.components.get('transform')!;
        expect(isNaN(finalTransform.position.x)).toBe(false);
      }
    });

    it('should handle system failures gracefully', () => {
      // Simulate system failure
      const originalUpdate = aiSystem.update.bind(aiSystem);
      aiSystem.update = vi.fn(() => {
        throw new Error('Simulated AI system failure');
      });
      
      // Other systems should continue working
      expect(() => {
        world.update(0.016);
      }).not.toThrow();
      
      // Restore system
      aiSystem.update = originalUpdate;
      
      // Should recover normally
      expect(() => {
        world.update(0.016);
      }).not.toThrow();
    });

    it('should handle rapid start/stop cycles', () => {
      // Rapid start/stop cycles
      for (let i = 0; i < 5; i++) {
        world.stop();
        world.start();
        world.update(0.016);
      }
      
      // Should remain stable
      const debugInfo = world.getDebugInfo();
      expect(debugInfo.isRunning).toBe(true);
      expect(debugInfo.entities).toBeGreaterThan(0);
    });
  });
});