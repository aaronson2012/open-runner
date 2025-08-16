import * as THREE from 'three';
import type { RenderSettings, Entity } from '@/types';

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private settings: RenderSettings;
  
  private renderPipeline!: GPURenderPipeline;
  private commandEncoder!: GPUCommandEncoder;
  private renderPassEncoder!: GPURenderPassEncoder;
  
  // Resource management
  private buffers: Map<string, GPUBuffer> = new Map();
  private textures: Map<string, GPUTexture> = new Map();
  private samplers: Map<string, GPUSampler> = new Map();
  private bindGroups: Map<string, GPUBindGroup> = new Map();
  
  // Pipeline cache
  private pipelineCache: Map<string, GPURenderPipeline> = new Map();
  
  // Performance metrics
  private drawCalls = 0;
  private triangles = 0;
  
  // Depth texture
  private depthTexture!: GPUTexture;
  
  constructor(canvas: HTMLCanvasElement, settings: RenderSettings) {
    this.canvas = canvas;
    this.settings = settings;
  }

  async init(): Promise<void> {
    console.log('Initializing WebGPU renderer...');
    
    try {
      // Check WebGPU support
      if (!('gpu' in navigator)) {
        throw new Error('WebGPU not supported');
      }
      
      // Request adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        throw new Error('No WebGPU adapter found');
      }
      
      console.log('WebGPU adapter features:', Array.from(adapter.features));
      console.log('WebGPU adapter limits:', adapter.limits);
      
      // Request device
      this.device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
      });
      
      // Setup canvas context
      this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
      if (!this.context) {
        throw new Error('Failed to get WebGPU context');
      }
      
      // Configure canvas
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        alphaMode: 'premultiplied'
      });
      
      // Create depth texture
      this.createDepthTexture();
      
      // Setup default shaders and pipeline
      await this.setupDefaultPipeline();
      
      // Setup device error handling
      this.device.addEventListener('uncapturederror', (event) => {
        console.error('WebGPU uncaptured error:', event.error);
      });
      
      console.log('WebGPU renderer initialized successfully');
      
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      throw error;
    }
  }

  private createDepthTexture(): void {
    const { width, height } = this.getSize();
    
    this.depthTexture = this.device.createTexture({
      size: { width, height },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  private async setupDefaultPipeline(): Promise<void> {
    // Default vertex shader
    const vertexShaderSource = `
      struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
      }
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) worldPosition: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
      }
      
      struct Uniforms {
        modelMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        projectionMatrix: mat4x4<f32>,
        normalMatrix: mat3x3<f32>,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      
      @vertex
      fn main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        
        let worldPosition = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
        output.worldPosition = worldPosition.xyz;
        output.position = uniforms.projectionMatrix * uniforms.viewMatrix * worldPosition;
        output.normal = uniforms.normalMatrix * input.normal;
        output.uv = input.uv;
        
        return output;
      }
    `;
    
    // Default fragment shader
    const fragmentShaderSource = `
      struct FragmentInput {
        @location(0) worldPosition: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
      }
      
      struct MaterialUniforms {
        albedo: vec3<f32>,
        metallic: f32,
        roughness: f32,
        emissive: vec3<f32>,
      }
      
      struct LightUniforms {
        direction: vec3<f32>,
        color: vec3<f32>,
        intensity: f32,
      }
      
      @group(1) @binding(0) var<uniform> material: MaterialUniforms;
      @group(1) @binding(1) var<uniform> light: LightUniforms;
      @group(1) @binding(2) var albedoTexture: texture_2d<f32>;
      @group(1) @binding(3) var textureSampler: sampler;
      
      @fragment
      fn main(input: FragmentInput) -> @location(0) vec4<f32> {
        let normal = normalize(input.normal);
        let lightDir = normalize(-light.direction);
        
        // Sample albedo texture
        let albedoSample = textureSample(albedoTexture, textureSampler, input.uv);
        let albedo = material.albedo * albedoSample.rgb;
        
        // Simple PBR lighting
        let NdotL = max(dot(normal, lightDir), 0.0);
        let diffuse = albedo * light.color * light.intensity * NdotL;
        
        // Add ambient
        let ambient = albedo * 0.1;
        
        let finalColor = diffuse + ambient + material.emissive;
        
        return vec4<f32>(finalColor, albedoSample.a);
      }
    `;
    
    // Create shader modules
    const vertexShader = this.device.createShaderModule({
      label: 'Default Vertex Shader',
      code: vertexShaderSource
    });
    
    const fragmentShader = this.device.createShaderModule({
      label: 'Default Fragment Shader',
      code: fragmentShaderSource
    });
    
    // Create bind group layouts
    const uniformBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Uniform Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' }
        }
      ]
    });
    
    const materialBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Material Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    });
    
    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'Default Pipeline Layout',
      bindGroupLayouts: [uniformBindGroupLayout, materialBindGroupLayout]
    });
    
    // Create render pipeline
    this.renderPipeline = this.device.createRenderPipeline({
      label: 'Default Render Pipeline',
      layout: pipelineLayout,
      vertex: {
        module: vertexShader,
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 8 * 4, // 3 pos + 3 normal + 2 uv = 8 floats
            attributes: [
              { format: 'float32x3', offset: 0, shaderLocation: 0 }, // position
              { format: 'float32x3', offset: 12, shaderLocation: 1 }, // normal
              { format: 'float32x2', offset: 24, shaderLocation: 2 }, // uv
            ]
          }
        ]
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'main',
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha'
              }
            }
          }
        ]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
        frontFace: 'ccw'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      },
      multisample: {
        count: this.settings.enableAntialiasing ? 4 : 1
      }
    });
    
    // Cache the default pipeline
    this.pipelineCache.set('default', this.renderPipeline);
    
    // Create default sampler
    const defaultSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat'
    });
    this.samplers.set('default', defaultSampler);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    // Reset metrics
    this.drawCalls = 0;
    this.triangles = 0;
    
    // Create command encoder
    this.commandEncoder = this.device.createCommandEncoder({
      label: 'Render Frame'
    });
    
    // Begin render pass
    const colorAttachment: GPURenderPassColorAttachment = {
      view: this.context.getCurrentTexture().createView(),
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store'
    };
    
    const depthAttachment: GPURenderPassDepthStencilAttachment = {
      view: this.depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store'
    };
    
    this.renderPassEncoder = this.commandEncoder.beginRenderPass({
      label: 'Main Render Pass',
      colorAttachments: [colorAttachment],
      depthStencilAttachment: depthAttachment
    });
    
    // Set default pipeline
    this.renderPassEncoder.setPipeline(this.renderPipeline);
    
    // Render scene objects
    this.renderScene(scene, camera);
    
    // End render pass
    this.renderPassEncoder.end();
    
    // Submit command buffer
    const commandBuffer = this.commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

  private renderScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    // Update camera matrices
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    
    // Traverse scene and render objects
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) {
        this.renderMesh(object, camera);
      }
    });
  }

  private renderMesh(mesh: THREE.Mesh, camera: THREE.PerspectiveCamera): void {
    // Skip if no geometry or material
    if (!mesh.geometry || !mesh.material) return;
    
    // Update object matrices
    mesh.updateMatrixWorld();
    
    // Get or create vertex buffer for this geometry
    const geometryId = (mesh.geometry as any).uuid;
    let vertexBuffer = this.buffers.get(`vertex_${geometryId}`);
    
    if (!vertexBuffer) {
      vertexBuffer = this.createVertexBuffer(mesh.geometry);
      this.buffers.set(`vertex_${geometryId}`, vertexBuffer);
    }
    
    // Get or create index buffer if needed
    let indexBuffer: GPUBuffer | undefined;
    if (mesh.geometry.index) {
      const indexId = `index_${geometryId}`;
      indexBuffer = this.buffers.get(indexId);
      
      if (!indexBuffer) {
        indexBuffer = this.createIndexBuffer(mesh.geometry);
        this.buffers.set(indexId, indexBuffer);
      }
    }
    
    // Create uniform buffer for this object
    const uniformBuffer = this.createUniformBuffer(mesh, camera);
    
    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer }
        }
      ]
    });
    
    // Set vertex buffer
    this.renderPassEncoder.setVertexBuffer(0, vertexBuffer);
    
    // Set index buffer if available
    if (indexBuffer && mesh.geometry.index) {
      this.renderPassEncoder.setIndexBuffer(indexBuffer, 'uint32');
    }
    
    // Set bind group
    this.renderPassEncoder.setBindGroup(0, bindGroup);
    
    // Draw
    if (indexBuffer && mesh.geometry.index) {
      const indexCount = mesh.geometry.index.count;
      this.renderPassEncoder.drawIndexed(indexCount);
      this.triangles += indexCount / 3;
    } else {
      const vertexCount = mesh.geometry.attributes.position.count;
      this.renderPassEncoder.draw(vertexCount);
      this.triangles += vertexCount / 3;
    }
    
    this.drawCalls++;
  }

  private createVertexBuffer(geometry: THREE.BufferGeometry): GPUBuffer {
    // Interleave vertex data (position, normal, uv)
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    
    const vertexCount = position.count;
    const vertexData = new Float32Array(vertexCount * 8); // 3 pos + 3 normal + 2 uv
    
    for (let i = 0; i < vertexCount; i++) {
      const offset = i * 8;
      
      // Position
      vertexData[offset + 0] = position.array[i * 3 + 0];
      vertexData[offset + 1] = position.array[i * 3 + 1];
      vertexData[offset + 2] = position.array[i * 3 + 2];
      
      // Normal
      if (normal) {
        vertexData[offset + 3] = normal.array[i * 3 + 0];
        vertexData[offset + 4] = normal.array[i * 3 + 1];
        vertexData[offset + 5] = normal.array[i * 3 + 2];
      } else {
        vertexData[offset + 3] = 0;
        vertexData[offset + 4] = 1;
        vertexData[offset + 5] = 0;
      }
      
      // UV
      if (uv) {
        vertexData[offset + 6] = uv.array[i * 2 + 0];
        vertexData[offset + 7] = uv.array[i * 2 + 1];
      } else {
        vertexData[offset + 6] = 0;
        vertexData[offset + 7] = 0;
      }
    }
    
    const buffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    
    new Float32Array(buffer.getMappedRange()).set(vertexData);
    buffer.unmap();
    
    return buffer;
  }

  private createIndexBuffer(geometry: THREE.BufferGeometry): GPUBuffer {
    if (!geometry.index) {
      throw new Error('Geometry has no index');
    }
    
    const indexData = new Uint32Array(geometry.index.array);
    
    const buffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    
    new Uint32Array(buffer.getMappedRange()).set(indexData);
    buffer.unmap();
    
    return buffer;
  }

  private createUniformBuffer(mesh: THREE.Mesh, camera: THREE.PerspectiveCamera): GPUBuffer {
    // Create matrices
    const modelMatrix = mesh.matrixWorld;
    const viewMatrix = camera.matrixWorldInverse;
    const projectionMatrix = camera.projectionMatrix;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(modelMatrix);
    
    // Pack data (64 floats total)
    const uniformData = new Float32Array(64);
    
    // Model matrix (16 floats)
    modelMatrix.toArray(uniformData, 0);
    
    // View matrix (16 floats)
    viewMatrix.toArray(uniformData, 16);
    
    // Projection matrix (16 floats)
    projectionMatrix.toArray(uniformData, 32);
    
    // Normal matrix (9 floats, padded to 12)
    normalMatrix.toArray(uniformData, 48);
    
    const buffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    
    new Float32Array(buffer.getMappedRange()).set(uniformData);
    buffer.unmap();
    
    return buffer;
  }

  // Fallback methods for compatibility
  renderShadowMap(light: THREE.Light, entities: Entity[]): void {
    // WebGPU shadow mapping implementation would go here
    console.warn('WebGPU shadow mapping not yet implemented');
  }

  clear(): void {
    // Clear is handled in the render pass setup
  }

  present(): void {
    // Present is handled automatically by WebGPU
  }

  updateSettings(settings: RenderSettings): void {
    this.settings = settings;
    // Update pipeline if needed based on new settings
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  setSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Recreate depth texture
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    this.createDepthTexture();
  }

  getDrawCalls(): number {
    return this.drawCalls;
  }

  getTriangles(): number {
    return this.triangles;
  }

  destroy(): void {
    console.log('Destroying WebGPU renderer...');
    
    // Destroy all buffers
    for (const [, buffer] of this.buffers) {
      buffer.destroy();
    }
    this.buffers.clear();
    
    // Destroy all textures
    for (const [, texture] of this.textures) {
      texture.destroy();
    }
    this.textures.clear();
    
    // Destroy depth texture
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    
    // Clear caches
    this.pipelineCache.clear();
    this.samplers.clear();
    this.bindGroups.clear();
    
    // Destroy device
    if (this.device) {
      this.device.destroy();
    }
    
    console.log('WebGPU renderer destroyed');
  }
}