// js/utils/performanceManager.js

import { createLogger, LogLevel } from './logger.js'; // Import LogLevel as well

const logger = createLogger('PerformanceManager');

/**
 * Quality presets for different performance levels
 */
export const QualityPresets = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    ULTRA: 'ultra',
    AUTO: 'auto' // Automatically determined based on device capabilities
};

/**
 * Performance settings for different quality levels
 */
const qualitySettings = {
    [QualityPresets.LOW]: {
        terrainSegments: 20,
        renderDistance: 2, // Reduced render distance
        shadowsEnabled: false,
        pixelRatio: 0.75,
        particleDensity: 0.3, // Reduced particles
        antialias: false,
        maxObjectsPerChunk: 10 // Fewer objects per chunk
    },
    [QualityPresets.MEDIUM]: {
        terrainSegments: 30,
        renderDistance: 3, // Reduced render distance
        shadowsEnabled: true,
        pixelRatio: 1.0,
        particleDensity: 0.5, // Reduced particles
        antialias: true,
        maxObjectsPerChunk: 20 // Fewer objects per chunk
    },
    [QualityPresets.HIGH]: {
        terrainSegments: 40,
        renderDistance: 4, // Reduced render distance
        shadowsEnabled: true,
        pixelRatio: window.devicePixelRatio,
        particleDensity: 0.8, // Reduced particles
        antialias: true,
        maxObjectsPerChunk: 30 // Fewer objects per chunk
    },
    [QualityPresets.ULTRA]: {
        terrainSegments: 50,
        renderDistance: 5, // Reduced render distance
        shadowsEnabled: true,
        pixelRatio: window.devicePixelRatio,
        particleDensity: 1.0, // Reduced particles
        antialias: true,
        maxObjectsPerChunk: 40, // Fewer objects per chunk
        skipNonEssentialUpdates: false,
        objectLoadDelay: 0, // No delay
        lowDetailDistance: 250,
        useLightHelpers: true
    }
};

/**
 * Manages performance settings and monitoring
 */
class PerformanceManager {
    constructor() {
        this.currentQuality = QualityPresets.AUTO;
        this.settings = { ...qualitySettings[QualityPresets.MEDIUM] }; // Default to medium
        this.fpsHistory = [];
        this.fpsUpdateInterval = 500; // ms
        this.lastFpsUpdate = 0;
        this.frameCount = 0;
        this.adaptiveQualityEnabled = true;
        this.targetFps = 50; // Target FPS for adaptive quality
        this.adaptiveQualityThreshold = 5; // FPS difference to trigger quality change
        this.adaptiveQualityCooldown = 5000; // ms between adaptive quality changes
        this.lastQualityChange = 0;
        this.onSettingsChanged = null; // Callback for when settings change
        this._resizeListenerAdded = false; // Flag to track if resize listener is added
        this._resizeTimeout = null; // For debouncing resize events
    }

    /**
     * Initialize the performance manager
     */
    init() {
        logger.debug('Initializing performance manager');

        // Detect device capabilities and set initial quality
        if (this.currentQuality === QualityPresets.AUTO) {
            this.detectDeviceCapabilities();
        }

        // Initialize FPS monitoring
        this.initFpsMonitoring();

        logger.debug(`Initial quality set to ${this.currentQuality}`);
        return this;
    }

    /**
     * Detect device capabilities and set appropriate quality preset
     */
    detectDeviceCapabilities() {
        // Import the isMobileDevice function from deviceUtils
        // We're using a more direct approach here to avoid circular dependencies
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isMobileByUserAgent = mobileRegex.test(navigator.userAgent);
        const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        const isMobileByScreenSize = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        const isMobile = isMobileByUserAgent || (isMobileByScreenSize && hasTouchScreen);

        // Check GPU capabilities via WebGL
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            logger.warn('WebGL not supported, defaulting to LOW quality');
            this.setQuality(QualityPresets.LOW);
            return;
        }

        // Get WebGL info
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
        const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : '';

        // Only log renderer info at ERROR level for debugging purposes
        if (logger.minLevel <= LogLevel.ERROR) {
            logger.error(`Detected renderer: ${renderer}, vendor: ${vendor}`);
        }

        // Check for WebGL 2 support
        const hasWebGL2 = !!window.WebGL2RenderingContext && !!canvas.getContext('webgl2');

        // Check memory (if available)
        let deviceMemory = navigator.deviceMemory || 4; // Default to 4GB if not available

        // Check for high-end mobile GPUs
        const isHighEndMobile = renderer.includes('Apple') ||
                               renderer.includes('Mali-G7') ||
                               renderer.includes('Mali-G8') ||
                               renderer.includes('Adreno 6') ||
                               renderer.includes('Adreno 7');

        // Check for high-end desktop GPUs
        const isHighEndDesktop = renderer.includes('NVIDIA RTX') ||
                                renderer.includes('AMD Radeon RX') ||
                                renderer.includes('Radeon Pro');

        // Check for mid-range desktop GPUs
        const isMidRangeDesktop = renderer.includes('NVIDIA GTX') ||
                                 renderer.includes('AMD Radeon') ||
                                 renderer.includes('Intel Iris');

        // Determine quality based on all factors
        if (isMobile) {
            if (isHighEndMobile && hasWebGL2 && deviceMemory >= 4) {
                this.setQuality(QualityPresets.MEDIUM);
            } else {
                this.setQuality(QualityPresets.LOW);
            }
        } else {
            // Desktop devices
            if (isHighEndDesktop && hasWebGL2 && deviceMemory >= 8) {
                this.setQuality(QualityPresets.HIGH);
            } else if (isMidRangeDesktop && hasWebGL2 && deviceMemory >= 4) {
                this.setQuality(QualityPresets.MEDIUM);
            } else {
                this.setQuality(QualityPresets.LOW);
            }
        }

