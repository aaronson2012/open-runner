
export const playerConfig = {

    SPEED: 15.0,
    SPEED_INCREASE_RATE: 0.25,
    HEIGHT_OFFSET: 3.5,
    RAYCAST_ORIGIN_OFFSET: 5,
    RAYCAST_STRIDE_OFFSET: 1.0,

    // Falling physics
    GRAVITY: 30.0, // Acceleration due to gravity
    MAX_FALL_SPEED: 60.0, // Maximum speed the player can fall at
    MIN_Y_POSITION: -50.0, // Position below which player is considered out of bounds
// Slope handling
    MAX_CLIMBABLE_SLOPE_ANGLE: 45.0, // Maximum angle in degrees player can climb
    SLIDE_SPEED_FACTOR: 1.5, // How fast player slides on steep slopes (multiplier of current speed)
    SLOPE_NORMAL_SMOOTHING_FACTOR: 0.1, // Factor for smoothing player orientation to slope normal (0-1, lower is smoother)
    PLAYER_ALIGN_TO_SLOPE_SPEED: 5.0, // Speed at which player model aligns to slope normal
    SLOPE_ALIGNMENT_FACTOR: 0.3, // How much the player leans into the slope (0 = no lean, 1 = full align)

    HEAD_SIZE: 1.5,
    TORSO_HEIGHT: 3,
    TORSO_WIDTH: 2,
    TORSO_DEPTH: 1,
    LIMB_WIDTH: 0.75,
    ARM_LENGTH: 2.5,
    LEG_LENGTH: 3,


    ANIMATION_BASE_SPEED: 3.0,
    MAX_ANIMATION_SPEED_FACTOR: 2.0,
    ARM_SWING_AMPLITUDE: Math.PI / 3,
    LEG_SWING_AMPLITUDE: Math.PI / 4,
    ELBOW_BEND_AMPLITUDE: Math.PI / 2.5,
    KNEE_BEND_AMPLITUDE: Math.PI / 2,


    DEFAULT_COLOR: 0x808080,
    DEFAULT_ROUGHNESS: 0.7,
    DEFAULT_METALNESS: 0.1,
    JOINT_SEGMENTS_W: 8,
    JOINT_SEGMENTS_H: 6,
    LIMB_OFFSET_FACTOR: 0.5,


    INITIAL_POS_X: 0,
    INITIAL_POS_Y: 5,
    INITIAL_POS_Z: 5,
};


playerConfig.UPPER_ARM_LENGTH = playerConfig.ARM_LENGTH * 0.5;
playerConfig.FOREARM_LENGTH = playerConfig.ARM_LENGTH * 0.5;
playerConfig.THIGH_LENGTH = playerConfig.LEG_LENGTH * 0.5;
playerConfig.CALF_LENGTH = playerConfig.LEG_LENGTH * 0.5;
playerConfig.JOINT_RADIUS = playerConfig.LIMB_WIDTH / 1.5;