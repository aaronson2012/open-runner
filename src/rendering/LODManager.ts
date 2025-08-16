import * as THREE from 'three';
import type { RenderCapabilities, RenderSettings, LODLevel, Entity, Vector3 } from '@/types';

export class LODManager {
  private capabilities: RenderCapabilities;
  private settings: RenderSettings;
  private lodGroups: Map<number, LODGroup> = new Map(); // entityId -> LODGroup
  private camera?: THREE.Camera;
  
  // LOD distance multipliers based on quality
  private readonly LOD_DISTANCE_MULTIPLIERS = {
    low: 0.5,
    medium: 0.75,
    high: 1.0,
    ultra: 1.25
  };
  
  // Performance tracking
  private activeLODCount = 0;
  private framesSinceUpdate = 0;
  private updateFrequency = 4; // Update LODs every 4 frames for performance

  constructor(capabilities: RenderCapabilities) {
    this.capabilities = capabilities;
    this.settings = {
      shadowMapSize: 1024,
      enableShadows: true,
      enableSSAO: false,
      enableAntialiasing: true,
      enableTextureLOD: true,
      enableInstancing: true,
      cullingDistance: 200,
      lodLevels: 3,
      textureQuality: 'medium',
      shaderPrecision: 'mediump'
    };
    
    console.log('LODManager initialized');
  }

  update(cameraPosition: Vector3, entities: Entity[]): void {
    this.framesSinceUpdate++;
    
    // Only update LODs periodically for performance
    if (this.framesSinceUpdate < this.updateFrequency) {
      return;
    }
    
    this.framesSinceUpdate = 0;
    this.activeLODCount = 0;
    
    // Update LOD for each entity
    for (const entity of entities) {
      const mesh = entity.components.get('mesh') as any;
      const transform = entity.components.get('transform') as any;
      
      if (mesh?.lod && transform) {
        this.updateEntityLOD(entity.id, null, mesh.lod, cameraPosition, transform.position);
      }
    }
  }

  updateEntityLOD(
    entityId: number, 
    object3D: THREE.Object3D | null,
    lodLevels: LODLevel[],
    cameraPosition?: Vector3,
    entityPosition?: Vector3
  ): void {
    if (!cameraPosition || !entityPosition) {
      // Use stored camera if available
      if (this.camera && this.camera.position) {
        cameraPosition = {
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z
        };
      } else {
        return; // Can't calculate LOD without camera position
      }
    }
    
    // Calculate distance to camera
    const distance = this.calculateDistance(cameraPosition, entityPosition);
    
    // Get or create LOD group
    let lodGroup = this.lodGroups.get(entityId);
    if (!lodGroup) {
      lodGroup = new LODGroup(entityId, lodLevels);
      this.lodGroups.set(entityId, lodGroup);
    }
    
    // Update LOD based on distance
    const currentLOD = this.selectLOD(distance, lodLevels);
    lodGroup.setCurrentLOD(currentLOD);
    
    // Apply LOD to Three.js object if provided
    if (object3D) {
      this.applyLODToObject(object3D, currentLOD, lodLevels);
    }
    
    this.activeLODCount++;
  }

  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private selectLOD(distance: number, lodLevels: LODLevel[]): number {
    if (!lodLevels || lodLevels.length === 0) return 0;
    
    // Apply quality-based distance multiplier
    const qualityMultiplier = this.LOD_DISTANCE_MULTIPLIERS.medium; // Default to medium
    const adjustedDistance = distance / qualityMultiplier;
    
    // Find appropriate LOD level
    for (let i = 0; i < lodLevels.length; i++) {
      if (adjustedDistance <= lodLevels[i].distance) {
        return i;
      }
    }
    
    // If distance exceeds all LOD levels, use the lowest detail level
    return lodLevels.length - 1;
  }

  private applyLODToObject(object3D: THREE.Object3D, lodLevel: number, lodLevels: LODLevel[]): void {
    if (!lodLevels || lodLevel >= lodLevels.length) return;
    
    const lod = lodLevels[lodLevel];
    
    // Handle visibility
    object3D.visible = lod.visible;
    
    if (!lod.visible) return;
    
    // Apply geometry LOD if it's a mesh
    if (object3D instanceof THREE.Mesh) {
      this.applyGeometryLOD(object3D, lod);
      this.applyMaterialLOD(object3D, lod);
    }
    
    // Handle LOD for children
    if (object3D instanceof THREE.LOD) {
      this.applyThreeJSLOD(object3D, lodLevel);
    }
  }

