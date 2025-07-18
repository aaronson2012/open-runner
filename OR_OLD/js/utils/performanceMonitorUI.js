/**
 * Performance Monitor UI
 * Provides visual feedback about game performance to users
 */
import { createLogger } from './logger.js';
import { frameRateLimiter } from './frameRateLimiter.js';

const logger = createLogger('PerformanceMonitor');

export class PerformanceMonitorUI {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.performanceElement = null;
        this.warningElement = null;
        this.createUI();
        
        logger.info('PerformanceMonitorUI initialized');
    }

    /**
     * Creates the performance monitor UI elements
     */
    createUI() {
        // Create performance display element
        this.performanceElement = document.createElement('div');
        this.performanceElement.id = 'performanceMonitor';
        this.performanceElement.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 9998;
            display: none;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        // Create performance warning element
        this.warningElement = document.createElement('div');
        this.warningElement.id = 'performanceWarning';
        this.warningElement.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 152, 0, 0.95);
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            font-family: var(--body-font, Arial, sans-serif);
            font-size: 13px;
            z-index: 9999;
            display: none;
            max-width: 300px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;

        document.body.appendChild(this.performanceElement);
        document.body.appendChild(this.warningElement);
    }

    /**
     * Shows the performance monitor
     */
    show() {
        if (!this.isVisible) {
            this.isVisible = true;
            this.performanceElement.style.display = 'block';
            this.startUpdating();
            logger.debug('Performance monitor shown');
        }
    }

    /**
     * Hides the performance monitor
     */
    hide() {
        if (this.isVisible) {
            this.isVisible = false;
            this.performanceElement.style.display = 'none';
            this.stopUpdating();
            logger.debug('Performance monitor hidden');
        }
    }

    /**
     * Toggles the performance monitor visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Starts updating the performance display
     */
    startUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 500); // Update every 500ms
    }

    /**
     * Stops updating the performance display
     */
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Updates the performance display with current stats
     */
    updateDisplay() {
        if (!this.isVisible) return;

        const stats = frameRateLimiter.getPerformanceStats();
        const memoryInfo = this.getMemoryInfo();
        
        let displayText = `FPS: ${stats.fps}\n`;
        displayText += `Quality: ${stats.qualityLevel}\n`;
        displayText += `Frame Time: ${stats.averageFrameTime}ms\n`;
        
        if (memoryInfo) {
            displayText += `Memory: ${memoryInfo.used}MB\n`;
        }

        this.performanceElement.innerHTML = displayText.replace(/\n/g, '<br>');

        // Check for performance issues
        this.checkPerformanceIssues(stats);
    }

    /**
     * Gets memory usage information if available
     * @returns {Object|null} Memory information or null if not available
     */
    getMemoryInfo() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    /**
     * Checks for performance issues and shows warnings
     * @param {Object} stats - Performance statistics
     */
    checkPerformanceIssues(stats) {
        const lowFpsThreshold = 30;
        const highFrameTimeThreshold = 50; // ms

        if (stats.fps < lowFpsThreshold || stats.averageFrameTime > highFrameTimeThreshold) {
            this.showPerformanceWarning(`
                ⚠️ Performance Issue Detected<br>
                <small>FPS: ${stats.fps} | Frame Time: ${stats.averageFrameTime}ms</small><br>
                <small>Quality automatically adjusted to: ${stats.qualityLevel}</small>
            `);
        } else {
            this.hidePerformanceWarning();
        }

        // Memory warning
        const memoryInfo = this.getMemoryInfo();
        if (memoryInfo && memoryInfo.used > memoryInfo.limit * 0.8) {
            this.showPerformanceWarning(`
                🐏 High Memory Usage<br>
                <small>Using ${memoryInfo.used}MB of ${memoryInfo.limit}MB</small><br>
                <small>Consider closing other browser tabs</small>
            `);
        }
    }

    /**
     * Shows a performance warning
     * @param {string} message - Warning message
     */
    showPerformanceWarning(message) {
        this.warningElement.innerHTML = message;
        this.warningElement.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hidePerformanceWarning();
        }, 5000);
    }

    /**
     * Hides the performance warning
     */
    hidePerformanceWarning() {
        this.warningElement.style.display = 'none';
    }

    /**
     * Shows performance tips to the user
     */
    showPerformanceTips() {
        const tipsDiv = document.createElement('div');
        tipsDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(33, 33, 33, 0.95);
            color: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            z-index: 10000;
            font-family: var(--body-font, Arial, sans-serif);
            font-size: 14px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        tipsDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: var(--accent-color, #FF9800);">
                🚀 Performance Tips
            </h3>
            <ul style="margin: 0 0 15px 0; padding-left: 20px;">
                <li>Close unnecessary browser tabs</li>
                <li>Update your graphics drivers</li>
                <li>Use a wired internet connection</li>
                <li>Close other applications using GPU</li>
                <li>Try incognito/private browsing mode</li>
                <li>Restart your browser periodically</li>
            </ul>
            <p style="margin: 0 0 15px 0; font-size: 12px; opacity: 0.8;">
                The game automatically adjusts quality based on your device's performance.
            </p>
            <button onclick="this.parentNode.remove()" style="
                background: var(--accent-color, #FF9800);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                float: right;
            ">Got it!</button>
        `;

        document.body.appendChild(tipsDiv);
    }

    /**
     * Cleanup method
     */
    cleanup() {
        this.stopUpdating();
        
        if (this.performanceElement && this.performanceElement.parentNode) {
            this.performanceElement.parentNode.removeChild(this.performanceElement);
        }
        
        if (this.warningElement && this.warningElement.parentNode) {
            this.warningElement.parentNode.removeChild(this.warningElement);
        }
        
        logger.info('PerformanceMonitorUI cleanup completed');
    }
}

// Create global instance
export const performanceMonitorUI = new PerformanceMonitorUI();

// Listen for quality change events
if (typeof window !== 'undefined') {
    window.addEventListener('qualityChanged', (event) => {
        logger.info('Quality changed to:', event.detail.qualityLevel);
    });
}