// Compression Format Detection and Optimization
import {
  AssetConfig,
  CompressionFormat,
  DeviceCapabilities,
  AssetType
} from '../../types/assets/AssetTypes';

export class CompressionDetector {
  private formatSupport = new Map<CompressionFormat, boolean>();
  private formatPriority: Record<AssetType, CompressionFormat[]> = {
    [AssetType.TEXTURE]: [
      CompressionFormat.ASTC,
      CompressionFormat.ETC2,
      CompressionFormat.S3TC,
      CompressionFormat.WEBP,
      CompressionFormat.JPEG,
      CompressionFormat.PNG
    ],
    [AssetType.AUDIO]: [
      CompressionFormat.OPUS,
      CompressionFormat.OGG,
      CompressionFormat.AAC,
      CompressionFormat.MP3,
      CompressionFormat.WAV
    ],
    [AssetType.MODEL]: [],
    [AssetType.SHADER]: [],
    [AssetType.FONT]: [],
    [AssetType.JSON]: [],
    [AssetType.BINARY]: []
  };

  constructor() {
    this.detectFormatSupport();
  }

  private detectFormatSupport(): void {
    this.detectTextureSupport();
    this.detectAudioSupport();
  }

  private detectTextureSupport(): void {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) {
      // Fallback to basic formats
      this.formatSupport.set(CompressionFormat.WEBP, this.supportsWebP());
      this.formatSupport.set(CompressionFormat.JPEG, true);
      this.formatSupport.set(CompressionFormat.PNG, true);
      return;
    }

    // Check compressed texture support
    this.formatSupport.set(
      CompressionFormat.ASTC,
      !!gl.getExtension('WEBGL_compressed_texture_astc')
    );
    
    this.formatSupport.set(
      CompressionFormat.ETC2,
      !!gl.getExtension('WEBGL_compressed_texture_etc')
    );
    
    this.formatSupport.set(
      CompressionFormat.S3TC,
      !!gl.getExtension('WEBGL_compressed_texture_s3tc')
    );
    
    this.formatSupport.set(
      CompressionFormat.PVRTC,
      !!gl.getExtension('WEBGL_compressed_texture_pvrtc')
    );

