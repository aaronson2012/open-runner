// js/rendering/modelUtils.js
import * as THREE from 'three';
import { modelsConfig as C_MODELS } from '../config/models.js'; // Import models config for constants

/**
 * Helper Function to create a basic box part with standard material.
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @param {number|string} color
 * @param {number} [roughness=0.7]
 * @returns {THREE.Mesh}
 */
export function createBoxPart(width, height, depth, color, roughness = 0.7) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: roughness
    });
    const part = new THREE.Mesh(geometry, material);
    part.castShadow = true;
    // part.receiveShadow = true; // Optional
    return part;
}

/**
 * Helper function to create detailed eyes for animals.
 * @param {number} headWidth
 * @param {THREE.Vector3} headPosition - Position of the head center.
 * @param {number|string} [color=C_MODELS.HELPER_EYE_COLOR] - Pupil color.
 * @param {number} [size=C_MODELS.HELPER_EYE_SIZE_FACTOR] - Pupil size factor relative to head width.
 * @returns {THREE.Group}
 */
export function createEyes(headWidth, headPosition, color = C_MODELS.HELPER_EYE_COLOR, size = C_MODELS.HELPER_EYE_SIZE_FACTOR) {
    const group = new THREE.Group();
    const pupilSize = headWidth * size; // Calculate actual size
    const whiteSize = pupilSize * C_MODELS.HELPER_EYE_WHITE_SIZE_FACTOR;
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: C_MODELS.HELPER_EYE_ROUGHNESS, metalness: C_MODELS.HELPER_EYE_METALNESS });
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: C_MODELS.HELPER_EYE_WHITE_COLOR, roughness: C_MODELS.HELPER_EYE_WHITE_ROUGHNESS, metalness: C_MODELS.HELPER_EYE_WHITE_METALNESS });
    const eyeGeometry = new THREE.SphereGeometry(pupilSize, 12, 12); // Use calculated size
    const eyeWhiteGeometry = new THREE.SphereGeometry(whiteSize, 12, 12); // Use calculated size
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    const eyeOffset = headWidth * C_MODELS.HELPER_EYE_OFFSET_FACTOR;
    const eyeDepth = headPosition.z - headWidth * C_MODELS.HELPER_EYE_DEPTH_FACTOR;
    leftEyeWhite.position.set(-eyeOffset, headPosition.y, eyeDepth);
    rightEyeWhite.position.set(eyeOffset, headPosition.y, eyeDepth);
    leftEye.position.set(-eyeOffset, headPosition.y, eyeDepth - pupilSize * C_MODELS.HELPER_EYE_PUPIL_DEPTH_FACTOR);
    rightEye.position.set(eyeOffset, headPosition.y, eyeDepth - pupilSize * C_MODELS.HELPER_EYE_PUPIL_DEPTH_FACTOR);
    group.add(leftEyeWhite, rightEyeWhite, leftEye, rightEye);
    return group;
}

/**
 * Helper function to create a more detailed snout/nose for animals.
 * @param {THREE.Vector3} headPosition - Position of the head center.
 * @param {number|string} color - Base color (will be darkened).
 * @param {number} [width=0.3]
 * @param {number} [height=0.3]
 * @param {number} [depth=0.3]
 * @returns {THREE.Group}
 */
