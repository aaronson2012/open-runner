import * as THREE from 'three';
import { World } from '@/core/ecs/World';
import { Game } from '@/core/game/Game';
import { InputSystem } from '@/systems/InputSystem';
import { PlayerSystem } from '@/systems/PlayerSystem';
import { AnimationSystem } from '@/systems/AnimationSystem';
import { PlayerComponent } from '@/components/PlayerComponent';
import type { TransformComponent, GameConfig } from '@/types';

/**
 * Demo showing the modern player controller system in action
 * This demonstrates mobile-first design with touch controls, haptic feedback,
 * and 60fps optimized performance
 */
export class PlayerSystemDemo {
  private game!: Game;
  private world!: World;
  private inputSystem!: InputSystem;
  private playerSystem!: PlayerSystem;
  private animationSystem!: AnimationSystem;
  
  private playerEntity!: number;
  private playerMesh!: THREE.Mesh;
  private terrainMeshes: THREE.Mesh[] = [];
  
  private demoUI = {
    performancePanel: null as HTMLElement | null,
    controlsPanel: null as HTMLElement | null,
    debugPanel: null as HTMLElement | null
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Setup canvas
    const canvas = this.createCanvas();
    
    // Initialize game with mobile-optimized config
    const config: GameConfig = {
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: Math.min(window.devicePixelRatio, 2), // Limit for performance
      enableWebGPU: false, // Stick to WebGL for compatibility
      targetFPS: 60,
      enableDebug: true
    };

    this.game = new Game(config);
    this.world = this.game.getWorld();
    
    // Wait for game to initialize
    await this.waitForGameReady();
    
    // Setup systems
    this.setupSystems();
    
    // Create demo scene
    this.createDemoScene();
    
    // Setup UI
    this.setupDemoUI();
    
    // Start the demo
    this.start();
    
    console.log('PlayerSystemDemo initialized successfully');
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.style.cssText = `
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      user-select: none;
      background: linear-gradient(to bottom, #87CEEB 0%, #98FB98 100%);
    `;
    
    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    document.body.appendChild(canvas);
    return canvas;
  }

