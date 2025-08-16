/**
 * Core Powerup Component
 * Base component for all powerup entities
 */

import { PowerupType, PowerupState, PowerupConfig } from '../types/PowerupTypes';

export interface PowerupComponent {
  type: PowerupType;
  state: PowerupState;
  config: PowerupConfig;
  activationTime: number;
  expirationTime: number;
  remainingDuration: number;
  isActive: boolean;
  effectsApplied: boolean;
}

export function createPowerupComponent(type: PowerupType, config: PowerupConfig): PowerupComponent {
  return {
    type,
    state: PowerupState.SPAWNED,
    config: JSON.parse(JSON.stringify(config)), // Deep copy to prevent mutation
    activationTime: 0,
    expirationTime: 0,
    remainingDuration: config.duration,
    isActive: false,
    effectsApplied: false
  };
}