import { useGameStore } from '../../stores/gameStore';
import { GameState } from '../../types/game';
import { audioManager } from '../../utils/audioManager';

const TitleScreen: React.FC = () => {
  const { setGameState, setCurrentLevel } = useGameStore();
  
  const handleStartGame = () => {
    audioManager.playSound('buttonsound', 0.7);
    setCurrentLevel('level1');
    setGameState(GameState.LOADING_LEVEL);
  };
  
  const handleLevelSelect = () => {
    audioManager.playSound('buttonsound', 0.7);
    setGameState(GameState.LEVEL_SELECT);
  };
  
  const buttonStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, #2a2a3e, #1a1a2e)',
    border: '2px solid #00ff00',
    borderRadius: '8px',
    color: '#00ff00',
    fontSize: '1.5rem',
    padding: '15px 30px',
    margin: '10px',
    cursor: 'pointer',
    fontFamily: 'Orbitron, monospace',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    minWidth: '200px',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Orbitron, monospace',
      color: 'white',
      zIndex: 1000
    }}>
      <h1 style={{
        fontSize: '4rem',
        marginBottom: '3rem',
        textShadow: '0 0 30px #00ff00',
        animation: 'titleGlow 3s ease-in-out infinite alternate',
        textAlign: 'center'
      }}>
        Open Runner
      </h1>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <button
          style={buttonStyle}
          onClick={handleStartGame}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #00ff00, #00aa00)';
            e.currentTarget.style.color = '#1a1a2e';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
            e.currentTarget.style.color = '#00ff00';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Start Game
        </button>
        
        <button
          style={buttonStyle}
          onClick={handleLevelSelect}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #00ff00, #00aa00)';
            e.currentTarget.style.color = '#1a1a2e';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
            e.currentTarget.style.color = '#00ff00';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Select Level
        </button>
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '40px',
        textAlign: 'center',
        fontSize: '0.9rem',
        opacity: 0.7,
        animation: 'fadeInOut 2s infinite'
      }}>
        <p>Controls: A/D or Arrow Keys to steer • ESC to pause • F to toggle FPS</p>
        <p>Collect coins and avoid obstacles!</p>
      </div>
      
      <style>
        {`
          @keyframes titleGlow {
            from { 
              text-shadow: 0 0 30px #00ff00; 
              transform: scale(1);
            }
            to { 
              text-shadow: 0 0 40px #00ff00, 0 0 60px #00ff00; 
              transform: scale(1.02);
            }
          }
          
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
    </div>
  );
};

export default TitleScreen;