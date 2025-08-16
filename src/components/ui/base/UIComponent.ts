/**
 * Base UI Component System
 * Provides foundation for all UI components with accessibility and touch optimization
 */

export interface UIComponentConfig {
  id?: string;
  className?: string;
  parent?: HTMLElement;
  attributes?: Record<string, string>;
  styles?: Record<string, string>;
  accessibility?: AccessibilityConfig;
  responsive?: ResponsiveConfig;
}

export interface AccessibilityConfig {
  role?: string;
  label?: string;
  description?: string;
  tabIndex?: number;
  ariaAttributes?: Record<string, string>;
}

export interface ResponsiveConfig {
  breakpoints?: Record<string, any>;
  adaptiveLayout?: boolean;
  touchOptimized?: boolean;
}

export interface UIComponentEvents {
  [key: string]: (event: Event) => void;
}

/**
 * Abstract base class for all UI components
 */
export abstract class UIComponent {
  protected element: HTMLElement;
  protected config: UIComponentConfig;
  protected eventListeners: Map<string, EventListener> = new Map();
  protected children: UIComponent[] = [];
  protected isDestroyed = false;

  constructor(tagName: string, config: UIComponentConfig = {}) {
    this.config = config;
    this.element = this.createElement(tagName);
    this.initialize();
  }

