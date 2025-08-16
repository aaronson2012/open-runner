/**
 * ParticleEffects
 * Manages particle systems for powerup visual feedback
 */

export interface Particle {
  id: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number; a: number };
  size: number;
  lifetime: number;
  maxLifetime: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  friction: number;
}

export interface ParticleEmitter {
  id: string;
  position: { x: number; y: number; z: number };
  emissionRate: number;
  maxParticles: number;
  particles: Particle[];
  isActive: boolean;
  config: ParticleConfig;
}

export interface ParticleConfig {
  type: 'burst' | 'stream' | 'field' | 'trail' | 'glow';
  duration: number;
  spawnRate: number;
  maxParticles: number;
  
  // Particle properties
  startSize: number;
  endSize: number;
  startColor: { r: number; g: number; b: number; a: number };
  endColor: { r: number; g: number; b: number; a: number };
  lifetime: number;
  
  // Physics
  velocity: {
    x: { min: number; max: number };
    y: { min: number; max: number };
    z: { min: number; max: number };
  };
  gravity: number;
  friction: number;
  
  // Visual
  texture?: string;
  blendMode: 'additive' | 'alpha' | 'multiply';
  rotationSpeed: { min: number; max: number };
}

export class ParticleEffects {
  private emitters = new Map<string, ParticleEmitter>();
  private particleIdCounter = 0;
  private emitterIdCounter = 0;
  
  // Performance settings
  private maxGlobalParticles = 1000;
  private currentParticleCount = 0;
  
  // Powerup-specific configurations
  private static readonly POWERUP_CONFIGS: Record<string, ParticleConfig> = {
    // Collection burst effect
    collection_burst: {
      type: 'burst',
      duration: 1500,
      spawnRate: 0,
      maxParticles: 20,
      startSize: 3,
      endSize: 0.5,
      startColor: { r: 1, g: 1, b: 1, a: 1 },
      endColor: { r: 1, g: 1, b: 1, a: 0 },
      lifetime: 1.5,
      velocity: {
        x: { min: -50, max: 50 },
        y: { min: 20, max: 80 },
        z: { min: -50, max: 50 }
      },
      gravity: -30,
      friction: 0.95,
      blendMode: 'additive',
      rotationSpeed: { min: -5, max: 5 }
    },
    
    // Magnet field visualization
    magnet_field: {
      type: 'field',
      duration: -1, // Continuous
      spawnRate: 10,
      maxParticles: 50,
      startSize: 2,
      endSize: 1,
      startColor: { r: 1, g: 0.2, b: 0.2, a: 0.6 },
      endColor: { r: 1, g: 0.2, b: 0.2, a: 0 },
      lifetime: 2.0,
      velocity: {
        x: { min: -20, max: 20 },
        y: { min: -10, max: 10 },
        z: { min: -20, max: 20 }
      },
      gravity: 0,
      friction: 0.98,
      blendMode: 'additive',
      rotationSpeed: { min: -2, max: 2 }
    },
    
    // Attraction trails for magnet
    attraction_trail: {
      type: 'trail',
      duration: 500,
      spawnRate: 20,
      maxParticles: 15,
      startSize: 1.5,
      endSize: 0.3,
      startColor: { r: 1, g: 0.3, b: 0.3, a: 0.8 },
      endColor: { r: 1, g: 0.8, b: 0.8, a: 0 },
      lifetime: 0.8,
      velocity: {
        x: { min: -5, max: 5 },
        y: { min: -5, max: 5 },
        z: { min: -5, max: 5 }
      },
      gravity: 0,
      friction: 0.9,
      blendMode: 'additive',
      rotationSpeed: { min: 0, max: 0 }
    },
    
    // Doubler score multiplier effect
    doubler_sparkle: {
      type: 'stream',
      duration: -1, // Continuous while active
      spawnRate: 15,
      maxParticles: 30,
      startSize: 2,
      endSize: 0.5,
      startColor: { r: 0.2, g: 0.2, b: 1, a: 1 },
      endColor: { r: 0.6, g: 0.6, b: 1, a: 0 },
      lifetime: 1.5,
      velocity: {
        x: { min: -15, max: 15 },
        y: { min: 10, max: 30 },
        z: { min: -15, max: 15 }
      },
      gravity: -10,
      friction: 0.96,
      blendMode: 'additive',
      rotationSpeed: { min: -3, max: 3 }
    },
    
    // Invisibility shimmer effect
    invisibility_shimmer: {
      type: 'glow',
      duration: -1, // Continuous
      spawnRate: 8,
      maxParticles: 20,
      startSize: 4,
      endSize: 1,
      startColor: { r: 0.6, g: 0.2, b: 1, a: 0.4 },
      endColor: { r: 0.8, g: 0.4, b: 1, a: 0 },
      lifetime: 2.5,
      velocity: {
        x: { min: -10, max: 10 },
        y: { min: -5, max: 15 },
        z: { min: -10, max: 10 }
      },
      gravity: 0,
      friction: 0.99,
      blendMode: 'alpha',
      rotationSpeed: { min: -1, max: 1 }
    },
    
    // Powerup spawn glow
    powerup_glow: {
      type: 'glow',
      duration: -1, // Continuous
      spawnRate: 5,
      maxParticles: 15,
      startSize: 3,
      endSize: 0.8,
      startColor: { r: 1, g: 1, b: 0.5, a: 0.6 },
      endColor: { r: 1, g: 1, b: 0.8, a: 0 },
      lifetime: 3.0,
      velocity: {
        x: { min: -8, max: 8 },
        y: { min: 5, max: 20 },
        z: { min: -8, max: 8 }
      },
      gravity: -5,
      friction: 0.97,
      blendMode: 'additive',
      rotationSpeed: { min: -2, max: 2 }
    }
  };

