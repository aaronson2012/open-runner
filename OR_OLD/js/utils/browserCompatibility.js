/**
 * Browser Compatibility Checker
 * Checks for required browser features and provides fallbacks
 */
import { createLogger } from './logger.js';

const logger = createLogger('BrowserCompatibility');

export class BrowserCompatibility {
    constructor() {
        this.requiredFeatures = {
            webgl: false,
            es6Modules: false,
            webAudio: false,
            requestAnimationFrame: false,
            webWorkers: false
        };
        
        this.checkAllFeatures();
    }

    /**
     * Checks all required browser features
     */
    checkAllFeatures() {
        this.requiredFeatures.webgl = this.checkWebGL();
        this.requiredFeatures.es6Modules = this.checkES6Modules();
        this.requiredFeatures.webAudio = this.checkWebAudio();
        this.requiredFeatures.requestAnimationFrame = this.checkRequestAnimationFrame();
        this.requiredFeatures.webWorkers = this.checkWebWorkers();
        
        logger.info('Browser compatibility check complete:', this.requiredFeatures);
    }

    /**
     * Checks for WebGL support
     * @returns {boolean} True if WebGL is supported
     */
    checkWebGL() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!(gl && gl.getExtension);
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks for ES6 modules support
     * @returns {boolean} True if ES6 modules are supported
     */
    checkES6Modules() {
        try {
            return 'import' in window.HTMLScriptElement.prototype;
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks for Web Audio API support
     * @returns {boolean} True if Web Audio is supported
     */
    checkWebAudio() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    /**
     * Checks for requestAnimationFrame support
     * @returns {boolean} True if requestAnimationFrame is supported
     */
    checkRequestAnimationFrame() {
        return !!(window.requestAnimationFrame || 
                 window.webkitRequestAnimationFrame || 
                 window.mozRequestAnimationFrame || 
                 window.oRequestAnimationFrame || 
                 window.msRequestAnimationFrame);
    }

    /**
     * Checks for Web Workers support
     * @returns {boolean} True if Web Workers are supported
     */
    checkWebWorkers() {
        return !!window.Worker;
    }

    /**
     * Gets all missing features
     * @returns {string[]} Array of missing feature names
     */
    getMissingFeatures() {
        return Object.keys(this.requiredFeatures)
            .filter(feature => !this.requiredFeatures[feature]);
    }

    /**
     * Checks if the browser is compatible
     * @returns {boolean} True if all required features are available
     */
    isCompatible() {
        const criticalFeatures = ['webgl', 'requestAnimationFrame'];
        return criticalFeatures.every(feature => this.requiredFeatures[feature]);
    }

    /**
     * Shows compatibility warning to users
     */
    showCompatibilityWarning() {
        const missingFeatures = this.getMissingFeatures();
        
        if (missingFeatures.length === 0) return;
        
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 152, 0, 0.95);
            color: white;
            padding: 15px;
            border-radius: 8px;
            max-width: 300px;
            z-index: 9999;
            font-family: var(--body-font, Arial, sans-serif);
            font-size: 14px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        
        const criticalMissing = missingFeatures.filter(f => ['webgl', 'requestAnimationFrame'].includes(f));
        const isCritical = criticalMissing.length > 0;
        
        warningDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0;">
                ${isCritical ? '⚠️ Browser Compatibility Issue' : '📋 Feature Notice'}
            </h4>
            <p style="margin: 0 0 10px 0; font-size: 13px;">
                ${isCritical 
                    ? 'Your browser is missing critical features required for this game:'
                    : 'Some optional features are not available in your browser:'
                }
            </p>
            <ul style="margin: 0 0 10px 0; padding-left: 20px; font-size: 12px;">
                ${missingFeatures.map(feature => `<li>${this.getFeatureDescription(feature)}</li>`).join('')}
            </ul>
            ${isCritical ? `
                <p style="margin: 0; font-size: 12px;">
                    Please update your browser or try a different one for the best experience.
                </p>
            ` : ''}
            <button onclick="this.parentNode.remove()" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                margin-top: 10px;
                float: right;
            ">Close</button>
        `;
        
        document.body.appendChild(warningDiv);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (warningDiv.parentNode) {
                warningDiv.parentNode.removeChild(warningDiv);
            }
        }, 15000);
    }

    /**
     * Gets user-friendly description for a feature
     * @param {string} feature - Feature name
     * @returns {string} User-friendly description
     */
    getFeatureDescription(feature) {
        const descriptions = {
            webgl: 'WebGL (3D graphics)',
            es6Modules: 'ES6 Modules (modern JavaScript)',
            webAudio: 'Web Audio API (sound effects)',
            requestAnimationFrame: 'Animation API (smooth gameplay)',
            webWorkers: 'Web Workers (background processing)'
        };
        
        return descriptions[feature] || feature;
    }

    /**
     * Installs polyfills for missing features where possible
     */
    installPolyfills() {
        // RequestAnimationFrame polyfill
        if (!this.requiredFeatures.requestAnimationFrame) {
            logger.info('Installing requestAnimationFrame polyfill');
            let lastTime = 0;
            window.requestAnimationFrame = function(callback) {
                const currTime = new Date().getTime();
                const timeToCall = Math.max(0, 16 - (currTime - lastTime));
                const id = window.setTimeout(function() { 
                    callback(currTime + timeToCall); 
                }, timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
            
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
        }
    }
}

// Create global instance
export const browserCompatibility = new BrowserCompatibility();