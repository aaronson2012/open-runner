// js/levels/level2_desert.js

export const level2Config = {
    // --- Terrain ---
    TERRAIN_COLOR: 0xC2B280, // Sandy color
    NOISE_FREQUENCY: 0.015, // Slightly different frequency
    NOISE_AMPLITUDE: 4,   // Lower amplitude for flatter desert

    // --- Scene ---
    SCENE_BACKGROUND_COLOR: 0xF0E68C, // Khaki/Sandy background
    SCENE_FOG_COLOR: 0xF0E68C, // Match background
    SCENE_FOG_NEAR: 50,
    SCENE_FOG_FAR: 800, // Maybe slightly less fog distance

    // --- Lighting ---
    AMBIENT_LIGHT_COLOR: 0xffffff,
    AMBIENT_LIGHT_INTENSITY: 0.7, // Slightly brighter ambient?
    DIRECTIONAL_LIGHT_COLOR: 0xffffff,
    DIRECTIONAL_LIGHT_INTENSITY: 0.9, // Brighter sun?
    DIRECTIONAL_LIGHT_POS_X: 150,
    DIRECTIONAL_LIGHT_POS_Y: 150,
    DIRECTIONAL_LIGHT_POS_Z: 100,

    // --- Enemies ---
    ENEMY_DEFAULT_SPEED: 5.0, // Keep defaults for now
    ENEMY_DEFAULT_AGGRO_RADIUS: 30.0,
    ENEMY_DEFAULT_DEAGGRO_RADIUS: 30.0,
    ENEMY_SPAWN_DENSITY: 0.000375, // Increased density to include tumbleweeds
    ENEMY_TYPES: ['coyote', 'rattlesnake', 'scorpion', 'tumbleweed'], // Added tumbleweed as enemy
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
            aggroRadius: 15.0, // Rattle distance
            deaggroRadius: 30.0,
            color: 0xCD853F, // Peru (brownish)
            minDistance: 8.0,
            verticalOffset: 0.05, // Close to ground
            maxPlacementAttempts: 10,
            // Rattlesnake-specific properties
            rattleDistance: 15.0,
            leapDistance: 8.0,
            leapSpeed: 25.0,
            rattleDuration: 1.5,
            leapCooldownTime: 3.0,
            roamingRadius: 5.0, // Minimal roaming when using base behavior
            roamingSpeedFactor: 0.2,
            roamingMinWaitTime: 5.0,
            roamingMaxWaitTime: 15.0,
        },
        'scorpion': {
            speed: 1.5, // Base stalk speed
            aggroRadius: 25.0, // Stalk distance
            deaggroRadius: 35.0,
            color: 0x444444, // Dark grey / black
            minDistance: 6.0,
            verticalOffset: 0.05,
            maxPlacementAttempts: 8,
            // Scorpion-specific properties
            stalkDistance: 25.0,
            chaseDistance: 10.0,
            stalkSpeed: 1.5,
            chaseSpeed: 4.0,
            patience: 8.0,
            roamingRadius: 10.0,
            roamingSpeedFactor: 0.4,
            roamingMinWaitTime: 3.0,
            roamingMaxWaitTime: 8.0,
        },
        'tumbleweed': {
            speed: 8.0, // Base roll speed
            aggroRadius: 100.0, // Activation distance
            deaggroRadius: 150.0, // Deactivation distance
            color: 0x8B4513, // SaddleBrown
            minDistance: 30.0,
            verticalOffset: 1.0,
            maxPlacementAttempts: 25,
            // Tumbleweed-specific properties
            rollSpeed: 8.0,
            activationDistance: 100.0,
            deactivationDistance: 150.0,
            roamingRadius: 0, // No standard roaming
            roamingSpeedFactor: 0,
            roamingMinWaitTime: 0,
            roamingMaxWaitTime: 0,
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
        {
            type: 'rock_desert',
            density: 0.0001, // Reduced density significantly
            minDistance: 4.0, // Increased minimum distance
            verticalOffset: 0.6,
            scaleRange: [1.0, 2.5], // Reduced max scale
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
    ],


    COIN_VISUALS: {
        radius: 0.75,
        height: 0.2,
        color: 0xFFFF00, // Yellow
        spinSpeed: 1.0, // Radians per second
    },

    // --- Magnet Powerup Visuals ---
    MAGNET_VISUALS: {
        size: 0.8,
        color: 0xF60000, // Red
    },

    // --- Doubler ---
    DOUBLER_VISUALS: {
        size: 0.5,
        color: 0x0088FF, // Blue color
    },

    // --- Invisibility ---
    INVISIBILITY_VISUALS: {
        size: 1.0,
        color: 0x7C00FF, // Purple color
    },
};
