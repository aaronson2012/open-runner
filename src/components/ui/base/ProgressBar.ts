import { UIComponent, type UIComponentConfig } from './UIComponent';

export interface ProgressBarConfig extends UIComponentConfig {
  value?: number; // 0-100
  max?: number;
  min?: number;
  label?: string;
  showValue?: boolean;
  showPercentage?: boolean;
  animated?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  striped?: boolean;
  indeterminate?: boolean;
  onComplete?: () => void;
  onUpdate?: (value: number) => void;
}

/**
 * Modern Progress Bar Component
 * Accessible progress indicator with multiple variants and animations
 */
export class ProgressBar extends UIComponent {
  private config: ProgressBarConfig;
  private labelElement: HTMLElement | null = null;
  private progressElement: HTMLElement;
  private barElement: HTMLElement;
  private valueElement: HTMLElement | null = null;
  private currentValue: number = 0;
  private animationFrame: number | null = null;

  constructor(config: ProgressBarConfig = {}) {
    const className = [
      'progress-container',
      config.size ? `progress-${config.size}` : 'progress-md',
      config.variant ? `progress-${config.variant}` : 'progress-default',
      config.striped ? 'progress-striped' : '',
      config.animated ? 'progress-animated' : '',
      config.indeterminate ? 'progress-indeterminate' : '',
      config.className || ''
    ].filter(Boolean).join(' ');

    super('div', {
      ...config,
      className,
      accessibility: {
        role: 'progressbar',
        'aria-valuemin': config.min?.toString() || '0',
        'aria-valuemax': config.max?.toString() || '100',
        'aria-valuenow': config.value?.toString() || '0',
        ...config.accessibility
      }
    });

    this.config = config;
    this.currentValue = config.value || 0;
    this.createProgressBar();
  }

  protected setupEventListeners(): void {
    // No specific event listeners needed for progress bar
  }

  protected render(): void {
    this.updateProgress();
  }

  private createProgressBar(): void {
    // Create label if provided
    if (this.config.label || this.config.showValue || this.config.showPercentage) {
      this.createLabel();
    }

    // Create progress container
    this.progressElement = document.createElement('div');
    this.progressElement.className = 'progress';
    
    // Create progress bar
    this.barElement = document.createElement('div');
    this.barElement.className = [
      'progress-bar',
      this.config.variant ? `progress-bar-${this.config.variant}` : '',
      this.config.striped ? 'progress-bar-striped' : '',
      this.config.animated ? 'progress-bar-animated' : ''
    ].filter(Boolean).join(' ');

    this.progressElement.appendChild(this.barElement);
    this.element.appendChild(this.progressElement);

    // Initial update
    this.updateProgress();
  }

  private createLabel(): void {
    this.labelElement = document.createElement('div');
    this.labelElement.className = 'progress-text';

    const labelText = document.createElement('span');
    labelText.className = 'progress-label';
    labelText.textContent = this.config.label || '';

    this.labelElement.appendChild(labelText);

    if (this.config.showValue || this.config.showPercentage) {
      this.valueElement = document.createElement('span');
      this.valueElement.className = 'progress-value';
      this.labelElement.appendChild(this.valueElement);
    }

    this.element.appendChild(this.labelElement);
  }

  private updateProgress(): void {
    const min = this.config.min || 0;
    const max = this.config.max || 100;
    const value = Math.max(min, Math.min(max, this.currentValue));
    const percentage = ((value - min) / (max - min)) * 100;

    // Update bar width
    if (!this.config.indeterminate) {
      this.barElement.style.width = `${percentage}%`;
    }

    // Update ARIA attributes
    this.setAttribute('aria-valuenow', value.toString());
    this.setAttribute('aria-valuetext', `${Math.round(percentage)}%`);

    // Update value display
    if (this.valueElement) {
      let displayValue = '';
      
      if (this.config.showValue && this.config.showPercentage) {
        displayValue = `${value} (${Math.round(percentage)}%)`;
      } else if (this.config.showValue) {
        displayValue = value.toString();
      } else if (this.config.showPercentage) {
        displayValue = `${Math.round(percentage)}%`;
      }
      
      this.valueElement.textContent = displayValue;
    }

    // Check for completion
    if (value >= max && this.config.onComplete) {
      this.config.onComplete();
    }

    // Call update callback
    if (this.config.onUpdate) {
      this.config.onUpdate(value);
    }
  }

