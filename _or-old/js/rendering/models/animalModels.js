// js/rendering/models/animalModels.js
import * as THREE from 'three';
import { createLogger } from '../../utils/logger.js';
import { modelsConfig as C_MODELS } from '../../config/models.js';
// Import helper functions from the utility file
import { createBoxPart, createEyes, createSnout, createEars } from '../modelUtils.js';

const logger = createLogger('AnimalModels');

/**
 * Creates a procedural bear model.
 * @param {object} [properties] - Optional properties (e.g., color).
 * @returns {THREE.Group} The bear model group.
 */
export function createBearModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.BEAR;
    const color = properties?.color || config.DEFAULT_COLOR;
    const torsoWidth = config.TORSO_WIDTH, torsoHeight = config.TORSO_HEIGHT, torsoDepth = config.TORSO_DEPTH;
    const headWidth = config.HEAD_WIDTH, headHeight = config.HEAD_HEIGHT, headDepth = config.HEAD_DEPTH;
    const legWidth = config.LEG_WIDTH, legHeight = config.LEG_HEIGHT, legDepth = config.LEG_DEPTH;

    const torsoGeometry = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.TORSO_ROUGHNESS });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.castShadow = true;
    const torsoY = legHeight / 2 + torsoHeight / 2 + config.TORSO_Y_OFFSET_FACTOR;
    torso.position.y = torsoY;
    group.add(torso);

    const headGeometry = new THREE.BoxGeometry(headWidth, headHeight, headDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const headMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.HEAD_ROUGHNESS });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    head.position.set(0, torsoY + torsoHeight * config.HEAD_Y_OFFSET_FACTOR, -torsoDepth / 2 - headDepth * config.HEAD_Z_OFFSET_FACTOR);
    group.add(head);

    const eyes = createEyes(headWidth, head.position, C_MODELS.HELPER_EYE_COLOR, config.EYE_SIZE / headWidth);
    group.add(eyes);
    const snout = createSnout(head.position, color, config.SNOUT_WIDTH, config.SNOUT_HEIGHT, config.SNOUT_DEPTH);
    group.add(snout);
    const ears = createEars(headWidth, headHeight, head.position, color, false); // Pointy = false for bear
    group.add(ears);

    const legY = legHeight * config.LEG_Y_OFFSET_FACTOR;
    const legXOffset = torsoWidth / 2 - legWidth * config.LEG_X_OFFSET_FACTOR;
    const frontLegZ = -torsoDepth / 2 + legDepth * config.FRONT_LEG_Z_FACTOR;
    const backLegZ = torsoDepth / 2 - legDepth * config.BACK_LEG_Z_FACTOR;
    const legGeometry = new THREE.BoxGeometry(legWidth, legHeight, legDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.LEG_ROUGHNESS });

    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontLeftLeg.castShadow = true;
    frontLeftLeg.position.set(-legXOffset, legY, frontLegZ);
    group.add(frontLeftLeg);
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontRightLeg.castShadow = true;
    frontRightLeg.position.set(legXOffset, legY, frontLegZ);
    group.add(frontRightLeg);
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    backLeftLeg.castShadow = true;
    backLeftLeg.position.set(-legXOffset, legY, backLegZ);
    group.add(backLeftLeg);
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    backRightLeg.castShadow = true;
    backRightLeg.position.set(legXOffset, legY, backLegZ);
    group.add(backRightLeg);

    group.userData.legs = { frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg };
    group.userData.legHeight = legHeight;
    return group;
}

/**
 * Creates a procedural squirrel model.
 * @param {object} [properties] - Optional properties (e.g., color).
 * @returns {THREE.Group} The squirrel model group.
 */
