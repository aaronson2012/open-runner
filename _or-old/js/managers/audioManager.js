import * as UIManager from './uiManager.js';
import eventBus from '../core/eventBus.js';
import { GameStates } from '../core/gameStateManager.js';
import * as LevelManager from './levelManager.js';
import { audioConfig } from '../config/audio.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AudioManager');

let audioContext = null;
let masterGain = null;
// currentTrack stores the state of the currently playing music track
let currentTrack = {
    source: null,     // AudioBufferSourceNode
    gainNode: null,   // GainNode specific to this track
    id: null          // Identifier like 'level1', 'theme'
};

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

            // playMusic will handle transitions and check if 'theme' is already playing.
            playMusic('theme')
                .then(() => logger.info("playMusic('theme') initiated for title screen."))
                .catch(err => logger.error("Error initiating theme music for title screen:", err));
            // No need to check currentMusicId !== 'theme' here, playMusic handles it.
            // No need for explicit stopMusic() or setTimeout, playMusic handles transitions.

        } else if (newState === GameStates.PLAYING) {
            const currentLevelId = LevelManager.getCurrentLevelId();
            // playMusic will handle transitions and check if currentLevelId is already playing.
            playMusic(currentLevelId)
                .then(() => logger.info(`playMusic('${currentLevelId}') initiated for gameplay.`))
                .catch(err => logger.error(`Error initiating music for level ${currentLevelId}:`, err));
            // No need for explicit stopMusic() or setTimeout.
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
 * Fades out a specific audio track.
 * @param {object} trackToFade - The track object { source, gainNode, id }.
 * @param {number} durationMs - Duration of the fade in milliseconds.
 * @returns {Promise<void>} Promise that resolves when fade-out is complete.
 */
function fadeOutMusic(trackToFade, durationMs) {
    return new Promise((resolve) => {
        if (!audioContext || !trackToFade || !trackToFade.source || !trackToFade.gainNode) {
            logger.warn('[AudioManager] fadeOutMusic: Invalid track, source, or gainNode.');
            resolve();
            return;
        }

        const { source, gainNode } = trackToFade;
        const durationSec = durationMs / 1000;
        const currentTime = audioContext.currentTime;

        // Ensure ramp starts from the current gain value.
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + durationSec);

        setTimeout(() => {
            try {
                source.stop();
            } catch (e) {
                logger.debug('[AudioManager] fadeOutMusic: Error stopping source, possibly already stopped.', e);
            }
            // Disconnect the track-specific gain node from masterGain
            if (gainNode && masterGain) {
                try {
                    gainNode.disconnect(masterGain);
                } catch (e) {
                    logger.debug('[AudioManager] fadeOutMusic: Error disconnecting gainNode, possibly already disconnected.', e);
                }
            }
            resolve();
        }, durationMs); // Resolve after the fade duration
    });
}

/**
 * Fades in a specific audio track.
 * @param {object} trackToFadeIn - The track object { source, gainNode, id }.
 * @param {number} targetVolume - The target volume (0 to 1).
 * @param {number} durationMs - Duration of the fade in milliseconds.
 * @returns {Promise<void>} Promise that resolves when fade-in is complete.
 */
function fadeInMusic(trackToFadeIn, targetVolume, durationMs) {
    return new Promise((resolve) => {
        if (!audioContext || !trackToFadeIn || !trackToFadeIn.gainNode) {
            logger.warn('[AudioManager] fadeInMusic: Invalid track or gainNode.');
            resolve();
            return;
        }
        const { gainNode } = trackToFadeIn;
        const durationSec = durationMs / 1000;
        const currentTime = audioContext.currentTime;

        gainNode.gain.setValueAtTime(0, currentTime); // Start at 0 volume
        gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + durationSec);

        setTimeout(resolve, durationMs); // Resolve after the fade duration
    });
}

/**
 * Stops the currently playing background music gracefully with a fade-out.
 * @param {number} transitionDuration - Duration of the fade-out in milliseconds.
 * @returns {Promise<boolean>} Promise that resolves to true if music was stopped, false otherwise.
 */
export async function stopMusic(transitionDuration = 500) { // Default 500ms fade
    logger.info("[AudioManager] Attempting to stop music with fade out.");
    if (currentTrack.source && currentTrack.gainNode) {
        const trackToStop = { ...currentTrack }; // Operate on a snapshot

        // Immediately update global state to reflect that music is stopping/stopped.
        currentTrack.source = null;
        currentTrack.gainNode = null;
        currentTrack.id = null;

        await fadeOutMusic(trackToStop, transitionDuration);
        // fadeOutMusic handles stopping the source and disconnecting trackToStop.gainNode.
        
        logger.info(`[AudioManager] Music ${trackToStop.id} stopped after fade out.`);
        return true;
    } else {
        logger.info("[AudioManager] No music currently playing or track info incomplete to stop.");
        // Ensure currentTrack is fully cleared if it was in an inconsistent state
        currentTrack.source = null;
        currentTrack.gainNode = null;
        currentTrack.id = null;
        return false;
    }
}

