import { BaseScene, type SceneConfig } from '@/core/scene/Scene';
import { Button } from '@/components/ui/base/Button';
import { Modal } from '@/components/ui/base/Modal';
import { useGameStore, useGameSettings } from '@/utils/gameStore';

export interface TitleSceneConfig extends SceneConfig {
  showBackground?: boolean;
  enableParticles?: boolean;
  musicEnabled?: boolean;
}

/**
 * Title Scene Implementation
 * Main menu with level selection and game options
 */
export class TitleScene extends BaseScene {
  private config: TitleSceneConfig;
  private playButton: Button | null = null;
  private settingsButton: Button | null = null;
  private aboutButton: Button | null = null;
  private settingsModal: Modal | null = null;
  private aboutModal: Modal | null = null;
  private levelSelectionContainer: HTMLElement | null = null;
  private backgroundParticles: HTMLElement | null = null;
  private highScoreDisplay: HTMLElement | null = null;

  constructor(config: TitleSceneConfig = {}) {
    super('title');
    this.config = config;
  }

  protected async createUI(): Promise<void> {
    this.uiElement = document.createElement('div');
    this.uiElement.className = 'title-scene';
    
    // Create main structure
    this.uiElement.innerHTML = `
      <div class="title-background">
        ${this.config.showBackground !== false ? '<div class="title-bg-animation"></div>' : ''}
        ${this.config.enableParticles !== false ? '<div class="title-particles"></div>' : ''}
      </div>
      
      <div class="title-container">
        <header class="title-header">
          <h1 class="title-logo">
            <span class="title-logo-text">Open</span>
            <span class="title-logo-accent">Runner</span>
          </h1>
          <p class="title-tagline">The Ultimate Endless Adventure</p>
        </header>
        
        <div class="title-score">
          <div class="high-score-display">
            <span class="high-score-label">Best Score</span>
            <span class="high-score-value">0</span>
          </div>
        </div>
        
        <nav class="title-menu">
          <div class="title-main-buttons">
            <!-- Main buttons will be added here -->
          </div>
          
          <div class="title-level-selection hidden">
            <h3 class="level-selection-title">Choose Your Path</h3>
            <div class="level-grid">
              <!-- Level buttons will be added here -->
            </div>
          </div>
        </nav>
        
        <footer class="title-footer">
          <div class="title-secondary-buttons">
            <!-- Secondary buttons will be added here -->
          </div>
          <p class="title-version">Version 2.0.0</p>
        </footer>
      </div>
    `;

    // Get references
    this.levelSelectionContainer = this.uiElement.querySelector('.title-level-selection');
    this.backgroundParticles = this.uiElement.querySelector('.title-particles');
    this.highScoreDisplay = this.uiElement.querySelector('.high-score-value');

    // Create buttons
    this.createButtons();
    
    // Create modals
    this.createModals();
    
    // Apply styles
    this.applyStyles();
    
    // Update high score display
    this.updateHighScore();

    if (this.uiContainer) {
      this.uiContainer.appendChild(this.uiElement);
    }

    // Initialize background effects
    if (this.config.enableParticles !== false) {
      this.initializeParticles();
    }
  }

  protected async destroyUI(): Promise<void> {
    // Cleanup buttons
    if (this.playButton) this.playButton.destroy();
    if (this.settingsButton) this.settingsButton.destroy();
    if (this.aboutButton) this.aboutButton.destroy();
    
    // Cleanup modals
    if (this.settingsModal) this.settingsModal.destroy();
    if (this.aboutModal) this.aboutModal.destroy();

    if (this.uiElement && this.uiElement.parentElement) {
      this.uiElement.parentElement.removeChild(this.uiElement);
    }
    this.uiElement = null;
  }

  private createButtons(): void {
    const mainButtonsContainer = this.uiElement?.querySelector('.title-main-buttons');
    const secondaryButtonsContainer = this.uiElement?.querySelector('.title-secondary-buttons');
    
    if (!mainButtonsContainer || !secondaryButtonsContainer) return;

    // Play button
    this.playButton = Button.primary('Start Game', () => {
      this.showLevelSelection();
    }, {
      size: 'xl',
      fullWidth: true,
      className: 'title-play-button'
    });
    mainButtonsContainer.appendChild(this.playButton.getElement());

    // Settings button
    this.settingsButton = Button.outline('Settings', () => {
      this.openSettings();
    }, {
      size: 'lg',
      className: 'title-settings-button'
    });
    secondaryButtonsContainer.appendChild(this.settingsButton.getElement());

    // About button
    this.aboutButton = Button.ghost('About', () => {
      this.openAbout();
    }, {
      size: 'lg',
      className: 'title-about-button'
    });
    secondaryButtonsContainer.appendChild(this.aboutButton.getElement());

    // Create level selection buttons
    this.createLevelButtons();
  }

