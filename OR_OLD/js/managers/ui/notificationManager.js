// js/managers/ui/notificationManager.js
import eventBus from '../../core/eventBus.js';
import { createLogger } from '../../utils/logger.js';
import { getConfig } from '../../config/config.js';

const logger = createLogger('NotificationManager');

// --- Element References ---
let notificationElement;

// --- Internal State ---
let notificationTimeout = null;

/**
 * Initializes the Notification Manager.
 * @returns {boolean} True if initialization is successful.
 */
export function init() {
    logger.info("Initializing NotificationManager...");

    notificationElement = document.getElementById('notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'notification';
        notificationElement.className = 'notification';
        notificationElement.style.display = 'none';
        document.body.appendChild(notificationElement);
    }

    eventBus.subscribe('newHighScore', (data) => {
        showNotification(`New High Score: ${data.score}!`, 'high-score-notification');
    });
    eventBus.subscribe('levelUnlockSaved', (levelId) => {
        showNotification(`Level ${levelId} Unlocked!`, 'level-unlock-notification');
    });
    eventBus.subscribe('errorOccurred', (errorMessage) => {
        displayError(errorMessage);
    });


    logger.info("NotificationManager initialized successfully.");
    return true;
}

/**
 * Shows a notification with the given message.
 * @param {string} message - The notification message.
 * @param {string} [className] - Optional CSS class for styling.
 * @param {number} [duration] - How long to show the notification in ms.
 */
function showNotification(message, className = '', duration) {
    if (!notificationElement) return;

    const effectiveDuration = duration ?? getConfig('ui.UI_NOTIFICATION_DURATION_MS', 3000);
    const fadeDurationMs = getConfig('ui.UI_NOTIFICATION_FADE_DURATION_MS', 300);

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    notificationElement.textContent = message;
    notificationElement.className = 'notification';
    if (className) {
        notificationElement.classList.add(className);
    }
    notificationElement.style.display = 'block';
    notificationElement.style.animation = 'fadeIn 0.3s ease-out';

    notificationTimeout = setTimeout(() => {
        notificationElement.style.opacity = '0';
        notificationElement.style.transform = 'translateY(-20px)';
        notificationElement.style.transition = `opacity ${fadeDurationMs / 1000}s ease, transform ${fadeDurationMs / 1000}s ease`;

        setTimeout(() => {
            notificationElement.style.display = 'none';
            notificationElement.style.opacity = '';
            notificationElement.style.transform = '';
            notificationElement.style.transition = '';
        }, fadeDurationMs);
    }, effectiveDuration);
}

/**
 * Displays an error message on the screen.
 * @param {string} errorMessage - The error message string.
 */
function displayError(errorMessage) {
    logger.error("Displaying error to user:", errorMessage);
    let errorDiv = document.getElementById('runtimeErrorDisplay');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'runtimeErrorDisplay';
        errorDiv.style.position = 'fixed';
        errorDiv.style.bottom = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.padding = '15px';
        errorDiv.style.backgroundColor = 'rgba(200, 0, 0, 0.85)';
        errorDiv.style.color = 'white';
        errorDiv.style.fontFamily = 'monospace';
        errorDiv.style.fontSize = '14px';
        errorDiv.style.border = '1px solid darkred';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.zIndex = '1000';
        errorDiv.style.maxWidth = '80%';
        errorDiv.style.whiteSpace = 'pre-wrap';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = `Error: ${errorMessage}\n(Check console for more details)`;
    errorDiv.style.display = 'block';
}