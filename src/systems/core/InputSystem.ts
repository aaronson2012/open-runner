import type { Entity, Vector2 } from '@/types';
import { BaseSystem } from './BaseSystem';
import type { PlayerControllerComponent } from '@/components/core/CoreComponents';

interface InputBinding {
  action: string;
  keys: string[];
  gamepadButtons?: number[];
  touches?: TouchGesture[];
}

interface TouchGesture {
  type: 'tap' | 'swipe' | 'pinch' | 'hold';
  fingers: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  threshold?: number;
}

interface GamepadState {
  connected: boolean;
  buttons: boolean[];
  axes: number[];
  timestamp: number;
}

/**
 * Input system handling keyboard, mouse, touch, and gamepad input
 */
export class InputSystem extends BaseSystem {
  private canvas: HTMLCanvasElement;
  
  // Input state
  private keys = new Set<string>();
  private keysPressed = new Set<string>();
  private keysReleased = new Set<string>();
  
  private mousePosition: Vector2 = { x: 0, y: 0 };
  private mouseDelta: Vector2 = { x: 0, y: 0 };
  private mouseButtons = new Set<number>();
  private mouseButtonsPressed = new Set<number>();
  private mouseButtonsReleased = new Set<number>();
  
  private touches = new Map<number, Touch>();
  private touchGestures: string[] = [];
  
  private gamepads = new Map<number, GamepadState>();
  
  // Input bindings
  private bindings = new Map<string, InputBinding>();
  private actionStates = new Map<string, boolean>();
  private actionPressed = new Map<string, boolean>();
  private actionReleased = new Map<string, boolean>();
  
  // Settings
  private mouseSensitivity = 1.0;
  private touchSensitivity = 1.0;
  private deadzone = 0.1; // For gamepad sticks
  private doubleClickTime = 300; // ms
  private swipeMinDistance = 50; // pixels
  
  // Events
  private eventListeners: (() => void)[] = [];
  
  constructor(canvas: HTMLCanvasElement) {
    super('input', ['playerController'], -50); // Very high priority - process input first
    this.canvas = canvas;
    
    // Set up default bindings
    this.setupDefaultBindings();
  }

  protected onInit(): void {
    this.setupEventListeners();
    this.debug('Input system initialized');
  }

  protected onDestroy(): void {
    this.removeEventListeners();
  }

  protected onUpdate(deltaTime: number, entities: Entity[]): void {
    this.updateGamepads();
    this.processInput(entities);
    this.clearFrameInputs();
  }

  /**
   * Set up default input bindings
   */
  private setupDefaultBindings(): void {
    this.addBinding('moveLeft', ['KeyA', 'ArrowLeft'], [14], [{ type: 'swipe', fingers: 1, direction: 'left' }]);
    this.addBinding('moveRight', ['KeyD', 'ArrowRight'], [15], [{ type: 'swipe', fingers: 1, direction: 'right' }]);
    this.addBinding('jump', ['Space', 'KeyW', 'ArrowUp'], [0], [{ type: 'tap', fingers: 1 }]);
    this.addBinding('slide', ['KeyS', 'ArrowDown'], [1], [{ type: 'swipe', fingers: 1, direction: 'down' }]);
    this.addBinding('run', ['ShiftLeft', 'ShiftRight'], [2]);
    this.addBinding('pause', ['Escape', 'KeyP'], [9]);
  }

