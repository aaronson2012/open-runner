/**
 * Magnet Component
 * Handles magnetic attraction for coins and collectibles
 */

export interface MagnetComponent {
  isActive: boolean;
  attractionRadius: number;
  attractionForce: number;
  targetTypes: string[];
  affectedEntities: Set<number>;
  visualEffect: {
    showField: boolean;
    fieldColor: string;
    fieldOpacity: number;
    pulseSpeed: number;
  };
}

export function createMagnetComponent(
  radius: number = 80,
  force: number = 150
): MagnetComponent {
  return {
    isActive: false,
    attractionRadius: radius,
    attractionForce: force,
    targetTypes: ['coin', 'collectible'],
    affectedEntities: new Set(),
    visualEffect: {
      showField: true,
      fieldColor: '#FF3333',
      fieldOpacity: 0.3,
      pulseSpeed: 2.0
    }
  };
}