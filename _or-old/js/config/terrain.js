import { getConfig } from './config.js'; // Import the getConfig helper
import configManager from '../utils/configManager.js'; // Import configManager

const DEFAULT_SEGMENTS_X = 30;
const DEFAULT_SEGMENTS_Y = 30;

export const terrainConfig = {
    get SEGMENTS_X() {
        if (!configManager.isInitialized()) {
            return DEFAULT_SEGMENTS_X;
        }
        return getConfig('terrain.SEGMENTS_X', DEFAULT_SEGMENTS_X);
    },
    get SEGMENTS_Y() {
        if (!configManager.isInitialized()) {
            return DEFAULT_SEGMENTS_Y;
        }
        return getConfig('terrain.SEGMENTS_Y', DEFAULT_SEGMENTS_Y);
    }
};