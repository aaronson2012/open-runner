import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const mockEventBus = {
  emit: vi.fn()
};

// GameStates enum
const GameStates = Object.freeze({
  LOADING: 'loading',
  TITLE: 'title',
  LEVEL_SELECT: 'levelSelect',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver',
  LEVEL_TRANSITION: 'levelTransition',
  LOADING_LEVEL: 'loadingLevel',
  TRANSITIONING_TO_TITLE: 'transitioningToTitle',
  TRANSITIONING_TO_GAMEPLAY: 'transitioningToGameplay'
});

// GameStateManager implementation
class GameStateManager {
  constructor() {
    this.currentState = GameStates.LOADING;
    this.stateHistory = [GameStates.LOADING];
    this.maxHistoryLength = 10;
    this.stateChangeTime = Date.now();
  }

  getCurrentState() {
    return this.currentState;
  }

  getPreviousState() {
    if (this.stateHistory.length < 2) {
      return null;
    }
    return this.stateHistory[this.stateHistory.length - 2];
  }

  getTimeInCurrentState() {
    return Date.now() - this.stateChangeTime;
  }

  setGameState(newState) {
    if (!Object.values(GameStates).includes(newState)) {
      mockLogger.warn(`[GameStateManager] Attempted to set invalid game state: ${newState}`);
      return false;
    }

    if (this.currentState === newState) {
      return false;
    }

    const oldState = this.currentState;
    this.currentState = newState;
    this.stateChangeTime = Date.now();
    this.stateHistory.push(newState);

    if (this.stateHistory.length > this.maxHistoryLength) {
      this.stateHistory.shift();
    }

    mockEventBus.emit('gameStateChanged', { newState: newState, oldState: oldState });
    return true;
  }

  isInState(...states) {
    return states.includes(this.currentState);
  }

  revertToPreviousState() {
    if (this.stateHistory.length < 2) {
      mockLogger.warn("[GameStateManager] Cannot revert: No previous state in history.");
      return false;
    }
    const oldState = this.currentState;
    this.stateHistory.pop();
    const newState = this.stateHistory[this.stateHistory.length - 1];
    this.currentState = newState;
    this.stateChangeTime = Date.now();
    mockEventBus.emit('gameStateChanged', { newState: newState, oldState: oldState });
    return true;
  }

  requestPause() {
    if (this.currentState === GameStates.PLAYING) {
      mockLogger.info("Requesting Pause state...");
      mockEventBus.emit('requestPause');
    } else {
      mockLogger.warn(`Cannot pause from state: ${this.currentState}`);
    }
  }

  requestResume() {
    if (this.currentState === GameStates.PAUSED) {
      mockLogger.info("Requesting Resume (Playing) state...");
      mockEventBus.emit('requestResume');
    } else {
      mockLogger.warn(`Cannot resume from state: ${this.currentState}`);
    }
  }

  requestRestart() {
    if (this.currentState === GameStates.PAUSED || this.currentState === GameStates.GAME_OVER) {
      mockLogger.info("Requesting Level Restart...");
      mockEventBus.emit('requestRestart');
    } else {
      mockLogger.warn(`Cannot restart from state: ${this.currentState}`);
    }
  }

  requestReturnToTitle() {
    if (this.currentState === GameStates.PAUSED ||
        this.currentState === GameStates.GAME_OVER ||
        this.currentState === GameStates.LEVEL_SELECT) {
      mockLogger.info("Requesting Return to Title...");
      mockEventBus.emit('requestReturnToTitle');
    } else {
      mockLogger.warn(`Cannot return to title from state: ${this.currentState}`);
    }
  }

  requestShowLevelSelect() {
    if (this.currentState === GameStates.TITLE) {
      mockLogger.info("Requesting Show Level Select...");
      mockEventBus.emit('requestShowLevelSelect');
    } else {
      mockLogger.warn(`Cannot show level select from state: ${this.currentState}`);
    }
  }

  requestGameOverSequence() {
    if (this.currentState === GameStates.PLAYING) {
      mockLogger.info("Requesting Game Over sequence...");
      mockEventBus.emit('playerDied');
    } else {
      mockLogger.warn(`Cannot trigger game over from state: ${this.currentState}`);
    }
  }
}