    // Standard web formats
    this.formatSupport.set(CompressionFormat.WEBP, this.supportsWebP());
    this.formatSupport.set(CompressionFormat.JPEG, true);
    this.formatSupport.set(CompressionFormat.PNG, true);
  }

  private detectAudioSupport(): void {
    const audio = document.createElement('audio');
    
    this.formatSupport.set(
      CompressionFormat.OPUS,
      audio.canPlayType('audio/ogg; codecs="opus"') !== ''
    );
    
    this.formatSupport.set(
      CompressionFormat.OGG,
      audio.canPlayType('audio/ogg') !== ''
    );
    
    this.formatSupport.set(
      CompressionFormat.MP3,
      audio.canPlayType('audio/mpeg') !== ''
    );
    
    this.formatSupport.set(
      CompressionFormat.AAC,
      audio.canPlayType('audio/aac') !== '' ||
      audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== ''
    );
    
    this.formatSupport.set(CompressionFormat.WAV, true); // Universal support
  }

  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  async getOptimalFormat(
    config: AssetConfig,
    capabilities: DeviceCapabilities
  ): Promise<CompressionFormat> {
    const priorityList = this.formatPriority[config.type];
    
    if (!priorityList || priorityList.length === 0) {
      return this.getDefaultFormat(config.type);
    }

    // Consider device capabilities and connection
    const adjustedPriority = this.adjustPriorityForDevice(
      priorityList,
      capabilities
    );

    // Find first supported format
    for (const format of adjustedPriority) {
      if (this.isFormatSupported(format)) {
        return format;
      }
    }

    // Fallback to default
    return this.getDefaultFormat(config.type);
  }

  private adjustPriorityForDevice(
    formats: CompressionFormat[],
    capabilities: DeviceCapabilities
  ): CompressionFormat[] {
    const adjusted = [...formats];

    // On mobile or slow connections, prefer smaller files
    if (capabilities.isMobile || capabilities.connectionType === 'slow-2g' || capabilities.connectionType === '2g') {
      // Move highly compressed formats to front
      const compressedFormats = [
        CompressionFormat.ASTC,
        CompressionFormat.ETC2,
        CompressionFormat.OPUS,
        CompressionFormat.OGG
      ];

      adjusted.sort((a, b) => {
        const aIsCompressed = compressedFormats.includes(a);
        const bIsCompressed = compressedFormats.includes(b);
        
        if (aIsCompressed && !bIsCompressed) return -1;
        if (!aIsCompressed && bIsCompressed) return 1;
        return 0;
      });
    }

    // On desktop with fast connection, prioritize quality
    if (!capabilities.isMobile && 
        (capabilities.connectionType === '4g' || capabilities.connectionType === '5g')) {
      // Move high-quality formats to front
      const qualityFormats = [
        CompressionFormat.PNG,
        CompressionFormat.WAV,
        CompressionFormat.S3TC
      ];

      adjusted.sort((a, b) => {
        const aIsQuality = qualityFormats.includes(a);
        const bIsQuality = qualityFormats.includes(b);
        
        if (aIsQuality && !bIsQuality) return -1;
        if (!aIsQuality && bIsQuality) return 1;
        return 0;
      });
    }

    return adjusted;
  }

  private isFormatSupported(format: CompressionFormat): boolean {
    return this.formatSupport.get(format) ?? false;
  }

  private getDefaultFormat(type: AssetType): CompressionFormat {
    switch (type) {
      case AssetType.TEXTURE:
        return CompressionFormat.PNG;
      case AssetType.AUDIO:
        return CompressionFormat.MP3;
      default:
        return CompressionFormat.PNG; // Safe fallback
    }
  }

  getSupportedFormats(): Map<CompressionFormat, boolean> {
    return new Map(this.formatSupport);
  }

  getCompressionRatio(format: CompressionFormat): number {
    // Approximate compression ratios compared to uncompressed
    const ratios: Record<CompressionFormat, number> = {
      [CompressionFormat.ASTC]: 0.125,     // 8:1
      [CompressionFormat.ETC2]: 0.25,      // 4:1
      [CompressionFormat.S3TC]: 0.25,      // 4:1
      [CompressionFormat.PVRTC]: 0.125,    // 8:1
      [CompressionFormat.WEBP]: 0.3,       // ~3.3:1
      [CompressionFormat.JPEG]: 0.1,       // 10:1
      [CompressionFormat.PNG]: 0.5,        // 2:1
      [CompressionFormat.OPUS]: 0.05,      // 20:1
      [CompressionFormat.OGG]: 0.1,        // 10:1
      [CompressionFormat.MP3]: 0.1,        // 10:1
      [CompressionFormat.AAC]: 0.08,       // 12.5:1
      [CompressionFormat.WAV]: 1.0         // No compression
    };

    return ratios[format] ?? 1.0;
  }

  estimateLoadTime(
    fileSize: number,
    format: CompressionFormat,
    connectionType: string
  ): number {
    const compressionRatio = this.getCompressionRatio(format);
    const compressedSize = fileSize * compressionRatio;

    // Estimated download speeds (bytes per second)
    const speeds: Record<string, number> = {
      'slow-2g': 50 * 1024,      // 50 KB/s
      '2g': 250 * 1024,          // 250 KB/s
      '3g': 750 * 1024,          // 750 KB/s
      '4g': 3 * 1024 * 1024,     // 3 MB/s
      '5g': 10 * 1024 * 1024,    // 10 MB/s
      'unknown': 1 * 1024 * 1024  // 1 MB/s fallback
    };

    const speed = speeds[connectionType] || speeds.unknown;
    return (compressedSize / speed) * 1000; // Return in milliseconds
  }
}