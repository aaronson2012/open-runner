import * as THREE from 'three';
import { playerConfig } from '../config/player.js';











/**
 * Creates a low-poly blocky character model with references to animatable limb groups and joint groups.
 * The model uses a nested structure:
 * - characterGroup (overall container, origin at torso center)
 *   - headMesh
 *   - torsoMesh
 *   - leftArmGroup (pivots at shoulder)
 *     - leftUpperArmMesh
 *     - leftElbowGroup (pivots at elbow)
 *       - leftElbowMesh (sphere)
 *       - leftForearmMesh
 *   - rightArmGroup (pivots at shoulder)
 *     - ... (similar structure)
 *   - leftLegGroup (pivots at hip)
 *     - leftThighMesh
 *     - leftKneeGroup (pivots at knee)
 *       - leftKneeMesh (sphere)
 *       - leftCalfMesh
 *   - rightLegGroup (pivots at hip)
 *     - ... (similar structure)
 * @returns {object} An object containing the main character group and references to limb/joint groups:
 *                   {
 *                       characterGroup: THREE.Group,
 *                       leftArmGroup: THREE.Group, rightArmGroup: THREE.Group,
 *                       leftLegGroup: THREE.Group, rightLegGroup: THREE.Group,
 *                       leftElbowGroup: THREE.Group, rightElbowGroup: THREE.Group, // Groups containing forearm+elbow, pivot at elbow
 *                       leftKneeGroup: THREE.Group, rightKneeGroup: THREE.Group    // Groups containing calf+knee, pivot at knee
 *                   }
 */

export const grayMaterial = new THREE.MeshStandardMaterial({
    color: playerConfig.DEFAULT_COLOR,
    roughness: playerConfig.DEFAULT_ROUGHNESS,
    metalness: playerConfig.DEFAULT_METALNESS
});

export function createPlayerCharacter() {

    const characterGroup = new THREE.Group(); // Overall group for the character model


    const headSize = playerConfig.HEAD_SIZE;
    const torsoHeight = playerConfig.TORSO_HEIGHT;
    const torsoWidth = playerConfig.TORSO_WIDTH;
    const torsoDepth = playerConfig.TORSO_DEPTH;
    const limbWidth = playerConfig.LIMB_WIDTH;

    const jointRadius = playerConfig.JOINT_RADIUS;


    const upperArmLength = playerConfig.UPPER_ARM_LENGTH;
    const forearmLength = playerConfig.FOREARM_LENGTH;
    const thighLength = playerConfig.THIGH_LENGTH;
    const calfLength = playerConfig.CALF_LENGTH;


    const headGeometry = new THREE.BoxGeometry(headSize, headSize, headSize);
    const headMesh = new THREE.Mesh(headGeometry, grayMaterial);
    headMesh.position.y = torsoHeight / 2 + headSize / 2;
    characterGroup.add(headMesh);


    const torsoGeometry = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
    const torsoMesh = new THREE.Mesh(torsoGeometry, grayMaterial);

    characterGroup.add(torsoMesh);


    const upperArmGeometry = new THREE.BoxGeometry(limbWidth, upperArmLength, limbWidth);
    const forearmGeometry = new THREE.BoxGeometry(limbWidth, forearmLength, limbWidth);
    const thighGeometry = new THREE.BoxGeometry(limbWidth, thighLength, limbWidth);
    const calfGeometry = new THREE.BoxGeometry(limbWidth, calfLength, limbWidth);
    const jointGeometry = new THREE.SphereGeometry(jointRadius, playerConfig.JOINT_SEGMENTS_W, playerConfig.JOINT_SEGMENTS_H);

    const leftArmGroup = new THREE.Group();
    const rightArmGroup = new THREE.Group();
    const leftLegGroup = new THREE.Group();
    const rightLegGroup = new THREE.Group();

    const leftElbowGroup = new THREE.Group();
    const rightElbowGroup = new THREE.Group();
    const leftKneeGroup = new THREE.Group();
    const rightKneeGroup = new THREE.Group();


    const shoulderY = torsoHeight / 2;
    const shoulderX = torsoWidth / 2 + limbWidth / 2;
    const hipY = -torsoHeight / 2;
    const hipX = torsoWidth / 4;
    const elbowOffsetY = -upperArmLength;
    const kneeOffsetY = -thighLength;


    const leftUpperArmMesh = new THREE.Mesh(upperArmGeometry, grayMaterial);
    const leftElbowMesh = new THREE.Mesh(jointGeometry, grayMaterial);
    const leftForearmMesh = new THREE.Mesh(forearmGeometry, grayMaterial);


    leftUpperArmMesh.position.y = -upperArmLength / 2;
    leftArmGroup.add(leftUpperArmMesh);


    leftElbowGroup.position.y = elbowOffsetY;
    leftArmGroup.add(leftElbowGroup);

    leftElbowMesh.position.y = 0;
    leftForearmMesh.position.y = -forearmLength / 2 - jointRadius * playerConfig.LIMB_OFFSET_FACTOR;

    leftElbowGroup.add(leftElbowMesh);
    leftElbowGroup.add(leftForearmMesh);


    leftArmGroup.position.set(-shoulderX, shoulderY, 0);
    characterGroup.add(leftArmGroup);


    const rightUpperArmMesh = new THREE.Mesh(upperArmGeometry, grayMaterial);
    const rightElbowMesh = new THREE.Mesh(jointGeometry, grayMaterial);
    const rightForearmMesh = new THREE.Mesh(forearmGeometry, grayMaterial);

    rightUpperArmMesh.position.y = -upperArmLength / 2;
    rightArmGroup.add(rightUpperArmMesh);

    rightElbowGroup.position.y = elbowOffsetY;
    rightArmGroup.add(rightElbowGroup);

    rightElbowMesh.position.y = 0;
    rightForearmMesh.position.y = -forearmLength / 2 - jointRadius * playerConfig.LIMB_OFFSET_FACTOR;

    rightElbowGroup.add(rightElbowMesh);
    rightElbowGroup.add(rightForearmMesh);


    rightArmGroup.position.set(shoulderX, shoulderY, 0);
    characterGroup.add(rightArmGroup);


    const leftThighMesh = new THREE.Mesh(thighGeometry, grayMaterial);
    const leftKneeMesh = new THREE.Mesh(jointGeometry, grayMaterial);
    const leftCalfMesh = new THREE.Mesh(calfGeometry, grayMaterial);

    leftThighMesh.position.y = -thighLength / 2;
    leftLegGroup.add(leftThighMesh);

    leftKneeGroup.position.y = kneeOffsetY;
    leftLegGroup.add(leftKneeGroup);

    leftKneeMesh.position.y = 0;
    leftCalfMesh.position.y = -calfLength / 2 - jointRadius * playerConfig.LIMB_OFFSET_FACTOR;

    leftKneeGroup.add(leftKneeMesh);
    leftKneeGroup.add(leftCalfMesh);


    leftLegGroup.position.set(-hipX, hipY, 0);
    characterGroup.add(leftLegGroup);


    const rightThighMesh = new THREE.Mesh(thighGeometry, grayMaterial);
    const rightKneeMesh = new THREE.Mesh(jointGeometry, grayMaterial);
    const rightCalfMesh = new THREE.Mesh(calfGeometry, grayMaterial);

    rightThighMesh.position.y = -thighLength / 2;
    rightLegGroup.add(rightThighMesh);

    rightKneeGroup.position.y = kneeOffsetY;
    rightLegGroup.add(rightKneeGroup);

    rightKneeMesh.position.y = 0;
    rightCalfMesh.position.y = -calfLength / 2 - jointRadius * playerConfig.LIMB_OFFSET_FACTOR;

    rightKneeGroup.add(rightKneeMesh);
    rightKneeGroup.add(rightCalfMesh);


    rightLegGroup.position.set(hipX, hipY, 0);
    characterGroup.add(rightLegGroup);


    return {
        characterGroup,
        leftArmGroup, rightArmGroup,
        leftLegGroup, rightLegGroup,
        leftElbowGroup, rightElbowGroup,
        leftKneeGroup, rightKneeGroup
    };
}


