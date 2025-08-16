import type { Vector2, TouchInput, GestureInput } from '@/types';

export class MobileInputHandler {
  private touchZones: Map<string, TouchZone> = new Map();
  private activeGestures: Map<number, GestureRecognizer> = new Map();
  private hapticEnabled = true;
  private canvas!: HTMLCanvasElement;

  // Touch zone configuration
  private zoneConfig = {
    jumpZone: { x: 0.3, y: 0.0, width: 0.4, height: 1.0 }, // Center for jumping
    leftSteerZone: { x: 0.0, y: 0.0, width: 0.3, height: 1.0 }, // Left side for steering
    rightSteerZone: { x: 0.7, y: 0.0, width: 0.3, height: 1.0 }, // Right side for steering
    slideZone: { x: 0.0, y: 0.8, width: 1.0, height: 0.2 } // Bottom for sliding
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initializeTouchZones();
    this.setupEventListeners();
  }

  private initializeTouchZones(): void {
    // Create visual touch zones (optional, for debug)
    Object.entries(this.zoneConfig).forEach(([name, config]) => {
      this.touchZones.set(name, {
        name,
        bounds: config,
        active: false,
        lastTouch: null
      });
    });
  }

  private setupEventListeners(): void {
    // Prevent default touch behaviors
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

    // Prevent context menu on long press
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Prevent scrolling and zooming
    document.addEventListener('touchmove', (e) => {
      if (e.target === this.canvas) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const position = this.getTouchPosition(touch);
      const zone = this.getZoneForPosition(position);
      
      // Create gesture recognizer for this touch
      const gestureRecognizer = new GestureRecognizer(touch.identifier, position);
      this.activeGestures.set(touch.identifier, gestureRecognizer);
      
      // Handle zone-specific touch start
      if (zone) {
        this.handleZoneTouchStart(zone, position, touch.identifier);
      }
      
      // Trigger haptic feedback
      this.triggerHapticFeedback('light');
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const position = this.getTouchPosition(touch);
      const gestureRecognizer = this.activeGestures.get(touch.identifier);
      
      if (gestureRecognizer) {
        gestureRecognizer.updatePosition(position);
        
        // Check for zone changes
        const currentZone = this.getZoneForPosition(position);
        this.handleZoneTouchMove(currentZone, position, touch.identifier);
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const gestureRecognizer = this.activeGestures.get(touch.identifier);
      
      if (gestureRecognizer) {
        const gesture = gestureRecognizer.finalize();
        this.processGesture(gesture);
        
        // Handle zone-specific touch end
        const zone = this.getZoneForPosition(gestureRecognizer.getCurrentPosition());
        if (zone) {
          this.handleZoneTouchEnd(zone, touch.identifier);
        }
        
        this.activeGestures.delete(touch.identifier);
      }
    }
    
    // Reset all zones
    this.touchZones.forEach(zone => {
      zone.active = false;
      zone.lastTouch = null;
    });
  }

  private handleTouchCancel(event: TouchEvent): void {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeGestures.delete(touch.identifier);
    }
    
    // Reset all zones
    this.touchZones.forEach(zone => {
      zone.active = false;
      zone.lastTouch = null;
    });
  }

  private getTouchPosition(touch: Touch): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height
    };
  }

  private getZoneForPosition(position: Vector2): TouchZone | null {
    for (const zone of this.touchZones.values()) {
      if (this.isPositionInZone(position, zone.bounds)) {
        return zone;
      }
    }
    return null;
  }

  private isPositionInZone(position: Vector2, bounds: ZoneBounds): boolean {
    return position.x >= bounds.x &&
           position.x <= bounds.x + bounds.width &&
           position.y >= bounds.y &&
           position.y <= bounds.y + bounds.height;
  }

  private handleZoneTouchStart(zone: TouchZone, position: Vector2, touchId: number): void {
    zone.active = true;
    zone.lastTouch = { position, touchId, timestamp: performance.now() };
    
    // Zone-specific actions
    switch (zone.name) {
      case 'jumpZone':
        this.dispatchCustomEvent('zone-jump-start', { position, touchId });
        break;
      case 'leftSteerZone':
        this.dispatchCustomEvent('zone-steer-start', { direction: 'left', position, touchId });
        break;
      case 'rightSteerZone':
        this.dispatchCustomEvent('zone-steer-start', { direction: 'right', position, touchId });
        break;
      case 'slideZone':
        this.dispatchCustomEvent('zone-slide-start', { position, touchId });
        this.triggerHapticFeedback('medium');
        break;
    }
  }

  private handleZoneTouchMove(zone: TouchZone | null, position: Vector2, touchId: number): void {
    // Handle steering based on movement within zones
    if (zone && (zone.name === 'leftSteerZone' || zone.name === 'rightSteerZone')) {
      const intensity = this.calculateSteeringIntensity(position, zone.bounds);
      this.dispatchCustomEvent('zone-steer-update', {
        direction: zone.name === 'leftSteerZone' ? 'left' : 'right',
        intensity,
        position,
        touchId
      });
    }
  }

  private handleZoneTouchEnd(zone: TouchZone, touchId: number): void {
    if (!zone.lastTouch) return;
    
    const duration = performance.now() - zone.lastTouch.timestamp;
    
    switch (zone.name) {
      case 'jumpZone':
        this.dispatchCustomEvent('zone-jump-end', { duration, touchId });
        break;
      case 'leftSteerZone':
      case 'rightSteerZone':
        this.dispatchCustomEvent('zone-steer-end', { 
          direction: zone.name === 'leftSteerZone' ? 'left' : 'right',
          duration,
          touchId
        });
        break;
      case 'slideZone':
        this.dispatchCustomEvent('zone-slide-end', { duration, touchId });
        break;
    }
  }

  private calculateSteeringIntensity(position: Vector2, bounds: ZoneBounds): number {
    // Calculate intensity based on how far from center of zone
    const centerX = bounds.x + bounds.width / 2;
    const distanceFromCenter = Math.abs(position.x - centerX);
    const maxDistance = bounds.width / 2;
    
    return Math.min(1.0, distanceFromCenter / maxDistance);
  }

  private processGesture(gesture: GestureInput): void {
    // Dispatch gesture events for the input system to handle
    this.dispatchCustomEvent('mobile-gesture', gesture);
    
    // Provide haptic feedback based on gesture type
    switch (gesture.type) {
      case 'tap':
        this.triggerHapticFeedback('light');
        break;
      case 'swipe':
        this.triggerHapticFeedback('medium');
        break;
      case 'hold':
        this.triggerHapticFeedback('heavy');
        break;
    }
  }

  private dispatchCustomEvent(type: string, detail: any): void {
    const event = new CustomEvent(type, { detail });
    this.canvas.dispatchEvent(event);
  }

  private triggerHapticFeedback(intensity: 'light' | 'medium' | 'heavy'): void {
    if (!this.hapticEnabled || !('vibrate' in navigator)) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };
    
    navigator.vibrate(patterns[intensity]);
  }

  // Visual feedback for touch zones (optional, for debug/tutorial)
  createVisualZones(): void {
    const overlay = document.createElement('div');
    overlay.id = 'touch-zones-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.3;
    `;
    
    Object.entries(this.zoneConfig).forEach(([name, config]) => {
      const zone = document.createElement('div');
      zone.className = `touch-zone touch-zone-${name}`;
      zone.style.cssText = `
        position: absolute;
        left: ${config.x * 100}%;
        top: ${config.y * 100}%;
        width: ${config.width * 100}%;
        height: ${config.height * 100}%;
        border: 2px solid rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: white;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      `;
      zone.textContent = name.replace('Zone', '').toUpperCase();
      overlay.appendChild(zone);
    });
    
    document.body.appendChild(overlay);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }, 3000);
  }

  // Configuration
  setHapticEnabled(enabled: boolean): void {
    this.hapticEnabled = enabled;
  }

  updateZoneConfig(zoneName: string, newBounds: Partial<ZoneBounds>): void {
    if (this.zoneConfig[zoneName as keyof typeof this.zoneConfig]) {
      this.zoneConfig[zoneName as keyof typeof this.zoneConfig] = {
        ...this.zoneConfig[zoneName as keyof typeof this.zoneConfig],
        ...newBounds
      };
      
      // Update touch zone
      const zone = this.touchZones.get(zoneName);
      if (zone) {
        zone.bounds = this.zoneConfig[zoneName as keyof typeof this.zoneConfig];
      }
    }
  }

  // Get current touch state for external systems
  getActiveTouches(): Map<number, GestureRecognizer> {
    return new Map(this.activeGestures);
  }

  getActiveZones(): TouchZone[] {
    return Array.from(this.touchZones.values()).filter(zone => zone.active);
  }

  destroy(): void {
    // Remove event listeners
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
    
    // Clear state
    this.activeGestures.clear();
    this.touchZones.clear();
    
    // Remove visual overlay if it exists
    const overlay = document.getElementById('touch-zones-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
}

// Gesture recognition class
class GestureRecognizer {
  private startPosition: Vector2;
  private currentPosition: Vector2;
  private startTime: number;
  private id: number;
  private moveHistory: Array<{ position: Vector2; timestamp: number }> = [];

  constructor(id: number, startPosition: Vector2) {
    this.id = id;
    this.startPosition = { ...startPosition };
    this.currentPosition = { ...startPosition };
    this.startTime = performance.now();
    this.moveHistory = [{ position: { ...startPosition }, timestamp: this.startTime }];
  }

  updatePosition(position: Vector2): void {
    this.currentPosition = { ...position };
    this.moveHistory.push({ position: { ...position }, timestamp: performance.now() });
    
    // Keep only recent history for performance
    if (this.moveHistory.length > 10) {
      this.moveHistory.shift();
    }
  }

  getCurrentPosition(): Vector2 {
    return { ...this.currentPosition };
  }

  finalize(): GestureInput {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    const distance = this.calculateDistance();
    
    // Determine gesture type
    if (duration < 150 && distance < 30) {
      return this.createTapGesture(duration);
    } else if (duration > 500 && distance < 30) {
      return this.createHoldGesture(duration);
    } else if (distance > 30) {
      return this.createSwipeGesture(duration, distance);
    } else {
      return this.createPanGesture(duration, distance);
    }
  }

  private calculateDistance(): number {
    const dx = this.currentPosition.x - this.startPosition.x;
    const dy = this.currentPosition.y - this.startPosition.y;
    return Math.sqrt(dx * dx + dy * dy) * 1000; // Scale to pixels (assuming 1000px reference)
  }

  private calculateVelocity(): Vector2 {
    if (this.moveHistory.length < 2) {
      return { x: 0, y: 0 };
    }
    
    const recent = this.moveHistory.slice(-3); // Use last 3 points for velocity
    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeDelta = last.timestamp - first.timestamp;
    
    if (timeDelta === 0) {
      return { x: 0, y: 0 };
    }
    
    return {
      x: (last.position.x - first.position.x) / timeDelta * 1000,
      y: (last.position.y - first.position.y) / timeDelta * 1000
    };
  }

  private createTapGesture(duration: number): GestureInput {
    return {
      type: 'tap',
      position: this.startPosition,
      duration,
      timestamp: this.startTime
    };
  }

  private createHoldGesture(duration: number): GestureInput {
    return {
      type: 'hold',
      position: this.startPosition,
      duration,
      timestamp: this.startTime
    };
  }

  private createSwipeGesture(duration: number, distance: number): GestureInput {
    const direction = {
      x: this.currentPosition.x - this.startPosition.x,
      y: this.currentPosition.y - this.startPosition.y
    };
    
    return {
      type: 'swipe',
      position: this.startPosition,
      direction,
      velocity: this.calculateVelocity(),
      distance,
      duration,
      timestamp: this.startTime
    };
  }

  private createPanGesture(duration: number, distance: number): GestureInput {
    const direction = {
      x: this.currentPosition.x - this.startPosition.x,
      y: this.currentPosition.y - this.startPosition.y
    };
    
    return {
      type: 'pan',
      position: this.startPosition,
      direction,
      velocity: this.calculateVelocity(),
      distance,
      duration,
      timestamp: this.startTime
    };
  }
}

// Type definitions
interface TouchZone {
  name: string;
  bounds: ZoneBounds;
  active: boolean;
  lastTouch: {
    position: Vector2;
    touchId: number;
    timestamp: number;
  } | null;
}

interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}