  private applyGeometryLOD(mesh: THREE.Mesh, lod: LODLevel): void {
    // This would typically involve swapping geometries
    // For now, we'll adjust the geometry complexity through material properties
    
    if (mesh.material instanceof THREE.Material) {
      // Adjust wireframe for debugging
      if (lod.geometry.includes('low')) {
        mesh.material.wireframe = false; // Could show wireframe for low LOD
      }
    }
    
    // Scale mesh slightly based on LOD to simulate detail reduction
    const scale = lod.geometry.includes('high') ? 1.0 : 
                  lod.geometry.includes('medium') ? 0.98 :
                  lod.geometry.includes('low') ? 0.95 : 1.0;
    
    mesh.scale.setScalar(scale);
  }

  private applyMaterialLOD(mesh: THREE.Mesh, lod: LODLevel): void {
    if (!mesh.material) return;
    
    const material = mesh.material;
    
    // Adjust material properties based on LOD
    if (material instanceof THREE.MeshStandardMaterial || 
        material instanceof THREE.MeshPhysicalMaterial) {
      
      // Texture LOD
      if (lod.material.includes('low')) {
        // Use lower resolution textures
        this.applyTextureLOD(material, 0.25);
      } else if (lod.material.includes('medium')) {
        this.applyTextureLOD(material, 0.5);
      } else {
        this.applyTextureLOD(material, 1.0);
      }
      
      // Shader complexity LOD
      if (lod.material.includes('simple')) {
        material.roughness = 0.5; // Simplified roughness
        material.metalness = 0.0; // Disable metallic workflow for performance
      }
    }
  }

  private applyTextureLOD(material: THREE.Material, lodScale: number): void {
    if (!this.settings.enableTextureLOD) return;
    
    // This would involve managing texture mipmaps or swapping textures
    // For now, we'll adjust texture filtering
    
    const applyToTexture = (texture: THREE.Texture | null) => {
      if (!texture) return;
      
      if (lodScale < 0.5) {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
      } else {
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
      }
      
      texture.needsUpdate = true;
    };
    
    // Apply to all texture properties
    const materialAny = material as any;
    applyToTexture(materialAny.map);
    applyToTexture(materialAny.normalMap);
    applyToTexture(materialAny.roughnessMap);
    applyToTexture(materialAny.metalnessMap);
    applyToTexture(materialAny.emissiveMap);
    applyToTexture(materialAny.bumpMap);
    applyToTexture(materialAny.displacementMap);
  }

  private applyThreeJSLOD(lodObject: THREE.LOD, targetLevel: number): void {
    // Handle Three.js built-in LOD objects
    for (let i = 0; i < lodObject.levels.length; i++) {
      const level = lodObject.levels[i];
      level.object.visible = i === targetLevel;
    }
  }

  // Create LOD levels for common scenarios
  createTerrainLOD(baseDistance: number = 50): LODLevel[] {
    return [
      {
        distance: baseDistance,
        geometry: 'terrain_high',
        material: 'terrain_detailed',
        visible: true
      },
      {
        distance: baseDistance * 2,
        geometry: 'terrain_medium',
        material: 'terrain_medium',
        visible: true
      },
      {
        distance: baseDistance * 4,
        geometry: 'terrain_low',
        material: 'terrain_simple',
        visible: true
      },
      {
        distance: baseDistance * 8,
        geometry: 'terrain_minimal',
        material: 'terrain_minimal',
        visible: false
      }
    ];
  }

  createVegetationLOD(baseDistance: number = 30): LODLevel[] {
    return [
      {
        distance: baseDistance,
        geometry: 'vegetation_full',
        material: 'vegetation_detailed',
        visible: true
      },
      {
        distance: baseDistance * 1.5,
        geometry: 'vegetation_billboard',
        material: 'vegetation_simple',
        visible: true
      },
      {
        distance: baseDistance * 3,
        geometry: 'vegetation_impostor',
        material: 'vegetation_impostor',
        visible: true
      },
      {
        distance: baseDistance * 6,
        geometry: 'vegetation_hidden',
        material: 'vegetation_hidden',
        visible: false
      }
    ];
  }

  createCharacterLOD(baseDistance: number = 25): LODLevel[] {
    return [
      {
        distance: baseDistance,
        geometry: 'character_high',
        material: 'character_detailed',
        visible: true
      },
      {
        distance: baseDistance * 2,
        geometry: 'character_medium',
        material: 'character_medium',
        visible: true
      },
      {
        distance: baseDistance * 4,
        geometry: 'character_low',
        material: 'character_simple',
        visible: true
      },
      {
        distance: baseDistance * 8,
        geometry: 'character_impostor',
        material: 'character_impostor',
        visible: false
      }
    ];
  }

