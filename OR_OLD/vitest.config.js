import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      'three': 'https://unpkg.com/three@0.163.0/build/three.module.js',
      'three/addons/': 'https://unpkg.com/three@0.163.0/examples/jsm/',
      'simplex-noise': 'https://cdn.skypack.dev/simplex-noise@4.0.1',
      'seedrandom': 'https://cdn.jsdelivr.net/npm/esm-seedrandom/esm/index.min.js'
    }
  }
});