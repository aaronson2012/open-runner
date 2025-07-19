import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { GameState } from '../types/game';
import * as THREE from 'three';

const Camera: React.FC = () => {
  const { camera } = useThree();
  const { gameState, player } = useGameStore();
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  
  useFrame((state, delta) => {
    if (!camera || gameState !== GameState.PLAYING) return;
    
    // Camera follows player with offset
    const cameraOffset = new THREE.Vector3(0, 15, 20);
    const lookAtOffset = new THREE.Vector3(0, 0, -10);
    
    // Calculate target camera position
    targetPosition.current.copy(player.position);
    targetPosition.current.add(cameraOffset);
    
    // Calculate target look-at position
    targetLookAt.current.copy(player.position);
    targetLookAt.current.add(lookAtOffset);
    
    // Smooth camera movement
    const lerpFactor = 5.0 * delta;
    camera.position.lerp(targetPosition.current, lerpFactor);
    
    // Make camera look at target position
    const lookAtPosition = new THREE.Vector3();
    lookAtPosition.lerp(targetLookAt.current, lerpFactor);
    camera.lookAt(lookAtPosition);
    
    // Update camera matrix
    camera.updateMatrixWorld();
  });
  
  return null;
};

export default Camera;