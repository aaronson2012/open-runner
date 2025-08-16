import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameState, GameSettings, PerformanceMetrics } from '@/types';

interface GameStore extends GameState {
  // Actions
  setScene: (scene: GameState['scene']) => void;
  setPaused: (isPaused: boolean) => void;
  updateScore: (points: number) => void;
  setScore: (score: number) => void;
  updateHighScore: (score: number) => void;
  setLevel: (level: number) => void;
  setLives: (lives: number) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetGame: () => void;
  
  // Performance metrics (not persisted)
  performanceMetrics?: PerformanceMetrics;
  updatePerformanceMetrics: (metrics: PerformanceMetrics) => void;
}

const defaultSettings: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  graphics: 'high',
  controlScheme: 'touch',
  enableVibration: true,
  showFPS: false
};

const defaultState: GameState = {
  scene: 'menu',
  score: 0,
  highScore: 0,
  level: 1,
  lives: 3,
  isPaused: false,
  settings: defaultSettings
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...defaultState,
      performanceMetrics: undefined,

      setScene: (scene) => set({ scene }),
      
      setPaused: (isPaused) => set({ isPaused }),
      
      updateScore: (points) => set((state) => {
        const newScore = state.score + points;
        const newHighScore = Math.max(newScore, state.highScore);
        return { 
          score: newScore, 
          highScore: newHighScore 
        };
      }),
      
      setScore: (score) => set((state) => ({
        score,
        highScore: Math.max(score, state.highScore)
      })),
      
      updateHighScore: (score) => set((state) => ({
        highScore: Math.max(score, state.highScore)
      })),
      
      setLevel: (level) => set({ level }),
      
      setLives: (lives) => set({ lives }),
      
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      resetGame: () => set({
        scene: 'menu',
        score: 0,
        level: 1,
        lives: 3,
        isPaused: false
      }),
      
      updatePerformanceMetrics: (metrics) => set({ performanceMetrics: metrics })
    }),
    {
      name: 'open-runner-game-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields
      partialize: (state) => ({
        highScore: state.highScore,
        settings: state.settings
      })
    }
  )
);

// Selectors for performance
export const useGameScene = () => useGameStore((state) => state.scene);
export const useGameScore = () => useGameStore((state) => state.score);
export const useGameHighScore = () => useGameStore((state) => state.highScore);
export const useGameLevel = () => useGameStore((state) => state.level);
export const useGameLives = () => useGameStore((state) => state.lives);
export const useGamePaused = () => useGameStore((state) => state.isPaused);
export const useGameSettings = () => useGameStore((state) => state.settings);
export const usePerformanceMetrics = () => useGameStore((state) => state.performanceMetrics);

// Action selectors
export const useGameActions = () => useGameStore((state) => ({
  setScene: state.setScene,
  setPaused: state.setPaused,
  updateScore: state.updateScore,
  setScore: state.setScore,
  updateHighScore: state.updateHighScore,
  setLevel: state.setLevel,
  setLives: state.setLives,
  updateSettings: state.updateSettings,
  resetGame: state.resetGame
}));