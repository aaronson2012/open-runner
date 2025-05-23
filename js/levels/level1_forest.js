// js/levels/level1_forest.js

export const level1Config = {
    // --- Terrain ---
    TERRAIN_COLOR: 0x55aa55, // Greenish color (from terrainGenerator.js)
    NOISE_FREQUENCY: 0.01, // How close together the hills are (lower = wider hills)
    NOISE_AMPLITUDE: 8,   // How high the hills are (larger = higher peaks/deeper valleys)

    // --- Scene & Atmosphere ---
    atmosphericProfile: {
        backgroundColor: 0x87CEEB,
        fog: {
            color: 0x87CEEB,
            near: 35,
            far: 1000,
        },
        lighting: {
            ambient: {
                color: 0xffffff,
                intensity: 0.6,
            },
            directional: {
                color: 0xffffff,
                intensity: 0.8,
                position: { x: 100, y: 100, z: 50 },
            },
        },
        elements: [
            // No special atmospheric elements for forest level by default
        ]
    },

    // --- Coin Visuals ---
    COIN_VISUALS: {
        spinSpeed: 2.0, // Example spin speed, adjust as needed
        // Add other coin visual properties here if any in the future
    },

    // --- Enemies ---
    ENEMY_DEFAULT_SPEED: 5.0,
    ENEMY_DEFAULT_AGGRO_RADIUS: 30.0,
    ENEMY_DEFAULT_DEAGGRO_RADIUS: 30.0,
    ENEMY_SPAWN_DENSITY: 0.0001875, // Overall density for any enemy type

    // --- Enemy Roaming ---
    ENEMY_ROAMING_RADIUS: 15.0,
    ENEMY_ROAMING_SPEED_FACTOR: 0.5,
    ENEMY_ROAMING_MIN_WAIT_TIME: 2.0,
    ENEMY_ROAMING_MAX_WAIT_TIME: 5.0,

    // --- Specific Enemy Properties ---
    ENEMY_TYPES: ['bear', 'squirrel', 'deer'], // List of enemy types for this level
    ENEMY_PROPERTIES: {
        'bear': {
            speed: 8.0,
            aggroRadius: 40.0,
            deaggroRadius: 40.0,
            color: 0x8B4513, // Brown
            minDistance: 20.0, // Reduced from 25.0
            verticalOffset: 0.1,
            maxPlacementAttempts: 15
        },
        'squirrel': {
            speed: 12.0,
            aggroRadius: 20.0,
            deaggroRadius: 25.0,
            color: 0xA0522D, // Sienna/Reddish-brown
            minDistance: 8.0,
            verticalOffset: 0.1,
            maxPlacementAttempts: 10
        },
        'deer': {
            speed: 10.0,
            aggroRadius: 36.0,
            deaggroRadius: 35.0,
            color: 0xD2B48C, // Tan
            minDistance: 15.0,
            verticalOffset: 0.1,
            maxPlacementAttempts: 12
        }
    },

    // --- Object Generation ---
    OBJECT_TYPES: [
        // --- Coins ---
        {
            type: 'coin',
            density: 0.000465,
            minDistance: 3.0,
            verticalOffset: 1.5,
            scaleRange: [1, 1],
            randomRotationY: true,
            collidable: false,
            scoreValue: 10,
            maxPlacementAttempts: 10,
        },
        // --- powerups ---
        {
            type: 'magnet',
            density: 0.00013, // Set to optimal value between 0.000087 and 0.00015
            minDistance: 15.0, // Reduced from 20.0
            verticalOffset: 1.5,
            scaleRange: [1.2, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 25, // Further increased to ensure successful placement
        },
        {
            // same as magnet for now 
            type: 'doubler',
            density: 0.00013,
            minDistance: 15.0,
            verticalOffset: 1.5,
            scaleRange: [1.2, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 25,
        },
        {
            // same as magnet for now 
            type: 'invisibility',
            density: 0.00013,
            minDistance: 15.0,
            verticalOffset: 1.5,
            scaleRange: [1.2, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 25,
        },
        // --- Obstacles ---
        {
            type: 'rock_small',
            density: 0.000285,
            minDistance: 2.0,
            verticalOffset: 0.5,
            scaleRange: [0.8, 2.4],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 12, // Increased from 8
        },
        {
            type: 'rock_large',
            density: 0.0000945,
            minDistance: 5.0,
            verticalOffset: 1.0,
            scaleRange: [1.5, 4.5],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 10,
        },
        {
            type: 'tree_pine',
            density: 0.000375,
            minDistance: 8.0, // Increased from 4.0 to prevent trees from clipping into each other
            verticalOffset: 0,
            scaleRange: [1.5, 3.0],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 15, // Increased to give more chances for successful placement
        },
        {
            type: 'log_fallen',
            density: 0.000189,
            minDistance: 5.0,
            verticalOffset: 0.2,
            scaleRange: [0.8, 3.5],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 12,
        },
        {
            type: 'cabin_simple',
            density: 0.00000945,
            minDistance: 15.0,
            verticalOffset: 0,
            scaleRange: [1, 1],
            randomRotationY: false,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 15,
        },
    ]
};
