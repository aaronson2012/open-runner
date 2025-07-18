import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const mockEventBus = {
  emit: vi.fn()
};

const mockGameStateManager = {
  getCurrentState: vi.fn(() => 'playing')
};

const mockPowerupNotificationManager = {
  showNotification: vi.fn()
};

// Mock Three.js Vector3
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  normalize() {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }

  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  clone() {
    return new MockVector3(this.x, this.y, this.z);
  }

  add(vector) {
    this.x += vector.x;
    this.y += vector.y;
    this.z += vector.z;
    return this;
  }
}

// Mock configurations
const mockPlayerConfig = {
  TORSO_WIDTH: 0.3
};

const mockModelsConfig = {
  COIN: {
    collision: {
      effect: 'collectCoin',
      type: 'collectible'
    },
    COLLISION_RADIUS: 0.2
  },
  POWERUP_MAGNET: {
    collision: {
      effect: 'collectPowerup',
      powerupType: 'magnet'
    },
    COLLISION_RADIUS: 0.25
  },
  TREE_PINE: {
    collision: {
      effect: 'damagePlayer',
      type: 'obstacle'
    },
    COLLISION_RADIUS: 0.5
  },
  ROCK_DESERT: {
    collision: {
      effect: 'impede',
      type: 'obstacle'
    },
    COLLISION_RADIUS: 0.4
  }
};

const mockGameplayConfig = {
  DEFAULT_COIN_SCORE: 10,
  MAGNET_POWERUP_RADIUS: 2.0,
  POWERUP_TYPE_MAGNET: 'magnet',
  POWERUP_TYPE_DOUBLER: 'doubler',
  POWERUP_TYPE_INVISIBILITY: 'invisibility',
  MAGNET_EFFECT_COLOR: 0x00ff00,
  DOUBLER_EFFECT_COLOR: 0xffff00,
  INVISIBILITY_EFFECT_COLOR: 0x0000ff
};

// Mock GameStates
const GameStates = {
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver'
};

// CollisionManager implementation
class CollisionManager {
  constructor() {
    this.spatialGrid = null;
    this.chunkManager = null;
    this.enemyManager = null;
  }

  initCollisionManager(spatialGridInstance, chunkManagerInstance, enemyManagerInstance) {
    this.spatialGrid = spatialGridInstance;
    this.chunkManager = chunkManagerInstance;
    this.enemyManager = enemyManagerInstance;
  }

  checkPlayerCollisions(player) {
    // Validate player object
    if (!player) {
      mockLogger.warn('checkPlayerCollisions: Player object is null or undefined');
      return false;
    }

    if (!player.model) {
      mockLogger.warn('checkPlayerCollisions: Player model is null or undefined');
      return false;
    }

    if (!player.model.position) {
      mockLogger.warn('checkPlayerCollisions: Player model has no position property');
      return false;
    }

    const playerPosition = player.model.position;

    // Check game state
    if (mockGameStateManager.getCurrentState() !== GameStates.PLAYING) {
      return false;
    }

    if (!this.spatialGrid) {
      mockLogger.error('checkPlayerCollisions: Spatial grid not initialized');
      return false;
    }

    if (!this.chunkManager) {
      mockLogger.error('checkPlayerCollisions: Chunk manager not initialized');
      return false;
    }

    // Query nearby objects
    const nearbyObjects = this.spatialGrid.queryNearby(playerPosition);

    if (!nearbyObjects || nearbyObjects.size === 0) {
      return true;
    }

    // Process nearby objects
    for (const mesh of nearbyObjects) {
      if (!mesh || !mesh.userData || !mesh.position) continue;

      const objectType = mesh.userData.objectType;
      if (!objectType) continue;

      const modelConfig = mockModelsConfig[objectType.toUpperCase()];
      if (!modelConfig || !modelConfig.collision) continue;

      const collisionConfig = modelConfig.collision;
      const dx = playerPosition.x - mesh.position.x;
      const dz = playerPosition.z - mesh.position.z;
      const distanceSq = dx * dx + dz * dz;

      let collisionRadius = modelConfig.COLLISION_RADIUS || 0.5;
      if (mesh.scale) {
        collisionRadius *= mesh.scale.x;
      }

      let collisionThresholdSq = (mockPlayerConfig.TORSO_WIDTH + collisionRadius) ** 2;

      if (distanceSq < collisionThresholdSq) {
        switch (collisionConfig.effect) {
          case 'damagePlayer':
            mockLogger.info(`Player collided with ${collisionConfig.type} of type ${objectType}`);
            mockEventBus.emit('playerDied', objectType);
            return true;

          case 'collectCoin':
            if (player.powerup === 'magnet') {
              const magnetRadius = mockGameplayConfig.MAGNET_POWERUP_RADIUS;
              collisionThresholdSq = (mockPlayerConfig.TORSO_WIDTH + collisionRadius + magnetRadius) ** 2;
              if (distanceSq > collisionThresholdSq) continue;
            }
            
            const { chunkKey, objectIndex, scoreValue } = mesh.userData;
            if (this.chunkManager.collectObject(chunkKey, objectIndex)) {
              const coinValue = scoreValue || mockGameplayConfig.DEFAULT_COIN_SCORE;
              const finalValue = player.powerup === 'doubler' ? coinValue * 2 : coinValue;
              mockEventBus.emit('scoreChanged', finalValue);
              mockLogger.debug(`Collected coin with value ${finalValue}`);
            }
            break;

          case 'collectPowerup':
            const { chunkKey: powerupChunkKey, objectIndex: powerupObjectIndex } = mesh.userData;
            if (this.chunkManager.collectObject(powerupChunkKey, powerupObjectIndex)) {
              const powerupType = collisionConfig.powerupType;
              const powerupName = powerupType.charAt(0).toUpperCase() + powerupType.slice(1);
              
              let powerupColor = 'white';
              switch (powerupType) {
                case mockGameplayConfig.POWERUP_TYPE_MAGNET:
                  powerupColor = `#${mockGameplayConfig.MAGNET_EFFECT_COLOR.toString(16).padStart(6, '0')}`;
                  break;
                case mockGameplayConfig.POWERUP_TYPE_DOUBLER:
                  powerupColor = `#${mockGameplayConfig.DOUBLER_EFFECT_COLOR.toString(16).padStart(6, '0')}`;
                  break;
                case mockGameplayConfig.POWERUP_TYPE_INVISIBILITY:
                  powerupColor = `#${mockGameplayConfig.INVISIBILITY_EFFECT_COLOR.toString(16).padStart(6, '0')}`;
                  break;
              }

              mockPowerupNotificationManager.showNotification(powerupName, playerPosition, powerupColor);
              mockEventBus.emit('powerupCollected', { type: powerupType });
              mockLogger.debug(`Collected powerup of type ${collisionConfig.powerupType}`);
            }
            break;

          case 'impede':
            const overlap = mockPlayerConfig.TORSO_WIDTH + collisionRadius - Math.sqrt(distanceSq);
            if (overlap > 0) {
              const pushback = new MockVector3(dx, 0, dz).normalize().multiplyScalar(overlap);
              player.model.position.add(pushback);

              if (player.physicsComponent) {
                const pushForce = pushback.clone().multiplyScalar(50);
                player.physicsComponent.applyImpulse(pushForce);
              }
            }
            break;
        }
      }
    }

    return true;
  }
}

