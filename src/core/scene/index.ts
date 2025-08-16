/**
 * Scene System Exports
 * Centralized exports for the complete scene management system
 */

// Core scene system
export { SceneManager, type TransitionOptions } from './SceneManager';
export { BaseScene, type Scene, type SceneConfig, type SceneState } from './Scene';

// Scene implementations
export { LoadingScene, type LoadingSceneConfig } from '../scenes/loading/LoadingScene';
export { TitleScene, type TitleSceneConfig } from '../scenes/title/TitleScene';
export { GameplayScene, type GameplaySceneConfig } from '../scenes/gameplay/GameplayScene';
export { GameOverScene, type GameOverSceneConfig } from '../scenes/gameover/GameOverScene';

// UI Components
export { UIComponent, type UIComponentConfig } from '../components/ui/base/UIComponent';
export { Button, type ButtonConfig } from '../components/ui/base/Button';
export { Modal, type ModalConfig, type ModalButton } from '../components/ui/base/Modal';
export { ProgressBar, type ProgressBarConfig } from '../components/ui/base/ProgressBar';

// Controls
export { TouchController, type TouchControllerConfig } from '../components/ui/controls/TouchController';

/**
 * Scene Factory
 * Creates and configures scenes for the game
 */
export class SceneFactory {
  /**
   * Create a loading scene
   */
  static createLoadingScene(config?: Partial<LoadingSceneConfig>): LoadingScene {
    return new LoadingScene({
      name: 'loading',
      showProgress: true,
      minimumLoadTime: 2000,
      ...config
    });
  }

  /**
   * Create a title scene
   */
  static createTitleScene(config?: Partial<TitleSceneConfig>): TitleScene {
    return new TitleScene({
      name: 'title',
      showBackground: true,
      enableParticles: true,
      ...config
    });
  }

  /**
   * Create a gameplay scene
   */
  static createGameplayScene(config?: Partial<GameplaySceneConfig>): GameplayScene {
    return new GameplayScene({
      name: 'gameplay',
      enableTouchControls: true,
      enablePause: true,
      enableHUD: true,
      showDebugInfo: process.env.NODE_ENV === 'development',
      ...config
    });
  }

  /**
   * Create a game over scene
   */
  static createGameOverScene(config?: Partial<GameOverSceneConfig>): GameOverScene {
    return new GameOverScene({
      name: 'gameover',
      showStats: true,
      enableSocialSharing: true,
      showLeaderboard: false,
      autoTransition: false,
      ...config
    });
  }

  /**
   * Create all scenes for the game
   */
  static createAllScenes(): {
    loading: LoadingScene;
    title: TitleScene;
    gameplay: GameplayScene;
    gameover: GameOverScene;
  } {
    return {
      loading: this.createLoadingScene(),
      title: this.createTitleScene(),
      gameplay: this.createGameplayScene(),
      gameover: this.createGameOverScene()
    };
  }
}

/**
 * Game Scene Manager Setup
 * Utility function to set up the complete scene system
 */
export function setupGameScenes(
  canvas: HTMLCanvasElement,
  uiContainer: HTMLElement
): SceneManager {
  const sceneManager = new SceneManager(canvas, uiContainer);
  const scenes = SceneFactory.createAllScenes();

  // Register all scenes
  Object.entries(scenes).forEach(([name, scene]) => {
    sceneManager.registerScene(name, scene);
  });

  return sceneManager;
}

/**
 * Scene Configuration Presets
 */
export const ScenePresets = {
  /**
   * Desktop configuration
   */
  desktop: {
    loading: {
      showProgress: true,
      minimumLoadTime: 1500
    },
    title: {
      showBackground: true,
      enableParticles: true
    },
    gameplay: {
      enableTouchControls: false,
      showDebugInfo: true
    },
    gameover: {
      showStats: true,
      enableSocialSharing: true,
      autoTransition: false
    }
  },

  /**
   * Mobile configuration
   */
  mobile: {
    loading: {
      showProgress: true,
      minimumLoadTime: 2500
    },
    title: {
      showBackground: true,
      enableParticles: false // Better performance
    },
    gameplay: {
      enableTouchControls: true,
      showDebugInfo: false
    },
    gameover: {
      showStats: true,
      enableSocialSharing: true,
      autoTransition: true,
      autoTransitionDelay: 15000
    }
  },

  /**
   * Debug configuration
   */
  debug: {
    loading: {
      showProgress: true,
      minimumLoadTime: 500
    },
    title: {
      showBackground: true,
      enableParticles: true
    },
    gameplay: {
      enableTouchControls: true,
      showDebugInfo: true
    },
    gameover: {
      showStats: true,
      enableSocialSharing: false,
      autoTransition: true,
      autoTransitionDelay: 5000
    }
  }
};

/**
 * Device Detection Utility
 */
export function getDevicePreset(): keyof typeof ScenePresets {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isDebug = process.env.NODE_ENV === 'development';
  
  if (isDebug) return 'debug';
  if (isMobile) return 'mobile';
  return 'desktop';
}

/**
 * Setup scenes with device-specific configuration
 */
export function setupGameScenesWithPreset(
  canvas: HTMLCanvasElement,
  uiContainer: HTMLElement,
  preset?: keyof typeof ScenePresets
): SceneManager {
  const devicePreset = preset || getDevicePreset();
  const config = ScenePresets[devicePreset];
  
  const sceneManager = new SceneManager(canvas, uiContainer);
  
  // Create scenes with preset configuration
  const scenes = {
    loading: SceneFactory.createLoadingScene(config.loading),
    title: SceneFactory.createTitleScene(config.title),
    gameplay: SceneFactory.createGameplayScene(config.gameplay),
    gameover: SceneFactory.createGameOverScene(config.gameover)
  };

  // Register all scenes
  Object.entries(scenes).forEach(([name, scene]) => {
    sceneManager.registerScene(name, scene);
  });

  return sceneManager;
}