export const gameplayConfig = {
    POWERUP_TYPE_MAGNET: 'magnet',
    POWERUP_TYPE_DOUBLER: 'doubler',
    POWERUP_TYPE_INVISIBILITY: 'invisibility', // New powerup type
    POWERUP_DURATION: 10,
    
    // Magnet visual effect
    MAGNET_EFFECT_COLOR: 0xff0000,
    MAGNET_EFFECT_EMISSIVE: 0x330000,
    MAGNET_EFFECT_METALNESS: 0.9,
    MAGNET_EFFECT_ROUGHNESS: 0.1,
    
    // Doubler visual effect
    DOUBLER_EFFECT_COLOR: 0x0088FF,
    DOUBLER_EFFECT_EMISSIVE: 0x002244,
    DOUBLER_EFFECT_METALNESS: 0.7,
    DOUBLER_EFFECT_ROUGHNESS: 0.2,
    
    // Invisibility visual effect
    INVISIBILITY_EFFECT_COLOR: 0x7C00FF,
    INVISIBILITY_EFFECT_EMISSIVE: 0x330066,
    INVISIBILITY_EFFECT_METALNESS: 0.2,
    INVISIBILITY_EFFECT_ROUGHNESS: 0.3,
    INVISIBILITY_EFFECT_OPACITY: 0.7,

    DEFAULT_COIN_SCORE: 10,
    MAGNET_POWERUP_RADIUS: 80,
    MAGNET_POWERUP_FORCE: 150,
    COIN_COLLECTION_RADIUS_FACTOR: 1.5,
    PLAYER_SAFE_DISTANCE_FACTOR: 0.2,
    TREE_COLLISION_BUFFER: 0.2,
    DOUBLER_MULTIPLIER: 2,
    DOUBLER_COLLISION_RADIUS: 1.0,
    // INVISIBILITY_DURATION: 10, // Made redundant by invisibilityConfig.durationMs. Was 10 seconds.
    // INVISIBILITY_FADE_TIME: 1.5, // Made redundant by invisibilityConfig.fadeTimeMs. Was 1.5 seconds.

    // Configuration specific to the Invisibility Power-Up
    invisibilityConfig: {
        // durationMs: Authoritative duration of the invisibility effect in milliseconds.
        // This resolves the ambiguity between a general POWERUP_DURATION and a specific INVISIBILITY_DURATION.
        durationMs: 10000, // Equivalent to 10 seconds
        // fadeTimeMs: Duration of the fade in/out effect for invisibility in milliseconds.
        fadeTimeMs: 1500   // Equivalent to 1.5 seconds
    },
}