  private createLevelButtons(): void {
    const levelGrid = this.uiElement?.querySelector('.level-grid');
    if (!levelGrid) return;

    const levels = [
      { id: 1, name: 'Forest Run', difficulty: 'Easy', unlocked: true },
      { id: 2, name: 'Desert Dash', difficulty: 'Medium', unlocked: true },
      { id: 3, name: 'Mountain Marathon', difficulty: 'Hard', unlocked: false },
      { id: 4, name: 'City Sprint', difficulty: 'Expert', unlocked: false }
    ];

    levels.forEach(level => {
      const levelButton = new Button({
        text: level.name,
        variant: level.unlocked ? 'primary' : 'outline',
        disabled: !level.unlocked,
        size: 'lg',
        fullWidth: true,
        className: `level-button level-${level.difficulty.toLowerCase()}`,
        onClick: () => this.startGame(level.id)
      });

      const levelCard = document.createElement('div');
      levelCard.className = `level-card ${level.unlocked ? '' : 'locked'}`;
      levelCard.innerHTML = `
        <div class="level-info">
          <h4 class="level-name">${level.name}</h4>
          <p class="level-difficulty">${level.difficulty}</p>
          ${!level.unlocked ? '<p class="level-lock-status">🔒 Locked</p>' : ''}
        </div>
      `;
      levelCard.appendChild(levelButton.getElement());
      
      levelGrid.appendChild(levelCard);
    });

    // Back button for level selection
    const backButton = Button.secondary('← Back to Menu', () => {
      this.hideLevelSelection();
    }, {
      size: 'lg',
      className: 'level-back-button'
    });
    levelGrid.appendChild(backButton.getElement());
  }

  private createModals(): void {
    // Settings modal
    this.settingsModal = new Modal({
      title: 'Game Settings',
      size: 'md',
      buttons: [
        {
          text: 'Save Settings',
          variant: 'primary',
          onClick: () => {
            this.saveSettings();
            this.settingsModal!.close();
          }
        },
        {
          text: 'Cancel',
          variant: 'secondary',
          onClick: () => {
            this.settingsModal!.close();
          }
        }
      ]
    });

    // About modal
    this.aboutModal = new Modal({
      title: 'About Open Runner',
      size: 'md',
      content: this.createAboutContent(),
      buttons: [
        {
          text: 'Close',
          variant: 'primary',
          onClick: () => {
            this.aboutModal!.close();
          }
        }
      ]
    });

    // Add modals to UI container
    if (this.uiContainer) {
      this.uiContainer.appendChild(this.settingsModal.getElement());
      this.uiContainer.appendChild(this.aboutModal.getElement());
    }
  }

  private createAboutContent(): string {
    return `
      <div class="about-content">
        <p>Open Runner is a modern endless runner game built with cutting-edge web technologies.</p>
        
        <h4>Features</h4>
        <ul>
          <li>🎮 Touch-optimized controls</li>
          <li>🌟 Multiple game modes</li>
          <li>🎨 Beautiful 3D graphics</li>
          <li>🔊 Immersive audio</li>
          <li>📱 Progressive Web App</li>
          <li>♿ Accessibility support</li>
        </ul>
        
        <h4>Technology</h4>
        <ul>
          <li>TypeScript & Modern Web APIs</li>
          <li>Three.js for 3D graphics</li>
          <li>WebGPU/WebGL rendering</li>
          <li>ECS architecture</li>
          <li>Mobile-first design</li>
        </ul>
        
        <p class="about-credits">
          Built with ❤️ by the Open Runner team<br>
          <small>© 2024 Open Runner. Open source under MIT license.</small>
        </p>
      </div>
    `;
  }

