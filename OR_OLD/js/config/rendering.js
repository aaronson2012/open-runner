import performanceManager from '../utils/performanceManager.js';
export const renderingConfig = {
    SHADOWS_ENABLED: performanceManager.getSettings().shadowsEnabled,
    PIXEL_RATIO: performanceManager.getSettings().pixelRatio,
    ANTIALIAS: performanceManager.getSettings().antialias
};