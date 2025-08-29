import './style.css';

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
//
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createHeightFunction } from './terrain/noise';
import { InfiniteTerrain } from './terrain/infinite';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const createScene = (): Scene => {
  const scene = new Scene(engine);
  // Sky blue background
  const skyTop = new Color3(0.52, 0.78, 0.94);
  const skyBottom = new Color3(0.68, 0.86, 0.96);
  scene.clearColor = skyTop.toColor4(1);

  // Lighting
  new HemisphericLight('light', new Vector3(0, 1, 0), scene);

  // Player camera (placeholder). We'll fly around with WASD/mouse.
  const camera = new UniversalCamera('player_camera', new Vector3(0, 25, -60), scene);
  camera.minZ = 0.1; // near plane
  camera.maxZ = 5000; // far plane
  camera.setTarget(new Vector3(0, 10, 0));
  camera.attachControl(canvas, true);
  camera.speed = 2.5;
  camera.inertia = 0.7;
  camera.angularSensibility = 4000;

  // Simple gradient skydome using a large sphere with vertex colors
  // This avoids extra textures and keeps the gradient subtle
  // Note: Using built-in scene clearColor for background, so this is optional; skipping mesh to keep perf

  // Terrain system
  const heightFn = createHeightFunction({
    baseFrequency: 1 / 280,
    octaves: 5,
    amplitude: 22,
    persistence: 0.52,
  });

  const TERRAIN_SIZE = 1280;
  const TERRAIN_SEGMENTS = 192;
  // Softer, more distant fog for a valley/forest vibe
  // Use linear fog to keep nearer terrain crisp while softly fading distant hills
  scene.fogMode = Scene.FOGMODE_LINEAR;
  // Slightly greener fog to evoke forested valley
  const fogColor = new Color3(
    (skyTop.r + skyBottom.r) * 0.5 * 0.95,
    (skyTop.g + skyBottom.g) * 0.5 * 1.05,
    (skyTop.b + skyBottom.b) * 0.5 * 0.95,
  );
  scene.fogColor = fogColor;
  // Linear fog parameters: start end distances relative to terrain size
  scene.fogStart = 350;  // start fading fairly far out
  scene.fogEnd = 1800;   // fully fogged at far distance

  const terrain = new InfiniteTerrain(scene, heightFn, {
    size: TERRAIN_SIZE,
    segments: TERRAIN_SEGMENTS,
  });
  terrain.update(camera.position);
  // @ts-expect-error attach for quick dev
  scene.__terrain = terrain;

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
  // Update chunk loading based on player position before render
  const cam = scene.activeCamera as UniversalCamera | null;
  const terrain = (scene as any).__terrain as InfiniteTerrain | undefined;
  if (cam && terrain) {
    terrain.update(cam.position);
  }
  scene.render();
});

window.addEventListener('resize', () => {
  engine.resize();
});

window.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'i') {
    scene.debugLayer.show();
  }
});


