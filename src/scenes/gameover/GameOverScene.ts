import { BaseScene, type SceneConfig } from '@/core/scene/Scene';
import { Button } from '@/components/ui/base/Button';
import { useGameStore } from '@/utils/gameStore';

export interface GameOverSceneConfig extends SceneConfig {
  showStats?: boolean;
  enableSocialSharing?: boolean;
  showLeaderboard?: boolean;
  autoTransition?: boolean;
  autoTransitionDelay?: number;
}

/**
 * Game Over Scene Implementation
 * Results display with restart options and statistics
 */
export class GameOverScene extends BaseScene {
  private config: GameOverSceneConfig;
  private playAgainButton: Button | null = null;
  private mainMenuButton: Button | null = null;
  private shareButton: Button | null = null;
  private leaderboardButton: Button | null = null;
  private finalScore: number = 0;
  private isNewHighScore: boolean = false;
  private autoTransitionTimer: number | null = null;

  constructor(config: GameOverSceneConfig = {}) {
    super('gameover');
    this.config = config;
  }

  protected async createUI(): Promise<void> {
    const gameState = useGameStore.getState();
    this.finalScore = gameState.score;
    this.isNewHighScore = gameState.score > gameState.highScore;

    this.uiElement = document.createElement('div');
    this.uiElement.className = 'game-over-scene';
    
    // Create main structure
    this.uiElement.innerHTML = `
      <div class="game-over-container">
        <header class="game-over-header">
          ${this.isNewHighScore ? `
            <div class="new-record-banner">
              <div class="record-icon">🏆</div>
              <h2 class="record-title">New High Score!</h2>
              <div class="record-celebration">
                <span class="celebration-particle">✨</span>
                <span class="celebration-particle">🎉</span>
                <span class="celebration-particle">⭐</span>
                <span class="celebration-particle">💫</span>
              </div>
            </div>
          ` : `
            <h2 class="game-over-title">Game Over</h2>
            <p class="game-over-subtitle">Better luck next time!</p>
          `}
        </header>
        
        <main class="game-over-content">
          <div class="final-score-section">
            <div class="score-card">
              <div class="score-label">Final Score</div>
              <div class="score-value" id="final-score-value">${this.finalScore.toLocaleString()}</div>
              ${this.isNewHighScore ? '<div class="score-badge">Personal Best!</div>' : ''}
            </div>
          </div>
          
          ${this.config.showStats !== false ? this.createStatsSection() : ''}
          
          <div class="actions-section">
            <div class="primary-actions">
              <!-- Primary buttons will be added here -->
            </div>
            
            <div class="secondary-actions">
              <!-- Secondary buttons will be added here -->
            </div>
          </div>
          
          ${this.config.enableSocialSharing ? this.createSharingSection() : ''}
          ${this.config.showLeaderboard ? this.createLeaderboardSection() : ''}
        </main>
        
        <footer class="game-over-footer">
          <div class="encouragement-message">
            ${this.getEncouragementMessage()}
          </div>
          
          ${this.config.autoTransition ? `
            <div class="auto-transition-timer">
              <p>Returning to menu in <span id="countdown">10</span> seconds...</p>
              <div class="timer-progress">
                <div class="timer-bar" id="timer-bar"></div>
              </div>
            </div>
          ` : ''}
        </footer>
      </div>
    `;

    // Create buttons
    this.createButtons();
    
    // Apply styles
    this.applyStyles();
    
    // Start animations
    this.startAnimations();
    
    // Start auto transition if enabled
    if (this.config.autoTransition) {
      this.startAutoTransition();
    }

    if (this.uiContainer) {
      this.uiContainer.appendChild(this.uiElement);
    }
  }

