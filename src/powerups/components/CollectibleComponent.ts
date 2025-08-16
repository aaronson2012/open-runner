/**
 * Collectible Component
 * Handles collection mechanics for powerup entities
 */

export interface CollectibleComponent {
  collectionRadius: number;
  scoreValue: number;
  isCollected: boolean;
  collectionTime: number;
  collectorEntityId: number | null;
  magneticAttraction: boolean;
  bounceAmplitude: number;
  rotationSpeed: number;
  glowIntensity: number;
}

export function createCollectibleComponent(
  collectionRadius: number = 15,
  scoreValue: number = 100
): CollectibleComponent {
  return {
    collectionRadius,
    scoreValue,
    isCollected: false,
    collectionTime: 0,
    collectorEntityId: null,
    magneticAttraction: false,
    bounceAmplitude: 2.0,
    rotationSpeed: 1.5,
    glowIntensity: 0.6
  };
}