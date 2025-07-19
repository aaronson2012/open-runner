import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useGameStore } from '../stores/gameStore';
import { GameState } from '../types/game';
import { audioManager } from '../utils/audioManager';
import GameScene from './GameScene';
import UI from './UI/UI';
import LoadingScreen from './UI/LoadingScreen';
import TitleScreen from './UI/TitleScreen';
import GameOverScreen from './UI/GameOverScreen';
import PauseMenu from './UI/PauseMenu';
import LevelSelectScreen from './UI/LevelSelectScreen';

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, setGameState, setMobile } = useGameStore();

  useEffect(() => {
    // Initialize audio and detect mobile
    const initGame = async () => {
      // Check if mobile
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setMobile(isMobile);

      // Initialize audio (requires user interaction)
      const handleUserInteraction = async () => {
        await audioManager.init();
        await audioManager.resumeContext();
        setGameState(GameState.TITLE);
        
        // Remove event listeners after first interaction
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      };

      // Add event listeners for user interaction
      document.addEventListener('click', handleUserInteraction, { once: true });
      document.addEventListener('keydown', handleUserInteraction, { once: true });
      document.addEventListener('touchstart', handleUserInteraction, { once: true });
    };

    initGame();

    // Global keyboard event handler
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      switch (key) {
        case 'escape':
          if (gameState === GameState.PLAYING) {
            setGameState(GameState.PAUSED);
          } else if (gameState === GameState.PAUSED) {
            setGameState(GameState.PLAYING);
          } else if (gameState === GameState.LEVEL_SELECT) {
            setGameState(GameState.TITLE);
          }
          break;
        case 'r':
          if (gameState === GameState.GAME_OVER) {
            useGameStore.getState().restartGame();
          }
          break;
        case 'f':
          useGameStore.getState().toggleFPS();
          break;
        case 'l':
          if (gameState === GameState.TITLE) {
            setGameState(GameState.LEVEL_SELECT);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, setGameState, setMobile]);

  const renderScreen = () => {
    switch (gameState) {
      case GameState.LOADING:
        return <LoadingScreen />;
      case GameState.TITLE:
        return <TitleScreen />;
      case GameState.LEVEL_SELECT:
        return <LevelSelectScreen />;
      case GameState.GAME_OVER:
        return <GameOverScreen />;
      case GameState.PAUSED:
        return <PauseMenu />;
      default:
        return null;
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: '100%',
          display: gameState === GameState.LOADING || gameState === GameState.TITLE || 
                   gameState === GameState.LEVEL_SELECT ? 'none' : 'block'
        }}
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
        shadows
      >
        <PerspectiveCamera
          makeDefault
          fov={75}
          aspect={window.innerWidth / window.innerHeight}
          near={0.1}
          far={1000}
          position={[0, 10, 20]}
        />
        
        {(gameState === GameState.PLAYING || 
          gameState === GameState.LOADING_LEVEL || 
          gameState === GameState.TRANSITIONING_TO_GAMEPLAY ||
          gameState === GameState.PAUSED ||
          gameState === GameState.GAME_OVER) && (
          <GameScene />
        )}
      </Canvas>

      {/* UI Overlays */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        pointerEvents: 'none'
      }}>
        <UI />
        {renderScreen()}
      </div>
    </div>
  );
};

export default Game;