  /**
   * Set progress value
   */
  public setValue(value: number, animated: boolean = true): void {
    const min = this.config.min || 0;
    const max = this.config.max || 100;
    const targetValue = Math.max(min, Math.min(max, value));

    if (animated && !this.config.indeterminate) {
      this.animateToValue(targetValue);
    } else {
      this.currentValue = targetValue;
      this.updateProgress();
    }
  }

  /**
   * Animate to target value
   */
  private animateToValue(targetValue: number): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const startValue = this.currentValue;
    const difference = targetValue - startValue;
    const duration = 300; // Animation duration in milliseconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      this.currentValue = startValue + (difference * easeOut);
      this.updateProgress();

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.animationFrame = null;
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Get current value
   */
  public getValue(): number {
    return this.currentValue;
  }

  /**
   * Get progress percentage
   */
  public getPercentage(): number {
    const min = this.config.min || 0;
    const max = this.config.max || 100;
    return ((this.currentValue - min) / (max - min)) * 100;
  }

  /**
   * Set progress label
   */
  public setLabel(label: string): void {
    this.config.label = label;
    
    if (this.labelElement) {
      const labelSpan = this.labelElement.querySelector('.progress-label');
      if (labelSpan) {
        labelSpan.textContent = label;
      }
    }
  }

  /**
   * Set variant
   */
  public setVariant(variant: ProgressBarConfig['variant']): void {
    // Remove old variant classes
    if (this.config.variant) {
      this.removeClass(`progress-${this.config.variant}`);
      this.barElement.classList.remove(`progress-bar-${this.config.variant}`);
    }

    // Add new variant classes
    this.config.variant = variant;
    if (variant) {
      this.addClass(`progress-${variant}`);
      this.barElement.classList.add(`progress-bar-${variant}`);
    }
  }

  /**
   * Set indeterminate state
   */
  public setIndeterminate(indeterminate: boolean): void {
    this.config.indeterminate = indeterminate;
    
    if (indeterminate) {
      this.addClass('progress-indeterminate');
      this.barElement.style.width = '';
      this.removeAttribute('aria-valuenow');
      this.setAttribute('aria-valuetext', 'Loading...');
    } else {
      this.removeClass('progress-indeterminate');
      this.updateProgress();
    }
  }

  /**
   * Set striped appearance
   */
  public setStriped(striped: boolean): void {
    this.config.striped = striped;
    
    if (striped) {
      this.addClass('progress-striped');
      this.barElement.classList.add('progress-bar-striped');
    } else {
      this.removeClass('progress-striped');
      this.barElement.classList.remove('progress-bar-striped');
    }
  }

  /**
   * Set animated appearance
   */
  public setAnimated(animated: boolean): void {
    this.config.animated = animated;
    
    if (animated) {
      this.addClass('progress-animated');
      this.barElement.classList.add('progress-bar-animated');
    } else {
      this.removeClass('progress-animated');
      this.barElement.classList.remove('progress-bar-animated');
    }
  }

  /**
   * Reset progress to minimum value
   */
  public reset(): void {
    this.setValue(this.config.min || 0, false);
  }

  /**
   * Complete progress (set to maximum value)
   */
  public complete(): void {
    this.setValue(this.config.max || 100);
  }

  /**
   * Increment progress by specified amount
   */
  public increment(amount: number = 1): void {
    this.setValue(this.currentValue + amount);
  }

  /**
   * Decrement progress by specified amount
   */
  public decrement(amount: number = 1): void {
    this.setValue(this.currentValue - amount);
  }

  /**
   * Destroy component and cleanup animations
   */
  public destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    super.destroy();
  }

  /**
   * Static method to create a loading progress bar
   */
  static loading(label: string = 'Loading...'): ProgressBar {
    return new ProgressBar({
      label,
      indeterminate: true,
      animated: true,
      striped: true
    });
  }

  /**
   * Static method to create a file upload progress bar
   */
  static upload(onComplete?: () => void): ProgressBar {
    return new ProgressBar({
      label: 'Uploading...',
      showPercentage: true,
      variant: 'info',
      animated: true,
      onComplete
    });
  }

  /**
   * Static method to create a download progress bar
   */
  static download(onComplete?: () => void): ProgressBar {
    return new ProgressBar({
      label: 'Downloading...',
      showPercentage: true,
      variant: 'success',
      animated: true,
      onComplete
    });
  }
}