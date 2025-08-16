import type { RenderCapabilities } from '@/types';

export class DeviceCapabilities {
  private static instance: DeviceCapabilities;
  private capabilities: RenderCapabilities | null = null;

  private constructor() {}

  static getInstance(): DeviceCapabilities {
    if (!DeviceCapabilities.instance) {
      DeviceCapabilities.instance = new DeviceCapabilities();
    }
    return DeviceCapabilities.instance;
  }

  static async detect(): Promise<RenderCapabilities> {
    const instance = DeviceCapabilities.getInstance();
    
    if (instance.capabilities) {
      return instance.capabilities;
    }
    
    console.log('Detecting device capabilities...');
    
    const capabilities = await instance.detectCapabilities();
    instance.capabilities = capabilities;
    
    console.log('Device capabilities detected:', capabilities);
    return capabilities;
  }

  private async detectCapabilities(): Promise<RenderCapabilities> {
    const capabilities: RenderCapabilities = {
      hasWebGPU: false,
      hasWebGL2: false,
      maxTextureSize: 2048,
      maxTextures: 8,
      hasInstancedDrawing: false,
      hasComputeShaders: false,
      supportedTextureFormats: [],
      maxShaderStage: 1,
      isHighEndDevice: false,
      isMobile: this.detectMobile()
    };

    // Detect WebGPU support
    await this.detectWebGPU(capabilities);
    
    // Detect WebGL support
    this.detectWebGL(capabilities);
    
    // Detect device performance tier
    this.detectPerformanceTier(capabilities);
    
    // Detect texture compression support
    this.detectTextureFormats(capabilities);
    
    return capabilities;
  }

