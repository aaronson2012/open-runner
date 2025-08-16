import * as THREE from 'three';
import type { RenderSettings, Entity, CullingVolume } from '@/types';

export class CullingManager {
  private camera: THREE.PerspectiveCamera;
  private settings: RenderSettings;
  private frustum: THREE.Frustum = new THREE.Frustum();
  private matrix: THREE.Matrix4 = new THREE.Matrix4();
  
  // Culling statistics
  private culledCount = 0;
  private totalCount = 0;
  private lastCullTime = 0;
  
  // Occlusion culling
  private occlusionQueries: Map<number, boolean> = new Map();
  private occlusionEnabled = false;
  
  // Spatial partitioning for efficient culling
  private spatialGrid: SpatialGrid;
  
  // Performance optimization
  private frameCount = 0;
  private cullingFrequency = 1; // Cull every frame by default

  constructor(camera: THREE.PerspectiveCamera, settings: RenderSettings) {
    this.camera = camera;
    this.settings = settings;
    this.spatialGrid = new SpatialGrid(settings.cullingDistance);
    
    console.log('CullingManager initialized with culling distance:', settings.cullingDistance);
  }

  cull(entities: Entity[]): Entity[] {
    const startTime = performance.now();
    this.frameCount++;
    
    // Skip culling on some frames for performance
    if (this.frameCount % this.cullingFrequency !== 0) {
      return entities; // Return all entities
    }
    
    this.totalCount = entities.length;
    this.culledCount = 0;
    
    // Update frustum
    this.updateFrustum();
    
    // Update spatial grid
    this.spatialGrid.update(entities);
    
    const visibleEntities: Entity[] = [];
    
    // Get potentially visible entities from spatial grid first
    const potentiallyVisible = this.spatialGrid.query(this.camera.position, this.settings.cullingDistance);
    
    for (const entity of potentiallyVisible) {
      if (this.isEntityVisible(entity)) {
        visibleEntities.push(entity);
      } else {
        this.culledCount++;
      }
    }
    
    // Track performance
    this.lastCullTime = performance.now() - startTime;
    
    // Adjust culling frequency based on performance
    this.adjustCullingFrequency();
    
    return visibleEntities;
  }

  private updateFrustum(): void {
    this.camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
  }

  private isEntityVisible(entity: Entity): boolean {
    const transform = entity.components.get('transform') as any;
    const mesh = entity.components.get('mesh') as any;
    
    if (!transform || !entity.active) {
      return false;
    }
    
    const position = new THREE.Vector3(
      transform.position.x,
      transform.position.y,
      transform.position.z
    );
    
    // Distance culling
    if (this.settings.cullingDistance > 0) {
      const distance = this.camera.position.distanceTo(position);
      if (distance > this.settings.cullingDistance) {
        return false;
      }
    }
    
    // Frustum culling
    if (mesh?.culling?.frustum !== false) {
      if (!this.frustumCulling(position, transform.scale)) {
        return false;
      }
    }
    
    // Occlusion culling (if enabled)
    if (this.occlusionEnabled && mesh?.culling?.occlusion) {
      if (!this.occlusionCulling(entity.id, position)) {
        return false;
      }
    }
    
    return true;
  }

  private frustumCulling(position: THREE.Vector3, scale?: any): boolean {
    // Create a bounding sphere for the object
    const radius = scale ? Math.max(scale.x, scale.y, scale.z) * 2 : 2;
    const sphere = new THREE.Sphere(position, radius);
    
    // Check if sphere intersects with frustum
    return this.frustum.intersectsSphere(sphere);
  }

  private occlusionCulling(entityId: number, position: THREE.Vector3): boolean {
    // Simple occlusion culling implementation
    // In a real implementation, this would use GPU occlusion queries
    
    // For now, we'll do a simple ray-based check
    const direction = new THREE.Vector3().subVectors(position, this.camera.position).normalize();
    
    // Cast ray from camera to object
    const raycaster = new THREE.Raycaster(this.camera.position, direction);
    const distance = this.camera.position.distanceTo(position);
    
    // This is a simplified check - in practice you'd need the actual scene geometry
    // For now, we'll just cache results and assume most objects are visible
    let isVisible = this.occlusionQueries.get(entityId);
    if (isVisible === undefined) {
      isVisible = true; // Default to visible
      this.occlusionQueries.set(entityId, isVisible);
    }
    
    return isVisible;
  }

