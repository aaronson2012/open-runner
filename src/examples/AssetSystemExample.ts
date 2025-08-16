// Example Usage of the Complete Asset System for Open Runner
import { AssetSystem, AssetType } from '../systems/assets';

export class AssetSystemExample {
  private assetSystem: AssetSystem;

  constructor() {
    // Initialize asset system with mobile optimization
    this.assetSystem = new AssetSystem({
      maxConcurrentLoads: 4,
      enableStreaming: true,
      enableCompression: true,
      memoryLimit: 256 * 1024 * 1024, // 256MB
      adaptiveQuality: true,
      mobileOptimizations: true
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Monitor loading progress
    this.assetSystem.onProgress((progress) => {
      console.log(`Loading progress: ${progress.percentage.toFixed(1)}%`);
      console.log(`Stage: ${progress.stage}, Current: ${progress.current}`);
    });

    // Handle collection loaded events
    this.assetSystem.onCollectionLoaded((collectionId) => {
      console.log(`Collection loaded: ${collectionId}`);
    });

    // Handle individual asset loaded events
    this.assetSystem.onAssetLoaded((asset) => {
      console.log(`Asset loaded: ${asset.id} (${asset.type})`);
    });
  }

  async initializeGame(): Promise<void> {
    try {
      console.log('Initializing asset system...');
      
      // Initialize with critical boot assets
      await this.assetSystem.initializeSystem();
      
      // Load forest level assets
      console.log('Loading forest level...');
      await this.assetSystem.loadCollection('forest_level');
      
      // Load sound effects
      console.log('Loading sound effects...');
      await this.assetSystem.loadCollection('sound_effects');
      
      console.log('Asset system initialized successfully!');
      
      // Demonstrate asset usage
      this.demonstrateAssetUsage();
      
    } catch (error) {
      console.error('Failed to initialize asset system:', error);
    }
  }

  private demonstrateAssetUsage(): void {
    console.log('\n=== Asset Usage Demonstration ===');
    
    // Get placeholder models
    const playerModel = this.assetSystem.getAsset('player_model');
    const bearModel = this.assetSystem.getAsset('bear_model');
    
    console.log('Player model loaded:', !!playerModel);
    console.log('Bear model loaded:', !!bearModel);
    
    // Get placeholder textures
    const forestTexture = this.assetSystem.getAsset('forest_ground_texture');
    const playerTexture = this.assetSystem.getAsset('player_texture');
    
    console.log('Forest texture loaded:', !!forestTexture);
    console.log('Player texture loaded:', !!playerTexture);
    
    // Demonstrate audio system
    this.demonstrateAudioSystem();
    
    // Show system information
    this.showSystemInformation();
  }

  private async demonstrateAudioSystem(): Promise<void> {
    console.log('\n=== Audio System Demonstration ===');
    
    try {
      // Play coin collection sound
      const coinSoundId = await this.assetSystem.playAudio('sfx_coin_collect', {
        volume: 0.8,
        groupId: 'sfx'
      });
      
      console.log('Coin sound playing:', !!coinSoundId);
      
      // Play background music with spatial audio
      const musicId = await this.assetSystem.playAudio('music_forest', {
        loop: true,
        volume: 0.6,
        groupId: 'music',
        spatialConfig: {
          enabled: true,
          panningModel: 'HRTF',
          distanceModel: 'inverse',
          maxDistance: 100,
          rolloffFactor: 1
        }
      });
      
      console.log('Background music playing:', !!musicId);
      
      // Demonstrate volume controls
      this.assetSystem.setMasterVolume(0.8);
      console.log('Master volume set to 80%');
      
    } catch (error) {
      console.warn('Audio demonstration failed (may be expected in headless environment):', error.message);
    }
  }

  private showSystemInformation(): void {
    console.log('\n=== System Information ===');
    
    const systemInfo = this.assetSystem.getSystemInfo();
    
    console.log('Device Capabilities:');
    console.log(`- Mobile: ${systemInfo.deviceCapabilities.isMobile}`);
    console.log(`- WebGL2: ${systemInfo.deviceCapabilities.webgl2}`);
    console.log(`- Max Texture Size: ${systemInfo.deviceCapabilities.maxTextureSize}`);
    console.log(`- Connection: ${systemInfo.deviceCapabilities.connectionType}`);
    
    console.log('\nOptimization Profile:');
    console.log(`- Profile: ${systemInfo.currentProfile.name}`);
    console.log(`- Memory Limit: ${(systemInfo.currentProfile.memoryLimit / 1024 / 1024).toFixed(0)}MB`);
    console.log(`- Quality Multiplier: ${systemInfo.currentProfile.qualityMultiplier}`);
    
    console.log('\nMemory Usage:');
    console.log(`- Total: ${(systemInfo.memoryUsage.total / 1024 / 1024).toFixed(1)}MB`);
    console.log(`- Used: ${(systemInfo.memoryUsage.used / 1024 / 1024).toFixed(1)}MB`);
    console.log(`- Free: ${(systemInfo.memoryUsage.free / 1024 / 1024).toFixed(1)}MB`);
    
    console.log('\nLoaded Assets:');
    console.log(`- Collections: ${systemInfo.loadedCollections.length}`);
    console.log(`- Generated Assets: ${systemInfo.generatedAssets}`);
    
    // Show performance report
    const performanceReport = this.assetSystem.getPerformanceReport();
    console.log('\nPerformance Report:');
    console.log(performanceReport);
  }

  async loadDesertLevel(): Promise<void> {
    console.log('\n=== Loading Desert Level ===');
    
    try {
      await this.assetSystem.loadCollection('desert_level');
      
      // Demonstrate desert assets
      const desertTexture = this.assetSystem.getAsset('desert_sand_texture');
      const coyoteModel = this.assetSystem.getAsset('coyote_model');
      
      console.log('Desert texture loaded:', !!desertTexture);
      console.log('Coyote model loaded:', !!coyoteModel);
      
      // Play desert music
      const desertMusicId = await this.assetSystem.playAudio('music_desert', {
        loop: true,
        volume: 0.5,
        groupId: 'music'
      });
      
      console.log('Desert music playing:', !!desertMusicId);
      
    } catch (error) {
      console.error('Failed to load desert level:', error);
    }
  }

  demonstrateStreamingAssets(): void {
    console.log('\n=== Streaming Asset Demonstration ===');
    
    // The streaming system automatically handles large assets
    // Monitor streaming progress
    console.log('Streaming assets are loaded automatically based on size and device capabilities');
    console.log('Check the console for streaming progress messages');
  }

  demonstrateMobileOptimizations(): void {
    console.log('\n=== Mobile Optimization Demonstration ===');
    
    const systemInfo = this.assetSystem.getSystemInfo();
    
    if (systemInfo.deviceCapabilities.isMobile) {
      console.log('Mobile optimizations active:');
      console.log(`- Reduced concurrent loads: ${systemInfo.currentProfile.maxConcurrentLoads}`);
      console.log(`- Compressed textures: ${systemInfo.deviceCapabilities.astcSupport || systemInfo.deviceCapabilities.etc2Support}`);
      console.log(`- Adaptive quality: enabled`);
      console.log(`- Memory limit: ${(systemInfo.currentProfile.memoryLimit / 1024 / 1024).toFixed(0)}MB`);
    } else {
      console.log('Desktop mode active - full quality assets loaded');
    }
  }

  cleanup(): void {
    console.log('\n=== Cleaning up Asset System ===');
    this.assetSystem.cleanup();
    console.log('Asset system cleaned up successfully');
  }
}

// Example usage function
export async function runAssetSystemExample(): Promise<void> {
  const example = new AssetSystemExample();
  
  try {
    // Initialize the game with forest level
    await example.initializeGame();
    
    // Wait a bit, then load desert level
    setTimeout(async () => {
      await example.loadDesertLevel();
      
      // Demonstrate other features
      example.demonstrateStreamingAssets();
      example.demonstrateMobileOptimizations();
      
      // Cleanup after demonstration
      setTimeout(() => {
        example.cleanup();
      }, 5000);
      
    }, 3000);
    
  } catch (error) {
    console.error('Asset system example failed:', error);
  }
}

// Auto-run if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  document.addEventListener('DOMContentLoaded', () => {
    runAssetSystemExample();
  });
} else if (typeof process !== 'undefined' && process.argv[1] === __filename) {
  // Node.js environment
  runAssetSystemExample();
}