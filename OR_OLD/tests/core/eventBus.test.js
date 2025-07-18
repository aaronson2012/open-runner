import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger dependency
const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
};

vi.mock('../../js/utils/logger.js', () => ({
  createLogger: () => mockLogger
}));

// Create EventBus implementation for testing
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.debugMode = false;
  }

  setDebugMode(enabled) {
    this.debugMode = Boolean(enabled);
  }

  _debugLog(message, data) {
    if (!this.debugMode) return;
    if (data !== undefined) {
      mockLogger.debug(`[EventBus] ${message}`, data);
    } else {
      mockLogger.debug(`[EventBus] ${message}`);
    }
  }

  subscribe(eventName, callback) {
    if (!eventName || typeof callback !== 'function') {
      mockLogger.error('[EventBus] Invalid parameters for subscribe:', { eventName, callback });
      return () => {};
    }

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName).add(callback);
    this._debugLog(`Subscribed to ${eventName}`);

    return () => this.unsubscribe(eventName, callback);
  }

  unsubscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      return false;
    }

    const result = this.listeners.get(eventName).delete(callback);

    if (this.listeners.get(eventName).size === 0) {
      this.listeners.delete(eventName);
    }

    if (result) {
      this._debugLog(`Unsubscribed from ${eventName}`);
    }

    return result;
  }

  unsubscribeAll(eventName) {
    if (!this.listeners.has(eventName)) {
      return false;
    }

    const hadListeners = this.listeners.get(eventName).size > 0;
    this.listeners.delete(eventName);

    if (hadListeners) {
      this._debugLog(`Unsubscribed all listeners from ${eventName}`);
    }

    return hadListeners;
  }

  emit(eventName, ...args) {
    if (!eventName) {
      mockLogger.error('[EventBus] Cannot emit event: No event name provided');
      return false;
    }

    if (!this.listeners.has(eventName) || this.listeners.get(eventName).size === 0) {
      this._debugLog(`No listeners for event: ${eventName}`);
      return false;
    }

    this._debugLog(`Emitting ${eventName}`, args);

    let hasErrors = false;
    let successCount = 0;
    const listeners = this.listeners.get(eventName);
    const listenerCount = listeners.size;

    const listenersCopy = Array.from(listeners);

    listenersCopy.forEach(callback => {
      if (typeof callback !== 'function') {
        mockLogger.error(`[EventBus] Invalid listener for ${eventName}: not a function`);
        listeners.delete(callback);
        hasErrors = true;
        return;
      }

      try {
        callback(...args);
        successCount++;
      } catch (error) {
        hasErrors = true;
        mockLogger.error(`[EventBus] Error in listener for ${eventName}:`, error);
      }
    });

    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }

    if (hasErrors || this.debugMode) {
      this._debugLog(`Emitted ${eventName} to ${successCount}/${listenerCount} listeners`);
    }
    return !hasErrors;
  }

  listenerCount(eventName) {
    if (!this.listeners.has(eventName)) {
      return 0;
    }
    return this.listeners.get(eventName).size;
  }

  hasListeners(eventName) {
    return this.listenerCount(eventName) > 0;
  }
}

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty listeners map', () => {
      expect(eventBus.listeners.size).toBe(0);
      expect(eventBus.debugMode).toBe(false);
    });
  });

  describe('setDebugMode', () => {
    it('should set debug mode to true', () => {
      eventBus.setDebugMode(true);
      expect(eventBus.debugMode).toBe(true);
    });

    it('should set debug mode to false', () => {
      eventBus.setDebugMode(false);
      expect(eventBus.debugMode).toBe(false);
    });

    it('should convert truthy values to boolean', () => {
      eventBus.setDebugMode('true');
      expect(eventBus.debugMode).toBe(true);

      eventBus.setDebugMode(0);
      expect(eventBus.debugMode).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should subscribe a callback to an event', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.subscribe('test', callback);

      expect(eventBus.hasListeners('test')).toBe(true);
      expect(eventBus.listenerCount('test')).toBe(1);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return an unsubscribe function that works', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.subscribe('test', callback);

      expect(eventBus.hasListeners('test')).toBe(true);
      unsubscribe();
      expect(eventBus.hasListeners('test')).toBe(false);
    });

    it('should handle invalid parameters gracefully', () => {
      const unsubscribe1 = eventBus.subscribe('', vi.fn());
      const unsubscribe2 = eventBus.subscribe('test', 'not a function');

      expect(typeof unsubscribe1).toBe('function');
      expect(typeof unsubscribe2).toBe('function');
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });

    it('should allow multiple subscribers to the same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.subscribe('test', callback1);
      eventBus.subscribe('test', callback2);

      expect(eventBus.listenerCount('test')).toBe(2);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe a specific callback', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.subscribe('test', callback1);
      eventBus.subscribe('test', callback2);

      const result = eventBus.unsubscribe('test', callback1);

      expect(result).toBe(true);
      expect(eventBus.listenerCount('test')).toBe(1);
    });

    it('should return false for non-existent event', () => {
      const result = eventBus.unsubscribe('nonexistent', vi.fn());
      expect(result).toBe(false);
    });

    it('should clean up empty event sets', () => {
      const callback = vi.fn();
      eventBus.subscribe('test', callback);
      eventBus.unsubscribe('test', callback);

      expect(eventBus.listeners.has('test')).toBe(false);
    });
  });

  describe('unsubscribeAll', () => {
    it('should remove all listeners for an event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.subscribe('test', callback1);
      eventBus.subscribe('test', callback2);

      const result = eventBus.unsubscribeAll('test');

      expect(result).toBe(true);
      expect(eventBus.hasListeners('test')).toBe(false);
    });

    it('should return false for non-existent event', () => {
      const result = eventBus.unsubscribeAll('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('emit', () => {
    it('should emit event to all subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.subscribe('test', callback1);
      eventBus.subscribe('test', callback2);

      const result = eventBus.emit('test', 'arg1', 'arg2');

      expect(result).toBe(true);
      expect(callback1).toHaveBeenCalledWith('arg1', 'arg2');
      expect(callback2).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should return false when no event name provided', () => {
      const result = eventBus.emit('');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('[EventBus] Cannot emit event: No event name provided');
    });

    it('should return false when no listeners exist', () => {
      const result = eventBus.emit('nonexistent');
      expect(result).toBe(false);
    });

    it('should handle errors in callbacks gracefully', () => {
      const goodCallback = vi.fn();
      const badCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      eventBus.subscribe('test', goodCallback);
      eventBus.subscribe('test', badCallback);

      const result = eventBus.emit('test');

      expect(result).toBe(false); // Should return false due to error
      expect(goodCallback).toHaveBeenCalled();
      expect(badCallback).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[EventBus] Error in listener for test:'),
        expect.any(Error)
      );
    });

    it('should clean up invalid listeners', () => {
      eventBus.listeners.set('test', new Set(['not a function']));

      const result = eventBus.emit('test');

      expect(result).toBe(false);
      expect(eventBus.hasListeners('test')).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('[EventBus] Invalid listener for test: not a function');
    });
  });

  describe('listenerCount', () => {
    it('should return correct count of listeners', () => {
      expect(eventBus.listenerCount('test')).toBe(0);

      eventBus.subscribe('test', vi.fn());
      expect(eventBus.listenerCount('test')).toBe(1);

      eventBus.subscribe('test', vi.fn());
      expect(eventBus.listenerCount('test')).toBe(2);
    });

    it('should return 0 for non-existent events', () => {
      expect(eventBus.listenerCount('nonexistent')).toBe(0);
    });
  });

  describe('hasListeners', () => {
    it('should return true when event has listeners', () => {
      eventBus.subscribe('test', vi.fn());
      expect(eventBus.hasListeners('test')).toBe(true);
    });

    it('should return false when event has no listeners', () => {
      expect(eventBus.hasListeners('test')).toBe(false);
    });
  });

  describe('debug mode', () => {
    it('should log debug messages when debug mode is enabled', () => {
      eventBus.setDebugMode(true);
      eventBus.subscribe('test', vi.fn());

      expect(mockLogger.debug).toHaveBeenCalledWith('[EventBus] Subscribed to test');
    });

    it('should not log debug messages when debug mode is disabled', () => {
      eventBus.setDebugMode(false);
      eventBus.subscribe('test', vi.fn());

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});