  private async detectWebGPU(capabilities: RenderCapabilities): Promise<void> {
    try {
      if (!('gpu' in navigator)) {
        console.log('WebGPU not available');
        return;
      }

      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        console.log('WebGPU adapter not available');
        return;
      }

      console.log('WebGPU adapter found:', {
        vendor: adapter.info?.vendor,
        architecture: adapter.info?.architecture,
        device: adapter.info?.device,
        description: adapter.info?.description
      });

      // Test device creation
      try {
        const device = await adapter.requestDevice({
          requiredFeatures: [],
          requiredLimits: {}
        });

        capabilities.hasWebGPU = true;
        capabilities.hasComputeShaders = true;
        capabilities.maxTextureSize = device.limits.maxTextureDimension2D || 8192;
        capabilities.maxTextures = device.limits.maxSampledTexturesPerShaderStage || 16;
        capabilities.maxShaderStage = 3; // Vertex, Fragment, Compute

        console.log('WebGPU device limits:', {
          maxTextureDimension2D: device.limits.maxTextureDimension2D,
          maxTextureArrayLayers: device.limits.maxTextureArrayLayers,
          maxBindGroups: device.limits.maxBindGroups,
          maxSampledTexturesPerShaderStage: device.limits.maxSampledTexturesPerShaderStage,
          maxStorageTexturesPerShaderStage: device.limits.maxStorageTexturesPerShaderStage,
          maxUniformBuffersPerShaderStage: device.limits.maxUniformBuffersPerShaderStage,
          maxStorageBuffersPerShaderStage: device.limits.maxStorageBuffersPerShaderStage
        });

        // Detect supported features
        const supportedFeatures = Array.from(adapter.features);
        console.log('WebGPU supported features:', supportedFeatures);
        
        // Clean up test device
        device.destroy();
        
      } catch (deviceError) {
        console.warn('WebGPU device creation failed:', deviceError);
      }

    } catch (error) {
      console.warn('WebGPU detection failed:', error);
    }
  }

  private detectWebGL(capabilities: RenderCapabilities): void {
    try {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      const gl1 = gl2 || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl1) {
        console.warn('WebGL not supported');
        return;
      }

      capabilities.hasWebGL2 = !!gl2;
      const gl = gl1 as WebGLRenderingContext | WebGL2RenderingContext;

      // Basic capabilities
      capabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      capabilities.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

      // Check for instanced drawing
      if (gl2) {
        capabilities.hasInstancedDrawing = true;
      } else {
        const instancedExt = gl.getExtension('ANGLE_instanced_arrays');
        capabilities.hasInstancedDrawing = !!instancedExt;
      }

      // Get renderer info for performance detection
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      let renderer = '';
      let vendor = '';
      
      if (debugInfo) {
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
      }

      console.log('WebGL info:', {
        version: capabilities.hasWebGL2 ? 'WebGL2' : 'WebGL1',
        vendor,
        renderer,
        maxTextureSize: capabilities.maxTextureSize,
        maxTextures: capabilities.maxTextures,
        hasInstancedDrawing: capabilities.hasInstancedDrawing
      });

      // Analyze GPU for performance tier
      this.analyzeGPU(renderer, vendor, capabilities);

    } catch (error) {
      console.warn('WebGL detection failed:', error);
    }
  }

  private analyzeGPU(renderer: string, vendor: string, capabilities: RenderCapabilities): void {
    const rendererLower = renderer.toLowerCase();
    const vendorLower = vendor.toLowerCase();
    
    // High-end GPU detection patterns
    const highEndPatterns = [
      // NVIDIA high-end
      /rtx\s*(40|30|20)\d\d/,
      /gtx\s*(16|10)\d\d/,
      /tesla/,
      /quadro/,
      /titan/,
      
      // AMD high-end
      /radeon.*rx\s*(7|6)\d\d\d/,
      /radeon.*rx\s*vega/,
      /radeon.*pro/,
      
      // Intel high-end
      /iris.*xe/,
      /iris.*pro/,
      /uhd.*graphics.*7\d\d/,
      
      // Apple
      /apple.*m[1-9]/,
      /apple.*gpu/,
      
      // Qualcomm high-end
      /adreno.*[67]\d\d/,
      
      // ARM Mali high-end
      /mali.*g[789]\d/
    ];
    
    // Check for high-end patterns
    const isHighEnd = highEndPatterns.some(pattern => 
      pattern.test(rendererLower) || pattern.test(vendorLower)
    );
    
    capabilities.isHighEndDevice = isHighEnd;
    
    // Additional checks for integrated vs discrete
    const isIntegrated = /intel|uhd|iris|amd.*radeon.*graphics|apple/i.test(rendererLower);
    const isDiscrete = /nvidia|amd.*radeon.*rx|amd.*radeon.*pro/i.test(rendererLower);
    
    console.log('GPU analysis:', {
      renderer,
      vendor,
      isHighEnd,
      isIntegrated,
      isDiscrete,
      classification: isHighEnd ? 'high-end' : capabilities.isMobile ? 'mobile' : 'mid-range'
    });
  }

  private detectPerformanceTier(capabilities: RenderCapabilities): void {
    // CPU cores
    const cpuCores = navigator.hardwareConcurrency || 2;
    
    // Memory (if available)
    const deviceMemory = (navigator as any).deviceMemory || 4;
    
    // Connection type (for bandwidth estimation)
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType || '4g';
    
    // Battery info (for power constraints)
    const battery = (navigator as any).battery;
    const charging = battery?.charging ?? true;
    
    // Combine factors for performance assessment
    const performanceScore = this.calculatePerformanceScore({
      cpuCores,
      deviceMemory,
      effectiveType,
      charging,
      hasWebGPU: capabilities.hasWebGPU,
      hasWebGL2: capabilities.hasWebGL2,
      maxTextureSize: capabilities.maxTextureSize,
      isMobile: capabilities.isMobile
    });
    
    // Update high-end classification based on overall performance
    if (performanceScore > 0.7) {
      capabilities.isHighEndDevice = true;
    } else if (performanceScore < 0.3) {
      capabilities.isHighEndDevice = false;
    }
    
    console.log('Performance assessment:', {
      cpuCores,
      deviceMemory,
      effectiveType,
      charging,
      performanceScore,
      finalClassification: capabilities.isHighEndDevice ? 'high-end' : 'standard'
    });
  }

  private calculatePerformanceScore(factors: {
    cpuCores: number;
    deviceMemory: number;
    effectiveType: string;
    charging: boolean;
    hasWebGPU: boolean;
    hasWebGL2: boolean;
    maxTextureSize: number;
    isMobile: boolean;
  }): number {
    let score = 0;
    
    // CPU score (0-0.25)
    score += Math.min(factors.cpuCores / 8, 1) * 0.25;
    
    // Memory score (0-0.25)
    score += Math.min(factors.deviceMemory / 16, 1) * 0.25;
    
    // GPU API score (0-0.3)
    if (factors.hasWebGPU) {
      score += 0.3;
    } else if (factors.hasWebGL2) {
      score += 0.2;
    } else {
      score += 0.1;
    }
    
    // Texture capability score (0-0.1)
    score += Math.min(factors.maxTextureSize / 8192, 1) * 0.1;
    
    // Network score (0-0.05)
    const networkScore = {
      'slow-2g': 0,
      '2g': 0.2,
      '3g': 0.5,
      '4g': 0.8,
      '5g': 1
    }[factors.effectiveType] || 0.5;
    score += networkScore * 0.05;
    
    // Power constraint penalty
    if (!factors.charging && factors.isMobile) {
      score *= 0.8;
    }
    
    // Mobile penalty for sustained performance
    if (factors.isMobile) {
      score *= 0.9;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private detectTextureFormats(capabilities: RenderCapabilities): void {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) return;
    
    const formats: string[] = [];
    
    // Standard formats
    formats.push('RGBA8', 'RGB8', 'ALPHA', 'LUMINANCE', 'LUMINANCE_ALPHA');
    
    if (capabilities.hasWebGL2) {
      formats.push('RGBA32F', 'RGBA16F', 'RG8', 'R8');
    }
    
    // Compressed texture formats
    const compressionExtensions = [
      { name: 'WEBGL_compressed_texture_s3tc', formats: ['DXT1', 'DXT3', 'DXT5'] },
      { name: 'WEBGL_compressed_texture_etc', formats: ['ETC1'] },
      { name: 'WEBGL_compressed_texture_etc1', formats: ['ETC1'] },
      { name: 'WEBGL_compressed_texture_astc', formats: ['ASTC'] },
      { name: 'WEBGL_compressed_texture_pvrtc', formats: ['PVRTC'] },
      { name: 'EXT_texture_compression_bptc', formats: ['BPTC'] },
      { name: 'EXT_texture_compression_rgtc', formats: ['RGTC'] }
    ];
    
    for (const ext of compressionExtensions) {
      if (gl.getExtension(ext.name)) {
        formats.push(...ext.formats);
      }
    }
    
    // Float texture support
    if (gl.getExtension('OES_texture_float')) {
      formats.push('FLOAT32');
    }
    
    if (gl.getExtension('OES_texture_half_float')) {
      formats.push('FLOAT16');
    }
    
    capabilities.supportedTextureFormats = formats;
    
    console.log('Supported texture formats:', formats);
  }

  private detectMobile(): boolean {
    // User agent based detection
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android', 'iphone', 'ipad', 'ipod', 'blackberry', 
      'windows phone', 'mobile', 'tablet'
    ];
    
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Touch support detection
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Screen size detection
    const isSmallScreen = window.screen.width <= 768 || window.screen.height <= 768;
    
    // Device orientation support
    const hasOrientationSupport = 'orientation' in window;
    
    // Combine factors
    const isMobile = isMobileUA || (hasTouch && isSmallScreen) || hasOrientationSupport;
    
    console.log('Mobile detection:', {
      userAgent: isMobileUA,
      hasTouch,
      isSmallScreen,
      hasOrientationSupport,
      finalResult: isMobile,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio
    });
    
    return isMobile;
  }

  // Benchmark methods for more accurate detection
  async runPerformanceBenchmark(): Promise<number> {
    console.log('Running performance benchmark...');
    
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 0;
    
    // Simple GPU benchmark
    const startTime = performance.now();
    
    // Create test geometry
    const vertices = new Float32Array(3000 * 3); // 1000 triangles
    for (let i = 0; i < vertices.length; i++) {
      vertices[i] = Math.random() * 2 - 1;
    }
    
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Simple shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `);
    gl.compileShader(fragmentShader);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    
    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    
    // Render test
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 1000);
    }
    
    // Force completion
    gl.finish();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Cleanup
    gl.deleteBuffer(buffer);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);
    
    // Calculate score (lower time = higher score)
    const score = Math.max(0, Math.min(1, 1 - (duration / 1000)));
    
    console.log(`Performance benchmark completed in ${duration.toFixed(2)}ms, score: ${score.toFixed(3)}`);
    
    return score;
  }

  // Memory stress test
  async runMemoryBenchmark(): Promise<number> {
    console.log('Running memory benchmark...');
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 0;
    
    const startTime = performance.now();
    const textures: WebGLTexture[] = [];
    
    try {
      // Try to allocate textures until we hit a limit
      for (let i = 0; i < 100; i++) {
        const texture = gl.createTexture();
        if (!texture) break;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null
        );
        
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
          gl.deleteTexture(texture);
          break;
        }
        
        textures.push(texture);
      }
    } catch (error) {
      console.warn('Memory benchmark hit limit:', error);
    }
    
    // Cleanup
    for (const texture of textures) {
      gl.deleteTexture(texture);
    }
    
    const duration = performance.now() - startTime;
    const score = Math.min(1, textures.length / 50); // Normalize to 50 textures
    
    console.log(`Memory benchmark: allocated ${textures.length} textures in ${duration.toFixed(2)}ms, score: ${score.toFixed(3)}`);
    
    return score;
  }

  // Get current capabilities
  getCapabilities(): RenderCapabilities | null {
    return this.capabilities;
  }

  // Update capabilities (for dynamic detection)
  async refresh(): Promise<RenderCapabilities> {
    this.capabilities = null;
    return this.detectCapabilities();
  }
}