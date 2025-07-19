import { useGameStore } from '../../stores/gameStore';
import { GameState } from '../../types/game';
import HUD from './HUD';
import MobileControls from './MobileControls';

const UI: React.FC = () => {
  const { gameState, isMobile } = useGameStore();
  
  return (
    <>
      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
        <HUD />
      )}
      
      {isMobile && gameState === GameState.PLAYING && (
        <MobileControls />
      )}
    </>
  );
};

export default UI;