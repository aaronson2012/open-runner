// js/rendering/models/robustTree.js
import * as THREE from 'three';
import * as AssetManager from '../../managers/assetManager.js';
import { createLogger } from '../../utils/logger.js';
import { modelsConfig as C_MODELS } from '../../config/models.js';

const logger = createLogger('RobustTree');

/**
 * Creates a robust pine tree that maintains structural integrity through cloning
 * rather than using complex parent-child relationships that can be broken.
 * 
 * @returns {THREE.Group} A complete tree with trunk and foliage
 */
export function createRobustTree() {
    const config = C_MODELS.TREE_PINE;
    
    // Create a new group to hold the tree
    const treeGroup = new THREE.Group();
    treeGroup.name = 'tree_pine_group';
    treeGroup.userData.objectType = 'tree_pine';
    
    // Get materials from asset manager or create fallbacks
    const trunkMaterial = AssetManager.getAsset(config.TRUNK_MATERIAL_KEY) || 
                         new THREE.MeshStandardMaterial({ 
                            color: config.FALLBACK_TRUNK_COLOR, 
                            roughness: config.FALLBACK_TRUNK_ROUGHNESS 
                         });
    
    const foliageMaterial = AssetManager.getAsset(config.FOLIAGE_MATERIAL_KEY) || 
                           new THREE.MeshStandardMaterial({ 
                              color: config.FALLBACK_FOLIAGE_COLOR, 
                              roughness: config.FALLBACK_FOLIAGE_ROUGHNESS 
                           });

    // Create geometries
    const trunkGeometry = new THREE.CylinderGeometry(
        config.TRUNK_RADIUS, 
        config.TRUNK_RADIUS, 
        config.TRUNK_HEIGHT, 
        config.TRUNK_SEGMENTS
    );
    
    const foliageGeometry = new THREE.ConeGeometry(
        config.FOLIAGE_RADIUS, 
        config.FOLIAGE_HEIGHT, 
        config.FOLIAGE_SEGMENTS
    );
    
    // Create the trunk mesh
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = config.TRUNK_NAME;
    trunkMesh.position.set(0, config.TRUNK_HEIGHT / 2, 0);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    
    // Create the foliage mesh
    const foliageMesh = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliageMesh.name = config.FOLIAGE_NAME;
    foliageMesh.position.set(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;
    
    // Add both meshes to the group
    treeGroup.add(trunkMesh);
    treeGroup.add(foliageMesh);
    
    // Set up references and original positions
    treeGroup.userData.trunkMesh = trunkMesh;
    treeGroup.userData.foliageMesh = foliageMesh;
    treeGroup.userData.originalTrunkPosition = new THREE.Vector3(0, config.TRUNK_HEIGHT / 2, 0);
    treeGroup.userData.originalFoliagePosition = new THREE.Vector3(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);
    treeGroup.userData.isCompleteTree = true;
    
    return treeGroup;
}

/**
 * Creates a copy of the template tree at the specific position with given properties
 * 
 * @param {THREE.Vector3} position - Position to place the tree
 * @param {Object} properties - Properties like scale, rotation, etc
 * @returns {THREE.Group} A new tree instance
 */
export function createTreeAtPosition(position, properties = {}) {
    // Create a template tree if one doesn't exist
    if (!window._treeTemplate) {
        window._treeTemplate = createRobustTree();
    }
    
    // Clone the template tree
    const tree = window._treeTemplate.clone();
    
    // Set position
    if (position) {
        tree.position.copy(position);
    }
    
    // Apply rotation if provided
    if (properties.rotation !== undefined) {
        tree.rotation.y = properties.rotation;
    } else if (properties.rotationY !== undefined) {
        tree.rotation.y = properties.rotationY;
    }
    
    // Apply scale if provided
    if (properties.scale) {
        if (properties.scale.x !== undefined) {
            tree.scale.set(properties.scale.x, properties.scale.y, properties.scale.z);
        } else {
            // Uniform scale
            const scale = typeof properties.scale === 'number' ? properties.scale : 1;
            tree.scale.set(scale, scale, scale);
        }
    }
    
    // Transfer additional properties to the tree's userData
    if (properties.userData) {
        Object.entries(properties.userData).forEach(([key, value]) => {
            if (key !== 'trunkMesh' && key !== 'foliageMesh' &&
                key !== 'originalTrunkPosition' && key !== 'originalFoliagePosition' &&
                key !== 'isCompleteTree') {
                tree.userData[key] = value;
            }
        });
    }
    
    // Copy over specific properties
    if (properties.chunkKey) tree.userData.chunkKey = properties.chunkKey;
    if (properties.objectIndex !== undefined) tree.userData.objectIndex = properties.objectIndex;
    if (properties.type) tree.userData.objectType = properties.type;
    if (properties.name) tree.name = properties.name;
    
    // Double check that all tree parts are still present after cloning
    let hasTrunk = false, hasFoliage = false;
    
    tree.traverse(child => {
        if (child.name === C_MODELS.TREE_PINE.TRUNK_NAME) hasTrunk = true;
        if (child.name === C_MODELS.TREE_PINE.FOLIAGE_NAME) hasFoliage = true;
    });
    
    if (!hasTrunk || !hasFoliage) {
        logger.error(`Tree missing parts after cloning! (trunk: ${hasTrunk}, foliage: ${hasFoliage})`);
        
        // Rebuild missing parts
        if (!hasTrunk) {
            const config = C_MODELS.TREE_PINE;
            const trunkGeometry = new THREE.CylinderGeometry(
                config.TRUNK_RADIUS, 
                config.TRUNK_RADIUS, 
                config.TRUNK_HEIGHT, 
                config.TRUNK_SEGMENTS
            );
            
            const trunkMaterial = AssetManager.getAsset(config.TRUNK_MATERIAL_KEY) || 
                                 new THREE.MeshStandardMaterial({ 
                                    color: config.FALLBACK_TRUNK_COLOR, 
                                    roughness: config.FALLBACK_TRUNK_ROUGHNESS 
                                 });
            
            const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunkMesh.name = config.TRUNK_NAME;
            trunkMesh.position.set(0, config.TRUNK_HEIGHT / 2, 0);
            trunkMesh.castShadow = true;
            trunkMesh.receiveShadow = true;
            
            tree.add(trunkMesh);
            tree.userData.trunkMesh = trunkMesh;
        }
        
        if (!hasFoliage) {
            const config = C_MODELS.TREE_PINE;
            const foliageGeometry = new THREE.ConeGeometry(
                config.FOLIAGE_RADIUS, 
                config.FOLIAGE_HEIGHT, 
                config.FOLIAGE_SEGMENTS
            );
            
            const foliageMaterial = AssetManager.getAsset(config.FOLIAGE_MATERIAL_KEY) || 
                                   new THREE.MeshStandardMaterial({ 
                                      color: config.FALLBACK_FOLIAGE_COLOR, 
                                      roughness: config.FALLBACK_FOLIAGE_ROUGHNESS 
                                   });
            
            const foliageMesh = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliageMesh.name = config.FOLIAGE_NAME;
            foliageMesh.position.set(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);
            foliageMesh.castShadow = true;
            foliageMesh.receiveShadow = true;
            
            tree.add(foliageMesh);
            tree.userData.foliageMesh = foliageMesh;
        }
    }
    
    return tree;
}