import { useEffect, useState } from 'react';

const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
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
        animation: 'glow 2s ease-in-out infinite alternate'
      }}>
        Open Runner
      </h1>
      
      <div style={{
        width: '400px',
        height: '20px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '2px solid #00ff00'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #00ff00, #00aa00)',
          transition: 'width 0.1s ease-out',
          borderRadius: '8px'
        }} />
      </div>
      
      <p style={{
        marginTop: '1rem',
        fontSize: '1.2rem',
        color: '#00ff00'
      }}>
        Loading... {progress}%
      </p>
      
      <p style={{
        marginTop: '2rem',
        fontSize: '1rem',
        opacity: 0.7,
        animation: 'pulse 2s infinite'
      }}>
        Tap the screen or press any key to continue
      </p>
      
      <style>
        {`
          @keyframes glow {
            from { text-shadow: 0 0 20px #00ff00; }
            to { text-shadow: 0 0 30px #00ff00, 0 0 40px #00ff00; }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingScreen;