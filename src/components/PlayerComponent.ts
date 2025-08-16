import type { Component, PlayerComponent as PlayerComponentType } from '@/types';

export class PlayerComponent implements PlayerComponentType {
  readonly type = 'player' as const;
  entityId: number;

  // Movement Physics
  speed: number;
  currentSpeed: number;
  maxSpeed: number;
  acceleration: number;
  steering: number;
  steeringSpeed: number;

  // Jump & Gravity
  jumpForce: number;
  verticalVelocity: number;
  gravity: number;
  maxFallSpeed: number;

  // Ground Detection
  isGrounded: boolean;
  groundDistance: number;
  slopeAngle: number;
  canClimbSlope: boolean;
  isSliding: boolean;

  // Animation
  animationSpeed: number;
  limbOffset: number;
  bankAngle: number;

  // Game State
  health: number;
  score: number;
  powerUps: string[];

  // Mobile Optimizations
  inputSensitivity: number;
  adaptiveQuality: boolean;
  batteryOptimized: boolean;

  // Performance tracking
  private lastUpdateTime: number = 0;
  private frameCount: number = 0;
  private performanceMetrics = {
    averageFrameTime: 16.67, // Target 60fps
    updateFrequency: 60,
    adaptiveQualityLevel: 1.0
  };

  constructor(entityId: number, config?: Partial<PlayerComponentType>) {
    this.entityId = entityId;

    // Initialize with mobile-optimized defaults
    this.speed = config?.speed ?? 8.0;
    this.currentSpeed = config?.currentSpeed ?? this.speed;
    this.maxSpeed = config?.maxSpeed ?? 25.0;
    this.acceleration = config?.acceleration ?? 0.5;
    this.steering = config?.steering ?? 0.0;
    this.steeringSpeed = config?.steeringSpeed ?? 3.0;

    this.jumpForce = config?.jumpForce ?? 12.0;
    this.verticalVelocity = config?.verticalVelocity ?? 0.0;
    this.gravity = config?.gravity ?? 25.0;
    this.maxFallSpeed = config?.maxFallSpeed ?? -30.0;

    this.isGrounded = config?.isGrounded ?? true;
    this.groundDistance = config?.groundDistance ?? 0.0;
    this.slopeAngle = config?.slopeAngle ?? 0.0;
    this.canClimbSlope = config?.canClimbSlope ?? true;
    this.isSliding = config?.isSliding ?? false;

    this.animationSpeed = config?.animationSpeed ?? 1.0;
    this.limbOffset = config?.limbOffset ?? 0.0;
    this.bankAngle = config?.bankAngle ?? 0.0;

    this.health = config?.health ?? 100;
    this.score = config?.score ?? 0;
    this.powerUps = config?.powerUps ?? [];

    // Mobile-specific settings
    this.inputSensitivity = config?.inputSensitivity ?? this.detectOptimalSensitivity();
    this.adaptiveQuality = config?.adaptiveQuality ?? true;
    this.batteryOptimized = config?.batteryOptimized ?? this.detectBatteryOptimization();

    this.initializePerformanceMonitoring();
  }

  private detectOptimalSensitivity(): number {
    // Detect device type and optimize sensitivity
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth > 768;
    
    if (isMobile && !isTablet) {
      return 1.2; // Higher sensitivity for phones
    } else if (isTablet) {
      return 1.0; // Standard sensitivity for tablets
    } else {
      return 0.8; // Lower sensitivity for desktop
    }
  }

  private detectBatteryOptimization(): boolean {
    // Enable battery optimization on mobile devices or when battery is low
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile && 'getBattery' in navigator) {
      // Check battery level if available
      (navigator as any).getBattery().then((battery: any) => {
        if (battery.level < 0.2) { // Less than 20% battery
          this.batteryOptimized = true;
          this.adaptPerformanceForBattery();
        }
      });
    }
    
