import { UIComponent, type UIComponentConfig } from '@/components/ui/base/UIComponent';
import type { TouchInput, GestureInput, InputState } from '@/types';

export interface TouchControllerConfig extends UIComponentConfig {
  showDebugZones?: boolean;
  sensitivity?: number;
  gestureThreshold?: number;
  vibrationEnabled?: boolean;
  soundEnabled?: boolean;
  onInput?: (input: InputState) => void;
  onGesture?: (gesture: GestureInput) => void;
}

/**
 * Modern Touch Controller for Mobile Gaming
 * Provides intuitive touch controls with gesture recognition and haptic feedback
 */
export class TouchController extends UIComponent {
  private config: TouchControllerConfig;
  private touchZones: Map<string, HTMLElement> = new Map();
  private activeTouches: Map<number, TouchInput> = new Map();
  private inputState: InputState;
  private gestureRecognizer: GestureRecognizer;
  private vibrationEnabled: boolean = true;
  private lastHapticTime: number = 0;

  constructor(config: TouchControllerConfig = {}) {
    super('div', {
      ...config,
      className: `touch-controller ${config.className || ''}`,
      styles: {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '100',
        ...config.styles
      }
    });

    this.config = config;
    this.vibrationEnabled = config.vibrationEnabled !== false;
    this.gestureRecognizer = new GestureRecognizer({
      threshold: config.gestureThreshold || 30,
      onGesture: this.handleGesture.bind(this)
    });

    this.inputState = {
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

    this.createTouchZones();
    this.updateVibrationCapability();
  }

  protected setupEventListeners(): void {
    // Touch events
    this.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.addEventListener('touchcancel', this.handleTouchCancel.bind(this));

    // Mouse events for desktop testing
    this.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Prevent default touch behaviors
    this.addEventListener('touchstart', (e) => e.preventDefault());
    this.addEventListener('touchmove', (e) => e.preventDefault());

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateTouchZones(), 100);
    });

    // Handle resize
    window.addEventListener('resize', () => {
      this.updateTouchZones();
    });
  }

  protected render(): void {
    // Rendering is handled by createTouchZones
  }

  private createTouchZones(): void {
    this.element.innerHTML = `
      <div class="touch-zones">
        <!-- Left steering zone -->
        <div class="touch-zone touch-zone-left" data-action="steer-left">
          ${this.config.showDebugZones ? '<span class="touch-zone-label">Left</span>' : ''}
        </div>
        
        <!-- Right steering zone -->
        <div class="touch-zone touch-zone-right" data-action="steer-right">
          ${this.config.showDebugZones ? '<span class="touch-zone-label">Right</span>' : ''}
        </div>
        
        <!-- Jump zone (bottom center) -->
        <div class="touch-zone touch-zone-jump" data-action="jump">
          ${this.config.showDebugZones ? '<span class="touch-zone-label">Jump</span>' : ''}
        </div>
        
        <!-- Slide zone (bottom, swipe down) -->
        <div class="touch-zone touch-zone-slide" data-action="slide">
          ${this.config.showDebugZones ? '<span class="touch-zone-label">Slide</span>' : ''}
        </div>
        
        <!-- Pause zone (top center) -->
        <div class="touch-zone touch-zone-pause" data-action="pause">
          ${this.config.showDebugZones ? '<span class="touch-zone-label">⏸️</span>' : ''}
        </div>
      </div>
    `;

    // Store references to touch zones
    this.element.querySelectorAll('.touch-zone').forEach(zone => {
      const action = zone.getAttribute('data-action');
      if (action) {
        this.touchZones.set(action, zone as HTMLElement);
        zone.addEventListener('pointerdown', (e) => e.stopPropagation());
      }
    });

    this.applyTouchZoneStyles();
    this.updateTouchZones();
  }

  private applyTouchZoneStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .touch-controller {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }

      .touch-zones {
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: auto;
      }

      .touch-zone {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
        transition: all var(--transition-fast);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        
        ${this.config.showDebugZones ? `
          border: 2px dashed var(--accent-primary)40;
          background: var(--accent-primary)10;
          color: var(--accent-primary);
          font-weight: 600;
          opacity: 0.7;
        ` : `
          opacity: 0;
          background: transparent;
        `}
      }

      .touch-zone.active {
        background: var(--accent-primary)20;
        border-color: var(--accent-primary)60;
        transform: scale(1.05);
        ${this.vibrationSupported() ? 'animation: hapticPulse 0.1s ease-out;' : ''}
      }

      .touch-zone-left {
        top: 20%;
        left: var(--space-md);
        width: 120px;
        height: 50%;
        z-index: 101;
      }

      .touch-zone-right {
        top: 20%;
        right: var(--space-md);
        width: 120px;
        height: 50%;
        z-index: 101;
      }

      .touch-zone-jump {
        bottom: var(--space-lg);
        left: 50%;
        transform: translateX(-50%);
        width: min(200px, 40vw);
        height: 80px;
        z-index: 102;
      }

      .touch-zone-slide {
        bottom: var(--space-lg);
        left: 50%;
        transform: translateX(-50%);
        width: min(200px, 40vw);
        height: 60px;
        margin-bottom: 90px;
        z-index: 101;
      }

      .touch-zone-pause {
        top: var(--space-md);
        right: var(--space-md);
        width: 48px;
        height: 48px;
        z-index: 103;
        border-radius: var(--radius-full);
      }

      .touch-zone-label {
        font-size: var(--font-sm);
        pointer-events: none;
      }

      @keyframes hapticPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1.05); }
      }

      /* Landscape optimizations */
      @media (orientation: landscape) {
        .touch-zone-left,
        .touch-zone-right {
          top: 15%;
          height: 60%;
          width: 100px;
        }
        
        .touch-zone-jump {
          width: min(150px, 30vw);
          height: 60px;
        }
        
        .touch-zone-slide {
          width: min(150px, 30vw);
          height: 40px;
          margin-bottom: 70px;
        }
      }

      /* Portrait optimizations */
      @media (orientation: portrait) {
        .touch-zone-left,
        .touch-zone-right {
          top: 25%;
          height: 40%;
          width: 140px;
        }
        
        .touch-zone-jump {
          width: min(250px, 50vw);
          height: 100px;
        }
      }

      /* Small screens */
      @media (max-width: 480px) {
        .touch-zone-left,
        .touch-zone-right {
          width: 90px;
        }
        
        .touch-zone-jump {
          width: min(180px, 45vw);
          height: 70px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private updateTouchZones(): void {
    // Adjust touch zones based on screen size and orientation
    const isLandscape = window.innerWidth > window.innerHeight;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Update touch zone positions dynamically if needed
    // This is already handled by CSS media queries, but can be enhanced here
  }

  private updateVibrationCapability(): void {
    this.vibrationEnabled = this.config.vibrationEnabled !== false && this.vibrationSupported();
  }

  private vibrationSupported(): boolean {
    return 'vibrate' in navigator && typeof navigator.vibrate === 'function';
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInput = this.createTouchInput(touch);
      
      this.activeTouches.set(touch.identifier, touchInput);
      this.processTouch(touchInput, 'start');
      this.gestureRecognizer.addTouch(touchInput);
    }
    
    this.updateInputState();
    this.emitInput();
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const existingTouch = this.activeTouches.get(touch.identifier);
      
      if (existingTouch) {
        this.updateTouchInput(existingTouch, touch);
        this.processTouch(existingTouch, 'move');
        this.gestureRecognizer.updateTouch(existingTouch);
      }
    }
    
    this.updateInputState();
    this.emitInput();
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInput = this.activeTouches.get(touch.identifier);
      
      if (touchInput) {
        touchInput.isActive = false;
        this.processTouch(touchInput, 'end');
        this.gestureRecognizer.removeTouch(touchInput);
        this.activeTouches.delete(touch.identifier);
      }
    }
    
    this.updateInputState();
    this.emitInput();
  }

  private handleTouchCancel(event: TouchEvent): void {
    this.handleTouchEnd(event);
  }

  // Mouse events for desktop testing
  private handleMouseDown(event: MouseEvent): void {
    const touchInput = this.createTouchInputFromMouse(event, Date.now());
    this.activeTouches.set(0, touchInput);
    this.processTouch(touchInput, 'start');
    this.updateInputState();
    this.emitInput();
  }

  private handleMouseMove(event: MouseEvent): void {
    const existingTouch = this.activeTouches.get(0);
    if (existingTouch) {
      this.updateTouchInputFromMouse(existingTouch, event);
      this.processTouch(existingTouch, 'move');
      this.updateInputState();
      this.emitInput();
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    const touchInput = this.activeTouches.get(0);
    if (touchInput) {
      touchInput.isActive = false;
      this.processTouch(touchInput, 'end');
      this.activeTouches.delete(0);
      this.updateInputState();
      this.emitInput();
    }
  }

  private handleMouseLeave(event: MouseEvent): void {
    this.handleMouseUp(event);
  }

  private createTouchInput(touch: Touch): TouchInput {
    return {
      id: touch.identifier,
      startPosition: { x: touch.clientX, y: touch.clientY },
      currentPosition: { x: touch.clientX, y: touch.clientY },
      deltaPosition: { x: 0, y: 0 },
      startTime: Date.now(),
      isActive: true,
      pressure: touch.force || 1,
      radiusX: touch.radiusX || 0,
      radiusY: touch.radiusY || 0
    };
  }

  private createTouchInputFromMouse(event: MouseEvent, id: number): TouchInput {
    return {
      id,
      startPosition: { x: event.clientX, y: event.clientY },
      currentPosition: { x: event.clientX, y: event.clientY },
      deltaPosition: { x: 0, y: 0 },
      startTime: Date.now(),
      isActive: true,
      pressure: 1,
      radiusX: 20,
      radiusY: 20
    };
  }

  private updateTouchInput(touchInput: TouchInput, touch: Touch): void {
    const prevPosition = { ...touchInput.currentPosition };
    touchInput.currentPosition = { x: touch.clientX, y: touch.clientY };
    touchInput.deltaPosition = {
      x: touchInput.currentPosition.x - prevPosition.x,
      y: touchInput.currentPosition.y - prevPosition.y
    };
    touchInput.pressure = touch.force || 1;
  }

  private updateTouchInputFromMouse(touchInput: TouchInput, event: MouseEvent): void {
    const prevPosition = { ...touchInput.currentPosition };
    touchInput.currentPosition = { x: event.clientX, y: event.clientY };
    touchInput.deltaPosition = {
      x: touchInput.currentPosition.x - prevPosition.x,
      y: touchInput.currentPosition.y - prevPosition.y
    };
  }

  private processTouch(touchInput: TouchInput, phase: 'start' | 'move' | 'end'): void {
    const zone = this.getTouchZone(touchInput.currentPosition);
    
    if (zone) {
      const action = zone.getAttribute('data-action');
      
      if (phase === 'start') {
        this.activateTouchZone(zone);
        this.triggerHaptic(action);
        this.handleTouchAction(action, touchInput, 'start');
      } else if (phase === 'move') {
        this.handleTouchAction(action, touchInput, 'move');
      } else if (phase === 'end') {
        this.deactivateTouchZone(zone);
        this.handleTouchAction(action, touchInput, 'end');
      }
    }
  }

  private getTouchZone(position: { x: number; y: number }): HTMLElement | null {
    const element = document.elementFromPoint(position.x, position.y);
    return element?.closest('.touch-zone') as HTMLElement | null;
  }

  private activateTouchZone(zone: HTMLElement): void {
    zone.classList.add('active');
  }

  private deactivateTouchZone(zone: HTMLElement): void {
    zone.classList.remove('active');
  }

  private handleTouchAction(action: string | null, touchInput: TouchInput, phase: string): void {
    if (!action) return;

    switch (action) {
      case 'steer-left':
        this.handleSteering(touchInput, -1, phase);
        break;
      case 'steer-right':
        this.handleSteering(touchInput, 1, phase);
        break;
      case 'jump':
        this.handleJump(phase);
        break;
      case 'slide':
        this.handleSlide(touchInput, phase);
        break;
      case 'pause':
        this.handlePause(phase);
        break;
    }
  }

  private handleSteering(touchInput: TouchInput, direction: number, phase: string): void {
    if (phase === 'start' || phase === 'move') {
      // Calculate steering intensity based on touch position within zone
      const sensitivity = this.config.sensitivity || 1;
      this.inputState.steering = direction * sensitivity;
      this.inputState.left = direction < 0;
      this.inputState.right = direction > 0;
    } else {
      this.inputState.steering = 0;
      this.inputState.left = false;
      this.inputState.right = false;
    }
  }

  private handleJump(phase: string): void {
    if (phase === 'start') {
      this.inputState.jump = true;
      this.addBufferedInput('jump', Date.now());
    } else if (phase === 'end') {
      this.inputState.jump = false;
    }
  }

  private handleSlide(touchInput: TouchInput, phase: string): void {
    if (phase === 'start') {
      // Check if this is a downward swipe
      const deltaY = touchInput.currentPosition.y - touchInput.startPosition.y;
      if (deltaY > 20) { // Swipe down threshold
        this.inputState.slide = true;
        this.addBufferedInput('slide', Date.now());
      }
    } else if (phase === 'end') {
      this.inputState.slide = false;
    }
  }

  private handlePause(phase: string): void {
    if (phase === 'start') {
      this.inputState.pause = true;
      this.addBufferedInput('pause', Date.now());
    } else if (phase === 'end') {
      this.inputState.pause = false;
    }
  }

  private handleGesture(gesture: GestureInput): void {
    this.inputState.gestures.push(gesture);
    
    if (this.config.onGesture) {
      this.config.onGesture(gesture);
    }

    // Handle specific gestures
    switch (gesture.type) {
      case 'swipe':
        this.handleSwipeGesture(gesture);
        break;
      case 'tap':
        this.handleTapGesture(gesture);
        break;
      case 'hold':
        this.handleHoldGesture(gesture);
        break;
    }
  }

  private handleSwipeGesture(gesture: GestureInput): void {
    if (!gesture.direction) return;

    const threshold = 0.7; // Minimum swipe intensity
    
    if (Math.abs(gesture.direction.y) > threshold) {
      if (gesture.direction.y > 0) {
        // Swipe down - slide
        this.inputState.slide = true;
        this.addBufferedInput('slide', gesture.timestamp);
        this.triggerHaptic('slide');
      } else {
        // Swipe up - jump
        this.inputState.jump = true;
        this.addBufferedInput('jump', gesture.timestamp);
        this.triggerHaptic('jump');
      }
    }
  }

  private handleTapGesture(gesture: GestureInput): void {
    // Quick tap can be jump
    this.inputState.jump = true;
    this.addBufferedInput('jump', gesture.timestamp);
    this.triggerHaptic('jump');
  }

  private handleHoldGesture(gesture: GestureInput): void {
    // Long hold might activate special abilities
    this.addBufferedInput('hold', gesture.timestamp);
  }

  private addBufferedInput(type: string, timestamp: number): void {
    this.inputState.bufferedInputs.push({
      type,
      timestamp,
      data: null,
      processed: false
    });

    // Clean up old buffered inputs
    const maxAge = 500; // 500ms buffer
    this.inputState.bufferedInputs = this.inputState.bufferedInputs.filter(
      input => timestamp - input.timestamp < maxAge
    );
  }

  private updateInputState(): void {
    // Set the primary touch if there are active touches
    const activeTouchArray = Array.from(this.activeTouches.values());
    this.inputState.touch = activeTouchArray.length > 0 ? activeTouchArray[0] : null;
  }

  private emitInput(): void {
    if (this.config.onInput) {
      this.config.onInput({ ...this.inputState });
    }
  }

  private triggerHaptic(action: string | null): void {
    if (!this.vibrationEnabled || !action) return;

    const now = Date.now();
    if (now - this.lastHapticTime < 50) return; // Throttle haptics

    this.lastHapticTime = now;

    // Different vibration patterns for different actions
    switch (action) {
      case 'jump':
        navigator.vibrate(25);
        break;
      case 'slide':
        navigator.vibrate([10, 10, 10]);
        break;
      case 'steer-left':
      case 'steer-right':
        navigator.vibrate(15);
        break;
      case 'pause':
        navigator.vibrate([20, 20, 20]);
        break;
      default:
        navigator.vibrate(10);
        break;
    }
  }

  /**
   * Get current input state
   */
  public getInputState(): InputState {
    return { ...this.inputState };
  }

  /**
   * Set touch controller sensitivity
   */
  public setSensitivity(sensitivity: number): void {
    this.config.sensitivity = Math.max(0.1, Math.min(2.0, sensitivity));
  }

  /**
   * Toggle debug zones visibility
   */
  public toggleDebugZones(): void {
    this.config.showDebugZones = !this.config.showDebugZones;
    this.createTouchZones();
  }

  /**
   * Enable/disable vibration
   */
  public setVibration(enabled: boolean): void {
    this.vibrationEnabled = enabled && this.vibrationSupported();
  }

  /**
   * Reset input state
   */
  public reset(): void {
    this.inputState = {
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
    
    this.activeTouches.clear();
    
    // Deactivate all touch zones
    this.touchZones.forEach(zone => {
      zone.classList.remove('active');
    });
  }

  public destroy(): void {
    this.reset();
    this.gestureRecognizer.destroy();
    super.destroy();
  }
}

/**
 * Simple Gesture Recognition System
 */
class GestureRecognizer {
  private touches: Map<number, TouchInput> = new Map();
  private config: {
    threshold: number;
    onGesture: (gesture: GestureInput) => void;
  };

  constructor(config: { threshold: number; onGesture: (gesture: GestureInput) => void }) {
    this.config = config;
  }

  addTouch(touch: TouchInput): void {
    this.touches.set(touch.id, touch);
  }

  updateTouch(touch: TouchInput): void {
    this.touches.set(touch.id, touch);
  }

  removeTouch(touch: TouchInput): void {
    // Process final gesture before removing
    this.processGesture(touch);
    this.touches.delete(touch.id);
  }

  private processGesture(touch: TouchInput): void {
    const duration = Date.now() - touch.startTime;
    const deltaX = touch.currentPosition.x - touch.startPosition.x;
    const deltaY = touch.currentPosition.y - touch.startPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (duration < 200 && distance < 10) {
      // Tap gesture
      this.config.onGesture({
        type: 'tap',
        position: touch.currentPosition,
        duration,
        timestamp: Date.now()
      });
    } else if (duration > 500 && distance < 20) {
      // Hold gesture
      this.config.onGesture({
        type: 'hold',
        position: touch.currentPosition,
        duration,
        timestamp: Date.now()
      });
    } else if (distance > this.config.threshold) {
      // Swipe gesture
      const direction = {
        x: deltaX / distance,
        y: deltaY / distance
      };
      
      const velocity = {
        x: deltaX / duration,
        y: deltaY / duration
      };

      this.config.onGesture({
        type: 'swipe',
        position: touch.startPosition,
        direction,
        velocity,
        distance,
        duration,
        timestamp: Date.now()
      });
    }
  }

  destroy(): void {
    this.touches.clear();
  }
}