import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { LEVEL_CONFIGS, GAME_CONFIG } from '../config/gameConfig';
import { noise } from '../utils/noise';
import * as THREE from 'three';

const Terrain: React.FC = () => {
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const chunksRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const { player, currentLevel } = useGameStore();
  
  const levelConfig = LEVEL_CONFIGS[currentLevel];
  const chunkSize = GAME_CONFIG.world.chunkSize;
  const renderDistance = GAME_CONFIG.world.renderDistance;
  
  // Generate terrain geometry for a chunk
  const generateChunkGeometry = useMemo(() => {
    return (chunkX: number, chunkZ: number) => {
      const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, 32, 32);
      const vertices = geometry.attributes.position.array as Float32Array;
      
      // Apply noise to generate terrain height
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i] + chunkX * chunkSize;
        const z = vertices[i + 2] + chunkZ * chunkSize;
        
        const height = noise.noise2D(
          x * levelConfig.terrain.noiseFrequency,
          z * levelConfig.terrain.noiseFrequency
        ) * levelConfig.terrain.noiseAmplitude;
        
        vertices[i + 1] = height; // y coordinate
      }
      
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      
      return geometry;
    };
  }, [levelConfig, chunkSize]);
  
  const terrainMaterial = useMemo(() => {
    return new THREE.MeshLambertMaterial({ 
      color: levelConfig.terrain.color,
      side: THREE.DoubleSide
    });
  }, [levelConfig]);
  
  useFrame(() => {
    if (!player.position) return;
    
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    const renderChunks = Math.ceil(renderDistance / chunkSize);
    
    // Determine which chunks should be visible
    const neededChunks = new Set<string>();
    
    for (let x = playerChunkX - renderChunks; x <= playerChunkX + renderChunks; x++) {
      for (let z = playerChunkZ - renderChunks; z <= playerChunkZ + renderChunks; z++) {
        const distance = Math.sqrt(
          Math.pow((x - playerChunkX) * chunkSize, 2) + 
          Math.pow((z - playerChunkZ) * chunkSize, 2)
        );
        
        if (distance <= renderDistance) {
          neededChunks.add(`${x},${z}`);
        }
      }
    }
    
    // Remove chunks that are too far away
    for (const [key, mesh] of chunksRef.current) {
      if (!neededChunks.has(key)) {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        chunksRef.current.delete(key);
      }
    }
    
    // Add new chunks that are needed
    for (const chunkKey of neededChunks) {
      if (!chunksRef.current.has(chunkKey)) {
        const [x, z] = chunkKey.split(',').map(Number);
        
        const geometry = generateChunkGeometry(x, z);
        const mesh = new THREE.Mesh(geometry, terrainMaterial);
        
        mesh.position.set(
          x * chunkSize + chunkSize / 2,
          0,
          z * chunkSize + chunkSize / 2
        );
        mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        mesh.receiveShadow = true;
        
        // Add to scene (we need to find the scene from the parent)
        // This is a bit hacky but works for now
        if (meshRefs.current.length > 0 && meshRefs.current[0].parent) {
          meshRefs.current[0].parent.add(mesh);
        }
        
        chunksRef.current.set(chunkKey, mesh);
      }
    }
  });
  
  return (
    <group>
      {/* This invisible mesh helps us get a reference to the scene */}
      <mesh ref={(ref) => {
        if (ref && !meshRefs.current.includes(ref)) {
          meshRefs.current.push(ref);
        }
      }} visible={false}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
};

export default Terrain;