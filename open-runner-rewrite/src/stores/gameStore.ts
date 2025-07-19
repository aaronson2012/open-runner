import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GameState, PlayerState, ScoreState, PowerupState } from '../types/game';
import * as THREE from 'three';

interface GameStore {
  // Game state
  gameState: GameState;
  currentLevel: string;
  isLoading: boolean;
  
  // Player state
  player: PlayerState;
  
  // Score state  
  score: ScoreState;
  
  // Powerup state
  powerup: PowerupState | null;
  
  // UI state
  showFPS: boolean;
  isMobile: boolean;
  
  // Actions
  setGameState: (state: GameState) => void;
  setCurrentLevel: (level: string) => void;
  setLoading: (loading: boolean) => void;
  updatePlayerPosition: (position: THREE.Vector3) => void;
  updatePlayerSpeed: (speed: number) => void;
  setPlayerPowerup: (powerup: string) => void;
  updatePlayerAnimationTime: (time: number) => void;
  addScore: (points: number) => void;
  resetScore: () => void;
  setHighScore: (score: number) => void;
  setScoreMultiplier: (multiplier: number) => void;
  activatePowerup: (type: string, duration: number) => void;
  updatePowerupTime: (deltaTime: number) => void;
  clearPowerup: () => void;
  toggleFPS: () => void;
  setMobile: (mobile: boolean) => void;
  restartGame: () => void;
}

const getStoredHighScore = (): number => {
  try {
    return parseInt(localStorage.getItem('openRunnerHighScore') || '0', 10);
  } catch {
    return 0;
  }
};

const setStoredHighScore = (score: number): void => {
  try {
    localStorage.setItem('openRunnerHighScore', score.toString());
  } catch {
    // Ignore storage errors
  }
};

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    gameState: GameState.LOADING,
    currentLevel: 'level1',
    isLoading: false,
    
    player: {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Vector3(0, 0, 0),
      speed: 50,
      currentPowerup: '',
      animationTime: 0
    },
    
    score: {
      current: 0,
      high: getStoredHighScore(),
      multiplier: 1
    },
    
    powerup: null,
    
    showFPS: false,
    isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    
    // Actions
    setGameState: (state) => set({ gameState: state }),
    
    setCurrentLevel: (level) => set({ currentLevel: level }),
    
    setLoading: (loading) => set({ isLoading: loading }),
    
    updatePlayerPosition: (position) => 
      set((state) => ({ 
        player: { ...state.player, position: position.clone() } 
      })),
    
    updatePlayerSpeed: (speed) => 
      set((state) => ({ 
        player: { ...state.player, speed } 
      })),
    
    setPlayerPowerup: (powerup) => 
      set((state) => ({ 
        player: { ...state.player, currentPowerup: powerup } 
      })),
    
    updatePlayerAnimationTime: (time) => 
      set((state) => ({ 
        player: { ...state.player, animationTime: time } 
      })),
    
    addScore: (points) => {
      const state = get();
      const finalPoints = points * state.score.multiplier;
      const newScore = state.score.current + finalPoints;
      
      set((prevState) => ({
        score: { ...prevState.score, current: newScore }
      }));
      
      // Update high score if needed
      if (newScore > state.score.high) {
        const newHighScore = newScore;
        set((prevState) => ({
          score: { ...prevState.score, high: newHighScore }
        }));
        setStoredHighScore(newHighScore);
      }
    },
    
    resetScore: () => 
      set((state) => ({ 
        score: { ...state.score, current: 0, multiplier: 1 } 
      })),
    
    setHighScore: (score) => {
      set((state) => ({ 
        score: { ...state.score, high: score } 
      }));
      setStoredHighScore(score);
    },
    
    setScoreMultiplier: (multiplier) => 
      set((state) => ({ 
        score: { ...state.score, multiplier } 
      })),
    
    activatePowerup: (type, duration) => 
      set({ 
        powerup: { type, duration, timeRemaining: duration } 
      }),
    
    updatePowerupTime: (deltaTime) => {
      const state = get();
      if (!state.powerup) return;
      
      const newTimeRemaining = state.powerup.timeRemaining - deltaTime * 1000;
      
      if (newTimeRemaining <= 0) {
        set({ powerup: null });
        get().setPlayerPowerup('');
        get().setScoreMultiplier(1);
      } else {
        set((prevState) => ({
          powerup: prevState.powerup ? {
            ...prevState.powerup,
            timeRemaining: newTimeRemaining
          } : null
        }));
      }
    },
    
    clearPowerup: () => {
      set({ powerup: null });
      get().setPlayerPowerup('');
      get().setScoreMultiplier(1);
    },
    
    toggleFPS: () => set((state) => ({ showFPS: !state.showFPS })),
    
    setMobile: (mobile) => set({ isMobile: mobile }),
    
    restartGame: () => {
      set((state) => ({
        gameState: GameState.LOADING_LEVEL,
        player: {
          position: new THREE.Vector3(0, 0, 0),
          rotation: new THREE.Vector3(0, 0, 0),
          speed: 50,
          currentPowerup: '',
          animationTime: 0
        },
        score: { ...state.score, current: 0, multiplier: 1 },
        powerup: null
      }));
    }
  }))
);

// Subscribe to score changes to check for level progression
useGameStore.subscribe(
  (state) => state.score.current,
  (currentScore) => {
    const state = useGameStore.getState();
    if (currentScore >= 300 && state.currentLevel === 'level1' && state.gameState === GameState.PLAYING) {
      // Unlock level 2 - for now just log it
      console.log('Level 2 unlocked!');
    }
  }
);