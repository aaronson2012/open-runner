import { createLogger } from '../utils/logger.js';

const logger = createLogger('EventBus');

/**
 * A robust event bus for decoupled communication between modules.
 * Implements the Singleton pattern to ensure a single event bus instance.
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.debugMode = false; // Disabled by default for better performance
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebugMode(enabled) {
        this.debugMode = Boolean(enabled);
    }

    /**
     * Log a message if debug mode is enabled
     * @private
     * @param {string} message - The message to log
     * @param {*} [data] - Optional data to log
     */
    _debugLog(message, data) {
        if (!this.debugMode) return;

        if (data !== undefined) {
            logger.debug(`[EventBus] ${message}`, data);
        } else {
            logger.debug(`[EventBus] ${message}`);
        }
    }

    /**
     * Subscribe to an event.
     * @param {string} eventName - The name of the event to subscribe to.
     * @param {function} callback - The function to call when the event is emitted.
     * @returns {function} - Unsubscribe function for easy cleanup
     */
    subscribe(eventName, callback) {
        if (!eventName || typeof callback !== 'function') {
            logger.error('[EventBus] Invalid parameters for subscribe:', { eventName, callback });
            return () => {}; // Return empty function to prevent errors
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }

        this.listeners.get(eventName).add(callback);
        this._debugLog(`Subscribed to ${eventName}`);

        // Return an unsubscribe function for easier cleanup
        return () => this.unsubscribe(eventName, callback);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} eventName - The name of the event to unsubscribe from.
     * @param {function} callback - The specific callback function to remove.
     * @returns {boolean} - Whether the unsubscribe was successful
     */
    unsubscribe(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            return false;
        }

        const result = this.listeners.get(eventName).delete(callback);

        // Clean up empty event sets
        if (this.listeners.get(eventName).size === 0) {
            this.listeners.delete(eventName);
        }

        if (result) {
            this._debugLog(`Unsubscribed from ${eventName}`);
        }

        return result;
    }

    /**
     * Unsubscribe all listeners for a specific event
     * @param {string} eventName - The event to clear listeners for
     * @returns {boolean} - Whether any listeners were removed
     */
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

    /**
     * Emit an event, calling all subscribed listeners.
     * @param {string} eventName - The name of the event to emit.
     * @param {...*} args - Arguments to pass to the listeners.
     * @returns {boolean} - Whether any listeners were called
     */
    emit(eventName, ...args) {
        if (!eventName) {
            logger.error('[EventBus] Cannot emit event: No event name provided');
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

        // Create a copy of the listeners to avoid issues if a listener unsubscribes during emission
        const listenersCopy = Array.from(listeners);

        listenersCopy.forEach(callback => {
            if (typeof callback !== 'function') {
                logger.error(`[EventBus] Invalid listener for ${eventName}: not a function`);
                // Remove invalid listeners to prevent future errors
                listeners.delete(callback);
                hasErrors = true;
                return;
            }

            try {
                callback(...args);
                successCount++;
            } catch (error) {
                hasErrors = true;
                logger.error(`[EventBus] Error in listener for ${eventName}:`, error);
                // Optionally remove listeners that throw errors to prevent future errors
                // Uncomment the next line if you want to automatically remove problematic listeners
                // listeners.delete(callback);
            }
        });

        // Clean up empty event sets
        if (listeners.size === 0) {
            this.listeners.delete(eventName);
        }

        // Only log if there were errors or in debug mode
        if (hasErrors || this.debugMode) {
            this._debugLog(`Emitted ${eventName} to ${successCount}/${listenerCount} listeners`);
        }
        return !hasErrors;
    }

    /**
     * Get the number of listeners for a specific event
     * @param {string} eventName - The event to check
     * @returns {number} - The number of listeners
     */
    listenerCount(eventName) {
        if (!this.listeners.has(eventName)) {
            return 0;
        }
        return this.listeners.get(eventName).size;
    }

    /**
     * Check if an event has any listeners
     * @param {string} eventName - The event to check
     * @returns {boolean} - Whether the event has listeners
     */
    hasListeners(eventName) {
        return this.listenerCount(eventName) > 0;
    }
}


const eventBus = new EventBus();
export default eventBus;