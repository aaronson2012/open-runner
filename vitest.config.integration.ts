import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/integration/setup-integration.ts'],
    include: ['tests/integration/**/*.{test,spec}.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/unit/**',
      '**/performance/**',
    ],
    globals: true,
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: false, // Allow state sharing for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Sequential execution for integration tests
        maxThreads: 1,
      },
    },
    sequence: {
      concurrent: false, // Run integration tests sequentially
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/integration-results.json',
    },
    // Retry failed tests up to 2 times for flaky integration tests
    retry: 2,
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
  },
});