export function createSquirrelModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.SQUIRREL;
    const color = properties?.color || config.DEFAULT_COLOR;
    const torsoWidth = config.TORSO_WIDTH, torsoHeight = config.TORSO_HEIGHT, torsoDepth = config.TORSO_DEPTH;
    const headWidth = config.HEAD_WIDTH, headHeight = config.HEAD_HEIGHT, headDepth = config.HEAD_DEPTH;
    const legWidth = config.LEG_WIDTH, legHeight = config.LEG_HEIGHT, legDepth = config.LEG_DEPTH;

    const torsoGeometry = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.castShadow = true;
    torso.position.y = config.TORSO_Y_POS;
    group.add(torso);

    const headGeometry = new THREE.BoxGeometry(headWidth, headHeight, headDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const headMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    head.position.set(0, torso.position.y + config.HEAD_Y_OFFSET, config.HEAD_Z_OFFSET);
    group.add(head);

    const eyes = createEyes(headWidth, head.position, C_MODELS.HELPER_EYE_COLOR, config.EYE_SIZE / headWidth);
    group.add(eyes);
    const snout = createSnout(head.position, color, config.SNOUT_WIDTH, config.SNOUT_HEIGHT, config.SNOUT_DEPTH);
    group.add(snout);
    const ears = createEars(headWidth, headHeight, head.position, color, true); // Pointy = true for squirrel
    group.add(ears);

    const legY = config.LEG_Y_POS;
    const legGeometry = new THREE.BoxGeometry(legWidth, legHeight, legDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });

    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontLeftLeg.castShadow = true;
    frontLeftLeg.position.set(-torsoWidth / 2 + config.LEG_X_OFFSET_FACTOR, legY, -torsoDepth / 2 + config.FRONT_LEG_Z_OFFSET_FACTOR);
    group.add(frontLeftLeg);
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontRightLeg.castShadow = true;
    frontRightLeg.position.set(torsoWidth / 2 - config.LEG_X_OFFSET_FACTOR, legY, -torsoDepth / 2 + config.FRONT_LEG_Z_OFFSET_FACTOR);
    group.add(frontRightLeg);
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    backLeftLeg.castShadow = true;
    backLeftLeg.position.set(-torsoWidth / 2 + config.LEG_X_OFFSET_FACTOR, legY, torsoDepth / 2 - config.BACK_LEG_Z_OFFSET_FACTOR);
    group.add(backLeftLeg);
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    backRightLeg.castShadow = true;
    backRightLeg.position.set(torsoWidth / 2 - config.LEG_X_OFFSET_FACTOR, legY, torsoDepth / 2 - config.BACK_LEG_Z_OFFSET_FACTOR);
    group.add(backRightLeg);

    const tailBasePosition = new THREE.Vector3(0, torso.position.y + config.TAIL_BASE_Y_OFFSET, torsoDepth / 2 + config.TAIL_BASE_Z_OFFSET_FACTOR);
    const tailSegments = config.TAIL_SEGMENTS;
    const tailWidth = config.TAIL_WIDTH;
    const tailSegmentLength = config.TAIL_SEGMENT_LENGTH;
    const tailCurve = config.TAIL_CURVE;
    let currentPos = new THREE.Vector3().copy(tailBasePosition);
    let currentAngle = config.TAIL_INITIAL_ANGLE;
    for (let i = 0; i < tailSegments; i++) {
        const segmentWidth = tailWidth * (i === 0 || i === tailSegments - 1 ? config.TAIL_SEGMENT_WIDTH_FACTOR : 1.0);
        const segment = createBoxPart(segmentWidth, segmentWidth, tailSegmentLength, color);
        segment.position.copy(currentPos);
        segment.rotation.x = currentAngle;
        group.add(segment);
        currentPos.z += Math.cos(currentAngle) * tailSegmentLength;
        currentPos.y += Math.sin(currentAngle) * tailSegmentLength;
        currentAngle -= tailCurve / tailSegments;
    }

    group.userData.legs = { frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg };
    group.userData.legHeight = legHeight;
    return group;
}

/**
 * Creates a procedural deer model.
 * @param {object} [properties] - Optional properties (e.g., color).
 * @returns {THREE.Group} The deer model group.
 */
