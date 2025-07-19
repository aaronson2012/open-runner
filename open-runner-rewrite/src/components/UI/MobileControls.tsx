import { useGameStore } from '../../stores/gameStore';
import { GameState } from '../../types/game';
import { audioManager } from '../../utils/audioManager';

const MobileControls: React.FC = () => {
  const { setGameState } = useGameStore();
  
  const handlePause = () => {
    audioManager.playSound('buttonclick2', 0.5);
    setGameState(GameState.PAUSED);
  };
  
  const handleLeft = () => {
    // Mobile left movement will be handled by dispatching keyboard events
    // or by directly updating the player state
    const event = new KeyboardEvent('keydown', { key: 'a' });
    window.dispatchEvent(event);
  };
  
  const handleRight = () => {
    // Mobile right movement
    const event = new KeyboardEvent('keydown', { key: 'd' });
    window.dispatchEvent(event);
  };
  
  const handleLeftUp = () => {
    const event = new KeyboardEvent('keyup', { key: 'a' });
    window.dispatchEvent(event);
  };
  
  const handleRightUp = () => {
    const event = new KeyboardEvent('keyup', { key: 'd' });
    window.dispatchEvent(event);
  };
  
  const buttonStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.7)',
    border: '2px solid #00ff00',
    borderRadius: '50%',
    color: '#00ff00',
    fontSize: '24px',
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    pointerEvents: 'auto',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold'
  };
  
  const pauseButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    position: 'absolute',
    top: '20px',
    right: '20px',
    fontSize: '20px'
  };
  
  return (
    <>
      {/* Pause Button */}
      <button
        style={pauseButtonStyle}
        onTouchStart={handlePause}
        onClick={handlePause}
      >
        ⏸️
      </button>
      
      {/* Steering Controls */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '40px',
        pointerEvents: 'auto'
      }}>
        {/* Left Button */}
        <button
          style={buttonStyle}
          onTouchStart={handleLeft}
          onTouchEnd={handleLeftUp}
          onMouseDown={handleLeft}
          onMouseUp={handleLeftUp}
          onMouseLeave={handleLeftUp}
        >
          ◀
        </button>
        
        {/* Right Button */}
        <button
          style={buttonStyle}
          onTouchStart={handleRight}
          onTouchEnd={handleRightUp}
          onMouseDown={handleRight}
          onMouseUp={handleRightUp}
          onMouseLeave={handleRightUp}
        >
          ▶
        </button>
      </div>
    </>
  );
};

export default MobileControls;