describe('GameStateManager', () => {
  let gameStateManager;

  beforeEach(() => {
    gameStateManager = new GameStateManager();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with LOADING state', () => {
      expect(gameStateManager.getCurrentState()).toBe(GameStates.LOADING);
      expect(gameStateManager.stateHistory).toEqual([GameStates.LOADING]);
      expect(gameStateManager.maxHistoryLength).toBe(10);
    });
  });

  describe('getCurrentState', () => {
    it('should return the current state', () => {
      expect(gameStateManager.getCurrentState()).toBe(GameStates.LOADING);
    });
  });

  describe('getPreviousState', () => {
    it('should return null when no previous state exists', () => {
      expect(gameStateManager.getPreviousState()).toBeNull();
    });

    it('should return the previous state when available', () => {
      gameStateManager.setGameState(GameStates.TITLE);
      gameStateManager.setGameState(GameStates.PLAYING);
      
      expect(gameStateManager.getPreviousState()).toBe(GameStates.TITLE);
    });
  });

  describe('getTimeInCurrentState', () => {
    it('should return time spent in current state', () => {
      const beforeTime = Date.now();
      const timeInState = gameStateManager.getTimeInCurrentState();
      const afterTime = Date.now();

      expect(timeInState).toBeGreaterThanOrEqual(0);
      expect(timeInState).toBeLessThanOrEqual(afterTime - beforeTime + 10); // Allow for small timing differences
    });
  });

  describe('setGameState', () => {
    it('should set a valid new state', () => {
      const result = gameStateManager.setGameState(GameStates.TITLE);
      
      expect(result).toBe(true);
      expect(gameStateManager.getCurrentState()).toBe(GameStates.TITLE);
      expect(mockEventBus.emit).toHaveBeenCalledWith('gameStateChanged', {
        newState: GameStates.TITLE,
        oldState: GameStates.LOADING
      });
    });

    it('should reject invalid states', () => {
      const result = gameStateManager.setGameState('invalidState');
      
      expect(result).toBe(false);
      expect(gameStateManager.getCurrentState()).toBe(GameStates.LOADING);
      expect(mockLogger.warn).toHaveBeenCalledWith('[GameStateManager] Attempted to set invalid game state: invalidState');
    });

    it('should not change to the same state', () => {
      const result = gameStateManager.setGameState(GameStates.LOADING);
      
      expect(result).toBe(false);
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should maintain state history', () => {
      gameStateManager.setGameState(GameStates.TITLE);
      gameStateManager.setGameState(GameStates.PLAYING);
      
      expect(gameStateManager.stateHistory).toEqual([
        GameStates.LOADING,
        GameStates.TITLE,
        GameStates.PLAYING
      ]);
    });

    it('should limit history length', () => {
      // Fill history beyond max length
      for (let i = 0; i < 15; i++) {
        gameStateManager.setGameState(i % 2 === 0 ? GameStates.TITLE : GameStates.PLAYING);
      }
      
      expect(gameStateManager.stateHistory.length).toBe(gameStateManager.maxHistoryLength);
    });
  });

  describe('isInState', () => {
    it('should return true when current state matches one of provided states', () => {
      expect(gameStateManager.isInState(GameStates.LOADING, GameStates.TITLE)).toBe(true);
      expect(gameStateManager.isInState(GameStates.LOADING)).toBe(true);
    });

    it('should return false when current state does not match any provided states', () => {
      expect(gameStateManager.isInState(GameStates.TITLE, GameStates.PLAYING)).toBe(false);
    });
  });

  describe('revertToPreviousState', () => {
    it('should revert to previous state when available', () => {
      gameStateManager.setGameState(GameStates.TITLE);
      gameStateManager.setGameState(GameStates.PLAYING);
      
      vi.clearAllMocks(); // Clear previous emit calls
      
      const result = gameStateManager.revertToPreviousState();
      
      expect(result).toBe(true);
      expect(gameStateManager.getCurrentState()).toBe(GameStates.TITLE);
      expect(mockEventBus.emit).toHaveBeenCalledWith('gameStateChanged', {
        newState: GameStates.TITLE,
        oldState: GameStates.PLAYING
      });
    });

    it('should fail when no previous state exists', () => {
      const result = gameStateManager.revertToPreviousState();
      
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith("[GameStateManager] Cannot revert: No previous state in history.");
    });
  });

  describe('request methods', () => {
    describe('requestPause', () => {
      it('should emit requestPause when in PLAYING state', () => {
        gameStateManager.setGameState(GameStates.PLAYING);
        
        gameStateManager.requestPause();
        
        expect(mockLogger.info).toHaveBeenCalledWith("Requesting Pause state...");
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestPause');
      });

      it('should warn when not in PLAYING state', () => {
        gameStateManager.requestPause();
        
        expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot pause from state: ${GameStates.LOADING}`);
        expect(mockEventBus.emit).not.toHaveBeenCalledWith('requestPause');
      });
    });

    describe('requestResume', () => {
      it('should emit requestResume when in PAUSED state', () => {
        gameStateManager.setGameState(GameStates.PAUSED);
        
        gameStateManager.requestResume();
        
        expect(mockLogger.info).toHaveBeenCalledWith("Requesting Resume (Playing) state...");
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestResume');
      });

      it('should warn when not in PAUSED state', () => {
        gameStateManager.requestResume();
        
        expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot resume from state: ${GameStates.LOADING}`);
      });
    });

    describe('requestRestart', () => {
      it('should emit requestRestart when in PAUSED state', () => {
        gameStateManager.setGameState(GameStates.PAUSED);
        
        gameStateManager.requestRestart();
        
        expect(mockLogger.info).toHaveBeenCalledWith("Requesting Level Restart...");
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestRestart');
      });

      it('should emit requestRestart when in GAME_OVER state', () => {
        gameStateManager.setGameState(GameStates.GAME_OVER);
        
        gameStateManager.requestRestart();
        
        expect(mockLogger.info).toHaveBeenCalledWith("Requesting Level Restart...");
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestRestart');
      });

      it('should warn when not in valid restart states', () => {
        gameStateManager.requestRestart();
        
        expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot restart from state: ${GameStates.LOADING}`);
      });
    });

    describe('requestReturnToTitle', () => {
      it('should work from PAUSED state', () => {
        gameStateManager.setGameState(GameStates.PAUSED);
        
        gameStateManager.requestReturnToTitle();
        
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestReturnToTitle');
      });

      it('should work from GAME_OVER state', () => {
        gameStateManager.setGameState(GameStates.GAME_OVER);
        
        gameStateManager.requestReturnToTitle();
        
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestReturnToTitle');
      });

      it('should work from LEVEL_SELECT state', () => {
        gameStateManager.setGameState(GameStates.LEVEL_SELECT);
        
        gameStateManager.requestReturnToTitle();
        
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestReturnToTitle');
      });

      it('should warn from invalid states', () => {
        gameStateManager.requestReturnToTitle();
        
        expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot return to title from state: ${GameStates.LOADING}`);
      });
    });

    describe('requestShowLevelSelect', () => {
      it('should emit requestShowLevelSelect when in TITLE state', () => {
        gameStateManager.setGameState(GameStates.TITLE);
        
        gameStateManager.requestShowLevelSelect();
        
        expect(mockLogger.info).toHaveBeenCalledWith("Requesting Show Level Select...");
        expect(mockEventBus.emit).toHaveBeenCalledWith('requestShowLevelSelect');
      });

      it('should warn when not in TITLE state', () => {
        gameStateManager.requestShowLevelSelect();
        
        expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot show level select from state: ${GameStates.LOADING}`);
      });
    });

    describe('requestGameOverSequence', () => {
      it('should emit playerDied when in PLAYING state', () => {
        gameStateManager.setGameState(GameStates.PLAYING);
        
        gameStateManager.requestGameOverSequence();
        
        expect(mockLogger.info).toHaveBeenCalledWith("Requesting Game Over sequence...");
        expect(mockEventBus.emit).toHaveBeenCalledWith('playerDied');
      });

      it('should warn when not in PLAYING state', () => {
        gameStateManager.requestGameOverSequence();
        
        expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot trigger game over from state: ${GameStates.LOADING}`);
      });
    });
  });

  describe('GameStates enum', () => {
    it('should contain all expected states', () => {
      const expectedStates = [
        'LOADING', 'TITLE', 'LEVEL_SELECT', 'PLAYING', 'PAUSED', 
        'GAME_OVER', 'LEVEL_TRANSITION', 'LOADING_LEVEL',
        'TRANSITIONING_TO_TITLE', 'TRANSITIONING_TO_GAMEPLAY'
      ];
      
      expectedStates.forEach(state => {
        expect(GameStates).toHaveProperty(state);
        expect(typeof GameStates[state]).toBe('string');
      });
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(GameStates)).toBe(true);
      
      expect(() => {
        GameStates.NEW_STATE = 'newState';
      }).toThrow();
    });
  });
});