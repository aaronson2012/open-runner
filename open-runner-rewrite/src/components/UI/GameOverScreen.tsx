import { useGameStore } from '../../stores/gameStore';
import { GameState } from '../../types/game';
import { audioManager } from '../../utils/audioManager';

const GameOverScreen: React.FC = () => {
  const { score, restartGame, setGameState } = useGameStore();
  
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
    border: '2px solid #ff6b6b',
    borderRadius: '8px',
    color: '#ff6b6b',
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
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Orbitron, monospace',
      color: 'white',
      zIndex: 1000
    }}>
      <h1 style={{
        fontSize: '3.5rem',
        marginBottom: '2rem',
        color: '#ff6b6b',
        textShadow: '0 0 20px #ff6b6b',
        animation: 'gameOverPulse 2s ease-in-out infinite',
        textAlign: 'center'
      }}>
        GAME OVER!
      </h1>
      
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '15px',
        padding: '30px',
        marginBottom: '2rem',
        textAlign: 'center',
        border: '2px solid rgba(255, 255, 255, 0.2)'
      }}>
        <h2 style={{
          fontSize: '1.8rem',
          marginBottom: '15px',
          color: '#00ff00'
        }}>
          Final Score: {score.current}
        </h2>
        
        {score.current === score.high && score.current > 0 && (
          <div style={{
            color: '#ffd700',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            textShadow: '0 0 10px #ffd700',
            marginBottom: '10px',
            animation: 'highScoreGlow 1s ease-in-out infinite alternate'
          }}>
            🏆 NEW HIGH SCORE! 🏆
          </div>
        )}
        
        <div style={{
          fontSize: '1.1rem',
          opacity: 0.8
        }}>
          High Score: {score.high}
        </div>
      </div>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <button
          style={buttonStyle}
          onClick={handleRestart}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #ff6b6b, #ff5252)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 107, 107, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
            e.currentTarget.style.color = '#ff6b6b';
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
        Press R to restart or ESC to return to title
      </div>
      
      <style>
        {`
          @keyframes gameOverPulse {
            0%, 100% { 
              transform: scale(1);
              text-shadow: 0 0 20px #ff6b6b;
            }
            50% { 
              transform: scale(1.05);
              text-shadow: 0 0 30px #ff6b6b, 0 0 40px #ff6b6b;
            }
          }
          
          @keyframes highScoreGlow {
            from { text-shadow: 0 0 10px #ffd700; }
            to { text-shadow: 0 0 20px #ffd700, 0 0 30px #ffd700; }
          }
          
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
};

export default GameOverScreen;