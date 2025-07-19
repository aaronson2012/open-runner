import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameState } from '../types/game';
import { audioManager } from '../utils/audioManager';
import * as THREE from 'three';

// Simple player model builder (recreating the original blocky style)
const createPlayerModel = (): THREE.Group => {
  const player = new THREE.Group();
  
  // Materials
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
  
  // Body (main torso)
  const bodyGeometry = new THREE.BoxGeometry(1.2, 1.6, 0.8);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.8;
  player.add(body);
  
  // Head
  const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.y = 2.0;
  player.add(head);
  
  // Arms
  const armGeometry = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  
  const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
  leftArm.position.set(-0.75, 0.8, 0);
  leftArm.userData = { type: 'leftArm' };
  player.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
  rightArm.position.set(0.75, 0.8, 0);
  rightArm.userData = { type: 'rightArm' };
  player.add(rightArm);
  
  // Legs
  const legGeometry = new THREE.BoxGeometry(0.4, 1.4, 0.4);
  
  const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  leftLeg.position.set(-0.3, -0.7, 0);
  leftLeg.userData = { type: 'leftLeg' };
  player.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  rightLeg.position.set(0.3, -0.7, 0);
  rightLeg.userData = { type: 'rightLeg' };
  player.add(rightLeg);
  
  // Enable shadows
  player.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return player;
};

const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { 
    gameState, 
    player, 
    updatePlayerPosition, 
    updatePlayerSpeed,
    updatePlayerAnimationTime,
    powerup
  } = useGameStore();
  
  const keysPressed = useRef<Set<string>>(new Set());
  const animationTime = useRef(0);
  
  useEffect(() => {
    // Create player model
    if (groupRef.current && !groupRef.current.children.length) {
      const playerModel = createPlayerModel();
      groupRef.current.add(playerModel);
      
      // Set initial position
      groupRef.current.position.copy(player.position);
    }
    
    // Keyboard event listeners
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current.add(event.key.toLowerCase());
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current.delete(event.key.toLowerCase());
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [player.position]);
  
  useFrame((state, delta) => {
    if (!groupRef.current || gameState !== GameState.PLAYING) return;
    
    const group = groupRef.current;
    const config = GAME_CONFIG;
    
    // Handle input
    let turnDirection = 0;
    if (keysPressed.current.has(config.controls.keyTurnLeft) || 
        keysPressed.current.has('arrowleft')) {
      turnDirection = -1;
      audioManager.playSound('turnsound', 0.3);
    }
    if (keysPressed.current.has(config.controls.keyTurnRight) || 
        keysPressed.current.has('arrowright')) {
      turnDirection = 1;
      audioManager.playSound('turnsound', 0.3);
    }
    
    // Update position
    const currentSpeed = player.speed + (player.animationTime * config.player.speedIncreaseRate);
    const turnSpeed = config.controls.turnSpeed;
    
    // Move forward
    group.position.z += currentSpeed * delta;
    
    // Turn left/right
    if (turnDirection !== 0) {
      group.position.x += turnDirection * turnSpeed * delta;
    }
    
    // Constrain to reasonable bounds
    group.position.x = Math.max(-100, Math.min(100, group.position.x));
    
    // Update animation time
    animationTime.current += delta;
    updatePlayerAnimationTime(animationTime.current);
    
    // Animate player parts (running animation)
    const runningSpeed = 8; // How fast the running animation plays
    const armSwing = Math.sin(animationTime.current * runningSpeed) * 0.5;
    const legSwing = Math.sin(animationTime.current * runningSpeed + Math.PI) * 0.3;
    
    // Find player parts and animate them
    group.traverse((child) => {
      if (child.userData.type === 'leftArm') {
        child.rotation.x = armSwing;
      } else if (child.userData.type === 'rightArm') {
        child.rotation.x = -armSwing;
      } else if (child.userData.type === 'leftLeg') {
        child.rotation.x = legSwing;
      } else if (child.userData.type === 'rightLeg') {
        child.rotation.x = -legSwing;
      }
    });
    
    // Apply powerup visual effects
    if (powerup) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          switch (powerup.type) {
            case 'magnet':
              (child.material as THREE.MeshLambertMaterial).color.setHex(0xff0000);
              break;
            case 'doubler':
              (child.material as THREE.MeshLambertMaterial).color.setHex(0x0000ff);
              break;
            case 'invisibility':
              (child.material as THREE.MeshLambertMaterial).color.setHex(0x800080);
              child.material.transparent = true;
              child.material.opacity = 0.5;
              break;
          }
        }
      });
    } else {
      // Reset to normal color
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshLambertMaterial).color.setHex(0x808080);
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      });
    }
    
    // Update store
    updatePlayerPosition(group.position);
    updatePlayerSpeed(currentSpeed);
  });
  
  return (
    <group ref={groupRef} />
  );
};

export default Player;