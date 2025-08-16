// Streaming Asset Loader with Progressive Loading and Adaptive Quality
import {
  AssetConfig,
  LoadedAsset,
  LoadingProgress,
  LoadingStage,
  AssetPriority,
  DeviceCapabilities,
  CompressionFormat
} from '../../types/assets/AssetTypes';
import { AssetLoader } from './AssetLoader';

interface StreamChunk {
  id: string;
  data: ArrayBuffer;
  offset: number;
  size: number;
  isLast: boolean;
}

interface StreamingAsset {
  id: string;
  config: AssetConfig;
  chunks: Map<number, StreamChunk>;
  totalSize: number;
  loadedSize: number;
  isComplete: boolean;
  quality: number;
  adaptiveLoader?: ProgressiveLoader;
}

interface QualityLevel {
  level: number;
  scale: number;
  compression: number;
  suffix: string;
}

class ProgressiveLoader {
  private asset: StreamingAsset;
  private qualityLevels: QualityLevel[];
  private currentLevel = 0;

  constructor(asset: StreamingAsset, deviceCapabilities: DeviceCapabilities) {
    this.asset = asset;
    this.qualityLevels = this.generateQualityLevels(deviceCapabilities);
  }

  private generateQualityLevels(capabilities: DeviceCapabilities): QualityLevel[] {
    const levels: QualityLevel[] = [];
    
    if (capabilities.isMobile || capabilities.connectionType === 'slow-2g' || capabilities.connectionType === '2g') {
      // Mobile: prioritize small files
      levels.push(
        { level: 0, scale: 0.25, compression: 0.1, suffix: '_tiny' },
        { level: 1, scale: 0.5, compression: 0.3, suffix: '_low' },
        { level: 2, scale: 0.75, compression: 0.6, suffix: '_med' },
        { level: 3, scale: 1.0, compression: 1.0, suffix: '' }
      );
    } else if (capabilities.connectionType === '3g') {
      // 3G: balanced approach
      levels.push(
        { level: 0, scale: 0.5, compression: 0.3, suffix: '_low' },
        { level: 1, scale: 0.75, compression: 0.6, suffix: '_med' },
        { level: 2, scale: 1.0, compression: 1.0, suffix: '' }
      );
    } else {
      // Fast connection: quality first
      levels.push(
        { level: 0, scale: 0.75, compression: 0.8, suffix: '_med' },
        { level: 1, scale: 1.0, compression: 1.0, suffix: '' }
      );
    }
    
    return levels;
  }

  async loadNextQuality(): Promise<boolean> {
    if (this.currentLevel >= this.qualityLevels.length) {
      return false; // No more levels
    }

    const level = this.qualityLevels[this.currentLevel];
    const url = this.buildQualityUrl(this.asset.config.src, level.suffix);
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        this.asset.quality = level.scale;
        this.currentLevel++;
        return true;
      }
    } catch (error) {
      console.warn(`Failed to load quality level ${level.level}:`, error);
    }

    this.currentLevel++;
    return this.loadNextQuality(); // Try next level
  }

  private buildQualityUrl(originalUrl: string, suffix: string): string {
    if (!suffix) return originalUrl;
    
    const lastDotIndex = originalUrl.lastIndexOf('.');
    if (lastDotIndex === -1) return originalUrl + suffix;
    
    return originalUrl.substring(0, lastDotIndex) + suffix + originalUrl.substring(lastDotIndex);
  }

  getCurrentQuality(): number {
    return this.asset.quality;
  }

  hasMoreLevels(): boolean {
    return this.currentLevel < this.qualityLevels.length;
  }
}

export class StreamingLoader {
  private baseLoader: AssetLoader;
  private streamingAssets = new Map<string, StreamingAsset>();
  private activeStreams = new Map<string, ReadableStreamDefaultReader>();
  private deviceCapabilities: DeviceCapabilities;
  private chunkSize = 64 * 1024; // 64KB chunks
  private maxConcurrentStreams = 4;
  private backgroundUpgradeEnabled = true;
  
  private onStreamProgressCallbacks: ((assetId: string, progress: number) => void)[] = [];
  private onQualityUpgradeCallbacks: ((assetId: string, quality: number) => void)[] = [];

  constructor(baseLoader: AssetLoader, deviceCapabilities: DeviceCapabilities) {
    this.baseLoader = baseLoader;
    this.deviceCapabilities = deviceCapabilities;
    
    // Adjust chunk size based on connection
    this.adjustChunkSize();
    
    // Start background quality upgrader
    if (this.backgroundUpgradeEnabled) {
      this.startBackgroundUpgrader();
    }
  }

  private adjustChunkSize(): void {
    switch (this.deviceCapabilities.connectionType) {
      case 'slow-2g':
        this.chunkSize = 16 * 1024; // 16KB
        this.maxConcurrentStreams = 1;
        break;
      case '2g':
        this.chunkSize = 32 * 1024; // 32KB
        this.maxConcurrentStreams = 2;
        break;
      case '3g':
        this.chunkSize = 64 * 1024; // 64KB
        this.maxConcurrentStreams = 3;
        break;
      case '4g':
      case '5g':
        this.chunkSize = 128 * 1024; // 128KB
        this.maxConcurrentStreams = 6;
        break;
      default:
        this.chunkSize = 64 * 1024;
        this.maxConcurrentStreams = 4;
    }
  }

  async streamAsset(config: AssetConfig): Promise<LoadedAsset | null> {
    // Check if we can stream this asset type
    if (!this.canStream(config)) {
      return this.baseLoader.loadAsset(config);
    }

    const streamingAsset: StreamingAsset = {
      id: config.id,
      config,
      chunks: new Map(),
      totalSize: 0,
      loadedSize: 0,
      isComplete: false,
      quality: 0.25, // Start with low quality
      adaptiveLoader: new ProgressiveLoader({} as StreamingAsset, this.deviceCapabilities)
    };

    // Initialize adaptive loader properly
    streamingAsset.adaptiveLoader = new ProgressiveLoader(streamingAsset, this.deviceCapabilities);
    
    this.streamingAssets.set(config.id, streamingAsset);

    try {
      // Start with progressive loading
      const hasInitialQuality = await streamingAsset.adaptiveLoader.loadNextQuality();
      if (!hasInitialQuality) {
        // Fall back to regular loading
        return this.baseLoader.loadAsset(config);
      }

      // Start streaming the current quality level
      return this.startStreaming(streamingAsset);
    } catch (error) {
      console.error(`Streaming failed for asset ${config.id}:`, error);
      return this.baseLoader.loadAsset(config);
    }
  }

  private canStream(config: AssetConfig): boolean {
    // Only stream large assets that benefit from progressive loading
    const streamableTypes = ['texture', 'audio', 'model'];
    return streamableTypes.includes(config.type) && 
           config.streaming !== false &&
           this.activeStreams.size < this.maxConcurrentStreams;
  }

  private async startStreaming(asset: StreamingAsset): Promise<LoadedAsset | null> {
    const url = this.buildStreamingUrl(asset);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        asset.totalSize = parseInt(contentLength);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream available');
      }

      this.activeStreams.set(asset.id, reader);
      
