// js/rendering/sceneSetup.js
import * as THREE from 'three'; // Re-enabled THREE import
import configManager from '../utils/configManager.js'; // Import config manager
// Import config objects and performanceManager
import { performanceManager } from '../config/config.js'; // Re-export from config.js
import { cameraConfig } from '../config/camera.js';
import { renderingConfig } from '../config/rendering.js';
import { renderingAdvancedConfig } from '../config/renderingAdvanced.js';




/**
 * Initializes the core Three.js components: scene, camera, renderer, and lighting.
 * @param {HTMLCanvasElement} canvasElement - The canvas element to render to.
 * @param {object} levelConfig - The configuration object for the current level.
 * @returns {{scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer}}
 */
export function initScene(canvasElement, levelConfig) { // Added levelConfig
    // Scene
    const scene = new THREE.Scene();
    // Use levelConfig for scene appearance
    scene.background = new THREE.Color(levelConfig.SCENE_BACKGROUND_COLOR);
    scene.fog = new THREE.Fog(levelConfig.SCENE_FOG_COLOR, levelConfig.SCENE_FOG_NEAR, levelConfig.SCENE_FOG_FAR);

    // Camera
    const camera = new THREE.PerspectiveCamera(
        cameraConfig.FOV, // Use imported constant
        window.innerWidth / window.innerHeight,
        cameraConfig.NEAR_PLANE, // Use imported constant
        cameraConfig.FAR_PLANE // Use imported constant
    );
    // Initial camera position using constants
    camera.position.set(
        renderingAdvancedConfig.INITIAL_CAMERA_POS_X,
        renderingAdvancedConfig.INITIAL_CAMERA_POS_Y,
        renderingAdvancedConfig.INITIAL_CAMERA_POS_Z
    );
    camera.lookAt(0, 0, 0); // Look at origin initially

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: renderingConfig.ANTIALIAS, // Use imported constant
        // Disable texture flipping to prevent WebGL warnings with 3D textures
        // See: https://threejs.org/docs/#api/en/renderers/WebGLRenderer
        alpha: true,
        powerPreference: 'high-performance'
    });

    // Disable texture flipping which causes warnings with 3D textures
    renderer.outputEncoding = THREE.LinearEncoding;

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(renderingConfig.PIXEL_RATIO); // Use imported constant
    renderer.shadowMap.enabled = renderingConfig.SHADOWS_ENABLED; // Use imported constant

    // Lighting
    const ambientLight = new THREE.AmbientLight(
        levelConfig.AMBIENT_LIGHT_COLOR, // Use levelConfig
        levelConfig.AMBIENT_LIGHT_INTENSITY
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
        levelConfig.DIRECTIONAL_LIGHT_COLOR, // Use levelConfig
        levelConfig.DIRECTIONAL_LIGHT_INTENSITY
    );
    directionalLight.position.set(
        levelConfig.DIRECTIONAL_LIGHT_POS_X, // Use levelConfig
        levelConfig.DIRECTIONAL_LIGHT_POS_Y,
        levelConfig.DIRECTIONAL_LIGHT_POS_Z
    );
    directionalLight.castShadow = renderingConfig.SHADOWS_ENABLED; // Use imported constant

    // Configure shadow properties based on performance settings and constants
    if (renderingConfig.SHADOWS_ENABLED) {
        const shadowQuality = performanceManager.currentQuality === 'low' ? renderingAdvancedConfig.SHADOW_MAP_SIZE_LOW :
                             performanceManager.currentQuality === 'medium' ? renderingAdvancedConfig.SHADOW_MAP_SIZE_MEDIUM :
                             renderingAdvancedConfig.SHADOW_MAP_SIZE_HIGH;

        directionalLight.shadow.mapSize.width = shadowQuality;
        directionalLight.shadow.mapSize.height = shadowQuality;
        directionalLight.shadow.camera.near = renderingAdvancedConfig.SHADOW_CAMERA_NEAR;
        directionalLight.shadow.camera.far = renderingAdvancedConfig.SHADOW_CAMERA_FAR;
        directionalLight.shadow.bias = renderingAdvancedConfig.SHADOW_BIAS;

        // Configure shadow camera frustum
        const frustumSize = renderingAdvancedConfig.SHADOW_FRUSTUM_SIZE;
        directionalLight.shadow.camera.left = -frustumSize;
        directionalLight.shadow.camera.right = frustumSize;
        directionalLight.shadow.camera.top = frustumSize;
        directionalLight.shadow.camera.bottom = -frustumSize;
        directionalLight.shadow.camera.updateProjectionMatrix(); // Important after changing frustum
    }
    scene.add(directionalLight);

    return { scene, camera, renderer };
}

/**
 * Handles window resize events to update camera aspect ratio and renderer size.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 */
export function handleResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Maintain pixel ratio from performance settings
    renderer.setPixelRatio(renderingConfig.PIXEL_RATIO); // Use imported constant
}

/**
 * Creates an FPS counter display element
 * @returns {HTMLElement} The FPS counter element
 */
export function createFpsCounter() {
    const fpsCounter = document.createElement('div');
    fpsCounter.id = 'fpsCounter';
    fpsCounter.style.position = 'fixed';
    fpsCounter.style.top = '5px';
    fpsCounter.style.right = '5px';
    fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    fpsCounter.style.color = 'white';
    fpsCounter.style.padding = '5px';
    fpsCounter.style.borderRadius = '3px';
    fpsCounter.style.fontFamily = 'monospace';
    fpsCounter.style.fontSize = '12px'; // Keep style for now
    fpsCounter.style.zIndex = '1000'; // Keep style for now
    fpsCounter.style.display = configManager.get('debug.showFPS') ? 'block' : 'none'; // Use configManager
    fpsCounter.textContent = `${renderingAdvancedConfig.FPS_COUNTER_PREFIX}--`; // Use constant
    document.body.appendChild(fpsCounter);
    return fpsCounter;
}

/**
 * Updates the FPS counter with the current FPS
 * @param {HTMLElement} fpsCounter - The FPS counter element
 * @param {number} fps - The current FPS
 */
export function updateFpsCounter(fpsCounter, fps) {
    if (!fpsCounter) return;
    // Use constants for text
    fpsCounter.textContent = `${renderingAdvancedConfig.FPS_COUNTER_PREFIX}${Math.round(fps)}${renderingAdvancedConfig.FPS_COUNTER_SEPARATOR}${performanceManager.currentQuality}`;
    fpsCounter.style.display = configManager.get('debug.showFPS') ? 'block' : 'none'; // Use configManager
}