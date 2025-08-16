import { BaseScene, type SceneConfig } from '@/core/scene/Scene';
import { TouchController } from '@/components/ui/controls/TouchController';
import { Button } from '@/components/ui/base/Button';
import { Modal } from '@/components/ui/base/Modal';
import { useGameStore, useGameSettings } from '@/utils/gameStore';
import type { InputState, PerformanceMetrics } from '@/types';

export interface GameplaySceneConfig extends SceneConfig {
  enableTouchControls?: boolean;
  showDebugInfo?: boolean;
  enablePause?: boolean;
  enableHUD?: boolean;
}

/**
 * Gameplay Scene Implementation
 * Active game scene with UI overlays, controls, and pause system
 */
export class GameplayScene extends BaseScene {
  private config: GameplaySceneConfig;
  private touchController: TouchController | null = null;
  private hudElement: HTMLElement | null = null;
  private pauseModal: Modal | null = null;
  private gameOverModal: Modal | null = null;
  private scoreElement: HTMLElement | null = null;
  private livesElement: HTMLElement | null = null;
  private levelElement: HTMLElement | null = null;
  private performanceElement: HTMLElement | null = null;
  private pauseButton: Button | null = null;
  private isGameActive = false;
  private currentScore = 0;
  private scoreAnimationFrame: number | null = null;

  constructor(config: GameplaySceneConfig = {}) {
    super('gameplay');
    this.config = config;
  }

  protected async createUI(): Promise<void> {
    this.uiElement = document.createElement('div');
    this.uiElement.className = 'gameplay-scene';
    
    // Create main structure
    this.uiElement.innerHTML = `
      <div class="gameplay-container">
        <!-- Game HUD -->
        <div class="game-hud ${this.config.enableHUD !== false ? '' : 'hidden'}">
          <div class="hud-left">
            <div class="score-display">
              <span class="score-label">Score</span>
              <span class="score-value" id="score-value">0</span>
            </div>
          </div>
          
          <div class="hud-center">
            <div class="level-display">
              <span class="level-label">Level</span>
              <span class="level-value" id="level-value">1</span>
            </div>
          </div>
          
          <div class="hud-right">
            <div class="lives-display">
              <span class="lives-label">Lives</span>
              <div class="lives-container" id="lives-container">
                <span class="life-icon">❤️</span>
                <span class="life-icon">❤️</span>
                <span class="life-icon">❤️</span>
              </div>
            </div>
            
            <div class="pause-button-container">
              <!-- Pause button will be added here -->
            </div>
          </div>
        </div>
        
        <!-- Performance metrics (debug) -->
        <div class="performance-hud ${this.config.showDebugInfo ? '' : 'hidden'}" id="performance-hud">
          <div class="performance-metrics">
            <div class="metric">
              <span class="metric-label">FPS:</span>
              <span class="metric-value" id="fps-value">60</span>
            </div>
            <div class="metric">
              <span class="metric-label">Frame:</span>
              <span class="metric-value" id="frame-time-value">16.7ms</span>
            </div>
            <div class="metric">
              <span class="metric-label">Draws:</span>
              <span class="metric-value" id="draw-calls-value">0</span>
            </div>
          </div>
        </div>
        
        <!-- Touch controls overlay -->
        <div class="touch-controls-container ${this.config.enableTouchControls !== false ? '' : 'hidden'}">
          <!-- Touch controller will be added here -->
        </div>
        
        <!-- Game notifications -->
        <div class="game-notifications" id="game-notifications">
          <!-- Dynamic notifications will be added here -->
        </div>
      </div>
    `;

    // Get references to elements
    this.hudElement = this.uiElement.querySelector('.game-hud');
    this.scoreElement = this.uiElement.querySelector('#score-value');
    this.livesElement = this.uiElement.querySelector('#lives-container');
    this.levelElement = this.uiElement.querySelector('#level-value');
    this.performanceElement = this.uiElement.querySelector('#performance-hud');

    // Create components
    this.createTouchController();
    this.createPauseButton();
    this.createModals();
    
    // Apply styles
    this.applyStyles();

    // Initialize HUD values
    this.updateHUD();

    if (this.uiContainer) {
      this.uiContainer.appendChild(this.uiElement);
    }
  }

