import { useGameStore } from '../../stores/gameStore';
import { GameState } from '../../types/game';
import { audioManager } from '../../utils/audioManager';

const PauseMenu: React.FC = () => {
  const { setGameState, restartGame } = useGameStore();
  
  const handleResume = () => {
    audioManager.playSound('buttonsound', 0.7);
    setGameState(GameState.PLAYING);
  };
  
  const handleRestart = () => {
    audioManager.playSound('buttonsound', 0.7);
    restartGame();
  };
  
  const handleReturnToTitle = () => {
    audioManager.playSound('buttonsound', 0.7);
    setGameState(GameState.TITLE);
  };
  
  const buttonStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, #2a2a3e, #1a1a2e)',
    border: '2px solid #4a9eff',
    borderRadius: '8px',
    color: '#4a9eff',
    fontSize: '1.3rem',
    padding: '12px 25px',
    margin: '8px',
    cursor: 'pointer',
    fontFamily: 'Orbitron, monospace',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    minWidth: '180px',
    textTransform: 'uppercase'
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Orbitron, monospace',
      color: 'white',
      zIndex: 1000
    }}>
      <h1 style={{
        fontSize: '3rem',
        marginBottom: '2rem',
        color: '#4a9eff',
        textShadow: '0 0 20px #4a9eff',
        textAlign: 'center'
      }}>
        PAUSED
      </h1>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <button
          style={buttonStyle}
          onClick={handleResume}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #4a9eff, #2196f3)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(74, 158, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
            e.currentTarget.style.color = '#4a9eff';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Resume Game
        </button>
        
        <button
          style={{...buttonStyle, borderColor: '#ffa726', color: '#ffa726'}}
          onClick={handleRestart}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #ffa726, #ff9800)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 167, 38, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
            e.currentTarget.style.color = '#ffa726';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Restart Level
        </button>
        
        <button
          style={{...buttonStyle, borderColor: '#888', color: '#888'}}
          onClick={handleReturnToTitle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #888, #666)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(136, 136, 136, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
            e.currentTarget.style.color = '#888';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Return to Title
        </button>
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '40px',
        textAlign: 'center',
        fontSize: '0.9rem',
        opacity: 0.6,
        animation: 'fadeInOut 2s infinite'
      }}>
        Press ESC to resume
      </div>
      
      <style>
        {`
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
};

export default PauseMenu;