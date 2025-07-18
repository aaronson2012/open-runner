/**
 * Keyboard Navigation Helper
 * Improves keyboard accessibility throughout the game UI
 */
import { createLogger } from './logger.js';

const logger = createLogger('KeyboardNavigation');

export class KeyboardNavigation {
    constructor() {
        this.focusableElements = [];
        this.currentFocusIndex = -1;
        this.enabled = false;
        this.setupKeyboardHandlers();
        
        logger.info('KeyboardNavigation initialized');
    }

    /**
     * Sets up global keyboard event handlers
     */
    setupKeyboardHandlers() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        // Track when user starts using keyboard navigation
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                this.enableKeyboardNavigation();
            }
        });

        // Track when user starts using mouse
        document.addEventListener('mousedown', () => {
            this.disableKeyboardNavigation();
        });
    }

    /**
     * Enables keyboard navigation mode
     */
    enableKeyboardNavigation() {
        if (!this.enabled) {
            this.enabled = true;
            document.body.classList.add('keyboard-navigation');
            logger.debug('Keyboard navigation enabled');
        }
    }

    /**
     * Disables keyboard navigation mode
     */
    disableKeyboardNavigation() {
        if (this.enabled) {
            this.enabled = false;
            document.body.classList.remove('keyboard-navigation');
            logger.debug('Keyboard navigation disabled');
        }
    }

    /**
     * Handles keydown events for navigation
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyDown(event) {
        // Handle escape key to close modals/menus
        if (event.key === 'Escape') {
            this.handleEscapeKey(event);
            return;
        }

        // Handle enter/space on focused elements
        if (event.key === 'Enter' || event.key === ' ') {
            this.handleActivationKey(event);
            return;
        }

        // Handle arrow keys for navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            this.handleArrowKeys(event);
            return;
        }
    }

    /**
     * Handles escape key press
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleEscapeKey(event) {
        // Find the topmost visible modal or menu
        const modals = document.querySelectorAll('.ui-overlay[style*="display: block"], .ui-overlay:not([style*="display: none"])');
        
        if (modals.length > 0) {
            const topModal = modals[modals.length - 1];
            
            // Try to find a close button or back button
            const closeButton = topModal.querySelector('.back-button, .close-button, [aria-label*="close"], [aria-label*="back"]');
            
            if (closeButton) {
                event.preventDefault();
                closeButton.click();
                logger.debug('Escape key closed modal via button click');
                return;
            }
            
            // If no close button, try to hide the modal
            topModal.style.display = 'none';
            logger.debug('Escape key hid modal');
        }
    }

    /**
     * Handles enter/space key press on focused elements
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleActivationKey(event) {
        const focused = document.activeElement;
        
        if (focused && (focused.tagName === 'BUTTON' || focused.getAttribute('role') === 'button')) {
            event.preventDefault();
            focused.click();
            logger.debug('Activation key triggered button');
        }
    }

    /**
     * Handles arrow key navigation
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleArrowKeys(event) {
        const visibleModal = this.getVisibleModal();
        
        if (visibleModal) {
            this.navigateInModal(visibleModal, event);
        } else {
            this.navigateInMainUI(event);
        }
    }

    /**
     * Gets the currently visible modal/dialog
     * @returns {Element|null} The visible modal element
     */
    getVisibleModal() {
        const modals = document.querySelectorAll('.ui-overlay');
        return Array.from(modals).find(modal => {
            const style = window.getComputedStyle(modal);
            return style.display !== 'none';
        });
    }

    /**
     * Navigates within a modal using arrow keys
     * @param {Element} modal - The modal element
     * @param {KeyboardEvent} event - The keyboard event
     */
    navigateInModal(modal, event) {
        const focusableElements = this.getFocusableElements(modal);
        
        if (focusableElements.length === 0) return;
        
        const currentIndex = focusableElements.indexOf(document.activeElement);
        let newIndex = currentIndex;
        
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                newIndex = (currentIndex + 1) % focusableElements.length;
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                newIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
                break;
        }
        
        if (newIndex !== currentIndex) {
            event.preventDefault();
            focusableElements[newIndex].focus();
            logger.debug(`Arrow key navigation: focused element ${newIndex}`);
        }
    }

    /**
     * Navigates in the main UI using arrow keys
     * @param {KeyboardEvent} event - The keyboard event
     */
    navigateInMainUI(event) {
        const focusableElements = this.getFocusableElements(document.body);
        
        if (focusableElements.length === 0) return;
        
        const currentIndex = focusableElements.indexOf(document.activeElement);
        let newIndex = currentIndex;
        
        switch (event.key) {
            case 'ArrowDown':
                newIndex = (currentIndex + 1) % focusableElements.length;
                break;
            case 'ArrowUp':
                newIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
                break;
        }
        
        if (newIndex !== currentIndex) {
            event.preventDefault();
            focusableElements[newIndex].focus();
        }
    }

    /**
     * Gets all focusable elements within a container
     * @param {Element} container - The container element
     * @returns {Element[]} Array of focusable elements
     */
    getFocusableElements(container) {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
            '[role="button"]:not([disabled])',
            '[role="menuitem"]:not([disabled])'
        ];
        
        const elements = container.querySelectorAll(focusableSelectors.join(', '));
        
        return Array.from(elements).filter(element => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
    }

    /**
     * Focuses the first focusable element in a container
     * @param {Element} container - The container element
     */
    focusFirst(container = document.body) {
        const focusableElements = this.getFocusableElements(container);
        
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
            logger.debug('Focused first element in container');
        }
    }

    /**
     * Creates a focus trap within a modal
     * @param {Element} modal - The modal element
     */
    createFocusTrap(modal) {
        const focusableElements = this.getFocusableElements(modal);
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const trapHandler = (event) => {
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    // Shift + Tab: move to previous element
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab: move to next element
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        modal.addEventListener('keydown', trapHandler);
        
        // Focus the first element
        firstElement.focus();
        
        // Return cleanup function
        return () => {
            modal.removeEventListener('keydown', trapHandler);
        };
    }

    /**
     * Announces text to screen readers
     * @param {string} text - Text to announce
     * @param {string} priority - Announcement priority: 'polite' or 'assertive'
     */
    announce(text, priority = 'polite') {
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.setAttribute('class', 'sr-only');
        announcer.textContent = text;
        
        document.body.appendChild(announcer);
        
        // Remove after announcement
        setTimeout(() => {
            if (announcer.parentNode) {
                announcer.parentNode.removeChild(announcer);
            }
        }, 1000);
        
        logger.debug(`Announced to screen readers: ${text}`);
    }
}

// Create global instance
export const keyboardNavigation = new KeyboardNavigation();