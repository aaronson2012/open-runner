// js/utils/deviceUtils.js

import { createLogger } from './logger.js'; // Path remains correct

const logger = createLogger('DeviceUtils');

/**
 * Checks if the current device is a mobile device
 * @returns {boolean} True if the device is mobile, false otherwise
 */
export function isMobileDevice() {
    // Check for mobile user agent - primary indicator
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileByUserAgent = mobileRegex.test(navigator.userAgent);

    // Check for touch capability
    const hasTouchScreen = (
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0)
    );

    // Check for small screen size
    const isMobileByScreenSize = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

    // IMPROVED DETECTION LOGIC:
    // 1. If user agent indicates mobile -> it's mobile
    // 2. If screen is small AND has touch capability -> it's mobile
    // 3. Otherwise, it's desktop (even if it has touch or small screen alone)
    const result = isMobileByUserAgent || (isMobileByScreenSize && hasTouchScreen);

    // Only log on first detection or when result changes
    if (!window._lastMobileDetectionResult || window._lastMobileDetectionResult !== result) {
        logger.debug(`Device detection: isMobile=${result}`);
        window._lastMobileDetectionResult = result;
    }

    return result;
}

/**
 * Sets the appropriate device class on the body element
 */
export function setDeviceClass() {
    const isMobile = isMobileDevice();

    // Remove any existing device classes
    document.body.classList.remove('mobile-device', 'desktop-device');

    // Add the appropriate device class
    if (isMobile) {
        document.body.classList.add('mobile-device');
    } else {
        document.body.classList.add('desktop-device');
    }
}

// Add a resize listener to update device class when window size changes
// Use a flag to ensure we only add the listener once
let resizeListenerAdded = false;

/**
 * Sets up the resize event listener if it hasn't been added yet
 */
export function setupResizeListener() {
    if (resizeListenerAdded) return;

    window.addEventListener('resize', () => {
        setDeviceClass();

        // If we're in a game state that should show mobile controls, update them
        if (document.body.classList.contains('show-mobile-controls')) {
            updateMobileControlsVisibility();
        }
    });

    resizeListenerAdded = true;
}

// Set up the resize listener when this module is imported
setupResizeListener();

/**
 * Updates the mobile controls visibility based on device type
 * @param {boolean} [forceShow] - Optional parameter to force showing mobile controls regardless of device
 * @param {boolean} [forceHide] - Optional parameter to force hiding mobile controls regardless of device
 */
export function updateMobileControlsVisibility(forceShow = false, forceHide = false) {
    // First ensure the device class is set
    setDeviceClass();

    if (forceHide) {
        // Force hide mobile controls
        document.body.classList.remove('show-mobile-controls');
        document.body.classList.remove('force-show-mobile-controls');
    } else if (forceShow) {
        // Force show mobile controls
        document.body.classList.add('show-mobile-controls');
        document.body.classList.add('force-show-mobile-controls');
    } else {
        // Normal behavior - only show on mobile
        document.body.classList.remove('force-show-mobile-controls');
        if (isMobileDevice()) {
            document.body.classList.add('show-mobile-controls');
        } else {
            document.body.classList.remove('show-mobile-controls');
        }
    }

    // Ensure the mobile controls element exists
    const mobileControls = document.getElementById('mobileControls');
    if (!mobileControls) {
        logger.warn('Mobile controls element not found in the DOM');
        return;
    }
}
