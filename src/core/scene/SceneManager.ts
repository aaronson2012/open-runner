import { EventTarget } from 'events';
import type { Scene } from './Scene';
import type { GameState } from '@/types';

/**
 * Modern Scene Management System
 * Handles scene transitions, state management, and lifecycle
 */
export class SceneManager extends EventTarget {
  private scenes: Map<string, Scene> = new Map();
  private currentScene: Scene | null = null;
  private previousScene: Scene | null = null;
  private isTransitioning = false;
  private canvas: HTMLCanvasElement;
  private uiContainer: HTMLElement;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    super();
    this.canvas = canvas;
    this.uiContainer = uiContainer;
  }

  /**
   * Register a scene with the manager
   */
  registerScene(name: string, scene: Scene): void {
    scene.setManager(this);
    scene.setCanvas(this.canvas);
    scene.setUIContainer(this.uiContainer);
    this.scenes.set(name, scene);
  }

  /**
   * Transition to a new scene
   */
  async transitionTo(sceneName: string, options: TransitionOptions = {}): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Scene transition already in progress');
      return;
    }

    const newScene = this.scenes.get(sceneName);
    if (!newScene) {
      throw new Error(`Scene "${sceneName}" not found`);
    }

    this.isTransitioning = true;
    this.previousScene = this.currentScene;

    try {
      // Emit transition start event
      this.dispatchEvent(new CustomEvent('transition-start', {
        detail: { from: this.currentScene?.name, to: sceneName, options }
      }));

      // Handle transition based on type
      switch (options.type || 'instant') {
        case 'fade':
          await this.fadeTransition(newScene, options);
          break;
        case 'slide':
          await this.slideTransition(newScene, options);
          break;
        case 'instant':
        default:
          await this.instantTransition(newScene);
          break;
      }

      this.currentScene = newScene;

      // Emit transition complete event
      this.dispatchEvent(new CustomEvent('transition-complete', {
        detail: { from: this.previousScene?.name, to: sceneName }
      }));

    } catch (error) {
      console.error('Scene transition failed:', error);
      this.dispatchEvent(new CustomEvent('transition-error', {
        detail: { error, sceneName }
      }));
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Get current active scene
   */
  getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  /**
   * Get scene by name
   */
  getScene(name: string): Scene | null {
    return this.scenes.get(name) || null;
  }

  /**
   * Update current scene
   */
  update(deltaTime: number): void {
    if (this.currentScene && !this.isTransitioning) {
      this.currentScene.update(deltaTime);
    }
  }

  /**
   * Render current scene
   */
  render(): void {
    if (this.currentScene && !this.isTransitioning) {
      this.currentScene.render();
    }
  }

  /**
   * Handle window resize
   */
  handleResize(width: number, height: number): void {
    this.scenes.forEach(scene => {
      scene.handleResize(width, height);
    });
  }

  /**
   * Cleanup all scenes
   */
  destroy(): void {
    this.scenes.forEach(scene => {
      scene.destroy();
    });
    this.scenes.clear();
    this.currentScene = null;
    this.previousScene = null;
  }

  // Private transition methods

  private async instantTransition(newScene: Scene): Promise<void> {
    if (this.currentScene) {
      await this.currentScene.exit();
    }
    await newScene.enter();
  }

  private async fadeTransition(newScene: Scene, options: TransitionOptions): Promise<void> {
    const duration = options.duration || 300;
    
    // Create overlay for fade effect
    const overlay = this.createOverlay();
    overlay.style.background = options.color || '#000';
    overlay.style.opacity = '0';
    overlay.style.transition = `opacity ${duration}ms ease-out`;

    this.uiContainer.appendChild(overlay);

    // Fade out current scene
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });

    // Switch scenes
    if (this.currentScene) {
      await this.currentScene.exit();
    }
    await newScene.enter();

    // Fade in new scene
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          this.uiContainer.removeChild(overlay);
          resolve(undefined);
        }, duration);
      });
    });
  }

  private async slideTransition(newScene: Scene, options: TransitionOptions): Promise<void> {
    const duration = options.duration || 400;
    const direction = options.direction || 'left';
    
    // Prepare new scene off-screen
    await newScene.enter();
    const newSceneElement = newScene.getUIElement();
    if (newSceneElement) {
      newSceneElement.style.transform = this.getSlideTransform(direction, true);
      newSceneElement.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
    }

    // Get current scene element
    const currentSceneElement = this.currentScene?.getUIElement();
    if (currentSceneElement) {
      currentSceneElement.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
    }

    // Animate both scenes
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        if (currentSceneElement) {
          currentSceneElement.style.transform = this.getSlideTransform(direction, false);
        }
        if (newSceneElement) {
          newSceneElement.style.transform = 'translateX(0)';
        }
        setTimeout(resolve, duration);
      });
    });

    // Clean up
    if (this.currentScene) {
      await this.currentScene.exit();
    }
    if (currentSceneElement) {
      currentSceneElement.style.transition = '';
      currentSceneElement.style.transform = '';
    }
    if (newSceneElement) {
      newSceneElement.style.transition = '';
    }
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9999';
    overlay.style.pointerEvents = 'none';
    return overlay;
  }

  private getSlideTransform(direction: string, entering: boolean): string {
    const offset = entering ? '100%' : '-100%';
    switch (direction) {
      case 'left':
        return `translateX(${entering ? offset : `-${offset}`})`;
      case 'right':
        return `translateX(${entering ? `-${offset}` : offset})`;
      case 'up':
        return `translateY(${entering ? offset : `-${offset}`})`;
      case 'down':
        return `translateY(${entering ? `-${offset}` : offset})`;
      default:
        return `translateX(${entering ? offset : `-${offset}`})`;
    }
  }
}

export interface TransitionOptions {
  type?: 'instant' | 'fade' | 'slide';
  duration?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  color?: string;
  easing?: string;
}

// Re-export Scene types
export type { Scene } from './Scene';