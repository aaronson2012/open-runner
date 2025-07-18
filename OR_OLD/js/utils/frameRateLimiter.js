/**
 * Frame Rate Limiter and Performance Monitor
 * Helps maintain stable frame rates and monitors performance
 */
import { createLogger } from './logger.js';

const logger = createLogger('FrameRateLimiter');

export class FrameRateLimiter {
    constructor(targetFps = 60) {
        this.targetFps = targetFps;
        this.targetFrameTime = 1000 / targetFps; // Target time per frame in ms
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.performanceHistory = [];
        this.maxHistoryLength = 60; // Store last 60 frame times for analysis
        this.adaptiveQuality = true;
        this.qualityLevel = 'high'; // high, medium, low
        
        logger.info(`FrameRateLimiter initialized with target FPS: ${targetFps}`);
    }

    /**
     * Checks if enough time has passed to render the next frame
     * @param {number} currentTime - Current timestamp from performance.now()
     * @returns {boolean} True if should render this frame
     */
    shouldRender(currentTime) {
        const deltaTime = currentTime - this.lastFrameTime;
        
        if (deltaTime >= this.targetFrameTime) {
            this.lastFrameTime = currentTime;
            this.recordFrameTime(deltaTime);
            this.frameCount++;
            return true;
        }
        
        return false;
    }

    /**
     * Records frame time for performance analysis
     * @param {number} frameTime - Time taken for this frame
     */
    recordFrameTime(frameTime) {
        this.performanceHistory.push(frameTime);
        
        if (this.performanceHistory.length > this.maxHistoryLength) {
            this.performanceHistory.shift();
        }
        
        // Analyze performance every 60 frames
        if (this.frameCount % 60 === 0 && this.adaptiveQuality) {
            this.analyzePerformance();
        }
    }

    /**
     * Analyzes recent performance and adjusts quality if needed
     */
    analyzePerformance() {
        if (this.performanceHistory.length < 30) return;
        
        const recentFrames = this.performanceHistory.slice(-30);
        const averageFrameTime = recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length;
        const currentFps = 1000 / averageFrameTime;
        
        const slowFrames = recentFrames.filter(time => time > this.targetFrameTime * 1.5).length;
        const slowFramePercentage = slowFrames / recentFrames.length;
        
        logger.debug(`Performance analysis: ${currentFps.toFixed(1)} FPS, ${(slowFramePercentage * 100).toFixed(1)}% slow frames`);
        
        // Adjust quality based on performance
        if (slowFramePercentage > 0.3 && this.qualityLevel !== 'low') {
            this.reduceQuality();
        } else if (slowFramePercentage < 0.1 && this.qualityLevel !== 'high' && currentFps > this.targetFps * 0.9) {
            this.increaseQuality();
        }
    }

    /**
     * Reduces rendering quality to improve performance
     */
    reduceQuality() {
        const previousQuality = this.qualityLevel;
        
        if (this.qualityLevel === 'high') {
            this.qualityLevel = 'medium';
        } else if (this.qualityLevel === 'medium') {
            this.qualityLevel = 'low';
        }
        
        if (this.qualityLevel !== previousQuality) {
            logger.info(`Performance: Reduced quality from ${previousQuality} to ${this.qualityLevel}`);
            this.emitQualityChange();
        }
    }

    /**
     * Increases rendering quality when performance allows
     */
    increaseQuality() {
        const previousQuality = this.qualityLevel;
        
        if (this.qualityLevel === 'low') {
            this.qualityLevel = 'medium';
        } else if (this.qualityLevel === 'medium') {
            this.qualityLevel = 'high';
        }
        
        if (this.qualityLevel !== previousQuality) {
            logger.info(`Performance: Increased quality from ${previousQuality} to ${this.qualityLevel}`);
            this.emitQualityChange();
        }
    }

    /**
     * Emits quality change event (placeholder for event system integration)
     */
    emitQualityChange() {
        // Could be integrated with the game's event system
        const event = new CustomEvent('qualityChanged', {
            detail: { qualityLevel: this.qualityLevel }
        });
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
    }

    /**
     * Gets current performance statistics
     * @returns {Object} Performance stats
     */
    getPerformanceStats() {
        if (this.performanceHistory.length === 0) {
            return { fps: 0, averageFrameTime: 0, qualityLevel: this.qualityLevel };
        }
        
        const recentFrames = this.performanceHistory.slice(-30);
        const averageFrameTime = recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length;
        const fps = 1000 / averageFrameTime;
        
        return {
            fps: Math.round(fps),
            averageFrameTime: Math.round(averageFrameTime * 100) / 100,
            qualityLevel: this.qualityLevel,
            frameCount: this.frameCount
        };
    }

    /**
     * Enables or disables adaptive quality adjustment
     * @param {boolean} enabled - Whether to enable adaptive quality
     */
    setAdaptiveQuality(enabled) {
        this.adaptiveQuality = enabled;
        logger.info(`Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Manually sets the quality level
     * @param {string} level - Quality level: 'high', 'medium', or 'low'
     */
    setQualityLevel(level) {
        if (['high', 'medium', 'low'].includes(level)) {
            this.qualityLevel = level;
            this.emitQualityChange();
            logger.info(`Quality level manually set to: ${level}`);
        } else {
            logger.warn(`Invalid quality level: ${level}`);
        }
    }
}

// Create a default instance
export const frameRateLimiter = new FrameRateLimiter(60);