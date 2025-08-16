/**
 * Powerup System - Main Export
 * Complete powerup system with ECS architecture, faithful recreation mechanics,
 * and modern mobile optimizations
 */

// Core Components
export * from './components';

// Systems
export * from './systems';

// Effects
export * from './effects/ParticleEffects';

// Factory and Manager
export * from './PowerupFactory';
export * from './PowerupManager';

// Types
export * from './types/PowerupTypes';

// Main integration class for easy setup
export { PowerupSystem as PowerupSystemIntegration } from './PowerupSystemIntegration';