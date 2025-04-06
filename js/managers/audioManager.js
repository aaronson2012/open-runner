// js/managers/audioManager.js
import * as UIManager from './uiManager.js';
import eventBus from '../core/eventBus.js';
import { GameStates } from '../core/gameStateManager.js';
import { audioConfig } from '../config/audio.js'; // Import specific audio config
import { createLogger } from '../utils/logger.js'; // Import logger

const logger = createLogger('AudioManager'); // Instantiate logger

let audioContext = null;
let masterGain = null; // Master gain node for overall volume control

/**
 * Sets up the event listeners for the AudioManager.
 * Assumes audioContext is initialized.
 */
function setupEventListeners() {
    if (!audioContext) return;


    // Listen for player death (collision)
    eventBus.subscribe('playerDied', () => {
        playCollisionSound();
    });

    // Listen for game state changes (specifically for Game Over)
    eventBus.subscribe('gameStateChanged', ({ newState }) => { // Destructure newState
        if (newState === GameStates.GAME_OVER) {
            playGameOverSound();
        }
        // Add other state-based sounds here if needed (e.g., music changes)
    });

    // Listen for score changes (coin collection)
    eventBus.subscribe('scoreChanged', (scoreIncrement) => {
        // Only play sound for positive score changes (collections)
        if (scoreIncrement > 0) {
             playCoinSound();
        }
    });

    // Listen for generic UI button clicks
    eventBus.subscribe('uiButtonClicked', () => {
        playButtonClickSound();
    });

}


/**
 * Initializes the Web Audio API AudioContext and sets up event listeners.
 * Must be called after a user interaction (e.g., button click).
 */
export function initAudio() {
    if (audioContext) {
        return; // Already initialized
    }
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create and connect a master gain node
        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, audioContext.currentTime); // Use audioConfig
        masterGain.connect(audioContext.destination);

        // Resume context if it starts suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                 setupEventListeners(); // Setup listeners after context is ready
            }).catch(e => {
                 logger.error("Failed to resume AudioContext:", e);
                 UIManager.displayError(new Error('Failed to resume audio context. Audio might not work.'));
            });
        } else {
             setupEventListeners(); // Setup listeners immediately if context is running
        }

    } catch (e) {
        // Display error to user if Web Audio fails
        UIManager.displayError(new Error('Web Audio API is not supported or failed to initialize. Game audio will be disabled.'));
        logger.error('Web Audio API initialization failed:', e); // Use logger for consistency
        audioContext = null; // Ensure it's null if failed
    }
}

/**
 * Plays a retro/8-bit style coin collection sound.
 */
export function playCoinSound() {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const config = audioConfig.COIN; // Use audioConfig
    const duration = config.DURATION;
    const frequency = config.FREQUENCY;
    const volume = config.VOLUME;

    // Oscillator
    const osc = audioContext.createOscillator();
    osc.type = config.OSC_TYPE;
    osc.frequency.setValueAtTime(frequency, now);

    // Gain node for volume envelope
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + config.ATTACK_TIME);
    gainNode.gain.exponentialRampToValueAtTime(config.DECAY_TARGET, now + duration);

    // Optional: Second oscillator for harmony
    let osc2, gainNode2;
    if (config.USE_HARMONY) {
        osc2 = audioContext.createOscillator();
        osc2.type = config.OSC_TYPE;
        osc2.frequency.setValueAtTime(frequency * config.HARMONY_FACTOR, now);
        gainNode2 = audioContext.createGain();
        gainNode2.gain.setValueAtTime(0, now);
        gainNode2.gain.linearRampToValueAtTime(volume * config.HARMONY_VOLUME_FACTOR, now + config.ATTACK_TIME);
        gainNode2.gain.exponentialRampToValueAtTime(config.DECAY_TARGET, now + duration);
    }

    // Connect nodes
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    if (osc2 && gainNode2) {
        osc2.connect(gainNode2);
        gainNode2.connect(masterGain);
    }

    // Start and stop
    osc.start(now);
    osc.stop(now + duration);
    if (osc2) {
        osc2.start(now);
        osc2.stop(now + duration);
    }
}

/**
 * Plays a retro/8-bit style collision sound (noise burst).
 */