      // Process stream chunks
      return this.processStream(asset, reader);
    } catch (error) {
      console.error(`Failed to start streaming for ${asset.id}:`, error);
      this.activeStreams.delete(asset.id);
      return null;
    }
  }

  private buildStreamingUrl(asset: StreamingAsset): string {
    // Use the current quality level URL
    return asset.config.src; // This would be updated by progressive loader
  }

  private async processStream(
    asset: StreamingAsset,
    reader: ReadableStreamDefaultReader
  ): Promise<LoadedAsset | null> {
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;
    let chunkIndex = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          asset.isComplete = true;
          break;
        }

        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          asset.loadedSize = receivedLength;

          // Store chunk for partial processing
          const chunk: StreamChunk = {
            id: `${asset.id}_chunk_${chunkIndex}`,
            data: value.buffer,
            offset: receivedLength - value.length,
            size: value.length,
            isLast: false
          };

          asset.chunks.set(chunkIndex, chunk);
          chunkIndex++;

          // Process partial data if we have enough
          if (this.shouldProcessPartial(asset, receivedLength)) {
            const partialAsset = await this.createPartialAsset(asset, chunks);
            if (partialAsset) {
              this.notifyStreamProgress(asset.id, asset.loadedSize / asset.totalSize);
              
              // Continue streaming in background while returning partial asset
              this.continueStreamingInBackground(asset, reader, chunks, receivedLength, chunkIndex);
              return partialAsset;
            }
          }

          // Update progress
          if (asset.totalSize > 0) {
            this.notifyStreamProgress(asset.id, asset.loadedSize / asset.totalSize);
          }
        }
      }

      // Create final asset from all chunks
      const finalAsset = await this.createFinalAsset(asset, chunks);
      this.activeStreams.delete(asset.id);
      return finalAsset;

    } catch (error) {
      console.error(`Stream processing error for ${asset.id}:`, error);
      this.activeStreams.delete(asset.id);
      return null;
    }
  }

  private shouldProcessPartial(asset: StreamingAsset, receivedLength: number): boolean {
    // Process partial data when we have enough for a basic version
    const minThreshold = Math.min(this.chunkSize * 3, asset.totalSize * 0.1);
    return receivedLength >= minThreshold && 
           asset.config.type === 'texture'; // Only for textures initially
  }

  private async createPartialAsset(
    asset: StreamingAsset,
    chunks: Uint8Array[]
  ): Promise<LoadedAsset | null> {
    try {
      // Combine chunks into single buffer
      const combinedLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(combinedLength);
      
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Process as partial texture (low quality)
      if (asset.config.type === 'texture') {
        const partialTexture = await this.createPartialTexture(combined.buffer, asset.quality);
        
        return {
          id: asset.id,
          type: asset.config.type,
          data: partialTexture,
          size: combined.length,
          format: CompressionFormat.JPEG, // Assume JPEG for partial
          metadata: {
            loadTime: 0,
            fileSize: combined.length,
            compressionRatio: asset.quality
          },
          cleanup: () => this.cleanupStreamingAsset(asset.id)
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to create partial asset:', error);
      return null;
    }
  }

  private async createPartialTexture(data: ArrayBuffer, quality: number): Promise<WebGLTexture | null> {
    try {
      // Create image from partial data
      const blob = new Blob([data]);
      const imageUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          // Scale down for partial quality
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          canvas.width = Math.floor(image.width * quality);
          canvas.height = Math.floor(image.height * quality);
          
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          
          // Convert to WebGL texture
          const texture = this.canvasToTexture(canvas);
          URL.revokeObjectURL(imageUrl);
          resolve(texture);
        };
        
        image.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load partial image'));
        };
        
        image.src = imageUrl;
      });
    } catch (error) {
      console.error('Failed to create partial texture:', error);
      return null;
    }
  }

  private canvasToTexture(canvas: HTMLCanvasElement): WebGLTexture | null {
    const webglCanvas = document.createElement('canvas');
    const gl = webglCanvas.getContext('webgl2') || webglCanvas.getContext('webgl');
    
    if (!gl) return null;

    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  }

  private async continueStreamingInBackground(
    asset: StreamingAsset,
    reader: ReadableStreamDefaultReader,
    existingChunks: Uint8Array[],
    currentLength: number,
    chunkIndex: number
  ): Promise<void> {
    // Continue processing stream in background
    setTimeout(async () => {
      try {
        const remainingChunks = [...existingChunks];
        let receivedLength = currentLength;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            asset.isComplete = true;
            const finalAsset = await this.createFinalAsset(asset, remainingChunks);
            if (finalAsset) {
              // Update the asset with final quality
              this.notifyQualityUpgrade(asset.id, 1.0);
            }
            break;
          }

          if (value) {
            remainingChunks.push(value);
            receivedLength += value.length;
            asset.loadedSize = receivedLength;

            const chunk: StreamChunk = {
              id: `${asset.id}_chunk_${chunkIndex}`,
              data: value.buffer,
              offset: receivedLength - value.length,
              size: value.length,
              isLast: false
            };

            asset.chunks.set(chunkIndex, chunk);
            chunkIndex++;

            this.notifyStreamProgress(asset.id, asset.loadedSize / asset.totalSize);
          }
        }
      } catch (error) {
        console.error('Background streaming error:', error);
      } finally {
        this.activeStreams.delete(asset.id);
      }
    }, 0);
  }

  private async createFinalAsset(
    asset: StreamingAsset,
    chunks: Uint8Array[]
  ): Promise<LoadedAsset | null> {
    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Process using base loader
    const mockResponse = new Response(combined.buffer);
    
    try {
      const processedData = await this.baseLoader['processAssetData'](
        mockResponse,
        asset.config.type,
        CompressionFormat.JPEG
      );

      return {
        id: asset.id,
        type: asset.config.type,
        data: processedData,
        size: combined.length,
        format: CompressionFormat.JPEG,
        metadata: {
          loadTime: 0,
          fileSize: combined.length,
          compressionRatio: 1.0
        },
        cleanup: () => this.cleanupStreamingAsset(asset.id)
      };
    } catch (error) {
      console.error('Failed to create final asset:', error);
      return null;
    }
  }

  private startBackgroundUpgrader(): void {
    setInterval(() => {
      this.upgradeQualityInBackground();
    }, 5000); // Check every 5 seconds
  }

  private async upgradeQualityInBackground(): void {
    for (const asset of this.streamingAssets.values()) {
      if (asset.isComplete && 
          asset.adaptiveLoader && 
          asset.adaptiveLoader.hasMoreLevels() &&
          this.activeStreams.size < this.maxConcurrentStreams) {
        
        try {
          const upgraded = await asset.adaptiveLoader.loadNextQuality();
          if (upgraded) {
            this.notifyQualityUpgrade(asset.id, asset.adaptiveLoader.getCurrentQuality());
          }
        } catch (error) {
          console.warn(`Background quality upgrade failed for ${asset.id}:`, error);
        }
      }
    }
  }

  private notifyStreamProgress(assetId: string, progress: number): void {
    this.onStreamProgressCallbacks.forEach(callback => {
      try {
        callback(assetId, progress);
      } catch (error) {
        console.error('Stream progress callback error:', error);
      }
    });
  }

  private notifyQualityUpgrade(assetId: string, quality: number): void {
    this.onQualityUpgradeCallbacks.forEach(callback => {
      try {
        callback(assetId, quality);
      } catch (error) {
        console.error('Quality upgrade callback error:', error);
      }
    });
  }

  private cleanupStreamingAsset(assetId: string): void {
    const asset = this.streamingAssets.get(assetId);
    if (!asset) return;

    // Stop any active stream
    const reader = this.activeStreams.get(assetId);
    if (reader) {
      reader.cancel();
      this.activeStreams.delete(assetId);
    }

    // Clear chunks
    asset.chunks.clear();
    this.streamingAssets.delete(assetId);
  }

  // Public API
  onStreamProgress(callback: (assetId: string, progress: number) => void): void {
    this.onStreamProgressCallbacks.push(callback);
  }

  onQualityUpgrade(callback: (assetId: string, quality: number) => void): void {
    this.onQualityUpgradeCallbacks.push(callback);
  }

  getStreamingAsset(assetId: string): StreamingAsset | null {
    return this.streamingAssets.get(assetId) || null;
  }

  isStreaming(assetId: string): boolean {
    return this.activeStreams.has(assetId);
  }

  cancelStream(assetId: string): void {
    const reader = this.activeStreams.get(assetId);
    if (reader) {
      reader.cancel();
      this.activeStreams.delete(assetId);
    }
    this.cleanupStreamingAsset(assetId);
  }

  setBackgroundUpgradeEnabled(enabled: boolean): void {
    this.backgroundUpgradeEnabled = enabled;
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  cleanup(): void {
    // Cancel all active streams
    for (const [assetId] of this.activeStreams) {
      this.cancelStream(assetId);
    }

    // Clear callbacks
    this.onStreamProgressCallbacks.length = 0;
    this.onQualityUpgradeCallbacks.length = 0;

    // Clear assets
    this.streamingAssets.clear();
  }
}