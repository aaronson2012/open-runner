import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { LEVEL_CONFIGS, GAME_CONFIG } from '../config/gameConfig';
import { GameState } from '../types/game';
import { audioManager } from '../utils/audioManager';
import Player from './Player';
import Terrain from './Terrain';
import Camera from './Camera';
import Collectibles from './Collectibles';
import Obstacles from './Obstacles';
import * as THREE from 'three';

const GameScene: React.FC = () => {
  const { scene } = useThree();
  const { gameState, currentLevel, setGameState } = useGameStore();
  const sceneRef = useRef<THREE.Scene>();
  
  useEffect(() => {
    sceneRef.current = scene;
    
    // Set up scene based on current level
    const levelConfig = LEVEL_CONFIGS[currentLevel];
    if (levelConfig) {
      scene.background = new THREE.Color(levelConfig.sceneBackgroundColor);
      scene.fog = new THREE.Fog(
        levelConfig.sceneFogColor,
        levelConfig.sceneFogNear,
        levelConfig.sceneFogFar
      );

      // Clear existing lights
      const existingLights = scene.children.filter(child => 
        child instanceof THREE.Light
      );
      existingLights.forEach(light => scene.remove(light));

      // Add ambient light
      const ambientLight = new THREE.AmbientLight(
        levelConfig.ambientLightColor,
        levelConfig.ambientLightIntensity
      );
      scene.add(ambientLight);

      // Add directional light
      const directionalLight = new THREE.DirectionalLight(
        levelConfig.directionalLightColor,
        levelConfig.directionalLightIntensity
      );
      directionalLight.position.copy(levelConfig.directionalLightPosition);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 500;
      directionalLight.shadow.camera.left = -100;
      directionalLight.shadow.camera.right = 100;
      directionalLight.shadow.camera.top = 100;
      directionalLight.shadow.camera.bottom = -100;
      scene.add(directionalLight);
    }

    // Transition to playing state if we're in loading level
    if (gameState === GameState.LOADING_LEVEL) {
      const timer = setTimeout(() => {
        setGameState(GameState.TRANSITIONING_TO_GAMEPLAY);
        setTimeout(() => {
          setGameState(GameState.PLAYING);
          // Start background music when game starts
          audioManager.playMusic('openrunnertheme', true, 0.3);
        }, 500);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [scene, currentLevel, gameState, setGameState]);

  useFrame((state, delta) => {
    // Update powerup timers
    if (gameState === GameState.PLAYING) {
      useGameStore.getState().updatePowerupTime(delta);
    }
  });

  return (
    <>
      <Camera />
      <Terrain />
      <Player />
      <Collectibles />
      <Obstacles />
    </>
  );
};

export default GameScene;