export function createDeerModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.DEER;
    const color = properties?.color || config.DEFAULT_COLOR;
    const torsoWidth = config.TORSO_WIDTH, torsoHeight = config.TORSO_HEIGHT, torsoDepth = config.TORSO_DEPTH;
    const headWidth = config.HEAD_WIDTH, headHeight = config.HEAD_HEIGHT, headDepth = config.HEAD_DEPTH;
    const neckWidth = config.NECK_WIDTH, neckHeight = config.NECK_HEIGHT, neckDepth = config.NECK_DEPTH;
    const legWidth = config.LEG_WIDTH, legHeight = config.LEG_HEIGHT, legDepth = config.LEG_DEPTH;

    const torsoGeometry = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.castShadow = true;
    torso.position.y = config.TORSO_Y_POS;
    group.add(torso);

    const headGeometry = new THREE.BoxGeometry(headWidth, headHeight, headDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const headMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    head.position.set(0, torso.position.y + config.HEAD_Y_OFFSET, config.HEAD_Z_OFFSET);
    group.add(head);

    const eyes = createEyes(headWidth, head.position, C_MODELS.HELPER_EYE_COLOR, config.EYE_SIZE / headWidth);
    group.add(eyes);
    const snout = createSnout(head.position, color, config.SNOUT_WIDTH, config.SNOUT_HEIGHT, config.SNOUT_DEPTH);
    group.add(snout);
    const ears = createEars(headWidth, headHeight, head.position, color, true); // Pointy = true for deer
    group.add(ears);

    const neckGeometry = new THREE.BoxGeometry(neckWidth, neckHeight, neckDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const neckMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.castShadow = true;
    neck.position.set(0, torso.position.y + config.NECK_Y_OFFSET, config.NECK_Z_OFFSET);
    neck.rotation.x = config.NECK_ROTATION_X;
    group.add(neck);

    const legY = config.LEG_Y_POS;
    const legGeometry = new THREE.BoxGeometry(legWidth, legHeight, legDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });

    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontLeftLeg.castShadow = true;
    frontLeftLeg.position.set(-config.LEG_X_OFFSET, legY, config.FRONT_LEG_Z);
    group.add(frontLeftLeg);
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontRightLeg.castShadow = true;
    frontRightLeg.position.set(config.LEG_X_OFFSET, legY, config.FRONT_LEG_Z);
    group.add(frontRightLeg);
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    backLeftLeg.castShadow = true;
    backLeftLeg.position.set(-config.LEG_X_OFFSET, legY, config.BACK_LEG_Z);
    group.add(backLeftLeg);
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    backRightLeg.castShadow = true;
    backRightLeg.position.set(config.LEG_X_OFFSET, legY, config.BACK_LEG_Z);
    group.add(backRightLeg);

    const antlerColor = config.ANTLER_COLOR;
    const leftAntlerGroup = new THREE.Group();
    const mainBranchGeo = new THREE.CylinderGeometry(config.ANTLER_MAIN_RADIUS_BOTTOM, config.ANTLER_MAIN_RADIUS_TOP, config.ANTLER_MAIN_HEIGHT, config.ANTLER_MAIN_SEGMENTS);
    const antlerMaterial = new THREE.MeshStandardMaterial({ color: antlerColor, roughness: config.ANTLER_ROUGHNESS });
    const leftMainBranch = new THREE.Mesh(mainBranchGeo, antlerMaterial);
    leftMainBranch.position.set(0, config.ANTLER_MAIN_Y_OFFSET, 0);
    leftMainBranch.rotation.z = config.ANTLER_MAIN_ROTATION_Z;
    leftAntlerGroup.add(leftMainBranch);
    const secondaryBranchGeo = new THREE.CylinderGeometry(config.ANTLER_SECONDARY_RADIUS_BOTTOM, config.ANTLER_SECONDARY_RADIUS_TOP, config.ANTLER_SECONDARY_HEIGHT, config.ANTLER_SECONDARY_SEGMENTS);
    const leftBranch1 = new THREE.Mesh(secondaryBranchGeo, antlerMaterial);
    leftBranch1.position.set(config.ANTLER_BRANCH1_X_OFFSET, config.ANTLER_BRANCH1_Y_OFFSET, 0);
    leftBranch1.rotation.z = config.ANTLER_BRANCH1_ROTATION_Z;
    leftAntlerGroup.add(leftBranch1);
    const leftBranch2 = new THREE.Mesh(secondaryBranchGeo, antlerMaterial);
    leftBranch2.position.set(config.ANTLER_BRANCH2_X_OFFSET, config.ANTLER_BRANCH2_Y_OFFSET, 0);
    leftBranch2.rotation.z = config.ANTLER_BRANCH2_ROTATION_Z;
    leftAntlerGroup.add(leftBranch2);
    leftAntlerGroup.position.set(-config.ANTLER_GROUP_X_OFFSET, head.position.y + config.ANTLER_GROUP_Y_OFFSET, head.position.z);
    group.add(leftAntlerGroup);
    const rightAntlerGroup = leftAntlerGroup.clone();
    rightAntlerGroup.position.set(config.ANTLER_GROUP_X_OFFSET, head.position.y + config.ANTLER_GROUP_Y_OFFSET, head.position.z);
    rightAntlerGroup.rotation.y = config.ANTLER_RIGHT_ROTATION_Y;
    group.add(rightAntlerGroup);

    group.userData.legs = { frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg };
    group.userData.legHeight = legHeight;
    return group;
}

