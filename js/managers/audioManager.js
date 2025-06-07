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
 * Initializes the Web Audio API AudioContext, sets up event listeners,
 * and ensures the audio context is running.
 * This must be called after a user interaction (e.g., a click).
 * @returns {Promise<boolean>} A promise that resolves to true if audio is successfully initialized, false otherwise.
 */
export async function init() {
    if (audioContext) {
        logger.info("Audio manager already initialized.");
        return true;
    }

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (e) {
                logger.warn("Could not resume audio context, possibly due to a muted tab. Continuing without audio.", e);
            }
        }

        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, audioContext.currentTime);
        masterGain.connect(audioContext.destination);
        
        setupEventListeners();
        
        logger.info("AudioManager initialized successfully.");
        return true;
    } catch (e) {
        eventBus.emit('errorOccurred', 'Web Audio API is not supported. Audio will be disabled.');
        logger.error('Web Audio API initialization failed:', e);
        audioContext = null;
        return false;
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
        if (!audioContext || !musicSource) {
            currentMusicId = null;
            musicSource = null;
            return true;
        }
    
        if (musicSource) {
            if (masterGain) {
                masterGain.disconnect();
                masterGain = audioContext.createGain();
                masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, audioContext.currentTime);
                masterGain.connect(audioContext.destination);
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
    if (!audioContext) {
        logger.warn(`[AudioManager] Audio not initialized. Cannot play music for ${levelId}.`);
        return null;
    }
    if (currentMusicId === levelId && musicSource) {
        logger.info(`[AudioManager] ${levelId} music already playing`);
        return musicSource;
    }

    try {
        await stopMusic();
        await new Promise(resolve => setTimeout(resolve, 50));

        const filePath = levelAudioMap[levelId];
        if (!filePath) {
            logger.error(`[AudioManager] No audio file defined for level: ${levelId}`);
            return null;
        }


        if (audioContext.state !== 'running') {
            await audioContext.resume();
        }


        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.status}`);
        }

        const audioData = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(audioData);


        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(masterGain);


        source.start(0);


        musicSource = source;
        currentMusicId = levelId;


        source.onended = () => {
            if (musicSource === source) {
                musicSource = null;
                currentMusicId = null;
            }
        };
        logger.info(`[AudioManager] Playing ${levelId} music`);
        return source;
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
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
        }


        const audioData = await response.arrayBuffer();


        const audioBuffer = await audioContext.decodeAudioData(audioData);


        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = loop;


        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;


        source.connect(gainNode);
        gainNode.connect(masterGain);


        source.start(0);


        return source;

    } catch (e) {
        logger.error("[AudioManager] Error playing wave file:", e);
        return null;
    }
}
