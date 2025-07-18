import performanceManager from '../utils/performanceManager.js';
export const particleConfig = {
    PARTICLE_DENSITY: performanceManager.getSettings().particleDensity,
    BASE_MAX_PARTICLES: 500,
    BASE_PARTICLE_LIFETIME: 0.8,
    BASE_PARTICLES_PER_SECOND: 150,
    INITIAL_SPEED_MIN: 0.5,
    INITIAL_SPEED_MAX: 1.5,
    DRIFT_VELOCITY_X: 0,
    DRIFT_VELOCITY_Y: 0.8,
    DRIFT_VELOCITY_Z: -0.5,
    SIZE: 0.3,
    COLOR: 0xAAAAAA,
    LIFETIME_LOW_QUALITY_FACTOR: 0.7,
    EMIT_POS_RANDOM_FACTOR: 0.5,
    EMIT_VEL_SPREAD_FACTOR: 0.5,
    EMIT_VEL_UPWARD_BIAS_MIN: 0.2,
    EMIT_VEL_UPWARD_BIAS_MAX: 0.5,
    EMIT_VEL_BACKWARD_BIAS: -0.3,
    EMIT_ORIGIN_Y_OFFSET_FACTOR: 0.8,
    TEXTURE_SIZE: 64,
    TEXTURE_GRADIENT_STOPS: [
        [0, 'rgba(255,255,255,1)'],
        [0.2, 'rgba(255,255,255,0.8)'],
        [0.4, 'rgba(200,200,200,0.3)'],
        [1, 'rgba(150,150,150,0)']
    ]
};