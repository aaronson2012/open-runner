import * as UIManager from './uiManager.js';
import eventBus from '../core/eventBus.js';
import { GameStates } from '../core/gameStateManager.js';
import * as LevelManager from './levelManager.js';
import { audioConfig } from '../config/audio.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AudioManager');

let currentMusicAudio = null;
let currentMusicId = null;
let masterVolume = audioConfig.INITIAL_MASTER_GAIN || 0.7;
let hasUserInteracted = false;
let audioUnlocked = false;
let pendingMusicRequest = null;

// Audio element pools for effects (to allow overlapping sounds)
const effectAudioPools = {};
const musicAudioElements = {};

// Queue for pending audio actions
const pendingAudioQueue = [];

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
 * Creates an audio element pool for effects to allow overlapping sounds
 */
function createAudioPool(src, poolSize = 3) {
    const pool = [];
    for (let i = 0; i < poolSize; i++) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 0.5 * masterVolume;
        pool.push(audio);
    }
    return pool;
}

/**
 * Gets an available audio element from the pool
 */
function getAvailableAudio(pool) {
    // Find an audio element that's not currently playing
    let availableAudio = pool.find(audio => audio.paused || audio.ended);
    
    // If none available, use the first one (interrupt it)
    if (!availableAudio) {
        availableAudio = pool[0];
        availableAudio.currentTime = 0;
    }
    
    return availableAudio;
}

/**
 * Tracks the first user interaction to unlock audio
 */
function trackUserInteraction() {
    if (hasUserInteracted) return;
    
    hasUserInteracted = true;
    logger.info('First user interaction detected - unlocking audio');
    
    // Try to unlock audio by playing a silent sound
    unlockAudio().then(() => {
        // Process any pending audio requests
        if (pendingMusicRequest) {
            const { levelId, volume } = pendingMusicRequest;
            pendingMusicRequest = null;
            playMusic(levelId, volume);
        }
        
        // Process queued audio actions
        while (pendingAudioQueue.length > 0) {
            const action = pendingAudioQueue.shift();
            action();
        }
    });
}

/**
 * Attempts to unlock audio by playing a silent audio file
 */
async function unlockAudio() {
    if (audioUnlocked) return true;
    
    try {
        // Create a silent audio element to test/unlock audio
        const silentAudio = new Audio('data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////8AAABhTEFNRTMuMTAwA6kAAAAAAAAAABRAJAOHQQAB9AAAASAAhb6+p');
        silentAudio.volume = 0.01;
        
        await silentAudio.play();
        audioUnlocked = true;
        logger.info('Audio successfully unlocked');
        return true;
        
    } catch (e) {
        logger.warn('Audio unlock failed:', e.message);
        // Even if unlock fails, mark as attempted so we don't keep trying
        audioUnlocked = true;
        return false;
    }
}

/**
 * Sets up global user interaction listeners
 */
function setupUserInteractionTracking() {
    const events = ['click', 'touchstart', 'keydown'];
    
    const handleInteraction = () => {
        trackUserInteraction();
        // Remove listeners after first interaction
        events.forEach(event => {
            document.removeEventListener(event, handleInteraction);
        });
    };
    
    events.forEach(event => {
        document.addEventListener(event, handleInteraction, { passive: true });
    });
}

/**
 * Initializes all audio elements and pools
 */
export function initAudio() {
    logger.info('Initializing HTML5 audio system');
    
    try {
        // Create effect audio pools
        Object.entries(effectAudioMap).forEach(([key, src]) => {
            effectAudioPools[key] = createAudioPool(src, 3);
        });
        
        // Create music audio elements
        Object.entries(levelAudioMap).forEach(([key, src]) => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.loop = true;
            audio.volume = 0.3 * masterVolume;
            
            // Handle loading errors
            audio.addEventListener('error', (e) => {
                logger.error(`Failed to load music ${key}:`, e);
            });
            
            musicAudioElements[key] = audio;
        });
        
        setupEventListeners();
        setupUserInteractionTracking();
        logger.info('HTML5 audio system initialized successfully');
        
    } catch (e) {
        logger.error('HTML5 audio initialization failed:', e);
        UIManager.displayError(new Error('Audio system failed to initialize. Audio will be disabled.'));
    }
}

/**
 * Sets up the event listeners for the AudioManager.
 */