  protected async destroyUI(): Promise<void> {
    // Cleanup components
    if (this.touchController) this.touchController.destroy();
    if (this.pauseButton) this.pauseButton.destroy();
    if (this.pauseModal) this.pauseModal.destroy();
    if (this.gameOverModal) this.gameOverModal.destroy();

    // Cancel animations
    if (this.scoreAnimationFrame) {
      cancelAnimationFrame(this.scoreAnimationFrame);
      this.scoreAnimationFrame = null;
    }

    if (this.uiElement && this.uiElement.parentElement) {
      this.uiElement.parentElement.removeChild(this.uiElement);
    }
    this.uiElement = null;
  }

  private createTouchController(): void {
    if (this.config.enableTouchControls === false) return;

    const container = this.uiElement?.querySelector('.touch-controls-container');
    if (!container) return;

    const settings = useGameSettings();
    const showDebugZones = this.config.showDebugInfo || false;

    this.touchController = new TouchController({
      showDebugZones,
      sensitivity: 1.0,
      vibrationEnabled: settings.enableVibration,
      onInput: this.handleInput.bind(this),
      onGesture: this.handleGesture.bind(this)
    });

    container.appendChild(this.touchController.getElement());
  }

  private createPauseButton(): void {
    if (this.config.enablePause === false) return;

    const container = this.uiElement?.querySelector('.pause-button-container');
    if (!container) return;

    this.pauseButton = Button.icon('pause', () => {
      this.pauseGame();
    }, {
      className: 'pause-button',
      size: 'sm',
      accessibility: {
        label: 'Pause game'
      }
    });

    container.appendChild(this.pauseButton.getElement());
  }

  private createModals(): void {
    // Pause modal
    this.pauseModal = new Modal({
      title: 'Game Paused',
      content: this.createPauseContent(),
      closable: false,
      closeOnBackdrop: false,
      closeOnEscape: false,
      buttons: [
        {
          text: 'Resume',
          variant: 'primary',
          onClick: () => {
            this.resumeGame();
          }
        },
        {
          text: 'Restart',
          variant: 'outline',
          onClick: () => {
            this.restartGame();
          }
        },
        {
          text: 'Quit to Menu',
          variant: 'secondary',
          onClick: () => {
            this.quitToMenu();
          }
        }
      ]
    });

    // Game over modal
    this.gameOverModal = new Modal({
      title: 'Game Over',
      content: this.createGameOverContent(),
      closable: false,
      closeOnBackdrop: false,
      closeOnEscape: false,
      size: 'lg',
      buttons: [
        {
          text: 'Play Again',
          variant: 'primary',
          onClick: () => {
            this.restartGame();
          }
        },
        {
          text: 'Main Menu',
          variant: 'secondary',
          onClick: () => {
            this.quitToMenu();
          }
        }
      ]
    });

    // Add modals to UI container
    if (this.uiContainer) {
      this.uiContainer.appendChild(this.pauseModal.getElement());
      this.uiContainer.appendChild(this.gameOverModal.getElement());
    }
  }

  private createPauseContent(): string {
    const settings = useGameSettings();
    return `
      <div class="pause-content">
        <p>Game is paused. Take a moment to rest!</p>
        
        <div class="pause-settings">
          <div class="setting-group">
            <label class="setting-label">
              <input type="checkbox" class="pause-setting-sound" ${settings.sfxVolume > 0 ? 'checked' : ''}>
              Sound Effects
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <input type="checkbox" class="pause-setting-music" ${settings.musicVolume > 0 ? 'checked' : ''}>
              Background Music
            </label>
          </div>
          
          <div class="setting-group">
            <label class="setting-label">
              <input type="checkbox" class="pause-setting-vibration" ${settings.enableVibration ? 'checked' : ''}>
              Haptic Feedback
            </label>
          </div>
        </div>
      </div>
    `;
  }

