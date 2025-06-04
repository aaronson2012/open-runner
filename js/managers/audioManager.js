import * as UIManager from './uiManager.js';
import eventBus from '../core/eventBus.js';
import { GameStates } from '../core/gameStateManager.js';
import * as LevelManager from './levelManager.js';
import { audioConfig } from '../config/audio.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AudioManager');

let audioContext = null;
let masterGain = null;
let musicSource = null;
let currentMusicId = null;

const levelAudioMap = {
    'theme': '/assets/audio/openrunnertheme.wav',
    'level1': '/assets/audio/openrunnersong1.wav',
    'level2': '/assets/audio/openrunnersong2.wav',
}

export const effectAudioMap = {
    'buttonclick': '/assets/audio/buttonclick2.wav',
    'collision': '/assets/audio/collisionsound.wav',
    'coin': '/assets/audio/coinsound.wav',
    'gameover': '/assets/audio/gameover.wav',
    'powerup': '/assets/audio/powerupsound.wav',
    'turn': '/assets/audio/turnsound.wav',
}

/**
 * Sets up the event listeners for the AudioManager.
 * Assumes audioContext is initialized.
 */
function setupEventListeners() {
    if (!audioContext) return;

    // Listen for player death (collision)
    eventBus.subscribe('playerDied', () => {
       playWaveFile(effectAudioMap['collision']);
    });

    eventBus.subscribe('gameStateChanged', ({ newState, previousState }) => { // Destructure newState and previousState
        logger.info(`Audio handling game state change: ${previousState} -> ${newState}`);

        if (newState === GameStates.GAME_OVER) {

            playWaveFile(effectAudioMap['gameover']);
        } else if (newState === GameStates.TITLE) {

            if (currentMusicId !== 'theme') {
                stopMusic(); // Explicitly stop any current music first
                setTimeout(() => {
                    playMusic('theme');
                    logger.info("Playing theme music when returning to title screen");
                }, 50);
            } else {
                logger.info("Theme music already playing, not restarting");
            }
        } else if (newState === GameStates.PLAYING) {
            const currentLevelId = LevelManager.getCurrentLevelId();
            
            if (currentMusicId !== currentLevelId) {
                stopMusic(); // Explicitly stop any current music first
                setTimeout(() => {
                    playMusic(LevelManager.getCurrentLevelId());
                }, 50);
            }
        }
    });

    eventBus.subscribe('scoreChanged', (scoreIncrement) => {

        if (scoreIncrement > 0) {
            playWaveFile(effectAudioMap['coin']);
        }
    });


    eventBus.subscribe('uiButtonClicked', () => {
        playWaveFile(effectAudioMap['buttonclick']);
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
        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, audioContext.currentTime);
        masterGain.connect(audioContext.destination);


        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                 setupEventListeners();
            }).catch(e => {
                 logger.error("Failed to resume AudioContext:", e);
                 UIManager.displayError(new Error('Failed to resume audio context. Audio might not work.'));
            });
        } else {
             setupEventListeners();
        }

    } catch (e) {

        UIManager.displayError(new Error('Web Audio API is not supported or failed to initialize. Game audio will be disabled.'));
        logger.error('Web Audio API initialization failed:', e);
        audioContext = null;
    }
}

/**
 * Stops the currently playing background music.
 * Uses a robust approach to ensure music actually stops.
 * @returns {Promise<boolean>} Promise that resolves to true if music was stopped
 */
export async function stopMusic() {
    logger.info("[AudioManager] Stopping music");
    try {
        if (musicSource) {
            // Stop the audio source
            try {
                musicSource.stop();
            } catch (stopError) {
                // Source might already be stopped, ignore error
                logger.debug("[AudioManager] Music source already stopped or invalid");
            }

            // Disconnect and recreate master gain to ensure clean state
            if (masterGain && audioContext) {
                try {
                    masterGain.disconnect();
                    masterGain = audioContext.createGain();
                    masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, audioContext.currentTime);
                    masterGain.connect(audioContext.destination);
                } catch (gainError) {
                    logger.error("[AudioManager] Error recreating master gain:", gainError);
                }
            }
        }

        musicSource = null;
        currentMusicId = null;

        return true;
    } catch (e) {
        logger.error("[AudioManager] Error stopping music:", e);
        musicSource = null;
        currentMusicId = null;
        return false;
    }
}