export function createSnout(headPosition, color, width = 0.3, height = 0.3, depth = 0.3) {
    const group = new THREE.Group();
    const snoutColor = new THREE.Color(color).multiplyScalar(C_MODELS.HELPER_SNOUT_COLOR_MULTIPLIER);
    const noseTipColor = new THREE.Color(color).multiplyScalar(C_MODELS.HELPER_SNOUT_TIP_COLOR_MULTIPLIER);
    const snoutGeometry = new THREE.BoxGeometry(width, height, depth, 3, 3, 3);
    const snoutMaterial = new THREE.MeshStandardMaterial({ color: snoutColor.getHex(), roughness: C_MODELS.HELPER_SNOUT_ROUGHNESS });
    const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
    snout.castShadow = true;
    const noseTipGeometry = new THREE.SphereGeometry(width * C_MODELS.HELPER_SNOUT_TIP_SIZE_FACTOR, 8, 8);
    const noseTipMaterial = new THREE.MeshStandardMaterial({ color: noseTipColor.getHex(), roughness: C_MODELS.HELPER_SNOUT_TIP_ROUGHNESS });
    const noseTip = new THREE.Mesh(noseTipGeometry, noseTipMaterial);
    noseTip.position.set(0, 0, -depth * C_MODELS.HELPER_SNOUT_TIP_DEPTH_FACTOR);
    noseTip.castShadow = true;
    snout.add(noseTip);
    snout.position.set(0, headPosition.y - height * C_MODELS.HELPER_SNOUT_Y_OFFSET_FACTOR, headPosition.z - depth * C_MODELS.HELPER_SNOUT_Z_OFFSET_FACTOR);
    group.add(snout);
    return group;
}

/**
 * Helper function to create more detailed ears for animals.
 * @param {number} headWidth
 * @param {number} headHeight
 * @param {THREE.Vector3} headPosition - Position of the head center.
 * @param {number|string} color - Base color (will be darkened).
 * @param {boolean} [pointy=false] - If true, creates cone-shaped ears.
 * @returns {THREE.Group}
 */
export function createEars(headWidth, headHeight, headPosition, color, pointy = false) {
    const group = new THREE.Group();
    const earColor = new THREE.Color(color).multiplyScalar(C_MODELS.HELPER_EAR_COLOR_MULTIPLIER);
    const innerEarColor = new THREE.Color(C_MODELS.HELPER_INNER_EAR_COLOR);
    let leftEar, rightEar, leftInnerEar, rightInnerEar;

    if (pointy) {
        const earGeometry = new THREE.ConeGeometry(headWidth * C_MODELS.HELPER_POINTY_EAR_RADIUS_FACTOR, headHeight * C_MODELS.HELPER_POINTY_EAR_HEIGHT_FACTOR, 8);
        const innerEarGeometry = new THREE.ConeGeometry(headWidth * C_MODELS.HELPER_POINTY_INNER_EAR_RADIUS_FACTOR, headHeight * C_MODELS.HELPER_POINTY_INNER_EAR_HEIGHT_FACTOR, 8);
        leftEar = new THREE.Mesh(earGeometry, new THREE.MeshStandardMaterial({ color: earColor.getHex(), roughness: C_MODELS.HELPER_EAR_ROUGHNESS }));
        rightEar = new THREE.Mesh(earGeometry, new THREE.MeshStandardMaterial({ color: earColor.getHex(), roughness: C_MODELS.HELPER_EAR_ROUGHNESS }));
        leftInnerEar = new THREE.Mesh(innerEarGeometry, new THREE.MeshStandardMaterial({ color: innerEarColor.getHex(), roughness: C_MODELS.HELPER_INNER_EAR_ROUGHNESS }));
        rightInnerEar = new THREE.Mesh(innerEarGeometry, new THREE.MeshStandardMaterial({ color: innerEarColor.getHex(), roughness: C_MODELS.HELPER_INNER_EAR_ROUGHNESS }));
        leftInnerEar.position.z = C_MODELS.HELPER_INNER_EAR_Z_OFFSET;
        rightInnerEar.position.z = C_MODELS.HELPER_INNER_EAR_Z_OFFSET;
        leftEar.add(leftInnerEar);
        rightEar.add(rightInnerEar);
        leftEar.rotation.z = C_MODELS.HELPER_POINTY_EAR_ROTATION_Z;
        rightEar.rotation.z = -C_MODELS.HELPER_POINTY_EAR_ROTATION_Z;
    } else {
        const earGeometry = new THREE.SphereGeometry(headWidth * C_MODELS.HELPER_ROUND_EAR_RADIUS_FACTOR, 12, 12);
        const innerEarGeometry = new THREE.SphereGeometry(headWidth * C_MODELS.HELPER_ROUND_INNER_EAR_RADIUS_FACTOR, 10, 10);
        leftEar = new THREE.Mesh(earGeometry, new THREE.MeshStandardMaterial({ color: earColor.getHex(), roughness: C_MODELS.HELPER_EAR_ROUGHNESS }));
        rightEar = new THREE.Mesh(earGeometry, new THREE.MeshStandardMaterial({ color: earColor.getHex(), roughness: C_MODELS.HELPER_EAR_ROUGHNESS }));
        leftEar.scale.set(1, C_MODELS.HELPER_ROUND_EAR_SCALE_Y, C_MODELS.HELPER_ROUND_EAR_SCALE_Z);
        rightEar.scale.set(1, C_MODELS.HELPER_ROUND_EAR_SCALE_Y, C_MODELS.HELPER_ROUND_EAR_SCALE_Z);
        leftInnerEar = new THREE.Mesh(innerEarGeometry, new THREE.MeshStandardMaterial({ color: innerEarColor.getHex(), roughness: C_MODELS.HELPER_INNER_EAR_ROUGHNESS }));
        rightInnerEar = new THREE.Mesh(innerEarGeometry, new THREE.MeshStandardMaterial({ color: innerEarColor.getHex(), roughness: C_MODELS.HELPER_INNER_EAR_ROUGHNESS }));
        leftInnerEar.scale.set(1, C_MODELS.HELPER_ROUND_EAR_SCALE_Y, C_MODELS.HELPER_ROUND_EAR_SCALE_Z);
        rightInnerEar.scale.set(1, C_MODELS.HELPER_ROUND_EAR_SCALE_Y, C_MODELS.HELPER_ROUND_EAR_SCALE_Z);
        leftInnerEar.position.z = C_MODELS.HELPER_INNER_EAR_Z_OFFSET;
        rightInnerEar.position.z = C_MODELS.HELPER_INNER_EAR_Z_OFFSET;
        leftEar.add(leftInnerEar);
        rightEar.add(rightInnerEar);
    }

    const earOffset = headWidth * C_MODELS.HELPER_EAR_OFFSET_FACTOR;
    leftEar.position.set(-earOffset, headPosition.y + headHeight * C_MODELS.HELPER_EAR_Y_OFFSET_FACTOR, headPosition.z);
    rightEar.position.set(earOffset, headPosition.y + headHeight * C_MODELS.HELPER_EAR_Y_OFFSET_FACTOR, headPosition.z);
    leftEar.castShadow = true;
    rightEar.castShadow = true;
    group.add(leftEar, rightEar);
    return group;
}

