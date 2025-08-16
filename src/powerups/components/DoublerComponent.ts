/**
 * Doubler Component
 * Handles score multiplication effects
 */

export interface DoublerComponent {
  isActive: boolean;
  multiplier: number;
  originalMultiplier: number;
  affectedScoreTypes: string[];
  totalBonusScore: number;
  visualIndicator: {
    showMultiplierText: boolean;
    textColor: string;
    textScale: number;
    glowEffect: boolean;
  };
}

export function createDoublerComponent(
  multiplier: number = 2
): DoublerComponent {
  return {
    isActive: false,
    multiplier,
    originalMultiplier: multiplier,
    affectedScoreTypes: ['coin', 'collectible', 'enemy'],
    totalBonusScore: 0,
    visualIndicator: {
      showMultiplierText: true,
      textColor: '#3333FF',
      textScale: 1.5,
      glowEffect: true
    }
  };
}