// Advanced Audio System with Spatial Audio and Mobile Optimization
import {
  AudioAsset,
  SpatialAudioConfig,
  DeviceCapabilities,
  LoadedAsset
} from '../../types/assets/AssetTypes';

interface AudioSource {
  id: string;
  buffer: AudioBuffer;
  source?: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode?: PannerNode;
  isPlaying: boolean;
  isPaused: boolean;
  startTime: number;
  pauseTime: number;
  duration: number;
  loop: boolean;
  volume: number;
  spatialConfig?: SpatialAudioConfig;
}

interface AudioGroup {
  id: string;
  sources: Set<string>;
  masterGain: GainNode;
  volume: number;
  muted: boolean;
}

export class AudioSystem {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private sources = new Map<string, AudioSource>();
  private groups = new Map<string, AudioGroup>();
  private audioAssets = new Map<string, AudioAsset>();
  private deviceCapabilities: DeviceCapabilities;
  private isInitialized = false;
  private isMobileOptimized = false;
  
  // Mobile optimization settings
  private maxConcurrentSources = 32;
  private sourcePool: AudioBufferSourceNode[] = [];
  private compressionEnabled = true;
  
  // Performance monitoring
  private activeSourceCount = 0;
  private performanceMetrics = {
    totalPlaybackTime: 0,
    sourceReuses: 0,
    contextResumes: 0,
    errors: 0
  };

  constructor(deviceCapabilities: DeviceCapabilities) {
    this.deviceCapabilities = deviceCapabilities;
    this.createAudioContext();
    this.setupAudioGroups();
    
    if (deviceCapabilities.isMobile) {
      this.optimizeForMobile();
    }
  }

