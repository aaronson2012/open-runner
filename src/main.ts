import './style.css';

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/inspector';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const createScene = (): Scene => {
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.02, 0.02, 0.05).toColor4(1);

  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    Math.PI / 2.5,
    6,
    new Vector3(0, 1, 0),
    scene,
  );
  camera.attachControl(canvas, true);

  new HemisphericLight('light1', new Vector3(0, 1, 0), scene);

  MeshBuilder.CreateSphere('sphere', { diameter: 1 }, scene).position.y = 1;
  MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene);

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
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