  /**
   * Create the DOM element with configuration
   */
  private createElement(tagName: string): HTMLElement {
    const element = document.createElement(tagName);
    
    // Apply basic configuration
    if (this.config.id) {
      element.id = this.config.id;
    }
    
    if (this.config.className) {
      element.className = this.config.className;
    }
    
    // Apply custom attributes
    if (this.config.attributes) {
      Object.entries(this.config.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    
    // Apply custom styles
    if (this.config.styles) {
      Object.entries(this.config.styles).forEach(([property, value]) => {
        (element.style as any)[property] = value;
      });
    }
    
    // Apply accessibility configuration
    this.applyAccessibility(element);
    
    // Apply responsive configuration
    this.applyResponsive(element);
    
    return element;
  }

  /**
   * Initialize component after element creation
   */
  protected initialize(): void {
    this.setupEventListeners();
    this.render();
    
    // Append to parent if specified
    if (this.config.parent) {
      this.config.parent.appendChild(this.element);
    }
  }

  /**
   * Apply accessibility features
   */
  private applyAccessibility(element: HTMLElement): void {
    const accessibility = this.config.accessibility;
    if (!accessibility) return;
    
    if (accessibility.role) {
      element.setAttribute('role', accessibility.role);
    }
    
    if (accessibility.label) {
      element.setAttribute('aria-label', accessibility.label);
    }
    
    if (accessibility.description) {
      element.setAttribute('aria-describedby', accessibility.description);
    }
    
    if (accessibility.tabIndex !== undefined) {
      element.tabIndex = accessibility.tabIndex;
    }
    
    if (accessibility.ariaAttributes) {
      Object.entries(accessibility.ariaAttributes).forEach(([key, value]) => {
        element.setAttribute(`aria-${key}`, value);
      });
    }
  }

  /**
   * Apply responsive configuration
   */
  private applyResponsive(element: HTMLElement): void {
    const responsive = this.config.responsive;
    if (!responsive) return;
    
    if (responsive.touchOptimized) {
      element.style.touchAction = 'manipulation';
      element.style.webkitTapHighlightColor = 'transparent';
      
      // Ensure minimum touch target size
      const minSize = '44px';
      if (!element.style.minHeight) element.style.minHeight = minSize;
      if (!element.style.minWidth) element.style.minWidth = minSize;
    }
    
    if (responsive.breakpoints) {
      this.setupResponsiveBreakpoints(responsive.breakpoints);
    }
  }

  /**
   * Setup responsive breakpoint handling
   */
  private setupResponsiveBreakpoints(breakpoints: Record<string, any>): void {
    const mediaQueries: MediaQueryList[] = [];
    
    Object.entries(breakpoints).forEach(([breakpoint, config]) => {
      const mediaQuery = window.matchMedia(`(min-width: ${breakpoint})`);
      mediaQuery.addEventListener('change', (e) => {
        if (e.matches) {
          this.applyBreakpointConfig(config);
        }
      });
      mediaQueries.push(mediaQuery);
      
      // Apply initial state
      if (mediaQuery.matches) {
        this.applyBreakpointConfig(config);
      }
    });
  }

  /**
   * Apply configuration for a specific breakpoint
   */
  private applyBreakpointConfig(config: any): void {
    if (config.className) {
      this.element.className = config.className;
    }
    
    if (config.styles) {
      Object.entries(config.styles).forEach(([property, value]) => {
        (this.element.style as any)[property] = value;
      });
    }
  }

  /**
   * Setup event listeners (to be implemented by subclasses)
   */
  protected abstract setupEventListeners(): void;

  /**
   * Render component content (to be implemented by subclasses)
   */
  protected abstract render(): void;

  /**
   * Add event listener with automatic cleanup tracking
   */
  protected addEventListener(event: string, listener: EventListener): void {
    this.element.addEventListener(event, listener);
    this.eventListeners.set(event, listener);
  }

  /**
   * Remove event listener
   */
  protected removeEventListener(event: string): void {
    const listener = this.eventListeners.get(event);
    if (listener) {
      this.element.removeEventListener(event, listener);
      this.eventListeners.delete(event);
    }
  }

  /**
   * Add child component
   */
  protected addChild(child: UIComponent): void {
    this.children.push(child);
    this.element.appendChild(child.getElement());
  }

  /**
   * Remove child component
   */
  protected removeChild(child: UIComponent): void {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      if (child.getElement().parentElement === this.element) {
        this.element.removeChild(child.getElement());
      }
    }
  }

  /**
   * Update component content
   */
  public update(data?: any): void {
    if (this.isDestroyed) return;
    this.render();
  }

  /**
   * Show component
   */
  public show(): void {
    this.element.style.display = '';
    this.element.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide component
   */
  public hide(): void {
    this.element.style.display = 'none';
    this.element.setAttribute('aria-hidden', 'true');
  }

  /**
   * Toggle component visibility
   */
  public toggle(): void {
    if (this.element.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Set component content
   */
  public setContent(content: string | HTMLElement): void {
    if (typeof content === 'string') {
      this.element.innerHTML = content;
    } else {
      this.element.innerHTML = '';
      this.element.appendChild(content);
    }
  }

  /**
   * Get DOM element
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Get component configuration
   */
  public getConfig(): UIComponentConfig {
    return this.config;
  }

  /**
   * Check if component is destroyed
   */
  public isComponentDestroyed(): boolean {
    return this.isDestroyed;
  }

  /**
   * Focus the component
   */
  public focus(): void {
    if (this.element.tabIndex >= 0) {
      this.element.focus();
    }
  }

  /**
   * Blur the component
   */
  public blur(): void {
    this.element.blur();
  }

  /**
   * Add CSS class
   */
  public addClass(className: string): void {
    this.element.classList.add(className);
  }

  /**
   * Remove CSS class
   */
  public removeClass(className: string): void {
    this.element.classList.remove(className);
  }

  /**
   * Toggle CSS class
   */
  public toggleClass(className: string): void {
    this.element.classList.toggle(className);
  }

  /**
   * Check if has CSS class
   */
  public hasClass(className: string): boolean {
    return this.element.classList.contains(className);
  }

  /**
   * Set attribute
   */
  public setAttribute(name: string, value: string): void {
    this.element.setAttribute(name, value);
  }

  /**
   * Get attribute
   */
  public getAttribute(name: string): string | null {
    return this.element.getAttribute(name);
  }

  /**
   * Remove attribute
   */
  public removeAttribute(name: string): void {
    this.element.removeAttribute(name);
  }

  /**
   * Set style property
   */
  public setStyle(property: string, value: string): void {
    (this.element.style as any)[property] = value;
  }

  /**
   * Get computed style
   */
  public getComputedStyle(): CSSStyleDeclaration {
    return window.getComputedStyle(this.element);
  }

  /**
   * Animate component using Web Animations API
   */
  public animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation {
    return this.element.animate(keyframes, options);
  }

  /**
   * Destroy component and cleanup
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    
    // Destroy all children first
    this.children.forEach(child => child.destroy());
    this.children = [];
    
    // Remove all event listeners
    this.eventListeners.forEach((listener, event) => {
      this.element.removeEventListener(event, listener);
    });
    this.eventListeners.clear();
    
    // Remove from parent
    if (this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    
    this.isDestroyed = true;
  }
}

/**
 * Utility function to create UI components
 */
export function createElement(
  tagName: string, 
  config: UIComponentConfig = {}
): HTMLElement {
  const element = document.createElement(tagName);
  
  if (config.id) element.id = config.id;
  if (config.className) element.className = config.className;
  
  if (config.attributes) {
    Object.entries(config.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  if (config.styles) {
    Object.entries(config.styles).forEach(([property, value]) => {
      (element.style as any)[property] = value;
    });
  }
  
  return element;
}

/**
 * Utility function for touch-optimized elements
 */
export function createTouchElement(
  tagName: string,
  config: UIComponentConfig = {}
): HTMLElement {
  const touchConfig: UIComponentConfig = {
    ...config,
    responsive: {
      ...config.responsive,
      touchOptimized: true
    }
  };
  
  return createElement(tagName, touchConfig);
}