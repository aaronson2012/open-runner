import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { LEVEL_CONFIGS } from '../config/gameConfig';
import { GameState } from '../types/game';
import { audioManager } from '../utils/audioManager';
import * as THREE from 'three';

interface Obstacle {
  id: string;
  type: string;
  position: THREE.Vector3;
  boundingBox: THREE.Box3;
}

const Obstacles: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { player, gameState, currentLevel, setGameState } = useGameStore();
  const obstaclesRef = useRef<Obstacle[]>([]);
  const obstacleMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  
  const levelConfig = LEVEL_CONFIGS[currentLevel];
  
  // Obstacle materials
  const materials = useMemo(() => {
    const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
    const cactusMaterial = new THREE.MeshLambertMaterial({ color: 0x006400 });
    const woodMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    
    return { treeMaterial, rockMaterial, cactusMaterial, woodMaterial };
  }, []);
  
  // Create obstacle geometry based on type
  const createObstacleGeometry = (type: string): THREE.BufferGeometry => {
    switch (type) {
      case 'pine_tree':
        return new THREE.ConeGeometry(2, 8, 8);
      case 'saguaro_cactus':
        return new THREE.CylinderGeometry(0.5, 0.5, 6, 8);
      case 'barrel_cactus':
        return new THREE.SphereGeometry(1.5, 8, 6);
      case 'rock':
      case 'desert_rock':
        return new THREE.SphereGeometry(1.5, 6, 4);
      case 'log':
        return new THREE.CylinderGeometry(0.5, 0.5, 4, 8);
      case 'cabin':
      case 'saloon':
        return new THREE.BoxGeometry(4, 3, 4);
      default:
        return new THREE.BoxGeometry(2, 2, 2);
    }
  };
  
  // Get material for obstacle type
  const getObstacleMaterial = (type: string): THREE.Material => {
    if (type.includes('tree')) return materials.treeMaterial;
    if (type.includes('cactus')) return materials.cactusMaterial;
    if (type.includes('rock')) return materials.rockMaterial;
    if (type.includes('log') || type.includes('cabin') || type.includes('saloon')) return materials.woodMaterial;
    return materials.rockMaterial;
  };
  
  // Generate obstacles around player
  useEffect(() => {
    if (!player.position || !levelConfig) return;
    
    const playerZ = player.position.z;
    const generationDistance = 300;
    const obstacleSpacing = 40;
    
    // Remove old obstacles that are far behind
    obstaclesRef.current = obstaclesRef.current.filter(obstacle => {
      if (obstacle.position.z < playerZ - 150) {
        const mesh = obstacleMeshes.current.get(obstacle.id);
        if (mesh && groupRef.current) {
          groupRef.current.remove(mesh);
          obstacleMeshes.current.delete(obstacle.id);
        }
        return false;
      }
      return true;
    });
    
    // Generate new obstacles ahead of player
    for (let z = playerZ + 50; z < playerZ + generationDistance; z += obstacleSpacing) {
      // Check if we already have obstacles at this Z position
      const existingObstacle = obstaclesRef.current.find(obstacle => 
        Math.abs(obstacle.position.z - z) < obstacleSpacing / 2
      );
      
      if (!existingObstacle && Math.random() < 0.7) { // 70% chance to spawn obstacle
        const obstacleTypes = levelConfig.obstacles;
        const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        
        // Random position along the path
        const x = (Math.random() - 0.5) * 60; // Spread obstacles across the path
        const obstacleId = `obstacle_${z}_${obstacleType}`;
        
        const geometry = createObstacleGeometry(obstacleType);
        const material = getObstacleMaterial(obstacleType);
        
        // Calculate bounding box
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!.clone();
        boundingBox.translate(new THREE.Vector3(x, 0, z));
        
        const obstacle: Obstacle = {
          id: obstacleId,
          type: obstacleType,
          position: new THREE.Vector3(x, 0, z),
          boundingBox
        };
        
        obstaclesRef.current.push(obstacle);
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(obstacle.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Adjust position based on obstacle type
        if (obstacleType.includes('tree') || obstacleType.includes('cactus')) {
          mesh.position.y = 0;
        } else if (obstacleType.includes('cabin') || obstacleType.includes('saloon')) {
          mesh.position.y = 1.5;
        }
        
        obstacleMeshes.current.set(obstacleId, mesh);
        
        if (groupRef.current) {
          groupRef.current.add(mesh);
        }
      }
    }
  }, [player.position.z, levelConfig, materials]);
  
  useFrame(() => {
    if (!player.position || gameState !== GameState.PLAYING) return;
    
    // Check for collisions
    const playerBoundingBox = new THREE.Box3().setFromCenterAndSize(
      player.position,
      new THREE.Vector3(2, 3, 2)
    );
    
    for (const obstacle of obstaclesRef.current) {
      if (playerBoundingBox.intersectsBox(obstacle.boundingBox)) {
        // Collision detected - game over
        audioManager.playSound('collisionsound', 1.0);
        audioManager.playSound('gameover', 0.8);
        setGameState(GameState.GAME_OVER);
        break;
      }
    }
  });
  
  return <group ref={groupRef} />;
};

export default Obstacles;