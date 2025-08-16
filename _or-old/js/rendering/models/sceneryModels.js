// js/rendering/models/sceneryModels.js
import * as THREE from 'three';
import * as AssetManager from '../../managers/assetManager.js';
import { createLogger } from '../../utils/logger.js';
import { modelsConfig as C_MODELS } from '../../config/models.js';

const logger = createLogger('SceneryModels');

/**
 * Creates a procedural pine tree mesh.
 * Uses materials from AssetManager if available, otherwise creates fallbacks.
 * @returns {THREE.Group} The tree model group.
 */
export function createTreeMesh() {
    const treeGroup = new THREE.Group();
    const config = C_MODELS.TREE_PINE;
    treeGroup.name = config.GROUP_NAME;
    const trunkHeight = config.TRUNK_HEIGHT;
    const trunkRadius = config.TRUNK_RADIUS;
    const foliageHeight = config.FOLIAGE_HEIGHT;
    const foliageRadius = config.FOLIAGE_RADIUS;

    let trunkMaterial = AssetManager.getAsset(config.TRUNK_MATERIAL_KEY);
    let foliageMaterial = AssetManager.getAsset(config.FOLIAGE_MATERIAL_KEY);

    if (!trunkMaterial || !foliageMaterial) {
        logger.error('Missing tree materials:', !trunkMaterial ? config.TRUNK_MATERIAL_KEY : '', !foliageMaterial ? config.FOLIAGE_MATERIAL_KEY : '');
        if (!trunkMaterial) {
            logger.warn('Creating fallback trunk material');
            trunkMaterial = new THREE.MeshStandardMaterial({ color: config.FALLBACK_TRUNK_COLOR, roughness: config.FALLBACK_TRUNK_ROUGHNESS });
        }
        if (!foliageMaterial) {
            logger.warn('Creating fallback foliage material');
            foliageMaterial = new THREE.MeshStandardMaterial({ color: config.FALLBACK_FOLIAGE_COLOR, roughness: config.FALLBACK_FOLIAGE_ROUGHNESS });
        }
    }

    // Create a single mesh for the entire tree instead of separate parts
    // This prevents the tree parts from being separated
    const treeGeometry = new THREE.BufferGeometry();

    // Create trunk geometry
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, config.TRUNK_SEGMENTS);
    // Position the trunk so its bottom is at y=0
    trunkGeometry.translate(0, trunkHeight / 2, 0);

    // Create foliage geometry
    const foliageGeometry = new THREE.ConeGeometry(foliageRadius, foliageHeight, config.FOLIAGE_SEGMENTS);
    // Position the foliage on top of the trunk
    foliageGeometry.translate(0, trunkHeight + foliageHeight / 2, 0);

    // Create a multi-material mesh
    const materials = [trunkMaterial, foliageMaterial];

    // Create separate meshes for trunk and foliage
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = config.TRUNK_NAME;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    const foliageMesh = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliageMesh.name = config.FOLIAGE_NAME;
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;
    treeGroup.add(foliageMesh);
    
    // Log creation of tree parts for debugging
    logger.debug(`Created tree with parts: trunk=${config.TRUNK_NAME}, foliage=${config.FOLIAGE_NAME}`);

    // Store references to the parts
    treeGroup.userData.trunkMesh = trunkMesh;
    treeGroup.userData.foliageMesh = foliageMesh;

    // Store the original positions to allow for proper resetting
    treeGroup.userData.originalTrunkPosition = new THREE.Vector3(0, trunkHeight / 2, 0);
    treeGroup.userData.originalFoliagePosition = new THREE.Vector3(0, trunkHeight + foliageHeight / 2, 0);

    // Store the original heights for scaling calculations
    treeGroup.userData.trunkHeight = trunkHeight;
    treeGroup.userData.foliageHeight = foliageHeight;
    
    // Add deep debugging to examine structure 
    logger.debug(`Tree structure check - Children: ${treeGroup.children.length}`);
    treeGroup.children.forEach((child, index) => {
        logger.debug(`Child ${index}: name=${child.name}, type=${child.type}, position=(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
    });

    if (treeGroup.children.length !== 2) {
        logger.warn(`Tree has ${treeGroup.children.length} parts instead of 2`);
    }

    // Add event listener for child removal to maintain tree integrity
    treeGroup.addEventListener('removed', function(event) {
        // If a child is removed, log it for debugging
        if (event.target !== treeGroup) {
            logger.warn(`Tree part ${event.target.name} was removed from tree group`);
            // Create stack trace to debug where this is happening
            const stack = new Error().stack;
            logger.warn(`Stack trace for tree part removal: ${stack}`);
        }
    });
    
    // Add extra listener to each part to track if it gets removed
    trunkMesh.addEventListener('removed', function(event) {
        logger.warn(`Trunk was removed from tree! Tree group id: ${treeGroup.id}`);
        const stack = new Error().stack;
        logger.warn(`Stack trace for trunk removal: ${stack}`);
    });
    
    foliageMesh.addEventListener('removed', function(event) {
        logger.warn(`Foliage was removed from tree! Tree group id: ${treeGroup.id}`);
        const stack = new Error().stack;
        logger.warn(`Stack trace for foliage removal: ${stack}`);
    });

    // Add a custom update method to the tree group
    treeGroup.resetTreeParts = function() {
        // First check if our stored references are valid
        if (this.userData.trunkMesh && this.userData.foliageMesh) {
            // Reset positions to original values
            this.userData.trunkMesh.position.copy(this.userData.originalTrunkPosition);
            this.userData.foliageMesh.position.copy(this.userData.originalFoliagePosition);
        } else {
            // References might be lost, try to find them by name
            let foundTrunk = false, foundFoliage = false;
            const config = C_MODELS.TREE_PINE;
            
            this.traverse((child) => {
                if (child.name === config.TRUNK_NAME) {
                    child.position.y = config.TRUNK_HEIGHT / 2;
                    this.userData.trunkMesh = child;
                    foundTrunk = true;
                }
                if (child.name === config.FOLIAGE_NAME) {
                    child.position.y = config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2;
                    this.userData.foliageMesh = child;
                    foundFoliage = true;
                }
            });
            
            if (foundTrunk && foundFoliage) {
                logger.debug('Tree parts reconnected during reset');
                // Re-store original positions for future resets
                this.userData.originalTrunkPosition = new THREE.Vector3(0, config.TRUNK_HEIGHT / 2, 0);
                this.userData.originalFoliagePosition = new THREE.Vector3(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);
            } else {
                logger.warn('Failed to reconnect tree parts during reset');
            }
        }
    };

    treeGroup.userData.isCompleteTree = true;
    treeGroup.userData.objectType = config.OBJECT_TYPE;
    
    // Final verification to ensure tree has all required parts
    let finalCheckTrunk = false, finalCheckFoliage = false;
    treeGroup.traverse(child => {
        if (child.name === config.TRUNK_NAME) finalCheckTrunk = true;
        if (child.name === config.FOLIAGE_NAME) finalCheckFoliage = true;
    });
    
    if (!finalCheckTrunk || !finalCheckFoliage) {
        logger.error(`CRITICAL: Tree creation failed to produce a complete tree (trunk: ${finalCheckTrunk}, foliage: ${finalCheckFoliage})`);
        
        // Force recreate missing parts
        if (!finalCheckTrunk) {
            const trunkGeometry = new THREE.CylinderGeometry(config.TRUNK_RADIUS, config.TRUNK_RADIUS, config.TRUNK_HEIGHT, config.TRUNK_SEGMENTS);
            trunkGeometry.translate(0, config.TRUNK_HEIGHT / 2, 0);
            const trunkMaterial = AssetManager.getAsset(config.TRUNK_MATERIAL_KEY) || 
                                 new THREE.MeshStandardMaterial({ 
                                     color: config.FALLBACK_TRUNK_COLOR, 
                                     roughness: config.FALLBACK_TRUNK_ROUGHNESS 
                                 });
            const newTrunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            newTrunk.name = config.TRUNK_NAME;
            newTrunk.castShadow = true;
            newTrunk.receiveShadow = true;
            treeGroup.add(newTrunk);
            treeGroup.userData.trunkMesh = newTrunk;
            treeGroup.userData.originalTrunkPosition = new THREE.Vector3(0, config.TRUNK_HEIGHT / 2, 0);
            logger.warn("Added missing trunk to tree during final verification");
        }
        
        if (!finalCheckFoliage) {
            const foliageGeometry = new THREE.ConeGeometry(config.FOLIAGE_RADIUS, config.FOLIAGE_HEIGHT, config.FOLIAGE_SEGMENTS);
            foliageGeometry.translate(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);
            const foliageMaterial = AssetManager.getAsset(config.FOLIAGE_MATERIAL_KEY) || 
                                  new THREE.MeshStandardMaterial({ 
                                      color: config.FALLBACK_FOLIAGE_COLOR, 
                                      roughness: config.FALLBACK_FOLIAGE_ROUGHNESS 
                                  });
            const newFoliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            newFoliage.name = config.FOLIAGE_NAME;
            newFoliage.castShadow = true;
            newFoliage.receiveShadow = true;
            treeGroup.add(newFoliage);
            treeGroup.userData.foliageMesh = newFoliage;
            treeGroup.userData.originalFoliagePosition = new THREE.Vector3(0, config.TRUNK_HEIGHT + config.FOLIAGE_HEIGHT / 2, 0);
            logger.warn("Added missing foliage to tree during final verification");
        }
    }
    
    return treeGroup;
}

/**
 * Creates a desert rock model using assets.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The rock model group.
 */
export function createRockDesertModel(properties) {
     const group = new THREE.Group();
     const config = C_MODELS.ROCK_DESERT;
     const geo = AssetManager.getAsset(config.GEO_KEY);
     const mat = AssetManager.getAsset(config.MATERIAL_KEY);
     if (geo && mat) {
         const mesh = new THREE.Mesh(geo, mat);
         mesh.castShadow = true;
         mesh.receiveShadow = true;
         group.add(mesh);

         // Set a flag to indicate this is a rock that should stay aligned with terrain
         group.userData.stayAlignedWithTerrain = true;
         group.userData.verticalOffset = properties?.verticalOffset || 0.6; // Default vertical offset
         group.userData.objectType = 'rock_desert'; // Ensure objectType is set on the group

         // Also set on the mesh to ensure it's available at all levels
         mesh.userData = {
             objectType: 'rock_desert',
             stayAlignedWithTerrain: true,
             verticalOffset: properties?.verticalOffset || 0.6
         };

         logger.debug(`Created rock_desert model with verticalOffset: ${group.userData.verticalOffset}`);
     } else {
         logger.warn(`Missing geometry (${config.GEO_KEY}) or material (${config.MATERIAL_KEY}) for rock_desert`);
     }
     return group;
}

/**
 * Creates a procedural Saguaro cactus model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The cactus model group.
 */
export function createCactusSaguaroModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.CACTUS_SAGUARO;
    const mat = AssetManager.getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY}`); return group; }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(config.TRUNK_RADIUS_BOTTOM, config.TRUNK_RADIUS_TOP, config.TRUNK_HEIGHT, config.TRUNK_SEGMENTS), mat);
    trunk.position.y = config.TRUNK_Y_POS;
    group.add(trunk);
    const armGeo = new THREE.CylinderGeometry(config.ARM_RADIUS_BOTTOM, config.ARM_RADIUS_TOP, config.ARM_HEIGHT, config.ARM_SEGMENTS);
    const arm1 = new THREE.Mesh(armGeo, mat);
    arm1.position.set(config.ARM1_X_POS, config.ARM1_Y_POS, 0);
    arm1.rotation.z = config.ARM1_Z_ROT;
    arm1.rotation.y = config.ARM1_Y_ROT;
    group.add(arm1);
    const arm2 = new THREE.Mesh(armGeo, mat);
    arm2.position.set(config.ARM2_X_POS, config.ARM2_Y_POS, 0);
    arm2.rotation.z = config.ARM2_Z_ROT;
    arm2.rotation.y = config.ARM2_Y_ROT;
    group.add(arm2);
    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a procedural Barrel cactus model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The cactus model group.
 */
