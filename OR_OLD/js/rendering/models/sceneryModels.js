// js/rendering/models/sceneryModels.js
import * as THREE from 'three';
import { getAsset, getGeometry, getMaterial } from '../../managers/assetManager.js';
import { createLogger } from '../../utils/logger.js';
import { modelsConfig as C_MODELS } from '../../config/models.js';
import { modelBuilder } from '../ModelBuilder.js';

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

    const trunkMaterial = getMaterial(config.TRUNK_MATERIAL_KEY, () => new THREE.MeshStandardMaterial({ color: config.FALLBACK_TRUNK_COLOR, roughness: config.FALLBACK_TRUNK_ROUGHNESS }));
    const foliageMaterial = getMaterial(config.FOLIAGE_MATERIAL_KEY, () => new THREE.MeshStandardMaterial({ color: config.FALLBACK_FOLIAGE_COLOR, roughness: config.FALLBACK_FOLIAGE_ROUGHNESS }));

    // Create trunk geometry
    const trunkGeometry = getGeometry('tree-trunk', () => {
        const geom = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, config.TRUNK_SEGMENTS);
        geom.translate(0, trunkHeight / 2, 0);
        return geom;
    });

    // Create foliage geometry
    const foliageGeometry = getGeometry('tree-foliage', () => {
        const geom = new THREE.ConeGeometry(foliageRadius, foliageHeight, config.FOLIAGE_SEGMENTS);
        geom.translate(0, trunkHeight + foliageHeight / 2, 0);
        return geom;
    });

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
    
    treeGroup.userData.isCompleteTree = true;
    treeGroup.userData.objectType = config.OBJECT_TYPE;
    
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
     const geo = getAsset(config.GEO_KEY);
     const mat = getAsset(config.MATERIAL_KEY);
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
    const mat = getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY}`); return group; }

    const trunkGeo = getGeometry('saguaro-trunk', () => new THREE.CylinderGeometry(config.TRUNK_RADIUS_BOTTOM, config.TRUNK_RADIUS_TOP, config.TRUNK_HEIGHT, config.TRUNK_SEGMENTS));
    const trunk = new THREE.Mesh(trunkGeo, mat);
    trunk.position.y = config.TRUNK_Y_POS;
    group.add(trunk);

    const armGeo = getGeometry('saguaro-arm', () => new THREE.CylinderGeometry(config.ARM_RADIUS_BOTTOM, config.ARM_RADIUS_TOP, config.ARM_HEIGHT, config.ARM_SEGMENTS));
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
    const mat = getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY}`); return group; }
    const geo = getAsset(config.GEO_KEY) || getGeometry('cactus-barrel-fallback', () => new THREE.CylinderGeometry(config.FALLBACK_RADIUS_BOTTOM, config.FALLBACK_RADIUS_TOP, config.FALLBACK_HEIGHT, config.FALLBACK_SEGMENTS)); // Use asset or fallback
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
    const mat = getAsset(config.MATERIAL_KEY);
    if (!mat) { logger.warn(`Missing ${config.MATERIAL_KEY}`); return group; }
    const geo = getAsset(config.GEO_KEY) || getGeometry('saloon-fallback', () => new THREE.BoxGeometry(config.FALLBACK_WIDTH, config.FALLBACK_HEIGHT, config.FALLBACK_DEPTH)); // Use asset or fallback
    const buildingHeight = (geo.parameters.height !== undefined) ? geo.parameters.height : config.FALLBACK_HEIGHT;
    const buildingDepth = (geo.parameters.depth !== undefined) ? geo.parameters.depth : config.FALLBACK_DEPTH;
    const buildingWidth = (geo.parameters.width !== undefined) ? geo.parameters.width : config.FALLBACK_WIDTH;

    const mainBuilding = new THREE.Mesh(geo, mat);
    mainBuilding.position.y = buildingHeight * config.BUILDING_Y_POS_FACTOR;
    group.add(mainBuilding);
    const porchRoofGeo = getGeometry('saloon-roof', () => new THREE.BoxGeometry(buildingWidth * config.ROOF_WIDTH_FACTOR, config.ROOF_HEIGHT, config.ROOF_DEPTH));
    const porchRoof = new THREE.Mesh(porchRoofGeo, mat);
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
    const woodMat = getAsset(config.WOOD_MATERIAL_KEY);
    const signMat = getMaterial('railroad-sign-mat', () => new THREE.MeshStandardMaterial({ color: config.SIGN_COLOR }));
    if (!woodMat) { logger.warn(`Missing ${config.WOOD_MATERIAL_KEY} for railroad sign`); return group; }
    const postGeo = getGeometry('railroad-post', () => new THREE.CylinderGeometry(config.POST_RADIUS, config.POST_RADIUS, config.POST_HEIGHT, config.POST_SEGMENTS));
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = config.POST_HEIGHT * config.POST_Y_POS_FACTOR;
    group.add(post);
    const signGeo = getGeometry('railroad-sign', () => new THREE.BoxGeometry(config.SIGN_WIDTH, config.SIGN_HEIGHT, config.SIGN_DEPTH));
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
    return modelBuilder
        .withConfig(C_MODELS.SKULL)
        .withProperties(properties)
        .addMesh({
            geometryKey: 'GEO_KEY',
            geometryFallback: () => new THREE.IcosahedronGeometry(C_MODELS.SKULL.FALLBACK_RADIUS, C_MODELS.SKULL.FALLBACK_DETAIL),
            materialFallback: () => new THREE.MeshStandardMaterial({ color: C_MODELS.SKULL.COLOR, roughness: C_MODELS.SKULL.ROUGHNESS })
        })
        .build();
}

