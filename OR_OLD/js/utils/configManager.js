// js/utils/configManager.js

import { createLogger, LogLevel } from './logger.js'; // Import LogLevel

const logger = createLogger('ConfigManager', LogLevel.INFO); // Set level to INFO

/**
 * Manages game configuration with support for overrides and defaults
 */
class ConfigManager {
    constructor() {
        // Core configuration storage
        this.configs = new Map();

        // Default configuration
        this.defaultConfig = {};
    }

    /**
     * Sets the default configuration values
     * @param {Object} defaultConfig - Default configuration object
     */
    setDefaults(defaultConfig) {
        if (!defaultConfig || typeof defaultConfig !== 'object') {
            logger.error('Invalid default config provided');
            return;
        }

        // Iterate over the new defaults provided
        Object.keys(defaultConfig).forEach(sectionKey => {
            const newSectionValue = defaultConfig[sectionKey];
            if (newSectionValue && typeof newSectionValue === 'object' && !Array.isArray(newSectionValue)) { // Check for object, not array
                // Deep clone the new section value before assigning
                this.defaultConfig[sectionKey] = JSON.parse(JSON.stringify(newSectionValue));
            } else {
                 // Assign primitive values or arrays directly (implicitly clones primitives)
                 this.defaultConfig[sectionKey] = newSectionValue;
            }
        });
        logger.debug('Default configuration updated', this.defaultConfig);
    }

    /**
     * Registers a configuration section
     * @param {string} section - Section name
     * @param {Object} config - Configuration object for this section
     * @param {boolean} [override=false] - Whether to override existing config
     * @returns {boolean} Whether the registration was successful
     */
    registerConfig(section, config, override = false) {
        if (!section || typeof section !== 'string') {
            logger.error('Invalid section name');
            return false;
        }

        if (!config || typeof config !== 'object') {
            logger.error(`Invalid config for section "${section}"`);
            return false;
        }

        if (this.configs.has(section) && !override) {
            logger.warn(`Config section "${section}" already exists and override is false`);
            return false;
        }

        // Deep clone to avoid external modifications affecting registered config
        try {
            this.configs.set(section, this._safeDeepClone(config));
            logger.debug(`Registered config for section "${section}"`, this.configs.get(section));
            return true;
        } catch (e) {
            logger.error(`Failed to clone config for section "${section}":`, e);
            // Fall back to JSON method as a last resort
            try {
                this.configs.set(section, JSON.parse(JSON.stringify(config)));
                logger.debug(`Registered config for section "${section}" using JSON method`, this.configs.get(section));
                return true;
            } catch (jsonError) {
                logger.error(`Failed to register config for section "${section}":`, jsonError);
                return false;
            }
        }
    }

    /**
     * Updates a configuration section
     * @param {string} section - Section name
     * @param {Object} updates - Configuration updates
     * @returns {boolean} Whether the update was successful
     */
    updateConfig(section, updates) {
        if (!section || typeof section !== 'string') {
            logger.error('Invalid section name for update');
            return false;
        }

        if (!updates || typeof updates !== 'object' || updates === null) {
            logger.error(`Invalid updates provided for section "${section}"`);
            return false;
        }

        try {
            if (!this.configs.has(section)) {
                logger.debug(`Section "${section}" not found, registering with updates.`);
                this.configs.set(section, this._safeDeepClone(updates));
            } else {
                const currentConfig = this.configs.get(section);
                // Simple merge (does not handle deep merging within the section)
                this.configs.set(section, { ...currentConfig, ...this._safeDeepClone(updates) });
            }
        } catch (e) {
            logger.error(`Failed to update config for section "${section}" with safe method:`, e);
            // Fall back to JSON method
            try {
                if (!this.configs.has(section)) {
                    this.configs.set(section, JSON.parse(JSON.stringify(updates)));
                } else {
                    const currentConfig = this.configs.get(section);
                    this.configs.set(section, { ...currentConfig, ...JSON.parse(JSON.stringify(updates)) });
                }
            } catch (jsonError) {
                logger.error(`Failed to update config for section "${section}" with JSON method:`, jsonError);
                return false;
            }
        }
        logger.debug(`Updated config for section "${section}"`, this.configs.get(section));
        return true;
    }

