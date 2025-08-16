import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { PlayerSystem } from '@/systems/PlayerSystem';
import { InputSystem } from '@/systems/InputSystem';
import { PlayerComponent } from '@/components/PlayerComponent';
import type { Entity, TransformComponent } from '@/types';

// Mock canvas for testing
const mockCanvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
} as unknown as HTMLCanvasElement;

// Mock navigator for mobile detection
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
});

Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn()
});

describe('PlayerSystem', () => {
  let playerSystem: PlayerSystem;
  let inputSystem: InputSystem;
  let mockEntity: Entity;
  let playerComponent: PlayerComponent;
  let transformComponent: TransformComponent;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<canvas></canvas>';
    
    playerSystem = new PlayerSystem();
    inputSystem = new InputSystem();
    
    // Create mock entity with components
    playerComponent = new PlayerComponent(1);
    transformComponent = {
      type: 'transform',
      entityId: 1,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };

    mockEntity = {
      id: 1,
      active: true,
      components: new Map([
        ['player', playerComponent],
        ['transform', transformComponent]
      ])
    };

    playerSystem.setInputSystem(inputSystem);
    playerSystem.init();
    inputSystem.init();
  });

  describe('Initialization', () => {
    it('should initialize properly', () => {
      expect(playerSystem.id).toBe('player');
      expect(playerSystem.priority).toBe(50);
      expect(playerSystem.requiredComponents).toEqual(['player', 'transform']);
    });

    it('should detect mobile optimizations', () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
      });

      const mobilePlayerSystem = new PlayerSystem();
      mobilePlayerSystem.init();
      
      const metrics = mobilePlayerSystem.getPerformanceMetrics();
      expect(metrics.batteryOptimized).toBe(true);
    });
  });

  describe('Movement Physics', () => {
    it('should accelerate player speed over time', () => {
      const initialSpeed = playerComponent.currentSpeed;
      
      playerSystem.update(0.016, [mockEntity]); // 60fps delta
      
      expect(playerComponent.currentSpeed).toBeGreaterThan(initialSpeed);
    });

    it('should apply steering input correctly', () => {
      // Mock steering input
      vi.spyOn(inputSystem, 'getInputState').mockReturnValue({
        jump: false,
        left: false,
        right: false,
        slide: false,
        pause: false,
        steering: 0.5, // Right steering
        touch: null,
        gestures: [],
        bufferedInputs: []
      });

      const initialRotation = transformComponent.rotation.y;
      
      playerSystem.update(0.016, [mockEntity]);
      
      expect(transformComponent.rotation.y).not.toBe(initialRotation);
    });

    it('should handle gravity when not grounded', () => {
      playerComponent.isGrounded = false;
      const initialVerticalVelocity = playerComponent.verticalVelocity;
      
      playerSystem.update(0.016, [mockEntity]);
      
      expect(playerComponent.verticalVelocity).toBeLessThan(initialVerticalVelocity);
    });

    it('should limit fall speed', () => {
      playerComponent.isGrounded = false;
      playerComponent.verticalVelocity = -50; // Very fast fall
      
      playerSystem.update(0.016, [mockEntity]);
      
      expect(playerComponent.verticalVelocity).toBeGreaterThan(playerComponent.maxFallSpeed);
    });
  });

  describe('Jump Mechanics', () => {
    it('should handle jump input when grounded', () => {
      playerComponent.isGrounded = true;
      
      vi.spyOn(inputSystem, 'getInputState').mockReturnValue({
        jump: true,
        left: false,
        right: false,
        slide: false,
        pause: false,
        steering: 0,
        touch: null,
        gestures: [],
        bufferedInputs: []
      });

      playerSystem.update(0.016, [mockEntity]);
      
      expect(playerComponent.verticalVelocity).toBeGreaterThan(0);
      expect(playerComponent.isGrounded).toBe(false);
    });

    it('should buffer jump input when not grounded', () => {
      playerComponent.isGrounded = false;
      
      vi.spyOn(inputSystem, 'getInputState').mockReturnValue({
        jump: true,
        left: false,
        right: false,
        slide: false,
        pause: false,
        steering: 0,
        touch: null,
        gestures: [],
        bufferedInputs: [{
          type: 'keyboard',
          timestamp: performance.now(),
          data: { code: 'Space', action: 'down' },
          processed: false
        }]
      });

      // First update should buffer the jump
      playerSystem.update(0.016, [mockEntity]);
      
      // Player should still be falling
      expect(playerComponent.isGrounded).toBe(false);
      
      // Second update with ground contact should execute buffered jump
      playerComponent.isGrounded = true;
      playerSystem.update(0.016, [mockEntity]);
      
      // Now the jump should be executed
      expect(playerComponent.verticalVelocity).toBeGreaterThan(0);
    });
  });

  describe('Touch and Gesture Input', () => {
    it('should process swipe gestures for steering', () => {
      const swipeGesture = {
        type: 'swipe' as const,
        position: { x: 100, y: 200 },
        direction: { x: 50, y: 0 }, // Right swipe
        velocity: { x: 2, y: 0 },
        distance: 50,
        duration: 100,
        timestamp: performance.now()
      };

      vi.spyOn(inputSystem, 'getInputState').mockReturnValue({
        jump: false,
        left: false,
        right: false,
        slide: false,
        pause: false,
        steering: 0,
        touch: null,
        gestures: [swipeGesture],
        bufferedInputs: []
      });

      const initialRotation = transformComponent.rotation.y;
      
      playerSystem.update(0.016, [mockEntity]);
      
      expect(transformComponent.rotation.y).not.toBe(initialRotation);
    });

    it('should handle tap gestures for jumping', () => {
      playerComponent.isGrounded = true;
      
      const tapGesture = {
        type: 'tap' as const,
        position: { x: 400, y: 300 }, // Center of screen
        duration: 50,
        timestamp: performance.now()
      };

      vi.spyOn(inputSystem, 'getInputState').mockReturnValue({
        jump: false,
        left: false,
        right: false,
        slide: false,
        pause: false,
        steering: 0,
        touch: null,
        gestures: [tapGesture],
        bufferedInputs: [{
          type: 'gesture',
          timestamp: performance.now(),
          data: tapGesture,
          processed: false
        }]
      });

      playerSystem.update(0.016, [mockEntity]);
      
      expect(playerComponent.verticalVelocity).toBeGreaterThan(0);
    });
  });

  describe('Terrain Following', () => {
    it('should follow terrain when meshes are provided', () => {
      // Create a simple ground plane
      const groundGeometry = new THREE.PlaneGeometry(100, 100);
      groundGeometry.rotateX(-Math.PI / 2); // Make it horizontal
      const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.position.y = 0;

      playerSystem.setTerrainMeshes([groundMesh]);

      // Position player above ground
      transformComponent.position.y = 5;
      playerComponent.isGrounded = false;

      playerSystem.update(0.016, [mockEntity]);

      // Player should eventually land on ground (may take multiple frames)
      for (let i = 0; i < 100; i++) {
        playerSystem.update(0.016, [mockEntity]);
        if (playerComponent.isGrounded) break;
      }

      expect(playerComponent.isGrounded).toBe(true);
      expect(transformComponent.position.y).toBeCloseTo(0.8, 1); // Ground + height offset
    });

    it('should detect slopes and sliding', () => {
      // Create a sloped plane
      const slopeGeometry = new THREE.PlaneGeometry(100, 100);
      slopeGeometry.rotateX(-Math.PI / 3); // 60 degree slope (steeper than climbable)
      const slopeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const slopeMesh = new THREE.Mesh(slopeGeometry, slopeMaterial);

      playerSystem.setTerrainMeshes([slopeMesh]);

      transformComponent.position.y = 2;
      playerComponent.isGrounded = true;

      playerSystem.update(0.016, [mockEntity]);

      expect(playerComponent.isSliding).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('should adjust quality based on performance', () => {
      const initialMetrics = playerSystem.getPerformanceMetrics();
      
      // Simulate poor performance by running many slow updates
      for (let i = 0; i < 60; i++) {
        playerSystem.update(0.033, [mockEntity]); // 30fps instead of 60fps
      }
      
      const updatedMetrics = playerSystem.getPerformanceMetrics();
      expect(updatedMetrics.qualityScaling).toBeLessThan(initialMetrics.qualityScaling);
    });

    it('should enable battery optimization', () => {
      playerSystem.enableBatteryOptimization();
      
      const metrics = playerSystem.getPerformanceMetrics();
      expect(metrics.batteryOptimized).toBe(true);
      expect(metrics.updateFrequency).toBeLessThan(60);
    });

    it('should disable battery optimization', () => {
      playerSystem.enableBatteryOptimization();
      playerSystem.disableBatteryOptimization();
      
      const metrics = playerSystem.getPerformanceMetrics();
      expect(metrics.batteryOptimized).toBe(false);
      expect(metrics.updateFrequency).toBe(60);
    });
  });

  describe('Animation', () => {
    it('should update animation based on movement speed', () => {
      const initialLimbOffset = playerComponent.limbOffset;
      
      // Accelerate to increase animation speed
      for (let i = 0; i < 60; i++) {
        playerSystem.update(0.016, [mockEntity]);
      }
      
      expect(playerComponent.limbOffset).not.toBe(initialLimbOffset);
      expect(playerComponent.animationSpeed).toBeGreaterThan(0.5);
    });

    it('should apply banking angle during turns', () => {
      vi.spyOn(inputSystem, 'getInputState').mockReturnValue({
        jump: false,
        left: false,
        right: false,
        slide: false,
        pause: false,
        steering: 0.8, // Strong right turn
        touch: null,
        gestures: [],
        bufferedInputs: []
      });

      playerSystem.update(0.016, [mockEntity]);
      
      expect(Math.abs(playerComponent.bankAngle)).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing input system gracefully', () => {
      const systemWithoutInput = new PlayerSystem();
      systemWithoutInput.init();
      
      expect(() => {
        systemWithoutInput.update(0.016, [mockEntity]);
      }).not.toThrow();
    });

    it('should handle entities without required components', () => {
      const incompleteEntity: Entity = {
        id: 2,
        active: true,
        components: new Map([['transform', transformComponent]]) // Missing player component
      };

      expect(() => {
        playerSystem.update(0.016, [incompleteEntity]);
      }).not.toThrow();
    });

    it('should handle empty terrain meshes array', () => {
      playerSystem.setTerrainMeshes([]);
      
      expect(() => {
        playerSystem.update(0.016, [mockEntity]);
      }).not.toThrow();
    });
  });
});