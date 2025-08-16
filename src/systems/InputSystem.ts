import * as THREE from 'three';
import type { System, Entity } from '@/types';
import type { InputState, TouchInput, GestureInput, BufferedInput, Vector2 } from '@/types';

export class InputSystem implements System {
  readonly id = 'input';
  readonly priority = 10; // High priority for responsive input
  requiredComponents: string[] = [];

  private inputState: InputState;
  private keyboardState = new Map<string, boolean>();
  private mouseState = { left: false, right: false, x: 0, y: 0 };
  private touches = new Map<number, TouchInput>();
  private gestures: GestureInput[] = [];
  private bufferedInputs: BufferedInput[] = [];
  
  // Configuration
  private config = {
    // Input sensitivity
    keyboardSensitivity: 1.0,
    mouseSensitivity: 1.0,
    touchSensitivity: 1.2,
    
    // Gesture recognition
    tapThreshold: 150, // ms
    swipeThreshold: 50, // pixels
    holdThreshold: 500, // ms
    
    // Input buffering
    bufferSize: 10,
    bufferTimeout: 100, // ms
    
    // Mobile optimizations
    touchTargetSize: 44, // pixels (Apple HIG minimum)
    preventScrolling: true,
    enableHaptics: true,
    
    // Performance
    updateFrequency: 60, // Hz
    gestureCleanupInterval: 1000 // ms
  };

  private canvas!: HTMLCanvasElement;
  private eventListeners: Array<{ element: EventTarget; type: string; listener: EventListener }> = [];
  private gestureCleanupTimer?: number;

  constructor() {
    this.inputState = this.createEmptyInputState();
  }

  init(): void {
    this.setupCanvas();
    this.setupEventListeners();
    this.startGestureCleanup();
    console.log('InputSystem initialized with mobile-first design');
  }

  private setupCanvas(): void {
    this.canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      console.error('Canvas not found for InputSystem');
      return;
    }

    // Mobile optimizations
    this.canvas.style.touchAction = 'none'; // Prevent scrolling
    this.canvas.style.userSelect = 'none'; // Prevent text selection
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Keyboard events
    this.addEventListeners(window, [
      { type: 'keydown', listener: this.handleKeyDown.bind(this) },
      { type: 'keyup', listener: this.handleKeyUp.bind(this) },
    ]);

    // Mouse events
    this.addEventListeners(this.canvas, [
      { type: 'mousedown', listener: this.handleMouseDown.bind(this) },
      { type: 'mouseup', listener: this.handleMouseUp.bind(this) },
      { type: 'mousemove', listener: this.handleMouseMove.bind(this) },
      { type: 'contextmenu', listener: (e: Event) => e.preventDefault() },
    ]);

    // Touch events (mobile-first)
    this.addEventListeners(this.canvas, [
      { type: 'touchstart', listener: this.handleTouchStart.bind(this) },
      { type: 'touchmove', listener: this.handleTouchMove.bind(this) },
      { type: 'touchend', listener: this.handleTouchEnd.bind(this) },
      { type: 'touchcancel', listener: this.handleTouchCancel.bind(this) },
    ]);

    // Device orientation (mobile)
    if ('DeviceOrientationEvent' in window) {
      this.addEventListeners(window, [
        { type: 'deviceorientation', listener: this.handleDeviceOrientation.bind(this) },
      ]);
    }

    // Gamepad support
    this.addEventListeners(window, [
      { type: 'gamepadconnected', listener: this.handleGamepadConnected.bind(this) },
      { type: 'gamepaddisconnected', listener: this.handleGamepadDisconnected.bind(this) },
    ]);