  private applyStyles(): void {
    if (!this.uiElement) return;

    const style = document.createElement('style');
    style.textContent = `
      .title-scene {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: var(--gradient-bg);
      }

      .title-background {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .title-bg-animation {
        position: absolute;
        inset: 0;
        background: 
          radial-gradient(circle at 20% 80%, var(--accent-primary)20 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, var(--accent-secondary)20 0%, transparent 50%);
        animation: bgPulse 8s ease-in-out infinite;
      }

      .title-particles {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .title-container {
        position: relative;
        z-index: 1;
        max-width: 500px;
        width: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2xl);
        text-align: center;
      }

      .title-header {
        animation: titleSlideIn 1s ease-out;
      }

      .title-logo {
        font-size: clamp(2.5rem, 8vw, 4rem);
        font-weight: 900;
        margin-bottom: var(--space-md);
        line-height: 1;
      }

      .title-logo-text {
        color: var(--text-primary);
      }

      .title-logo-accent {
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .title-tagline {
        font-size: var(--font-lg);
        color: var(--text-secondary);
        margin: 0;
        animation: fadeInUp 1s ease-out 0.3s both;
      }

      .title-score {
        animation: fadeInUp 1s ease-out 0.6s both;
      }

      .high-score-display {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-md) var(--space-lg);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-xs);
      }

      .high-score-label {
        font-size: var(--font-sm);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .high-score-value {
        font-size: var(--font-2xl);
        font-weight: 700;
        color: var(--accent-primary);
      }

      .title-menu {
        width: 100%;
        animation: fadeInUp 1s ease-out 0.9s both;
      }

      .title-main-buttons {
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
        margin-bottom: var(--space-xl);
      }

      .title-level-selection {
        transition: all var(--transition-base);
      }

      .title-level-selection.hidden {
        opacity: 0;
        transform: translateY(20px);
        pointer-events: none;
        height: 0;
        overflow: hidden;
      }

      .level-selection-title {
        font-size: var(--font-xl);
        margin-bottom: var(--space-lg);
        color: var(--text-primary);
      }

      .level-grid {
        display: grid;
        gap: var(--space-md);
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }

      .level-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: all var(--transition-base);
      }

      .level-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      .level-card.locked {
        opacity: 0.6;
      }

      .level-info {
        margin-bottom: var(--space-md);
      }

      .level-name {
        font-size: var(--font-lg);
        font-weight: 600;
        margin-bottom: var(--space-xs);
        color: var(--text-primary);
      }

      .level-difficulty {
        font-size: var(--font-sm);
        color: var(--text-secondary);
        margin: 0;
      }

      .level-lock-status {
        font-size: var(--font-xs);
        color: var(--text-muted);
        margin: var(--space-xs) 0 0 0;
      }

      .title-footer {
        width: 100%;
        animation: fadeInUp 1s ease-out 1.2s both;
      }

      .title-secondary-buttons {
        display: flex;
        gap: var(--space-md);
        justify-content: center;
        margin-bottom: var(--space-lg);
        flex-wrap: wrap;
      }

      .title-version {
        font-size: var(--font-xs);
        color: var(--text-muted);
        margin: 0;
      }

      .about-content h4 {
        color: var(--accent-primary);
        margin: var(--space-lg) 0 var(--space-md) 0;
      }

      .about-content ul {
        margin-bottom: var(--space-lg);
        padding-left: var(--space-lg);
      }

      .about-content li {
        margin-bottom: var(--space-xs);
      }

      .about-credits {
        text-align: center;
        margin-top: var(--space-lg);
        padding-top: var(--space-lg);
        border-top: 1px solid var(--border-primary);
      }

      .particle {
        position: absolute;
        width: 3px;
        height: 3px;
        background: var(--accent-primary);
        border-radius: 50%;
        animation: float 6s ease-in-out infinite;
      }

      @keyframes titleSlideIn {
        from {
          opacity: 0;
          transform: translateY(-30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes bgPulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.5; }
      }

      @keyframes float {
        0%, 100% { 
          transform: translateY(0) rotate(0deg);
          opacity: 0.2;
        }
        50% { 
          transform: translateY(-20px) rotate(180deg);
          opacity: 0.8;
        }
      }

      /* Mobile optimizations */
      @media (max-width: 640px) {
        .title-container {
          gap: var(--space-xl);
        }
        
        .title-secondary-buttons {
          flex-direction: column;
          align-items: center;
        }
        
        .level-grid {
          grid-template-columns: 1fr;
        }
      }

      /* Reduce motion */
      @media (prefers-reduced-motion: reduce) {
        .title-header,
        .title-score,
        .title-menu,
        .title-footer {
          animation: none;
        }
        
        .title-bg-animation,
        .particle {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private initializeParticles(): void {
    if (!this.backgroundParticles) return;

    // Create floating particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 6}s`;
      particle.style.animationDuration = `${4 + Math.random() * 4}s`;
      
      this.backgroundParticles.appendChild(particle);
    }
  }

  private updateHighScore(): void {
    if (!this.highScoreDisplay) return;
    
    const highScore = useGameStore.getState().highScore;
    this.highScoreDisplay.textContent = highScore.toLocaleString();
  }

  private showLevelSelection(): void {
    const mainButtons = this.uiElement?.querySelector('.title-main-buttons');
    const levelSelection = this.levelSelectionContainer;
    
    if (mainButtons && levelSelection) {
      mainButtons.classList.add('hidden');
      levelSelection.classList.remove('hidden');
    }
  }

  private hideLevelSelection(): void {
    const mainButtons = this.uiElement?.querySelector('.title-main-buttons');
    const levelSelection = this.levelSelectionContainer;
    
    if (mainButtons && levelSelection) {
      levelSelection.classList.add('hidden');
      mainButtons.classList.remove('hidden');
    }
  }

  private startGame(levelId: number): void {
    // Set the selected level
    useGameStore.getState().setLevel(levelId);
    
    // Transition to gameplay scene
    useGameStore.getState().setScene('gameplay');
    this.manager?.transitionTo('gameplay', {
      type: 'slide',
      direction: 'left',
      duration: 600
    });
  }

  private openSettings(): void {
    if (!this.settingsModal) return;
    
    // Create settings form content
    const settings = useGameSettings();
    const settingsForm = this.createSettingsForm(settings);
    this.settingsModal.setContent(settingsForm);
    this.settingsModal.open();
  }

  private createSettingsForm(settings: any): HTMLElement {
    const form = document.createElement('div');
    form.className = 'settings-form';
    form.innerHTML = `
      <div class="setting-group">
        <label class="setting-label">Music Volume</label>
        <input type="range" class="range setting-music-volume" min="0" max="100" value="${settings.musicVolume * 100}">
        <span class="setting-value">${Math.round(settings.musicVolume * 100)}%</span>
      </div>
      
      <div class="setting-group">
        <label class="setting-label">Sound Effects</label>
        <input type="range" class="range setting-sfx-volume" min="0" max="100" value="${settings.sfxVolume * 100}">
        <span class="setting-value">${Math.round(settings.sfxVolume * 100)}%</span>
      </div>
      
      <div class="setting-group">
        <label class="setting-label">Graphics Quality</label>
        <select class="input setting-graphics">
          <option value="low" ${settings.graphics === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${settings.graphics === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${settings.graphics === 'high' ? 'selected' : ''}>High</option>
          <option value="ultra" ${settings.graphics === 'ultra' ? 'selected' : ''}>Ultra</option>
        </select>
      </div>
      
      <div class="setting-group">
        <label class="setting-label">
          <input type="checkbox" class="setting-vibration" ${settings.enableVibration ? 'checked' : ''}>
          Enable Haptic Feedback
        </label>
      </div>
      
      <div class="setting-group">
        <label class="setting-label">
          <input type="checkbox" class="setting-fps" ${settings.showFPS ? 'checked' : ''}>
          Show Performance Metrics
        </label>
      </div>
    `;

    // Add change listeners to update values
    const musicSlider = form.querySelector('.setting-music-volume') as HTMLInputElement;
    const sfxSlider = form.querySelector('.setting-sfx-volume') as HTMLInputElement;
    
    musicSlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const valueSpan = target.parentElement?.querySelector('.setting-value');
      if (valueSpan) valueSpan.textContent = `${target.value}%`;
    });
    
    sfxSlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const valueSpan = target.parentElement?.querySelector('.setting-value');
      if (valueSpan) valueSpan.textContent = `${target.value}%`;
    });

    return form;
  }

  private saveSettings(): void {
    const form = this.settingsModal?.getElement().querySelector('.settings-form');
    if (!form) return;

    const musicVolume = (form.querySelector('.setting-music-volume') as HTMLInputElement)?.value;
    const sfxVolume = (form.querySelector('.setting-sfx-volume') as HTMLInputElement)?.value;
    const graphics = (form.querySelector('.setting-graphics') as HTMLSelectElement)?.value;
    const enableVibration = (form.querySelector('.setting-vibration') as HTMLInputElement)?.checked;
    const showFPS = (form.querySelector('.setting-fps') as HTMLInputElement)?.checked;

    // Update game settings
    useGameStore.getState().updateSettings({
      musicVolume: parseInt(musicVolume) / 100,
      sfxVolume: parseInt(sfxVolume) / 100,
      graphics: graphics as any,
      enableVibration,
      showFPS
    });
  }

  private openAbout(): void {
    this.aboutModal?.open();
  }

  public update(deltaTime: number): void {
    // Update high score display if it changed
    this.updateHighScore();
  }

  public render(): void {
    // Rendering is handled by CSS and DOM
  }

  public async enter(): Promise<void> {
    await super.enter();
    
    // Update high score when entering scene
    this.updateHighScore();
  }
}