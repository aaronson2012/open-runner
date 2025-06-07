// js/rendering/models/itemModels.js
import * as THREE from 'three';
import { createLogger } from '../../utils/logger.js';
import { modelsConfig as C_MODELS } from '../../config/models.js';
import { getGeometry, getMaterial } from '../../managers/assetManager.js';

const logger = createLogger('ItemModels');

/**
 * Creates a procedural Magnet powerup model.
 * @param {object} [properties] - Optional properties (e.g., size, color).
 * @returns {THREE.Group} The magnet model group.
 */
export function createMagnetModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.MAGNET;
    const size = properties?.size || config.DEFAULT_SIZE;
    const color = properties?.color || config.DEFAULT_COLOR;
    const magnetMat = getMaterial(`magnet-mat-${color}`, () => new THREE.MeshStandardMaterial({ color: color, emissive: config.MAGNET_EMISSIVE, metalness: config.MAGNET_METALNESS, roughness: config.MAGNET_ROUGHNESS }));
    const whiteTipMat = getMaterial('magnet-tip-mat', () => new THREE.MeshStandardMaterial({ color: config.TIP_COLOR, emissive: config.TIP_EMISSIVE, metalness: config.TIP_METALNESS, roughness: config.TIP_ROUGHNESS }));
    const baseWidth = size * config.BASE_WIDTH_FACTOR;
    const baseHeight = size * config.BASE_HEIGHT_FACTOR;
    const baseGeo = getGeometry('magnet-base', () => new THREE.TorusGeometry(baseWidth/2, baseHeight/2, config.BASE_SEGMENTS, config.BASE_SEGMENTS, config.BASE_ARC));
    const base = new THREE.Mesh(baseGeo, magnetMat);
    base.rotation.x = config.GROUP_ROTATION_X; // Apply rotation here if needed, or to tiltedGroup later
    base.position.set(0, 0, 0);
    group.add(base);
    const armWidth = size * config.ARM_WIDTH_FACTOR;
    const armHeight = size * config.ARM_HEIGHT_FACTOR;
    const armGeo = getGeometry('magnet-arm', () => new THREE.CylinderGeometry(armWidth/2, armWidth/2, armHeight, config.ARM_SEGMENTS));
    const leftArm = new THREE.Mesh(armGeo, magnetMat);
    leftArm.position.set(-baseWidth/2 + armWidth/2, armHeight/2, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, magnetMat);
    rightArm.position.set(baseWidth/2 - armWidth/2, armHeight/2, 0);
    group.add(rightArm);
    const tipRadius = size * config.TIP_RADIUS_FACTOR;
    const tipHeight = size * config.TIP_HEIGHT_FACTOR;
    const tipGeo = getGeometry('magnet-tip', () => new THREE.CylinderGeometry(tipRadius, tipRadius, tipHeight, config.TIP_SEGMENTS));
    const leftTip = new THREE.Mesh(tipGeo, whiteTipMat);
    // leftTip.rotation.x = config.GROUP_ROTATION_X; // Rotation applied to group
    leftTip.position.set(-baseWidth/2 + armWidth/2, armHeight + tipHeight/2, 0);
    group.add(leftTip);
    const rightTip = new THREE.Mesh(tipGeo, whiteTipMat);
    // rightTip.rotation.x = config.GROUP_ROTATION_X; // Rotation applied to group
    rightTip.position.set(baseWidth/2 - armWidth/2, armHeight + tipHeight/2, 0);
    group.add(rightTip);
    const tiltedGroup = new THREE.Group();
    tiltedGroup.add(group);
    group.rotation.x = config.GROUP_ROTATION_X; // Rotate inner group
    tiltedGroup.rotation.z = config.TILTED_GROUP_ROTATION_Z;
    tiltedGroup.rotation.y = config.TILTED_GROUP_ROTATION_Y;
    tiltedGroup.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return tiltedGroup;
}

/**
 * Creates a 3D model of a point doubler (X) powerup
 * @param {object} props - Properties for the doubler model
 * @param {number} props.size - Size of the doubler model
 * @param {number} props.color - Color of the doubler model
 * @returns {THREE.Group} The complete doubler model
 */
