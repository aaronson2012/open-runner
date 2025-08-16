import * as THREE from 'three';
import type { System, Entity } from '@/types';
import { PlayerComponent } from '@/components/PlayerComponent';

export class AnimationSystem implements System {
  readonly id = 'animation';
  readonly priority = 70;
  requiredComponents = ['player', 'transform'];

  private animationMixers = new Map<number, THREE.AnimationMixer>();
  private playerAnimations = new Map<number, {
    running: THREE.AnimationAction | null;
    idle: THREE.AnimationAction | null;
    jumping: THREE.AnimationAction | null;
    landing: THREE.AnimationAction | null;
  }>();

  // Procedural animation parameters
  private proceduralConfig = {
    // Limb movement
    limbSwingSpeed: 8.0,
    limbSwingAmplitude: 0.3,
    armSwingPhaseOffset: Math.PI, // Arms opposite to legs
    
    // Body movement
    bobFrequency: 4.0,
    bobAmplitude: 0.05,
    leanAmplitude: 0.1,
    
    // Speed adaptation
    minAnimationSpeed: 0.5,
    maxAnimationSpeed: 2.5,
    speedBlendFactor: 0.8,
    
    // Mobile optimizations
    reducedBoneCount: true,
    simplifiedPhysics: true,
    adaptiveQuality: true
  };

  // Performance monitoring
  private performanceMetrics = {
    animationsActive: 0,
    bonesUpdated: 0,
    frameTime: 0,
    qualityLevel: 1.0
  };

  init(): void {
    this.detectMobileOptimizations();
    console.log('AnimationSystem initialized with procedural running animation');
  }

