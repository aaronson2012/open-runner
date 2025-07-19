import { useGameStore } from '../../stores/gameStore';
import { GameState } from '../../types/game';
import { LEVEL_CONFIGS } from '../../config/gameConfig';
import { audioManager } from '../../utils/audioManager';

const LevelSelectScreen: React.FC = () => {
  const { setGameState, setCurrentLevel, score } = useGameStore();
  
  const handleLevelSelect = (levelId: string) => {
    audioManager.playSound('buttonsound', 0.7);
    setCurrentLevel(levelId);
    setGameState(GameState.LOADING_LEVEL);
  };
  
  const handleBackToTitle = () => {
    audioManager.playSound('buttonclick2', 0.7);
    setGameState(GameState.TITLE);
  };
  
  const isLevelUnlocked = (levelId: string): boolean => {
    if (levelId === 'level1') return true;
    if (levelId === 'level2') return score.high >= 300;
    return false;
  };
  
  const levelButtonStyle = (unlocked: boolean): React.CSSProperties => ({
    background: unlocked 
      ? 'linear-gradient(145deg, #2a2a3e, #1a1a2e)' 
      : 'linear-gradient(145deg, #404040, #2a2a2a)',
    border: `2px solid ${unlocked ? '#00ff00' : '#666'}`,
    borderRadius: '12px',
    color: unlocked ? '#00ff00' : '#666',
    fontSize: '1.4rem',
    padding: '20px 30px',
    margin: '10px',
    cursor: unlocked ? 'pointer' : 'not-allowed',
    fontFamily: 'Orbitron, monospace',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    minWidth: '250px',
    textAlign: 'center',
    opacity: unlocked ? 1 : 0.5
  });
  
  const backButtonStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, #404040, #2a2a2a)',
    border: '2px solid #888',
    borderRadius: '8px',
    color: '#888',
    fontSize: '1.1rem',
    padding: '10px 20px',
    cursor: 'pointer',
    fontFamily: 'Orbitron, monospace',
    fontWeight: 'bold',
    transition: 'all 0.3s ease'
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
        fontSize: '3rem',
        marginBottom: '2rem',
        textShadow: '0 0 20px #00ff00',
        textAlign: 'center'
      }}>
        Select Level
      </h1>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px'
      }}>
        {Object.values(LEVEL_CONFIGS).map((level) => {
          const unlocked = isLevelUnlocked(level.id);
          return (
            <button
              key={level.id}
              style={levelButtonStyle(unlocked)}
              onClick={() => unlocked && handleLevelSelect(level.id)}
              onMouseEnter={(e) => {
                if (unlocked) {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #00ff00, #00aa00)';
                  e.currentTarget.style.color = '#1a1a2e';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (unlocked) {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #2a2a3e, #1a1a2e)';
                  e.currentTarget.style.color = '#00ff00';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <div style={{ fontSize: '1.6rem', marginBottom: '5px' }}>
                {level.name}
              </div>
              {!unlocked && (
                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                  Requires high score of 300
                </div>
              )}
              {level.id === 'level1' && (
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Forest • Bears, Squirrels, Deer
                </div>
              )}
              {level.id === 'level2' && unlocked && (
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Desert • Coyotes, Scorpions, Rattlesnakes
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      <button
        style={backButtonStyle}
        onClick={handleBackToTitle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(145deg, #888, #666)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(145deg, #404040, #2a2a2a)';
          e.currentTarget.style.color = '#888';
        }}
      >
        ← Back to Title
      </button>
      
      <div style={{
        position: 'absolute',
        bottom: '40px',
        textAlign: 'center',
        fontSize: '0.9rem',
        opacity: 0.6
      }}>
        Your High Score: {score.high}
      </div>
    </div>
  );
};

export default LevelSelectScreen;