import { UIComponent, type UIComponentConfig } from './UIComponent';
import { Button } from './Button';

export interface ModalConfig extends UIComponentConfig {
  title?: string;
  content?: string | HTMLElement;
  closable?: boolean;
  modal?: boolean; // Whether to show overlay
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom';
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  onOpen?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  buttons?: ModalButton[];
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export interface ModalButton {
  text: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Modern Modal Component
 * Accessible modal with touch optimization and multiple configurations
 */
export class Modal extends UIComponent {
  private config: ModalConfig;
  private overlay: HTMLElement;
  private modalElement: HTMLElement;
  private header: HTMLElement | null = null;
  private contentElement: HTMLElement | null = null;
  private footer: HTMLElement | null = null;
  private closeButton: Button | null = null;
  private focusTrap: HTMLElement[] = [];
  private previousFocus: HTMLElement | null = null;
  private isOpen = false;

  constructor(config: ModalConfig = {}) {
    const className = [
      'modal-overlay',
      config.position ? `modal-${config.position}` : 'modal-center',
      config.className || ''
    ].filter(Boolean).join(' ');

    super('div', {
      ...config,
      className,
      styles: {
        position: 'fixed',
        inset: '0',
        zIndex: '1000',
        display: 'none',
        ...config.styles
      },
      accessibility: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-hidden': 'true',
        ...config.accessibility
      }
    });

    this.config = config;
    this.overlay = this.element;
    this.createModal();
  }

  protected setupEventListeners(): void {
    // Backdrop click
    if (this.config.closeOnBackdrop !== false) {
      this.addEventListener('click', (event: Event) => {
        if (event.target === this.overlay) {
          this.close();
        }
      });
    }

    // Escape key
    if (this.config.closeOnEscape !== false) {
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    // Focus trap
    this.addEventListener('keydown', this.handleFocusTrap.bind(this));
  }

  protected render(): void {
    // Content is rendered in createModal and update methods
  }

  private createModal(): void {
    // Create modal container
    this.modalElement = document.createElement('div');
    this.modalElement.className = `modal modal-${this.config.size || 'md'}`;
    
    // Create header if title is provided
    if (this.config.title || this.config.closable !== false) {
      this.createHeader();
    }

    // Create content area
    this.createContent();

    // Create footer if buttons are provided
    if (this.config.buttons && this.config.buttons.length > 0) {
      this.createFooter();
    }

    this.overlay.appendChild(this.modalElement);
    this.setupFocusTrap();
  }

  private createHeader(): void {
    this.header = document.createElement('div');
    this.header.className = 'modal-header';

    if (this.config.title) {
      const title = document.createElement('h2');
      title.className = 'modal-title';
      title.textContent = this.config.title;
      title.id = `modal-title-${Date.now()}`;
      this.header.appendChild(title);
      
      // Set aria-labelledby
      this.setAttribute('aria-labelledby', title.id);
    }

    if (this.config.closable !== false) {
      this.closeButton = new Button({
        className: 'modal-close',
        icon: 'close',
        size: 'icon',
        variant: 'ghost',
        onClick: () => this.close(),
        accessibility: {
          label: 'Close modal'
        }
      });
      this.header.appendChild(this.closeButton.getElement());
    }

    this.modalElement.appendChild(this.header);
  }

  private createContent(): void {
    this.contentElement = document.createElement('div');
    this.contentElement.className = 'modal-content';
    
    if (this.config.content) {
      if (typeof this.config.content === 'string') {
        this.contentElement.innerHTML = this.config.content;
      } else {
        this.contentElement.appendChild(this.config.content);
      }
    }

    this.modalElement.appendChild(this.contentElement);
  }

  private createFooter(): void {
    if (!this.config.buttons || this.config.buttons.length === 0) return;

    this.footer = document.createElement('div');
    this.footer.className = 'modal-footer';

    this.config.buttons.forEach(buttonConfig => {
      const button = new Button({
        text: buttonConfig.text,
        variant: buttonConfig.variant || 'primary',
        disabled: buttonConfig.disabled,
        loading: buttonConfig.loading,
        onClick: buttonConfig.onClick
      });
      
      this.footer!.appendChild(button.getElement());
    });

    this.modalElement.appendChild(this.footer);
  }

  private setupFocusTrap(): void {
    // Get all focusable elements within the modal
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const focusableElements = this.modalElement.querySelectorAll(
      focusableSelectors.join(', ')
    ) as NodeListOf<HTMLElement>;

    this.focusTrap = Array.from(focusableElements);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (event.key === 'Escape' && this.config.closeOnEscape !== false) {
      event.preventDefault();
      this.close();
    }
  }

  private handleFocusTrap(event: KeyboardEvent): void {
    if (!this.isOpen || event.key !== 'Tab') return;

    if (this.focusTrap.length === 0) return;

    const firstFocusable = this.focusTrap[0];
    const lastFocusable = this.focusTrap[this.focusTrap.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  /**
   * Open the modal
   */
  public open(): void {
    if (this.isOpen) return;

    // Store previous focus
    this.previousFocus = document.activeElement as HTMLElement;

    // Show modal
    this.show();
    this.setAttribute('aria-hidden', 'false');
    this.isOpen = true;

    // Add animation class
    requestAnimationFrame(() => {
      this.addClass('active');
      
      // Focus first focusable element
      if (this.focusTrap.length > 0) {
        this.focusTrap[0].focus();
      }
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Call onOpen callback
    if (this.config.onOpen) {
      this.config.onOpen();
    }
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (!this.isOpen) return;

    this.removeClass('active');
    this.setAttribute('aria-hidden', 'true');
    this.isOpen = false;

    // Restore body scroll
    document.body.style.overflow = '';

    // Restore previous focus
    if (this.previousFocus) {
      this.previousFocus.focus();
      this.previousFocus = null;
    }

    // Hide modal after animation
    setTimeout(() => {
      if (!this.isOpen) {
        this.hide();
      }
    }, 300);

    // Call onClose callback
    if (this.config.onClose) {
      this.config.onClose();
    }
  }

  /**
   * Toggle modal visibility
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Update modal content
   */
  public setContent(content: string | HTMLElement): void {
    if (!this.contentElement) return;

    if (typeof content === 'string') {
      this.contentElement.innerHTML = content;
    } else {
      this.contentElement.innerHTML = '';
      this.contentElement.appendChild(content);
    }

    // Update focus trap
    this.setupFocusTrap();
  }

  /**
   * Update modal title
   */
  public setTitle(title: string): void {
    this.config.title = title;
    
    if (this.header) {
      const titleElement = this.header.querySelector('.modal-title');
      if (titleElement) {
        titleElement.textContent = title;
      }
    }
  }

  /**
   * Check if modal is open
   */
  public isModalOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Destroy modal and cleanup
   */
  public destroy(): void {
    if (this.isOpen) {
      this.close();
    }

    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);

    // Destroy buttons
    if (this.closeButton) {
      this.closeButton.destroy();
    }

    super.destroy();
  }

  /**
   * Static method to create a simple alert modal
   */
  static alert(title: string, message: string, onClose?: () => void): Modal {
    return new Modal({
      title,
      content: `<p>${message}</p>`,
      buttons: [
        {
          text: 'OK',
          variant: 'primary',
          onClick: () => {
            modal.close();
            if (onClose) onClose();
          }
        }
      ],
      closeOnBackdrop: false,
      closeOnEscape: true
    });
  }

  /**
   * Static method to create a confirmation modal
   */
  static confirm(title: string, message: string, onConfirm: () => void, onCancel?: () => void): Modal {
    const modal = new Modal({
      title,
      content: `<p>${message}</p>`,
      buttons: [
        {
          text: 'Cancel',
          variant: 'secondary',
          onClick: () => {
            modal.close();
            if (onCancel) onCancel();
          }
        },
        {
          text: 'Confirm',
          variant: 'primary',
          onClick: () => {
            modal.close();
            onConfirm();
          }
        }
      ],
      closeOnBackdrop: false,
      closeOnEscape: true
    });

    return modal;
  }

  /**
   * Static method to create a loading modal
   */
  static loading(title: string = 'Loading...', message?: string): Modal {
    const content = `
      <div style="text-align: center; padding: 2rem;">
        <div class="spinner spinner-lg" style="margin-bottom: 1rem;"></div>
        ${message ? `<p>${message}</p>` : ''}
      </div>
    `;

    return new Modal({
      title,
      content,
      closable: false,
      closeOnBackdrop: false,
      closeOnEscape: false,
      size: 'sm'
    });
  }
}