  private detectMobileOptimizations(): void {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Reduce animation complexity for mobile
      this.proceduralConfig.reducedBoneCount = true;
      this.proceduralConfig.simplifiedPhysics = true;
      this.performanceMetrics.qualityLevel = 0.8;
    }
  }

  update(deltaTime: number, entities: Entity[]): void {
    const startTime = performance.now();
    
    this.performanceMetrics.animationsActive = 0;
    this.performanceMetrics.bonesUpdated = 0;

    entities.forEach(entity => {
      const playerComponent = entity.components.get('player') as PlayerComponent;
      
      if (playerComponent) {
        this.updatePlayerAnimation(entity.id, playerComponent, deltaTime);
        this.performanceMetrics.animationsActive++;
      }
    });

    // Update animation mixers
    this.animationMixers.forEach((mixer, entityId) => {
      mixer.update(deltaTime);
    });

    this.performanceMetrics.frameTime = performance.now() - startTime;
    this.adaptQualityBasedOnPerformance();
  }

  private updatePlayerAnimation(
    entityId: number,
    playerComponent: PlayerComponent,
    deltaTime: number
  ): void {
    // Get or create animation data for this entity
    if (!this.playerAnimations.has(entityId)) {
      this.playerAnimations.set(entityId, {
        running: null,
        idle: null,
        jumping: null,
        landing: null
      });
    }

    // Use procedural animation since we don't have model loading yet
    this.updateProceduralAnimation(entityId, playerComponent, deltaTime);
  }

  private updateProceduralAnimation(
    entityId: number,
    playerComponent: PlayerComponent,
    deltaTime: number
  ): void {
    // Calculate animation parameters based on movement
    const speedRatio = playerComponent.getSpeedRatio();
    const isMoving = playerComponent.isMoving();
    const isTurning = playerComponent.isTurning();
    
    // Update limb offset for running cycle
    if (isMoving) {
      const animationSpeed = this.calculateAnimationSpeed(speedRatio);
      playerComponent.limbOffset += animationSpeed * this.proceduralConfig.limbSwingSpeed * deltaTime;
      
      // Keep offset in 2π range
      if (playerComponent.limbOffset > Math.PI * 2) {
        playerComponent.limbOffset -= Math.PI * 2;
      }
    }

    // Update banking angle for turns
    if (isTurning) {
      const targetBankAngle = playerComponent.steering * this.proceduralConfig.leanAmplitude;
      const bankingSpeed = 5.0 * deltaTime;
      
      playerComponent.bankAngle = THREE.MathUtils.lerp(
        playerComponent.bankAngle,
        targetBankAngle,
        bankingSpeed
      );
    } else {
      // Return to neutral position
      playerComponent.bankAngle = THREE.MathUtils.lerp(
        playerComponent.bankAngle,
        0,
        3.0 * deltaTime
      );
    }

    // Store animation state for external systems to use
    this.storeAnimationState(entityId, playerComponent);
  }

  private calculateAnimationSpeed(speedRatio: number): number {
    const baseSpeed = this.proceduralConfig.minAnimationSpeed;
    const maxSpeed = this.proceduralConfig.maxAnimationSpeed;
    
    return baseSpeed + (maxSpeed - baseSpeed) * speedRatio * this.proceduralConfig.speedBlendFactor;
  }

  private storeAnimationState(entityId: number, playerComponent: PlayerComponent): void {
    // This data can be used by rendering systems to apply animations
    const animationData = {
      limbSwing: playerComponent.limbOffset,
      limbSwingAmount: this.proceduralConfig.limbSwingAmplitude,
      bankAngle: playerComponent.bankAngle,
      bodyBob: Math.sin(playerComponent.limbOffset * this.proceduralConfig.bobFrequency) * this.proceduralConfig.bobAmplitude,
      isGrounded: playerComponent.isGrounded,
      speedRatio: playerComponent.getSpeedRatio(),
      qualityLevel: this.performanceMetrics.qualityLevel
    };

    // Store in a global animation state that rendering systems can access
    // This would typically be stored in a shared animation manager
    (window as any).playerAnimationStates = (window as any).playerAnimationStates || new Map();
    (window as any).playerAnimationStates.set(entityId, animationData);
  }

  // Procedural limb animation calculation
  calculateLimbPositions(entityId: number): {
    leftArm: THREE.Vector3;
    rightArm: THREE.Vector3;
    leftLeg: THREE.Vector3;
    rightLeg: THREE.Vector3;
    torso: THREE.Vector3;
  } {
    const animationState = (window as any).playerAnimationStates?.get(entityId);
    if (!animationState) {
      return this.getDefaultLimbPositions();
    }

    const { limbSwing, limbSwingAmount, bodyBob, bankAngle } = animationState;
    
    // Calculate limb positions using sine waves
    const leftLegSwing = Math.sin(limbSwing) * limbSwingAmount;
    const rightLegSwing = Math.sin(limbSwing + Math.PI) * limbSwingAmount;
    const leftArmSwing = Math.sin(limbSwing + this.proceduralConfig.armSwingPhaseOffset) * limbSwingAmount * 0.7;
    const rightArmSwing = Math.sin(limbSwing + this.proceduralConfig.armSwingPhaseOffset + Math.PI) * limbSwingAmount * 0.7;

    return {
      leftArm: new THREE.Vector3(leftArmSwing, 0, leftArmSwing * 0.5),
      rightArm: new THREE.Vector3(rightArmSwing, 0, rightArmSwing * 0.5),
      leftLeg: new THREE.Vector3(leftLegSwing, 0, -leftLegSwing * 0.3),
      rightLeg: new THREE.Vector3(rightLegSwing, 0, -rightLegSwing * 0.3),
      torso: new THREE.Vector3(Math.sin(bankAngle) * 0.1, bodyBob, 0)
    };
  }

  private getDefaultLimbPositions() {
    return {
      leftArm: new THREE.Vector3(0, 0, 0),
      rightArm: new THREE.Vector3(0, 0, 0),
      leftLeg: new THREE.Vector3(0, 0, 0),
      rightLeg: new THREE.Vector3(0, 0, 0),
      torso: new THREE.Vector3(0, 0, 0)
    };
  }

  // Performance optimization
  private adaptQualityBasedOnPerformance(): void {
    const targetFrameTime = 2.0; // 2ms budget for animation
    
    if (this.performanceMetrics.frameTime > targetFrameTime) {
      // Reduce quality
      this.performanceMetrics.qualityLevel *= 0.95;
      this.performanceMetrics.qualityLevel = Math.max(0.3, this.performanceMetrics.qualityLevel);
      
      // Adjust animation parameters
      if (this.performanceMetrics.qualityLevel < 0.7) {
        this.proceduralConfig.reducedBoneCount = true;
        this.proceduralConfig.simplifiedPhysics = true;
      }
    } else if (this.performanceMetrics.frameTime < targetFrameTime * 0.5) {
      // Increase quality
      this.performanceMetrics.qualityLevel *= 1.02;
      this.performanceMetrics.qualityLevel = Math.min(1.0, this.performanceMetrics.qualityLevel);
    }
  }

  // Animation mixer management for when we have actual 3D models
  addAnimationMixer(entityId: number, mixer: THREE.AnimationMixer): void {
    this.animationMixers.set(entityId, mixer);
  }

  removeAnimationMixer(entityId: number): void {
    const mixer = this.animationMixers.get(entityId);
    if (mixer) {
      mixer.stopAllAction();
    }
    this.animationMixers.delete(entityId);
    this.playerAnimations.delete(entityId);
  }

  // Configuration
  setConfig(newConfig: Partial<typeof this.proceduralConfig>): void {
    this.proceduralConfig = { ...this.proceduralConfig, ...newConfig };
  }

  enableBatteryOptimization(): void {
    this.proceduralConfig.reducedBoneCount = true;
    this.proceduralConfig.simplifiedPhysics = true;
    this.performanceMetrics.qualityLevel = 0.6;
  }

  disableBatteryOptimization(): void {
    this.proceduralConfig.reducedBoneCount = false;
    this.proceduralConfig.simplifiedPhysics = false;
    this.performanceMetrics.qualityLevel = 1.0;
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  destroy(): void {
    // Clean up all animation mixers
    this.animationMixers.forEach(mixer => {
      mixer.stopAllAction();
    });
    
    this.animationMixers.clear();
    this.playerAnimations.clear();
    
    // Clear global animation state
    if ((window as any).playerAnimationStates) {
      (window as any).playerAnimationStates.clear();
    }
    
    console.log('AnimationSystem destroyed');
  }
}