function setupEventListeners() {
    // Listen for player death (collision)
    eventBus.subscribe('playerDied', () => {
       playWaveFile(effectAudioMap['collision']);
    });

    eventBus.subscribe('gameStateChanged', ({ newState, previousState }) => {
        logger.info(`Audio handling game state change: ${previousState} -> ${newState}`);

        if (newState === GameStates.GAME_OVER) {
            playWaveFile(effectAudioMap['gameover']);
        } else if (newState === GameStates.TITLE) {
            if (currentMusicId !== 'theme') {
                stopMusic();
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
                stopMusic();
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
        // Button clicks are perfect user interactions for unlocking audio
        trackUserInteraction();
        playWaveFile(effectAudioMap['buttonclick']);
    });
}

/**
 * Stops the currently playing background music.
 * @returns {Promise<boolean>} Promise that resolves to true if music was stopped
 */
export async function stopMusic() {
    logger.info("[AudioManager] Stopping music");
    
    try {
        if (currentMusicAudio) {
            currentMusicAudio.pause();
            currentMusicAudio.currentTime = 0;
            
            // Remove event listeners to prevent memory leaks
            currentMusicAudio.onended = null;
            currentMusicAudio.onerror = null;
        }
        
        currentMusicAudio = null;
        currentMusicId = null;
        
        return true;
    } catch (e) {
        logger.error("[AudioManager] Error stopping music:", e);
        currentMusicAudio = null;
        currentMusicId = null;
        return false;
    }
}

/**
 * Plays background music using HTML5 audio.
 * @param {string} levelId - the level music to play (e.g., 'level1', 'level2', 'theme')
 * @param {number} volume - Volume level from 0 to 1 (default: 0.3)
 * @returns {Promise<HTMLAudioElement|null>} The audio element or null if playback failed
 */
export async function playMusic(levelId = 'theme', volume = 0.3) {
    // If no user interaction yet, queue this request
    if (!hasUserInteracted) {
        logger.info(`[AudioManager] Queueing music ${levelId} until user interaction`);
        pendingMusicRequest = { levelId, volume };
        return null;
    }

    if (currentMusicId === levelId && currentMusicAudio && !currentMusicAudio.paused) {
        logger.info(`[AudioManager] ${levelId} music already playing`);
        return currentMusicAudio;
    }

    try {
        // Stop any current music
        await stopMusic();
        
        // Small delay to ensure clean transition
        await new Promise(resolve => setTimeout(resolve, 50));

        const audioElement = musicAudioElements[levelId];
        if (!audioElement) {
            logger.error(`[AudioManager] No audio element found for level: ${levelId}`);
            return null;
        }

        // Set volume and prepare audio
        audioElement.volume = volume * masterVolume;
        audioElement.currentTime = 0;
        
        // Set up event handlers
        audioElement.onended = () => {
            if (currentMusicAudio === audioElement) {
                logger.info(`[AudioManager] Music ${levelId} ended naturally`);
            }
        };
        
        audioElement.onerror = (e) => {
            logger.error(`[AudioManager] Error playing music ${levelId}:`, e);
            if (currentMusicAudio === audioElement) {
                currentMusicAudio = null;
                currentMusicId = null;
            }
        };

        // Play the audio
        await audioElement.play();
        
        // Update state
        currentMusicAudio = audioElement;
        currentMusicId = levelId;
        
        logger.info(`[AudioManager] Playing ${levelId} music`);
        return audioElement;
        
    } catch (error) {
        // Handle autoplay blocking gracefully
        if (error.name === 'NotAllowedError' || error.message.includes('not allowed')) {
            logger.info(`[AudioManager] Music ${levelId} blocked by autoplay policy - will play after user interaction`);
            pendingMusicRequest = { levelId, volume };
            return null;
        }
        
        logger.error(`[AudioManager] Error playing music for ${levelId}:`, error);
        currentMusicAudio = null;
        currentMusicId = null;
        return null;
    }
}

/**
 * Plays a wave file using HTML5 audio.
 * @param {string} filePath - Path to the wave file
 * @param {number} volume - Volume level from 0 to 1 (default: 0.5)
 * @param {boolean} loop - Whether to loop the audio (default: false)
 * @returns {Promise<HTMLAudioElement|null>} The audio element or null if playback failed
 */
export async function playWaveFile(filePath, volume = 0.5, loop = false) {
    // If no user interaction yet, queue this action (but only for important sounds)
    if (!hasUserInteracted) {
        // Only queue certain important sounds, skip others like coin sounds to avoid spam
        const effectKey = Object.keys(effectAudioMap).find(key => effectAudioMap[key] === filePath);
        if (effectKey && ['collision', 'gameover', 'buttonclick'].includes(effectKey)) {
            logger.info(`[AudioManager] Queueing effect ${effectKey} until user interaction`);
            pendingAudioQueue.push(() => playWaveFile(filePath, volume, loop));
        }
        return null;
    }

    try {
        // Find the effect key for this file path
        const effectKey = Object.keys(effectAudioMap).find(key => effectAudioMap[key] === filePath);
        
        let audioElement;
        
        if (effectKey && effectAudioPools[effectKey]) {
            // Use pooled audio for effects
            audioElement = getAvailableAudio(effectAudioPools[effectKey]);
        } else {
            // Create a new audio element for non-pooled sounds
            audioElement = new Audio(filePath);
            audioElement.preload = 'auto';
        }
        
        // Set properties
        audioElement.volume = volume * masterVolume;
        audioElement.loop = loop;
        audioElement.currentTime = 0;
        
        // Handle errors
        audioElement.onerror = (e) => {
            logger.error("[AudioManager] Error playing wave file:", e);
        };
        
        // Play the audio
        await audioElement.play();
        
        return audioElement;
        
    } catch (e) {
        // Handle autoplay blocking gracefully
        if (e.name === 'NotAllowedError' || e.message.includes('not allowed')) {
            // Don't log this as an error since it's expected behavior
            return null;
        }
        
        logger.error("[AudioManager] Error playing wave file:", e);
        return null;
    }
}