        // Add a listener for window resize to potentially adjust quality
        if (!this._resizeListenerAdded) {
            window.addEventListener('resize', this._handleResize.bind(this));
            this._resizeListenerAdded = true;
        }
    }

    /**
     * Initialize FPS monitoring
     */
    initFpsMonitoring() {
        // Reset FPS tracking
        this.fpsHistory = [];
        this.lastFpsUpdate = performance.now();
        this.frameCount = 0;
    }

    /**
     * Update FPS tracking
     */
    updateFps() {
        this.frameCount++;

        const now = performance.now();
        const elapsed = now - this.lastFpsUpdate;

        if (elapsed >= this.fpsUpdateInterval) {
            const fps = (this.frameCount * 1000) / elapsed;
            this.fpsHistory.push(fps);

            // Keep history limited to last 10 readings
            if (this.fpsHistory.length > 10) {
                this.fpsHistory.shift();
            }

            // Reset counters
            this.lastFpsUpdate = now;
            this.frameCount = 0;

            // Check if we need to adapt quality
            if (this.adaptiveQualityEnabled) {
                this.checkAdaptiveQuality();
            }
        }
    }

    /**
     * Get the current FPS (average of recent history)
     * @returns {number} Current FPS
     */
    getCurrentFps() {
        if (this.fpsHistory.length === 0) return 60;

        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return sum / this.fpsHistory.length;
    }

    /**
     * Check if quality needs to be adapted based on FPS
     */
    checkAdaptiveQuality() {
        const now = performance.now();
        if (now - this.lastQualityChange < this.adaptiveQualityCooldown) {
            return; // Still in cooldown period
        }

        const currentFps = this.getCurrentFps();

        // If FPS is too low, decrease quality
        if (currentFps < this.targetFps - this.adaptiveQualityThreshold) {
            this.decreaseQuality();
            this.lastQualityChange = now;
        }
        // If FPS is high enough, consider increasing quality
        else if (currentFps > this.targetFps + this.adaptiveQualityThreshold * 2) {
            this.increaseQuality();
            this.lastQualityChange = now;
        }
    }

    /**
     * Decrease quality to improve performance
     */
    decreaseQuality() {
        const qualityLevels = [QualityPresets.LOW, QualityPresets.MEDIUM, QualityPresets.HIGH, QualityPresets.ULTRA];
        const currentIndex = qualityLevels.indexOf(this.currentQuality);

        if (currentIndex > 0) {
            const newQuality = qualityLevels[currentIndex - 1];
            this.setQuality(newQuality);
        }
    }

    /**
     * Increase quality if performance allows
     */
    increaseQuality() {
        const qualityLevels = [QualityPresets.LOW, QualityPresets.MEDIUM, QualityPresets.HIGH, QualityPresets.ULTRA];
        const currentIndex = qualityLevels.indexOf(this.currentQuality);

        if (currentIndex < qualityLevels.length - 1) {
            const newQuality = qualityLevels[currentIndex + 1];
            this.setQuality(newQuality);
        }
    }

    /**
     * Set quality preset
     * @param {string} quality - Quality preset to use
     */
    setQuality(quality) {
        if (!qualitySettings[quality]) {
            logger.error(`Invalid quality preset: ${quality}`);
            return;
        }

        this.currentQuality = quality;
        this.settings = { ...qualitySettings[quality] };

        // Notify listeners
        if (this.onSettingsChanged) {
            this.onSettingsChanged(this.settings);
        }
    }

    /**
     * Get current performance settings
     * @returns {Object} Current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Set a specific setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    setSetting(key, value) {
        if (this.settings[key] !== undefined) {
            this.settings[key] = value;

            // Custom quality when manually changing settings
            this.currentQuality = 'custom';

            // Notify listeners
            if (this.onSettingsChanged) {
                this.onSettingsChanged(this.settings);
            }
        }
    }

    /**
     * Enable or disable adaptive quality
     * @param {boolean} enabled - Whether adaptive quality is enabled
     */
    setAdaptiveQuality(enabled) {
        this.adaptiveQualityEnabled = enabled;
    }

    /**
     * Set callback for when settings change
     * @param {Function} callback - Callback function
     */
    setOnSettingsChanged(callback) {
        this.onSettingsChanged = callback;
    }

    /**
     * Handle window resize events to potentially adjust quality settings
     * Uses debouncing to prevent excessive quality changes during resize
     * @private
     */
    _handleResize() {
        // Clear any existing timeout
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }

        // Set a new timeout to debounce the resize event
        this._resizeTimeout = setTimeout(() => {
            // Only re-detect if we're using AUTO quality or if the window size changed significantly
            if (this.currentQuality === QualityPresets.AUTO) {
                this.detectDeviceCapabilities();
            } else {
                // Check if we've switched between mobile and desktop view
                const isMobileView = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
                const isMobileQuality = this.currentQuality === QualityPresets.LOW;

                // If there's a mismatch between view and quality, re-detect
                if ((isMobileView && !isMobileQuality) || (!isMobileView && isMobileQuality)) {
                    this.detectDeviceCapabilities();
                }
            }
        }, 500); // Wait 500ms after resize stops before re-detecting
    }
}

// Create singleton instance
const performanceManager = new PerformanceManager();

export default performanceManager;
