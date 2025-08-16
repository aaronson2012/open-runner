import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'performance',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/performance/setup-performance.ts'],
    include: ['tests/performance/**/*.{test,spec,bench}.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/unit/**',
      '**/integration/**',
    ],
    globals: true,
    testTimeout: 60000, // Extended timeout for performance tests
    hookTimeout: 15000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Single thread for accurate performance measurement
        maxThreads: 1,
      },
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/performance-results.json',
    },
    // Benchmark configuration
    benchmark: {
      include: ['tests/performance/**/*.bench.{js,ts}'],
      exclude: ['**/node_modules/**'],
      reporters: ['verbose', 'json'],
      outputFile: './test-results/benchmark-results.json',
    },
    // Performance test specific settings
    maxConcurrency: 1, // Prevent interference between performance tests
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'public/assets'),
      '@components': resolve(__dirname, 'src/components'),
      '@core': resolve(__dirname, 'src/core'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GITHUB_PAGES__: JSON.stringify(false),
    __BASE_PATH__: JSON.stringify('/'),
    // Performance test specific defines
    __PERFORMANCE_MODE__: JSON.stringify(true),
    __ENABLE_PROFILING__: JSON.stringify(true),
  },
});