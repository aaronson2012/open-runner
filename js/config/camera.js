
export const cameraConfig = {
    FOV: 75,
    NEAR_PLANE: 0.1,
    FAR_PLANE: 2000,
    FOLLOW_OFFSET_X: 0,
    FOLLOW_OFFSET_Y: 15,
    FOLLOW_OFFSET_Z: 30,
    LOOK_AT_OFFSET_Y: 2,
    SMOOTHING_FACTOR: 0.1, // Lower values mean smoother/slower camera
    POST_TRANSITION_SMOOTH_DURATION: 0.75, // seconds for special smoothing after transition
    POST_TRANSITION_RESPONSIVENESS_FACTOR: 0.1, // Multiplier for SMOOTHING_FACTOR during post-transition (0.1 = 10x more responsive)
};