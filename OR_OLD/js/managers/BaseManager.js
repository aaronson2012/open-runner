// js/managers/BaseManager.js
import { createLogger } from '../utils/logger.js';
import eventBus from '../core/eventBus.js';

/**
 * Base class for all managers providing common initialization, cleanup, and scene management patterns
 */
export class BaseManager {
    constructor(name) {
        this.name = name;
        this.logger = createLogger(name);
        this.scene = null;
        this.isInitialized = false;
        this.eventSubscriptions = new Map();
        
        this.logger.debug(`${name} base manager created`);
    }

    /**
     * Common initialization lifecycle method
     * Subclasses should override setupManager() instead of this method
     * @param {object} config - Configuration object
     * @returns {boolean} True if initialization successful, false otherwise
     */
    async init(config = {}) {
        if (this.isInitialized) {
            this.logger.info(`${this.name} already initialized`);
            return true;
        }

        try {
            this.logger.debug(`Initializing ${this.name}...`);
            
            // Validate dependencies - subclasses can override validateDependencies()
            if (!this.validateDependencies(config)) {
                throw new Error(`${this.name} dependency validation failed`);
            }

            // Perform manager-specific setup
            const setupResult = await this.setupManager(config);
            if (setupResult === false) {
                throw new Error(`${this.name} setup failed`);
            }

            // Set up event subscriptions
            this.setupEventSubscriptions();

            this.isInitialized = true;
            this.logger.info(`${this.name} initialized successfully`);
            return true;

        } catch (error) {
            this.logger.error(`Error initializing ${this.name}:`, error);
            eventBus.emit('errorOccurred', `${this.name} initialization failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Validate dependencies - override in subclasses
     * @param {object} config - Configuration object
     * @returns {boolean} True if dependencies are valid
     */
    validateDependencies(config) {
        return true; // Base implementation accepts all
    }

    /**
     * Setup manager-specific functionality - override in subclasses
     * @param {object} config - Configuration object
     * @returns {boolean|Promise<boolean>} True if setup successful
     */
    async setupManager(config) {
        return true; // Base implementation does nothing
    }

    /**
     * Setup event subscriptions - override in subclasses
     */
    setupEventSubscriptions() {
        // Base implementation does nothing
    }

    /**
     * Helper method to subscribe to events and track subscriptions for cleanup
     * @param {string} eventName - Event name to subscribe to
     * @param {Function} handler - Event handler function
     */
    subscribeToEvent(eventName, handler) {
        const boundHandler = handler.bind(this);
        eventBus.subscribe(eventName, boundHandler);
        if (!this.eventSubscriptions.has(eventName)) {
            this.eventSubscriptions.set(eventName, new Set());
        }
        this.eventSubscriptions.get(eventName).add(boundHandler);
        this.logger.debug(`${this.name} subscribed to event: ${eventName}`);
    }

    /**
     * Standard scene validation and assignment
     * @param {THREE.Scene} scene - The new scene instance
     * @returns {boolean} True if scene was set successfully
     */
    setScene(scene) {
        if (!scene) {
            this.logger.error(`Attempted to set invalid scene in ${this.name}.`);
            return false;
        }
        
        const oldScene = this.scene;
        this.scene = scene;
        
        // Allow subclasses to handle scene change
        this.onSceneChanged(oldScene, scene);
        
        this.logger.info(`${this.name} scene updated.`);
        return true;
    }

    /**
     * Called when scene changes - override in subclasses if needed
     * @param {THREE.Scene|null} oldScene - Previous scene
     * @param {THREE.Scene} newScene - New scene
     */
    onSceneChanged(oldScene, newScene) {
        // Base implementation does nothing
    }

    /**
     * Common cleanup lifecycle method
     * Subclasses should override cleanupManager() instead of this method
     */
    cleanup() {
        if (!this.isInitialized) {
            this.logger.debug(`${this.name} cleanup called but not initialized`);
            return;
        }

        try {
            this.logger.debug(`Cleaning up ${this.name}...`);

            // Unsubscribe from all events
            this.cleanupEventSubscriptions();

            // Perform manager-specific cleanup
            this.cleanupManager();

            this.isInitialized = false;
            this.scene = null;
            
            this.logger.info(`${this.name} cleaned up`);

        } catch (error) {
            this.logger.error(`Error during ${this.name} cleanup:`, error);
        }
    }

    /**
     * Cleanup manager-specific resources - override in subclasses
     */
    cleanupManager() {
        // Base implementation does nothing
    }

    /**
     * Cleanup all event subscriptions
     */
    cleanupEventSubscriptions() {
        for (const [eventName, handlers] of this.eventSubscriptions) {
            for (const handler of handlers) {
                eventBus.unsubscribe(eventName, handler);
                this.logger.debug(`${this.name} unsubscribed from event: ${eventName}`);
            }
        }
        this.eventSubscriptions.clear();
    }

    /**
     * Check if manager is initialized
     * @returns {boolean} True if initialized
     */
    getIsInitialized() {
        return this.isInitialized;
    }

    /**
     * Get the current scene
     * @returns {THREE.Scene|null} Current scene or null
     */
    getScene() {
        return this.scene;
    }
}