  constructor() {
    // Initialize particle system
  }

  /**
   * Update all particle emitters and particles
   */
  update(deltaTime: number): void {
    this.currentParticleCount = 0;
    
    for (const [emitterId, emitter] of this.emitters) {
      this.updateEmitter(emitter, deltaTime);
      this.currentParticleCount += emitter.particles.length;
      
      // Remove finished emitters
      if (!emitter.isActive && emitter.particles.length === 0) {
        this.emitters.delete(emitterId);
      }
    }
  }

  private updateEmitter(emitter: ParticleEmitter, deltaTime: number): void {
    const deltaSeconds = deltaTime * 0.001;
    
    // Spawn new particles
    if (emitter.isActive && emitter.config.spawnRate > 0) {
      this.spawnParticles(emitter, deltaSeconds);
    }
    
    // Update existing particles
    this.updateParticles(emitter, deltaSeconds);
    
    // Remove dead particles
    this.removeDeadParticles(emitter);
  }

  private spawnParticles(emitter: ParticleEmitter, deltaSeconds: number): void {
    if (this.currentParticleCount >= this.maxGlobalParticles) return;
    if (emitter.particles.length >= emitter.config.maxParticles) return;
    
    const spawnCount = Math.floor(emitter.config.spawnRate * deltaSeconds);
    
    for (let i = 0; i < spawnCount; i++) {
      if (emitter.particles.length >= emitter.config.maxParticles) break;
      if (this.currentParticleCount >= this.maxGlobalParticles) break;
      
      const particle = this.createParticle(emitter);
      emitter.particles.push(particle);
      this.currentParticleCount++;
    }
  }

  private createParticle(emitter: ParticleEmitter): Particle {
    const config = emitter.config;
    
    return {
      id: this.particleIdCounter++,
      position: { ...emitter.position },
      velocity: {
        x: this.randomBetween(config.velocity.x.min, config.velocity.x.max),
        y: this.randomBetween(config.velocity.y.min, config.velocity.y.max),
        z: this.randomBetween(config.velocity.z.min, config.velocity.z.max)
      },
      color: { ...config.startColor },
      size: config.startSize,
      lifetime: config.lifetime,
      maxLifetime: config.lifetime,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: this.randomBetween(config.rotationSpeed.min, config.rotationSpeed.max),
      gravity: config.gravity,
      friction: config.friction
    };
  }

  private updateParticles(emitter: ParticleEmitter, deltaSeconds: number): void {
    const config = emitter.config;
    
    for (const particle of emitter.particles) {
      // Update lifetime
      particle.lifetime -= deltaSeconds;
      
      if (particle.lifetime <= 0) continue;
      
      const lifeRatio = 1 - (particle.lifetime / particle.maxLifetime);
      
      // Update position
      particle.position.x += particle.velocity.x * deltaSeconds;
      particle.position.y += particle.velocity.y * deltaSeconds;
      particle.position.z += particle.velocity.z * deltaSeconds;
      
      // Apply gravity
      particle.velocity.y += particle.gravity * deltaSeconds;
      
      // Apply friction
      particle.velocity.x *= particle.friction;
      particle.velocity.y *= particle.friction;
      particle.velocity.z *= particle.friction;
      
      // Update rotation
      particle.rotation += particle.rotationSpeed * deltaSeconds;
      
      // Interpolate size
      particle.size = this.lerp(config.startSize, config.endSize, lifeRatio);
      
      // Interpolate color
      particle.color.r = this.lerp(config.startColor.r, config.endColor.r, lifeRatio);
      particle.color.g = this.lerp(config.startColor.g, config.endColor.g, lifeRatio);
      particle.color.b = this.lerp(config.startColor.b, config.endColor.b, lifeRatio);
      particle.color.a = this.lerp(config.startColor.a, config.endColor.a, lifeRatio);
    }
  }

  private removeDeadParticles(emitter: ParticleEmitter): void {
    emitter.particles = emitter.particles.filter(particle => particle.lifetime > 0);
  }

  // Public API methods