/**
 * Creates a Dried Bush model using assets or fallback.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The bush model group.
 */
export function createDriedBushModel(properties) {
    return modelBuilder
        .withConfig(C_MODELS.DRIED_BUSH)
        .withProperties(properties)
        .addMesh({
            geometryKey: 'GEO_KEY',
            geometryFallback: () => new THREE.IcosahedronGeometry(C_MODELS.DRIED_BUSH.FALLBACK_RADIUS, C_MODELS.DRIED_BUSH.FALLBACK_DETAIL),
            materialFallback: () => new THREE.MeshStandardMaterial({ color: C_MODELS.DRIED_BUSH.COLOR, roughness: C_MODELS.DRIED_BUSH.ROUGHNESS })
        })
        .build();
}

/**
 * Creates a Wagon Wheel model using assets or fallback.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The wheel model group.
 */
export function createWagonWheelModel(properties) {
    return modelBuilder
        .withConfig(C_MODELS.WAGON_WHEEL)
        .withProperties(properties)
        .addMesh({
            geometryKey: 'GEO_KEY',
            geometryFallback: () => new THREE.TorusGeometry(
                C_MODELS.WAGON_WHEEL.FALLBACK_RADIUS,
                C_MODELS.WAGON_WHEEL.FALLBACK_TUBE_RADIUS,
                C_MODELS.WAGON_WHEEL.FALLBACK_RADIAL_SEGMENTS,
                C_MODELS.WAGON_WHEEL.FALLBACK_TUBULAR_SEGMENTS
            ),
            materialKey: 'MATERIAL_KEY',
            rotation: { x: C_MODELS.WAGON_WHEEL.ROTATION_X, y: 0, z: 0 }
        })
        .build();
}

/**
 * Creates a procedural Mine Entrance model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The mine entrance model group.
 */
