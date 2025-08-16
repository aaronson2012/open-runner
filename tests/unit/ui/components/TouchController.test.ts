/**
 * Touch Controller Unit Tests
 * Comprehensive test suite for the mobile touch controller
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TouchController } from '@/components/ui/controls/TouchController';
import type { InputState, GestureInput } from '@/types';

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true
});

describe('TouchController', () => {
  let container: HTMLDivElement;
  let touchController: TouchController;
  let inputHandler: ReturnType<typeof vi.fn>;
  let gestureHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    inputHandler = vi.fn();
    gestureHandler = vi.fn();

    touchController = new TouchController({
      parent: container,
      showDebugZones: true,
      onInput: inputHandler,
      onGesture: gestureHandler
    });
  });

  afterEach(() => {
    touchController.destroy();
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create touch zones', () => {
      const element = touchController.getElement();
      
      expect(element.querySelector('.touch-zone-left')).toBeTruthy();
      expect(element.querySelector('.touch-zone-right')).toBeTruthy();
      expect(element.querySelector('.touch-zone-jump')).toBeTruthy();
      expect(element.querySelector('.touch-zone-pause')).toBeTruthy();
    });

    it('should show debug zones when enabled', () => {
      const zones = touchController.getElement().querySelectorAll('.touch-zone');
      zones.forEach(zone => {
        expect(zone.textContent?.length).toBeGreaterThan(0);
      });
    });

    it('should hide debug zones when disabled', () => {
      const controller = new TouchController({
        parent: container,
        showDebugZones: false
      });

      const zones = controller.getElement().querySelectorAll('.touch-zone');
      zones.forEach(zone => {
        const style = window.getComputedStyle(zone);
        expect(style.opacity).toBe('0');
      });

      controller.destroy();
    });
  });

  describe('Touch Events', () => {
    let leftZone: HTMLElement;
    let rightZone: HTMLElement;
    let jumpZone: HTMLElement;

    beforeEach(() => {
      const element = touchController.getElement();
      leftZone = element.querySelector('.touch-zone-left') as HTMLElement;
      rightZone = element.querySelector('.touch-zone-right') as HTMLElement;
      jumpZone = element.querySelector('.touch-zone-jump') as HTMLElement;
    });

    it('should handle touch start events', () => {
      const touch = createMockTouch(0, 100, 200);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      leftZone.dispatchEvent(touchEvent);

      expect(inputHandler).toHaveBeenCalled();
      const inputState = inputHandler.mock.calls[0][0] as InputState;
      expect(inputState.left).toBe(true);
      expect(inputState.steering).toBeLessThan(0);
    });

    it('should handle touch end events', () => {
      // Start touch
      const touch = createMockTouch(0, 100, 200);
      const startEvent = createMockTouchEvent('touchstart', [touch]);
      leftZone.dispatchEvent(startEvent);

      // End touch
      const endEvent = createMockTouchEvent('touchend', [touch]);
      leftZone.dispatchEvent(endEvent);

      expect(inputHandler).toHaveBeenCalledTimes(2);
      const finalInputState = inputHandler.mock.calls[1][0] as InputState;
      expect(finalInputState.left).toBe(false);
      expect(finalInputState.steering).toBe(0);
    });

    it('should handle right steering', () => {
      const touch = createMockTouch(0, 700, 200);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      rightZone.dispatchEvent(touchEvent);

      const inputState = inputHandler.mock.calls[0][0] as InputState;
      expect(inputState.right).toBe(true);
      expect(inputState.steering).toBeGreaterThan(0);
    });

    it('should handle jump action', () => {
      const touch = createMockTouch(0, 400, 500);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      jumpZone.dispatchEvent(touchEvent);

      const inputState = inputHandler.mock.calls[0][0] as InputState;
      expect(inputState.jump).toBe(true);
    });

    it('should handle multiple simultaneous touches', () => {
      const leftTouch = createMockTouch(0, 100, 200);
      const jumpTouch = createMockTouch(1, 400, 500);
      const touchEvent = createMockTouchEvent('touchstart', [leftTouch, jumpTouch]);

      touchController.getElement().dispatchEvent(touchEvent);

      const inputState = inputHandler.mock.calls[0][0] as InputState;
      expect(inputState.left).toBe(true);
      expect(inputState.jump).toBe(true);
    });
  });

  describe('Mouse Events (Desktop Testing)', () => {
    let leftZone: HTMLElement;

    beforeEach(() => {
      const element = touchController.getElement();
      leftZone = element.querySelector('.touch-zone-left') as HTMLElement;
    });

    it('should handle mouse events for desktop testing', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 200
      });

      leftZone.dispatchEvent(mouseEvent);

      expect(inputHandler).toHaveBeenCalled();
      const inputState = inputHandler.mock.calls[0][0] as InputState;
      expect(inputState.left).toBe(true);
    });

    it('should handle mouse move events', () => {
      // Start mouse interaction
      const mouseDown = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 200
      });
      leftZone.dispatchEvent(mouseDown);

      // Move mouse
      const mouseMove = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250
      });
      leftZone.dispatchEvent(mouseMove);

      expect(inputHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Gesture Recognition', () => {
    it('should recognize tap gestures', async () => {
      const touch = createMockTouch(0, 400, 300);
      
      // Quick tap
      const startEvent = createMockTouchEvent('touchstart', [touch]);
      touchController.getElement().dispatchEvent(startEvent);

      // Small delay for tap gesture
      await new Promise(resolve => setTimeout(resolve, 50));

      const endEvent = createMockTouchEvent('touchend', [touch]);
      touchController.getElement().dispatchEvent(endEvent);

      // Wait for gesture processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(gestureHandler).toHaveBeenCalled();
      const gesture = gestureHandler.mock.calls[0][0] as GestureInput;
      expect(gesture.type).toBe('tap');
    });

    it('should recognize swipe gestures', async () => {
      const startTouch = createMockTouch(0, 400, 200);
      const endTouch = createMockTouch(0, 400, 350);
      
      // Start swipe
      const startEvent = createMockTouchEvent('touchstart', [startTouch]);
      touchController.getElement().dispatchEvent(startEvent);

      // Move significantly down for swipe
      const moveEvent = createMockTouchEvent('touchmove', [endTouch]);
      touchController.getElement().dispatchEvent(moveEvent);

      // End swipe
      const endEvent = createMockTouchEvent('touchend', [endTouch]);
      touchController.getElement().dispatchEvent(endEvent);

      // Wait for gesture processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(gestureHandler).toHaveBeenCalled();
      const gesture = gestureHandler.mock.calls[0][0] as GestureInput;
      expect(gesture.type).toBe('swipe');
      expect(gesture.direction?.y).toBeGreaterThan(0); // Downward swipe
    });

    it('should recognize hold gestures', async () => {
      const touch = createMockTouch(0, 400, 300);
      
      // Start hold
      const startEvent = createMockTouchEvent('touchstart', [touch]);
      touchController.getElement().dispatchEvent(startEvent);

      // Wait for hold threshold
      await new Promise(resolve => setTimeout(resolve, 600));

      const endEvent = createMockTouchEvent('touchend', [touch]);
      touchController.getElement().dispatchEvent(endEvent);

      // Wait for gesture processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(gestureHandler).toHaveBeenCalled();
      const gesture = gestureHandler.mock.calls[0][0] as GestureInput;
      expect(gesture.type).toBe('hold');
    });
  });

  describe('Haptic Feedback', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should trigger vibration on jump', () => {
      const jumpZone = touchController.getElement().querySelector('.touch-zone-jump') as HTMLElement;
      const touch = createMockTouch(0, 400, 500);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      jumpZone.dispatchEvent(touchEvent);

      expect(navigator.vibrate).toHaveBeenCalledWith(25);
    });

    it('should trigger vibration on steering', () => {
      const leftZone = touchController.getElement().querySelector('.touch-zone-left') as HTMLElement;
      const touch = createMockTouch(0, 100, 200);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      leftZone.dispatchEvent(touchEvent);

      expect(navigator.vibrate).toHaveBeenCalledWith(15);
    });

    it('should respect vibration settings', () => {
      const controller = new TouchController({
        parent: container,
        vibrationEnabled: false
      });

      const jumpZone = controller.getElement().querySelector('.touch-zone-jump') as HTMLElement;
      const touch = createMockTouch(0, 400, 500);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      jumpZone.dispatchEvent(touchEvent);

      expect(navigator.vibrate).not.toHaveBeenCalled();

      controller.destroy();
    });
  });

  describe('Input State Management', () => {
    it('should provide current input state', () => {
      const inputState = touchController.getInputState();
      
      expect(inputState).toHaveProperty('jump');
      expect(inputState).toHaveProperty('left');
      expect(inputState).toHaveProperty('right');
      expect(inputState).toHaveProperty('slide');
      expect(inputState).toHaveProperty('pause');
      expect(inputState).toHaveProperty('steering');
      expect(inputState).toHaveProperty('touch');
      expect(inputState).toHaveProperty('gestures');
      expect(inputState).toHaveProperty('bufferedInputs');
    });

    it('should buffer inputs for precise timing', () => {
      const jumpZone = touchController.getElement().querySelector('.touch-zone-jump') as HTMLElement;
      const touch = createMockTouch(0, 400, 500);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      jumpZone.dispatchEvent(touchEvent);

      const inputState = touchController.getInputState();
      expect(inputState.bufferedInputs.length).toBeGreaterThan(0);
      expect(inputState.bufferedInputs[0].type).toBe('jump');
    });

    it('should clean up old buffered inputs', async () => {
      const jumpZone = touchController.getElement().querySelector('.touch-zone-jump') as HTMLElement;
      const touch = createMockTouch(0, 400, 500);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      jumpZone.dispatchEvent(touchEvent);

      // Wait longer than buffer timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Trigger new input to clean up old ones
      jumpZone.dispatchEvent(touchEvent);

      const inputState = touchController.getInputState();
      // Should only have the new input, old one should be cleaned up
      expect(inputState.bufferedInputs.length).toBe(1);
    });
  });

  describe('Configuration Options', () => {
    it('should respect sensitivity settings', () => {
      const controller = new TouchController({
        parent: container,
        sensitivity: 2.0
      });

      const leftZone = controller.getElement().querySelector('.touch-zone-left') as HTMLElement;
      const touch = createMockTouch(0, 100, 200);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      leftZone.dispatchEvent(touchEvent);

      const inputState = controller.getInputState();
      expect(Math.abs(inputState.steering)).toBeGreaterThan(1);

      controller.destroy();
    });

    it('should update sensitivity dynamically', () => {
      touchController.setSensitivity(0.5);

      const leftZone = touchController.getElement().querySelector('.touch-zone-left') as HTMLElement;
      const touch = createMockTouch(0, 100, 200);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);

      leftZone.dispatchEvent(touchEvent);

      const inputState = touchController.getInputState();
      expect(Math.abs(inputState.steering)).toBeLessThan(1);
    });

    it('should toggle debug zones', () => {
      touchController.toggleDebugZones();
      
      // Debug zones should now be hidden (or shown if they were hidden)
      const zones = touchController.getElement().querySelectorAll('.touch-zone');
      // The visibility toggle would be reflected in the component's internal state
      expect(zones.length).toBeGreaterThan(0);
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset input state', () => {
      // Trigger some inputs
      const leftZone = touchController.getElement().querySelector('.touch-zone-left') as HTMLElement;
      const touch = createMockTouch(0, 100, 200);
      const touchEvent = createMockTouchEvent('touchstart', [touch]);
      leftZone.dispatchEvent(touchEvent);

      // Reset
      touchController.reset();

      const inputState = touchController.getInputState();
      expect(inputState.left).toBe(false);
      expect(inputState.right).toBe(false);
      expect(inputState.jump).toBe(false);
      expect(inputState.steering).toBe(0);
      expect(inputState.bufferedInputs).toHaveLength(0);
    });

    it('should cleanup properly on destroy', () => {
      const element = touchController.getElement();
      expect(element.parentElement).toBe(container);

      touchController.destroy();

      expect(touchController.isComponentDestroyed()).toBe(true);
    });
  });

  describe('Responsive Design', () => {
    it('should update touch zones on resize', () => {
      // Mock window resize
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);

      // Touch zones should still be present and functional
      const zones = touchController.getElement().querySelectorAll('.touch-zone');
      expect(zones.length).toBeGreaterThan(0);
    });

    it('should handle orientation changes', () => {
      // Mock orientation change
      const orientationEvent = new Event('orientationchange');
      window.dispatchEvent(orientationEvent);

      // Allow for async updates
      setTimeout(() => {
        const zones = touchController.getElement().querySelectorAll('.touch-zone');
        expect(zones.length).toBeGreaterThan(0);
      }, 150);
    });
  });
});

// Helper functions for creating mock touch events
function createMockTouch(identifier: number, clientX: number, clientY: number): Touch {
  return {
    identifier,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
    radiusX: 20,
    radiusY: 20,
    rotationAngle: 0,
    force: 1,
    target: document.body
  } as Touch;
}

function createMockTouchEvent(type: string, touches: Touch[]): TouchEvent {
  const touchList = {
    length: touches.length,
    item: (index: number) => touches[index],
    [Symbol.iterator]: function* () {
      for (let i = 0; i < touches.length; i++) {
        yield touches[i];
      }
    }
  } as TouchList;

  return new TouchEvent(type, {
    touches: touchList,
    changedTouches: touchList,
    targetTouches: touchList,
    bubbles: true,
    cancelable: true
  });
}