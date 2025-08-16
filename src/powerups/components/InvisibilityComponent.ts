/**
 * Invisibility Component
 * Handles enemy immunity and visual transparency effects
 */

export interface InvisibilityComponent {
  isActive: boolean;
  immunityActive: boolean;
  transparencyLevel: number;
  originalOpacity: number;
  immuneToTypes: string[];
  collisionBypassCount: number;
  visualEffect: {
    shimmerEffect: boolean;
    shimmerSpeed: number;
    outlineColor: string;
    outlineIntensity: number;
  };
}

export function createInvisibilityComponent(
  transparencyLevel: number = 0.5
): InvisibilityComponent {
  return {
    isActive: false,
    immunityActive: false,
    transparencyLevel,
    originalOpacity: 1.0,
    immuneToTypes: ['enemy', 'obstacle'],
    collisionBypassCount: 0,
    visualEffect: {
      shimmerEffect: true,
      shimmerSpeed: 3.0,
      outlineColor: '#9933FF',
      outlineIntensity: 0.8
    }
  };
}