  // Batch LOD updates for performance
  batchUpdateLODs(entities: Entity[], cameraPosition: Vector3): void {
    const startTime = performance.now();
    
    // Sort entities by distance for better cache coherency
    const entitiesWithDistance = entities
      .map(entity => {
        const transform = entity.components.get('transform') as any;
        const distance = transform ? 
          this.calculateDistance(cameraPosition, transform.position) : 
          Infinity;
        return { entity, distance };
      })
      .sort((a, b) => a.distance - b.distance);
    
    // Update LODs in batches to avoid frame drops
    const batchSize = 20;
    let processed = 0;
    
    for (const { entity, distance } of entitiesWithDistance) {
      const mesh = entity.components.get('mesh') as any;
      const transform = entity.components.get('transform') as any;
      
      if (mesh?.lod && transform) {
        this.updateEntityLOD(entity.id, null, mesh.lod, cameraPosition, transform.position);
        processed++;
        
        // Break if we've processed enough for this frame
        if (processed >= batchSize) {
          break;
        }
      }
    }
    
    const duration = performance.now() - startTime;
    if (duration > 2) { // Log if LOD update takes more than 2ms
      console.warn(`LOD batch update took ${duration.toFixed(2)}ms for ${processed} entities`);
    }
  }

  // Automatic LOD generation helpers
  generateAutomaticLOD(
    geometry: THREE.BufferGeometry,
    lodLevels: number = 3
  ): { geometry: THREE.BufferGeometry; distance: number }[] {
    const levels: { geometry: THREE.BufferGeometry; distance: number }[] = [];
    
    // Base level (full detail)
    levels.push({
      geometry: geometry.clone(),
      distance: 25
    });
    
    // Generate simplified levels
    for (let i = 1; i < lodLevels; i++) {
      const simplificationRatio = 1 - (i * 0.4); // 60%, 20% of original
      const simplifiedGeometry = this.simplifyGeometry(geometry, simplificationRatio);
      
      levels.push({
        geometry: simplifiedGeometry,
        distance: 25 * Math.pow(2, i)
      });
    }
    
    return levels;
  }

  private simplifyGeometry(geometry: THREE.BufferGeometry, ratio: number): THREE.BufferGeometry {
    // This is a simplified implementation
    // In practice, you'd use a mesh simplification algorithm
    
    const simplified = geometry.clone();
    
    if (simplified.index) {
      // Simplify by reducing indices
      const originalCount = simplified.index.count;
      const targetCount = Math.floor(originalCount * ratio);
      
      // Simple decimation - take every nth triangle
      const step = Math.max(1, Math.floor(originalCount / targetCount));
      const newIndices: number[] = [];
      
      for (let i = 0; i < originalCount; i += step * 3) {
        if (i + 2 < originalCount) {
          newIndices.push(
            simplified.index.array[i],
            simplified.index.array[i + 1],
            simplified.index.array[i + 2]
          );
        }
      }
      
      simplified.setIndex(newIndices);
    }
    
    return simplified;
  }

  // Settings management
  updateSettings(settings: RenderSettings): void {
    this.settings = settings;
    
    // Update LOD update frequency based on quality
    this.updateFrequency = settings.lodLevels <= 2 ? 2 : 
                          settings.lodLevels <= 3 ? 4 : 
                          settings.lodLevels <= 4 ? 6 : 8;
    
    console.log('LODManager settings updated:', {
      lodLevels: settings.lodLevels,
      updateFrequency: this.updateFrequency,
      enableTextureLOD: settings.enableTextureLOD
    });
  }

  // Metrics
  getActiveLODCount(): number {
    return this.activeLODCount;
  }

  getLODStatistics(): { totalLODGroups: number; averageLODLevel: number } {
    const totalGroups = this.lodGroups.size;
    let totalLODLevel = 0;
    
    for (const [, group] of this.lodGroups) {
      totalLODLevel += group.getCurrentLOD();
    }
    
    return {
      totalLODGroups: totalGroups,
      averageLODLevel: totalGroups > 0 ? totalLODLevel / totalGroups : 0
    };
  }

  // Cleanup
  destroy(): void {
    console.log('LODManager destroyed');
    this.lodGroups.clear();
    this.activeLODCount = 0;
  }

  // Remove entity LOD tracking
  removeEntity(entityId: number): void {
    this.lodGroups.delete(entityId);
  }

  // Set camera reference for automatic updates
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }
}

// Helper class for managing individual entity LOD
class LODGroup {
  private entityId: number;
  private lodLevels: LODLevel[];
  private currentLOD = 0;
  private lastUpdateTime = 0;

  constructor(entityId: number, lodLevels: LODLevel[]) {
    this.entityId = entityId;
    this.lodLevels = [...lodLevels]; // Copy array
  }

  setCurrentLOD(level: number): void {
    if (level !== this.currentLOD) {
      this.currentLOD = Math.max(0, Math.min(level, this.lodLevels.length - 1));
      this.lastUpdateTime = Date.now();
    }
  }

  getCurrentLOD(): number {
    return this.currentLOD;
  }

  getCurrentLODData(): LODLevel | null {
    if (this.currentLOD >= 0 && this.currentLOD < this.lodLevels.length) {
      return this.lodLevels[this.currentLOD];
    }
    return null;
  }

  getEntityId(): number {
    return this.entityId;
  }

  getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }
}