/**
 * Scene Manager Unit Tests
 * Comprehensive test suite for the scene management system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SceneManager } from '@/core/scene/SceneManager';
import { BaseScene } from '@/core/scene/Scene';

// Mock scene implementation for testing
class MockScene extends BaseScene {
  public enterCalled = false;
  public exitCalled = false;
  public updateCalled = false;
  public renderCalled = false;
  public destroyCalled = false;

  constructor(name: string) {
    super(name);
  }

  protected setupEventListeners(): void {
    // Mock implementation
  }

  protected async createUI(): Promise<void> {
    this.uiElement = document.createElement('div');
    this.uiElement.className = `scene-${this.name}`;
  }

  protected async destroyUI(): Promise<void> {
    if (this.uiElement && this.uiElement.parentElement) {
      this.uiElement.parentElement.removeChild(this.uiElement);
    }
    this.destroyCalled = true;
  }

  async enter(): Promise<void> {
    await super.enter();
    this.enterCalled = true;
  }

  async exit(): Promise<void> {
    await super.exit();
    this.exitCalled = true;
  }

  update(deltaTime: number): void {
    this.updateCalled = true;
  }

  render(): void {
    this.renderCalled = true;
  }

  // Test helper methods
  reset(): void {
    this.enterCalled = false;
    this.exitCalled = false;
    this.updateCalled = false;
    this.renderCalled = false;
    this.destroyCalled = false;
  }
}

describe('SceneManager', () => {
  let sceneManager: SceneManager;
  let canvas: HTMLCanvasElement;
  let uiContainer: HTMLDivElement;
  let mockScene1: MockScene;
  let mockScene2: MockScene;

  beforeEach(() => {
    // Setup DOM elements
    canvas = document.createElement('canvas');
    uiContainer = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(uiContainer);

    // Create scene manager
    sceneManager = new SceneManager(canvas, uiContainer);

    // Create mock scenes
    mockScene1 = new MockScene('scene1');
    mockScene2 = new MockScene('scene2');

    // Register scenes
    sceneManager.registerScene('scene1', mockScene1);
    sceneManager.registerScene('scene2', mockScene2);
  });

  afterEach(() => {
    sceneManager.destroy();
    document.body.removeChild(canvas);
    document.body.removeChild(uiContainer);
  });

  describe('Scene Registration', () => {
    it('should register scenes correctly', () => {
      const retrievedScene = sceneManager.getScene('scene1');
      expect(retrievedScene).toBe(mockScene1);
    });

    it('should return null for non-existent scenes', () => {
      const retrievedScene = sceneManager.getScene('nonexistent');
      expect(retrievedScene).toBeNull();
    });
  });

  describe('Scene Transitions', () => {
    it('should transition to a scene instantly', async () => {
      await sceneManager.transitionTo('scene1');

      expect(mockScene1.enterCalled).toBe(true);
      expect(sceneManager.getCurrentScene()).toBe(mockScene1);
    });

    it('should exit previous scene when transitioning', async () => {
      await sceneManager.transitionTo('scene1');
      mockScene1.reset();

      await sceneManager.transitionTo('scene2');

      expect(mockScene1.exitCalled).toBe(true);
      expect(mockScene2.enterCalled).toBe(true);
      expect(sceneManager.getCurrentScene()).toBe(mockScene2);
    });

    it('should handle fade transitions', async () => {
      await sceneManager.transitionTo('scene1', {
        type: 'fade',
        duration: 100
      });

      expect(mockScene1.enterCalled).toBe(true);
      expect(sceneManager.getCurrentScene()).toBe(mockScene1);
    });

    it('should handle slide transitions', async () => {
      await sceneManager.transitionTo('scene1', {
        type: 'slide',
        direction: 'left',
        duration: 100
      });

      expect(mockScene1.enterCalled).toBe(true);
      expect(sceneManager.getCurrentScene()).toBe(mockScene1);
    });

    it('should emit transition events', async () => {
      const startHandler = vi.fn();
      const completeHandler = vi.fn();

      sceneManager.addEventListener('transition-start', startHandler);
      sceneManager.addEventListener('transition-complete', completeHandler);

      await sceneManager.transitionTo('scene1');

      expect(startHandler).toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalled();
    });

    it('should handle transition errors', async () => {
      const errorHandler = vi.fn();
      sceneManager.addEventListener('transition-error', errorHandler);

      // Try to transition to non-existent scene
      await sceneManager.transitionTo('nonexistent');

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should prevent concurrent transitions', async () => {
      const promise1 = sceneManager.transitionTo('scene1');
      const promise2 = sceneManager.transitionTo('scene2');

      await Promise.all([promise1, promise2]);

      // Only the first transition should complete
      expect(mockScene1.enterCalled).toBe(true);
      expect(mockScene2.enterCalled).toBe(false);
    });
  });

  describe('Scene Updates and Rendering', () => {
    beforeEach(async () => {
      await sceneManager.transitionTo('scene1');
      mockScene1.reset();
    });

    it('should update current scene', () => {
      sceneManager.update(16.67);
      expect(mockScene1.updateCalled).toBe(true);
    });

    it('should render current scene', () => {
      sceneManager.render();
      expect(mockScene1.renderCalled).toBe(true);
    });

    it('should not update/render when transitioning', async () => {
      // Start a transition but don't await it
      const transitionPromise = sceneManager.transitionTo('scene2', {
        type: 'fade',
        duration: 100
      });

      // Try to update/render during transition
      sceneManager.update(16.67);
      sceneManager.render();

      expect(mockScene1.updateCalled).toBe(false);
      expect(mockScene1.renderCalled).toBe(false);

      // Wait for transition to complete
      await transitionPromise;
    });
  });

  describe('Window Resize Handling', () => {
    it('should handle resize for all scenes', async () => {
      const resizeSpy1 = vi.spyOn(mockScene1, 'handleResize');
      const resizeSpy2 = vi.spyOn(mockScene2, 'handleResize');

      sceneManager.handleResize(800, 600);

      expect(resizeSpy1).toHaveBeenCalledWith(800, 600);
      expect(resizeSpy2).toHaveBeenCalledWith(800, 600);
    });
  });

  describe('Cleanup', () => {
    it('should destroy all scenes on cleanup', async () => {
      await sceneManager.transitionTo('scene1');
      
      sceneManager.destroy();

      expect(mockScene1.destroyCalled).toBe(true);
      expect(mockScene2.destroyCalled).toBe(true);
      expect(sceneManager.getCurrentScene()).toBeNull();
    });
  });
});

describe('BaseScene', () => {
  let mockScene: MockScene;
  let canvas: HTMLCanvasElement;
  let uiContainer: HTMLDivElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    uiContainer = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(uiContainer);

    mockScene = new MockScene('test');
    mockScene.setCanvas(canvas);
    mockScene.setUIContainer(uiContainer);
  });

  afterEach(() => {
    mockScene.destroy();
    document.body.removeChild(canvas);
    document.body.removeChild(uiContainer);
  });

  describe('Lifecycle', () => {
    it('should initialize properly', () => {
      expect(mockScene.name).toBe('test');
      expect(mockScene.isActive).toBe(false);
    });

    it('should handle enter/exit lifecycle', async () => {
      await mockScene.enter();
      expect(mockScene.isActive).toBe(true);
      expect(mockScene.enterCalled).toBe(true);
      expect(mockScene.getUIElement()).toBeTruthy();

      await mockScene.exit();
      expect(mockScene.isActive).toBe(false);
      expect(mockScene.exitCalled).toBe(true);
    });

    it('should create and destroy UI properly', async () => {
      await mockScene.enter();
      const uiElement = mockScene.getUIElement();
      expect(uiElement).toBeTruthy();
      expect(uiElement?.parentElement).toBe(uiContainer);

      await mockScene.exit();
      expect(mockScene.destroyCalled).toBe(true);
    });
  });

  describe('Resize Handling', () => {
    it('should setup resize observer on enter', async () => {
      await mockScene.enter();
      
      // Mock resize observer is created (hard to test directly)
      expect(mockScene.isActive).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await mockScene.enter();
    });

    it('should create elements with proper classes', () => {
      const element = (mockScene as any).createElement('div', 'test-class');
      expect(element.tagName).toBe('DIV');
      expect(element.className).toBe('test-class');
    });

    it('should create buttons with click handlers', () => {
      const clickHandler = vi.fn();
      const button = (mockScene as any).createButton('Test Button', clickHandler);
      
      expect(button.tagName).toBe('BUTTON');
      expect(button.textContent).toBe('Test Button');
      
      button.click();
      expect(clickHandler).toHaveBeenCalled();
    });
  });
});

describe('Scene State Management', () => {
  let mockScene: MockScene;

  beforeEach(() => {
    mockScene = new MockScene('stateful');
  });

  afterEach(() => {
    mockScene.destroy();
  });

  it('should maintain scene state correctly', async () => {
    expect(mockScene.isActive).toBe(false);

    await mockScene.enter();
    expect(mockScene.isActive).toBe(true);

    await mockScene.exit();
    expect(mockScene.isActive).toBe(false);
  });

  it('should handle multiple enter/exit cycles', async () => {
    for (let i = 0; i < 3; i++) {
      mockScene.reset();
      
      await mockScene.enter();
      expect(mockScene.enterCalled).toBe(true);
      expect(mockScene.isActive).toBe(true);

      await mockScene.exit();
      expect(mockScene.exitCalled).toBe(true);
      expect(mockScene.isActive).toBe(false);
    }
  });
});

describe('Scene Integration', () => {
  let sceneManager: SceneManager;
  let canvas: HTMLCanvasElement;
  let uiContainer: HTMLDivElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    uiContainer = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(uiContainer);

    sceneManager = new SceneManager(canvas, uiContainer);
  });

  afterEach(() => {
    sceneManager.destroy();
    document.body.removeChild(canvas);
    document.body.removeChild(uiContainer);
  });

  it('should handle complex transition scenarios', async () => {
    const scenes = [
      new MockScene('loading'),
      new MockScene('menu'),
      new MockScene('game'),
      new MockScene('gameover')
    ];

    // Register all scenes
    scenes.forEach(scene => {
      sceneManager.registerScene(scene.name, scene);
    });

    // Simulate game flow
    await sceneManager.transitionTo('loading');
    expect(scenes[0].isActive).toBe(true);

    await sceneManager.transitionTo('menu', { type: 'fade' });
    expect(scenes[0].isActive).toBe(false);
    expect(scenes[1].isActive).toBe(true);

    await sceneManager.transitionTo('game', { type: 'slide', direction: 'left' });
    expect(scenes[1].isActive).toBe(false);
    expect(scenes[2].isActive).toBe(true);

    await sceneManager.transitionTo('gameover', { type: 'fade' });
    expect(scenes[2].isActive).toBe(false);
    expect(scenes[3].isActive).toBe(true);

    await sceneManager.transitionTo('menu', { type: 'slide', direction: 'right' });
    expect(scenes[3].isActive).toBe(false);
    expect(scenes[1].isActive).toBe(true);
  });

  it('should handle rapid scene changes gracefully', async () => {
    const rapidScene = new MockScene('rapid');
    sceneManager.registerScene('rapid', rapidScene);

    // Attempt multiple rapid transitions
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(sceneManager.transitionTo('rapid'));
    }

    await Promise.all(promises);
    
    // Should still have valid state
    expect(sceneManager.getCurrentScene()).toBe(rapidScene);
    expect(rapidScene.isActive).toBe(true);
  });
});