  /**
   * Create a particle emitter for powerup effects
   */
  createPowerupEffect(
    type: string, 
    position: { x: number; y: number; z: number },
    customConfig?: Partial<ParticleConfig>
  ): string {
    const baseConfig = ParticleEffects.POWERUP_CONFIGS[type];
    if (!baseConfig) {
      console.warn(`Unknown particle effect type: ${type}`);
      return '';
    }
    
    const config = { ...baseConfig, ...customConfig };
    const emitterId = `emitter_${this.emitterIdCounter++}`;
    
    const emitter: ParticleEmitter = {
      id: emitterId,
      position: { ...position },
      emissionRate: config.spawnRate,
      maxParticles: config.maxParticles,
      particles: [],
      isActive: true,
      config
    };
    
    // For burst effects, spawn all particles immediately
    if (config.type === 'burst') {
      for (let i = 0; i < config.maxParticles; i++) {
        if (this.currentParticleCount >= this.maxGlobalParticles) break;
        
        const particle = this.createParticle(emitter);
        emitter.particles.push(particle);
      }
      emitter.isActive = false; // No more spawning
    }
    
    this.emitters.set(emitterId, emitter);
    return emitterId;
  }

  /**
   * Stop particle emission (particles will fade out naturally)
   */
  stopEmitter(emitterId: string): void {
    const emitter = this.emitters.get(emitterId);
    if (emitter) {
      emitter.isActive = false;
    }
  }

  /**
   * Immediately remove all particles from an emitter
   */
  clearEmitter(emitterId: string): void {
    const emitter = this.emitters.get(emitterId);
    if (emitter) {
      emitter.particles = [];
      emitter.isActive = false;
    }
  }

  /**
   * Update emitter position (for moving effects)
   */
  updateEmitterPosition(emitterId: string, position: { x: number; y: number; z: number }): void {
    const emitter = this.emitters.get(emitterId);
    if (emitter) {
      emitter.position = { ...position };
    }
  }

  /**
   * Get all particles for rendering
   */
  getAllParticles(): Particle[] {
    const allParticles: Particle[] = [];
    
    for (const emitter of this.emitters.values()) {
      allParticles.push(...emitter.particles);
    }
    
    return allParticles;
  }

  /**
   * Get particles by emitter
   */
  getEmitterParticles(emitterId: string): Particle[] {
    const emitter = this.emitters.get(emitterId);
    return emitter ? [...emitter.particles] : [];
  }

  /**
   * Create collection burst effect
   */
  createCollectionBurst(
    position: { x: number; y: number; z: number },
    color: string,
    intensity: number = 1.0
  ): string {
    const colorRgb = this.hexToRgb(color);
    const customConfig: Partial<ParticleConfig> = {
      startColor: { ...colorRgb, a: intensity },
      endColor: { ...colorRgb, a: 0 },
      maxParticles: Math.floor(20 * intensity)
    };
    
    return this.createPowerupEffect('collection_burst', position, customConfig);
  }

  /**
   * Create magnet field effect
   */
  createMagnetField(
    position: { x: number; y: number; z: number },
    radius: number,
    intensity: number = 1.0
  ): string {
    const customConfig: Partial<ParticleConfig> = {
      maxParticles: Math.floor(radius * 0.5),
      startColor: { r: 1, g: 0.2, b: 0.2, a: intensity * 0.6 },
      velocity: {
        x: { min: -radius * 0.3, max: radius * 0.3 },
        y: { min: -radius * 0.1, max: radius * 0.1 },
        z: { min: -radius * 0.3, max: radius * 0.3 }
      }
    };
    
    return this.createPowerupEffect('magnet_field', position, customConfig);
  }

  /**
   * Create doubler sparkle effect
   */
  createDoublerSparkle(position: { x: number; y: number; z: number }): string {
    return this.createPowerupEffect('doubler_sparkle', position);
  }

  /**
   * Create invisibility shimmer effect
   */
  createInvisibilityShimmer(position: { x: number; y: number; z: number }): string {
    return this.createPowerupEffect('invisibility_shimmer', position);
  }

  /**
   * Create powerup spawn glow
   */
  createPowerupGlow(
    position: { x: number; y: number; z: number },
    color: string
  ): string {
    const colorRgb = this.hexToRgb(color);
    const customConfig: Partial<ParticleConfig> = {
      startColor: { ...colorRgb, a: 0.6 },
      endColor: { ...colorRgb, a: 0 }
    };
    
    return this.createPowerupEffect('powerup_glow', position, customConfig);
  }

  // Utility methods

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * Math.max(0, Math.min(1, t));
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      activeEmitters: this.emitters.size,
      totalParticles: this.currentParticleCount,
      maxParticles: this.maxGlobalParticles,
      particleUtilization: (this.currentParticleCount / this.maxGlobalParticles) * 100
    };
  }

  /**
   * Set performance limits
   */
  setPerformanceLimits(maxParticles: number): void {
    this.maxGlobalParticles = maxParticles;
  }

  /**
   * Clear all effects
   */
  clearAll(): void {
    this.emitters.clear();
    this.currentParticleCount = 0;
  }
}