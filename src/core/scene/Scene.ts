import type { SceneManager } from './SceneManager';

/**
 * Base Scene Interface
 * All game scenes implement this interface
 */
export interface Scene {
  readonly name: string;
  readonly isActive: boolean;
  
  // Lifecycle methods
  enter(): Promise<void>;
  exit(): Promise<void>;
  update(deltaTime: number): void;
  render(): void;
  
  // Setup methods
  setManager(manager: SceneManager): void;
  setCanvas(canvas: HTMLCanvasElement): void;
  setUIContainer(container: HTMLElement): void;
  
  // Event handling
  handleResize(width: number, height: number): void;
  handleInput(input: any): void;
  
  // UI access
  getUIElement(): HTMLElement | null;
  
  // Cleanup
  destroy(): void;
}

/**
 * Abstract Base Scene Implementation
 * Provides common functionality for all scenes
 */
export abstract class BaseScene implements Scene {
  public readonly name: string;
  protected manager: SceneManager | null = null;
  protected canvas: HTMLCanvasElement | null = null;
  protected uiContainer: HTMLElement | null = null;
  protected uiElement: HTMLElement | null = null;
  protected _isActive = false;
  protected resizeObserver: ResizeObserver | null = null;

  constructor(name: string) {
    this.name = name;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // Setup methods
  setManager(manager: SceneManager): void {
    this.manager = manager;
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  setUIContainer(container: HTMLElement): void {
    this.uiContainer = container;
  }

  getUIElement(): HTMLElement | null {
    return this.uiElement;
  }

  // Lifecycle methods (to be implemented by subclasses)
  async enter(): Promise<void> {
    this._isActive = true;
    await this.createUI();
    this.setupEventListeners();
  }

  async exit(): Promise<void> {
    this._isActive = false;
    this.removeEventListeners();
    await this.destroyUI();
  }

  abstract update(deltaTime: number): void;
  abstract render(): void;

  // UI methods (to be implemented by subclasses)
  protected abstract createUI(): Promise<void>;
  protected abstract destroyUI(): Promise<void>;

  // Event handling
  handleResize(width: number, height: number): void {
    // Override in subclasses if needed
  }

  handleInput(input: any): void {
    // Override in subclasses if needed
  }

  // Event listener management
  protected setupEventListeners(): void {
    if (this.canvas) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          this.handleResize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      
      if (this.canvas.parentElement) {
        this.resizeObserver.observe(this.canvas.parentElement);
      }
    }
  }

  protected removeEventListeners(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  // Cleanup
  destroy(): void {
    this.removeEventListeners();
    if (this.uiElement && this.uiElement.parentElement) {
      this.uiElement.parentElement.removeChild(this.uiElement);
    }
    this.uiElement = null;
  }

  // Utility methods
  protected createElement(tag: string, className?: string, parent?: HTMLElement): HTMLElement {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (parent) {
      parent.appendChild(element);
    }
    return element;
  }

  protected createButton(text: string, onClick: () => void, className = 'game-button'): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = className;
    button.addEventListener('click', onClick);
    return button;
  }

  protected async loadTemplate(templatePath: string): Promise<string> {
    try {
      const response = await fetch(templatePath);
      return await response.text();
    } catch (error) {
      console.error(`Failed to load template: ${templatePath}`, error);
      return '';
    }
  }

  protected addEventListeners(element: HTMLElement, events: Record<string, EventListener>): void {
    Object.entries(events).forEach(([event, listener]) => {
      element.addEventListener(event, listener);
    });
  }

  protected removeEventListeners(element: HTMLElement, events: Record<string, EventListener>): void {
    Object.entries(events).forEach(([event, listener]) => {
      element.removeEventListener(event, listener);
    });
  }
}

/**
 * Scene State Interface
 * For managing scene-specific state
 */
export interface SceneState {
  isLoading: boolean;
  error: string | null;
  data: Record<string, any>;
}

/**
 * Scene Configuration Interface
 */
export interface SceneConfig {
  name: string;
  preloadAssets?: string[];
  persistState?: boolean;
  transitionType?: 'instant' | 'fade' | 'slide';
  transitionDuration?: number;
}