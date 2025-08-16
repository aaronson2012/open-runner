/**
 * Powerup Types and Enums
 * Defines the core types for the powerup system
 */

export enum PowerupType {
  MAGNET = 'magnet',
  DOUBLER = 'doubler',
  INVISIBILITY = 'invisibility'
}

export enum PowerupState {
  SPAWNED = 'spawned',
  COLLECTED = 'collected',
  ACTIVE = 'active',
  EXPIRED = 'expired'
}

export interface PowerupEffect {
  type: string;
  value: number;
  duration?: number;
}

export interface PowerupConfig {
  type: PowerupType;
  duration: number;
  effects: PowerupEffect[];
  visualConfig: {
    color: string;
    scale: number;
    glowIntensity: number;
    particleCount: number;
  };
  audioConfig: {
    collectionSound: string;
    activationSound?: string;
    deactivationSound?: string;
  };
}

export interface CollectionData {
  entityId: number;
  powerupType: PowerupType;
  timestamp: number;
  scoreValue: number;
}

export interface PowerupStats {
  totalCollected: number;
  typeCollected: Record<PowerupType, number>;
  averageDuration: number;
  effectivenessScore: number;
}

// Powerup configurations matching original mechanics
export const POWERUP_CONFIGS: Record<PowerupType, PowerupConfig> = {
  [PowerupType.MAGNET]: {
    type: PowerupType.MAGNET,
    duration: 10000, // 10 seconds
    effects: [
      { type: 'magnetRadius', value: 80 },
      { type: 'magnetForce', value: 150 }
    ],
    visualConfig: {
      color: '#FF3333',
      scale: 1.2,
      glowIntensity: 0.8,
      particleCount: 20
    },
    audioConfig: {
      collectionSound: 'powerupsound.wav',
      activationSound: 'buttonclick2.wav'
    }
  },
  [PowerupType.DOUBLER]: {
    type: PowerupType.DOUBLER,
    duration: 10000, // 10 seconds
    effects: [
      { type: 'scoreMultiplier', value: 2 }
    ],
    visualConfig: {
      color: '#3333FF',
      scale: 1.1,
      glowIntensity: 0.7,
      particleCount: 15
    },
    audioConfig: {
      collectionSound: 'powerupsound.wav',
      activationSound: 'buttonclick2.wav'
    }
  },
  [PowerupType.INVISIBILITY]: {
    type: PowerupType.INVISIBILITY,
    duration: 10000, // 10 seconds
    effects: [
      { type: 'enemyImmunity', value: 1 },
      { type: 'transparency', value: 0.5 }
    ],
    visualConfig: {
      color: '#9933FF',
      scale: 1.0,
      glowIntensity: 0.6,
      particleCount: 25
    },
    audioConfig: {
      collectionSound: 'powerupsound.wav',
      activationSound: 'buttonclick2.wav'
    }
  }
};