  protected async destroyUI(): Promise<void> {
    // Clear auto transition timer
    if (this.autoTransitionTimer) {
      clearInterval(this.autoTransitionTimer);
      this.autoTransitionTimer = null;
    }

    // Cleanup buttons
    if (this.playAgainButton) this.playAgainButton.destroy();
    if (this.mainMenuButton) this.mainMenuButton.destroy();
    if (this.shareButton) this.shareButton.destroy();
    if (this.leaderboardButton) this.leaderboardButton.destroy();

    if (this.uiElement && this.uiElement.parentElement) {
      this.uiElement.parentElement.removeChild(this.uiElement);
    }
    this.uiElement = null;
  }

  private createStatsSection(): string {
    const gameState = useGameStore.getState();
    const playTime = this.calculatePlayTime(); // Would need to track this in game state
    const accuracy = this.calculateAccuracy(); // Would need to track this in game state
    
    return `
      <div class="stats-section">
        <h3 class="stats-title">Game Statistics</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-label">Level Reached</div>
            <div class="stat-value">${gameState.level}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-label">Play Time</div>
            <div class="stat-value">${playTime}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-label">Accuracy</div>
            <div class="stat-value">${accuracy}%</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">💎</div>
            <div class="stat-label">Best Score</div>
            <div class="stat-value">${Math.max(gameState.score, gameState.highScore).toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;
  }

  private createSharingSection(): string {
    return `
      <div class="sharing-section">
        <h3 class="sharing-title">Share Your Achievement</h3>
        <div class="sharing-buttons">
          <button class="share-btn share-twitter" data-platform="twitter">
            <span class="share-icon">🐦</span>
            <span class="share-text">Tweet</span>
          </button>
          
          <button class="share-btn share-facebook" data-platform="facebook">
            <span class="share-icon">📘</span>
            <span class="share-text">Share</span>
          </button>
          
          <button class="share-btn share-copy" data-platform="copy">
            <span class="share-icon">📋</span>
            <span class="share-text">Copy</span>
          </button>
        </div>
      </div>
    `;
  }

  private createLeaderboardSection(): string {
    return `
      <div class="leaderboard-section">
        <h3 class="leaderboard-title">Recent High Scores</h3>
        <div class="leaderboard-list">
          <!-- Leaderboard would be populated dynamically -->
          <div class="leaderboard-placeholder">
            <p>Connect to see global leaderboard</p>
          </div>
        </div>
      </div>
    `;
  }

  private createButtons(): void {
    const primaryContainer = this.uiElement?.querySelector('.primary-actions');
    const secondaryContainer = this.uiElement?.querySelector('.secondary-actions');
    
    if (!primaryContainer || !secondaryContainer) return;

    // Play Again button (primary action)
    this.playAgainButton = Button.primary('Play Again', () => {
      this.restartGame();
    }, {
      size: 'xl',
      fullWidth: true,
      className: 'play-again-button'
    });
    primaryContainer.appendChild(this.playAgainButton.getElement());

    // Main Menu button
    this.mainMenuButton = Button.secondary('Main Menu', () => {
      this.goToMainMenu();
    }, {
      size: 'lg',
      className: 'main-menu-button'
    });
    secondaryContainer.appendChild(this.mainMenuButton.getElement());

    // Share button (if sharing is enabled)
    if (this.config.enableSocialSharing) {
      this.shareButton = Button.outline('Share Score', () => {
        this.shareScore();
      }, {
        size: 'lg',
        className: 'share-score-button'
      });
      secondaryContainer.appendChild(this.shareButton.getElement());
    }

    // Leaderboard button (if leaderboard is enabled)
    if (this.config.showLeaderboard) {
      this.leaderboardButton = Button.ghost('View Leaderboard', () => {
        this.showLeaderboard();
      }, {
        size: 'lg',
        className: 'leaderboard-button'
      });
      secondaryContainer.appendChild(this.leaderboardButton.getElement());
    }

    // Add sharing event listeners if enabled
    if (this.config.enableSocialSharing) {
      this.setupSharingEvents();
    }
  }

  private applyStyles(): void {
    if (!this.uiElement) return;

    const style = document.createElement('style');
    style.textContent = `
      .game-over-scene {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--gradient-bg);
        overflow-y: auto;
      }

