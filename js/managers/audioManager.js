import { BaseManager } from './BaseManager.js';
import { GameStates } from '../core/gameStateManager.js';
import * as LevelManager from './levelManager.js';
import { audioConfig } from '../config/audio.js';

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

class AudioManager extends BaseManager {
    constructor() {
        super('AudioManager');
        this.audioContext = null;
        this.masterGain = null;
        this.musicSource = null;
        this.currentMusicId = null;
    }

    /**
     * Validate audio dependencies
     */
    validateDependencies(config) {
        // Check if Web Audio API is supported
        if (!window.AudioContext && !window.webkitAudioContext) {
            this.logger.error('Web Audio API is not supported');
            return false;
        }
        return true;
    }

    /**
     * Setup audio context and configuration
     */
    async setupManager(config) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                } catch (e) {
                    this.logger.warn("Could not resume audio context, possibly due to a muted tab. Continuing without audio.", e);
                }
            }

            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, this.audioContext.currentTime);
            this.masterGain.connect(this.audioContext.destination);
            
            return true;
        } catch (e) {
            this.logger.error('Web Audio API initialization failed:', e);
            return false;
        }
    }

    /**
     * Setup event subscriptions for audio management
     */
    setupEventSubscriptions() {
        // Listen for player death (collision)
        this.subscribeToEvent('playerDied', () => {
            this.playWaveFile(effectAudioMap['collision']);
        });

        this.subscribeToEvent('gameStateChanged', ({ newState, previousState }) => {
            this.logger.debug('[AudioManager] Received gameStateChanged event detail:', { newState, previousState });
            this.logger.info(`Audio handling game state change: ${previousState} -> ${newState}`);

            if (newState === GameStates.GAME_OVER) {
                this.playWaveFile(effectAudioMap['gameover']);
            } else if (newState === GameStates.TITLE) {
                if (this.currentMusicId !== 'theme') {
                    this.stopMusic();
                    setTimeout(() => {
                        this.playMusic('theme');
                        this.logger.info("Playing theme music when returning to title screen");
                    }, 50);
                } else {
                    this.logger.info("Theme music already playing, not restarting");
                }
            } else if (newState === GameStates.PLAYING) {
                const currentLevelId = LevelManager.getCurrentLevelId();
                
                if (this.currentMusicId !== currentLevelId) {
                    this.stopMusic();
                    setTimeout(() => {
                        this.playMusic(LevelManager.getCurrentLevelId());
                    }, 50);
                }
            }
        });

        this.subscribeToEvent('scoreChanged', (scoreIncrement) => {
            if (scoreIncrement > 0) {
                this.playWaveFile(effectAudioMap['coin']);
            }
        });

        this.subscribeToEvent('uiButtonClicked', () => {
            this.playWaveFile(effectAudioMap['buttonclick']);
        });
    }

    /**
     * Cleanup audio resources
     */
    cleanupManager() {
        if (this.musicSource) {
            this.stopMusic();
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.masterGain = null;
        this.musicSource = null;
        this.currentMusicId = null;
    }

    /**
     * Stops the currently playing background music.
     * Uses a robust approach to ensure music actually stops.
     * @returns {Promise<boolean>} Promise that resolves to true if music was stopped
     */
    async stopMusic() {
        this.logger.info("[AudioManager] Stopping music");
        try {
            if (!this.audioContext || !this.musicSource) {
                this.currentMusicId = null;
                this.musicSource = null;
                return true;
            }
        
            if (this.musicSource) {
                if (this.masterGain) {
                    this.masterGain.disconnect();
                    this.masterGain = this.audioContext.createGain();
                    this.masterGain.gain.setValueAtTime(audioConfig.INITIAL_MASTER_GAIN, this.audioContext.currentTime);
                    this.masterGain.connect(this.audioContext.destination);
                }
            }
            this.musicSource = null;
            this.currentMusicId = null;

            return true;
        } catch (e) {
            this.logger.error("[AudioManager] Error stopping music:", e);
            this.musicSource = null;
            this.currentMusicId = null;
            return false;
        }
    }

    /**
     * Plays background music with reliable stopping of any previous music.
     * @param {string} levelId - the level music to play (e.g., 'level1', 'level2', 'theme')
     * @param {number} volume - Volume level from 0 to 1 (default: 0.3)
     * @returns {Promise<AudioBufferSourceNode|null>} The audio source node or null if playback failed
     */
    async playMusic(levelId = 'theme', volume = 0.3) {
        if (!this.audioContext) {
            this.logger.warn(`[AudioManager] Audio not initialized. Cannot play music for ${levelId}.`);
            return null;
        }
        if (this.currentMusicId === levelId && this.musicSource) {
            this.logger.info(`[AudioManager] ${levelId} music already playing`);
            return this.musicSource;
        }

        try {
            await this.stopMusic();
            await new Promise(resolve => setTimeout(resolve, 50));

            const filePath = levelAudioMap[levelId];
            if (!filePath) {
                this.logger.error(`[AudioManager] No audio file defined for level: ${levelId}`);
                return null;
            }

            if (this.audioContext.state !== 'running') {
                await this.audioContext.resume();
            }

            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio file: ${response.status}`);
            }

            const audioData = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(audioData);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            source.start(0);

            this.musicSource = source;
            this.currentMusicId = levelId;

            source.onended = () => {
                if (this.musicSource === source) {
                    this.musicSource = null;
                    this.currentMusicId = null;
                }
            };
            this.logger.info(`[AudioManager] Playing ${levelId} music`);
            return source;
        } catch (error) {
            this.logger.error(`[AudioManager] Error playing music for ${levelId}:`, error);
            this.musicSource = null;
            this.currentMusicId = null;
            return null;
        }
    }

    /**
     * Checks if music is currently playing.
     * @returns {boolean} True if music is playing, false otherwise
     */
    isMusicActive() {
        return this.currentMusicId !== null && this.musicSource !== null;
    }

    /**
     * Gets the ID of the currently playing music.
     * @returns {string|null} The ID of the current music, or null if no music is playing
     */
    getCurrentMusicId() {
        return this.currentMusicId;
    }

    /**
     * Plays a wave file from the specified path.
     * @param {string} filePath - Path to the wave file
     * @param {number} volume - Volume level from 0 to 1 (default: 0.5)
     * @param {boolean} loop - Whether to loop the audio (default: false)
     * @returns {Promise<AudioBufferSourceNode|null>} The audio source node or null if playback failed
     */
    async playWaveFile(filePath, volume = 0.5, loop = false) {
        if (!this.audioContext || !this.masterGain) {
            this.logger.error("[AudioManager] Cannot play wave file: Audio context not initialized");
            return null;
        }

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
            }

            const audioData = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(audioData);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = loop;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            source.start(0);

            return source;

        } catch (e) {
            this.logger.error("[AudioManager] Error playing wave file:", e);
            return null;
        }
    }
}

// Create singleton instance
const audioManager = new AudioManager();

// Export functions that maintain existing API
export async function init() {
    return await audioManager.init();
}

export async function stopMusic() {
    return await audioManager.stopMusic();
}

export async function playMusic(levelId = 'theme', volume = 0.3) {
    return await audioManager.playMusic(levelId, volume);
}

export function isMusicActive() {
    return audioManager.isMusicActive();
}

export function getCurrentMusicId() {
    return audioManager.getCurrentMusicId();
}

export async function playWaveFile(filePath, volume = 0.5, loop = false) {
    return await audioManager.playWaveFile(filePath, volume, loop);
}
