// js/levels/level2_desert.js

export const level2Config = {
    // --- Terrain ---
    TERRAIN_COLOR: 0xC2B280, // Sandy color
    NOISE_FREQUENCY: 0.015, // Slightly different frequency
    NOISE_AMPLITUDE: 4,   // Lower amplitude for flatter desert

    // --- Scene & Atmosphere ---
    atmosphericProfile: {
        backgroundColor: 0xF0E68C, // Khaki/Sandy background
        fog: {
            color: 0xF0E68C, // Match background
            near: 50,
            far: 800, // Maybe slightly less fog distance
        },
        lighting: {
            ambient: {
                color: 0xffffff,
                intensity: 0.7, // Slightly brighter ambient?
            },
            directional: {
                color: 0xffffff,
                intensity: 0.9, // Brighter sun?
                position: { x: 150, y: 150, z: 100 },
            },
        },
        elements: [
            {
                type: 'buzzard',
                count: 4,
                altitude: 80,
                circleRadius: 150,
                circleSpeed: 0.05, // This was in the update logic, good to have it configurable
                lookAtOffset: { y: -10 } // For the lookAt adjustment
            }
        ]
    },

    // --- Coin Visuals ---
    COIN_VISUALS: {
        spinSpeed: 2.0, // Example spin speed, adjust as needed
        // Add other coin visual properties here if any in the future
    },

    // --- Enemies ---
    ENEMY_DEFAULT_SPEED: 5.0, // Keep defaults for now
    ENEMY_DEFAULT_AGGRO_RADIUS: 30.0,
    ENEMY_DEFAULT_DEAGGRO_RADIUS: 30.0,
    ENEMY_SPAWN_DENSITY: 0.000225, // Overall density for desert enemies (adjust as needed)
    ENEMY_TYPES: ['coyote', 'rattlesnake', 'scorpion'], // Added desert enemies
    ENEMY_PROPERTIES: { // Define properties for desert enemies
        'coyote': {
            speed: 11.0, // Faster than deer
            aggroRadius: 35.0,
            deaggroRadius: 40.0,
            color: 0xAAAAAA, // Greyish
            minDistance: 12.0,
            verticalOffset: 0.1,
            maxPlacementAttempts: 12,
            roamingRadius: 20.0, // Wider roaming
            roamingSpeedFactor: 0.6,
            roamingMinWaitTime: 1.5,
            roamingMaxWaitTime: 4.0,
        },
        'rattlesnake': {
            speed: 2.0, // Very slow when moving (mostly stationary)
            aggroRadius: 10.0, // Short range, maybe lunge?
            deaggroRadius: 30.0,
            color: 0xCD853F, // Peru (brownish)
            minDistance: 5.0,
            verticalOffset: 0.05, // Close to ground
            maxPlacementAttempts: 10,
            // Roaming might be minimal or different logic (e.g., stay near spawn)
            roamingRadius: 5.0,
            roamingSpeedFactor: 0.2,
            roamingMinWaitTime: 5.0,
            roamingMaxWaitTime: 15.0,
        },
        'scorpion': {
            speed: 4.0, // Slow but faster than snake
            aggroRadius: 8.0, // Very short range
            deaggroRadius: 30.0,
            color: 0x444444, // Dark grey / black
            minDistance: 4.0,
            verticalOffset: 0.05,
            maxPlacementAttempts: 8,
            roamingRadius: 10.0,
            roamingSpeedFactor: 0.4,
            roamingMinWaitTime: 3.0,
            roamingMaxWaitTime: 8.0,
        }
    },

    // --- Enemy Roaming --- (Keep defaults, won't be used yet)
    ENEMY_ROAMING_RADIUS: 15.0,
    ENEMY_ROAMING_SPEED_FACTOR: 0.5,
    ENEMY_ROAMING_MIN_WAIT_TIME: 2.0,
    ENEMY_ROAMING_MAX_WAIT_TIME: 5.0,

    // --- Object Generation ---
    OBJECT_TYPES: [
        // --- Coins (Keep definition for potential testing) ---
        {
            type: 'coin',
            density: 0.000465, // Same density for now
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
            density: 0.00012, // Increased from 0.0001 but less than 0.00015
            minDistance: 25.0, // Reduced from 50.0 to make placement easier
            verticalOffset: 1.5,
            scaleRange: [1.2, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 20, // Increased from 10 to give more chances for successful placement
        },
        {
            type: 'doubler',
            density: 0.00012,
            minDistance: 25.0,
            verticalOffset: 1.5,
            scaleRange: [1.2, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 20,
        },
        {
            type: 'invisibility',
            density: 0.00012,
            minDistance: 25.0,
            verticalOffset: 1.5,
            scaleRange: [1.2, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 20,
        },
        // --- Atmospheric Elements ---
        {
            type: 'buzzard',
            density: 0.00001, // Very rare, mainly handled by game.js
            minDistance: 50.0,
            verticalOffset: 80.0, // High in the sky
            scaleRange: [1, 1.5],
            randomRotationY: true,
            collidable: false,
            scoreValue: 0,
            maxPlacementAttempts: 5,
        },
        // --- Placeholder Obstacle ---
        {
            type: 'rock_desert', // Simple placeholder
            density: 0.0003, // Some density
            minDistance: 2.5,
            verticalOffset: 0.6,
            scaleRange: [1.0, 3.0],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 8,
        },
        // --- Desert Specific Obstacles ---
        {
            type: 'cactus_saguaro', // Tall cactus
            density: 0.00015,
            minDistance: 4.0,
            verticalOffset: 0,
            scaleRange: [2.0, 5.0], // Tall
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 10,
        },
        {
            type: 'cactus_barrel', // Short, round cactus
            density: 0.000225,
            minDistance: 2.0,
            verticalOffset: 0.3,
            scaleRange: [0.8, 1.8],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 8,
        },
        {
            type: 'saloon', // Structure
            density: 0.000015, // Rare
            minDistance: 20.0,
            verticalOffset: 0,
            scaleRange: [1, 1], // Fixed size
            randomRotationY: false, // Usually aligned
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 20,
        },
        {
            type: 'railroad_sign',
            density: 0.000075,
            minDistance: 3.0,
            verticalOffset: 0,
            scaleRange: [1, 1],
            randomRotationY: true,
            collidable: true, // Thin, but collidable
            scoreValue: 0,
            maxPlacementAttempts: 10,
        },
        {
            type: 'skull', // Scatter detail
            density: 0.00015,
            minDistance: 1.5,
            verticalOffset: 0.1,
            scaleRange: [0.7, 1.5],
            randomRotationY: true,
            collidable: false, // Non-collidable detail
            scoreValue: 0,
            maxPlacementAttempts: 8,
        },
        {
            type: 'dried_bush',
            density: 0.000375,
            minDistance: 1.8,
            verticalOffset: 0.2,
            scaleRange: [0.9, 2.2],
            randomRotationY: true,
            collidable: true, // Can impede slightly
            scoreValue: 0,
            maxPlacementAttempts: 8,
        },
        {
            type: 'wagon_wheel',
            density: 0.00012,
            minDistance: 2.5,
            verticalOffset: 0.1,
            scaleRange: [1, 1],
            randomRotationY: true,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 10,
        },
        {
            type: 'mine_entrance', // Structure facade
            density: 0.0000225, // Rare
            minDistance: 15.0,
            verticalOffset: 0,
            scaleRange: [1, 1],
            randomRotationY: false,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 18,
        },
        {
            type: 'water_tower', // Structure
            density: 0.000018, // Rare
            minDistance: 18.0,
            verticalOffset: 0,
            scaleRange: [1, 1],
            randomRotationY: false,
            collidable: true,
            scoreValue: 0,
            maxPlacementAttempts: 18,
        },
        {
            type: 'tumbleweed', // Hazard - dynamic rolling hazard
            density: 0.00045, // Further increased density for more tumbleweeds
            minDistance: 30.0, // Increased to spawn further from path
            verticalOffset: 1.5, // Start higher above ground to prevent sinking
            scaleRange: [0.8, 1.2], // Match tumbleweedConfig
            randomRotationY: true,
            collidable: true, // Will be handled by physics/collision
            scoreValue: 0,
            maxPlacementAttempts: 25, // More attempts to ensure placement
            isHazard: true,
            spawnOffPath: true, // Flag to indicate spawning to sides of player path
            spawnOffsetRange: [60, 100], // Significantly increased range to spawn further from path
        },
    ]
};