      .game-over-container {
        max-width: 600px;
        width: 90%;
        display: flex;
        flex-direction: column;
        gap: var(--space-2xl);
        text-align: center;
        padding: var(--space-lg);
      }

      .game-over-header {
        animation: slideInDown 0.8s ease-out;
      }

      .new-record-banner {
        position: relative;
        background: var(--gradient-primary);
        border-radius: var(--radius-xl);
        padding: var(--space-2xl);
        overflow: hidden;
      }

      .record-icon {
        font-size: var(--font-5xl);
        margin-bottom: var(--space-md);
        animation: bounce 2s ease-in-out infinite;
      }

      .record-title {
        font-size: var(--font-3xl);
        font-weight: 900;
        color: white;
        margin: 0;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .record-celebration {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .celebration-particle {
        position: absolute;
        font-size: var(--font-lg);
        animation: celebrate 3s ease-in-out infinite;
      }

      .celebration-particle:nth-child(1) {
        top: 20%;
        left: 10%;
        animation-delay: 0s;
      }

      .celebration-particle:nth-child(2) {
        top: 30%;
        right: 15%;
        animation-delay: 0.5s;
      }

      .celebration-particle:nth-child(3) {
        bottom: 25%;
        left: 20%;
        animation-delay: 1s;
      }

      .celebration-particle:nth-child(4) {
        bottom: 35%;
        right: 10%;
        animation-delay: 1.5s;
      }

      .game-over-title {
        font-size: var(--font-4xl);
        font-weight: 900;
        color: var(--text-primary);
        margin-bottom: var(--space-sm);
      }

      .game-over-subtitle {
        font-size: var(--font-lg);
        color: var(--text-secondary);
        margin: 0;
      }

      .game-over-content {
        display: flex;
        flex-direction: column;
        gap: var(--space-xl);
      }

      .final-score-section {
        animation: scaleIn 0.6s ease-out 0.3s both;
      }

      .score-card {
        background: var(--bg-secondary);
        border: 2px solid var(--border-primary);
        border-radius: var(--radius-xl);
        padding: var(--space-2xl);
        position: relative;
        overflow: hidden;
      }

      .score-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--gradient-primary);
        opacity: 0.1;
        z-index: 0;
      }

      .score-label {
        font-size: var(--font-sm);
        color: var(--text-secondary);
        margin-bottom: var(--space-sm);
        position: relative;
        z-index: 1;
      }

      .score-value {
        font-size: var(--font-5xl);
        font-weight: 900;
        color: var(--accent-primary);
        margin-bottom: var(--space-sm);
        position: relative;
        z-index: 1;
        animation: countUp 1s ease-out 0.5s both;
      }