  private async waitForGameReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.game.isReady()) {
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });
  }

  private setupSystems(): void {
    // Initialize systems
    this.inputSystem = new InputSystem();
    this.playerSystem = new PlayerSystem();
    this.animationSystem = new AnimationSystem();
    
    // Configure player system with input system
    this.playerSystem.setInputSystem(this.inputSystem);
    
    // Add systems to world (order matters for priority)
    this.world.addSystem(this.inputSystem);
    this.world.addSystem(this.playerSystem);
    this.world.addSystem(this.animationSystem);
    
    console.log('Systems initialized:', {
      input: this.inputSystem.id,
      player: this.playerSystem.id,
      animation: this.animationSystem.id
    });
  }

  private createDemoScene(): void {
    const scene = this.game.getScene();
    
    // Create terrain for testing terrain following
    this.createTerrain();
    
    // Create player entity
    this.createPlayer();
    
    // Setup camera to follow player
    this.setupCamera();
    
    // Add some environmental elements
    this.addEnvironmentalElements();
  }

  private createTerrain(): void {
    const terrainGroup = new THREE.Group();
    terrainGroup.name = 'terrain';
    
    // Create main ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    
    // Add some height variation
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 + 
                Math.sin(x * 0.05) * 3 + 
                Math.random() * 0.5;
      positions.setY(i, y);
    }
    groundGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x3e7b27,
      wireframe: false 
    });
    
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotateX(-Math.PI / 2);
    groundMesh.receiveShadow = true;
    
    terrainGroup.add(groundMesh);
    this.terrainMeshes.push(groundMesh);
    
    // Create some hills and slopes for testing
    for (let i = 0; i < 5; i++) {
      const hillGeometry = new THREE.ConeGeometry(
        5 + Math.random() * 5, 
        3 + Math.random() * 4, 
        8
      );
      const hillMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x4a5c3a 
      });
      const hill = new THREE.Mesh(hillGeometry, hillMaterial);
      
      hill.position.set(
        (Math.random() - 0.5) * 100,
        0,
        (Math.random() - 0.5) * 100
      );
      hill.receiveShadow = true;
      hill.castShadow = true;
      
      terrainGroup.add(hill);
      this.terrainMeshes.push(hill);
    }
    
    // Create a steep slope for testing sliding
    const slopeGeometry = new THREE.PlaneGeometry(20, 20);
    const slopeMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const slope = new THREE.Mesh(slopeGeometry, slopeMaterial);
    slope.rotateX(-Math.PI / 3); // 60 degree slope
    slope.position.set(30, 5, 0);
    slope.receiveShadow = true;
    
    terrainGroup.add(slope);
    this.terrainMeshes.push(slope);
    
    this.game.getScene().add(terrainGroup);
    this.playerSystem.setTerrainMeshes(this.terrainMeshes);
  }

  private createPlayer(): void {
    // Create player entity
    this.playerEntity = this.world.createEntity();
    
    // Add player component with mobile-optimized settings
    const playerComponent = new PlayerComponent(this.playerEntity, {
      speed: 8.0,
      maxSpeed: 20.0,
      acceleration: 0.6,
      jumpForce: 15.0,
      inputSensitivity: 1.2, // Higher for mobile
      adaptiveQuality: true,
      batteryOptimized: false // Start with full quality
    });
    
    this.world.addComponent(this.playerEntity, playerComponent);
    
    // Add transform component
    const transformComponent: TransformComponent = {
      type: 'transform',
      entityId: this.playerEntity,
      position: { x: 0, y: 5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };
    
    this.world.addComponent(this.playerEntity, transformComponent);
    
    // Create visual representation
    this.createPlayerMesh();
    
    console.log('Player entity created:', this.playerEntity);
  }

  private createPlayerMesh(): void {
    // Create a simple capsule for the player
    const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4444ff });
    this.playerMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.playerMesh.castShadow = true;
    this.playerMesh.receiveShadow = true;
    
    // Add simple limbs for animation demonstration
    const limbGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8);
    const limbMaterial = new THREE.MeshLambertMaterial({ color: 0x6666ff });
    
    // Arms
    const leftArm = new THREE.Mesh(limbGeometry, limbMaterial);
    leftArm.position.set(-0.6, 0.3, 0);
    leftArm.name = 'leftArm';
    this.playerMesh.add(leftArm);
    
    const rightArm = new THREE.Mesh(limbGeometry, limbMaterial);
    rightArm.position.set(0.6, 0.3, 0);
    rightArm.name = 'rightArm';
    this.playerMesh.add(rightArm);
    
    // Legs
    const leftLeg = new THREE.Mesh(limbGeometry, limbMaterial);
    leftLeg.position.set(-0.3, -1.2, 0);
    leftLeg.name = 'leftLeg';
    this.playerMesh.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(limbGeometry, limbMaterial);
    rightLeg.position.set(0.3, -1.2, 0);
    rightLeg.name = 'rightLeg';
    this.playerMesh.add(rightLeg);
    
    this.game.getScene().add(this.playerMesh);
  }

  private setupCamera(): void {
    const camera = this.game.getCamera();
    
    // Position camera behind and above player
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 2, 0);
    
    // Update camera to follow player (simple follow for demo)
    this.updateCameraFollow();
  }

  private updateCameraFollow(): void {
    const transformComponent = this.world.getComponent<TransformComponent>(
      this.playerEntity, 
      'transform'
    );
    
    if (transformComponent && this.playerMesh) {
      // Update player mesh position from component
      this.playerMesh.position.set(
        transformComponent.position.x,
        transformComponent.position.y,
        transformComponent.position.z
      );
      
      this.playerMesh.rotation.set(
        transformComponent.rotation.x,
        transformComponent.rotation.y,
        transformComponent.rotation.z
      );
      
      // Update limb animations
      this.updateLimbAnimations();
      
      // Simple camera follow
      const camera = this.game.getCamera();
      const targetPosition = new THREE.Vector3(
        transformComponent.position.x,
        transformComponent.position.y + 8,
        transformComponent.position.z + 12
      );
      
      camera.position.lerp(targetPosition, 0.1);
      camera.lookAt(
        transformComponent.position.x,
        transformComponent.position.y + 2,
        transformComponent.position.z
      );
    }
  }

  private updateLimbAnimations(): void {
    const limbPositions = this.animationSystem.calculateLimbPositions(this.playerEntity);
    
    // Apply procedural animations to limbs
    const leftArm = this.playerMesh.getObjectByName('leftArm');
    const rightArm = this.playerMesh.getObjectByName('rightArm');
    const leftLeg = this.playerMesh.getObjectByName('leftLeg');
    const rightLeg = this.playerMesh.getObjectByName('rightLeg');
    
    if (leftArm) {
      leftArm.rotation.x = limbPositions.leftArm.z;
      leftArm.rotation.z = limbPositions.leftArm.x;
    }
    
    if (rightArm) {
      rightArm.rotation.x = limbPositions.rightArm.z;
      rightArm.rotation.z = limbPositions.rightArm.x;
    }
    
    if (leftLeg) {
      leftLeg.rotation.x = limbPositions.leftLeg.z;
      leftLeg.rotation.z = limbPositions.leftLeg.x;
    }
    
    if (rightLeg) {
      rightLeg.rotation.x = limbPositions.rightLeg.z;
      rightLeg.rotation.z = limbPositions.rightLeg.x;
    }
    
    // Apply body bob and banking
    this.playerMesh.position.y += limbPositions.torso.y;
  }

  private addEnvironmentalElements(): void {
    // Add some trees
    for (let i = 0; i < 10; i++) {
      const treeGeometry = new THREE.CylinderGeometry(0.2, 0.3, 4);
      const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
      const trunk = new THREE.Mesh(treeGeometry, treeMaterial);
      
      const leavesGeometry = new THREE.SphereGeometry(2);
      const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
      const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
      leaves.position.y = 3;
      
      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(leaves);
      
      tree.position.set(
        (Math.random() - 0.5) * 80,
        2,
        (Math.random() - 0.5) * 80
      );
      
      trunk.castShadow = true;
      leaves.castShadow = true;
      
      this.game.getScene().add(tree);
    }
  }

  private setupDemoUI(): void {
    this.createPerformancePanel();
    this.createControlsPanel();
    this.createDebugPanel();
  }

  private createPerformancePanel(): void {
    const panel = document.createElement('div');
    panel.id = 'performance-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      min-width: 200px;
    `;
    
    document.body.appendChild(panel);
    this.demoUI.performancePanel = panel;
  }

  private createControlsPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'controls-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 5px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      z-index: 1000;
      max-width: 300px;
    `;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    panel.innerHTML = `
      <h3 style="margin-top: 0; color: #4fc3f7;">Controls</h3>
      ${isMobile ? `
        <p><strong>Touch Controls:</strong></p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li>Left side: Steer left</li>
          <li>Right side: Steer right</li>
          <li>Center: Jump</li>
          <li>Swipe: Quick steering</li>
          <li>Hold: Special actions</li>
        </ul>
      ` : `
        <p><strong>Keyboard:</strong></p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li>A/D or ←/→: Steer</li>
          <li>Space/W/↑: Jump</li>
          <li>S/↓: Slide</li>
        </ul>
        <p><strong>Mouse:</strong></p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li>Click & hold: Steer based on position</li>
        </ul>
      `}
      <button id="toggle-touch-zones" style="
        background: #4fc3f7; 
        border: none; 
        color: white; 
        padding: 8px 12px; 
        border-radius: 3px; 
        cursor: pointer;
        margin-top: 10px;
      ">Show Touch Zones</button>
    `;
    
    document.body.appendChild(panel);
    this.demoUI.controlsPanel = panel;
    
    // Setup touch zones button
    const toggleButton = document.getElementById('toggle-touch-zones');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        // This would show visual touch zones for debugging
        console.log('Touch zones visualization not implemented yet');
      });
    }
  }

  private createDebugPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 11px;
      z-index: 1000;
      max-width: 400px;
      max-height: 200px;
      overflow-y: auto;
    `;
    
    document.body.appendChild(panel);
    this.demoUI.debugPanel = panel;
  }

  private updateUI(): void {
    // Update performance panel
    if (this.demoUI.performancePanel) {
      const gameLoop = this.game.getGameLoop();
      const playerMetrics = this.playerSystem.getPerformanceMetrics();
      const animationMetrics = this.animationSystem.getPerformanceMetrics();
      
      this.demoUI.performancePanel.innerHTML = `
        <h4 style="margin-top: 0; color: #4fc3f7;">Performance</h4>
        <div>FPS: ${Math.round(gameLoop.getFPS())}</div>
        <div>Frame Time: ${gameLoop.getFrameTime().toFixed(1)}ms</div>
        <div>Quality: ${(playerMetrics.qualityScaling * 100).toFixed(0)}%</div>
        <div>Battery Mode: ${playerMetrics.batteryOptimized ? 'ON' : 'OFF'}</div>
        <div>Animations: ${animationMetrics.animationsActive}</div>
        <div>Update Freq: ${playerMetrics.updateFrequency}Hz</div>
      `;
    }
    
    // Update debug panel
    if (this.demoUI.debugPanel) {
      const playerComponent = this.world.getComponent<PlayerComponent>(this.playerEntity, 'player');
      const transformComponent = this.world.getComponent<TransformComponent>(this.playerEntity, 'transform');
      const inputState = this.inputSystem.getInputState();
      
      if (playerComponent && transformComponent) {
        this.demoUI.debugPanel.innerHTML = `
          <h4 style="margin-top: 0; color: #4fc3f7;">Debug Info</h4>
          <div>Position: ${transformComponent.position.x.toFixed(1)}, ${transformComponent.position.y.toFixed(1)}, ${transformComponent.position.z.toFixed(1)}</div>
          <div>Speed: ${playerComponent.currentSpeed.toFixed(1)} / ${playerComponent.maxSpeed}</div>
          <div>Steering: ${inputState.steering.toFixed(2)}</div>
          <div>Grounded: ${playerComponent.isGrounded ? 'YES' : 'NO'}</div>
          <div>Sliding: ${playerComponent.isSliding ? 'YES' : 'NO'}</div>
          <div>Bank Angle: ${(playerComponent.bankAngle * 180 / Math.PI).toFixed(1)}°</div>
          <div>Vertical Velocity: ${playerComponent.verticalVelocity.toFixed(2)}</div>
          <div>Active Gestures: ${inputState.gestures.length}</div>
          <div>Touch Active: ${inputState.touch ? 'YES' : 'NO'}</div>
          <div>Input Sensitivity: ${playerComponent.inputSensitivity.toFixed(1)}</div>
        `;
      }
    }
  }

  private start(): void {
    // Start the game
    this.game.start();
    
    // Setup update loop for camera and UI
    const updateLoop = () => {
      this.updateCameraFollow();
      this.updateUI();
      requestAnimationFrame(updateLoop);
    };
    updateLoop();
    
    // Show initial instructions
    this.showWelcomeMessage();
  }

  private showWelcomeMessage(): void {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      z-index: 2000;
      max-width: 90%;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    
    message.innerHTML = `
      <h2 style="color: #4fc3f7; margin-top: 0;">Open Runner - Player Controller Demo</h2>
      <p>Experience modern mobile-first controls with:</p>
      <ul style="text-align: left; margin: 20px 0;">
        <li>🎮 Unified input system (touch, keyboard, mouse)</li>
        <li>📱 Mobile-optimized touch controls</li>
        <li>🎯 Gesture recognition with haptic feedback</li>
        <li>⚡ 60fps performance with adaptive quality</li>
        <li>🏃‍♂️ Procedural running animation</li>
        <li>🏔️ Advanced terrain following</li>
        <li>🔋 Battery optimization</li>
      </ul>
      <p><strong>${isMobile ? 'Touch anywhere to start!' : 'Use WASD or arrow keys to move, Space to jump!'}</strong></p>
      <button id="start-demo" style="
        background: #4fc3f7;
        border: none;
        color: white;
        padding: 15px 30px;
        border-radius: 5px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 20px;
      ">Start Demo</button>
    `;
    
    document.body.appendChild(message);
    
    const startButton = document.getElementById('start-demo');
    const hideMessage = () => {
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    };
    
    if (startButton) {
      startButton.addEventListener('click', hideMessage);
    }
    
    // Auto-hide after 5 seconds
    setTimeout(hideMessage, 5000);
  }

  // Public API for external control
  public enableBatteryOptimization(): void {
    this.playerSystem.enableBatteryOptimization();
    this.animationSystem.enableBatteryOptimization();
    
    const playerComponent = this.world.getComponent<PlayerComponent>(this.playerEntity, 'player');
    if (playerComponent) {
      playerComponent.enableBatteryOptimization();
    }
  }

  public disableBatteryOptimization(): void {
    this.playerSystem.disableBatteryOptimization();
    this.animationSystem.disableBatteryOptimization();
    
    const playerComponent = this.world.getComponent<PlayerComponent>(this.playerEntity, 'player');
    if (playerComponent) {
      playerComponent.disableBatteryOptimization();
    }
  }

  public getPerformanceMetrics() {
    return {
      game: {
        fps: this.game.getGameLoop().getFPS(),
        frameTime: this.game.getGameLoop().getFrameTime()
      },
      player: this.playerSystem.getPerformanceMetrics(),
      animation: this.animationSystem.getPerformanceMetrics()
    };
  }

  public destroy(): void {
    this.game.destroy();
    
    // Clean up UI
    Object.values(this.demoUI).forEach(panel => {
      if (panel) panel.remove();
    });
    
    console.log('PlayerSystemDemo destroyed');
  }
}

// Initialize demo when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new PlayerSystemDemo();
    });
  } else {
    new PlayerSystemDemo();
  }
}