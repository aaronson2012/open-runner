import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { audioManager } from '../utils/audioManager';
import * as THREE from 'three';

interface Coin {
  id: string;
  position: THREE.Vector3;
  collected: boolean;
}

interface Powerup {
  id: string;
  type: 'magnet' | 'doubler' | 'invisibility';
  position: THREE.Vector3;
  collected: boolean;
}

const Collectibles: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { 
    player, 
    addScore, 
    gameState, 
    currentLevel, 
    activatePowerup,
    setPlayerPowerup,
    setScoreMultiplier
  } = useGameStore();
  const coinsRef = useRef<Coin[]>([]);
  const coinMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const powerupsRef = useRef<Powerup[]>([]);
  const powerupMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  
  // Coin geometry and material
  const coinGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.2, 8), []);
  const coinMaterial = useMemo(() => new THREE.MeshLambertMaterial({ 
    color: 0xffd700,
    emissive: 0x443300,
    emissiveIntensity: 0.2
  }), []);
  
  // Powerup materials
  const powerupMaterials = useMemo(() => ({
    magnet: new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0x440000 }),
    doubler: new THREE.MeshLambertMaterial({ color: 0x0000ff, emissive: 0x000044 }),
    invisibility: new THREE.MeshLambertMaterial({ 
      color: 0x800080, 
      emissive: 0x440044,
      transparent: true,
      opacity: 0.8 
    })
  }), []);
  
  // Generate coins around player
  useEffect(() => {
    if (!player.position) return;
    
    const playerZ = player.position.z;
    const generationDistance = 200;
    const coinSpacing = 30;
    const coinsPerRow = 3;
    
    // Remove old coins that are far behind
    coinsRef.current = coinsRef.current.filter(coin => {
      if (coin.position.z < playerZ - 100) {
        const mesh = coinMeshes.current.get(coin.id);
        if (mesh && groupRef.current) {
          groupRef.current.remove(mesh);
          coinMeshes.current.delete(coin.id);
        }
        return false;
      }
      return true;
    });
    
    // Generate new coins ahead of player
    for (let z = playerZ; z < playerZ + generationDistance; z += coinSpacing) {
      // Check if we already have coins at this Z position
      const existingCoin = coinsRef.current.find(coin => 
        Math.abs(coin.position.z - z) < coinSpacing / 2
      );
      
      if (!existingCoin) {
        // Generate coins in a row
        for (let i = 0; i < coinsPerRow; i++) {
          const x = (i - 1) * 15; // Spread coins across the path
          const coinId = `coin_${z}_${i}`;
          
          const coin: Coin = {
            id: coinId,
            position: new THREE.Vector3(x, 2, z),
            collected: false
          };
          
          coinsRef.current.push(coin);
          
          // Create mesh
          const mesh = new THREE.Mesh(coinGeometry, coinMaterial);
          mesh.position.copy(coin.position);
          mesh.castShadow = true;
          coinMeshes.current.set(coinId, mesh);
          
          if (groupRef.current) {
            groupRef.current.add(mesh);
          }
        }
      }
    }
    
    // Generate powerups occasionally
    if (Math.random() < 0.1) { // 10% chance every generation cycle
      const powerupZ = playerZ + generationDistance / 2;
      const existingPowerup = powerupsRef.current.find(powerup => 
        Math.abs(powerup.position.z - powerupZ) < 50
      );
      
      if (!existingPowerup) {
        const powerupTypes: ('magnet' | 'doubler' | 'invisibility')[] = ['magnet', 'doubler', 'invisibility'];
        const powerupType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        const powerupId = `powerup_${powerupZ}_${powerupType}`;
        
        const powerup: Powerup = {
          id: powerupId,
          type: powerupType,
          position: new THREE.Vector3(0, 3, powerupZ),
          collected: false
        };
        
        powerupsRef.current.push(powerup);
        
        // Create mesh based on type
        let geometry: THREE.BufferGeometry;
        switch (powerupType) {
          case 'magnet':
            geometry = new THREE.TorusGeometry(1, 0.3, 8, 16);
            break;
          case 'doubler':
            geometry = new THREE.OctahedronGeometry(1.2);
            break;
          case 'invisibility':
            geometry = new THREE.SphereGeometry(1.2, 16, 12);
            break;
        }
        
        const mesh = new THREE.Mesh(geometry, powerupMaterials[powerupType]);
        mesh.position.copy(powerup.position);
        mesh.castShadow = true;
        powerupMeshes.current.set(powerupId, mesh);
        
        if (groupRef.current) {
          groupRef.current.add(mesh);
        }
      }
    }
  }, [player.position.z, coinGeometry, coinMaterial, powerupMaterials]);
  
  useFrame((state, delta) => {
    if (!player.position) return;
    
    // Rotate coins and powerups
    coinMeshes.current.forEach((mesh) => {
      mesh.rotation.y += delta * 2;
    });
    
    powerupMeshes.current.forEach((mesh) => {
      mesh.rotation.y += delta * 1.5;
      mesh.rotation.x += delta * 1;
    });
    
    // Check for coin collection
    coinsRef.current.forEach(coin => {
      if (coin.collected) return;
      
      const distance = coin.position.distanceTo(player.position);
      if (distance < 3) {
        // Collect coin
        coin.collected = true;
        addScore(GAME_CONFIG.gameplay.coinValue);
        audioManager.playSound('coinsound', 0.7);
        
        // Remove mesh
        const mesh = coinMeshes.current.get(coin.id);
        if (mesh && groupRef.current) {
          groupRef.current.remove(mesh);
          coinMeshes.current.delete(coin.id);
        }
      }
    });
    
    // Check for powerup collection
    powerupsRef.current.forEach(powerup => {
      if (powerup.collected) return;
      
      const distance = powerup.position.distanceTo(player.position);
      if (distance < 4) {
        // Collect powerup
        powerup.collected = true;
        audioManager.playSound('powerupsound', 0.8);
        
        // Activate powerup effect
        activatePowerup(powerup.type, GAME_CONFIG.gameplay.powerupDuration);
        setPlayerPowerup(powerup.type);
        
        if (powerup.type === 'doubler') {
          setScoreMultiplier(GAME_CONFIG.gameplay.scoreDoubler);
        }
        
        // Remove mesh
        const mesh = powerupMeshes.current.get(powerup.id);
        if (mesh && groupRef.current) {
          groupRef.current.remove(mesh);
          powerupMeshes.current.delete(powerup.id);
        }
      }
    });
  });
  
  return <group ref={groupRef} />;
};

export default Collectibles;