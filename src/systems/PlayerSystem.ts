import * as THREE from 'three';
import type { System, Entity, TransformComponent, Vector3 } from '@/types';
import { PlayerComponent } from '@/components/PlayerComponent';
import { InputSystem } from '@/systems/InputSystem';

export class PlayerSystem implements System {
  readonly id = 'player';
  readonly priority = 50;
  requiredComponents = ['player', 'transform'];

  private inputSystem!: InputSystem;
  private raycaster = new THREE.Raycaster();
  private terrainMeshes: THREE.Mesh[] = [];
  
  // Reusable vectors for performance
  private readonly tempVectors = {
    forward: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
    position: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    rayOrigin: new THREE.Vector3(),
    rayOriginFront: new THREE.Vector3(),
    rayOriginBack: new THREE.Vector3(),
    slideDirection: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    averageNormal: new THREE.Vector3()
  };

  private readonly tempQuaternions = {
    rotation: new THREE.Quaternion(),
    yawDelta: new THREE.Quaternion(),
    bankRotation: new THREE.Quaternion(),
    target: new THREE.Quaternion()
  };

  // Configuration optimized for mobile performance
  private config = {
    // Movement
    speedIncreaseRate: 0.8,
    maxSpeedMultiplier: 2.5,
    steeringSmoothing: 8.0,
    
    // Physics
    gravity: 25.0,
    maxFallSpeed: -30.0,
    jumpBufferTime: 150, // ms
    coyoteTime: 100, // ms - grace period for jumping after leaving ground
    
    // Terrain following
    raycastDistance: 10.0,
    raycastStrideOffset: 1.0,
    raycastOriginOffset: 0.5,
    heightOffset: 0.8,
    maxClimbableSlope: 45, // degrees
    slideSpeedFactor: 0.3,
    
    // Animation
    animationBaseSpeed: 4.0,
    maxAnimationSpeedFactor: 2.0,
    bankingFactor: 0.4,
    alignToSlopeSpeed: 2.0,
    
    // Performance
    updateFrequency: 60,
    reducedUpdateFrequency: 30,
    qualityScaling: 1.0,
    
    // Mobile optimizations
    touchSensitivityMultiplier: 1.2,
    accelerometerThreshold: 0.1,
    hapticFeedbackEnabled: true,
    batteryOptimizedMode: false
  };

  private performanceMonitor = {
    frameCount: 0,
    lastUpdate: 0,
    averageFrameTime: 16.67,
    adaptiveQuality: true
  };

  private jumpBuffer = {
    requested: false,
    timestamp: 0
  };

  private coyoteJump = {
    available: false,
    timestamp: 0
  };

  init(): void {
    this.detectMobileOptimizations();
    this.setupPerformanceMonitoring();
    console.log('PlayerSystem initialized with mobile-first optimizations');
  }