export function createDoublerModel(props = {}) {
  const group = new THREE.Group();
  const size = props.size || 0.5;
  const color = props.color || 0x0088FF;
  
  // Scale factor to make the doubler significantly bigger
  const scaleFactor = 3.75; // 1.5 (original) * 2.5 = 3.75
  
  // Create a material for the X
  const xMaterial = getMaterial(`doubler-mat-${color}`, () => new THREE.MeshStandardMaterial({
    color: color,
    emissive: new THREE.Color(0x0044AA),
    metalness: 0.6,
    roughness: 0.2
  }));
  
  // Create the first diagonal bar of the "X" (top-left to bottom-right)
  const diag1Geometry = getGeometry('doubler-diag', () => new THREE.BoxGeometry(size * 0.25 * scaleFactor, size * scaleFactor, size * 0.25 * scaleFactor));
  const diag1 = new THREE.Mesh(diag1Geometry, xMaterial);
  diag1.rotation.z = Math.PI / 4; // 45-degree angle
  
  // Create the second diagonal bar of the "X" (top-right to bottom-left)
  const diag2 = new THREE.Mesh(diag1Geometry, xMaterial); // Reuse geometry
  diag2.rotation.z = -Math.PI / 4; // -45-degree angle
  
  // Create a central sphere where the two bars meet
  const centerGeometry = getGeometry('doubler-center', () => new THREE.SphereGeometry(size * 0.2 * scaleFactor, 16, 16));
  const center = new THREE.Mesh(centerGeometry, xMaterial);
  
  // Add all meshes to the group
  group.add(diag1);
  group.add(diag2);
  group.add(center);
  
  // Set a name for identification
  group.name = "doubler";
  
  return group;
}

/**
 * Creates a 3D model of an invisibility powerup
 * @param {object} props - Properties for the invisibility model
 * @param {number} props.size - Size of the invisibility model
 * @param {number} props.color - Color of the invisibility model
 * @returns {THREE.Group} The complete invisibility model
 */

export function createInvisibilityModel(props = {}) {
  const group = new THREE.Group();
  const config = C_MODELS.INVISIBILITY;
  const size = props.size || config.DEFAULT_SIZE;
  const color = props.color || config.DEFAULT_COLOR;
  
  // Create a material for the main sphere with transparency
  const sphereMaterial = getMaterial(`invisibility-mat-${color}`, () => new THREE.MeshStandardMaterial({
    color: color,
    emissive: config.INVISIBILITY_EMISSIVE,
    metalness: config.INVISIBILITY_METALNESS,
    roughness: config.INVISIBILITY_ROUGHNESS,
    transparent: true,
    opacity: config.INVISIBILITY_OPACITY
  }));
  
  // Create the central sphere
  const sphereGeometry = getGeometry('invisibility-sphere', () => new THREE.SphereGeometry(size * 0.6, 24, 18));
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);
  
  // Create the outer aura/ring
  const auraRadius = size * config.AURA_RADIUS_FACTOR;
  const auraThickness = size * config.AURA_THICKNESS_FACTOR;
  const auraGeometry = getGeometry('invisibility-aura', () => new THREE.TorusGeometry(
    auraRadius,
    auraThickness,
    8,
    config.AURA_SEGMENTS
  ));
  
  const auraMaterial = getMaterial('invisibility-aura-mat', () => new THREE.MeshStandardMaterial({
    color: config.AURA_COLOR,
    emissive: config.AURA_EMISSIVE,
    transparent: true,
    opacity: config.AURA_OPACITY
  }));
  
  // Create multiple aura rings at different orientations for spherical effect
  const auraRingCount = 3;
  for (let i = 0; i < auraRingCount; i++) {
    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    
    // Set different rotations for each ring
    if (i === 0) {
      // First ring - XY plane
      aura.rotation.x = Math.PI / 2;
    } else if (i === 1) {
      // Second ring - YZ plane
      aura.rotation.y = Math.PI / 2;
    }
    // Third ring - XZ plane (default)
    
    group.add(aura);
  }
  
  // Add floating particles around the sphere
  const particleGeometry = getGeometry('invisibility-particle', () => new THREE.SphereGeometry(size * config.PARTICLE_SIZE_FACTOR, 6, 6));
  const particleMaterial = getMaterial(`invisibility-particle-mat-${color}`, () => new THREE.MeshStandardMaterial({
      color: color,
      emissive: config.INVISIBILITY_EMISSIVE,
      transparent: true,
      opacity: 0.6
  }));

  for (let i = 0; i < config.PARTICLE_COUNT; i++) {
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Position particles in a spherical arrangement
    const theta = Math.random() * Math.PI * 2; // Random angle around Y axis
    const phi = Math.acos(2 * Math.random() - 1); // Random angle from top to bottom
    const radius = size * config.PARTICLE_ORBIT_RADIUS;
    
    particle.position.x = radius * Math.sin(phi) * Math.cos(theta);
    particle.position.y = radius * Math.sin(phi) * Math.sin(theta);
    particle.position.z = radius * Math.cos(phi);
    
    group.add(particle);
  }
  
  // Set shadows for all meshes
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  // IMPORTANT: Set a name for identification
  group.name = "invisibility_powerup";
  
  // Add userData to help with collision detection
  group.userData = {
    objectType: 'invisibility',
    collidable: false,
    powerupType: 'invisibility'
  };
  
  return group;
}