  private createAudioContext(): void {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Create master gain node
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      
      // Handle audio context state changes
      this.audioContext.addEventListener('statechange', () => {
        console.log('Audio context state:', this.audioContext.state);
      });
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to create audio context:', error);
      this.performanceMetrics.errors++;
    }
  }

  private setupAudioGroups(): void {
    // Create default audio groups
    this.createAudioGroup('master', 1.0);
    this.createAudioGroup('music', 0.7);
    this.createAudioGroup('sfx', 1.0);
    this.createAudioGroup('voice', 1.0);
    this.createAudioGroup('ambient', 0.5);
  }

  private optimizeForMobile(): void {
    this.isMobileOptimized = true;
    
    // Reduce concurrent sources for mobile
    this.maxConcurrentSources = Math.min(this.maxConcurrentSources, 16);
    
    // Pre-create source pool
    this.preCreateSourcePool();
    
    // Handle mobile-specific audio context restrictions
    this.handleMobileAudioContext();
  }

  private preCreateSourcePool(): void {
    // Pre-create audio sources to avoid GC during gameplay
    for (let i = 0; i < 8; i++) {
      try {
        const source = this.audioContext.createBufferSource();
        this.sourcePool.push(source);
      } catch (error) {
        console.warn('Failed to pre-create audio source:', error);
        break;
      }
    }
  }

  private handleMobileAudioContext(): void {
    // iOS and some Android browsers require user interaction to start audio
    const resumeAudioContext = async () => {
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          this.performanceMetrics.contextResumes++;
          console.log('Audio context resumed');
        } catch (error) {
          console.error('Failed to resume audio context:', error);
          this.performanceMetrics.errors++;
        }
      }
    };

    // Add event listeners for user interaction
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudioContext, { once: true });
    });
  }

  async loadAudioAsset(asset: LoadedAsset<AudioBuffer>): Promise<void> {
    if (asset.type !== 'audio' || !asset.data) {
      throw new Error('Invalid audio asset');
    }

    const audioAsset: AudioAsset = {
      ...asset,
      buffer: asset.data,
      duration: asset.data.duration,
      channels: asset.data.numberOfChannels,
      sampleRate: asset.data.sampleRate,
      loop: false,
      volume: 1.0
    };

    this.audioAssets.set(asset.id, audioAsset);
  }

  createAudioGroup(id: string, volume: number = 1.0): void {
    if (this.groups.has(id)) {
      console.warn(`Audio group ${id} already exists`);
      return;
    }

    const masterGain = this.audioContext.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(this.masterGainNode);

    this.groups.set(id, {
      id,
      sources: new Set(),
      masterGain,
      volume,
      muted: false
    });
  }

  async playAudio(
    assetId: string,
    options: {
      loop?: boolean;
      volume?: number;
      groupId?: string;
      spatialConfig?: SpatialAudioConfig;
      startTime?: number;
      playbackRate?: number;
    } = {}
  ): Promise<string | null> {
    const audioAsset = this.audioAssets.get(assetId);
    if (!audioAsset) {
      console.error(`Audio asset ${assetId} not found`);
      return null;
    }

    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        this.performanceMetrics.contextResumes++;
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        this.performanceMetrics.errors++;
        return null;
      }
    }

    // Check concurrent source limit
    if (this.activeSourceCount >= this.maxConcurrentSources) {
      console.warn('Maximum concurrent audio sources reached');
      this.stopOldestSource();
    }

    const sourceId = this.generateSourceId();
    const groupId = options.groupId || 'sfx';
    const group = this.groups.get(groupId);

    if (!group) {
      console.error(`Audio group ${groupId} not found`);
      return null;
    }

    try {
      // Create or reuse audio source
      const source = this.createAudioSource(audioAsset.buffer);
      const gainNode = this.audioContext.createGain();
      
      // Set up audio graph
      let finalDestination: AudioNode = gainNode;
      
      // Add spatial audio if requested
      let pannerNode: PannerNode | undefined;
      if (options.spatialConfig?.enabled) {
        pannerNode = this.createPannerNode(options.spatialConfig);
        gainNode.connect(pannerNode);
        finalDestination = pannerNode;
      }
      
      // Connect to group
      finalDestination.connect(group.masterGain);
      source.connect(gainNode);

      // Configure source
      source.loop = options.loop || false;
      source.playbackRate.value = options.playbackRate || 1.0;
      gainNode.gain.value = options.volume || 1.0;

      // Create source tracking object
      const audioSource: AudioSource = {
        id: sourceId,
        buffer: audioAsset.buffer,
        source,
        gainNode,
        pannerNode,
        isPlaying: true,
        isPaused: false,
        startTime: this.audioContext.currentTime,
        pauseTime: 0,
        duration: audioAsset.duration,
        loop: source.loop,
        volume: gainNode.gain.value,
        spatialConfig: options.spatialConfig
      };

      // Handle source end
      source.onended = () => {
        this.handleSourceEnded(sourceId);
      };

      // Start playback
      const startTime = options.startTime || 0;
      source.start(0, startTime);
      
      // Track source
      this.sources.set(sourceId, audioSource);
      group.sources.add(sourceId);
      this.activeSourceCount++;
      
      this.performanceMetrics.totalPlaybackTime += audioAsset.duration;

      return sourceId;
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.performanceMetrics.errors++;
      return null;
    }
  }

  private createAudioSource(buffer: AudioBuffer): AudioBufferSourceNode {
    // Try to reuse from pool first
    if (this.sourcePool.length > 0) {
      const source = this.sourcePool.pop()!;
      source.buffer = buffer;
      this.performanceMetrics.sourceReuses++;
      return source;
    }

    // Create new source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private createPannerNode(config: SpatialAudioConfig): PannerNode {
    const panner = this.audioContext.createPanner();
    
    panner.panningModel = config.panningModel || 'HRTF';
    panner.distanceModel = config.distanceModel || 'inverse';
    panner.maxDistance = config.maxDistance || 10000;
    panner.rolloffFactor = config.rolloffFactor || 1;
    panner.coneInnerAngle = config.coneInnerAngle || 360;
    panner.coneOuterAngle = config.coneOuterAngle || 0;
    panner.coneOuterGain = config.coneOuterGain || 0;

    return panner;
  }

  private generateSourceId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleSourceEnded(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    // Find and remove from group
    for (const group of this.groups.values()) {
      if (group.sources.has(sourceId)) {
        group.sources.delete(sourceId);
        break;
      }
    }

    // Return source to pool if possible
    if (source.source && this.sourcePool.length < 8) {
      // Reset source for reuse
      source.source.buffer = null;
      this.sourcePool.push(source.source);
    }

    // Clean up
    this.sources.delete(sourceId);
    this.activeSourceCount--;
  }

  private stopOldestSource(): void {
    let oldestSource: AudioSource | null = null;
    let oldestTime = Infinity;

    for (const source of this.sources.values()) {
      if (source.startTime < oldestTime && !source.loop) {
        oldestTime = source.startTime;
        oldestSource = source;
      }
    }

    if (oldestSource) {
      this.stopAudio(oldestSource.id);
    }
  }

  stopAudio(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.source) return;

    try {
      source.source.stop();
      source.isPlaying = false;
    } catch (error) {
      console.warn('Error stopping audio source:', error);
    }
  }

  pauseAudio(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.isPlaying || source.isPaused) return;

    source.pauseTime = this.audioContext.currentTime - source.startTime;
    source.isPaused = true;
    this.stopAudio(sourceId);
  }

  resumeAudio(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.isPaused) return;

    // Create new source and resume from pause point
    this.playAudio(source.buffer.toString(), {
      startTime: source.pauseTime,
      volume: source.volume,
      loop: source.loop,
      spatialConfig: source.spatialConfig
    });

    source.isPaused = false;
  }

  setAudioVolume(sourceId: string, volume: number): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    source.volume = Math.max(0, Math.min(1, volume));
    source.gainNode.gain.value = source.volume;
  }

  setGroupVolume(groupId: string, volume: number): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.volume = Math.max(0, Math.min(1, volume));
    group.masterGain.gain.value = group.muted ? 0 : group.volume;
  }

  muteGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.muted = true;
    group.masterGain.gain.value = 0;
  }

  unmuteGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.muted = false;
    group.masterGain.gain.value = group.volume;
  }

  setMasterVolume(volume: number): void {
    this.masterGainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  setSpatialPosition(
    sourceId: string,
    x: number,
    y: number,
    z: number
  ): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.pannerNode) return;

    source.pannerNode.positionX.value = x;
    source.pannerNode.positionY.value = y;
    source.pannerNode.positionZ.value = z;
  }

  setListenerPosition(x: number, y: number, z: number): void {
    this.audioContext.listener.positionX.value = x;
    this.audioContext.listener.positionY.value = y;
    this.audioContext.listener.positionZ.value = z;
  }

  setListenerOrientation(
    forwardX: number, forwardY: number, forwardZ: number,
    upX: number, upY: number, upZ: number
  ): void {
    this.audioContext.listener.forwardX.value = forwardX;
    this.audioContext.listener.forwardY.value = forwardY;
    this.audioContext.listener.forwardZ.value = forwardZ;
    this.audioContext.listener.upX.value = upX;
    this.audioContext.listener.upY.value = upY;
    this.audioContext.listener.upZ.value = upZ;
  }

  // Performance and monitoring
  getActiveSourceCount(): number {
    return this.activeSourceCount;
  }

  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  getAudioContextState(): AudioContextState {
    return this.audioContext.state;
  }

  // Cleanup and optimization
  stopAllAudio(): void {
    for (const sourceId of this.sources.keys()) {
      this.stopAudio(sourceId);
    }
  }

  stopGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    const sourceIds = Array.from(group.sources);
    for (const sourceId of sourceIds) {
      this.stopAudio(sourceId);
    }
  }

  cleanup(): void {
    this.stopAllAudio();
    
    // Close audio context
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    // Clear collections
    this.sources.clear();
    this.groups.clear();
    this.audioAssets.clear();
    this.sourcePool.length = 0;
    
    this.activeSourceCount = 0;
    this.isInitialized = false;
  }

  // Utility methods
  isPlaying(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    return source ? source.isPlaying && !source.isPaused : false;
  }

  getDuration(assetId: string): number {
    const asset = this.audioAssets.get(assetId);
    return asset ? asset.duration : 0;
  }

  getSourceInfo(sourceId: string): AudioSource | null {
    return this.sources.get(sourceId) || null;
  }
}