      .score-badge {
        background: var(--accent-primary);
        color: white;
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-full);
        font-size: var(--font-sm);
        font-weight: 600;
        display: inline-block;
        position: relative;
        z-index: 1;
      }

      .stats-section {
        animation: slideInUp 0.6s ease-out 0.6s both;
      }

      .stats-title {
        font-size: var(--font-xl);
        color: var(--text-primary);
        margin-bottom: var(--space-lg);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--space-md);
      }

      .stat-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: all var(--transition-base);
      }

      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      .stat-icon {
        font-size: var(--font-2xl);
        margin-bottom: var(--space-sm);
      }

      .stat-label {
        font-size: var(--font-xs);
        color: var(--text-secondary);
        margin-bottom: var(--space-xs);
      }

      .stat-value {
        font-size: var(--font-lg);
        font-weight: 700;
        color: var(--accent-primary);
      }

      .actions-section {
        animation: slideInUp 0.6s ease-out 0.9s both;
      }

      .primary-actions {
        margin-bottom: var(--space-lg);
      }

      .secondary-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        justify-content: center;
      }

      .sharing-section,
      .leaderboard-section {
        animation: fadeIn 0.6s ease-out 1.2s both;
      }

      .sharing-title,
      .leaderboard-title {
        font-size: var(--font-lg);
        color: var(--text-primary);
        margin-bottom: var(--space-md);
      }

      .sharing-buttons {
        display: flex;
        gap: var(--space-md);
        justify-content: center;
        flex-wrap: wrap;
      }

      .share-btn {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-lg);
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        color: var(--text-primary);
        cursor: pointer;
        transition: all var(--transition-base);
        font-size: var(--font-sm);
      }

      .share-btn:hover {
        background: var(--bg-tertiary);
        transform: translateY(-1px);
      }

      .game-over-footer {
        animation: fadeIn 0.6s ease-out 1.5s both;
      }

      .encouragement-message {
        font-size: var(--font-base);
        color: var(--text-secondary);
        font-style: italic;
        margin-bottom: var(--space-lg);
        padding: var(--space-lg);
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        border-left: 4px solid var(--accent-primary);
      }

      .auto-transition-timer {
        text-align: center;
      }

      .timer-progress {
        width: 100%;
        height: 4px;
        background: var(--bg-tertiary);
        border-radius: var(--radius-full);
        overflow: hidden;
        margin-top: var(--space-sm);
      }

      .timer-bar {
        height: 100%;
        background: var(--accent-primary);
        border-radius: var(--radius-full);
        transition: width 0.1s linear;
      }

      @keyframes slideInDown {
        from {
          opacity: 0;
          transform: translateY(-30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes scaleIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes countUp {
        from {
          opacity: 0;
          transform: scale(0.5);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes celebrate {
        0%, 100% {
          transform: translateY(0) rotate(0deg);
          opacity: 0.8;
        }
        50% {
          transform: translateY(-10px) rotate(180deg);
          opacity: 1;
        }
      }

      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-20px);
        }
        60% {
          transform: translateY(-10px);
        }
      }

      /* Mobile optimizations */
      @media (max-width: 640px) {
        .game-over-container {
          gap: var(--space-xl);
          padding: var(--space-md);
        }
        
        .score-value {
          font-size: var(--font-4xl);
        }
        
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .secondary-actions {
          flex-direction: column;
          align-items: center;
        }
        
        .sharing-buttons {
          flex-direction: column;
          align-items: center;
        }
      }

      /* Reduce motion */
      @media (prefers-reduced-motion: reduce) {
        .game-over-header,
        .final-score-section,
        .stats-section,
        .actions-section,
        .sharing-section,
        .leaderboard-section,
        .game-over-footer {
          animation: none;
        }
        
        .celebration-particle,
        .record-icon {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private startAnimations(): void {
    // Start score count-up animation
    const scoreElement = this.uiElement?.querySelector('#final-score-value');
    if (scoreElement) {
      this.animateScoreCountUp(scoreElement as HTMLElement);
    }
  }

  private animateScoreCountUp(element: HTMLElement): void {
    const targetScore = this.finalScore;
    const duration = 2000;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentScore = Math.floor(targetScore * easeOut);
      
      element.textContent = currentScore.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  private startAutoTransition(): void {
    if (!this.config.autoTransition) return;
    
    const delay = this.config.autoTransitionDelay || 10000; // 10 seconds default
    const countdownElement = this.uiElement?.querySelector('#countdown');
    const timerBarElement = this.uiElement?.querySelector('#timer-bar') as HTMLElement;
    
    let timeLeft = delay / 1000;
    
    this.autoTransitionTimer = window.setInterval(() => {
      timeLeft--;
      
      if (countdownElement) {
        countdownElement.textContent = timeLeft.toString();
      }
      
      if (timerBarElement) {
        const progress = ((delay / 1000 - timeLeft) / (delay / 1000)) * 100;
        timerBarElement.style.width = `${progress}%`;
      }
      
      if (timeLeft <= 0) {
        this.goToMainMenu();
      }
    }, 1000);
  }

  private setupSharingEvents(): void {
    const shareButtons = this.uiElement?.querySelectorAll('.share-btn');
    shareButtons?.forEach(button => {
      button.addEventListener('click', (e) => {
        const platform = (e.currentTarget as HTMLElement).getAttribute('data-platform');
        this.handleShare(platform);
      });
    });
  }

  private handleShare(platform: string | null): void {
    const shareText = `I just scored ${this.finalScore.toLocaleString()} points in Open Runner! ${this.isNewHighScore ? '🏆 New personal best!' : ''} Can you beat my score?`;
    const shareUrl = window.location.href;
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
          this.showCopyFeedback();
        });
        break;
    }
  }

  private showCopyFeedback(): void {
    const copyButton = this.uiElement?.querySelector('.share-copy .share-text');
    if (copyButton) {
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Copied!';
      
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
    }
  }

  private calculatePlayTime(): string {
    // This would need to be tracked in the game state
    // For now, return a placeholder
    const minutes = Math.floor(Math.random() * 10) + 1;
    const seconds = Math.floor(Math.random() * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private calculateAccuracy(): number {
    // This would need to be tracked in the game state
    // For now, return a placeholder
    return Math.floor(Math.random() * 40) + 60;
  }

  private getEncouragementMessage(): string {
    const messages = [
      "Every expert was once a beginner. Keep practicing!",
      "The only way to improve is to keep playing. Try again!",
      "Great effort! Your skills are developing with each game.",
      "Challenge yourself to beat your own record!",
      "Remember: it's not about being perfect, it's about getting better.",
      "The journey of a thousand miles begins with a single step.",
      "Each game is a new opportunity to excel!",
      "Your persistence will pay off. Keep going!",
      "Focus on the fun, and the scores will follow.",
      "Every professional runner started where you are now."
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private restartGame(): void {
    // Clear auto transition
    if (this.autoTransitionTimer) {
      clearInterval(this.autoTransitionTimer);
      this.autoTransitionTimer = null;
    }
    
    // Reset game state
    useGameStore.getState().resetGame();
    
    // Transition to gameplay scene
    useGameStore.getState().setScene('gameplay');
    this.manager?.transitionTo('gameplay', {
      type: 'fade',
      duration: 500
    });
  }

  private goToMainMenu(): void {
    // Clear auto transition
    if (this.autoTransitionTimer) {
      clearInterval(this.autoTransitionTimer);
      this.autoTransitionTimer = null;
    }
    
    // Transition to title scene
    useGameStore.getState().setScene('menu');
    this.manager?.transitionTo('title', {
      type: 'slide',
      direction: 'right',
      duration: 600
    });
  }

  private shareScore(): void {
    if (navigator.share) {
      // Use native sharing if available
      navigator.share({
        title: 'Open Runner Score',
        text: `I just scored ${this.finalScore.toLocaleString()} points in Open Runner!`,
        url: window.location.href
      });
    } else {
      // Fallback to manual sharing
      this.handleShare('copy');
    }
  }

  private showLeaderboard(): void {
    // This would open a leaderboard modal or navigate to a leaderboard scene
    console.log('Show leaderboard functionality would be implemented here');
  }

  public update(deltaTime: number): void {
    // Update any animations or timer logic
  }

  public render(): void {
    // Rendering is handled by CSS and DOM
  }

  public async enter(): Promise<void> {
    await super.enter();
    
    // Trigger entrance animations
    this.startAnimations();
    
    // Save high score if it's a new record
    if (this.isNewHighScore) {
      useGameStore.getState().updateHighScore(this.finalScore);
    }
  }

  public async exit(): Promise<void> {
    // Clear any running timers
    if (this.autoTransitionTimer) {
      clearInterval(this.autoTransitionTimer);
      this.autoTransitionTimer = null;
    }
    
    await super.exit();
  }
}