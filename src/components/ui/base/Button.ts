import { UIComponent, type UIComponentConfig } from './UIComponent';

export interface ButtonConfig extends UIComponentConfig {
  text?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: (event: MouseEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
}

/**
 * Modern Button Component
 * Touch-optimized with accessibility features and multiple variants
 */
export class Button extends UIComponent {
  private config: ButtonConfig;
  private loadingSpinner: HTMLElement | null = null;
  private originalText: string = '';

  constructor(config: ButtonConfig = {}) {
    // Set default className with variants
    const className = [
      'btn',
      config.variant ? `btn-${config.variant}` : 'btn-primary',
      config.size ? `btn-${config.size}` : '',
      config.fullWidth ? 'btn-full' : '',
      config.className || ''
    ].filter(Boolean).join(' ');

    super('button', {
      ...config,
      className,
      accessibility: {
        role: 'button',
        tabIndex: config.disabled ? -1 : 0,
        ...config.accessibility
      },
      responsive: {
        touchOptimized: true,
        ...config.responsive
      }
    });

    this.config = config;
    this.originalText = config.text || '';
    
    // Set initial disabled state
    if (config.disabled) {
      this.setDisabled(true);
    }
    
    // Set initial loading state
    if (config.loading) {
      this.setLoading(true);
    }
  }

  protected setupEventListeners(): void {
    // Click handler
    if (this.config.onClick) {
      this.addEventListener('click', (event: Event) => {
        if (!this.config.disabled && !this.config.loading) {
          this.config.onClick!(event as MouseEvent);
        }
      });
    }

    // Focus handlers
    if (this.config.onFocus) {
      this.addEventListener('focus', this.config.onFocus);
    }

    if (this.config.onBlur) {
      this.addEventListener('blur', this.config.onBlur);
    }

    // Keyboard accessibility
    this.addEventListener('keydown', (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        keyEvent.preventDefault();
        if (!this.config.disabled && !this.config.loading && this.config.onClick) {
          this.config.onClick(new MouseEvent('click'));
        }
      }
    });

    // Touch feedback
    this.addEventListener('touchstart', () => {
      if (!this.config.disabled && !this.config.loading) {
        this.addClass('btn-active');
      }
    });

    this.addEventListener('touchend', () => {
      this.removeClass('btn-active');
    });

    this.addEventListener('touchcancel', () => {
      this.removeClass('btn-active');
    });

    // Mouse feedback
    this.addEventListener('mousedown', () => {
      if (!this.config.disabled && !this.config.loading) {
        this.addClass('btn-active');
      }
    });

    this.addEventListener('mouseup', () => {
      this.removeClass('btn-active');
    });

    this.addEventListener('mouseleave', () => {
      this.removeClass('btn-active');
    });
  }

  protected render(): void {
    let content = '';

    // Add icon if specified
    if (this.config.icon && !this.config.loading) {
      content += `<i class="icon ${this.config.icon}" aria-hidden="true"></i>`;
    }

    // Add loading spinner if loading
    if (this.config.loading) {
      content += '<div class="spinner spinner-sm" aria-hidden="true"></div>';
    }

    // Add text if specified and not in icon-only mode
    if (this.config.text && this.config.size !== 'icon') {
      content += `<span class="btn-text">${this.config.text}</span>`;
    }

    this.setContent(content);

    // Update ARIA label for accessibility
    if (this.config.loading) {
      this.setAttribute('aria-label', `${this.originalText} (Loading)`);
    } else {
      this.setAttribute('aria-label', this.config.text || this.originalText);
    }
  }

  /**
   * Set button text
   */
  public setText(text: string): void {
    this.config.text = text;
    if (!this.originalText) {
      this.originalText = text;
    }
    this.render();
  }

  /**
   * Set button icon
   */
  public setIcon(icon: string): void {
    this.config.icon = icon;
    this.render();
  }

