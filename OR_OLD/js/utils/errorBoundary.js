/**
 * Error Boundary and Global Error Handler
 * Provides graceful error handling and recovery mechanisms
 */
import { createLogger } from './logger.js';
import eventBus from '../core/eventBus.js';

const logger = createLogger('ErrorBoundary');

export class ErrorBoundary {
    constructor() {
        this.errorCount = 0;
        this.maxErrors = 5; // Maximum errors before entering safe mode
        this.safeMode = false;
        this.setupGlobalHandlers();
        
        logger.info('ErrorBoundary initialized');
    }

    /**
     * Sets up global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                type: 'javascript'
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                message: `Unhandled Promise Rejection: ${event.reason}`,
                error: event.reason,
                type: 'promise'
            });
        });

        // Handle WebGL context loss
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('webglcontextlost', (event) => {
                event.preventDefault();
                this.handleWebGLContextLoss();
            });

            canvas.addEventListener('webglcontextrestored', () => {
                this.handleWebGLContextRestored();
            });
        }
    }

    /**
     * Handles errors with appropriate recovery strategies
     * @param {Object} errorInfo - Error information
     */
    handleError(errorInfo) {
        this.errorCount++;
        
        logger.error(`Error ${this.errorCount}/${this.maxErrors}:`, errorInfo);

        // Create user-friendly error message
        const userMessage = this.createUserFriendlyMessage(errorInfo);
        
        // Check if we should enter safe mode
        if (this.errorCount >= this.maxErrors && !this.safeMode) {
            this.enterSafeMode();
            return;
        }

        // Try to recover based on error type
        this.attemptRecovery(errorInfo);
        
        // Notify user
        this.showErrorNotification(userMessage);
    }

    /**
     * Creates a user-friendly error message
     * @param {Object} errorInfo - Error information
     * @returns {string} User-friendly message
     */
    createUserFriendlyMessage(errorInfo) {
        if (errorInfo.type === 'webgl') {
            return 'Graphics system encountered an issue. The game will attempt to recover.';
        }
        
        if (errorInfo.message && errorInfo.message.includes('network')) {
            return 'Network connection issue detected. Please check your internet connection.';
        }
        
        if (errorInfo.message && errorInfo.message.includes('memory')) {
            return 'The game is using too much memory. Consider closing other browser tabs.';
        }
        
        return 'An unexpected error occurred. The game will try to continue.';
    }

    /**
     * Attempts to recover from specific types of errors
     * @param {Object} errorInfo - Error information
     */
    attemptRecovery(errorInfo) {
        try {
            if (errorInfo.type === 'webgl') {
                // WebGL recovery is handled separately
                return;
            }
            
            if (errorInfo.message && errorInfo.message.includes('memory')) {
                // Trigger garbage collection and reduce quality
                this.performMemoryCleanup();
                return;
            }
            
            if (errorInfo.type === 'promise' && errorInfo.message.includes('audio')) {
                // Audio system recovery
                eventBus.emit('audioSystemError', errorInfo);
                return;
            }
            
            // General recovery: try to continue with reduced functionality
            this.reduceGameComplexity();
            
        } catch (recoveryError) {
            logger.error('Error during recovery attempt:', recoveryError);
        }
    }

    /**
     * Handles WebGL context loss
     */
    handleWebGLContextLoss() {
        logger.warn('WebGL context lost, attempting to handle gracefully');
        
        this.showErrorNotification(
            'Graphics system is reloading. Please wait...',
            'warning'
        );
        
        eventBus.emit('webglContextLost');
    }

    /**
     * Handles WebGL context restoration
     */
    handleWebGLContextRestored() {
        logger.info('WebGL context restored');
        
        this.showErrorNotification(
            'Graphics system restored successfully!',
            'success'
        );
        
        eventBus.emit('webglContextRestored');
    }

    /**
     * Performs memory cleanup to prevent out-of-memory errors
     */
    performMemoryCleanup() {
        logger.info('Performing emergency memory cleanup');
        
        // Emit event for game systems to clean up
        eventBus.emit('performMemoryCleanup');
        
        // Force garbage collection if available
        if (window.gc) {
            try {
                window.gc();
                logger.debug('Manual garbage collection performed');
            } catch (e) {
                logger.debug('Manual garbage collection not available');
            }
        }
    }

    /**
     * Reduces game complexity to improve stability
     */
    reduceGameComplexity() {
        logger.info('Reducing game complexity for stability');
        
        eventBus.emit('reduceComplexity', {
            shadowsEnabled: false,
            particleDensity: 0.3,
            terrainSegments: 16,
            renderDistance: 2
        });
    }

    /**
     * Enters safe mode when too many errors occur
     */
    enterSafeMode() {
        this.safeMode = true;
        logger.warn('Entering safe mode due to multiple errors');
        
        // Show safe mode UI
        this.showSafeModeInterface();
        
        // Emit safe mode event
        eventBus.emit('safeModeActivated');
    }

    /**
     * Shows the safe mode interface
     */
    showSafeModeInterface() {
        const safeModeDiv = document.createElement('div');
        safeModeDiv.id = 'safeModeInterface';
        safeModeDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(244, 67, 54, 0.95);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: var(--body-font, Arial, sans-serif);
        `;
        
        safeModeDiv.innerHTML = `
            <h2>🛡️ Safe Mode</h2>
            <p style="text-align: center; max-width: 500px; margin: 20px;">
                The game has encountered multiple errors and is now running in safe mode. 
                Some features may be disabled to ensure stability.
            </p>
            <div style="margin-top: 20px;">
                <button onclick="location.reload()" style="
                    background: #fff;
                    color: #f44336;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 0 10px;
                ">Restart Game</button>
                <button onclick="document.getElementById('safeModeInterface').style.display='none'" style="
                    background: transparent;
                    color: #fff;
                    border: 2px solid #fff;
                    padding: 8px 18px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 0 10px;
                ">Continue in Safe Mode</button>
            </div>
        `;
        
        document.body.appendChild(safeModeDiv);
    }

    /**
     * Shows an error notification to the user
     * @param {string} message - Message to show
     * @param {string} type - Notification type: 'error', 'warning', 'success'
     */
    showErrorNotification(message, type = 'error') {
        // Use existing notification system if available
        if (typeof eventBus !== 'undefined') {
            eventBus.emit('showNotification', { message, type });
        } else {
            // Fallback to console
            console.warn(`[ErrorBoundary] ${message}`);
        }
    }

    /**
     * Resets the error count (useful for recovery)
     */
    resetErrorCount() {
        this.errorCount = 0;
        logger.info('Error count reset');
    }

    /**
     * Gets current error boundary status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            safeMode: this.safeMode
        };
    }
}

// Create global error boundary instance
export const errorBoundary = new ErrorBoundary();