  private createGameOverContent(): string {
    const gameState = useGameStore.getState();
    const isNewHighScore = gameState.score > gameState.highScore;
    
    return `
      <div class="game-over-content">
        ${isNewHighScore ? '<div class="new-high-score">🎉 New High Score! 🎉</div>' : ''}
        
        <div class="final-score">
          <div class="score-display-large">
            <span class="final-score-label">Final Score</span>
            <span class="final-score-value">${gameState.score.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="game-stats">
          <div class="stat">
            <span class="stat-label">Level Reached</span>
            <span class="stat-value">${gameState.level}</span>
          </div>
          <div class="stat">
            <span class="stat-label">High Score</span>
            <span class="stat-value">${Math.max(gameState.score, gameState.highScore).toLocaleString()}</span>
          </div>
        </div>
        
        <div class="encouragement">
          ${this.getEncouragementMessage(gameState.score)}
        </div>
      </div>
    `;
  }

  private getEncouragementMessage(score: number): string {
    if (score < 1000) {
      return "Keep practicing! Every master was once a beginner.";
    } else if (score < 5000) {
      return "Great progress! You're getting the hang of it.";
    } else if (score < 10000) {
      return "Impressive! You're becoming quite skilled.";
    } else if (score < 25000) {
      return "Outstanding performance! You're a true runner.";
    } else {
      return "Legendary! You've mastered the art of endless running.";
    }
  }