export function createCactusBarrelModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.CACTUS_BARREL;
    const mat = AssetManager.getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY}`); return group; }
    const geo = AssetManager.getAsset(config.GEO_KEY) || new THREE.CylinderGeometry(config.FALLBACK_RADIUS_BOTTOM, config.FALLBACK_RADIUS_TOP, config.FALLBACK_HEIGHT, config.FALLBACK_SEGMENTS); // Use asset or fallback
    const mesh = new THREE.Mesh(geo, mat);
    // Calculate Y position based on geometry height
    const height = (geo.parameters.height !== undefined) ? geo.parameters.height : config.FALLBACK_HEIGHT;
    mesh.position.y = height * config.Y_POS_FACTOR;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
}

/**
 * Creates a procedural Saloon model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The saloon model group.
 */
export function createSaloonModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.SALOON;
    const mat = AssetManager.getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY}`); return group; }
    const geo = AssetManager.getAsset(config.GEO_KEY) || new THREE.BoxGeometry(config.FALLBACK_WIDTH, config.FALLBACK_HEIGHT, config.FALLBACK_DEPTH); // Use asset or fallback
    const buildingHeight = (geo.parameters.height !== undefined) ? geo.parameters.height : config.FALLBACK_HEIGHT;
    const buildingDepth = (geo.parameters.depth !== undefined) ? geo.parameters.depth : config.FALLBACK_DEPTH;
    const buildingWidth = (geo.parameters.width !== undefined) ? geo.parameters.width : config.FALLBACK_WIDTH;

    const mainBuilding = new THREE.Mesh(geo, mat);
    mainBuilding.position.y = buildingHeight * config.BUILDING_Y_POS_FACTOR;
    group.add(mainBuilding);
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(buildingWidth * config.ROOF_WIDTH_FACTOR, config.ROOF_HEIGHT, config.ROOF_DEPTH), mat);
    porchRoof.position.set(0, mainBuilding.position.y + buildingHeight * 0.5 + config.ROOF_Y_OFFSET, buildingDepth * config.ROOF_Z_OFFSET_FACTOR);
    group.add(porchRoof);
    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a procedural Railroad Sign model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The sign model group.
 */