export function playCollisionSound() {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const config = audioConfig.COLLISION; // Use audioConfig
    const duration = config.DURATION;
    const volume = config.VOLUME;

    // Create buffer for white noise
    const bufferSize = Math.floor(audioContext.sampleRate * duration);
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1; // White noise
    }

    // Create buffer source
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Optional: Low square wave for thump
    let lowOsc, lowGain;
    if (config.USE_THUMP) {
        lowOsc = audioContext.createOscillator();
        lowOsc.type = 'square';
        lowOsc.frequency.setValueAtTime(config.THUMP_FREQ, now);
        lowGain = audioContext.createGain();
        lowGain.gain.setValueAtTime(volume * config.THUMP_VOLUME_FACTOR, now);
        lowGain.gain.exponentialRampToValueAtTime(config.DECAY_TARGET, now + duration * config.THUMP_DECAY_FACTOR);
    }

    // Gain node for main noise volume envelope
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + config.ATTACK_TIME);
    gainNode.gain.exponentialRampToValueAtTime(config.DECAY_TARGET, now + duration);

    // Connect nodes
    noiseSource.connect(gainNode);
    gainNode.connect(masterGain);
    if (lowOsc && lowGain) {
        lowOsc.connect(lowGain);
        lowGain.connect(masterGain);
    }

    // Start the sources
    noiseSource.start(now);
    if (lowOsc) {
        lowOsc.start(now);
        lowOsc.stop(now + duration * config.THUMP_DECAY_FACTOR);
    }
    // BufferSource stops automatically
}

/**
 * Plays a retro/8-bit style UI button click sound.
 */
export function playButtonClickSound() {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const config = audioConfig.BUTTON_CLICK; // Use audioConfig
    const duration = config.DURATION;
    const frequency = config.FREQUENCY;
    const volume = config.VOLUME;

    // Oscillator
    const osc = audioContext.createOscillator();
    osc.type = config.OSC_TYPE;
    osc.frequency.setValueAtTime(frequency, now);

    // Gain node (very fast envelope)
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + config.ATTACK_TIME);
    gainNode.gain.exponentialRampToValueAtTime(config.DECAY_TARGET, now + duration);

    // Connect
    osc.connect(gainNode);
    gainNode.connect(masterGain);

    // Start/Stop
    osc.start(now);
    osc.stop(now + duration);
}

/**
 * Plays a retro/8-bit style descending arpeggio for game over.
 */
export function playGameOverSound() {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const config = audioConfig.GAME_OVER; // Use audioConfig
    const noteDuration = config.NOTE_DURATION;
    const gap = config.GAP;
    const startVolume = config.START_VOLUME;
    const frequencies = config.FREQUENCIES;
    const vibratoRate = config.VIBRATO_RATE;
    const vibratoDepth = config.VIBRATO_DEPTH;

    frequencies.forEach((freq, index) => {
        const startTime = now + index * (noteDuration + gap);

        // Main Oscillator
        const osc = audioContext.createOscillator();
        osc.type = config.OSC_TYPE;
        osc.frequency.setValueAtTime(freq, startTime);

        // Optional: LFO for Vibrato
        let lfo, lfoGain;
        if (config.USE_VIBRATO) {
            lfo = audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(vibratoRate, startTime);
            lfoGain = audioContext.createGain();
            lfoGain.gain.setValueAtTime(vibratoDepth, startTime);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency); // Modulate frequency
        }

        // Gain node for envelope per note
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(startVolume, startTime + config.ATTACK_TIME);
        gainNode.gain.setValueAtTime(startVolume, startTime + noteDuration * config.HOLD_FACTOR);
        gainNode.gain.linearRampToValueAtTime(config.DECAY_TARGET, startTime + noteDuration);

        // Connect
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        // Schedule start/stop
        if (lfo) {
            lfo.start(startTime);
            lfo.stop(startTime + noteDuration);
        }
        osc.start(startTime);
        osc.stop(startTime + noteDuration);
    });
}

/**
 * Plays a retro/8-bit style turn sound (short low blip).
 */
export function playTurnSound() {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const config = audioConfig.TURN; // Use audioConfig
    const duration = config.DURATION;
    const frequency = config.FREQUENCY;
    const volume = config.VOLUME;

    // Oscillator
    const osc = audioContext.createOscillator();
    osc.type = config.OSC_TYPE;
    osc.frequency.setValueAtTime(frequency, now);

    // Gain node
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + config.ATTACK_TIME);
    gainNode.gain.exponentialRampToValueAtTime(config.DECAY_TARGET, now + duration);

    // Connect
    osc.connect(gainNode);
    gainNode.connect(masterGain);

    // Start/Stop
    osc.start(now);
    osc.stop(now + duration);
}