/**
 * Helper function to create an improved tail (potentially curved).
 * @param {THREE.Vector3} basePosition - Starting position of the tail base.
 * @param {number|string} color
 * @param {number} [length=1.0]
 * @param {number} [width=0.3]
 * @param {boolean} [curved=true]
 * @returns {THREE.Group}
 */
export function createImprovedTail(basePosition, color, length = 1.0, width = 0.3, curved = true) {
    const group = new THREE.Group();
    if (curved) {
        const segments = C_MODELS.HELPER_TAIL_SEGMENTS;
        const segmentLength = length / segments;
        const segmentWidth = width;
        let currentPos = new THREE.Vector3().copy(basePosition);
        let currentAngle = 0;
        for (let i = 0; i < segments; i++) {
            const segment = createBoxPart(segmentWidth, segmentWidth, segmentLength, color);
            segment.position.copy(currentPos);
            const curveAngle = C_MODELS.HELPER_TAIL_CURVE_FACTOR * (i / segments);
            segment.rotation.x = currentAngle;
            group.add(segment);
            currentPos.z += Math.cos(currentAngle) * segmentLength;
            currentPos.y += Math.sin(currentAngle) * segmentLength;
            currentAngle += curveAngle;
        }
    } else {
        const tail = createBoxPart(width, width, length, color);
        tail.position.copy(basePosition);
        group.add(tail);
    }
    return group;
}