export function createRailroadSignModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.RAILROAD_SIGN;
    const woodMat = AssetManager.getAsset(config.WOOD_MATERIAL_KEY);
    const signMat = new THREE.MeshStandardMaterial({ color: config.SIGN_COLOR });
    if (!woodMat) { logger.warn(`Missing ${config.WOOD_MATERIAL_KEY} for railroad sign`); return group; }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(config.POST_RADIUS, config.POST_RADIUS, config.POST_HEIGHT, config.POST_SEGMENTS), woodMat);
    post.position.y = config.POST_HEIGHT * config.POST_Y_POS_FACTOR;
    group.add(post);
    const signGeo = new THREE.BoxGeometry(config.SIGN_WIDTH, config.SIGN_HEIGHT, config.SIGN_DEPTH);
    const cross1 = new THREE.Mesh(signGeo, signMat);
    cross1.position.set(0, config.SIGN_Y_POS, 0);
    cross1.rotation.z = config.SIGN_ROTATION_Z;
    group.add(cross1);
    const cross2 = new THREE.Mesh(signGeo, signMat);
    cross2.position.set(0, config.SIGN_Y_POS, 0);
    cross2.rotation.z = -config.SIGN_ROTATION_Z;
    group.add(cross2);
    group.traverse(child => { if (child.isMesh) { child.castShadow = true; } });
    return group;
}

