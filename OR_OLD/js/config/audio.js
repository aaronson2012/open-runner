
export const audioConfig = {
    INITIAL_MASTER_GAIN: 0.7,
    COIN: {
        DURATION: 0.1,
        FREQUENCY: 1800,
        VOLUME: 0.4,
        ATTACK_TIME: 0.005,
        DECAY_TARGET: 0.001,
        OSC_TYPE: 'square',

        USE_HARMONY: true,
        HARMONY_FACTOR: 1.5, // Perfect Fifth
        HARMONY_VOLUME_FACTOR: 0.5
    },
    COLLISION: {
        DURATION: 0.18,
        VOLUME: 0.6,
        ATTACK_TIME: 0.01,
        DECAY_TARGET: 0.001,

        USE_THUMP: true,
        THUMP_FREQ: 70,
        THUMP_VOLUME_FACTOR: 0.3,
        THUMP_DECAY_FACTOR: 0.8 // Relative to main duration
    },
    BUTTON_CLICK: {
        DURATION: 0.03,
        FREQUENCY: 1000,
        VOLUME: 0.3,
        ATTACK_TIME: 0.002,
        DECAY_TARGET: 0.001,
        OSC_TYPE: 'square'
    },
    GAME_OVER: {
        NOTE_DURATION: 0.15,
        GAP: 0.08,
        START_VOLUME: 0.4,
        FREQUENCIES: [392.00, 329.63, 261.63, 261.63 * 0.8], // G4, E4, C4, ~G#3
        ATTACK_TIME: 0.01,
        HOLD_FACTOR: 0.7, // Hold note for 70% of duration before decay
        DECAY_TARGET: 0.001,
        OSC_TYPE: 'square',

        USE_VIBRATO: true,
        VIBRATO_RATE: 10,
        VIBRATO_DEPTH: 5
    },
    TURN: {
        DURATION: 0.05,
        FREQUENCY: 300,
        VOLUME: 0.15,
        ATTACK_TIME: 0.005,
        DECAY_TARGET: 0.001,
        OSC_TYPE: 'square'
    }
};