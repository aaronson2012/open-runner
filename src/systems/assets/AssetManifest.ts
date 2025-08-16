// Asset Manifest and Configuration System
import {
  AssetManifest,
  AssetConfig,
  AssetCollection,
  AssetType,
  AssetPriority,
  CompressionFormat,
  LoadingStrategy,
  AssetLoaderConfig
} from '../../types/assets/AssetTypes';

export class AssetManifestBuilder {
  private manifest: AssetManifest;

  constructor() {
    this.manifest = {
      version: '1.0.0',
      collections: [],
      assets: [],
      globalConfig: this.getDefaultConfig()
    };
  }

  private getDefaultConfig(): AssetLoaderConfig {
    return {
      maxConcurrentLoads: 6,
      enableStreaming: true,
      enableCompression: true,
      memoryLimit: 512 * 1024 * 1024, // 512MB
      cacheSize: 100,
      retryAttempts: 3,
      timeoutMs: 30000,
      adaptiveQuality: true,
      mobileOptimizations: true
    };
  }

  // Build complete manifest for Open Runner
  buildOpenRunnerManifest(): AssetManifest {
    this.addCoreAssets();
    this.addCharacterAssets();
    this.addEnvironmentAssets();
    this.addAudioAssets();
    this.addUIAssets();
    this.addEffectAssets();
    this.createAssetCollections();

    return this.manifest;
  }