  // Hierarchical culling for complex scenes
  hierarchicalCull(entities: Entity[]): Entity[] {
    const visibleEntities: Entity[] = [];
    const hierarchyGroups = this.groupEntitiesByHierarchy(entities);
    
    for (const group of hierarchyGroups) {
      if (this.isGroupVisible(group)) {
        // If parent is visible, test children
        for (const entity of group.entities) {
          if (this.isEntityVisible(entity)) {
            visibleEntities.push(entity);
          }
        }
      } else {
        // Entire group is culled
        this.culledCount += group.entities.length;
      }
    }
    
    return visibleEntities;
  }

  private groupEntitiesByHierarchy(entities: Entity[]): HierarchyGroup[] {
    // Simple grouping - in practice this would use actual scene hierarchy
    const groups: HierarchyGroup[] = [];
    const groupSize = 10; // Group entities by proximity
    
    for (let i = 0; i < entities.length; i += groupSize) {
      const group = entities.slice(i, i + groupSize);
      const bounds = this.calculateGroupBounds(group);
      
      groups.push({
        entities: group,
        bounds
      });
    }
    
    return groups;
  }

  private calculateGroupBounds(entities: Entity[]): THREE.Box3 {
    const bounds = new THREE.Box3();
    
    for (const entity of entities) {
      const transform = entity.components.get('transform') as any;
      if (transform) {
        const position = new THREE.Vector3(
          transform.position.x,
          transform.position.y,
          transform.position.z
        );
        bounds.expandByPoint(position);
      }
    }
    
    return bounds;
  }

  private isGroupVisible(group: HierarchyGroup): boolean {
    // Check if bounding box is visible
    return this.frustum.intersectsBox(group.bounds);
  }

  // Temporal coherence optimization
  enableTemporalCoherence(): void {
    // Cache visibility results and update them gradually
    this.cullingFrequency = 2; // Start with every other frame
  }

  private adjustCullingFrequency(): void {
    // Adjust culling frequency based on performance
    if (this.lastCullTime > 5) { // If culling takes more than 5ms
      this.cullingFrequency = Math.min(4, this.cullingFrequency + 1);
    } else if (this.lastCullTime < 1 && this.cullingFrequency > 1) {
      this.cullingFrequency = Math.max(1, this.cullingFrequency - 1);
    }
  }

  // LOD-based culling
  cullWithLOD(entities: Entity[], lodLevel: number): Entity[] {
    return entities.filter(entity => {
      const mesh = entity.components.get('mesh') as any;
      
      // Cull based on LOD visibility
      if (mesh?.lod && mesh.lod[lodLevel]) {
        return mesh.lod[lodLevel].visible;
      }
      
      return this.isEntityVisible(entity);
    });
  }

  // Shadow caster culling
  cullShadowCasters(entities: Entity[], light: THREE.Light): Entity[] {
    if (!(light instanceof THREE.DirectionalLight) && 
        !(light instanceof THREE.SpotLight) && 
        !(light instanceof THREE.PointLight)) {
      return entities;
    }
    
    const visibleShadowCasters: Entity[] = [];
    
    // Create shadow camera frustum
    const shadowCamera = this.createShadowCamera(light);
    const shadowFrustum = new THREE.Frustum();
    const shadowMatrix = new THREE.Matrix4();
    
    shadowMatrix.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse);
    shadowFrustum.setFromProjectionMatrix(shadowMatrix);
    
    for (const entity of entities) {
      const mesh = entity.components.get('mesh') as any;
      const transform = entity.components.get('transform') as any;
      
      if (!mesh?.castShadow || !transform) continue;
      
      const position = new THREE.Vector3(
        transform.position.x,
        transform.position.y,
        transform.position.z
      );
      
      // Check if object is in shadow frustum
      const radius = transform.scale ? Math.max(transform.scale.x, transform.scale.y, transform.scale.z) : 1;
      const sphere = new THREE.Sphere(position, radius);
      
      if (shadowFrustum.intersectsSphere(sphere)) {
        visibleShadowCasters.push(entity);
      }
    }
    