  /**
   * Set button variant
   */
  public setVariant(variant: ButtonConfig['variant']): void {
    // Remove old variant class
    if (this.config.variant) {
      this.removeClass(`btn-${this.config.variant}`);
    }
    
    // Add new variant class
    this.config.variant = variant;
    if (variant) {
      this.addClass(`btn-${variant}`);
    }
  }

  /**
   * Set button size
   */
  public setSize(size: ButtonConfig['size']): void {
    // Remove old size class
    if (this.config.size) {
      this.removeClass(`btn-${this.config.size}`);
    }
    
    // Add new size class
    this.config.size = size;
    if (size) {
      this.addClass(`btn-${size}`);
    }
  }

  /**
   * Set disabled state
   */
  public setDisabled(disabled: boolean): void {
    this.config.disabled = disabled;
    
    if (disabled) {
      this.setAttribute('disabled', 'true');
      this.setAttribute('aria-disabled', 'true');
      this.setAttribute('tabindex', '-1');
    } else {
      this.removeAttribute('disabled');
      this.removeAttribute('aria-disabled');
      this.setAttribute('tabindex', '0');
    }
  }

  /**
   * Set loading state
   */
  public setLoading(loading: boolean): void {
    this.config.loading = loading;
    
    if (loading) {
      this.addClass('btn-loading');
      this.setAttribute('aria-busy', 'true');
    } else {
      this.removeClass('btn-loading');
      this.removeAttribute('aria-busy');
    }
    
    this.render();
  }

  /**
   * Set full width
   */
  public setFullWidth(fullWidth: boolean): void {
    this.config.fullWidth = fullWidth;
    
    if (fullWidth) {
      this.addClass('btn-full');
    } else {
      this.removeClass('btn-full');
    }
  }

  /**
   * Simulate button click
   */
  public click(): void {
    if (!this.config.disabled && !this.config.loading && this.config.onClick) {
      this.config.onClick(new MouseEvent('click'));
    }
  }

  /**
   * Get button state
   */
  public getState(): {
    disabled: boolean;
    loading: boolean;
    text: string;
    variant: string;
    size: string;
  } {
    return {
      disabled: this.config.disabled || false,
      loading: this.config.loading || false,
      text: this.config.text || '',
      variant: this.config.variant || 'primary',
      size: this.config.size || 'md'
    };
  }

  /**
   * Create a primary button
   */
  static primary(text: string, onClick: (event: MouseEvent) => void, config: Partial<ButtonConfig> = {}): Button {
    return new Button({
      text,
      onClick,
      variant: 'primary',
      ...config
    });
  }

  /**
   * Create a secondary button
   */
  static secondary(text: string, onClick: (event: MouseEvent) => void, config: Partial<ButtonConfig> = {}): Button {
    return new Button({
      text,
      onClick,
      variant: 'secondary',
      ...config
    });
  }

  /**
   * Create an outline button
   */
  static outline(text: string, onClick: (event: MouseEvent) => void, config: Partial<ButtonConfig> = {}): Button {
    return new Button({
      text,
      onClick,
      variant: 'outline',
      ...config
    });
  }

  /**
   * Create an icon button
   */
  static icon(icon: string, onClick: (event: MouseEvent) => void, config: Partial<ButtonConfig> = {}): Button {
    return new Button({
      icon,
      onClick,
      size: 'icon',
      ...config
    });
  }

  /**
   * Create a danger button
   */
  static danger(text: string, onClick: (event: MouseEvent) => void, config: Partial<ButtonConfig> = {}): Button {
    return new Button({
      text,
      onClick,
      variant: 'danger',
      ...config
    });
  }

  /**
   * Create a success button
   */
  static success(text: string, onClick: (event: MouseEvent) => void, config: Partial<ButtonConfig> = {}): Button {
    return new Button({
      text,
      onClick,
      variant: 'success',
      ...config
    });
  }
}