/**
 * Creates a procedural Coyote model.
 * @param {object} [properties] - Optional properties (e.g., color).
 * @returns {THREE.Group} The coyote model group.
 */
export function createCoyoteModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.COYOTE;
    const color = properties?.color || config.DEFAULT_COLOR;
    const torsoWidth = config.TORSO_WIDTH, torsoHeight = config.TORSO_HEIGHT, torsoDepth = config.TORSO_DEPTH;
    const headWidth = config.HEAD_WIDTH, headHeight = config.HEAD_HEIGHT, headDepth = config.HEAD_DEPTH;
    const neckWidth = config.NECK_WIDTH, neckHeight = config.NECK_HEIGHT, neckDepth = config.NECK_DEPTH;
    const legWidth = config.LEG_WIDTH, legHeight = config.LEG_HEIGHT, legDepth = config.LEG_DEPTH;

    const torsoGeometry = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.castShadow = true;
    torso.position.y = config.TORSO_Y_POS;
    group.add(torso);

    const headGeometry = new THREE.BoxGeometry(headWidth, headHeight, headDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const headMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    head.position.set(0, torso.position.y + config.HEAD_Y_OFFSET, config.HEAD_Z_OFFSET);
    group.add(head);

    const eyes = createEyes(headWidth, head.position, C_MODELS.HELPER_EYE_COLOR, config.EYE_SIZE / headWidth);
    group.add(eyes);
    const snout = createSnout(head.position, color, config.SNOUT_WIDTH, config.SNOUT_HEIGHT, config.SNOUT_DEPTH);
    group.add(snout);
    const ears = createEars(headWidth, headHeight, head.position, color, true); // Pointy = true for coyote
    group.add(ears);

    const neckGeometry = new THREE.BoxGeometry(neckWidth, neckHeight, neckDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const neckMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.castShadow = true;
    neck.position.set(0, torso.position.y + config.NECK_Y_OFFSET, config.NECK_Z_OFFSET);
    neck.rotation.x = config.NECK_ROTATION_X;
    group.add(neck);

    const legY = config.LEG_Y_POS;
    const legGeometry = new THREE.BoxGeometry(legWidth, legHeight, legDepth, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });

    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontLeftLeg.castShadow = true;
    frontLeftLeg.position.set(-config.LEG_X_OFFSET, legY, config.FRONT_LEG_Z);
    group.add(frontLeftLeg);
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontRightLeg.castShadow = true;
    frontRightLeg.position.set(config.LEG_X_OFFSET, legY, config.FRONT_LEG_Z);
    group.add(frontRightLeg);
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    backLeftLeg.castShadow = true;
    backLeftLeg.position.set(-config.LEG_X_OFFSET, legY, config.BACK_LEG_Z);
    group.add(backLeftLeg);
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    backRightLeg.castShadow = true;
    backRightLeg.position.set(config.LEG_X_OFFSET, legY, config.BACK_LEG_Z);
    group.add(backRightLeg);

    const tailBasePosition = new THREE.Vector3(0, torso.position.y + config.TAIL_BASE_Y_OFFSET, config.TAIL_BASE_Z_OFFSET);
    const tailSegments = config.TAIL_SEGMENTS;
    const tailWidth = config.TAIL_WIDTH;
    const tailSegmentLength = config.TAIL_SEGMENT_LENGTH;
    let currentPos = new THREE.Vector3().copy(tailBasePosition);
    let currentAngle = config.TAIL_INITIAL_ANGLE;
    for (let i = 0; i < tailSegments; i++) {
        const segmentWidth = tailWidth * (1 - i * config.TAIL_SEGMENT_WIDTH_FACTOR);
        const segment = createBoxPart(segmentWidth, segmentWidth, tailSegmentLength, color);
        segment.position.copy(currentPos);
        segment.rotation.x = currentAngle;
        group.add(segment);
        currentPos.z += Math.cos(currentAngle) * tailSegmentLength;
        currentPos.y += Math.sin(currentAngle) * tailSegmentLength;
        currentAngle += config.TAIL_ANGLE_INCREMENT;
    }

    group.userData.legs = { frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg };
    group.userData.legHeight = legHeight;
    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a procedural Rattlesnake model.
 * @param {object} [properties] - Optional properties (e.g., color).
 * @returns {THREE.Group} The rattlesnake model group.
 */
export function createRattlesnakeModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.RATTLESNAKE;
    const color = properties?.color || config.DEFAULT_COLOR;

    const segmentMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.SEGMENT_ROUGHNESS });
    const headGeo = new THREE.ConeGeometry(config.HEAD_RADIUS, config.HEAD_HEIGHT, config.HEAD_SEGMENTS);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.HEAD_ROUGHNESS });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = config.HEAD_ROTATION_X;
    head.position.set(0, config.HEAD_Y_POS, config.HEAD_Z_POS);
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(config.EYE_RADIUS, config.EYE_SEGMENTS, config.EYE_SEGMENTS);
    const eyeMat = new THREE.MeshStandardMaterial({ color: config.EYE_COLOR, roughness: config.EYE_ROUGHNESS, metalness: config.EYE_METALNESS });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-config.EYE_X_OFFSET, config.EYE_Y_POS, config.EYE_Z_POS);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(config.EYE_X_OFFSET, config.EYE_Y_POS, config.EYE_Z_POS);
    group.add(rightEye);

    const numSegments = config.NUM_BODY_SEGMENTS;
    let currentPos = new THREE.Vector3(0, config.BODY_INITIAL_Y_POS, config.BODY_INITIAL_Z_POS);
    let currentAngle = 0;
    for (let i = 0; i < numSegments; i++) {
        const radius = config.BODY_RADIUS_START - (i * config.BODY_RADIUS_DECREMENT);
        const topRadius = radius * config.BODY_RADIUS_TOP_FACTOR; // Simplified calculation
        const segmentGeo = new THREE.CylinderGeometry(radius, topRadius, config.BODY_SEGMENT_LENGTH, config.BODY_SEGMENTS);
        const segmentColor = i % 2 === 0 ? color : new THREE.Color(color).multiplyScalar(config.BODY_COLOR_MULTIPLIER).getHex();
        const currentSegmentMat = new THREE.MeshStandardMaterial({ color: segmentColor, roughness: config.SEGMENT_ROUGHNESS });
        const segment = new THREE.Mesh(segmentGeo, currentSegmentMat);
        segment.position.copy(currentPos);
        segment.rotation.x = config.BODY_ROTATION_X;
        segment.rotation.y = currentAngle;
        group.add(segment);
        currentPos.z -= config.BODY_Z_DECREMENT;
        currentPos.x += (i % 2 === 0 ? config.BODY_X_OFFSET : -config.BODY_X_OFFSET);
        currentAngle += (i % 2 === 0 ? -config.BODY_ANGLE_INCREMENT : config.BODY_ANGLE_INCREMENT);
    }

    const rattleBasePos = new THREE.Vector3().copy(currentPos);
    rattleBasePos.z += config.RATTLE_BASE_Z_OFFSET; // Adjust based on last segment position
    const rattleSegments = config.RATTLE_SEGMENTS;
    const rattleColor = config.RATTLE_COLOR;
    const rattleMat = new THREE.MeshStandardMaterial({ color: rattleColor, roughness: config.RATTLE_ROUGHNESS });
    for (let i = 0; i < rattleSegments; i++) {
        const rattleSize = config.RATTLE_SIZE_START - (i * config.RATTLE_SIZE_DECREMENT);
        const rattleGeo = new THREE.SphereGeometry(rattleSize, config.RATTLE_SEGMENTS_DETAIL, config.RATTLE_SEGMENTS_DETAIL);
        const rattleSegment = new THREE.Mesh(rattleGeo, rattleMat);
        rattleSegment.position.copy(rattleBasePos);
        rattleSegment.position.z -= i * config.RATTLE_Z_OFFSET_FACTOR;
        group.add(rattleSegment);
    }

    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a procedural Scorpion model.
 * @param {object} [properties] - Optional properties (e.g., color).
 * @returns {THREE.Group} The scorpion model group.
 */