/**
 * Creates a Skull model using assets or fallback.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The skull model group.
 */
export function createSkullModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.SKULL;
    const geo = AssetManager.getAsset(config.GEO_KEY) || new THREE.IcosahedronGeometry(config.FALLBACK_RADIUS, config.FALLBACK_DETAIL); // Use asset or fallback
    const mat = new THREE.MeshStandardMaterial({ color: config.COLOR, roughness: config.ROUGHNESS });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);
    return group;
}

/**
 * Creates a Dried Bush model using assets or fallback.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The bush model group.
 */
export function createDriedBushModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.DRIED_BUSH;
    const geo = AssetManager.getAsset(config.GEO_KEY) || new THREE.IcosahedronGeometry(config.FALLBACK_RADIUS, config.FALLBACK_DETAIL); // Use asset or fallback
    const mat = new THREE.MeshStandardMaterial({ color: config.COLOR, roughness: config.ROUGHNESS });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
}

/**
 * Creates a Wagon Wheel model using assets or fallback.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The wheel model group.
 */
export function createWagonWheelModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.WAGON_WHEEL;
    const mat = AssetManager.getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY} for wagon wheel`); return group; }
    const geo = AssetManager.getAsset(config.GEO_KEY) || new THREE.TorusGeometry(config.FALLBACK_RADIUS, config.FALLBACK_TUBE_RADIUS, config.FALLBACK_RADIAL_SEGMENTS, config.FALLBACK_TUBULAR_SEGMENTS); // Use asset or fallback
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = config.ROTATION_X;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
}

/**
 * Creates a procedural Mine Entrance model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The mine entrance model group.
 */
export function createMineEntranceModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.MINE_ENTRANCE;
    const woodMat = AssetManager.getAsset(config.WOOD_MATERIAL_KEY);
    // const rockMat = AssetManager.getAsset(config.ROCK_MATERIAL_KEY); // Available but not used
    if (!woodMat) { logger.warn(`Missing ${config.WOOD_MATERIAL_KEY} for mine entrance`); return group; }
    const frameSideGeo = new THREE.BoxGeometry(config.FRAME_SIDE_WIDTH, config.FRAME_SIDE_HEIGHT, config.FRAME_SIDE_DEPTH);
    const frameTopGeo = new THREE.BoxGeometry(config.FRAME_TOP_WIDTH, config.FRAME_TOP_HEIGHT, config.FRAME_TOP_DEPTH);
    const leftPost = new THREE.Mesh(frameSideGeo, woodMat);
    leftPost.position.set(-config.FRAME_TOP_WIDTH * config.POST_X_OFFSET_FACTOR, config.FRAME_SIDE_HEIGHT * config.POST_Y_POS_FACTOR, 0);
    group.add(leftPost);
    const rightPost = new THREE.Mesh(frameSideGeo, woodMat);
    rightPost.position.set(config.FRAME_TOP_WIDTH * config.POST_X_OFFSET_FACTOR, config.FRAME_SIDE_HEIGHT * config.POST_Y_POS_FACTOR, 0);
    group.add(rightPost);
    const topBeam = new THREE.Mesh(frameTopGeo, woodMat);
    topBeam.position.set(0, config.FRAME_SIDE_HEIGHT * config.TOP_Y_POS_FACTOR, 0);
    group.add(topBeam);
    const openingMat = new THREE.MeshBasicMaterial({ color: config.OPENING_COLOR });
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(config.FRAME_TOP_WIDTH * config.OPENING_WIDTH_FACTOR, config.FRAME_SIDE_HEIGHT * config.OPENING_HEIGHT_FACTOR), openingMat);
    opening.position.set(0, config.FRAME_SIDE_HEIGHT * config.OPENING_Y_POS_FACTOR, config.OPENING_Z_POS);
    group.add(opening);
    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a procedural Water Tower model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The water tower model group.
 */
export function createWaterTowerModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.WATER_TOWER;
    const woodMat = AssetManager.getAsset(config.WOOD_MATERIAL_KEY);
    if (!woodMat) { logger.warn(`Missing ${config.WOOD_MATERIAL_KEY} for water tower`); return group; }
    const tankGeo = new THREE.CylinderGeometry(config.TANK_RADIUS, config.TANK_RADIUS, config.TANK_HEIGHT, config.TANK_SEGMENTS);
    const tank = new THREE.Mesh(tankGeo, woodMat);
    tank.position.y = config.TANK_Y_POS;
    group.add(tank);
    const legGeo = new THREE.BoxGeometry(config.LEG_WIDTH, config.LEG_HEIGHT, config.LEG_DEPTH);
    const legY = config.LEG_HEIGHT * config.LEG_Y_POS_FACTOR;
    const legOffset = config.LEG_OFFSET;
    const leg1 = new THREE.Mesh(legGeo, woodMat);
    leg1.position.set(legOffset, legY, legOffset);
    group.add(leg1);
    const leg2 = new THREE.Mesh(legGeo, woodMat);
    leg2.position.set(-legOffset, legY, legOffset);
    group.add(leg2);
    const leg3 = new THREE.Mesh(legGeo, woodMat);
    leg3.position.set(legOffset, legY, -legOffset);
    group.add(leg3);
    const leg4 = new THREE.Mesh(legGeo, woodMat);
    leg4.position.set(-legOffset, legY, -legOffset);
    group.add(leg4);
    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a Tumbleweed model (visual only) using assets or fallback.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The tumbleweed model group.
 */
export function createTumbleweedModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.TUMBLEWEED_MODEL;
    const geo = AssetManager.getAsset(config.GEO_KEY) || new THREE.IcosahedronGeometry(config.FALLBACK_RADIUS, config.FALLBACK_DETAIL); // Use asset or fallback
    const mat = new THREE.MeshStandardMaterial({ color: config.COLOR, roughness: config.ROUGHNESS });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);
    return group;
}