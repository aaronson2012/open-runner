import { getConfig } from './config.js'; // Import the getConfig helper
import configManager from '../utils/configManager.js'; // Import configManager

const DEFAULT_SHADOWS_ENABLED = true;
const DEFAULT_PIXEL_RATIO = typeof window !== 'undefined' ? window.devicePixelRatio : 1; // Fallback for non-browser env
const DEFAULT_ANTIALIAS = true;

export const renderingConfig = {
    get SHADOWS_ENABLED() {
        if (!configManager.isInitialized()) {
            return DEFAULT_SHADOWS_ENABLED;
        }
        return getConfig('rendering.SHADOWS_ENABLED', DEFAULT_SHADOWS_ENABLED);
    },
    get PIXEL_RATIO() {
        if (!configManager.isInitialized()) {
            return DEFAULT_PIXEL_RATIO;
        }
        return getConfig('rendering.PIXEL_RATIO', DEFAULT_PIXEL_RATIO);
    },
    get ANTIALIAS() {
        if (!configManager.isInitialized()) {
            return DEFAULT_ANTIALIAS;
        }
        return getConfig('rendering.ANTIALIAS', DEFAULT_ANTIALIAS);
    }
};