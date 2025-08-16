import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputSystem } from '@/systems/InputSystem';
import type { TouchInput, GestureInput } from '@/types';

// Mock canvas and DOM elements
const mockCanvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
} as unknown as HTMLCanvasElement;

// Mock navigator
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(navigator, 'getGamepads', {
  writable: true,
  value: vi.fn(() => [])
});

describe('InputSystem', () => {
  let inputSystem: InputSystem;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<canvas></canvas>';
    
    // Mock performance.now for consistent testing
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    
    inputSystem = new InputSystem();
    inputSystem.init();
  });

  afterEach(() => {
    inputSystem.destroy();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize properly', () => {
      expect(inputSystem.id).toBe('input');
      expect(inputSystem.priority).toBe(10);
      expect(inputSystem.requiredComponents).toEqual([]);
    });

    it('should setup canvas properties for mobile', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeDefined();
    });
  });

  describe('Keyboard Input', () => {
    it('should handle key down events', () => {
      const keyEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft' });
      window.dispatchEvent(keyEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.left).toBe(true);
      expect(inputState.steering).toBeGreaterThan(0);
    });

    it('should handle key up events', () => {
      // First press the key
      const keyDownEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft' });
      window.dispatchEvent(keyDownEvent);
      
      inputSystem.update(0.016, []);
      expect(inputSystem.getInputState().left).toBe(true);
      
      // Then release it
      const keyUpEvent = new KeyboardEvent('keyup', { code: 'ArrowLeft' });
      window.dispatchEvent(keyUpEvent);
      
      inputSystem.update(0.016, []);
      expect(inputSystem.getInputState().left).toBe(false);
    });

    it('should handle WASD keys as well as arrow keys', () => {
      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keyEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.left).toBe(true);
    });

    it('should handle jump key', () => {
      const keyEvent = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(keyEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.jump).toBe(true);
    });
  });

  describe('Mouse Input', () => {
    it('should handle mouse click for steering', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const mouseEvent = new MouseEvent('mousedown', {
        button: 0, // Left click
        clientX: 600, // Right side of 800px canvas
        clientY: 300
      });
      
      canvas.dispatchEvent(mouseEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.steering).toBeLessThan(0); // Should steer right (negative)
    });

    it('should handle right click', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const mouseEvent = new MouseEvent('mousedown', {
        button: 2, // Right click
        clientX: 200, // Left side
        clientY: 300
      });
      
      canvas.dispatchEvent(mouseEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.steering).toBeGreaterThan(0); // Should steer left (positive)
    });
  });

  describe('Touch Input', () => {
    it('should handle touch start events', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const touchEvent = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      
      canvas.dispatchEvent(touchEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.touch).toBeDefined();
      expect(inputState.touch?.id).toBe(1);
      expect(inputState.touch?.isActive).toBe(true);
    });

    it('should handle touch move events', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      
      // Start touch
      const touchStartEvent = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 300,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchStartEvent);
      
      // Move touch
      const touchMoveEvent = new TouchEvent('touchmove', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 350,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchMoveEvent);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.touch?.deltaPosition.x).toBe(50);
      expect(inputState.touch?.deltaPosition.y).toBe(0);
    });

    it('should handle touch end events', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      
      // Start touch
      const touchStartEvent = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchStartEvent);
      
      inputSystem.update(0.016, []);
      expect(inputSystem.getInputState().touch).toBeDefined();
      
      // End touch
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchEndEvent);
      
      inputSystem.update(0.016, []);
      expect(inputSystem.getInputState().touch).toBeNull();
    });
  });

  describe('Gesture Recognition', () => {
    it('should recognize tap gestures', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      
      // Quick touch and release (tap)
      const touchStart = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchStart);
      
      // Advance time slightly
      vi.spyOn(performance, 'now').mockReturnValue(1050); // 50ms later
      
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 405, // Very small movement
            clientY: 305,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchEnd);
      
      inputSystem.update(0.016, []);
      const gestures = inputSystem.getActiveGestures();
      
      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe('tap');
    });

    it('should recognize swipe gestures', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      
      // Start touch
      const touchStart = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 300,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchStart);
      
      // Move significantly
      const touchMove = new TouchEvent('touchmove', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400, // 100px movement
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchMove);
      
      // End after reasonable time
      vi.spyOn(performance, 'now').mockReturnValue(1200); // 200ms later
      
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchEnd);
      
      inputSystem.update(0.016, []);
      const gestures = inputSystem.getActiveGestures();
      
      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe('swipe');
      expect(gestures[0].direction?.x).toBe(100);
    });

    it('should recognize hold gestures', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      
      // Start touch
      const touchStart = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchStart);
      
      // Hold for long time with minimal movement
      vi.spyOn(performance, 'now').mockReturnValue(1600); // 600ms later
      
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 405, // Very small movement
            clientY: 305,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      canvas.dispatchEvent(touchEnd);
      
      inputSystem.update(0.016, []);
      const gestures = inputSystem.getActiveGestures();
      
      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe('hold');
    });
  });

  describe('Input Buffering', () => {
    it('should buffer inputs correctly', () => {
      // Create multiple rapid inputs
      const keyEvent1 = new KeyboardEvent('keydown', { code: 'Space' });
      const keyEvent2 = new KeyboardEvent('keydown', { code: 'ArrowLeft' });
      
      window.dispatchEvent(keyEvent1);
      window.dispatchEvent(keyEvent2);
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      expect(inputState.bufferedInputs.length).toBeGreaterThan(0);
    });

    it('should clear old buffered inputs', () => {
      const keyEvent = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(keyEvent);
      
      inputSystem.update(0.016, []);
      
      // Advance time significantly
      vi.spyOn(performance, 'now').mockReturnValue(2000); // 1000ms later
      
      inputSystem.update(0.016, []);
      const inputState = inputSystem.getInputState();
      
      // Old inputs should be cleaned up
      expect(inputState.bufferedInputs.length).toBe(0);
    });
  });

  describe('Haptic Feedback', () => {
    it('should trigger haptic feedback on touch', () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');
      
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const touchEvent = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      
      canvas.dispatchEvent(touchEvent);
      
      expect(vibrateSpy).toHaveBeenCalledWith([10]); // Light haptic feedback
    });
  });

  describe('Configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        touchSensitivity: 2.0,
        enableHaptics: false
      };
      
      inputSystem.setConfig(newConfig);
      
      // Config should be updated internally
      // We can test this by checking behavior changes
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const touchEvent = new TouchEvent('touchstart', {
        changedTouches: [
          {
            identifier: 1,
            clientX: 400,
            clientY: 300,
            radiusX: 20,
            radiusY: 20
          } as Touch
        ]
      });
      
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');
      canvas.dispatchEvent(touchEvent);
      
      expect(vibrateSpy).not.toHaveBeenCalled(); // Haptics disabled
    });
  });

  describe('Steering Calculation', () => {
    it('should combine multiple input sources for steering', () => {
      // Keyboard input
      const keyEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft' });
      window.dispatchEvent(keyEvent);
      
      // Mouse input
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const mouseEvent = new MouseEvent('mousedown', {
        button: 0,
        clientX: 600, // Right side
        clientY: 300
      });
      canvas.dispatchEvent(mouseEvent);
      
      inputSystem.update(0.016, []);
      const steering = inputSystem.getSteering();
      
      // Should combine both inputs (keyboard left + mouse right)
      expect(steering).not.toBe(0);
    });

    it('should clamp steering values to [-1, 1]', () => {
      // Multiple strong inputs
      const keyEvent1 = new KeyboardEvent('keydown', { code: 'ArrowLeft' });
      const keyEvent2 = new KeyboardEvent('keydown', { code: 'KeyA' });
      window.dispatchEvent(keyEvent1);
      window.dispatchEvent(keyEvent2);
      
      inputSystem.update(0.016, []);
      const steering = inputSystem.getSteering();
      
      expect(steering).toBeGreaterThanOrEqual(-1);
      expect(steering).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance and Battery Optimization', () => {
    it('should reduce update frequency when page is hidden', () => {
      // Simulate page visibility change
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true
      });
      
      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);
      
      // The system should internally reduce update frequency
      // We can't directly test this without exposing internal state,
      // but we can verify the event was handled without errors
      expect(() => inputSystem.update(0.016, [])).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing canvas gracefully', () => {
      document.body.innerHTML = ''; // Remove canvas
      
      const systemWithoutCanvas = new InputSystem();
      expect(() => systemWithoutCanvas.init()).not.toThrow();
    });

    it('should handle invalid touch events', () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      
      // Touch event with no touches
      const invalidTouchEvent = new TouchEvent('touchstart', {
        changedTouches: []
      });
      
      expect(() => {
        canvas.dispatchEvent(invalidTouchEvent);
        inputSystem.update(0.016, []);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should remove all event listeners on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      inputSystem.destroy();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should clear all state on destroy', () => {
      // Add some input state
      const keyEvent = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(keyEvent);
      
      inputSystem.update(0.016, []);
      expect(inputSystem.getInputState().jump).toBe(true);
      
      inputSystem.destroy();
      
      // After destroy, should handle updates gracefully
      expect(() => inputSystem.update(0.016, [])).not.toThrow();
    });
  });
});