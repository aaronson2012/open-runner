# Library Dependencies

This directory contains essential JavaScript libraries that are needed for the game to run on GitHub Pages.

## Contents

- `three/build/three.module.js` - Three.js 3D graphics library (v0.163.0)
- `simplex-noise/dist/esm/simplex-noise.js` - Simplex noise library (v4.0.1)

## Why These Files Are Here

These files are copied from `node_modules` to ensure they are available when the game is deployed to GitHub Pages. Since `node_modules` is not deployed (it's in `.gitignore`), these essential dependencies are vendored in the `lib` directory.

## Updating Dependencies

If you need to update these dependencies:

1. Update the version in `package.json`
2. Run `npm install`
3. Copy the updated files from `node_modules` to `lib`:
   ```bash
   cp node_modules/three/build/three.module.js lib/three/build/
   cp node_modules/simplex-noise/dist/esm/simplex-noise.js lib/simplex-noise/dist/esm/
   ```
4. Update the import map in `index.html` if needed