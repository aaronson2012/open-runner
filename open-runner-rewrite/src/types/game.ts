import * as THREE from 'three';

export enum GameState {
  LOADING = 'loading',
  TITLE = 'title',
  LEVEL_SELECT = 'level_select',
  TRANSITIONING_TO_GAMEPLAY = 'transitioning_to_gameplay',
  LOADING_LEVEL = 'loading_level',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over'
}

export interface PlayerState {
  position: THREE.Vector3;
  rotation: THREE.Vector3;
  speed: number;
  currentPowerup: string;
  animationTime: number;
}

export interface GameConfig {
  player: {
    initialPosX: number;
    initialPosY: number;
    initialPosZ: number;
    speed: number;
    speedIncreaseRate: number;
    heightOffset: number;
  };
  controls: {
    turnSpeed: number;
    keyTurnLeft: string;
    keyTurnRight: string;
    keyPause: string;
    keyRestart: string;
    keyToggleFPS: string;
  };
  world: {
    chunkSize: number;
    renderDistance: number;
    maxChunks: number;
  };
  gameplay: {
    coinValue: number;
    powerupDuration: number;
    magnetRadius: number;
    scoreDoubler: number;
    nextLevelThreshold: number;
  };
}

export interface LevelConfig {
  id: string;
  name: string;
  sceneBackgroundColor: number;
  sceneFogColor: number;
  sceneFogNear: number;
  sceneFogFar: number;
  ambientLightColor: number;
  ambientLightIntensity: number;
  directionalLightColor: number;
  directionalLightIntensity: number;
  directionalLightPosition: THREE.Vector3;
  terrain: {
    noiseFrequency: number;
    noiseAmplitude: number;
    color: number;
  };
  enemies: string[];
  obstacles: string[];
}

export interface Enemy {
  id: string;
  type: string;
  position: THREE.Vector3;
  model?: THREE.Group;
  behavior: 'aggressive' | 'passive' | 'stalking' | 'static';
  speed: number;
  detectionRadius: number;
  removeDistance: number;
}

export interface Collectible {
  id: string;
  type: 'coin' | 'magnet' | 'doubler' | 'invisibility';
  position: THREE.Vector3;
  model?: THREE.Group;
  value: number;
  collected: boolean;
}

export interface Obstacle {
  id: string;
  type: string;
  position: THREE.Vector3;
  model?: THREE.Group;
  boundingBox?: THREE.Box3;
}

export interface Chunk {
  x: number;
  z: number;
  mesh?: THREE.Mesh;
  enemies: Enemy[];
  collectibles: Collectible[];
  obstacles: Obstacle[];
  loaded: boolean;
}

export interface ScoreState {
  current: number;
  high: number;
  multiplier: number;
}

export interface PowerupState {
  type: string;
  duration: number;
  timeRemaining: number;
}