  private applyStyles(): void {
    if (!this.uiElement) return;

    const style = document.createElement('style');
    style.textContent = `
      .gameplay-scene {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .gameplay-container {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .game-hud {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 200;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: var(--space-md);
        background: var(--gradient-overlay);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--border-primary)20;
      }

      .hud-left,
      .hud-center,
      .hud-right {
        display: flex;
        align-items: center;
        gap: var(--space-md);
      }

      .score-display,
      .level-display,
      .lives-display {
        background: var(--bg-overlay);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-sm) var(--space-md);
        backdrop-filter: blur(8px);
        min-width: 80px;
        text-align: center;
      }

      .score-label,
      .level-label,
      .lives-label {
        display: block;
        font-size: var(--font-xs);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: var(--space-xs);
      }

      .score-value,
      .level-value {
        display: block;
        font-size: var(--font-lg);
        font-weight: 700;
        color: var(--accent-primary);
        transition: all var(--transition-fast);
      }

      .score-value.animate {
        transform: scale(1.2);
        color: var(--accent-secondary);
      }

      .lives-container {
        display: flex;
        gap: var(--space-xs);
        justify-content: center;
      }

      .life-icon {
        font-size: var(--font-base);
        transition: all var(--transition-base);
      }

      .life-icon.lost {
        opacity: 0.3;
        filter: grayscale(100%);
        transform: scale(0.8);
      }

      .pause-button {
        background: var(--bg-overlay) !important;
        border-color: var(--border-primary) !important;
        backdrop-filter: blur(8px);
      }

      .performance-hud {
        position: absolute;
        top: var(--space-md);
        right: var(--space-md);
        z-index: 199;
        background: var(--bg-overlay);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-md);
        padding: var(--space-sm);
        backdrop-filter: blur(8px);
        font-family: monospace;
        font-size: var(--font-xs);
      }

      .performance-metrics {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .metric {
        display: flex;
        justify-content: space-between;
        gap: var(--space-sm);
      }

      .metric-label {
        color: var(--text-secondary);
      }

      .metric-value {
        color: var(--text-primary);
        font-weight: 600;
      }

      .metric-value.fps-good { color: var(--success); }
      .metric-value.fps-warning { color: var(--warning); }
      .metric-value.fps-critical { color: var(--error); }

      .touch-controls-container {
        position: absolute;
        inset: 0;
        z-index: 150;
        pointer-events: none;
      }

      .touch-controls-container .touch-controller {
        pointer-events: auto;
      }

      .game-notifications {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 250;
        pointer-events: none;
      }

      .notification {
        background: var(--bg-overlay);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-md) var(--space-lg);
        margin-bottom: var(--space-md);
        text-align: center;
        backdrop-filter: blur(8px);
        animation: notificationSlide 0.5s ease-out;
      }

      .notification.success {
        border-color: var(--success);
        color: var(--success);
      }

      .notification.warning {
        border-color: var(--warning);
        color: var(--warning);
      }

      .notification.error {
        border-color: var(--error);
        color: var(--error);
      }

      .pause-content {
        text-align: center;
      }

      .pause-settings {
        margin-top: var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .setting-group {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .setting-label {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        cursor: pointer;
      }

      .game-over-content {
        text-align: center;
      }

      .new-high-score {
        font-size: var(--font-lg);
        font-weight: 700;
        color: var(--accent-primary);
        margin-bottom: var(--space-lg);
        animation: celebrate 0.8s ease-out;
      }

      .final-score {
        margin: var(--space-lg) 0;
      }

      .score-display-large {
        background: var(--bg-secondary);
        border: 2px solid var(--accent-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
      }

      .final-score-label {
        display: block;
        font-size: var(--font-sm);
        color: var(--text-secondary);
        margin-bottom: var(--space-sm);
      }

      .final-score-value {
        display: block;
        font-size: var(--font-4xl);
        font-weight: 900;
        color: var(--accent-primary);
      }

      .game-stats {
        display: flex;
        justify-content: space-around;
        margin: var(--space-lg) 0;
        gap: var(--space-md);
      }

      .stat {
        text-align: center;
      }

      .stat-label {
        display: block;
        font-size: var(--font-xs);
        color: var(--text-secondary);
        margin-bottom: var(--space-xs);
      }

      .stat-value {
        display: block;
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--text-primary);
      }

      .encouragement {
        margin-top: var(--space-lg);
        padding: var(--space-md);
        background: var(--bg-tertiary);
        border-radius: var(--radius-md);
        font-style: italic;
        color: var(--text-secondary);
      }

      @keyframes notificationSlide {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes celebrate {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.05) rotate(-1deg); }
        75% { transform: scale(1.05) rotate(1deg); }
      }

      /* Mobile optimizations */
      @media (max-width: 640px) {
        .game-hud {
          padding: var(--space-sm);
        }
        
        .hud-center {
          display: none; /* Hide level on small screens */
        }
        
        .score-display,
        .lives-display {
          min-width: 60px;
          padding: var(--space-xs) var(--space-sm);
        }
        
        .performance-hud {
          right: var(--space-sm);
          top: calc(80px + var(--space-sm));
        }
        
        .game-stats {
          flex-direction: column;
          gap: var(--space-sm);
        }
      }

      /* Landscape mode adjustments */
      @media (orientation: landscape) and (max-height: 500px) {
        .game-hud {
          padding: var(--space-sm);
        }
        
        .performance-hud {
          right: var(--space-sm);
          top: calc(60px + var(--space-sm));
        }
      }

      /* High DPI optimizations */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        .game-hud,
        .performance-hud,
        .notification {
          border-width: 0.5px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private handleInput(input: InputState): void {
    if (!this.isGameActive) return;

    // Handle buffered inputs for precise timing
    input.bufferedInputs.forEach(bufferedInput => {
      if (!bufferedInput.processed) {
        this.processBufferedInput(bufferedInput);
        bufferedInput.processed = true;
      }
    });

    // Emit input to game systems
    this.manager?.dispatchEvent(new CustomEvent('game-input', {
      detail: { input }
    }));
  }

  private handleGesture(gesture: any): void {
    if (!this.isGameActive) return;

    // Show gesture feedback
    this.showNotification(`${gesture.type} gesture detected`, 'success', 1000);

    // Emit gesture to game systems
    this.manager?.dispatchEvent(new CustomEvent('game-gesture', {
      detail: { gesture }
    }));
  }

  private processBufferedInput(input: any): void {
    switch (input.type) {
      case 'jump':
        this.showNotification('Jump!', 'success', 500);
        break;
      case 'slide':
        this.showNotification('Slide!', 'warning', 500);
        break;
      case 'pause':
        this.pauseGame();
        break;
    }
  }

  private updateHUD(): void {
    const gameState = useGameStore.getState();
    
    // Update score with animation
    this.updateScore(gameState.score);
    
    // Update level
    if (this.levelElement) {
      this.levelElement.textContent = gameState.level.toString();
    }
    
    // Update lives
    this.updateLives(gameState.lives);
    
    // Update performance metrics if enabled
    if (this.config.showDebugInfo) {
      this.updatePerformanceMetrics();
    }
  }

  private updateScore(newScore: number): void {
    if (!this.scoreElement || newScore === this.currentScore) return;
    
    // Animate score change
    if (newScore > this.currentScore) {
      this.animateScoreIncrease(this.currentScore, newScore);
    } else {
      this.scoreElement.textContent = newScore.toLocaleString();
    }
    
    this.currentScore = newScore;
  }

  private animateScoreIncrease(fromScore: number, toScore: number): void {
    if (this.scoreAnimationFrame) {
      cancelAnimationFrame(this.scoreAnimationFrame);
    }
    
    const duration = 500;
    const startTime = performance.now();
    const scoreDiff = toScore - fromScore;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentScore = fromScore + (scoreDiff * progress);
      
      if (this.scoreElement) {
        this.scoreElement.textContent = Math.floor(currentScore).toLocaleString();
        
        // Add pulse effect during animation
        if (progress < 1) {
          this.scoreElement.classList.add('animate');
        } else {
          this.scoreElement.classList.remove('animate');
        }
      }
      
      if (progress < 1) {
        this.scoreAnimationFrame = requestAnimationFrame(animate);
      } else {
        this.scoreAnimationFrame = null;
      }
    };
    
    this.scoreAnimationFrame = requestAnimationFrame(animate);
  }

  private updateLives(lives: number): void {
    if (!this.livesElement) return;
    
    const lifeIcons = this.livesElement.querySelectorAll('.life-icon');
    lifeIcons.forEach((icon, index) => {
      if (index < lives) {
        icon.classList.remove('lost');
      } else {
        icon.classList.add('lost');
      }
    });
  }

  private updatePerformanceMetrics(): void {
    const performanceMetrics = useGameStore.getState().performanceMetrics;
    if (!performanceMetrics || !this.performanceElement) return;
    
    const fpsElement = this.performanceElement.querySelector('#fps-value');
    const frameTimeElement = this.performanceElement.querySelector('#frame-time-value');
    const drawCallsElement = this.performanceElement.querySelector('#draw-calls-value');
    
    if (fpsElement) {
      fpsElement.textContent = Math.round(performanceMetrics.fps).toString();
      
      // Color code FPS
      fpsElement.className = 'metric-value';
      if (performanceMetrics.fps >= 55) {
        fpsElement.classList.add('fps-good');
      } else if (performanceMetrics.fps >= 30) {
        fpsElement.classList.add('fps-warning');
      } else {
        fpsElement.classList.add('fps-critical');
      }
    }
    
    if (frameTimeElement) {
      frameTimeElement.textContent = `${performanceMetrics.frameTime.toFixed(1)}ms`;
    }
    
    if (drawCallsElement) {
      drawCallsElement.textContent = performanceMetrics.drawCalls.toString();
    }
  }

  private showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success', duration: number = 2000): void {
    const container = this.uiElement?.querySelector('#game-notifications');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto remove notification
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, duration);
  }

  private pauseGame(): void {
    this.isGameActive = false;
    useGameStore.getState().setPaused(true);
    
    if (this.pauseModal) {
      this.pauseModal.open();
    }
    
    // Emit pause event
    this.manager?.dispatchEvent(new CustomEvent('game-pause', {
      detail: { scene: this.name }
    }));
  }

  private resumeGame(): void {
    this.isGameActive = true;
    useGameStore.getState().setPaused(false);
    
    if (this.pauseModal) {
      this.pauseModal.close();
    }
    
    // Emit resume event
    this.manager?.dispatchEvent(new CustomEvent('game-resume', {
      detail: { scene: this.name }
    }));
  }

  private restartGame(): void {
    // Close any open modals
    if (this.pauseModal) this.pauseModal.close();
    if (this.gameOverModal) this.gameOverModal.close();
    
    // Reset game state
    useGameStore.getState().resetGame();
    
    // Restart the current scene
    this.manager?.dispatchEvent(new CustomEvent('game-restart', {
      detail: { scene: this.name }
    }));
    
    this.isGameActive = true;
  }

  private quitToMenu(): void {
    // Close any open modals
    if (this.pauseModal) this.pauseModal.close();
    if (this.gameOverModal) this.gameOverModal.close();
    
    // Transition to title scene
    useGameStore.getState().setScene('menu');
    this.manager?.transitionTo('title', {
      type: 'slide',
      direction: 'right',
      duration: 500
    });
  }

  public showGameOver(): void {
    this.isGameActive = false;
    
    // Update game over content with final stats
    if (this.gameOverModal) {
      this.gameOverModal.setContent(this.createGameOverContent());
      this.gameOverModal.open();
    }
    
    // Emit game over event
    this.manager?.dispatchEvent(new CustomEvent('game-over', {
      detail: { scene: this.name }
    }));
  }

  public update(deltaTime: number): void {
    // Update HUD continuously
    this.updateHUD();
    
    // Check for game over condition
    const gameState = useGameStore.getState();
    if (gameState.lives <= 0 && this.isGameActive) {
      this.showGameOver();
    }
  }

  public render(): void {
    // Rendering is handled by the game engine and CSS
  }

  public async enter(): Promise<void> {
    await super.enter();
    
    // Start the game
    this.isGameActive = true;
    
    // Reset touch controller if it exists
    if (this.touchController) {
      this.touchController.reset();
    }
    
    // Update initial HUD
    this.updateHUD();
    
    // Show start notification
    this.showNotification('Game Started!', 'success', 1500);
  }

  public async exit(): Promise<void> {
    this.isGameActive = false;
    
    // Close any open modals
    if (this.pauseModal && this.pauseModal.isModalOpen()) {
      this.pauseModal.close();
    }
    if (this.gameOverModal && this.gameOverModal.isModalOpen()) {
      this.gameOverModal.close();
    }
    
    await super.exit();
  }

  // Public API for external game systems
  public getInputController(): TouchController | null {
    return this.touchController;
  }

  public isGameplayActive(): boolean {
    return this.isGameActive;
  }

  public addScore(points: number): void {
    useGameStore.getState().updateScore(points);
    this.showNotification(`+${points}`, 'success', 1000);
  }

  public removeLife(): void {
    const gameState = useGameStore.getState();
    useGameStore.getState().setLives(gameState.lives - 1);
    this.showNotification('Life Lost!', 'error', 1500);
  }

  public levelUp(): void {
    const gameState = useGameStore.getState();
    useGameStore.getState().setLevel(gameState.level + 1);
    this.showNotification(`Level ${gameState.level + 1}!`, 'success', 2000);
  }
}