/**
 * Plays background music, handling transitions with fades.
 * @param {string} levelId - The ID of the music to play (e.g., 'level1', 'theme').
 * @param {boolean} loop - Whether the music should loop (default: true).
 * @param {number} volume - Target volume for the music (0 to 1, default: 0.3).
 * @param {number} transitionDuration - Duration for fade-in/out in ms (default: 500).
 * @returns {Promise<AudioBufferSourceNode|null>} The new audio source node or null if playback failed.
 */
export async function playMusic(levelId = 'theme', loop = true, volume = 0.3, transitionDuration = 500) {
    if (!audioContext || !masterGain) {
        logger.error("[AudioManager] AudioContext not initialized. Cannot play music.");
        return null;
    }

    if (currentTrack.id === levelId && currentTrack.source && currentTrack.gainNode) {
        logger.info(`[AudioManager] ${levelId} music already playing.`);
        // Optional: could adjust volume if different, but for now, just return.
        return currentTrack.source;
    }

    logger.info(`[AudioManager] Request to play music: ${levelId}. Current: ${currentTrack.id}`);

    // Fade out current music if it's different and playing
    if (currentTrack.source && currentTrack.gainNode && currentTrack.id !== levelId) {
        logger.info(`[AudioManager] Fading out current music: ${currentTrack.id}`);
        // Pass a copy of currentTrack details to fadeOutMusic
        await fadeOutMusic({ ...currentTrack }, transitionDuration);
        // After fadeOutMusic, the old track's resources are released by fadeOutMusic.
        // Clear currentTrack state for the old track.
        currentTrack.source = null;
        currentTrack.gainNode = null;
        currentTrack.id = null;
    } else if (currentTrack.source && !currentTrack.gainNode) {
        // Edge case: source exists but gainNode is missing. Clean up abruptly.
        logger.warn(`[AudioManager] Current track source for ${currentTrack.id} exists but gainNode is missing. Stopping source directly.`);
        try { currentTrack.source.stop(); currentTrack.source.disconnect(); } catch(e) { /* ignore */ }
        currentTrack.source = null;
        currentTrack.gainNode = null;
        currentTrack.id = null;
    }


    const filePath = levelAudioMap[levelId];
    if (!filePath) {
        logger.error(`[AudioManager] No audio file defined for level: ${levelId}`);
        return null;
    }

    try {
        if (audioContext.state !== 'running') {
            await audioContext.resume();
        }

        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
        
        const audioData = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(audioData);

        const newSource = audioContext.createBufferSource();
        newSource.buffer = audioBuffer;
        newSource.loop = loop;

        const newGainNode = audioContext.createGain();
        newGainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start at 0 for fade-in

        newSource.connect(newGainNode);
        newGainNode.connect(masterGain);

        newSource.start(0);
        logger.info(`[AudioManager] Started source for ${levelId}.`);

        // Store the new track details globally
        const newTrackDetails = { source: newSource, gainNode: newGainNode, id: levelId };
        currentTrack = newTrackDetails;

        newSource.onended = () => {
            logger.debug(`[AudioManager] Music source for ${newTrackDetails.id} (instance) ended.`);
            // This onended is for THIS specific source.
            // Disconnect its gainNode if it's still connected and this was the current track.
            if (newTrackDetails.gainNode && masterGain && newTrackDetails.gainNode.numberOfOutputs > 0) {
                try {
                    newTrackDetails.gainNode.disconnect(masterGain);
                    logger.debug(`[AudioManager] onended: Disconnected gainNode for ${newTrackDetails.id}.`);
                } catch (e) {
                    logger.warn(`[AudioManager] onended: Error disconnecting gainNode for ${newTrackDetails.id}.`, e);
                }
            }
            // If this ended source was the one globally tracked as active, clear currentTrack.
            if (currentTrack.source === newTrackDetails.source) {
                currentTrack.source = null;
                currentTrack.gainNode = null;
                currentTrack.id = null;
                logger.info(`[AudioManager] onended: Cleared currentTrack as ${newTrackDetails.id} ended.`);
            }
        };
        
        logger.info(`[AudioManager] Fading in new music: ${levelId}`);
        await fadeInMusic(currentTrack, volume, transitionDuration);
        
        logger.info(`[AudioManager] Successfully playing ${levelId} music after fade-in.`);
        return newSource;

    } catch (error) {
        logger.error(`[AudioManager] Error playing music for ${levelId}:`, error);
        // Clean up if this was the track we were trying to set as current
        if (currentTrack.id === levelId) {
            if (currentTrack.source) { try { currentTrack.source.stop(); currentTrack.source.disconnect(); } catch(e) { /*ignore*/ } }
            if (currentTrack.gainNode && masterGain) { try { currentTrack.gainNode.disconnect(masterGain); } catch(e) { /*ignore*/ } }
            currentTrack.source = null;
            currentTrack.gainNode = null;
            currentTrack.id = null;
        }
        return null;
    }
}

/**
 * Checks if music is currently playing.
 * @returns {boolean} True if music is playing, false otherwise.
 */
export function isMusicActive() {
    return currentTrack.id !== null && currentTrack.source !== null && currentTrack.gainNode !== null;
}

/**
 * Gets the ID of the currently playing music.
 * @returns {string|null} The ID of the current music, or null if no music is playing.
 */
export function getCurrentMusicId() {
    return currentTrack.id;
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
        console.error("[AudioManager] Cannot play wave file: Audio context not initialized");
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
