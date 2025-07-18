/**
 * Resource Loader Utility
 * Provides fallback mechanisms for external resource loading
 */
import { createLogger } from './logger.js';

const logger = createLogger('ResourceLoader');

/**
 * Tests if external resources are available
 * @returns {Promise<boolean>} True if resources are accessible
 */
export async function testExternalResources() {
    try {
        // Test a simple fetch to unpkg.com
        const response = await fetch('https://unpkg.com/three@0.163.0/build/three.module.js', {
            method: 'HEAD',
            mode: 'no-cors'
        });
        return true;
    } catch (error) {
        logger.warn('External resources are not accessible:', error.message);
        return false;
    }
}

/**
 * Loads a script with fallback error handling
 * @param {string} src - Script source URL
 * @param {Object} options - Loading options
 * @returns {Promise<boolean>} True if loaded successfully
 */
export function loadScript(src, options = {}) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        
        if (options.type) script.type = options.type;
        if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
        if (options.integrity) script.integrity = options.integrity;
        
        script.onload = () => {
            logger.debug(`Successfully loaded script: ${src}`);
            resolve(true);
        };
        
        script.onerror = (error) => {
            logger.error(`Failed to load script: ${src}`, error);
            resolve(false); // Resolve false instead of reject to allow fallback handling
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Shows a user-friendly message when external resources fail
 */
export function showResourceLoadingError() {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        z-index: 10000;
        font-family: var(--body-font, Arial, sans-serif);
        max-width: 400px;
    `;
    
    errorDiv.innerHTML = `
        <h3>🚫 Resource Loading Error</h3>
        <p>Unable to load external game resources. This may be due to:</p>
        <ul style="text-align: left; margin: 10px 0;">
            <li>Network restrictions or firewall</li>
            <li>Ad blockers or content filters</li>
            <li>CDN service issues</li>
        </ul>
        <p>Please try refreshing the page or check your network connection.</p>
        <button onclick="location.reload()" style="
            background: #fff;
            color: #f44336;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        ">Retry</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 10000);
}