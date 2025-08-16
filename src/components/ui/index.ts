/**
 * UI Component System Exports
 * Complete modern UI component library for Open Runner
 */

// Base components
export { UIComponent, type UIComponentConfig, createElement, createTouchElement } from './base/UIComponent';
export { Button, type ButtonConfig } from './base/Button';
export { Modal, type ModalConfig, type ModalButton } from './base/Modal';
export { ProgressBar, type ProgressBarConfig } from './base/ProgressBar';

// Controls
export { TouchController, type TouchControllerConfig } from './controls/TouchController';

// Utility types
export interface ThemeConfig {
  mode: 'dark' | 'light' | 'auto' | 'high-contrast';
  primaryHue: number;
  customColors?: Record<string, string>;
}

export interface AccessibilityConfig {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  focusVisible: boolean;
}

export interface ResponsiveBreakpoints {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/**
 * Theme Manager
 * Manages application themes and accessibility settings
 */
export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private currentTheme: ThemeConfig;
  private accessibility: AccessibilityConfig;

  private constructor() {
    this.currentTheme = {
      mode: 'auto',
      primaryHue: 210
    };
    
    this.accessibility = {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches,
      fontSize: 'medium',
      focusVisible: true
    };

    this.initialize();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private initialize(): void {
    // Load saved theme
    const savedTheme = localStorage.getItem('open-runner-theme');
    if (savedTheme) {
      try {
        this.currentTheme = JSON.parse(savedTheme);
      } catch (error) {
        console.warn('Failed to load saved theme:', error);
      }
    }

    // Load saved accessibility settings
    const savedA11y = localStorage.getItem('open-runner-accessibility');
    if (savedA11y) {
      try {
        this.accessibility = { ...this.accessibility, ...JSON.parse(savedA11y) };
      } catch (error) {
        console.warn('Failed to load saved accessibility settings:', error);
      }
    }

    // Apply initial theme
    this.applyTheme();
    this.setupMediaQueryListeners();
  }

  private setupMediaQueryListeners(): void {
    // Watch for system theme changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => {
      if (this.currentTheme.mode === 'auto') {
        this.applyTheme();
      }
    });