  private addCoreAssets(): void {
    // Critical system assets
    this.addAsset({
      id: 'player_model',
      type: AssetType.MODEL,
      src: '/assets/models/player.glb',
      fallbacks: ['/assets/models/player_fallback.obj'],
      compression: {
        formats: [CompressionFormat.S3TC, CompressionFormat.ETC2],
        quality: 0.8,
        progressive: true
      },
      priority: AssetPriority.CRITICAL,
      preload: true,
      memoryPool: 'critical'
    });

    this.addAsset({
      id: 'player_texture',
      type: AssetType.TEXTURE,
      src: '/assets/textures/player.webp',
      fallbacks: ['/assets/textures/player.png'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.JPEG, CompressionFormat.PNG],
        quality: 0.9,
        progressive: true,
        mipmaps: true
      },
      priority: AssetPriority.CRITICAL,
      preload: true,
      memoryPool: 'critical'
    });
  }

  private addCharacterAssets(): void {
    const enemies = ['bear', 'squirrel', 'deer', 'coyote', 'snake', 'scorpion'];
    
    enemies.forEach(enemy => {
      // Enemy models
      this.addAsset({
        id: `${enemy}_model`,
        type: AssetType.MODEL,
        src: `/assets/models/${enemy}.glb`,
        fallbacks: [`/assets/models/${enemy}_simple.obj`],
        compression: {
          formats: [CompressionFormat.S3TC, CompressionFormat.ETC2],
          quality: 0.7,
          progressive: true
        },
        priority: AssetPriority.HIGH,
        preload: false,
        streaming: true,
        memoryPool: 'gameplay'
      });

      // Enemy textures
      this.addAsset({
        id: `${enemy}_texture`,
        type: AssetType.TEXTURE,
        src: `/assets/textures/${enemy}.webp`,
        fallbacks: [`/assets/textures/${enemy}.jpg`],
        compression: {
          formats: [CompressionFormat.WEBP, CompressionFormat.JPEG],
          quality: 0.8,
          progressive: true,
          mipmaps: true
        },
        priority: AssetPriority.HIGH,
        preload: false,
        streaming: true,
        memoryPool: 'gameplay'
      });
    });
  }

  private addEnvironmentAssets(): void {
    // Forest environment
    this.addAsset({
      id: 'forest_ground_texture',
      type: AssetType.TEXTURE,
      src: '/assets/textures/forest_ground.webp',
      fallbacks: ['/assets/textures/forest_ground.jpg'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.JPEG],
        quality: 0.8,
        progressive: true,
        mipmaps: true
      },
      priority: AssetPriority.HIGH,
      preload: true,
      streaming: true,
      memoryPool: 'gameplay'
    });

    this.addAsset({
      id: 'forest_trees_texture',
      type: AssetType.TEXTURE,
      src: '/assets/textures/forest_trees.webp',
      fallbacks: ['/assets/textures/forest_trees.png'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.PNG],
        quality: 0.9,
        progressive: true,
        mipmaps: true
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      streaming: true,
      memoryPool: 'gameplay'
    });

    // Desert environment
    this.addAsset({
      id: 'desert_sand_texture',
      type: AssetType.TEXTURE,
      src: '/assets/textures/desert_sand.webp',
      fallbacks: ['/assets/textures/desert_sand.jpg'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.JPEG],
        quality: 0.8,
        progressive: true,
        mipmaps: true
      },
      priority: AssetPriority.HIGH,
      preload: false,
      streaming: true,
      memoryPool: 'gameplay'
    });

    this.addAsset({
      id: 'desert_rocks_texture',
      type: AssetType.TEXTURE,
      src: '/assets/textures/desert_rocks.webp',
      fallbacks: ['/assets/textures/desert_rocks.png'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.PNG],
        quality: 0.9,
        progressive: true,
        mipmaps: true
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      streaming: true,
      memoryPool: 'gameplay'
    });

    // Skybox
    this.addAsset({
      id: 'skybox_forest',
      type: AssetType.TEXTURE,
      src: '/assets/textures/skybox_forest.webp',
      fallbacks: ['/assets/textures/skybox_forest.jpg'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.JPEG],
        quality: 0.7,
        progressive: true
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      memoryPool: 'background'
    });

    this.addAsset({
      id: 'skybox_desert',
      type: AssetType.TEXTURE,
      src: '/assets/textures/skybox_desert.webp',
      fallbacks: ['/assets/textures/skybox_desert.jpg'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.JPEG],
        quality: 0.7,
        progressive: true
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      memoryPool: 'background'
    });
  }

  private addAudioAssets(): void {
    // Background music
    this.addAsset({
      id: 'music_forest',
      type: AssetType.AUDIO,
      src: '/assets/audio/music/forest_theme.opus',
      fallbacks: ['/assets/audio/music/forest_theme.ogg', '/assets/audio/music/forest_theme.mp3'],
      compression: {
        formats: [CompressionFormat.OPUS, CompressionFormat.OGG, CompressionFormat.MP3],
        quality: 0.7,
        progressive: true
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      streaming: true,
      memoryPool: 'background'
    });

    this.addAsset({
      id: 'music_desert',
      type: AssetType.AUDIO,
      src: '/assets/audio/music/desert_theme.opus',
      fallbacks: ['/assets/audio/music/desert_theme.ogg', '/assets/audio/music/desert_theme.mp3'],
      compression: {
        formats: [CompressionFormat.OPUS, CompressionFormat.OGG, CompressionFormat.MP3],
        quality: 0.7,
        progressive: true
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      streaming: true,
      memoryPool: 'background'
    });

    // Sound effects
    const soundEffects = [
      'coin_collect',
      'powerup_grab',
      'player_jump',
      'player_land',
      'turn_left',
      'turn_right',
      'collision_enemy',
      'collision_obstacle',
      'bear_roar',
      'squirrel_chatter',
      'deer_call',
      'coyote_howl',
      'snake_hiss',
      'scorpion_click'
    ];

    soundEffects.forEach(sfx => {
      this.addAsset({
        id: `sfx_${sfx}`,
        type: AssetType.AUDIO,
        src: `/assets/audio/sfx/${sfx}.opus`,
        fallbacks: [`/assets/audio/sfx/${sfx}.ogg`, `/assets/audio/sfx/${sfx}.wav`],
        compression: {
          formats: [CompressionFormat.OPUS, CompressionFormat.OGG, CompressionFormat.WAV],
          quality: 0.8,
          progressive: false
        },
        priority: AssetPriority.HIGH,
        preload: false,
        memoryPool: 'gameplay'
      });
    });

    // Ambient sounds
    this.addAsset({
      id: 'ambient_forest',
      type: AssetType.AUDIO,
      src: '/assets/audio/ambient/forest_ambient.opus',
      fallbacks: ['/assets/audio/ambient/forest_ambient.ogg'],
      compression: {
        formats: [CompressionFormat.OPUS, CompressionFormat.OGG],
        quality: 0.6,
        progressive: true
      },
      priority: AssetPriority.LOW,
      preload: false,
      streaming: true,
      memoryPool: 'background'
    });

    this.addAsset({
      id: 'ambient_desert',
      type: AssetType.AUDIO,
      src: '/assets/audio/ambient/desert_wind.opus',
      fallbacks: ['/assets/audio/ambient/desert_wind.ogg'],
      compression: {
        formats: [CompressionFormat.OPUS, CompressionFormat.OGG],
        quality: 0.6,
        progressive: true
      },
      priority: AssetPriority.LOW,
      preload: false,
      streaming: true,
      memoryPool: 'background'
    });
  }

  private addUIAssets(): void {
    // UI textures
    const uiElements = ['coin', 'powerup', 'health', 'score_bg', 'button_play', 'button_pause', 'button_settings'];
    
    uiElements.forEach(element => {
      this.addAsset({
        id: `ui_${element}`,
        type: AssetType.TEXTURE,
        src: `/assets/ui/${element}.webp`,
        fallbacks: [`/assets/ui/${element}.png`],
        compression: {
          formats: [CompressionFormat.WEBP, CompressionFormat.PNG],
          quality: 0.9,
          progressive: false,
          mipmaps: false
        },
        priority: AssetPriority.HIGH,
        preload: true,
        memoryPool: 'critical'
      });
    });

    // Fonts
    this.addAsset({
      id: 'font_game',
      type: AssetType.FONT,
      src: '/assets/fonts/game_font.woff2',
      fallbacks: ['/assets/fonts/game_font.woff', '/assets/fonts/game_font.ttf'],
      priority: AssetPriority.CRITICAL,
      preload: true,
      memoryPool: 'critical'
    });

    // UI sounds
    this.addAsset({
      id: 'ui_click',
      type: AssetType.AUDIO,
      src: '/assets/audio/ui/click.opus',
      fallbacks: ['/assets/audio/ui/click.wav'],
      compression: {
        formats: [CompressionFormat.OPUS, CompressionFormat.WAV],
        quality: 0.8
      },
      priority: AssetPriority.HIGH,
      preload: true,
      memoryPool: 'critical'
    });

    this.addAsset({
      id: 'ui_hover',
      type: AssetType.AUDIO,
      src: '/assets/audio/ui/hover.opus',
      fallbacks: ['/assets/audio/ui/hover.wav'],
      compression: {
        formats: [CompressionFormat.OPUS, CompressionFormat.WAV],
        quality: 0.8
      },
      priority: AssetPriority.MEDIUM,
      preload: true,
      memoryPool: 'critical'
    });
  }

  private addEffectAssets(): void {
    // Particle textures
    this.addAsset({
      id: 'particle_basic',
      type: AssetType.TEXTURE,
      src: '/assets/effects/particle.webp',
      fallbacks: ['/assets/effects/particle.png'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.PNG],
        quality: 0.8,
        mipmaps: false
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      memoryPool: 'gameplay'
    });

    this.addAsset({
      id: 'particle_sparkle',
      type: AssetType.TEXTURE,
      src: '/assets/effects/sparkle.webp',
      fallbacks: ['/assets/effects/sparkle.png'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.PNG],
        quality: 0.8,
        mipmaps: false
      },
      priority: AssetPriority.MEDIUM,
      preload: false,
      memoryPool: 'gameplay'
    });

    this.addAsset({
      id: 'particle_dust',
      type: AssetType.TEXTURE,
      src: '/assets/effects/dust.webp',
      fallbacks: ['/assets/effects/dust.png'],
      compression: {
        formats: [CompressionFormat.WEBP, CompressionFormat.PNG],
        quality: 0.7,
        mipmaps: false
      },
      priority: AssetPriority.LOW,
      preload: false,
      memoryPool: 'gameplay'
    });

    // Shaders
    this.addAsset({
      id: 'shader_particle_vertex',
      type: AssetType.SHADER,
      src: '/assets/shaders/particle.vert',
      priority: AssetPriority.HIGH,
      preload: false,
      memoryPool: 'gameplay'
    });

    this.addAsset({
      id: 'shader_particle_fragment',
      type: AssetType.SHADER,
      src: '/assets/shaders/particle.frag',
      priority: AssetPriority.HIGH,
      preload: false,
      memoryPool: 'gameplay'
    });
  }

  private createAssetCollections(): void {
    // Critical boot assets
    this.addCollection({
      id: 'boot',
      name: 'Boot Assets',
      assets: [
        'player_model',
        'player_texture',
        'font_game',
        'ui_coin',
        'ui_score_bg',
        'ui_click'
      ],
      loadingStrategy: LoadingStrategy.PARALLEL
    });

    // Forest level assets
    this.addCollection({
      id: 'forest_level',
      name: 'Forest Level',
      assets: [
        'forest_ground_texture',
        'forest_trees_texture',
        'skybox_forest',
        'music_forest',
        'ambient_forest',
        'bear_model',
        'bear_texture',
        'squirrel_model',
        'squirrel_texture',
        'deer_model',
        'deer_texture'
      ],
      dependencies: ['boot'],
      loadingStrategy: LoadingStrategy.PROGRESSIVE
    });

    // Desert level assets
    this.addCollection({
      id: 'desert_level',
      name: 'Desert Level',
      assets: [
        'desert_sand_texture',
        'desert_rocks_texture',
        'skybox_desert',
        'music_desert',
        'ambient_desert',
        'coyote_model',
        'coyote_texture',
        'snake_model',
        'snake_texture',
        'scorpion_model',
        'scorpion_texture'
      ],
      dependencies: ['boot'],
      loadingStrategy: LoadingStrategy.PROGRESSIVE
    });

    // Sound effects collection
    this.addCollection({
      id: 'sound_effects',
      name: 'Sound Effects',
      assets: [
        'sfx_coin_collect',
        'sfx_powerup_grab',
        'sfx_player_jump',
        'sfx_player_land',
        'sfx_turn_left',
        'sfx_turn_right',
        'sfx_collision_enemy',
        'sfx_collision_obstacle',
        'sfx_bear_roar',
        'sfx_squirrel_chatter',
        'sfx_deer_call',
        'sfx_coyote_howl',
        'sfx_snake_hiss',
        'sfx_scorpion_click'
      ],
      loadingStrategy: LoadingStrategy.ADAPTIVE
    });

    // UI assets collection
    this.addCollection({
      id: 'ui_complete',
      name: 'Complete UI',
      assets: [
        'ui_coin',
        'ui_powerup',
        'ui_health',
        'ui_score_bg',
        'ui_button_play',
        'ui_button_pause',
        'ui_button_settings',
        'ui_click',
        'ui_hover'
      ],
      loadingStrategy: LoadingStrategy.PARALLEL
    });

    // Effects collection
    this.addCollection({
      id: 'effects',
      name: 'Visual Effects',
      assets: [
        'particle_basic',
        'particle_sparkle',
        'particle_dust',
        'shader_particle_vertex',
        'shader_particle_fragment'
      ],
      loadingStrategy: LoadingStrategy.SEQUENTIAL
    });
  }

  private addAsset(config: AssetConfig): void {
    this.manifest.assets.push(config);
  }

  private addCollection(collection: AssetCollection): void {
    this.manifest.collections.push(collection);
  }

  // Configuration methods
  setGlobalConfig(config: Partial<AssetLoaderConfig>): void {
    this.manifest.globalConfig = { ...this.manifest.globalConfig, ...config };
  }

  optimizeForMobile(): void {
    // Reduce quality and enable aggressive compression
    this.manifest.assets.forEach(asset => {
      if (asset.compression) {
        asset.compression.quality *= 0.7; // Reduce quality by 30%
        asset.compression.progressive = true;
      }
    });

    // Reduce concurrent loads
    this.manifest.globalConfig.maxConcurrentLoads = 3;
    this.manifest.globalConfig.memoryLimit = 256 * 1024 * 1024; // 256MB
    this.manifest.globalConfig.cacheSize = 50;
  }

  optimizeForDesktop(): void {
    // Increase quality for desktop
    this.manifest.assets.forEach(asset => {
      if (asset.compression) {
        asset.compression.quality = Math.min(1.0, asset.compression.quality * 1.2);
      }
    });

    // Increase concurrent loads
    this.manifest.globalConfig.maxConcurrentLoads = 8;
    this.manifest.globalConfig.memoryLimit = 1024 * 1024 * 1024; // 1GB
    this.manifest.globalConfig.cacheSize = 200;
  }

  getManifest(): AssetManifest {
    return { ...this.manifest };
  }

  exportManifest(): string {
    return JSON.stringify(this.manifest, null, 2);
  }

  static loadFromJSON(json: string): AssetManifest {
    return JSON.parse(json) as AssetManifest;
  }

  static validateManifest(manifest: AssetManifest): boolean {
    try {
      // Basic validation
      if (!manifest.version || !manifest.assets || !manifest.collections || !manifest.globalConfig) {
        return false;
      }

      // Check asset references in collections
      const assetIds = new Set(manifest.assets.map(asset => asset.id));
      
      for (const collection of manifest.collections) {
        for (const assetId of collection.assets) {
          if (!assetIds.has(assetId)) {
            console.error(`Collection ${collection.id} references unknown asset: ${assetId}`);
            return false;
          }
        }
        
        // Check dependencies
        if (collection.dependencies) {
          const collectionIds = new Set(manifest.collections.map(col => col.id));
          for (const depId of collection.dependencies) {
            if (!collectionIds.has(depId)) {
              console.error(`Collection ${collection.id} has unknown dependency: ${depId}`);
              return false;
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Manifest validation error:', error);
      return false;
    }
  }
}