/**
 * Plays background music with reliable stopping of any previous music.
 * @param {string} levelId - the level music to play (e.g., 'level1', 'level2', 'theme')
 * @param {number} volume - Volume level from 0 to 1 (default: 0.3)
 * @returns {Promise<AudioBufferSourceNode|null>} The audio source node or null if playback failed
 */
export async function playMusic(levelId = 'theme', volume = 0.3) {
    if (currentMusicId === levelId && musicSource) {
        logger.info(`[AudioManager] ${levelId} music already playing`);
        return musicSource;
    }

    try {
        // Ensure audio context is available
        if (!audioContext || !masterGain) {
            logger.error("[AudioManager] Audio context not initialized");
            return null;
        }

        await stopMusic();
        await new Promise(resolve => setTimeout(resolve, 50));

        const filePath = levelAudioMap[levelId];
        if (!filePath) {
            logger.error(`[AudioManager] No audio file defined for level: ${levelId}`);
            return null;
        }

        // Resume audio context if needed
        if (audioContext.state !== 'running') {
            await audioContext.resume();
        }

        // Fetch and decode audio with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            const response = await fetch(filePath, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
            }

            const audioData = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(audioData);

            // Create and configure audio source
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;

            const gainNode = audioContext.createGain();
            gainNode.gain.value = Math.max(0, Math.min(1, volume)); // Clamp volume

            source.connect(gainNode);
            gainNode.connect(masterGain);

            // Start playback
            source.start(0);

            // Store references
            musicSource = source;
            currentMusicId = levelId;

            // Handle source end
            source.onended = () => {
                if (musicSource === source) {
                    musicSource = null;
                    currentMusicId = null;
                }
            };

            logger.info(`[AudioManager] Playing ${levelId} music`);
            return source;
        } catch (fetchError) {
            clearTimeout(timeoutId);
            throw fetchError;
        }
    } catch (error) {
        logger.error(`[AudioManager] Error playing music for ${levelId}:`, error);
        musicSource = null;
        currentMusicId = null;
        return null;
    }
}

/**
 * Checks if music is currently playing.
 * @returns {boolean} True if music is playing, false otherwise
 */
export function isMusicActive() {
    return currentMusicId !== null && musicSource !== null;
}

/**
 * Gets the ID of the currently playing music.
 * @returns {string|null} The ID of the current music, or null if no music is playing
 */
export function getCurrentMusicId() {
    return currentMusicId;
}

/**
 * Plays a wave file from the specified path.
 * @param {string} filePath - Path to the wave file
 * @param {number} volume - Volume level from 0 to 1 (default: 0.5)
 * @param {boolean} loop - Whether to loop the audio (default: false)
 * @returns {Promise<AudioBufferSourceNode|null>} The audio source node or null if playback failed
 */
export async function playWaveFile(filePath, volume = 0.5, loop = false) {
    if (!audioContext || !masterGain) {
        logger.error("[AudioManager] Cannot play wave file: Audio context not initialized");
        return null;
    }

    try {
        // Add timeout for fetch operation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(filePath, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
        }

        const audioData = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(audioData);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = loop;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, volume)); // Clamp volume

        source.connect(gainNode);
        gainNode.connect(masterGain);

        source.start(0);

        return source;

    } catch (e) {
        if (e.name === 'AbortError') {
            logger.error("[AudioManager] Audio file fetch timed out:", filePath);
        } else {
            logger.error("[AudioManager] Error playing wave file:", e);
        }
        return null;
    }
}