  /**
   * Add an input binding
   */
  addBinding(action: string, keys: string[], gamepadButtons?: number[], touches?: TouchGesture[]): void {
    this.bindings.set(action, {
      action,
      keys,
      gamepadButtons,
      touches
    });
    
    this.actionStates.set(action, false);
    this.actionPressed.set(action, false);
    this.actionReleased.set(action, false);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Keyboard events
    const onKeyDown = (event: KeyboardEvent) => {
      if (!this.keys.has(event.code)) {
        this.keysPressed.add(event.code);
      }
      this.keys.add(event.code);
      
      // Prevent default for game keys
      if (this.isGameKey(event.code)) {
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
      this.keysReleased.add(event.code);
      
      if (this.isGameKey(event.code)) {
        event.preventDefault();
      }
    };

    // Mouse events
    const onMouseMove = (event: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const newPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      this.mouseDelta.x = newPosition.x - this.mousePosition.x;
      this.mouseDelta.y = newPosition.y - this.mousePosition.y;
      this.mousePosition = newPosition;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!this.mouseButtons.has(event.button)) {
        this.mouseButtonsPressed.add(event.button);
      }
      this.mouseButtons.add(event.button);
      event.preventDefault();
    };

    const onMouseUp = (event: MouseEvent) => {
      this.mouseButtons.delete(event.button);
      this.mouseButtonsReleased.add(event.button);
      event.preventDefault();
    };

    // Touch events
    const onTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        this.touches.set(touch.identifier, touch);
      }
      this.detectTouchGestures(event);
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        this.touches.set(touch.identifier, touch);
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      event.preventDefault();
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        this.touches.delete(touch.identifier);
      }
      this.detectTouchGestures(event);
    };

    // Prevent context menu on canvas
    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };

    // Add listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    this.canvas.addEventListener('mousemove', onMouseMove);
    this.canvas.addEventListener('mousedown', onMouseDown);
    this.canvas.addEventListener('mouseup', onMouseUp);
    this.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    this.canvas.addEventListener('contextmenu', onContextMenu);

    // Store cleanup functions
    this.eventListeners = [
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp),
      () => this.canvas.removeEventListener('mousemove', onMouseMove),
      () => this.canvas.removeEventListener('mousedown', onMouseDown),
      () => this.canvas.removeEventListener('mouseup', onMouseUp),
      () => this.canvas.removeEventListener('touchstart', onTouchStart),
      () => this.canvas.removeEventListener('touchmove', onTouchMove),
      () => this.canvas.removeEventListener('touchend', onTouchEnd),
      () => this.canvas.removeEventListener('contextmenu', onContextMenu)
    ];
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    this.eventListeners.forEach(cleanup => cleanup());
    this.eventListeners = [];
  }

  /**
   * Check if a key code is used for game controls
   */
  private isGameKey(code: string): boolean {
    for (const binding of this.bindings.values()) {
      if (binding.keys.includes(code)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update gamepad state
   */
  private updateGamepads(): void {
    const gamepads = navigator.getGamepads();
    
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      
      if (gamepad) {
        const state: GamepadState = {
          connected: gamepad.connected,
          buttons: gamepad.buttons.map(button => button.pressed),
          axes: [...gamepad.axes],
          timestamp: gamepad.timestamp
        };
        
        // Apply deadzone to axes
        for (let j = 0; j < state.axes.length; j++) {
          if (Math.abs(state.axes[j]) < this.deadzone) {
            state.axes[j] = 0;
          }
        }
        
        this.gamepads.set(i, state);
      } else {
        this.gamepads.delete(i);
      }
    }
  }

  /**
   * Detect touch gestures
   */
  private detectTouchGestures(event: TouchEvent): void {
    const touchCount = event.touches.length;
    
    if (touchCount === 1 && event.type === 'touchend') {
      // Single finger tap
      this.touchGestures.push('tap');
    }
    
    if (touchCount === 1 && event.type === 'touchstart') {
      const touch = event.touches[0];
      const startPos = { x: touch.clientX, y: touch.clientY };
      
      // Track for swipe detection
      setTimeout(() => {
        const currentTouch = Array.from(this.touches.values())[0];
        if (currentTouch) {
          const deltaX = currentTouch.clientX - startPos.x;
          const deltaY = currentTouch.clientY - startPos.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > this.swipeMinDistance) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              this.touchGestures.push(deltaX > 0 ? 'swipe-right' : 'swipe-left');
            } else {
              this.touchGestures.push(deltaY > 0 ? 'swipe-down' : 'swipe-up');
            }
          }
        }
      }, 100);
    }
  }

  /**
   * Process input for all entities
   */
  private processInput(entities: Entity[]): void {
    // Update action states
    this.updateActionStates();
    
    // Process input for player controllers
    for (const entity of entities) {
      const controller = this.getComponent<PlayerControllerComponent>(entity, 'playerController');
      if (!controller) continue;
      
      // Update input direction
      let inputX = 0;
      let inputY = 0;
      
      if (this.isActionActive('moveLeft')) inputX -= 1;
      if (this.isActionActive('moveRight')) inputX += 1;
      
      // Gamepad input
      for (const gamepad of this.gamepads.values()) {
        if (gamepad.connected) {
          inputX += gamepad.axes[0] || 0; // Left stick X
          inputY += gamepad.axes[1] || 0; // Left stick Y
        }
      }
      
      // Normalize and apply sensitivity
      controller.inputDirection.x = Math.max(-1, Math.min(1, inputX));
      controller.inputDirection.y = Math.max(-1, Math.min(1, inputY));
      
      // Update button states
      controller.inputJump = this.isActionPressed('jump');
      controller.inputRun = this.isActionActive('run');
      controller.inputCrouch = this.isActionActive('crouch');
      controller.inputSlide = this.isActionPressed('slide');
    }
  }

  /**
   * Update action states based on input
   */
  private updateActionStates(): void {
    for (const [action, binding] of this.bindings) {
      const wasActive = this.actionStates.get(action) || false;
      let isActive = false;
      
      // Check keyboard
      for (const key of binding.keys) {
        if (this.keys.has(key)) {
          isActive = true;
          break;
        }
      }
      
      // Check gamepad buttons
      if (!isActive && binding.gamepadButtons) {
        for (const gamepad of this.gamepads.values()) {
          if (gamepad.connected) {
            for (const buttonIndex of binding.gamepadButtons) {
              if (gamepad.buttons[buttonIndex]) {
                isActive = true;
                break;
              }
            }
          }
          if (isActive) break;
        }
      }
      
      // Check touch gestures
      if (!isActive && binding.touches) {
        for (const gesture of binding.touches) {
          const gestureKey = this.getTouchGestureKey(gesture);
          if (this.touchGestures.includes(gestureKey)) {
            isActive = true;
            break;
          }
        }
      }
      
      this.actionStates.set(action, isActive);
      this.actionPressed.set(action, !wasActive && isActive);
      this.actionReleased.set(action, wasActive && !isActive);
    }
  }

  /**
   * Get touch gesture key string
   */
  private getTouchGestureKey(gesture: TouchGesture): string {
    if (gesture.type === 'tap') {
      return 'tap';
    } else if (gesture.type === 'swipe' && gesture.direction) {
      return `swipe-${gesture.direction}`;
    }
    return gesture.type;
  }

  /**
   * Clear frame-specific input states
   */
  private clearFrameInputs(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mouseButtonsPressed.clear();
    this.mouseButtonsReleased.clear();
    this.touchGestures = [];
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    
    // Clear action pressed/released states
    for (const action of this.actionPressed.keys()) {
      this.actionPressed.set(action, false);
      this.actionReleased.set(action, false);
    }
  }

  // Public input query methods

  /**
   * Check if key is currently pressed
   */
  isKeyDown(keyCode: string): boolean {
    return this.keys.has(keyCode);
  }

  /**
   * Check if key was pressed this frame
   */
  isKeyPressed(keyCode: string): boolean {
    return this.keysPressed.has(keyCode);
  }

  /**
   * Check if key was released this frame
   */
  isKeyReleased(keyCode: string): boolean {
    return this.keysReleased.has(keyCode);
  }

  /**
   * Check if mouse button is currently pressed
   */
  isMouseDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  /**
   * Check if mouse button was pressed this frame
   */
  isMousePressed(button: number): boolean {
    return this.mouseButtonsPressed.has(button);
  }

  /**
   * Check if mouse button was released this frame
   */
  isMouseReleased(button: number): boolean {
    return this.mouseButtonsReleased.has(button);
  }

  /**
   * Get mouse position
   */
  getMousePosition(): Vector2 {
    return { ...this.mousePosition };
  }

  /**
   * Get mouse delta (movement since last frame)
   */
  getMouseDelta(): Vector2 {
    return { ...this.mouseDelta };
  }

  /**
   * Check if action is currently active
   */
  isActionActive(action: string): boolean {
    return this.actionStates.get(action) || false;
  }

  /**
   * Check if action was activated this frame
   */
  isActionPressed(action: string): boolean {
    return this.actionPressed.get(action) || false;
  }

  /**
   * Check if action was deactivated this frame
   */
  isActionReleased(action: string): boolean {
    return this.actionReleased.get(action) || false;
  }

  /**
   * Get gamepad axis value
   */
  getGamepadAxis(gamepadIndex: number, axisIndex: number): number {
    const gamepad = this.gamepads.get(gamepadIndex);
    return gamepad?.axes[axisIndex] || 0;
  }

  /**
   * Check if gamepad button is pressed
   */
  isGamepadButtonDown(gamepadIndex: number, buttonIndex: number): boolean {
    const gamepad = this.gamepads.get(gamepadIndex);
    return gamepad?.buttons[buttonIndex] || false;
  }

  /**
   * Get number of active touches
   */
  getTouchCount(): number {
    return this.touches.size;
  }

  /**
   * Get touch position by identifier
   */
  getTouchPosition(touchId: number): Vector2 | null {
    const touch = this.touches.get(touchId);
    if (!touch) return null;
    
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  /**
   * Set mouse sensitivity
   */
  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = Math.max(0.1, Math.min(5.0, sensitivity));
  }

  /**
   * Set touch sensitivity
   */
  setTouchSensitivity(sensitivity: number): void {
    this.touchSensitivity = Math.max(0.1, Math.min(5.0, sensitivity));
  }

  /**
   * Set gamepad deadzone
   */
  setDeadzone(deadzone: number): void {
    this.deadzone = Math.max(0, Math.min(0.5, deadzone));
  }

  /**
   * Get input system debug info
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();
    
    return {
      ...baseInfo,
      activeKeys: Array.from(this.keys),
      mousePosition: this.mousePosition,
      touchCount: this.touches.size,
      connectedGamepads: Array.from(this.gamepads.keys()),
      activeActions: Array.from(this.actionStates.entries()).filter(([, active]) => active),
      settings: {
        mouseSensitivity: this.mouseSensitivity,
        touchSensitivity: this.touchSensitivity,
        deadzone: this.deadzone
      }
    };
  }
}