    // Watch for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addEventListener('change', (e) => {
      this.accessibility.reducedMotion = e.matches;
      this.applyAccessibility();
    });

    // Watch for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    highContrastQuery.addEventListener('change', (e) => {
      this.accessibility.highContrast = e.matches;
      this.applyAccessibility();
    });
  }

  private applyTheme(): void {
    const root = document.documentElement;
    
    // Determine effective theme mode
    let effectiveMode = this.currentTheme.mode;
    if (effectiveMode === 'auto') {
      effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Set theme attribute
    root.setAttribute('data-theme', effectiveMode);

    // Set custom primary hue
    root.style.setProperty('--primary-hue', this.currentTheme.primaryHue.toString());

    // Apply custom colors
    if (this.currentTheme.customColors) {
      Object.entries(this.currentTheme.customColors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
    }

    // Save theme
    localStorage.setItem('open-runner-theme', JSON.stringify(this.currentTheme));
  }

  private applyAccessibility(): void {
    const root = document.documentElement;

    // Reduced motion
    if (this.accessibility.reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }

    // High contrast
    if (this.accessibility.highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }

    // Font size
    root.setAttribute('data-font-size', this.accessibility.fontSize);

    // Focus visible
    if (!this.accessibility.focusVisible) {
      root.setAttribute('data-no-focus-visible', 'true');
    } else {
      root.removeAttribute('data-no-focus-visible');
    }

    // Save accessibility settings
    localStorage.setItem('open-runner-accessibility', JSON.stringify(this.accessibility));
  }

  /**
   * Set theme mode
   */
  setThemeMode(mode: ThemeConfig['mode']): void {
    this.currentTheme.mode = mode;
    this.applyTheme();
  }

  /**
   * Set primary color hue
   */
  setPrimaryHue(hue: number): void {
    this.currentTheme.primaryHue = Math.max(0, Math.min(360, hue));
    this.applyTheme();
  }

  /**
   * Set custom colors
   */
  setCustomColors(colors: Record<string, string>): void {
    this.currentTheme.customColors = colors;
    this.applyTheme();
  }

  /**
   * Update accessibility settings
   */
  updateAccessibility(settings: Partial<AccessibilityConfig>): void {
    this.accessibility = { ...this.accessibility, ...settings };
    this.applyAccessibility();
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ThemeConfig {
    return { ...this.currentTheme };
  }

  /**
   * Get accessibility settings
   */
  getAccessibilitySettings(): AccessibilityConfig {
    return { ...this.accessibility };
  }

  /**
   * Reset to default theme
   */
  resetTheme(): void {
    this.currentTheme = {
      mode: 'auto',
      primaryHue: 210
    };
    this.applyTheme();
  }

  /**
   * Toggle between light and dark mode
   */
  toggleTheme(): void {
    const currentMode = this.currentTheme.mode;
    if (currentMode === 'light') {
      this.setThemeMode('dark');
    } else if (currentMode === 'dark') {
      this.setThemeMode('light');
    } else {
      // If auto, toggle to opposite of current system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setThemeMode(isDark ? 'light' : 'dark');
    }
  }
}

/**
 * Responsive Utility
 * Provides responsive design utilities
 */
export class ResponsiveUtils {
  private static breakpoints: ResponsiveBreakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px'
  };

  /**
   * Check if screen matches breakpoint
   */
  static matches(breakpoint: keyof ResponsiveBreakpoints): boolean {
    return window.matchMedia(`(min-width: ${this.breakpoints[breakpoint]})`).matches;
  }

  /**
   * Get current breakpoint
   */
  static getCurrentBreakpoint(): keyof ResponsiveBreakpoints {
    if (this.matches('xl')) return 'xl';
    if (this.matches('lg')) return 'lg';
    if (this.matches('md')) return 'md';
    if (this.matches('sm')) return 'sm';
    return 'sm'; // Default to smallest
  }

  /**
   * Watch for breakpoint changes
   */
  static watchBreakpoint(
    breakpoint: keyof ResponsiveBreakpoints,
    callback: (matches: boolean) => void
  ): () => void {
    const mediaQuery = window.matchMedia(`(min-width: ${this.breakpoints[breakpoint]})`);
    
    const handler = (e: MediaQueryListEvent) => callback(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    // Call immediately with current state
    callback(mediaQuery.matches);
    
    // Return cleanup function
    return () => mediaQuery.removeEventListener('change', handler);
  }

  /**
   * Get viewport dimensions
   */
  static getViewportDimensions(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  /**
   * Check if device is mobile
   */
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  /**
   * Check if device has touch capability
   */
  static hasTouchSupport(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get device pixel ratio
   */
  static getDevicePixelRatio(): number {
    return window.devicePixelRatio || 1;
  }

  /**
   * Check if device prefers reduced motion
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

/**
 * UI Utilities
 * Collection of utility functions for UI components
 */
export class UIUtils {
  /**
   * Generate unique ID
   */
  static generateId(prefix: string = 'ui'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debounce function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Animate element
   */
  static animate(
    element: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ): Promise<void> {
    return new Promise((resolve) => {
      const animation = element.animate(keyframes, options);
      animation.addEventListener('finish', () => resolve());
    });
  }

  /**
   * Wait for next frame
   */
  static nextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  /**
   * Check if element is in viewport
   */
  static isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }

  /**
   * Focus trap utility
   */
  static createFocusTrap(container: HTMLElement): {
    activate: () => void;
    deactivate: () => void;
  } {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];

    let isActive = false;
    let previousFocus: HTMLElement | null = null;

    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll(focusableSelectors.join(', ')));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    return {
      activate: () => {
        if (isActive) return;
        
        isActive = true;
        previousFocus = document.activeElement as HTMLElement;
        
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
        
        document.addEventListener('keydown', handleKeyDown);
      },
      
      deactivate: () => {
        if (!isActive) return;
        
        isActive = false;
        document.removeEventListener('keydown', handleKeyDown);
        
        if (previousFocus) {
          previousFocus.focus();
          previousFocus = null;
        }
      }
    };
  }
}

// Initialize theme manager
export const themeManager = ThemeManager.getInstance();