    // Visibility change for battery optimization
    this.addEventListeners(document, [
      { type: 'visibilitychange', listener: this.handleVisibilityChange.bind(this) },
    ]);
  }

  private addEventListeners(element: EventTarget, events: Array<{ type: string; listener: EventListener }>): void {
    events.forEach(({ type, listener }) => {
      element.addEventListener(type, listener, { passive: false });
      this.eventListeners.push({ element, type, listener });
    });
  }

  // Keyboard Input
  private handleKeyDown(event: KeyboardEvent): void {
    this.keyboardState.set(event.code, true);
    this.bufferInput('keyboard', { code: event.code, action: 'down' });
    
    // Prevent default for game keys
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keyboardState.set(event.code, false);
    this.bufferInput('keyboard', { code: event.code, action: 'up' });
  }

  private isGameKey(code: string): boolean {
    return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 
            'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(code);
  }

  // Mouse Input
  private handleMouseDown(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const normalizedX = (x / rect.width) * 2 - 1;

    if (event.button === 0) { // Left click
      this.mouseState.left = true;
      this.bufferInput('mouse', { button: 'left', action: 'down', x: normalizedX });
    } else if (event.button === 2) { // Right click
      this.mouseState.right = true;
      this.bufferInput('mouse', { button: 'right', action: 'down', x: normalizedX });
    }

    event.preventDefault();
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.mouseState.left = false;
      this.bufferInput('mouse', { button: 'left', action: 'up' });
    } else if (event.button === 2) {
      this.mouseState.right = false;
      this.bufferInput('mouse', { button: 'right', action: 'up' });
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseState.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseState.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  // Touch Input (Mobile-First Design)
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const rect = this.canvas.getBoundingClientRect();
      
      const touchInput: TouchInput = {
        id: touch.identifier,
        startPosition: {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        },
        currentPosition: {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        },
        deltaPosition: { x: 0, y: 0 },
        startTime: performance.now(),
        isActive: true,
        pressure: (touch as any).force || 1.0,
        radiusX: touch.radiusX || 20,
        radiusY: touch.radiusY || 20
      };

      this.touches.set(touch.identifier, touchInput);
      this.bufferInput('touch', { action: 'start', touch: touchInput });
      
      // Haptic feedback on touch start
      this.triggerHapticFeedback('light');
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInput = this.touches.get(touch.identifier);
      
      if (touchInput) {
        const rect = this.canvas.getBoundingClientRect();
        const newPosition = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        };
        
        touchInput.deltaPosition = {
          x: newPosition.x - touchInput.currentPosition.x,
          y: newPosition.y - touchInput.currentPosition.y
        };
        
        touchInput.currentPosition = newPosition;
        touchInput.pressure = (touch as any).force || 1.0;
        
        this.bufferInput('touch', { action: 'move', touch: touchInput });
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInput = this.touches.get(touch.identifier);
      
      if (touchInput) {
        touchInput.isActive = false;
        const duration = performance.now() - touchInput.startTime;
        
        // Gesture recognition
        this.recognizeGesture(touchInput, duration);
        
        this.bufferInput('touch', { action: 'end', touch: touchInput });
        this.touches.delete(touch.identifier);
      }
    }
  }

  private handleTouchCancel(event: TouchEvent): void {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches.delete(touch.identifier);
    }
  }

  // Gesture Recognition
  private recognizeGesture(touch: TouchInput, duration: number): void {
    const distance = Math.sqrt(
      Math.pow(touch.currentPosition.x - touch.startPosition.x, 2) +
      Math.pow(touch.currentPosition.y - touch.startPosition.y, 2)
    );

    // Tap gesture
    if (duration < this.config.tapThreshold && distance < this.config.swipeThreshold) {
      this.addGesture({
        type: 'tap',
        position: touch.startPosition,
        duration,
        timestamp: performance.now()
      });
      this.triggerHapticFeedback('medium');
      return;
    }

    // Hold gesture
    if (duration > this.config.holdThreshold && distance < this.config.swipeThreshold) {
      this.addGesture({
        type: 'hold',
        position: touch.startPosition,
        duration,
        timestamp: performance.now()
      });
      this.triggerHapticFeedback('heavy');
      return;
    }

    // Swipe gesture
    if (distance > this.config.swipeThreshold) {
      const direction = {
        x: touch.currentPosition.x - touch.startPosition.x,
        y: touch.currentPosition.y - touch.startPosition.y
      };
      
      const velocity = {
        x: direction.x / duration,
        y: direction.y / duration
      };

      this.addGesture({
        type: 'swipe',
        position: touch.startPosition,
        direction,
        velocity,
        distance,
        duration,
        timestamp: performance.now()
      });
      
      this.triggerHapticFeedback('light');
    }
  }

  private addGesture(gesture: GestureInput): void {
    this.gestures.push(gesture);
    this.bufferInput('gesture', gesture);
  }

  // Device Orientation (Mobile)
  private handleDeviceOrientation(event: DeviceOrientationEvent): void {
    if (event.gamma !== null && event.beta !== null) {
      // Use device tilt for steering (optional feature)
      const tiltSteering = Math.max(-1, Math.min(1, event.gamma / 45)); // 45 degrees max tilt
      this.bufferInput('orientation', { 
        steering: tiltSteering,
        gamma: event.gamma,
        beta: event.beta,
        alpha: event.alpha
      });
    }
  }

  // Gamepad Support
  private handleGamepadConnected(event: GamepadEvent): void {
    console.log('Gamepad connected:', event.gamepad.id);
    this.bufferInput('gamepad', { action: 'connected', gamepad: event.gamepad });
  }

  private handleGamepadDisconnected(event: GamepadEvent): void {
    console.log('Gamepad disconnected:', event.gamepad.id);
    this.bufferInput('gamepad', { action: 'disconnected', gamepad: event.gamepad });
  }

  // Battery Optimization
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.config.updateFrequency = 30; // Reduce update frequency when hidden
    } else {
      this.config.updateFrequency = 60; // Restore full frequency when visible
    }
  }

  // Haptic Feedback
  private triggerHapticFeedback(intensity: 'light' | 'medium' | 'heavy'): void {
    if (!this.config.enableHaptics || !('vibrate' in navigator)) return;

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };

    navigator.vibrate(patterns[intensity]);
  }

  // Input Buffering
  private bufferInput(type: string, data: any): void {
    const bufferedInput: BufferedInput = {
      type,
      timestamp: performance.now(),
      data,
      processed: false
    };

    this.bufferedInputs.push(bufferedInput);

    // Maintain buffer size
    if (this.bufferedInputs.length > this.config.bufferSize) {
      this.bufferedInputs.shift();
    }
  }

  private processBufferedInputs(): void {
    const now = performance.now();
    
    this.bufferedInputs = this.bufferedInputs.filter(input => {
      if (input.processed || now - input.timestamp > this.config.bufferTimeout) {
        return false;
      }
      
      // Process the input
      input.processed = true;
      return false; // Remove after processing
    });
  }

  // Gesture Cleanup
  private startGestureCleanup(): void {
    this.gestureCleanupTimer = window.setInterval(() => {
      const now = performance.now();
      this.gestures = this.gestures.filter(gesture => 
        now - gesture.timestamp < this.config.gestureCleanupInterval
      );
    }, this.config.gestureCleanupInterval);
  }

  // Main Update Method
  update(deltaTime: number, entities: Entity[]): void {
    this.processBufferedInputs();
    this.updateInputState();
    this.updateGamepadInput();
  }

  private updateInputState(): void {
    // Update steering from multiple input sources
    let steering = 0;

    // Keyboard steering
    if (this.keyboardState.get('ArrowLeft') || this.keyboardState.get('KeyA')) {
      steering += this.config.keyboardSensitivity;
    }
    if (this.keyboardState.get('ArrowRight') || this.keyboardState.get('KeyD')) {
      steering -= this.config.keyboardSensitivity;
    }

    // Mouse steering (based on screen position)
    if (this.mouseState.left || this.mouseState.right) {
      steering += this.mouseState.x * this.config.mouseSensitivity;
    }

    // Touch steering (swipe gestures)
    for (const touch of this.touches.values()) {
      if (touch.isActive && Math.abs(touch.deltaPosition.x) > 5) {
        const touchSteering = Math.sign(touch.deltaPosition.x) * this.config.touchSensitivity;
        steering += touchSteering * 0.1; // Smooth touch steering
      }
    }

    // Clamp steering to [-1, 1]
    steering = Math.max(-1, Math.min(1, steering));

    // Update input state
    this.inputState = {
      jump: this.keyboardState.get('Space') || this.keyboardState.get('ArrowUp') || this.keyboardState.get('KeyW') || false,
      left: steering > 0.1,
      right: steering < -0.1,
      slide: this.keyboardState.get('ArrowDown') || this.keyboardState.get('KeyS') || false,
      pause: this.keyboardState.get('Escape') || false,
      steering,
      touch: this.touches.size > 0 ? Array.from(this.touches.values())[0] : null,
      gestures: [...this.gestures],
      bufferedInputs: [...this.bufferedInputs]
    };
  }

  private updateGamepadInput(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        // Left stick for steering
        const leftStickX = gamepad.axes[0];
        if (Math.abs(leftStickX) > 0.1) {
          this.inputState.steering += leftStickX;
        }

        // Buttons
        if (gamepad.buttons[0]?.pressed) { // A button
          this.inputState.jump = true;
        }
      }
    }
  }

  private createEmptyInputState(): InputState {
    return {
      jump: false,
      left: false,
      right: false,
      slide: false,
      pause: false,
      steering: 0,
      touch: null,
      gestures: [],
      bufferedInputs: []
    };
  }

  // Public API
  getInputState(): InputState {
    return this.inputState;
  }

  getSteering(): number {
    return this.inputState.steering;
  }

  getActiveGestures(): GestureInput[] {
    return this.gestures.filter(gesture => 
      performance.now() - gesture.timestamp < 500 // Recent gestures only
    );
  }

  setConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
  }

  destroy(): void {
    // Remove all event listeners
    this.eventListeners.forEach(({ element, type, listener }) => {
      element.removeEventListener(type, listener);
    });
    this.eventListeners = [];

    // Clear timers
    if (this.gestureCleanupTimer) {
      clearInterval(this.gestureCleanupTimer);
    }

    // Clear state
    this.touches.clear();
    this.gestures = [];
    this.bufferedInputs = [];
    
    console.log('InputSystem destroyed');
  }
}