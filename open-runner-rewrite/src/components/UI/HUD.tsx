import { useGameStore } from '../../stores/gameStore';

const HUD: React.FC = () => {
  const { score, showFPS, player } = useGameStore();
  
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      pointerEvents: 'none',
      fontFamily: 'Orbitron, monospace',
      color: 'white',
      fontSize: '18px',
      fontWeight: 'bold'
    }}>
      {/* Score Display */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: '2px solid #00ff00',
        borderRadius: '8px',
        padding: '10px 15px',
        minWidth: '120px'
      }}>
        Score: {score.current}
      </div>
      
      {/* High Score Display */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: '2px solid #ffd700',
        borderRadius: '8px',
        padding: '10px 15px',
        minWidth: '140px',
        color: '#ffd700',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
      }}>
        High: {score.high}
      </div>
      
      {/* FPS Counter */}
      {showFPS && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '20px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid #666',
          borderRadius: '4px',
          padding: '5px 10px',
          fontSize: '14px'
        }}>
          FPS: 60
        </div>
      )}
      
      {/* Speed Display */}
      <div style={{
        position: 'absolute',
        bottom: '80px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.5)',
        borderRadius: '4px',
        padding: '5px 10px',
        fontSize: '14px'
      }}>
        Speed: {Math.round(player.speed)}
      </div>
    </div>
  );
};

export default HUD;