export function createMineEntranceModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.MINE_ENTRANCE;
    const woodMat = getAsset(config.WOOD_MATERIAL_KEY);
    // const rockMat = AssetManager.getAsset(config.ROCK_MATERIAL_KEY); // Available but not used
    if (!woodMat) { logger.warn(`Missing ${config.WOOD_MATERIAL_KEY} for mine entrance`); return group; }
    const frameSideGeo = getGeometry('mine-frame-side', () => new THREE.BoxGeometry(config.FRAME_SIDE_WIDTH, config.FRAME_SIDE_HEIGHT, config.FRAME_SIDE_DEPTH));
    const frameTopGeo = getGeometry('mine-frame-top', () => new THREE.BoxGeometry(config.FRAME_TOP_WIDTH, config.FRAME_TOP_HEIGHT, config.FRAME_TOP_DEPTH));
    const leftPost = new THREE.Mesh(frameSideGeo, woodMat);
    leftPost.position.set(-config.FRAME_TOP_WIDTH * config.POST_X_OFFSET_FACTOR, config.FRAME_SIDE_HEIGHT * config.POST_Y_POS_FACTOR, 0);
    group.add(leftPost);
    const rightPost = new THREE.Mesh(frameSideGeo, woodMat);
    rightPost.position.set(config.FRAME_TOP_WIDTH * config.POST_X_OFFSET_FACTOR, config.FRAME_SIDE_HEIGHT * config.POST_Y_POS_FACTOR, 0);
    group.add(rightPost);
    const topBeam = new THREE.Mesh(frameTopGeo, woodMat);
    topBeam.position.set(0, config.FRAME_SIDE_HEIGHT * config.TOP_Y_POS_FACTOR, 0);
    group.add(topBeam);
    const openingMat = getMaterial('mine-opening-mat', () => new THREE.MeshBasicMaterial({ color: config.OPENING_COLOR }));
    const openingGeo = getGeometry('mine-opening', () => new THREE.PlaneGeometry(config.FRAME_TOP_WIDTH * config.OPENING_WIDTH_FACTOR, config.FRAME_SIDE_HEIGHT * config.OPENING_HEIGHT_FACTOR));
    const opening = new THREE.Mesh(openingGeo, openingMat);
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
    const woodMat = getAsset(config.WOOD_MATERIAL_KEY);
    if (!woodMat) { logger.warn(`Missing ${config.WOOD_MATERIAL_KEY} for water tower`); return group; }
    const tankGeo = getGeometry('water-tower-tank', () => new THREE.CylinderGeometry(config.TANK_RADIUS, config.TANK_RADIUS, config.TANK_HEIGHT, config.TANK_SEGMENTS));
    const tank = new THREE.Mesh(tankGeo, woodMat);
    tank.position.y = config.TANK_Y_POS;
    group.add(tank);
    const legGeo = getGeometry('water-tower-leg', () => new THREE.BoxGeometry(config.LEG_WIDTH, config.LEG_HEIGHT, config.LEG_DEPTH));
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
 * Creates a procedural Tumbleweed model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The tumbleweed model group.
 */