    /**
     * Gets a configuration value
     * @param {string} key - Configuration key in format "section.key" or just "key" for top-level defaults
     * @param {*} [defaultValue] - Default value if key not found
     * @returns {*} Configuration value or default
     */
    get(key, defaultValue) {
        if (!key || typeof key !== 'string') {
            logger.warn(`Invalid key provided: "${key}". Key must be a non-empty string.`);
            return defaultValue;
        }

        // 1. Check if it's a top-level default key
        if (this.defaultConfig.hasOwnProperty(key)) {
            // Check if it's also a section name (ambiguous) - prefer section if registered
            if (!this.configs.has(key) && !key.includes('.')) {
                 return this.defaultConfig[key];
            }
            // If it could be a section name, fall through to section logic
        }

        // 2. Check for section.key format
        if (key.includes('.')) {
            const parts = key.split('.');
            const section = parts[0];
            const sectionKey = parts.slice(1).join('.');

            if (section && sectionKey) {
                // 2a. Check registered config section
                if (this.configs.has(section)) {
                    const sectionConfig = this.configs.get(section);
                    if (sectionConfig.hasOwnProperty(sectionKey)) {
                        return sectionConfig[sectionKey];
                    }
                }
                // 2b. Check default config section
                if (this.defaultConfig.hasOwnProperty(section) && typeof this.defaultConfig[section] === 'object' && this.defaultConfig[section] !== null) {
                     const defaultSectionConfig = this.defaultConfig[section];
                     if (defaultSectionConfig.hasOwnProperty(sectionKey)) {
                         return defaultSectionConfig[sectionKey];
                     }
                }
            } else {
                 logger.warn(`Invalid key format: "${key}". Format should be "section.key".`);
            }
        }
        // 3. If not found as top-level or section.key, issue warning only if it lacked a '.'
        else {
             logger.warn(`Key "${key}" not found as top-level default or in section format "section.key".`);
        }


        // 4. Return the provided default value if not found anywhere
        return defaultValue;
    }

    /**
     * Safely deep clones an object, handling special cases that JSON.stringify/parse can't handle
     * @private
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    _safeDeepClone(obj) {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
            return obj; // Return primitives as is
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this._safeDeepClone(item));
        }

        // Handle regular objects
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this._safeDeepClone(obj[key]);
            }
        }
        return clonedObj;
    }

    /**
     * Gets an entire configuration section, merging defaults and registered values.
     * @param {string} section - Section name
     * @returns {Object|null} Deep cloned configuration section or null if section is invalid.
     */
    getSection(section) {
        if (!section || typeof section !== 'string') {
            logger.error('Invalid section name provided to getSection');
            return null;
        }

        const sectionDefaults = (this.defaultConfig.hasOwnProperty(section) && typeof this.defaultConfig[section] === 'object' && this.defaultConfig[section] !== null)
            ? this.defaultConfig[section]
            : {};

        const registeredConfig = this.configs.has(section)
            ? this.configs.get(section)
            : {};

        // Merge defaults and registered config, with registered taking precedence
        const mergedConfig = { ...sectionDefaults, ...registeredConfig };

        // Return a deep clone to prevent modification of internal state
        try {
            // First try the safer custom deep clone
            return this._safeDeepClone(mergedConfig);
        } catch (e) {
            logger.error(`Failed to deep clone section "${section}" with safe method:`, e);
            // Fall back to JSON method as a last resort
            try {
                return JSON.parse(JSON.stringify(mergedConfig));
            } catch (jsonError) {
                logger.error(`Failed to deep clone section "${section}" with JSON method:`, jsonError);
                return {}; // Return empty object on clone failure
            }
        }
    }

    /**
     * Gets all configuration sections, merged with defaults.
     * @returns {Object} All configurations (deep cloned).
     */
    getAll() {
        const allSections = new Set([...Object.keys(this.defaultConfig), ...this.configs.keys()]);
        const result = {};

        allSections.forEach(section => {
            // Use getSection to get the correctly merged and cloned section config
            result[section] = this.getSection(section);
        });

        // Return a deep clone of the entire result
        try {
            return this._safeDeepClone(result);
        } catch (e) {
            logger.error("Failed to deep clone all configs with safe method:", e);
            // Fall back to JSON method
            try {
                return JSON.parse(JSON.stringify(result));
            } catch (jsonError) {
                logger.error("Failed to deep clone all configs with JSON method:", jsonError);
                return {}; // Return empty object on clone failure
            }
        }
    }

    /**
     * Removes a configuration section from the registered configs (not defaults).
     * @param {string} section - Section name
     * @returns {boolean} Whether the section was removed from registered configs.
     */
    removeSection(section) {
         if (!section || typeof section !== 'string') {
            logger.error('Invalid section name provided to removeSection');
            return false;
        }
        let removed = false;
        if (this.configs.has(section)) {
            this.configs.delete(section);
            logger.debug(`Removed registered config section "${section}"`);
            removed = true;
        }

        if (!removed) {
             logger.debug(`Section "${section}" not found in registered configs.`);
        }
        return removed;
    }

    /**
     * Clears all registered and default configurations.
     */
    clear() {
        this.configs.clear();
        this.defaultConfig = {};
        logger.debug('Cleared all configurations');
    }
}

// Create and export a singleton instance
const configManager = new ConfigManager();
export default configManager;

// Export a function to create isolated config managers for testing
export function createConfigManager() {
    return new ConfigManager();
}