export function createScorpionModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.SCORPION;
    const color = properties?.color || config.DEFAULT_COLOR;

    const bodyGeo = new THREE.BoxGeometry(config.BODY_WIDTH, config.BODY_HEIGHT, config.BODY_DEPTH, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.position.y = config.BODY_Y_POS;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(config.HEAD_WIDTH, config.HEAD_HEIGHT, config.HEAD_DEPTH, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    head.position.set(0, config.HEAD_Y_POS, config.HEAD_Z_OFFSET);
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(config.EYE_RADIUS, config.EYE_SEGMENTS, config.EYE_SEGMENTS);
    const eyeMat = new THREE.MeshStandardMaterial({ color: config.EYE_COLOR, roughness: config.EYE_ROUGHNESS });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-config.EYE_X_OFFSET, config.EYE_Y_POS, config.EYE_Z_OFFSET);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(config.EYE_X_OFFSET, config.EYE_Y_POS, config.EYE_Z_OFFSET);
    group.add(rightEye);

    let tailY = config.TAIL_INITIAL_Y;
    let tailZ = config.TAIL_INITIAL_Z;
    const tailSegments = config.TAIL_SEGMENTS;
    const tailMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    for (let i = 0; i < tailSegments; i++) {
        const radius = config.TAIL_RADIUS_START - (i * config.TAIL_RADIUS_DECREMENT);
        const tailSegmentGeo = new THREE.CylinderGeometry(radius, radius, config.TAIL_SEGMENT_LENGTH, config.TAIL_SEGMENT_SEGMENTS);
        const segment = new THREE.Mesh(tailSegmentGeo, tailMat);
        segment.rotation.x = config.TAIL_ROTATION_X;
        segment.position.set(0, tailY, tailZ);
        const curveAngle = config.TAIL_CURVE_FACTOR * (i + 1) / tailSegments;
        segment.rotation.x += curveAngle;
        group.add(segment);
        tailY += config.TAIL_Y_INCREMENT;
        tailZ += config.TAIL_Z_INCREMENT;
    }

    const stingerGeo = new THREE.ConeGeometry(config.STINGER_RADIUS, config.STINGER_HEIGHT, config.STINGER_SEGMENTS);
    const stingerMat = new THREE.MeshStandardMaterial({ color: config.STINGER_COLOR, roughness: config.STINGER_ROUGHNESS, metalness: config.STINGER_METALNESS });
    const stinger = new THREE.Mesh(stingerGeo, stingerMat);
    stinger.position.set(0, tailY, tailZ);
    stinger.rotation.x = config.STINGER_ROTATION_X;
    group.add(stinger);

    const clawBaseGeo = new THREE.BoxGeometry(config.CLAW_BASE_WIDTH, config.CLAW_BASE_HEIGHT, config.CLAW_BASE_DEPTH, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const clawMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const pincerGeo = new THREE.BoxGeometry(config.PINCER_WIDTH, config.PINCER_HEIGHT, config.PINCER_DEPTH, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);

    const leftClawGroup = new THREE.Group();
    const leftClawBase = new THREE.Mesh(clawBaseGeo, clawMat);
    leftClawBase.position.set(0, 0, config.CLAW_BASE_Z_OFFSET);
    leftClawGroup.add(leftClawBase);
    const leftPincerUpper = new THREE.Mesh(pincerGeo, clawMat);
    leftPincerUpper.position.set(0, config.PINCER_UPPER_Y_OFFSET, config.PINCER_Z_OFFSET);
    leftClawGroup.add(leftPincerUpper);
    const leftPincerLower = new THREE.Mesh(pincerGeo, clawMat);
    leftPincerLower.position.set(0, config.PINCER_LOWER_Y_OFFSET, config.PINCER_Z_OFFSET);
    leftClawGroup.add(leftPincerLower);
    leftClawGroup.position.set(config.CLAW_GROUP_X_OFFSET, config.CLAW_GROUP_Y_POS, config.CLAW_GROUP_Z_OFFSET);
    leftClawGroup.rotation.y = -config.CLAW_ROTATION_Y;
    group.add(leftClawGroup);

    const rightClawGroup = leftClawGroup.clone();
    rightClawGroup.position.set(-config.CLAW_GROUP_X_OFFSET, config.CLAW_GROUP_Y_POS, config.CLAW_GROUP_Z_OFFSET);
    rightClawGroup.rotation.y = config.CLAW_ROTATION_Y;
    group.add(rightClawGroup);

    const legGeo = new THREE.BoxGeometry(config.LEG_WIDTH, config.LEG_HEIGHT, config.LEG_DEPTH, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL, config.GEOMETRY_DETAIL);
    const legMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.MATERIAL_ROUGHNESS });
    const legPositions = config.LEG_POSITIONS;
    legPositions.forEach(pos => {
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(pos.x, config.LEG_Y_POS, pos.z);
        leftLeg.rotation.z = config.LEG_ROTATION_Z;
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(-pos.x, config.LEG_Y_POS, pos.z);
        rightLeg.rotation.z = -config.LEG_ROTATION_Z;
        group.add(rightLeg);
    });

    group.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return group;
}

