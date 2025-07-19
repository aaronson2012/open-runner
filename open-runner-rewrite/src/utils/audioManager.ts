class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private musicSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;
  private loadPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.initializeAudio();
    await this.loadPromise;
  }

  private async initializeAudio(): Promise<void> {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.masterGain.gain.value = 0.5; // 50% volume

      // Resume context if suspended (required for Chrome autoplay policy)
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      await this.loadAllSounds();
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize audio:', error);
    }
  }

  private async loadAllSounds(): Promise<void> {
    const soundFiles = [
      'buttonclick2.wav',
      'buttonsound.wav', 
      'coinsound.wav',
      'collisionsound.wav',
      'gameover.wav',
      'openrunnersong1.wav',
      'openrunnersong2.wav',
      'openrunnertheme.wav',
      'powerupsound.wav',
      'turnsound.wav'
    ];

    const loadPromises = soundFiles.map(async (filename) => {
      try {
        const response = await fetch(`/assets/audio/${filename}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.sounds.set(filename.replace('.wav', ''), audioBuffer);
      } catch (error) {
        console.warn(`Failed to load sound ${filename}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  playSound(soundName: string, volume = 1.0): void {
    if (!this.context || !this.masterGain || !this.isInitialized) return;

    const buffer = this.sounds.get(soundName);
    if (!buffer) {
      console.warn(`Sound not found: ${soundName}`);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      
      source.buffer = buffer;
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      source.start();
    } catch (error) {
      console.warn(`Failed to play sound ${soundName}:`, error);
    }
  }

  playMusic(musicName: string, loop = true, volume = 0.3): void {
    if (!this.context || !this.masterGain || !this.isInitialized) return;

    // Stop current music
    this.stopMusic();

    const buffer = this.sounds.get(musicName);
    if (!buffer) {
      console.warn(`Music not found: ${musicName}`);
      return;
    }

    try {
      this.musicSource = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      
      this.musicSource.buffer = buffer;
      this.musicSource.loop = loop;
      gainNode.gain.value = volume;
      
      this.musicSource.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      this.musicSource.start();
    } catch (error) {
      console.warn(`Failed to play music ${musicName}:`, error);
    }
  }

  stopMusic(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch (error) {
        // Ignore errors when stopping already stopped sources
      }
      this.musicSource = null;
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // User interaction required for audio on modern browsers
  async resumeContext(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}

export const audioManager = new AudioManager();