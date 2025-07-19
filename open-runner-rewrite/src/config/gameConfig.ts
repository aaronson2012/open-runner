import * as THREE from 'three';
import { GameConfig, LevelConfig } from '../types/game';

export const GAME_CONFIG: GameConfig = {
  player: {
    initialPosX: 0,
    initialPosY: 0,
    initialPosZ: 0,
    speed: 50,
    speedIncreaseRate: 0.25,
    heightOffset: 1.5
  },
  controls: {
    turnSpeed: 100,
    keyTurnLeft: 'a',
    keyTurnRight: 'd',
    keyPause: 'escape',
    keyRestart: 'r',
    keyToggleFPS: 'f'
  },
  world: {
    chunkSize: 200,
    renderDistance: 500,
    maxChunks: 25
  },
  gameplay: {
    coinValue: 10,
    powerupDuration: 10000, // 10 seconds in ms
    magnetRadius: 80,
    scoreDoubler: 2,
    nextLevelThreshold: 300
  }
};

export const LEVEL_CONFIGS: Record<string, LevelConfig> = {
  level1: {
    id: 'level1',
    name: 'Forest',
    sceneBackgroundColor: 0x87ceeb,
    sceneFogColor: 0x87ceeb,
    sceneFogNear: 200,
    sceneFogFar: 800,
    ambientLightColor: 0x404040,
    ambientLightIntensity: 0.6,
    directionalLightColor: 0xffffff,
    directionalLightIntensity: 1.0,
    directionalLightPosition: new THREE.Vector3(100, 100, 50),
    terrain: {
      noiseFrequency: 0.01,
      noiseAmplitude: 20,
      color: 0x228b22
    },
    enemies: ['bear', 'squirrel', 'deer'],
    obstacles: ['pine_tree', 'rock', 'log', 'cabin']
  },
  level2: {
    id: 'level2', 
    name: 'Desert',
    sceneBackgroundColor: 0xf5deb3,
    sceneFogColor: 0xf5deb3,
    sceneFogNear: 300,
    sceneFogFar: 1000,
    ambientLightColor: 0x404040,
    ambientLightIntensity: 0.7,
    directionalLightColor: 0xffffff,
    directionalLightIntensity: 1.2,
    directionalLightPosition: new THREE.Vector3(100, 100, 50),
    terrain: {
      noiseFrequency: 0.005,
      noiseAmplitude: 5,
      color: 0xc19a6b
    },
    enemies: ['coyote', 'rattlesnake', 'scorpion', 'tumbleweed'],
    obstacles: ['saguaro_cactus', 'barrel_cactus', 'desert_rock', 'saloon', 'railroad_sign']
  }
};