  private detectMobileOptimizations(): void {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      this.config.batteryOptimizedMode = true;
      this.config.updateFrequency = this.config.reducedUpdateFrequency;
      this.config.qualityScaling = 0.8;
      
      // Check battery level if available
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          if (battery.level < 0.2) {
            this.enableAggressiveBatteryOptimization();
          }
        });
      }
    }
  }

  private enableAggressiveBatteryOptimization(): void {
    this.config.updateFrequency = 24; // 24fps for very low battery
    this.config.qualityScaling = 0.6;
    this.config.steeringSmoothing *= 0.8; // Slightly less smooth but more performant
  }

  private setupPerformanceMonitoring(): void {
    this.performanceMonitor.lastUpdate = performance.now();
  }

  setInputSystem(inputSystem: InputSystem): void {
    this.inputSystem = inputSystem;
  }

  setTerrainMeshes(meshes: THREE.Mesh[]): void {
    this.terrainMeshes = meshes;
  }

  update(deltaTime: number, entities: Entity[]): void {
    if (!this.inputSystem) return;

    this.updatePerformanceMetrics(deltaTime);
    
    // Scale delta time for adaptive performance
    const adjustedDeltaTime = deltaTime * this.config.qualityScaling;
    
    const inputState = this.inputSystem.getInputState();
    
    entities.forEach(entity => {
      const playerComponent = entity.components.get('player') as PlayerComponent;
      const transformComponent = entity.components.get('transform') as TransformComponent;
      
      if (playerComponent && transformComponent) {
        this.updatePlayerMovement(playerComponent, transformComponent, inputState, adjustedDeltaTime);
        this.updatePlayerPhysics(playerComponent, transformComponent, adjustedDeltaTime);
        this.updatePlayerAnimation(playerComponent, adjustedDeltaTime);
        this.handleInputBuffering(playerComponent, inputState);
      }
    });
  }

  private updatePlayerMovement(
    player: PlayerComponent, 
    transform: TransformComponent, 
    inputState: any, 
    deltaTime: number
  ): void {
    // Speed progression
    player.accelerate(deltaTime);
    
    // Steering input processing
    let steeringInput = inputState.steering;
    
    // Process touch gestures for mobile
    if (inputState.gestures.length > 0) {
      const recentGestures = inputState.gestures.filter(g => 
        performance.now() - g.timestamp < 100
      );
      
      for (const gesture of recentGestures) {
        if (gesture.type === 'swipe' && gesture.direction) {
          const swipeStrength = Math.min(1.0, gesture.distance / 100);
          steeringInput += Math.sign(gesture.direction.x) * swipeStrength * this.config.touchSensitivityMultiplier;
        }
      }
    }
    
    // Apply steering with mobile-optimized smoothing
    player.applySteering(steeringInput, deltaTime);
    
    // Calculate movement direction
    this.tempQuaternions.yawDelta.setFromAxisAngle(
      this.tempVectors.up, 
      player.steering * player.steeringSpeed * deltaTime
    );
    
    // Apply rotation to transform
    this.tempQuaternions.rotation.setFromEuler(new THREE.Euler(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z
    ));
    
    this.tempQuaternions.rotation.premultiply(this.tempQuaternions.yawDelta);
    
    const euler = new THREE.Euler().setFromQuaternion(this.tempQuaternions.rotation);
    transform.rotation.x = euler.x;
    transform.rotation.y = euler.y;
    transform.rotation.z = euler.z;
    
    // Calculate forward movement
    this.tempVectors.direction.copy(this.tempVectors.forward)
      .applyQuaternion(this.tempQuaternions.rotation)
      .normalize();
    
    const moveDistance = player.currentSpeed * deltaTime;
    transform.position.x += this.tempVectors.direction.x * moveDistance;
    transform.position.z += this.tempVectors.direction.z * moveDistance;
    
    // Apply banking for visual feedback
    const bankAngle = player.steering * this.config.bankingFactor;
    this.tempQuaternions.bankRotation.setFromAxisAngle(this.tempVectors.forward, bankAngle);
    this.tempQuaternions.rotation.multiply(this.tempQuaternions.bankRotation);
    
    const bankedEuler = new THREE.Euler().setFromQuaternion(this.tempQuaternions.rotation);
    transform.rotation.x = bankedEuler.x;
    transform.rotation.y = bankedEuler.y;
    transform.rotation.z = bankedEuler.z;
  }

  private updatePlayerPhysics(
    player: PlayerComponent, 
    transform: TransformComponent, 
    deltaTime: number
  ): void {
    // Handle jumping with buffering and coyote time
    this.updateJumpMechanics(player, deltaTime);
    
    // Gravity and vertical movement
    if (!player.isGrounded) {
      player.applyGravity(deltaTime);
      transform.position.y += player.verticalVelocity * deltaTime;
    }
    
    // Terrain following with dual raycasting
    this.updateTerrainFollowing(player, transform);
    
    // Update ground state for coyote time
    if (player.isGrounded && this.coyoteJump.available) {
      this.coyoteJump.available = false;
    } else if (!player.isGrounded && !this.coyoteJump.available) {
      this.coyoteJump.available = true;
      this.coyoteJump.timestamp = performance.now();
    }
  }

  private updateJumpMechanics(player: PlayerComponent, deltaTime: number): void {
    const now = performance.now();
    
    // Check for jump buffer expiry
    if (this.jumpBuffer.requested && now - this.jumpBuffer.timestamp > this.config.jumpBufferTime) {
      this.jumpBuffer.requested = false;
    }
    
    // Check for coyote time expiry
    if (this.coyoteJump.available && now - this.coyoteJump.timestamp > this.config.coyoteTime) {
      this.coyoteJump.available = false;
    }
    
    // Process buffered jump
    if (this.jumpBuffer.requested && (player.isGrounded || this.coyoteJump.available)) {
      if (player.jump()) {
        this.jumpBuffer.requested = false;
        this.coyoteJump.available = false;
        
        // Haptic feedback for mobile
        if (this.config.hapticFeedbackEnabled && 'vibrate' in navigator) {
          navigator.vibrate([20]);
        }
      }
    }
  }

  private updateTerrainFollowing(player: PlayerComponent, transform: TransformComponent): void {
    if (this.terrainMeshes.length === 0) return;
    
    const currentPosition = transform.position;
    let highestGroundY = -Infinity;
    let groundFound = false;
    const hitNormals: THREE.Vector3[] = [];
    
    // Get movement direction for stride calculation
    this.tempQuaternions.rotation.setFromEuler(new THREE.Euler(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z
    ));
    
    this.tempVectors.direction.copy(this.tempVectors.forward)
      .applyQuaternion(this.tempQuaternions.rotation)
      .normalize();
    
    // Front raycast
    this.tempVectors.rayOriginFront.copy(currentPosition)
      .addScaledVector(this.tempVectors.direction, this.config.raycastStrideOffset);
    this.tempVectors.rayOriginFront.y += this.config.raycastOriginOffset;
    
    this.raycaster.set(this.tempVectors.rayOriginFront, this.tempVectors.down);
    const frontIntersects = this.raycaster.intersectObjects(this.terrainMeshes);
    
    if (frontIntersects.length > 0 && frontIntersects[0].distance < this.config.raycastDistance) {
      highestGroundY = Math.max(highestGroundY, frontIntersects[0].point.y);
      if (frontIntersects[0].face) {
        this.tempVectors.normal.copy(frontIntersects[0].face.normal)
          .transformDirection(frontIntersects[0].object.matrixWorld)
          .normalize();
        hitNormals.push(this.tempVectors.normal.clone());
      }
      groundFound = true;
    }
    
    // Back raycast
    this.tempVectors.rayOriginBack.copy(currentPosition)
      .addScaledVector(this.tempVectors.direction, -this.config.raycastStrideOffset);
    this.tempVectors.rayOriginBack.y += this.config.raycastOriginOffset;
    
    this.raycaster.set(this.tempVectors.rayOriginBack, this.tempVectors.down);
    const backIntersects = this.raycaster.intersectObjects(this.terrainMeshes);
    
    if (backIntersects.length > 0 && backIntersects[0].distance < this.config.raycastDistance) {
      highestGroundY = Math.max(highestGroundY, backIntersects[0].point.y);
      if (backIntersects[0].face) {
        this.tempVectors.normal.copy(backIntersects[0].face.normal)
          .transformDirection(backIntersects[0].object.matrixWorld)
          .normalize();
        hitNormals.push(this.tempVectors.normal.clone());
      }
      groundFound = true;
    }
    
    if (groundFound) {
      // Calculate average normal for slope detection
      this.tempVectors.averageNormal.set(0, 0, 0);
      hitNormals.forEach(normal => this.tempVectors.averageNormal.add(normal));
      this.tempVectors.averageNormal.divideScalar(hitNormals.length).normalize();
      
      const slopeAngle = this.tempVectors.averageNormal.angleTo(this.tempVectors.up);
      const slopeAngleDegrees = THREE.MathUtils.radToDeg(slopeAngle);
      
      player.updateSlopeDetection(slopeAngleDegrees, this.config.maxClimbableSlope);
      
      if (player.isSliding) {
        // Calculate slide direction
        this.tempVectors.slideDirection.copy(this.tempVectors.up).negate();
        const normalComponent = this.tempVectors.averageNormal.clone()
          .multiplyScalar(this.tempVectors.slideDirection.dot(this.tempVectors.averageNormal));
        this.tempVectors.slideDirection.sub(normalComponent).normalize();
        
        const slideDistance = this.config.slideSpeedFactor * player.currentSpeed * (1/60); // Assume 60fps for consistent sliding
        transform.position.x += this.tempVectors.slideDirection.x * slideDistance;
        transform.position.z += this.tempVectors.slideDirection.z * slideDistance;
      }
      
      // Set ground position
      const targetY = highestGroundY + this.config.heightOffset;
      const currentY = transform.position.y;
      
      if (Math.abs(currentY - targetY) < 2.0) { // Within reasonable distance
        player.land(targetY);
        transform.position.y = targetY;
      }
    } else {
      // No ground found, player is falling
      if (player.isGrounded && !this.coyoteJump.available) {
        this.coyoteJump.available = true;
        this.coyoteJump.timestamp = performance.now();
      }
      player.isGrounded = false;
      player.isSliding = false;
    }
  }

  private updatePlayerAnimation(player: PlayerComponent, deltaTime: number): void {
    player.updateAnimation(deltaTime);
    player.updatePerformanceMetrics(this.performanceMonitor.averageFrameTime);
  }

  private handleInputBuffering(player: PlayerComponent, inputState: any): void {
    // Handle jump input buffering
    if (inputState.jump && !this.jumpBuffer.requested) {
      this.jumpBuffer.requested = true;
      this.jumpBuffer.timestamp = performance.now();
    }
    
    // Process other buffered inputs from input system
    const recentBufferedInputs = inputState.bufferedInputs.filter((input: any) =>
      !input.processed && performance.now() - input.timestamp < this.config.jumpBufferTime
    );
    
    recentBufferedInputs.forEach((input: any) => {
      switch (input.type) {
        case 'gesture':
          this.processGestureInput(player, input.data);
          break;
        case 'touch':
          this.processTouchInput(player, input.data);
          break;
      }
      input.processed = true;
    });
  }

  private processGestureInput(player: PlayerComponent, gestureData: any): void {
    switch (gestureData.type) {
      case 'tap':
        // Quick tap for jump
        if (!this.jumpBuffer.requested) {
          this.jumpBuffer.requested = true;
          this.jumpBuffer.timestamp = performance.now();
        }
        break;
      case 'hold':
        // Hold for slide (if sliding is implemented)
        break;
      case 'swipe':
        // Swipe gestures are handled in movement update
        break;
    }
  }

  private processTouchInput(player: PlayerComponent, touchData: any): void {
    if (touchData.action === 'start') {
      // Touch start could trigger jump or other actions
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const touchX = touchData.touch.startPosition.x / rect.width;
        
        // Simple touch zones: left side for left turn, right side for right turn, center for jump
        if (touchX < 0.3) {
          // Left turn zone
        } else if (touchX > 0.7) {
          // Right turn zone
        } else {
          // Center jump zone
          if (!this.jumpBuffer.requested) {
            this.jumpBuffer.requested = true;
            this.jumpBuffer.timestamp = performance.now();
          }
        }
      }
    }
  }

  private updatePerformanceMetrics(deltaTime: number): void {
    this.performanceMonitor.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - this.performanceMonitor.lastUpdate >= 1000) {
      this.performanceMonitor.averageFrameTime = 
        (currentTime - this.performanceMonitor.lastUpdate) / this.performanceMonitor.frameCount;
      
      this.performanceMonitor.lastUpdate = currentTime;
      this.performanceMonitor.frameCount = 0;
      
      // Adaptive quality adjustment
      if (this.performanceMonitor.adaptiveQuality) {
        this.adjustQualityBasedOnPerformance();
      }
    }
  }

  private adjustQualityBasedOnPerformance(): void {
    const targetFrameTime = 1000 / this.config.updateFrequency;
    
    if (this.performanceMonitor.averageFrameTime > targetFrameTime * 1.5) {
      // Performance is poor
      this.config.qualityScaling *= 0.9;
      this.config.qualityScaling = Math.max(0.5, this.config.qualityScaling);
    } else if (this.performanceMonitor.averageFrameTime < targetFrameTime * 0.8) {
      // Performance is good
      this.config.qualityScaling *= 1.05;
      this.config.qualityScaling = Math.min(1.0, this.config.qualityScaling);
    }
  }

  // Public API for configuration
  setConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
  }

  enableBatteryOptimization(): void {
    this.config.batteryOptimizedMode = true;
    this.config.updateFrequency = this.config.reducedUpdateFrequency;
    this.config.qualityScaling = 0.7;
  }

  disableBatteryOptimization(): void {
    this.config.batteryOptimizedMode = false;
    this.config.updateFrequency = 60;
    this.config.qualityScaling = 1.0;
  }

  getPerformanceMetrics() {
    return {
      averageFrameTime: this.performanceMonitor.averageFrameTime,
      qualityScaling: this.config.qualityScaling,
      updateFrequency: this.config.updateFrequency,
      batteryOptimized: this.config.batteryOptimizedMode
    };
  }

  destroy(): void {
    // Cleanup if needed
    console.log('PlayerSystem destroyed');
  }
}