/**
 * Animates the character model's limbs for a running motion, including joint bending.
 * @param {object} parts - Object containing limb and joint groups { leftArmGroup, rightArmGroup, ..., leftElbowGroup, ..., leftKneeGroup, ... }.
 * @param {number} time - Current time elapsed (e.g., from THREE.Clock.getElapsedTime()).
 * @param {number} runSpeed - The speed factor for the animation frequency.
 */
export function animatePlayerCharacter(parts, animationTime, runSpeed = 10) {
    const {
        leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup,
        leftElbowGroup, rightElbowGroup, leftKneeGroup, rightKneeGroup
    } = parts;


    const frequency = runSpeed;
    const armAmplitude = playerConfig.ARM_SWING_AMPLITUDE;
    const legAmplitude = playerConfig.LEG_SWING_AMPLITUDE;
    const elbowBendAmplitude = playerConfig.ELBOW_BEND_AMPLITUDE;
    const kneeBendAmplitude = playerConfig.KNEE_BEND_AMPLITUDE;


    const armSwing = Math.sin(animationTime * frequency) * armAmplitude;
    const legSwing = Math.sin(animationTime * frequency) * legAmplitude;


    if (leftArmGroup) leftArmGroup.rotation.x = legSwing;
    if (rightArmGroup) rightArmGroup.rotation.x = -legSwing;
    if (leftLegGroup) leftLegGroup.rotation.x = -armSwing;
    if (rightLegGroup) rightLegGroup.rotation.x = armSwing;


    const kneeBend = (Math.cos(animationTime * frequency + Math.PI) + 1) / 2 * kneeBendAmplitude;
    const elbowBend = (Math.cos(animationTime * frequency) + 1) / 2 * elbowBendAmplitude;


    if (leftKneeGroup) leftKneeGroup.rotation.x = -kneeBend;
    if (rightKneeGroup) rightKneeGroup.rotation.x = -kneeBend;

    if (leftElbowGroup) leftElbowGroup.rotation.x = elbowBend;
    if (rightElbowGroup) rightElbowGroup.rotation.x = elbowBend;


}
// Default export for compatibility
export default createPlayerCharacter;