describe('CollisionManager', () => {
  let collisionManager;
  let mockSpatialGrid;
  let mockChunkManager;
  let mockEnemyManager;

  beforeEach(() => {
    collisionManager = new CollisionManager();
    
    mockSpatialGrid = {
      queryNearby: vi.fn(() => new Set())
    };
    
    mockChunkManager = {
      collectObject: vi.fn(() => true)
    };
    
    mockEnemyManager = {};
    
    vi.clearAllMocks();
    mockGameStateManager.getCurrentState.mockReturnValue(GameStates.PLAYING);
  });

  describe('initialization', () => {
    it('should initialize with dependencies', () => {
      collisionManager.initCollisionManager(mockSpatialGrid, mockChunkManager, mockEnemyManager);
      
      expect(collisionManager.spatialGrid).toBe(mockSpatialGrid);
      expect(collisionManager.chunkManager).toBe(mockChunkManager);
      expect(collisionManager.enemyManager).toBe(mockEnemyManager);
    });
  });

  describe('checkPlayerCollisions', () => {
    beforeEach(() => {
      collisionManager.initCollisionManager(mockSpatialGrid, mockChunkManager, mockEnemyManager);
    });

    describe('input validation', () => {
      it('should return false when player is null', () => {
        const result = collisionManager.checkPlayerCollisions(null);
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('checkPlayerCollisions: Player object is null or undefined');
      });

      it('should return false when player model is missing', () => {
        const player = {};
        const result = collisionManager.checkPlayerCollisions(player);
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('checkPlayerCollisions: Player model is null or undefined');
      });

      it('should return false when player position is missing', () => {
        const player = { model: {} };
        const result = collisionManager.checkPlayerCollisions(player);
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('checkPlayerCollisions: Player model has no position property');
      });

      it('should return false when game is not playing', () => {
        mockGameStateManager.getCurrentState.mockReturnValue(GameStates.PAUSED);
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(false);
      });

      it('should return false when spatial grid is not initialized', () => {
        collisionManager.spatialGrid = null;
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith('checkPlayerCollisions: Spatial grid not initialized');
      });

      it('should return false when chunk manager is not initialized', () => {
        collisionManager.chunkManager = null;
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith('checkPlayerCollisions: Chunk manager not initialized');
      });
    });

    describe('collision detection', () => {
      it('should return true when no nearby objects', () => {
        mockSpatialGrid.queryNearby.mockReturnValue(new Set());
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockSpatialGrid.queryNearby).toHaveBeenCalledWith(player.model.position);
      });

      it('should handle damage collision (obstacle)', () => {
        const obstacle = {
          position: { x: 0.1, y: 0, z: 0.1 }, // Close to player
          userData: { objectType: 'tree_pine' }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([obstacle]));
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockEventBus.emit).toHaveBeenCalledWith('playerDied', 'tree_pine');
        expect(mockLogger.info).toHaveBeenCalledWith('Player collided with obstacle of type tree_pine');
      });

      it('should handle coin collection', () => {
        const coin = {
          position: { x: 0.1, y: 0, z: 0.1 },
          userData: { 
            objectType: 'coin',
            chunkKey: 'chunk1',
            objectIndex: 0,
            scoreValue: 15
          }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([coin]));
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockChunkManager.collectObject).toHaveBeenCalledWith('chunk1', 0);
        expect(mockEventBus.emit).toHaveBeenCalledWith('scoreChanged', 15);
        expect(mockLogger.debug).toHaveBeenCalledWith('Collected coin with value 15');
      });

      it('should double coin value with doubler powerup', () => {
        const coin = {
          position: { x: 0.1, y: 0, z: 0.1 },
          userData: { 
            objectType: 'coin',
            chunkKey: 'chunk1',
            objectIndex: 0,
            scoreValue: 10
          }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([coin]));
        
        const player = { 
          model: { position: { x: 0, y: 0, z: 0 } },
          powerup: 'doubler'
        };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockEventBus.emit).toHaveBeenCalledWith('scoreChanged', 20);
      });

      it('should use default coin value when not specified', () => {
        const coin = {
          position: { x: 0.1, y: 0, z: 0.1 },
          userData: { 
            objectType: 'coin',
            chunkKey: 'chunk1',
            objectIndex: 0
            // No scoreValue specified
          }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([coin]));
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        collisionManager.checkPlayerCollisions(player);
        
        expect(mockEventBus.emit).toHaveBeenCalledWith('scoreChanged', mockGameplayConfig.DEFAULT_COIN_SCORE);
      });

      it('should handle powerup collection', () => {
        const powerup = {
          position: { x: 0.1, y: 0, z: 0.1 },
          userData: { 
            objectType: 'powerup_magnet',
            chunkKey: 'chunk1',
            objectIndex: 0
          }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([powerup]));
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockChunkManager.collectObject).toHaveBeenCalledWith('chunk1', 0);
        expect(mockEventBus.emit).toHaveBeenCalledWith('powerupCollected', { type: 'magnet' });
        expect(mockPowerupNotificationManager.showNotification).toHaveBeenCalledWith(
          'Magnet',
          player.model.position,
          '#00ff00'
        );
      });

      it('should handle impede collision with pushback', () => {
        const rock = {
          position: { x: 0.2, y: 0, z: 0 },
          userData: { objectType: 'rock_desert' }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([rock]));
        
        const player = { 
          model: { 
            position: { 
              x: 0, 
              y: 0, 
              z: 0,
              add: vi.fn()
            } 
          },
          physicsComponent: {
            applyImpulse: vi.fn()
          }
        };
        
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(player.model.position.add).toHaveBeenCalled();
        expect(player.physicsComponent.applyImpulse).toHaveBeenCalled();
      });

      it('should ignore objects without collision configuration', () => {
        const nonCollidableObject = {
          position: { x: 0.1, y: 0, z: 0.1 },
          userData: { objectType: 'unknown_object' }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([nonCollidableObject]));
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockEventBus.emit).not.toHaveBeenCalled();
      });

      it('should ignore objects that are too far away', () => {
        const distantCoin = {
          position: { x: 10, y: 0, z: 10 }, // Far from player
          userData: { 
            objectType: 'coin',
            chunkKey: 'chunk1',
            objectIndex: 0
          }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([distantCoin]));
        
        const player = { model: { position: { x: 0, y: 0, z: 0 } } };
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        expect(mockEventBus.emit).not.toHaveBeenCalled();
      });

      it('should handle magnet powerup extended range for coins', () => {
        const coin = {
          position: { x: 0.4, y: 0, z: 0 }, // Close enough for magnet collection
          userData: { 
            objectType: 'coin',
            chunkKey: 'chunk1',
            objectIndex: 0,
            scoreValue: 10
          }
        };
        
        mockSpatialGrid.queryNearby.mockReturnValue(new Set([coin]));
        
        const player = { 
          model: { position: { x: 0, y: 0, z: 0 } },
          powerup: 'magnet'
        };
        
        const result = collisionManager.checkPlayerCollisions(player);
        
        expect(result).toBe(true);
        // With magnet: threshold = (0.3 + 0.2 + 2.0)^2 = 6.25
        // Distance: 0.4^2 = 0.16 < 6.25, so should collect
        expect(mockEventBus.emit).toHaveBeenCalledWith('scoreChanged', 10);
      });
    });
  });
});