    return isMobile;
  }

  private initializePerformanceMonitoring(): void {
    this.lastUpdateTime = performance.now();
  }

  private adaptPerformanceForBattery(): void {
    if (this.batteryOptimized) {
      // Reduce update frequency and quality for battery saving
      this.performanceMetrics.updateFrequency = 30; // 30fps for battery saving
      this.performanceMetrics.adaptiveQualityLevel = 0.7; // Reduce quality
      this.maxSpeed *= 0.9; // Slightly reduce max speed for smoother performance
    }
  }

  // Movement methods
  accelerate(deltaTime: number): void {
    if (this.currentSpeed < this.maxSpeed) {
      this.currentSpeed += this.acceleration * deltaTime;
      this.currentSpeed = Math.min(this.currentSpeed, this.maxSpeed);
    }
  }

  decelerate(deltaTime: number, factor: number = 1.0): void {
    if (this.currentSpeed > this.speed) {
      this.currentSpeed -= this.acceleration * factor * deltaTime;
      this.currentSpeed = Math.max(this.currentSpeed, this.speed);
    }
  }

  applySteering(steeringInput: number, deltaTime: number): void {
    // Smooth steering with mobile-optimized responsiveness
    const targetSteering = steeringInput * this.inputSensitivity;
    const steeringDelta = (targetSteering - this.steering) * this.steeringSpeed * deltaTime;
    
    this.steering += steeringDelta;
    this.steering = Math.max(-1, Math.min(1, this.steering));
    
    // Calculate banking angle for visual feedback
    this.bankAngle = this.steering * 0.3; // Max 0.3 radians (about 17 degrees)
  }

  jump(): boolean {
    if (this.isGrounded) {
      this.verticalVelocity = this.jumpForce;
      this.isGrounded = false;
      return true;
    }
    return false;
  }

  applyGravity(deltaTime: number): void {
    if (!this.isGrounded) {
      this.verticalVelocity -= this.gravity * deltaTime;
      this.verticalVelocity = Math.max(this.verticalVelocity, this.maxFallSpeed);
    }
  }

  land(groundY: number): void {
    this.isGrounded = true;
    this.verticalVelocity = 0;
    this.groundDistance = 0;
  }

  // Animation methods
  updateAnimation(deltaTime: number): void {
    // Update animation speed based on movement
    const speedFactor = this.currentSpeed / this.maxSpeed;
    this.animationSpeed = 0.5 + speedFactor * 1.5; // Range from 0.5 to 2.0
    
    // Update limb offset for running animation
    this.limbOffset += this.animationSpeed * deltaTime * 8.0; // 8 cycles per second
    if (this.limbOffset > Math.PI * 2) {
      this.limbOffset -= Math.PI * 2;
    }
  }

  // Slope handling
  updateSlopeDetection(slopeAngle: number, maxClimbableAngle: number = 45): void {
    this.slopeAngle = slopeAngle;
    this.canClimbSlope = Math.abs(slopeAngle) <= maxClimbableAngle;
    
    if (!this.canClimbSlope && this.isGrounded) {
      this.isSliding = true;
    } else {
      this.isSliding = false;
    }
  }

  // Power-up system
  addPowerUp(powerUpType: string, duration?: number): void {
    this.powerUps.push(powerUpType);
    
    // Apply power-up effects
    switch (powerUpType) {
      case 'speed_boost':
        this.maxSpeed *= 1.5;
        if (duration) {
          setTimeout(() => this.removePowerUp(powerUpType), duration);
        }
        break;
      case 'high_jump':
        this.jumpForce *= 1.3;
        if (duration) {
          setTimeout(() => this.removePowerUp(powerUpType), duration);
        }
        break;
      case 'shield':
        // Shield effect would be handled by other systems
        if (duration) {
          setTimeout(() => this.removePowerUp(powerUpType), duration);
        }
        break;
    }
  }

  removePowerUp(powerUpType: string): void {
    const index = this.powerUps.indexOf(powerUpType);
    if (index > -1) {
      this.powerUps.splice(index, 1);
      
      // Remove power-up effects (restore defaults)
      switch (powerUpType) {
        case 'speed_boost':
          this.maxSpeed = 25.0; // Reset to default
          break;
        case 'high_jump':
          this.jumpForce = 12.0; // Reset to default
          break;
      }
    }
  }

  // Health and damage
  takeDamage(damage: number): boolean {
    this.health -= damage;
    this.health = Math.max(0, this.health);
    return this.health <= 0; // Returns true if player died
  }

  heal(amount: number): void {
    this.health += amount;
    this.health = Math.min(100, this.health); // Cap at 100
  }

  // Score system
  addScore(points: number): void {
    this.score += points;
  }

  // Performance monitoring and adaptive quality
  updatePerformanceMetrics(frameTime: number): void {
    this.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - this.lastUpdateTime >= 1000) { // Update every second
      this.performanceMetrics.averageFrameTime = (currentTime - this.lastUpdateTime) / this.frameCount;
      this.lastUpdateTime = currentTime;
      this.frameCount = 0;
      
      if (this.adaptiveQuality) {
        this.adjustQualityBasedOnPerformance();
      }
    }
  }

  private adjustQualityBasedOnPerformance(): void {
    const targetFrameTime = 1000 / this.performanceMetrics.updateFrequency;
    
    if (this.performanceMetrics.averageFrameTime > targetFrameTime * 1.5) {
      // Performance is poor, reduce quality
      this.performanceMetrics.adaptiveQualityLevel *= 0.9;
      this.performanceMetrics.adaptiveQualityLevel = Math.max(0.5, this.performanceMetrics.adaptiveQualityLevel);
    } else if (this.performanceMetrics.averageFrameTime < targetFrameTime * 0.8) {
      // Performance is good, increase quality
      this.performanceMetrics.adaptiveQualityLevel *= 1.1;
      this.performanceMetrics.adaptiveQualityLevel = Math.min(1.0, this.performanceMetrics.adaptiveQualityLevel);
    }
  }

  // Mobile-specific methods
  enableBatteryOptimization(): void {
    this.batteryOptimized = true;
    this.adaptPerformanceForBattery();
  }

  disableBatteryOptimization(): void {
    this.batteryOptimized = false;
    this.performanceMetrics.updateFrequency = 60;
    this.performanceMetrics.adaptiveQualityLevel = 1.0;
  }

  adjustInputSensitivity(sensitivity: number): void {
    this.inputSensitivity = Math.max(0.1, Math.min(2.0, sensitivity));
  }

  // Getters for external systems
  getSpeedRatio(): number {
    return this.currentSpeed / this.maxSpeed;
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  isMoving(): boolean {
    return this.currentSpeed > 0.1;
  }

  isTurning(): boolean {
    return Math.abs(this.steering) > 0.1;
  }

  hasActivePowerUps(): boolean {
    return this.powerUps.length > 0;
  }

  // Serialization for save/load
  serialize() {
    return {
      speed: this.speed,
      currentSpeed: this.currentSpeed,
      maxSpeed: this.maxSpeed,
      health: this.health,
      score: this.score,
      powerUps: [...this.powerUps],
      inputSensitivity: this.inputSensitivity,
      batteryOptimized: this.batteryOptimized
    };
  }

  deserialize(data: any): void {
    Object.assign(this, data);
  }
}