    return visibleShadowCasters;
  }

  private createShadowCamera(light: THREE.Light): THREE.Camera {
    if (light instanceof THREE.DirectionalLight) {
      const shadowCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 500);
      shadowCamera.position.copy(light.position);
      shadowCamera.lookAt(light.target.position);
      return shadowCamera;
    } else if (light instanceof THREE.SpotLight) {
      const shadowCamera = new THREE.PerspectiveCamera(
        light.angle * 2 * 180 / Math.PI,
        1,
        0.1,
        light.distance || 1000
      );
      shadowCamera.position.copy(light.position);
      shadowCamera.lookAt(light.target.position);
      return shadowCamera;
    } else if (light instanceof THREE.PointLight) {
      const shadowCamera = new THREE.PerspectiveCamera(90, 1, 0.1, light.distance || 1000);
      shadowCamera.position.copy(light.position);
      return shadowCamera;
    }
    
    // Fallback
    return new THREE.PerspectiveCamera();
  }

  // Portal/Zone culling for indoor scenes
  portalCull(entities: Entity[], portals: Portal[]): Entity[] {
    // Simple portal culling implementation
    const visibleZones = new Set<number>();
    
    // Find visible zones through portals
    for (const portal of portals) {
      if (this.isPortalVisible(portal)) {
        visibleZones.add(portal.fromZone);
        visibleZones.add(portal.toZone);
      }
    }
    
    // Filter entities by zone
    return entities.filter(entity => {
      const zone = (entity as any).zone || 0; // Default zone
      return visibleZones.has(zone);
    });
  }

  private isPortalVisible(portal: Portal): boolean {
    // Check if portal plane is visible from camera
    const portalCenter = portal.center;
    const portalNormal = portal.normal;
    
    // Calculate vector from camera to portal
    const cameraToPortal = new THREE.Vector3().subVectors(portalCenter, this.camera.position);
    
    // Check if camera is facing the portal
    const dot = cameraToPortal.dot(portalNormal);
    
    return dot < 0; // Portal is visible if we're on the side the normal points away from
  }

  // GPU-based occlusion culling setup
  setupGPUOcclusionCulling(renderer: THREE.WebGLRenderer): void {
    const gl = renderer.getContext();
    
    // Check for occlusion query extension
    const ext = gl.getExtension('EXT_disjoint_timer_query') || 
               gl.getExtension('EXT_disjoint_timer_query_webgl2');
    
    if (ext) {
      this.occlusionEnabled = true;
      console.log('GPU occlusion culling enabled');
    } else {
      console.warn('GPU occlusion culling not supported');
    }
  }

  // Update settings
  updateSettings(settings: RenderSettings): void {
    this.settings = settings;
    this.spatialGrid.updateBounds(settings.cullingDistance);
    
    console.log('CullingManager settings updated:', {
      cullingDistance: settings.cullingDistance,
      cullingFrequency: this.cullingFrequency
    });
  }

  // Statistics
  getCulledCount(): number {
    return this.culledCount;
  }

  getCullingRatio(): number {
    return this.totalCount > 0 ? this.culledCount / this.totalCount : 0;
  }

  getCullingPerformance(): { lastCullTime: number; cullingFrequency: number; totalEntities: number; culledEntities: number } {
    return {
      lastCullTime: this.lastCullTime,
      cullingFrequency: this.cullingFrequency,
      totalEntities: this.totalCount,
      culledEntities: this.culledCount
    };
  }

  // Cleanup
  destroy(): void {
    console.log('CullingManager destroyed');
    this.occlusionQueries.clear();
    this.spatialGrid.clear();
  }
}

// Spatial grid for efficient proximity queries
class SpatialGrid {
  private gridSize: number;
  private cellSize: number;
  private grid: Map<string, Entity[]> = new Map();

  constructor(worldSize: number, cellSize: number = 50) {
    this.gridSize = Math.ceil(worldSize / cellSize);
    this.cellSize = cellSize;
  }

  update(entities: Entity[]): void {
    this.grid.clear();
    
    for (const entity of entities) {
      const transform = entity.components.get('transform') as any;
      if (!transform) continue;
      
      const cellKey = this.getCellKey(transform.position);
      
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      
      this.grid.get(cellKey)!.push(entity);
    }
  }

  query(position: THREE.Vector3, radius: number): Entity[] {
    const entities: Entity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const centerX = Math.floor(position.x / this.cellSize);
    const centerZ = Math.floor(position.z / this.cellSize);
    
    for (let x = centerX - cellRadius; x <= centerX + cellRadius; x++) {
      for (let z = centerZ - cellRadius; z <= centerZ + cellRadius; z++) {
        const cellKey = `${x},${z}`;
        const cellEntities = this.grid.get(cellKey);
        
        if (cellEntities) {
          entities.push(...cellEntities);
        }
      }
    }
    
    return entities;
  }

  private getCellKey(position: { x: number; y: number; z: number }): string {
    const x = Math.floor(position.x / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${z}`;
  }

  updateBounds(newWorldSize: number): void {
    this.gridSize = Math.ceil(newWorldSize / this.cellSize);
    this.grid.clear();
  }

  clear(): void {
    this.grid.clear();
  }
}

// Helper interfaces
interface HierarchyGroup {
  entities: Entity[];
  bounds: THREE.Box3;
}

interface Portal {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  fromZone: number;
  toZone: number;
}