export function createTumbleweedModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.TUMBLEWEED;
    
    // Create multiple material variations for depth
    const mainMat = getMaterial('tumbleweed-main-mat', () => new THREE.MeshStandardMaterial({ 
        color: config.COLOR, 
        roughness: config.ROUGHNESS,
        transparent: true,
        opacity: 0.9 
    }));
    
    const innerMat = getMaterial('tumbleweed-inner-mat', () => new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(config.COLOR).multiplyScalar(0.7), 
        roughness: config.ROUGHNESS + 0.1,
        transparent: true,
        opacity: 0.6 
    }));
    
    const fineMat = getMaterial('tumbleweed-fine-mat', () => new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(config.COLOR).multiplyScalar(0.5), 
        roughness: 0.95,
        transparent: true,
        opacity: 0.4 
    }));

    const maxRadius = config.BRANCH_LENGTH_MAX;
    const branchCount = config.BRANCH_COUNT * 1.5; // More branches for fuller look

    // Create main structural branches (thick)
    for (let i = 0; i < config.BRANCH_COUNT; i++) {
        const branchLength = THREE.MathUtils.randFloat(config.BRANCH_LENGTH_MIN, maxRadius);
        const endPoint = new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(2),
            THREE.MathUtils.randFloatSpread(2),
            THREE.MathUtils.randFloatSpread(2)
        ).normalize().multiplyScalar(branchLength);

        const branchGeo = getGeometry(`tumbleweed-branch-${i}`, () => 
            new THREE.CylinderGeometry(
                config.BRANCH_RADIUS, 
                config.BRANCH_RADIUS * 0.3, 
                endPoint.length(), 
                config.BRANCH_SEGMENTS
            )
        );
        const branch = new THREE.Mesh(branchGeo, mainMat);

        branch.position.copy(endPoint).multiplyScalar(0.5);
        branch.lookAt(endPoint);
        branch.rotateX(Math.PI / 2);

        group.add(branch);

        // Create secondary branches from main branches
        const subBranches = THREE.MathUtils.randInt(2, 4);
        for (let j = 0; j < subBranches; j++) {
            const subBranchLength = branchLength * THREE.MathUtils.randFloat(0.3, 0.7);
            const subBranchStart = endPoint.clone().multiplyScalar(THREE.MathUtils.randFloat(0.4, 0.8));
            const subBranchEnd = subBranchStart.clone().add(
                new THREE.Vector3(
                    THREE.MathUtils.randFloatSpread(2),
                    THREE.MathUtils.randFloatSpread(2),
                    THREE.MathUtils.randFloatSpread(2)
                ).normalize().multiplyScalar(subBranchLength)
            );

            // Keep within sphere bounds
            if (subBranchEnd.length() > maxRadius) {
                subBranchEnd.normalize().multiplyScalar(maxRadius * 0.9);
            }

            const subBranchVec = subBranchEnd.clone().sub(subBranchStart);
            const subGeo = getGeometry(`tumbleweed-sub-branch-${i}-${j}`, () => 
                new THREE.CylinderGeometry(
                    config.BRANCH_RADIUS * 0.5, 
                    config.BRANCH_RADIUS * 0.2, 
                    subBranchVec.length(), 
                    config.BRANCH_SEGMENTS
                )
            );
            const subBranch = new THREE.Mesh(subGeo, innerMat);

            subBranch.position.copy(subBranchStart).add(subBranchVec.multiplyScalar(0.5));
            subBranch.lookAt(subBranchEnd);
            subBranch.rotateX(Math.PI / 2);

            group.add(subBranch);

            // Create fine twigs from secondary branches
            const twigCount = THREE.MathUtils.randInt(1, 3);
            for (let k = 0; k < twigCount; k++) {
                const twigLength = subBranchLength * THREE.MathUtils.randFloat(0.2, 0.4);
                const twigStart = subBranchEnd.clone().add(
                    new THREE.Vector3(
                        THREE.MathUtils.randFloatSpread(0.5),
                        THREE.MathUtils.randFloatSpread(0.5),
                        THREE.MathUtils.randFloatSpread(0.5)
                    )
                );
                const twigEnd = twigStart.clone().add(
                    new THREE.Vector3(
                        THREE.MathUtils.randFloatSpread(2),
                        THREE.MathUtils.randFloatSpread(2),
                        THREE.MathUtils.randFloatSpread(2)
                    ).normalize().multiplyScalar(twigLength)
                );

                // Keep within bounds
                if (twigEnd.length() > maxRadius) {
                    twigEnd.normalize().multiplyScalar(maxRadius * 0.8);
                }

                const twigVec = twigEnd.clone().sub(twigStart);
                if (twigVec.length() > 0.1) { // Only create if long enough
                    const twigGeo = getGeometry(`tumbleweed-twig-${i}-${j}-${k}`, () => 
                        new THREE.CylinderGeometry(
                            config.BRANCH_RADIUS * 0.15, 
                            config.BRANCH_RADIUS * 0.05, 
                            twigVec.length(), 
                            3
                        )
                    );
                    const twig = new THREE.Mesh(twigGeo, fineMat);

                    twig.position.copy(twigStart).add(twigVec.multiplyScalar(0.5));
                    twig.lookAt(twigEnd);
                    twig.rotateX(Math.PI / 2);

                    group.add(twig);
                }
            }
        }
    }

    // Add some random crossing branches for more complexity
    const crossBranchCount = Math.floor(config.BRANCH_COUNT * 0.3);
    for (let i = 0; i < crossBranchCount; i++) {
        const startPoint = new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8),
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8),
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8)
        );
        const endPoint = new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8),
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8),
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8)
        );

        const crossVec = endPoint.clone().sub(startPoint);
        if (crossVec.length() > maxRadius * 0.3) { // Only if long enough
            const crossGeo = getGeometry(`tumbleweed-cross-${i}`, () => 
                new THREE.CylinderGeometry(
                    config.BRANCH_RADIUS * 0.4, 
                    config.BRANCH_RADIUS * 0.4, 
                    crossVec.length(), 
                    config.BRANCH_SEGMENTS
                )
            );
            const crossBranch = new THREE.Mesh(crossGeo, innerMat);

            crossBranch.position.copy(startPoint).add(crossVec.multiplyScalar(0.5));
            crossBranch.lookAt(endPoint);
            crossBranch.rotateX(Math.PI / 2);

            group.add(crossBranch);
        }
    }

    // Add some small debris/particles for realism
    const debrisCount = 15;
    const debrisGeo = getGeometry('tumbleweed-debris', () => new THREE.SphereGeometry(0.02, 4, 4));
    for (let i = 0; i < debrisCount; i++) {
        const debris = new THREE.Mesh(debrisGeo, fineMat);
        debris.position.set(
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8),
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8),
            THREE.MathUtils.randFloatSpread(maxRadius * 0.8)
        );
        group.add(debris);
    }

    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return group;
}