/**
 * Creates a procedural Buzzard model.
 * @param {object} [properties] - Optional properties (not currently used).
 * @returns {THREE.Group} The buzzard model group.
 */
export function createBuzzardModel(properties) {
    const group = new THREE.Group();
    const config = C_MODELS.BUZZARD;
    const color = config.BODY_COLOR; // Use config color

    const bodyGeo = new THREE.SphereGeometry(config.BODY_RADIUS, config.BODY_SEGMENTS_W, config.BODY_SEGMENTS_H);
    bodyGeo.scale(1, config.BODY_SCALE_Y, config.BODY_SCALE_Z);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.BODY_ROUGHNESS });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    const headGeo = new THREE.SphereGeometry(config.HEAD_RADIUS, config.HEAD_SEGMENTS_W, config.HEAD_SEGMENTS_H);
    const headMat = new THREE.MeshStandardMaterial({ color: config.HEAD_COLOR, roughness: config.HEAD_ROUGHNESS });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    head.position.set(0, config.HEAD_Y_OFFSET, config.HEAD_Z_OFFSET);
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(config.EYE_RADIUS, config.EYE_SEGMENTS, config.EYE_SEGMENTS);
    const eyeMat = new THREE.MeshStandardMaterial({ color: config.EYE_COLOR, roughness: config.EYE_ROUGHNESS, metalness: config.EYE_METALNESS });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-config.EYE_X_OFFSET, config.EYE_Y_POS, config.EYE_Z_OFFSET);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(config.EYE_X_OFFSET, config.EYE_Y_POS, config.EYE_Z_OFFSET);
    group.add(rightEye);

    const beakGeo = new THREE.ConeGeometry(config.BEAK_RADIUS, config.BEAK_HEIGHT, config.BEAK_SEGMENTS);
    const beakMat = new THREE.MeshStandardMaterial({ color: config.BEAK_COLOR, roughness: config.BEAK_ROUGHNESS });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.castShadow = true;
    beak.rotation.x = config.BEAK_ROTATION_X;
    beak.position.set(0, config.BEAK_Y_POS, config.BEAK_Z_OFFSET);
    group.add(beak);

    const wingColor = color; // Use body color for wings
    const leftWingGroup = new THREE.Group();
    const wingSegments = config.WING_SEGMENTS;
    const wingLength = config.WING_LENGTH;
    const segmentLength = wingLength / wingSegments;
    const segmentMat = new THREE.MeshStandardMaterial({ color: wingColor, roughness: config.WING_ROUGHNESS });
    for (let i = 0; i < wingSegments; i++) {
        const width = config.WING_SEGMENT_WIDTH_FACTOR * (1 - i * config.WING_SEGMENT_WIDTH_REDUCTION);
        const segmentGeo = new THREE.BoxGeometry(segmentLength, config.WING_SEGMENT_HEIGHT, width, config.GEOMETRY_DETAIL, 1, config.GEOMETRY_DETAIL);
        const segment = new THREE.Mesh(segmentGeo, segmentMat);
        segment.castShadow = true;
        segment.position.set(-segmentLength/2 - i*segmentLength, 0, 0);
        segment.rotation.z = config.WING_SEGMENT_ROTATION_FACTOR * (i + 1);
        leftWingGroup.add(segment);
    }

    const featherGeo = new THREE.BoxGeometry(config.FEATHER_WIDTH, config.FEATHER_HEIGHT, config.FEATHER_DEPTH, 1, 1, 1);
    const featherMat = new THREE.MeshStandardMaterial({ color: config.FEATHER_COLOR, roughness: config.FEATHER_ROUGHNESS });
    for (let i = 0; i < config.FEATHER_COUNT; i++) {
        const feather = new THREE.Mesh(featherGeo, featherMat);
        feather.castShadow = true;
        feather.position.set(config.FEATHER_X_POS, 0, config.FEATHER_Z_START + i * config.FEATHER_Z_INCREMENT);
        feather.rotation.z = config.FEATHER_ROTATION_Z;
        leftWingGroup.add(feather);
    }
    leftWingGroup.position.set(0, 0, 0);
    group.add(leftWingGroup);

    const rightWingGroup = leftWingGroup.clone();
    rightWingGroup.scale.x = -1;
    group.add(rightWingGroup);

    const tailGeo = new THREE.BoxGeometry(config.TAIL_WIDTH, config.TAIL_HEIGHT, config.TAIL_DEPTH, config.GEOMETRY_DETAIL, 1, config.GEOMETRY_DETAIL);
    const tailMat = new THREE.MeshStandardMaterial({ color: color, roughness: config.TAIL_ROUGHNESS });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.castShadow = true;
    tail.position.set(0, config.TAIL_Y_POS, config.TAIL_Z_POS); // Corrected: Y should likely be 0
    group.add(tail);

    group.traverse(child => { if (child.isMesh) { child.castShadow = true; } });
    return group;
}