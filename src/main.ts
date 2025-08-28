import './style.css';

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/inspector';
import { createHeightFunction } from './terrain/noise';
import { TerrainManager } from './terrain/manager';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const createScene = (): Scene => {
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.02, 0.02, 0.05).toColor4(1);

  // Lighting
  new HemisphericLight('light', new Vector3(0, 1, 0), scene);

  // Player camera (placeholder). We'll fly around with WASD/mouse.
  const camera = new UniversalCamera('player_camera', new Vector3(0, 25, -60), scene);
  camera.minZ = 0.1; // near plane
  camera.maxZ = 2000; // far plane
  camera.setTarget(new Vector3(0, 10, 0));
  camera.attachControl(canvas, true);
  camera.speed = 2.5;
  camera.inertia = 0.7;
  camera.angularSensibility = 4000;

  // Terrain system
  const heightFn = createHeightFunction({
    baseFrequency: 1 / 250,
    octaves: 5,
    amplitude: 18,
  });

  const terrain = new TerrainManager(scene, heightFn, {
    chunkSize: 64,
    segments: 64,
    viewDistanceChunks: 3,
  });

  // Update terrain around the camera initially
  terrain.updateAroundPosition(camera.position);

  // Keep a reference on scene for access in render loop
  // @ts-expect-error attach for quick dev
  scene.__terrain = terrain;

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
  // Update chunk loading based on player position before render
  const cam = scene.activeCamera as UniversalCamera | null;
  const terrain = (scene as any).__terrain as TerrainManager | undefined;
  if (cam && terrain) {
    terrain.updateAroundPosition(cam.position);
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


